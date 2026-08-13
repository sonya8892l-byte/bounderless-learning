import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabasePool, probeDatabase } from '../server/database/pool.js';
import {
  createPostgresCourseRunStore,
  createPostgresSessionStore,
} from '../server/runtime/postgres-store.js';

function compactSql(sql) {
  return String(sql).replaceAll(/\s+/g, ' ').trim();
}

function poolWithQuery(query) {
  return {
    query,
    async connect() {
      throw new Error('此测试不应取得独占连接。');
    },
  };
}

function validSessionValues(overrides = {}) {
  return {
    id: 'ses_postgres_test',
    courseId: 'lesson_gewu_001',
    studentId: 'student-001',
    groupId: 'group-001',
    runId: 'run-001',
    participantId: 'participant-001',
    roleId: 'role-water',
    grade: '初中',
    phaseId: 'phase-2',
    ...overrides,
  };
}

function activeRuntimeState(overrides = {}) {
  const run = {
    id: 'run-001',
    courseId: 'lesson_gewu_001',
    status: 'active',
    paused: false,
    rallyActive: false,
    rolesReleased: true,
    rolesLocked: false,
    roleClaimMode: 'student_claim',
    roleOptions: [{ id: 'role-water', name: '水务角色' }],
    phaseId: 'phase-2',
    phaseIndex: 1,
    version: 7,
    participants: [{
      id: 'participant-001',
      groupId: 'group-001',
      roleId: 'role-water',
      roleName: '水务角色',
      device: { roleClaimed: true },
      learnerSessionId: 'ses_guarded',
    }],
    ...overrides,
  };
  return {
    schemaVersion: 1,
    sequence: 0,
    runs: [run],
    alerts: [],
    commands: [],
    receipts: [],
    interventions: [],
    auditEvents: [],
    events: [],
  };
}

test('共享数据库 pool 使用受限连接数、超时配置并监听 idle client error', () => {
  const logEntries = [];

  class FakePool {
    constructor(options) {
      this.options = options;
      this.listeners = new Map();
    }

    on(event, listener) {
      this.listeners.set(event, listener);
      return this;
    }
  }

  const pool = createDatabasePool({
    databaseUrl: 'postgresql://example.invalid/study',
    logger: {
      error(details, message) {
        logEntries.push({ details, message });
      },
    },
    PoolClass: FakePool,
  });

  assert.deepEqual(pool.options, {
    connectionString: 'postgresql://example.invalid/study',
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    maxLifetimeSeconds: 300,
    query_timeout: 8_000,
    statement_timeout: 8_000,
    idle_in_transaction_session_timeout: 8_000,
    application_name: 'forbidden-city-study-api',
  });
  assert.equal(typeof pool.listeners.get('error'), 'function');

  pool.listeners.get('error')(Object.assign(new Error('敏感的底层连接错误'), {
    code: 'ECONNRESET',
  }));
  assert.deepEqual(logEntries, [{
    details: {
      err: {
        code: 'ECONNRESET',
        name: 'Error',
      },
    },
    message: 'database idle client error',
  }]);
});

