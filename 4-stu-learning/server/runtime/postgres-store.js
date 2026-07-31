import {
  DatabaseSchemaError,
  LearnerRequestLeaseConflictError,
  SessionWriteConflictError,
} from '../database/errors.js';
import { createSessionRecord, normalizeSessionRecord } from '../services/session-factory.js';

const EMPTY_STATE = {
  schemaVersion: 1, sequence: 0, runs: [], alerts: [], commands: [], receipts: [],
  interventions: [], auditEvents: [], events: [],
};

const SESSION_STATE_VERSION = Symbol('sessionStateVersion');

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
      const value = await mutator(state);
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

  async function save(session) {
    return updateSession(pool, session);
  }

  async function saveWithRequestResult(session, {
    requestId,
    leaseToken,
    result,
  } = {}) {
    const previousVersion = session?.[SESSION_STATE_VERSION];
    const previousUpdatedAt = session?.updatedAt;
    const client = await pool.connect();
    try {
      await client.query('begin');
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

  return {
    create,
    get,
    save,
    saveWithRequestResult,
    kind: 'postgres',
  };
}
