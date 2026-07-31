import assert from 'node:assert/strict';
import test from 'node:test';
import { createLearnerRequestStore } from '../server/database/learner-request-store.js';

function compactSql(sql) {
  return String(sql).replaceAll(/\s+/g, ' ').trim();
}

function result(rows = [], rowCount = rows.length) {
  return { rows, rowCount };
}

function createScriptedPool(script, directQuery) {
  const remaining = [...script];
  const calls = [];
  let released = false;

  const client = {
    async query(sql, parameters) {
      assert.equal(typeof sql, 'string', 'SQL 必须作为字符串提交，不能使用命名 prepared statement');
      const normalized = compactSql(sql);
      calls.push({ sql: normalized, parameters });
      const next = remaining.shift();
      assert.ok(next, `未预期的 SQL：${normalized}`);
      assert.match(normalized, next.sql);
      if (next.parameters) next.parameters(parameters);
      if (next.error) throw next.error;
      return next.result ?? result([], null);
    },
    release() {
      released = true;
    },
  };

  return {
    calls,
    get released() {
      return released;
    },
    get remaining() {
      return remaining;
    },
    async connect() {
      return client;
    },
    async query(sql, parameters) {
      assert.equal(typeof sql, 'string', 'SQL 必须作为字符串提交，不能使用命名 prepared statement');
      if (!directQuery) throw new Error('此测试不应使用 pool.query。');
      return directQuery(compactSql(sql), parameters);
    },
  };
}

const claimInput = {
  sessionId: 'ses_lease_001',
  requestId: 'req_001',
  requestHash: 'sha256:answer-one',
};

function beginAndLock() {
  return [
    { sql: /^begin$/i },
    {
      sql: /^select id from learner_sessions where id = \$1 for update$/i,
      parameters(parameters) {
        assert.deepEqual(parameters, ['ses_lease_001']);
      },
      result: result([{ id: 'ses_lease_001' }]),
    },
  ];
}

function clearExpiredBlockers(rowCount = 0) {
  return {
    sql: /^update learner_requests set status = 'failed', lease_token = null, lease_owner = null,/i,
    parameters(parameters) {
      assert.deepEqual(parameters.slice(0, 2), ['ses_lease_001', 'req_001']);
      assert.deepEqual(JSON.parse(parameters[2]), { code: 'LEASE_EXPIRED' });
    },
    result: result([], rowCount),
  };
}

test('claim 获取新请求租约，并在返回前提交短事务', async () => {
  const expiresAt = new Date('2026-07-31T12:01:30.000Z');
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      result: result([]),
    },
    clearExpiredBlockers(),
    {
      sql: /^select request_id, lease_expires_at from learner_requests/i,
      result: result([]),
    },
    {
      sql: /^insert into learner_requests \(/i,
      parameters(parameters) {
        assert.deepEqual(parameters.slice(0, 3), [
          'ses_lease_001',
          'req_001',
          'sha256:answer-one',
        ]);
        assert.match(parameters[3], /^[0-9a-f-]{36}$/i);
        assert.equal(parameters[4], 90_000);
      },
      result: result([{ lease_expires_at: expiresAt, attempt_count: 1 }]),
    },
    { sql: /^commit$/i },
  ]);

  const claimed = await createLearnerRequestStore({ pool }).claim(claimInput);

  assert.equal(claimed.status, 'acquired');
  assert.equal(claimed.requestId, 'req_001');
  assert.match(claimed.leaseToken, /^[0-9a-f-]{36}$/i);
  assert.equal(claimed.leaseExpiresAt, '2026-07-31T12:01:30.000Z');
  assert.equal(claimed.attemptCount, 1);
  assert.equal(pool.released, true);
  assert.equal(pool.remaining.length, 0);
  assert.equal(pool.calls.at(-1).sql, 'commit');
});

