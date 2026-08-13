import {
  CourseRunMutationConflictError,
  DatabaseSchemaError,
  LearnerRequestLeaseConflictError,
  SessionWriteConflictError,
} from '../database/errors.js';
import { createSessionRecord, normalizeSessionRecord } from '../services/session-factory.js';
import {
  claimParticipantRole,
  learnerRoleState,
  normalizeRunRoleClaims,
} from './role-claims.js';

const EMPTY_STATE = {
  schemaVersion: 1, sequence: 0, runs: [], alerts: [], commands: [], receipts: [],
  interventions: [], auditEvents: [], events: [],
};

const SESSION_STATE_VERSION = Symbol('sessionStateVersion');

function learnerRunState(run, participant = null) {
  return {
    status: run?.status || null,
    paused: Boolean(run?.paused),
    rallyActive: Boolean(run?.rallyActive),
    rolesReleased: Boolean(run?.rolesReleased),
    rolesLocked: Boolean(run?.rolesLocked),
    phaseId: run?.phaseId || null,
    phaseIndex: Number(run?.phaseIndex || 0),
    version: Number(run?.version || 0),
    ...(participant ? learnerRoleState(run, participant) : {}),
  };
}

function mutationDenied(code, message, run = null, participant = null) {
  throw new CourseRunMutationConflictError(code, message, {
    runState: run ? learnerRunState(run, participant) : null,
  });
}

/**
 * This check runs only after SELECT ... FOR UPDATE has acquired the shared
 * `runtime_state/course-runs` row. Teacher transitions use the same row lock,
 * so the learner write and pause/end/rally/session-switch have one serial order.
 */
function assertCourseRunAllowsSessionMutation(state, session, guard = {}) {
  if (!guard?.required || !session?.runId) return { run: null, participant: null };
  const run = state?.runs?.find((item) => item.id === session.runId);
  const normalizedLegacyRoles = Boolean(run && run.roleClaimMode !== 'student_claim');
  if (run) normalizeRunRoleClaims(run);
  const participant = run?.participants?.find((item) => item.id === session.participantId);
  if (
    !run
    || !participant
    || run.courseId !== session.courseId
    || participant.learnerSessionId !== session.id
  ) {
    mutationDenied(
      'COURSE_SESSION_INACTIVE',
      '这个学习会话已不是当前教师场次的活动会话。',
      run,
    );
  }
  const requestedRoleId = String(guard.requestedRoleId || session.roleId || '');
  const repeatsCurrentRole = Boolean(
    guard.roleAssignment
    && requestedRoleId
    && participant.roleId === requestedRoleId,
  );
  if (run.status !== 'active') {
    if (run.status === 'completed') {
      mutationDenied('COURSE_RUN_COMPLETED', '本次课程已结束，学习记录已转为只读。', run, participant);
    }
    mutationDenied('COURSE_RUN_NOT_ACTIVE', '课程尚未开始，请等待老师发出开始指令。', run, participant);
  }
  if (run.paused && !repeatsCurrentRole) {
    mutationDenied('COURSE_RUN_PAUSED', '课程已暂停，请留在安全位置等待老师恢复。', run, participant);
  }
  if (run.rallyActive && !repeatsCurrentRole) {
    mutationDenied('COURSE_RUN_RALLY_ACTIVE', '请先按老师要求前往集合点。', run, participant);
  }
  if (
    guard.roleAssignment
    && participant.roleId !== requestedRoleId
    && (run.rolesReleased !== true || run.rolesLocked === true)
  ) {
    mutationDenied('COURSE_ROLES_LOCKED', '老师还没有开放角色选择。', run, participant);
  }
  if (!guard.roleAssignment && session.roleId && participant.roleId !== session.roleId) {
    mutationDenied('COURSE_SESSION_INACTIVE', '该角色会话已不是当前活动会话。', run, participant);
  }
  return { run, participant, normalizedLegacyRoles };
}

function deliverTeacherCommand(state, { run, participant }, session, guard = {}) {
  const commandId = String(guard.teacherCommandId || '').trim();
  if (!commandId) return false;
  const command = state.commands?.find((item) => item.id === commandId && item.runId === run.id);
  const receipt = state.receipts?.find((item) => (
    item.commandId === commandId
    && item.participantId === participant.id
    && item.learnerSessionId === session.id
  ));
  if (
    !command
    || !receipt
    || receipt.status !== 'accepted'
    || !(session.consumedTeacherCommandIds || []).includes(commandId)
    || (guard.teacherCommandAction && command.action !== guard.teacherCommandAction)
  ) {
    mutationDenied(
      'TEACHER_COMMAND_UNAUTHORIZED',
      '这条教师指令不属于当前会话、已经使用，或与操作类型不匹配。',
      run,
    );
  }
  const deliveredAt = new Date().toISOString();
  receipt.status = 'delivered';
  receipt.deliveredAt ||= deliveredAt;
  state.sequence = Number(state.sequence || 0) + 1;
  state.events ||= [];
  state.events.push({
    sequence: state.sequence,
    runId: run.id,
    type: 'teacher.command.receipt',
    data: { commandId, participantId: participant.id, status: 'delivered' },
    createdAt: deliveredAt,
  });
  if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
  return true;
}

