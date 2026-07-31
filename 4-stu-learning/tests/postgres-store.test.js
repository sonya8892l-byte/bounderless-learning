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