test('PostgreSQL session create 使用 INSERT 并把初始版本用于连续 CAS save', async () => {
  let stateVersion = 0;
  const statements = [];
  const expectedVersions = [];
  const pool = poolWithQuery(async (sql, parameters) => {
    const normalized = compactSql(sql);
    statements.push({ sql: normalized, parameters });

    if (normalized.startsWith('insert into learner_sessions')) {
      stateVersion = 1;
      return {
        rowCount: 1,
        rows: [{ state_version: stateVersion, updated_at: new Date('2026-07-31T01:00:00.000Z') }],
      };
    }

    if (normalized.startsWith('update learner_sessions')) {
      const expectedVersion = parameters[6];
      expectedVersions.push(expectedVersion);
      assert.equal(expectedVersion, stateVersion);
      stateVersion += 1;
      return {
        rowCount: 1,
        rows: [{ state_version: stateVersion, updated_at: new Date(`2026-07-31T01:00:0${stateVersion}.000Z`) }],
      };
    }

    throw new Error(`未预期的 SQL：${normalized}`);
  });

  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues());
  session.messages.push({ role: 'user', content: '第一次保存' });
  await store.save(session);
  session.messages.push({ role: 'assistant', content: '第二次保存' });
  await store.save(session);

  assert.match(statements[0].sql, /^insert into learner_sessions \(/i);
  assert.match(statements[0].sql, /values \(\$1, \$2::jsonb, 1,/i);
  assert.equal(statements[0].parameters[0], 'ses_postgres_test');
  assert.deepEqual(expectedVersions, [1, 2]);
  assert.equal(stateVersion, 3);
  assert.equal(session.updatedAt, '2026-07-31T01:00:03.000Z');
});

test('PostgreSQL session get 会补全旧版 JSONB 的缺失字段', async () => {
  const legacyPayload = {
    schemaVersion: 1,
    id: 'ses_legacy',
    courseId: 'lesson_gewu_001',
    studentId: 'student-legacy',
    groupId: 'group-legacy',
    roleId: 'role-water',
    phaseId: 'phase-3',
    messages: '旧数据中的错误类型',
    dialogueState: {
      lifecycle: 'ANSWERING',
      confirmedSlots: { arrival: true },
    },
  };
  const pool = poolWithQuery(async (sql, parameters) => {
    assert.match(compactSql(sql), /^select payload, state_version, updated_at from learner_sessions/i);
    assert.deepEqual(parameters, ['ses_legacy']);
    return {
      rowCount: 1,
      rows: [{
        payload: legacyPayload,
        state_version: 7,
        updated_at: new Date('2026-07-31T02:03:04.000Z'),
      }],
    };
  });

  const store = createPostgresSessionStore({ pool });
  const session = await store.get('ses_legacy');

  assert.equal(session.schemaVersion, 2);
  assert.equal(session.phaseNumber, 3);
  assert.deepEqual(session.messages, []);
  assert.deepEqual(session.completedTaskIds, []);
  assert.equal(session.learningState.stepStatus, 'active');
  assert.equal(session.dialogueState.lifecycle, 'ANSWERING');
  assert.deepEqual(session.dialogueState.confirmedSlots, {
    arrival: true,
    readiness: false,
  });
  assert.equal(session.updatedAt, '2026-07-31T02:03:04.000Z');
});

test('PostgreSQL session CAS 未更新任何行时抛出 SESSION_WRITE_CONFLICT', async () => {
  const pool = poolWithQuery(async (sql) => {
    const normalized = compactSql(sql);
    if (normalized.startsWith('insert into learner_sessions')) {
      return {
        rowCount: 1,
        rows: [{ state_version: 1, updated_at: '2026-07-31T03:00:00.000Z' }],
      };
    }
    if (normalized.startsWith('update learner_sessions')) {
      return { rowCount: 0, rows: [] };
    }
    throw new Error(`未预期的 SQL：${normalized}`);
  });

  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues({ id: 'ses_conflict' }));

  await assert.rejects(
    store.save(session),
    (error) => {
      assert.equal(error.code, 'SESSION_WRITE_CONFLICT');
      assert.equal(error.statusCode, 409);
      assert.equal(error.sessionId, 'ses_conflict');
      return true;
    },
  );
});