function requirePool(pool) {
  if (!pool?.query || !pool?.connect) {
    throw new Error('PostgreSQL store 需要共享数据库 pool。');
  }
  return pool;
}

function attachSessionVersion(session, version) {
  Object.defineProperty(session, SESSION_STATE_VERSION, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: Number(version),
  });
  return session;
}

export function createPostgresCourseRunStore({ pool: providedPool }) {
  const pool = requirePool(providedPool);
  async function read() {
    const result = await pool.query('select payload from runtime_state where id = $1', ['course-runs']);
    if (!result.rows[0]) throw new DatabaseSchemaError('数据库缺少 course-runs 兼容状态行。');
    return structuredClone(result.rows[0].payload || EMPTY_STATE);
  }

  async function transaction(mutator) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query('select payload from runtime_state where id = $1 for update', ['course-runs']);
      if (!result.rows[0]) throw new DatabaseSchemaError('数据库缺少 course-runs 兼容状态行。');
      const state = structuredClone(result.rows[0].payload || EMPTY_STATE);
      const value = await mutator(state, {
        kind: 'postgres',
        async assertLearnerSessionExists({ sessionId, runId, participantId }) {
          const existing = await client.query(`
            select 1
            from learner_sessions
            where id = $1
              and run_id = $2
              and participant_id = $3
          `, [sessionId, runId, participantId]);
          if (existing.rowCount !== 1) {
            throw new CourseRunMutationConflictError(
              'COURSE_SESSION_RESET',
              '该学习会话已被老师清零，请刷新后重新进入。',
            );
          }
          return true;
        },
        async deleteLearnerSessionsForParticipant({ runId, participantId }) {
          // 规范化回执表对 learner_sessions 是 ON DELETE RESTRICT。
          // 历史回执仍保留，只断开已重置会话的可逆向引用。
          await client.query(`
            update command_deliveries
            set learner_session_id = null,
                updated_at = now()
            where run_id = $1
              and participant_id = $2
              and learner_session_id is not null
          `, [runId, participantId]);
          const deleted = await client.query(`
            delete from learner_sessions
            where run_id = $1
              and participant_id = $2
            returning id
          `, [runId, participantId]);
          return (deleted.rows || []).map((row) => String(row.id)).filter(Boolean);
        },
      });
      const update = await client.query(
        'update runtime_state set payload = $1::jsonb, updated_at = now() where id = $2',
        [JSON.stringify(state), 'course-runs'],
      );
      if (update.rowCount !== 1) throw new DatabaseSchemaError('course-runs 兼容状态行写入失败。');
      await client.query('commit');
      return value;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  return { read, transaction, kind: 'postgres-legacy-runtime-state' };
}