test('同 session 的另一个 active processing 请求让 claim 返回 pending', async () => {
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      result: result([]),
    },
    clearExpiredBlockers(),
    {
      sql: /^select request_id, lease_expires_at from learner_requests/i,
      result: result([{
        request_id: 'req_in_flight',
        lease_expires_at: '2026-07-31T13:00:00.000Z',
      }]),
    },
    { sql: /^commit$/i },
  ]);

  const pending = await createLearnerRequestStore({ pool }).claim(claimInput);

  assert.deepEqual(pending, {
    status: 'pending',
    requestId: 'req_001',
    blockingRequestId: 'req_in_flight',
    leaseExpiresAt: '2026-07-31T13:00:00.000Z',
  });
  assert.equal(pool.released, true);
  assert.equal(pool.remaining.length, 0);
});

test('相同请求的 active lease 直接返回 pending', async () => {
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      result: result([{
        request_digest: 'sha256:answer-one',
        status: 'processing',
        lease_active: true,
        lease_expires_at: new Date('2026-07-31T13:10:00.000Z'),
        attempt_count: 1,
      }]),
    },
    { sql: /^commit$/i },
  ]);

  const pending = await createLearnerRequestStore({ pool }).claim(claimInput);

  assert.deepEqual(pending, {
    status: 'pending',
    requestId: 'req_001',
    leaseExpiresAt: '2026-07-31T13:10:00.000Z',
  });
  assert.equal(pool.remaining.length, 0);
});

test('completed 请求按 requestId 和摘要回放缓存结果', async () => {
  const cached = { answer: '回放内容', taskId: 'task-1' };
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      result: result([{
        request_digest: 'sha256:answer-one',
        status: 'completed',
        lease_active: false,
        result: cached,
        attempt_count: 1,
      }]),
    },
    { sql: /^commit$/i },
  ]);

  const replayed = await createLearnerRequestStore({ pool }).claim(claimInput);

  assert.deepEqual(replayed, {
    status: 'completed',
    requestId: 'req_001',
    result: cached,
  });
  assert.equal(pool.remaining.length, 0);
});

test('相同 requestId 携带不同摘要时返回 409 并回滚', async () => {
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      result: result([{
        request_digest: 'sha256:different',
        status: 'completed',
        lease_active: false,
        result: { answer: '旧内容' },
        attempt_count: 1,
      }]),
    },
    { sql: /^rollback$/i },
  ]);

  await assert.rejects(
    createLearnerRequestStore({ pool }).claim(claimInput),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'LEARNER_REQUEST_HASH_CONFLICT');
      return true;
    },
  );
  assert.equal(pool.released, true);
  assert.equal(pool.remaining.length, 0);
});

test('过期 processing 请求使用新 UUID 接管并增加 attempt_count', async () => {
  const expiresAt = new Date('2026-07-31T14:01:30.000Z');
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      result: result([{
        request_digest: 'sha256:answer-one',
        status: 'processing',
        lease_active: false,
        lease_expires_at: new Date('2026-07-31T13:59:00.000Z'),
        attempt_count: 1,
      }]),
    },
    clearExpiredBlockers(),
    {
      sql: /^select request_id, lease_expires_at from learner_requests/i,
      result: result([]),
    },
    {
      sql: /^update learner_requests set status = 'processing'/i,
      parameters(parameters) {
        assert.deepEqual(parameters.slice(0, 2), ['ses_lease_001', 'req_001']);
        assert.match(parameters[2], /^[0-9a-f-]{36}$/i);
        assert.equal(parameters[3], 90_000);
      },
      result: result([{ lease_expires_at: expiresAt, attempt_count: 2 }]),
    },
    { sql: /^commit$/i },
  ]);

  const takeover = await createLearnerRequestStore({ pool }).claim(claimInput);

  assert.equal(takeover.status, 'acquired');
  assert.match(takeover.leaseToken, /^[0-9a-f-]{36}$/i);
  assert.equal(takeover.attemptCount, 2);
  assert.equal(takeover.leaseExpiresAt, '2026-07-31T14:01:30.000Z');
  assert.equal(pool.remaining.length, 0);
});

