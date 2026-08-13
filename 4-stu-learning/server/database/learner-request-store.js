import crypto from 'node:crypto';
import { TURN_TRACE_SCHEMA_VERSION } from '../agent/turn-trace.js';

const EXPIRED_LEASE_ERROR = JSON.stringify({ code: 'LEASE_EXPIRED' });

class LearnerRequestStoreError extends Error {
  constructor(message, { code, statusCode }) {
    super(message);
    this.name = 'LearnerRequestStoreError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class LearnerRequestInputError extends TypeError {
  constructor(message) {
    super(message);
    this.name = 'LearnerRequestInputError';
  }
}

function httpError(statusCode, code, message) {
  return new LearnerRequestStoreError(message, { code, statusCode });
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new LearnerRequestInputError(`${field} 必须是非空字符串。`);
  }
  return value;
}

function requireLeaseToken(value) {
  const leaseToken = requireText(value, 'leaseToken');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(leaseToken)) {
    throw new LearnerRequestInputError('leaseToken 必须是 UUID。');
  }
  return leaseToken;
}

function toIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function safeFailure(error, trace = null) {
  const name = typeof error?.name === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(error.name)
    ? error.name
    : 'Error';
  const code = typeof error?.code === 'string' && /^[A-Z0-9_-]{1,64}$/.test(error.code)
    ? error.code
    : null;
  const failure = {
    name,
    code,
    message: '请求处理失败。',
  };
  // trace 由服务端的隐私最小化构建器生成；失败请求也保留同一
  // 份可审计投影，不记学生原话、Prompt 或完整回复。
  if (
    trace?.schemaVersion === TURN_TRACE_SCHEMA_VERSION
    && trace?.status === 'failed'
  ) failure.trace = trace;
  return failure;
}

function unavailableError() {
  return httpError(
    503,
    'LEARNER_REQUEST_STORE_UNAVAILABLE',
    '请求状态服务暂时不可用，请稍后重试。',
  );
}

function isStoreError(error) {
  return error instanceof LearnerRequestStoreError || error instanceof LearnerRequestInputError;
}

/**
 * PostgreSQL-backed request idempotency and single-session lease store.
 *
 * claim() holds a short transaction only while it serializes and updates request
 * metadata. The caller must invoke the model after claim() has returned.
 */