test('PostgreSQL 普通 learner save 在同一事务锁住 course-runs 并校验当前会话', async () => {
  const calls = [];
  const runtimeState = activeRuntimeState();
  const client = {
    async query(sql, parameters) {
      const normalized = compactSql(sql);
      calls.push({ sql: normalized, parameters });
      if (normalized === 'begin' || normalized === 'commit') return { rowCount: null, rows: [] };
      if (normalized.startsWith('select payload from runtime_state')) {
        return { rowCount: 1, rows: [{ payload: runtimeState }] };
      }
      if (normalized.startsWith('update learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{ state_version: 2, updated_at: new Date('2026-08-11T01:00:02.000Z') }],
        };
      }
      throw new Error(`未预期的 SQL：${normalized}`);
    },
    release() {},
  };
  const pool = {
    async query(sql) {
      const normalized = compactSql(sql);
      if (normalized.startsWith('insert into learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{ state_version: 1, updated_at: new Date('2026-08-11T01:00:01.000Z') }],
        };
      }
      throw new Error(`未预期的 direct SQL：${normalized}`);
    },
    async connect() { return client; },
  };
  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues({ id: 'ses_guarded' }));

  await store.save(session, {
    runtimeGuard: { required: true, operation: 'time_bank_answer' },
  });

  assert.deepEqual(calls.map(({ sql }) => sql), [
    'begin',
    'select payload from runtime_state where id = $1 for update',
    calls[2].sql,
    'commit',
  ]);
  assert.match(calls[2].sql, /^update learner_sessions/i);
  assert.deepEqual(calls[1].parameters, ['course-runs']);
});

test('PostgreSQL 角色领取在同一事务写入 Agent 会话和场次占位', async () => {
  const runtimeState = activeRuntimeState({
    participants: [{
      id: 'participant-001',
      groupId: 'group-001',
      roleId: '',
      roleName: '',
      device: { roleClaimed: false },
      learnerSessionId: 'ses_role_claim_atomic',
    }],
  });
  let persistedRuntime = null;
  const statements = [];
  const client = {
    async query(sql, parameters) {
      const normalized = compactSql(sql);
      statements.push(normalized);
      if (normalized === 'begin' || normalized === 'commit') return { rowCount: null, rows: [] };
      if (normalized.startsWith('select payload from runtime_state')) {
        return { rowCount: 1, rows: [{ payload: runtimeState }] };
      }
      if (normalized.startsWith('update learner_sessions')) {
        assert.equal(parameters[5], 'role-water');
        return {
          rowCount: 1,
          rows: [{ state_version: 2, updated_at: new Date('2026-08-11T01:30:02.000Z') }],
        };
      }
      if (normalized.startsWith('update runtime_state')) {
        persistedRuntime = JSON.parse(parameters[0]);
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`未预期的 SQL：${normalized}`);
    },
    release() {},
  };
  const pool = {
    async query(sql) {
      if (compactSql(sql).startsWith('insert into learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{ state_version: 1, updated_at: new Date('2026-08-11T01:30:01.000Z') }],
        };
      }
      throw new Error(`未预期的 direct SQL：${compactSql(sql)}`);
    },
    async connect() { return client; },
  };
  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues({ id: 'ses_role_claim_atomic' }));

  await store.save(session, {
    runtimeGuard: {
      required: true,
      operation: 'role_claim',
      roleAssignment: true,
      requestedRoleId: 'role-water',
    },
  });

  assert.deepEqual(statements, [
    'begin',
    'select payload from runtime_state where id = $1 for update',
    statements[2],
    statements[3],
    'commit',
  ]);
  assert.match(statements[2], /^update learner_sessions/u);
  assert.match(statements[3], /^update runtime_state/u);
  const participant = persistedRuntime.runs[0].participants[0];
  assert.equal(participant.roleId, 'role-water');
  assert.equal(participant.learnerSessionId, 'ses_role_claim_atomic');
  assert.equal(participant.device.roleClaimed, true);
  assert.equal(
    persistedRuntime.events.some((event) => event.type === 'participant.role_claimed'),
    true,
  );
});