test('新 requestId 会先清理同 session 的过期 processing blocker 再获取租约', async () => {
  const expiresAt = new Date('2026-07-31T14:11:30.000Z');
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      result: result([]),
    },
    clearExpiredBlockers(1),
    {
      sql: /^select request_id, lease_expires_at from learner_requests/i,
      result: result([]),
    },
    {
      sql: /^insert into learner_requests \(/i,
      result: result([{ lease_expires_at: expiresAt, attempt_count: 1 }]),
    },
    { sql: /^commit$/i },
  ]);

  const claimed = await createLearnerRequestStore({ pool }).claim(claimInput);

  assert.equal(claimed.status, 'acquired');
  assert.equal(claimed.requestId, 'req_001');
  assert.equal(claimed.attemptCount, 1);
  assert.equal(pool.remaining.length, 0);
  const cleanup = pool.calls[3];
  assert.match(cleanup.sql, /request_id <> \$2/i);
  assert.match(cleanup.sql, /lease_expires_at <= now\(\)/i);
  assert.doesNotMatch(cleanup.parameters[2], /postgresql|url|secret/i);
});

test('数据库异常会回滚、释放 client，并隐藏连接 URL', async () => {
  const pool = createScriptedPool([
    ...beginAndLock(),
    {
      sql: /^select request_digest, status, lease_expires_at, result, attempt_count,/i,
      error: new Error('connection failed: postgresql://admin:secret@example.invalid/study'),
    },
    { sql: /^rollback$/i },
  ]);

  await assert.rejects(
    createLearnerRequestStore({ pool }).claim(claimInput),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, 'LEARNER_REQUEST_STORE_UNAVAILABLE');
      assert.doesNotMatch(error.message, /postgresql|admin|secret|example\.invalid/i);
      return true;
    },
  );
  assert.equal(pool.released, true);
  assert.equal(pool.remaining.length, 0);
});

test('complete 与 fail 只更新持有对应 UUID lease 的请求', async () => {
  const completeToken = 'd8e6ff2f-dfbe-49a5-8404-44ae963abc8b';
  const failToken = '035954df-df4a-4b87-8260-7686624618ed';
  const directCalls = [];
  const pool = createScriptedPool([], async (sql, parameters) => {
    directCalls.push({ sql, parameters });
    if (sql.startsWith("update learner_requests set status = 'completed'")) {
      return result([{
        result: { answer: '完成' },
        completed_at: new Date('2026-07-31T15:00:00.000Z'),
      }]);
    }
    if (sql.startsWith("update learner_requests set status = 'failed'")) {
      const storedError = JSON.parse(parameters[3]);
      assert.deepEqual(storedError, {
        name: 'Error',
        code: null,
        message: '请求处理失败。',
      });
      assert.doesNotMatch(parameters[3], /postgresql|admin|secret|example\.invalid/i);
      return result([{ updated_at: new Date('2026-07-31T15:01:00.000Z') }]);
    }
    throw new Error(`未预期的 SQL：${sql}`);
  });
  const store = createLearnerRequestStore({ pool });

  const completed = await store.complete({
    sessionId: 'ses_lease_001',
    requestId: 'req_complete',
    leaseToken: completeToken,
    result: { answer: '完成' },
  });
  const failed = await store.fail({
    sessionId: 'ses_lease_001',
    requestId: 'req_fail',
    leaseToken: failToken,
    error: new Error('postgresql://admin:secret@example.invalid/study'),
  });

  assert.deepEqual(completed, {
    status: 'completed',
    requestId: 'req_complete',
    result: { answer: '完成' },
    completedAt: '2026-07-31T15:00:00.000Z',
  });
  assert.deepEqual(failed, {
    status: 'failed',
    requestId: 'req_fail',
    failedAt: '2026-07-31T15:01:00.000Z',
  });
  assert.equal(directCalls.length, 2);
  assert.match(directCalls[0].sql, /lease_expires_at > now\(\)/i);
  assert.deepEqual(directCalls[0].parameters.slice(0, 3), [
    'ses_lease_001',
    'req_complete',
    completeToken,
  ]);
  assert.deepEqual(directCalls[1].parameters.slice(0, 3), [
    'ses_lease_001',
    'req_fail',
    failToken,
  ]);
});