export function createLearnerRequestStore({ pool, leaseMs = 90_000 } = {}) {
  if (!pool?.query || !pool?.connect) {
    throw new Error('learner request store 需要共享数据库 pool。');
  }
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) {
    throw new LearnerRequestInputError('leaseMs 必须是正整数毫秒数。');
  }

  async function claim({ sessionId, requestId, requestHash } = {}) {
    requireText(sessionId, 'sessionId');
    requireText(requestId, 'requestId');
    requireText(requestHash, 'requestHash');

    let client;
    try {
      client = await pool.connect();
      await client.query('begin');

      const session = await client.query(
        'select id from learner_sessions where id = $1 for update',
        [sessionId],
      );
      if (session.rowCount !== 1) {
        throw httpError(
          404,
          'LEARNER_SESSION_NOT_FOUND',
          '学习会话不存在。',
        );
      }

      const existingResult = await client.query(`
        select
          request_digest,
          status,
          lease_expires_at,
          result,
          attempt_count,
          (status = 'processing' and lease_expires_at > now()) as lease_active
        from learner_requests
        where session_id = $1 and request_id = $2
      `, [sessionId, requestId]);
      const existing = existingResult.rows[0];

      if (existing && existing.request_digest !== requestHash) {
        throw httpError(
          409,
          'LEARNER_REQUEST_HASH_CONFLICT',
          'requestId 已用于不同的请求内容。',
        );
      }

      if (existing?.status === 'completed') {
        await client.query('commit');
        return {
          status: 'completed',
          requestId,
          result: existing.result,
        };
      }

      if (existing?.lease_active) {
        await client.query('commit');
        return {
          status: 'pending',
          requestId,
          leaseExpiresAt: toIsoString(existing.lease_expires_at),
        };
      }

      await client.query(`
        update learner_requests
        set status = 'failed',
            lease_token = null,
            lease_owner = null,
            lease_expires_at = null,
            error = $3::jsonb,
            completed_at = null,
            updated_at = now()
        where session_id = $1
          and request_id <> $2
          and status = 'processing'
          and (lease_expires_at is null or lease_expires_at <= now())
      `, [sessionId, requestId, EXPIRED_LEASE_ERROR]);

      const activeResult = await client.query(`
        select request_id, lease_expires_at
        from learner_requests
        where session_id = $1
          and request_id <> $2
          and status = 'processing'
          and lease_expires_at > now()
        order by lease_expires_at
        limit 1
      `, [sessionId, requestId]);
      const active = activeResult.rows[0];
      if (active) {
        await client.query('commit');
        return {
          status: 'pending',
          requestId,
          blockingRequestId: active.request_id,
          leaseExpiresAt: toIsoString(active.lease_expires_at),
        };
      }

      const leaseToken = crypto.randomUUID();
      let acquired;
      if (existing) {
        acquired = await client.query(`
          update learner_requests
          set status = 'processing',
              lease_token = $3::uuid,
              lease_expires_at = now() + ($4::bigint * interval '1 millisecond'),
              attempt_count = attempt_count + 1,
              result = null,
              error = null,
              completed_at = null,
              updated_at = now()
          where session_id = $1 and request_id = $2
          returning lease_expires_at, attempt_count
        `, [sessionId, requestId, leaseToken, leaseMs]);
      } else {
        acquired = await client.query(`
          insert into learner_requests (
            session_id,
            request_id,
            request_digest,
            status,
            lease_token,
            lease_expires_at,
            attempt_count
          )
          values (
            $1,
            $2,
            $3,
            'processing',
            $4::uuid,
            now() + ($5::bigint * interval '1 millisecond'),
            1
          )
          returning lease_expires_at, attempt_count
        `, [sessionId, requestId, requestHash, leaseToken, leaseMs]);
      }
      if (acquired.rowCount !== 1) throw unavailableError();

      await client.query('commit');
      return {
        status: 'acquired',
        requestId,
        leaseToken,
        leaseExpiresAt: toIsoString(acquired.rows[0]?.lease_expires_at),
        attemptCount: Number(acquired.rows[0]?.attempt_count || 1),
      };
    } catch (error) {
      if (client) await client.query('rollback').catch(() => undefined);
      if (isStoreError(error)) throw error;
      throw unavailableError();
    } finally {
      client?.release();
    }
  }

  async function complete({ sessionId, requestId, leaseToken, result } = {}) {
    requireText(sessionId, 'sessionId');
    requireText(requestId, 'requestId');
    requireLeaseToken(leaseToken);
    try {
      const completed = await pool.query(`
        update learner_requests
        set status = 'completed',
            result = $4::jsonb,
            error = null,
            lease_token = null,
            lease_expires_at = null,
            completed_at = now(),
            updated_at = now()
        where session_id = $1
          and request_id = $2
          and status = 'processing'
          and lease_token = $3::uuid
          and lease_expires_at > now()
        returning result, completed_at
      `, [sessionId, requestId, leaseToken, JSON.stringify(result ?? null)]);
      if (completed.rowCount !== 1) {
        throw httpError(
          409,
          'LEARNER_REQUEST_LEASE_CONFLICT',
          '请求租约已失效或已被接管。',
        );
      }
      return {
        status: 'completed',
        requestId,
        result: completed.rows[0]?.result ?? result ?? null,
        completedAt: toIsoString(completed.rows[0]?.completed_at),
      };
    } catch (error) {
      if (isStoreError(error)) throw error;
      throw unavailableError();
    }
  }

  async function fail({ sessionId, requestId, leaseToken, error, trace = null } = {}) {
    requireText(sessionId, 'sessionId');
    requireText(requestId, 'requestId');
    requireLeaseToken(leaseToken);
    try {
      const failure = safeFailure(error, trace);
      const failed = await pool.query(`
        update learner_requests
        set status = 'failed',
            result = null,
            error = $4::jsonb,
            lease_token = null,
            lease_expires_at = null,
            completed_at = null,
            updated_at = now()
        where session_id = $1
          and request_id = $2
          and status = 'processing'
          and lease_token = $3::uuid
        returning updated_at
      `, [sessionId, requestId, leaseToken, JSON.stringify(failure)]);
      if (failed.rowCount !== 1) {
        throw httpError(
          409,
          'LEARNER_REQUEST_LEASE_CONFLICT',
          '请求租约已失效或已被接管。',
        );
      }
      return {
        status: 'failed',
        requestId,
        failedAt: toIsoString(failed.rows[0]?.updated_at),
      };
    } catch (storeError) {
      if (isStoreError(storeError)) throw storeError;
      throw unavailableError();
    }
  }

  return {
    claim,
    complete,
    fail,
    kind: 'postgres-learner-request-lease',
  };
}