test('PostgreSQL 在 pause/rally 中允许同角色幂等重试，仍拒绝不同角色', async () => {
  for (const scenario of [
    { name: 'pause', flag: 'paused', rejectedCode: 'COURSE_RUN_PAUSED' },
    { name: 'rally', flag: 'rallyActive', rejectedCode: 'COURSE_RUN_RALLY_ACTIVE' },
  ]) {
    const sessionId = `ses_role_claim_idempotent_${scenario.name}`;
    const runtimeState = activeRuntimeState({
      [scenario.flag]: true,
      roleOptions: [
        { id: 'role-water', name: '水务角色' },
        { id: 'role-fire', name: '防火角色' },
      ],
      participants: [{
        id: 'participant-001',
        groupId: 'group-001',
        roleId: 'role-water',
        roleName: '水务角色',
        roleClaimedAt: '2026-08-11T01:20:00.000Z',
        roleClaimSource: 'student',
        device: { roleClaimed: true },
        learnerSessionId: sessionId,
      }],
    });
    let learnerWrites = 0;
    let runtimeWrites = 0;
    const client = {
      async query(sql) {
        const normalized = compactSql(sql);
        if (['begin', 'commit', 'rollback'].includes(normalized)) return { rowCount: null, rows: [] };
        if (normalized.startsWith('select payload from runtime_state')) {
          return { rowCount: 1, rows: [{ payload: runtimeState }] };
        }
        if (normalized.startsWith('update learner_sessions')) {
          learnerWrites += 1;
          return {
            rowCount: 1,
            rows: [{ state_version: learnerWrites + 1, updated_at: new Date('2026-08-11T01:25:00.000Z') }],
          };
        }
        if (normalized.startsWith('update runtime_state')) {
          runtimeWrites += 1;
          return { rowCount: 1, rows: [] };
        }
        throw new Error(`未预期的 SQL：${normalized}`);
      },
      release() {},
    };
    const pool = {
      async query(sql) {
        if (compactSql(sql).startsWith('insert into learner_sessions')) {
          return {
            rowCount: 1,
            rows: [{ state_version: 1, updated_at: new Date('2026-08-11T01:24:00.000Z') }],
          };
        }
        throw new Error(`未预期的 direct SQL：${compactSql(sql)}`);
      },
      async connect() { return client; },
    };
    const store = createPostgresSessionStore({ pool });
    const session = await store.create(validSessionValues({ id: sessionId }));

    await store.save(session, {
      runtimeGuard: {
        required: true,
        operation: 'role_claim',
        roleAssignment: true,
        requestedRoleId: 'role-water',
      },
    });
    assert.equal(learnerWrites, 1, `${scenario.name} 同角色重试应允许 Agent 会话幂等落盘`);

    const writesBeforeConflict = { learnerWrites, runtimeWrites };
    await assert.rejects(
      store.save(session, {
        runtimeGuard: {
          required: true,
          operation: 'role_claim',
          roleAssignment: true,
          requestedRoleId: 'role-fire',
        },
      }),
      (error) => error.code === scenario.rejectedCode,
    );
    assert.deepEqual(
      { learnerWrites, runtimeWrites },
      writesBeforeConflict,
      `${scenario.name} 不同角色重试不应产生写入`,
    );
  }
});

test('PostgreSQL 同组角色冲突回滚且不写 Agent 会话', async () => {
  const runtimeState = activeRuntimeState({
    participants: [
      {
        id: 'participant-001', groupId: 'group-001', roleId: '', roleName: '',
        device: { roleClaimed: false }, learnerSessionId: 'ses_role_claim_conflict',
      },
      {
        id: 'participant-002', groupId: 'group-001', roleId: 'role-water', roleName: '水务角色',
        device: { roleClaimed: true }, learnerSessionId: 'ses_role_owner',
      },
    ],
  });
  let learnerWrites = 0;
  let runtimeWrites = 0;
  const client = {
    async query(sql) {
      const normalized = compactSql(sql);
      if (normalized === 'begin' || normalized === 'rollback') return { rowCount: null, rows: [] };
      if (normalized.startsWith('select payload from runtime_state')) {
        return { rowCount: 1, rows: [{ payload: runtimeState }] };
      }
      if (normalized.startsWith('update learner_sessions')) learnerWrites += 1;
      if (normalized.startsWith('update runtime_state')) runtimeWrites += 1;
      throw new Error(`不应执行写入：${normalized}`);
    },
    release() {},
  };
  const pool = {
    async query(sql) {
      if (compactSql(sql).startsWith('insert into learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{ state_version: 1, updated_at: new Date('2026-08-11T01:40:01.000Z') }],
        };
      }
      throw new Error(`未预期的 direct SQL：${compactSql(sql)}`);
    },
    async connect() { return client; },
  };
  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues({ id: 'ses_role_claim_conflict' }));

  await assert.rejects(
    store.save(session, {
      runtimeGuard: {
        required: true,
        operation: 'role_claim',
        roleAssignment: true,
        requestedRoleId: 'role-water',
      },
    }),
    (error) => {
      assert.equal(error.code, 'COURSE_ROLE_TAKEN');
      assert.equal(error.details.runState.takenRoleIds.includes('role-water'), true);
      return true;
    },
  );
  assert.equal(learnerWrites, 0);
  assert.equal(runtimeWrites, 0);
});