export function createPostgresSessionStore({ pool: providedPool }) {
  const pool = requirePool(providedPool);

  async function lockCourseRunState(client, session, runtimeGuard) {
    if (!runtimeGuard?.required || !session?.runId) {
      return { state: null, changed: false };
    }
    const result = await client.query(
      'select payload from runtime_state where id = $1 for update',
      ['course-runs'],
    );
    if (!result.rows[0]) throw new DatabaseSchemaError('数据库缺少 course-runs 兼容状态行。');
    const state = structuredClone(result.rows[0].payload || EMPTY_STATE);
    const located = assertCourseRunAllowsSessionMutation(state, session, runtimeGuard);
    let changed = located.normalizedLegacyRoles;
    if (runtimeGuard.roleAssignment) {
      const previousRoleId = located.participant.roleId || '';
      try {
        claimParticipantRole({
          run: located.run,
          participant: located.participant,
          sessionId: session.id,
          roleId: runtimeGuard.requestedRoleId || session.roleId,
          source: 'student',
        });
        changed = true;
        if (previousRoleId !== located.participant.roleId) {
          state.sequence = Number(state.sequence || 0) + 1;
          state.events ||= [];
          state.events.push({
            sequence: state.sequence,
            runId: located.run.id,
            type: 'participant.role_claimed',
            data: {
              participantId: located.participant.id,
              previousRoleId,
              roleId: located.participant.roleId,
            },
            createdAt: new Date().toISOString(),
          });
          if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
        }
      } catch (error) {
        throw new CourseRunMutationConflictError(
          error.code || 'COURSE_ROLE_CLAIM_FAILED',
          error.message || '角色领取失败。',
          { runState: learnerRunState(located.run, located.participant), ...(error.details || {}) },
        );
      }
    }
    changed = deliverTeacherCommand(state, located, session, runtimeGuard) || changed;
    return { state, changed };
  }

  async function persistCourseRunState(client, locked) {
    if (!locked?.changed) return;
    const update = await client.query(
      'update runtime_state set payload = $1::jsonb, updated_at = now() where id = $2',
      [JSON.stringify(locked.state), 'course-runs'],
    );
    if (update.rowCount !== 1) throw new DatabaseSchemaError('course-runs 兼容状态行写入失败。');
  }

  async function updateSession(queryable, session) {
    const expectedVersion = session?.[SESSION_STATE_VERSION];
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new SessionWriteConflictError(session?.id);
    }
    session.updatedAt = new Date().toISOString();
    const result = await queryable.query(`
      update learner_sessions
      set payload = $2::jsonb,
          state_version = state_version + 1,
          run_id = $3,
          participant_id = $4,
          course_id = $5,
          role_id = $6,
          updated_at = now()
      where id = $1
        and state_version = $7
      returning state_version, updated_at
    `, [
      session.id,
      JSON.stringify(session),
      session.runId || null,
      session.participantId || null,
      session.courseId,
      session.roleId,
      expectedVersion,
    ]);
    if (result.rowCount !== 1) throw new SessionWriteConflictError(session.id);
    const row = result.rows[0];
    session.updatedAt = row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at || session.updatedAt);
    attachSessionVersion(session, row.state_version);
    return session;
  }

  async function save(session, { runtimeGuard } = {}) {
    if (!runtimeGuard?.required || !session?.runId) return updateSession(pool, session);
    const previousVersion = session?.[SESSION_STATE_VERSION];
    const previousUpdatedAt = session?.updatedAt;
    const client = await pool.connect();
    try {
      await client.query('begin');
      const locked = await lockCourseRunState(client, session, runtimeGuard);
      await updateSession(client, session);
      await persistCourseRunState(client, locked);
      await client.query('commit');
      return session;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      session.updatedAt = previousUpdatedAt;
      attachSessionVersion(session, previousVersion);
      throw error;
    } finally {
      client.release();
    }
  }

  async function saveWithRequestResult(session, {
    requestId,
    leaseToken,
    result,
    runtimeGuard,
  } = {}) {
    const previousVersion = session?.[SESSION_STATE_VERSION];
    const previousUpdatedAt = session?.updatedAt;
    const client = await pool.connect();
    try {
      await client.query('begin');
      const locked = await lockCourseRunState(client, session, runtimeGuard);
      await updateSession(client, session);
      const completed = await client.query(`
        update learner_requests
        set status = 'completed',
            result = $4::jsonb,
            error = null,
            lease_token = null,
            lease_owner = null,
            lease_expires_at = null,
            completed_at = now(),
            updated_at = now()
        where session_id = $1
          and request_id = $2
          and status = 'processing'
          and lease_token = $3::uuid
          and lease_expires_at > now()
      `, [
        session.id,
        requestId,
        leaseToken,
        JSON.stringify(result ?? null),
      ]);
      if (completed.rowCount !== 1) {
        throw new LearnerRequestLeaseConflictError(requestId);
      }
      await persistCourseRunState(client, locked);
      await client.query('commit');
      return session;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      session.updatedAt = previousUpdatedAt;
      attachSessionVersion(session, previousVersion);
      throw error;
    } finally {
      client.release();
    }
  }

  async function create(values) {
    const session = createSessionRecord(values);
    const result = await pool.query(`
      insert into learner_sessions (
        id, payload, state_version, run_id, participant_id, course_id, role_id, created_at, updated_at
      )
      values ($1, $2::jsonb, 1, $3, $4, $5, $6, $7, now())
      returning state_version, updated_at
    `, [
      session.id,
      JSON.stringify(session),
      session.runId,
      session.participantId,
      session.courseId,
      session.roleId,
      session.createdAt,
    ]);
    const row = result.rows[0];
    session.updatedAt = row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at || new Date().toISOString());
    return attachSessionVersion(session, row.state_version);
  }

  async function get(id) {
    const result = await pool.query(
      'select payload, state_version, updated_at from learner_sessions where id = $1',
      [id],
    );
    if (!result.rows[0]) return null;
    const session = normalizeSessionRecord(result.rows[0].payload);
    if (!session) throw new DatabaseSchemaError('数据库中的会话结构无效。');
    const updatedAt = result.rows[0].updated_at;
    if (updatedAt) {
      session.updatedAt = updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt);
    }
    return attachSessionVersion(session, result.rows[0].state_version);
  }

  async function remove(id) {
    const result = await pool.query('delete from learner_sessions where id = $1', [id]);
    return result.rowCount === 1;
  }

  return {
    create,
    get,
    save,
    saveWithRequestResult,
    remove,
    kind: 'postgres',
  };
}