test('save 已进入后教师 pause/end/rally/切换会话先生效时，锁内门禁拒绝落盘', async () => {
  const cases = [
    {
      name: 'pause',
      code: 'COURSE_RUN_PAUSED',
      apply(run) { run.paused = true; },
    },
    {
      name: 'end',
      code: 'COURSE_RUN_COMPLETED',
      apply(run) { run.status = 'completed'; },
    },
    {
      name: 'rally',
      code: 'COURSE_RUN_RALLY_ACTIVE',
      apply(run) { run.rallyActive = true; },
    },
    {
      name: 'activate-B',
      code: 'COURSE_SESSION_INACTIVE',
      apply(run) { run.participants[0].learnerSessionId = 'ses_role_b'; },
    },
  ];

  for (const scenario of cases) {
    const runtimeState = activeRuntimeState();
    let releaseRuntimeRead;
    let markRuntimeRead;
    let learnerWrites = 0;
    const runtimeReadStarted = new Promise((resolve) => { markRuntimeRead = resolve; });
    const runtimeReadReleased = new Promise((resolve) => { releaseRuntimeRead = resolve; });
    const client = {
      async query(sql) {
        const normalized = compactSql(sql);
        if (normalized === 'begin' || normalized === 'rollback') return { rowCount: null, rows: [] };
        if (normalized.startsWith('select payload from runtime_state')) {
          markRuntimeRead();
          await runtimeReadReleased;
          return { rowCount: 1, rows: [{ payload: runtimeState }] };
        }
        if (normalized.startsWith('update learner_sessions')) {
          learnerWrites += 1;
          return {
            rowCount: 1,
            rows: [{ state_version: 2, updated_at: new Date('2026-08-11T02:00:02.000Z') }],
          };
        }
        throw new Error(`未预期的 SQL：${normalized}`);
      },
      release() {},
    };
    const pool = {
      async query(sql) {
        if (compactSql(sql).startsWith('insert into learner_sessions')) {
          return {
            rowCount: 1,
            rows: [{ state_version: 1, updated_at: new Date('2026-08-11T02:00:01.000Z') }],
          };
        }
        throw new Error(`未预期的 direct SQL：${compactSql(sql)}`);
      },
      async connect() { return client; },
    };
    const store = createPostgresSessionStore({ pool });
    const session = await store.create(validSessionValues({ id: 'ses_guarded' }));
    const saving = store.save(session, {
      runtimeGuard: { required: true, operation: 'learner_turn' },
    });

    await runtimeReadStarted;
    scenario.apply(runtimeState.runs[0]);
    releaseRuntimeRead();

    await assert.rejects(saving, (error) => {
      assert.equal(error.code, scenario.code, scenario.name);
      assert.equal(error.statusCode, 409, scenario.name);
      return true;
    });
    assert.equal(learnerWrites, 0, `${scenario.name} 生效后不应写 learner_sessions`);
  }
});

test('PostgreSQL session 与 AI 请求结果在同一事务内原子提交', async () => {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, parameters) {
      const normalized = compactSql(sql);
      calls.push({ sql: normalized, parameters });
      if (normalized === 'begin' || normalized === 'commit') {
        return { rowCount: null, rows: [] };
      }
      if (normalized.startsWith('update learner_sessions')) {
        assert.equal(parameters[6], 1);
        return {
          rowCount: 1,
          rows: [{
            state_version: 2,
            updated_at: new Date('2026-07-31T04:00:02.000Z'),
          }],
        };
      }
      if (normalized.startsWith('update learner_requests')) {
        assert.deepEqual(parameters.slice(0, 3), [
          'ses_atomic',
          'req_atomic',
          'd8e6ff2f-dfbe-49a5-8404-44ae963abc8b',
        ]);
        assert.deepEqual(JSON.parse(parameters[3]), {
          events: [{ type: 'assistant.completed', data: { text: '原子结果' } }],
        });
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`未预期的 SQL：${normalized}`);
    },
    release() {
      released = true;
    },
  };
  const pool = {
    async query(sql) {
      const normalized = compactSql(sql);
      if (normalized.startsWith('insert into learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{
            state_version: 1,
            updated_at: new Date('2026-07-31T04:00:01.000Z'),
          }],
        };
      }
      throw new Error(`未预期的 direct SQL：${normalized}`);
    },
    async connect() {
      return client;
    },
  };
  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues({ id: 'ses_atomic' }));
  session.handledRequestIds.push('req_atomic');

  await store.saveWithRequestResult(session, {
    requestId: 'req_atomic',
    leaseToken: 'd8e6ff2f-dfbe-49a5-8404-44ae963abc8b',
    result: {
      events: [{ type: 'assistant.completed', data: { text: '原子结果' } }],
    },
  });

  assert.equal(calls.length, 4);
  assert.equal(calls[0].sql, 'begin');
  assert.match(calls[1].sql, /^update learner_sessions/i);
  assert.match(calls[2].sql, /^update learner_requests/i);
  assert.equal(calls[3].sql, 'commit');
  assert.equal(session.updatedAt, '2026-07-31T04:00:02.000Z');
  assert.equal(released, true);
});

test('教师指令的 session 状态、请求结果与 delivered 回执在同一 Postgres 事务提交', async () => {
  const calls = [];
  const runtimeState = activeRuntimeState();
  runtimeState.commands.push({
    id: 'cmd-atomic', runId: 'run-001', action: 'set_scaffold',
  });
  runtimeState.receipts.push({
    id: 'receipt-atomic',
    commandId: 'cmd-atomic',
    participantId: 'participant-001',
    learnerSessionId: 'ses_guarded',
    status: 'accepted',
    deliveredAt: null,
  });
  let persistedRuntimeState = null;
  const client = {
    async query(sql, parameters) {
      const normalized = compactSql(sql);
      calls.push(normalized);
      if (normalized === 'begin' || normalized === 'commit') return { rowCount: null, rows: [] };
      if (normalized.startsWith('select payload from runtime_state')) {
        return { rowCount: 1, rows: [{ payload: runtimeState }] };
      }
      if (normalized.startsWith('update learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{ state_version: 2, updated_at: new Date('2026-08-11T03:00:02.000Z') }],
        };
      }
      if (normalized.startsWith('update learner_requests')) return { rowCount: 1, rows: [] };
      if (normalized.startsWith('update runtime_state')) {
        persistedRuntimeState = JSON.parse(parameters[0]);
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`未预期的 SQL：${normalized}`);
    },
    release() {},
  };
  const pool = {
    async query(sql) {
      if (compactSql(sql).startsWith('insert into learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{ state_version: 1, updated_at: new Date('2026-08-11T03:00:01.000Z') }],
        };
      }
      throw new Error(`未预期的 direct SQL：${compactSql(sql)}`);
    },
    async connect() { return client; },
  };
  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues({ id: 'ses_guarded' }));
  session.consumedTeacherCommandIds.push('cmd-atomic');

  await store.saveWithRequestResult(session, {
    requestId: 'req-teacher-atomic',
    leaseToken: 'd8e6ff2f-dfbe-49a5-8404-44ae963abc8b',
    result: { events: [] },
    runtimeGuard: {
      required: true,
      operation: 'learner_turn',
      teacherCommandId: 'cmd-atomic',
      teacherCommandAction: 'set_scaffold',
    },
  });

  assert.deepEqual(calls, [
    'begin',
    'select payload from runtime_state where id = $1 for update',
    calls[2],
    calls[3],
    'update runtime_state set payload = $1::jsonb, updated_at = now() where id = $2',
    'commit',
  ]);
  assert.match(calls[2], /^update learner_sessions/i);
  assert.match(calls[3], /^update learner_requests/i);
  assert.equal(persistedRuntimeState.receipts[0].status, 'delivered');
  assert.ok(persistedRuntimeState.receipts[0].deliveredAt);
  assert.deepEqual(persistedRuntimeState.events.at(-1).data, {
    commandId: 'cmd-atomic',
    participantId: 'participant-001',
    status: 'delivered',
  });
});

test('原子请求完成失败时回滚 session 版本，随后仍可按旧版本重试', async () => {
  const transactionalCalls = [];
  let retryExpectedVersion = null;
  const client = {
    async query(sql) {
      const normalized = compactSql(sql);
      transactionalCalls.push(normalized);
      if (normalized === 'begin' || normalized === 'rollback') {
        return { rowCount: null, rows: [] };
      }
      if (normalized.startsWith('update learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{
            state_version: 2,
            updated_at: new Date('2026-07-31T05:00:02.000Z'),
          }],
        };
      }
      if (normalized.startsWith('update learner_requests')) {
        return { rowCount: 0, rows: [] };
      }
      throw new Error(`未预期的 SQL：${normalized}`);
    },
    release() {},
  };
  const pool = {
    async query(sql, parameters) {
      const normalized = compactSql(sql);
      if (normalized.startsWith('insert into learner_sessions')) {
        return {
          rowCount: 1,
          rows: [{
            state_version: 1,
            updated_at: new Date('2026-07-31T05:00:01.000Z'),
          }],
        };
      }
      if (normalized.startsWith('update learner_sessions')) {
        retryExpectedVersion = parameters[6];
        return {
          rowCount: 1,
          rows: [{
            state_version: 2,
            updated_at: new Date('2026-07-31T05:00:03.000Z'),
          }],
        };
      }
      throw new Error(`未预期的 direct SQL：${normalized}`);
    },
    async connect() {
      return client;
    },
  };
  const store = createPostgresSessionStore({ pool });
  const session = await store.create(validSessionValues({ id: 'ses_atomic_rollback' }));
  const previousUpdatedAt = session.updatedAt;

  await assert.rejects(
    store.saveWithRequestResult(session, {
      requestId: 'req_expired',
      leaseToken: '035954df-df4a-4b87-8260-7686624618ed',
      result: { events: [] },
    }),
    (error) => error.code === 'LEARNER_REQUEST_LEASE_CONFLICT',
  );

  assert.equal(transactionalCalls.length, 4);
  assert.equal(transactionalCalls[0], 'begin');
  assert.match(transactionalCalls[1], /^update learner_sessions/i);
  assert.match(transactionalCalls[2], /^update learner_requests/i);
  assert.equal(transactionalCalls[3], 'rollback');
  assert.equal(session.updatedAt, previousUpdatedAt);
  await store.save(session);
  assert.equal(retryExpectedVersion, 1);
});

test('数据库 readiness 覆盖请求租约结构、唯一索引和兼容 seed', async () => {
  const calls = [];
  const ready = await probeDatabase({
    async query(sql) {
      const normalized = compactSql(sql);
      calls.push(normalized);
      if (normalized.includes("to_regclass('public.learner_sessions')")) {
        return {
          rows: [{
            learner_sessions_exists: true,
            learner_requests_exists: true,
            course_runs_exists: true,
            runtime_state_exists: true,
          }],
        };
      }
      return {
        rows: [{
          session_schema_ready: true,
          request_schema_ready: true,
          request_lease_index_ready: true,
          runtime_state_seed_ready: true,
        }],
      };
    },
  });

  assert.equal(calls.length, 2);
  assert.match(calls[1], /learner_requests_one_processing_per_session_uidx/i);
  assert.match(calls[1], /where id = 'course-runs'/i);
  assert.equal(ready.healthy, true);
  assert.equal(ready.schemaReady, true);
});

test('数据库 readiness 缺少 learner_requests 时直接判定未就绪', async () => {
  let calls = 0;
  const readiness = await probeDatabase({
    async query() {
      calls += 1;
      return {
        rows: [{
          learner_sessions_exists: true,
          learner_requests_exists: false,
          course_runs_exists: true,
          runtime_state_exists: true,
        }],
      };
    },
  });

  assert.equal(calls, 1);
  assert.equal(readiness.healthy, false);
  assert.equal(readiness.schemaReady, false);
});

test('course-run transaction 依次 BEGIN、行锁、UPDATE、COMMIT，且不执行 DDL', async () => {
  const calls = [];
  let released = false;
  const initialState = {
    schemaVersion: 1,
    sequence: 4,
    runs: [],
    alerts: [],
    commands: [],
    receipts: [],
    interventions: [],
    auditEvents: [],
    events: [],
  };
  const client = {
    async query(sql, parameters) {
      const normalized = compactSql(sql);
      calls.push({ sql: normalized, parameters });
      if (normalized === 'begin') return { rowCount: null, rows: [] };
      if (normalized.startsWith('select payload from runtime_state')) {
        return { rowCount: 1, rows: [{ payload: initialState }] };
      }
      if (normalized.startsWith('update runtime_state')) {
        return { rowCount: 1, rows: [] };
      }
      if (normalized === 'commit') return { rowCount: null, rows: [] };
      throw new Error(`未预期的 SQL：${normalized}`);
    },
    release() {
      released = true;
    },
  };
  const pool = {
    async query() {
      throw new Error('transaction 不应使用 pool.query。');
    },
    async connect() {
      return client;
    },
  };

  const store = createPostgresCourseRunStore({ pool });
  const result = await store.transaction((state) => {
    state.sequence += 1;
    state.events.push({ id: 'event-005' });
    return 'transaction-result';
  });

  assert.equal(result, 'transaction-result');
  assert.deepEqual(calls.map(({ sql }) => sql), [
    'begin',
    'select payload from runtime_state where id = $1 for update',
    'update runtime_state set payload = $1::jsonb, updated_at = now() where id = $2',
    'commit',
  ]);
  assert.deepEqual(calls[1].parameters, ['course-runs']);
  assert.deepEqual(JSON.parse(calls[2].parameters[0]), {
    ...initialState,
    sequence: 5,
    events: [{ id: 'event-005' }],
  });
  assert.deepEqual(calls[2].parameters.slice(1), ['course-runs']);
  assert.equal(released, true);
  assert.ok(calls.every(({ sql }) => !/\b(?:create|alter|drop)\b/i.test(sql)));
});

test('course-run 缺少 seed 行时报告 schema error、回滚并释放连接', async () => {
  const calls = [];
  let released = false;
  const client = {
    async query(sql) {
      const normalized = compactSql(sql);
      calls.push(normalized);
      if (normalized.startsWith('select payload from runtime_state')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: null, rows: [] };
    },
    release() {
      released = true;
    },
  };
  const pool = {
    async query(sql) {
      calls.push(compactSql(sql));
      return { rowCount: 0, rows: [] };
    },
    async connect() {
      return client;
    },
  };
  const store = createPostgresCourseRunStore({ pool });

  await assert.rejects(
    store.read(),
    (error) => error.code === 'DATABASE_SCHEMA_NOT_READY' && error.statusCode === 503,
  );
  await assert.rejects(
    store.transaction(() => undefined),
    (error) => error.code === 'DATABASE_SCHEMA_NOT_READY' && error.statusCode === 503,
  );

  assert.deepEqual(calls, [
    'select payload from runtime_state where id = $1',
    'begin',
    'select payload from runtime_state where id = $1 for update',
    'rollback',
  ]);
  assert.equal(released, true);
  assert.ok(calls.every((sql) => !/\b(?:create|alter|drop)\b/i.test(sql)));
});
