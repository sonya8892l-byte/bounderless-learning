import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');
const readinessToken = 'readiness-test-token-1234567890';

function env(overrides = {}) {
  return {
    APP_ENV: 'production',
    AI_ENABLED: true,
    EVIDENCE_UPLOAD_MODE: 'direct',
    ENABLE_DEMO: false,
    READINESS_TOKEN: readinessToken,
    OPENAI_BASE_URL: 'https://example.invalid/v1',
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'test-model',
    OPENAI_WIRE_API: 'responses',
    AI_TOOL_MODE: 'auto',
    AI_VISION_MODE: 'disabled',
    AI_REASONING_EFFORT: 'minimal',
    AI_MAX_OUTPUT_TOKENS: 192,
    AI_TIMEOUT_MS: 18_000,
    VITE_AMAP_KEY: '',
    VITE_AMAP_SECURITY_CODE: '',
    VITE_AMAP_STYLE: 'amap://styles/normal',
    SESSION_STORE_DIR: '.runtime-must-not-be-used',
    S3_BUCKET: 'study-evidence',
    S3_ENDPOINT: 'https://example.invalid/storage/v1/s3',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    S3_REGION: 'auto',
    S3_PREFIX: 'evidence',
    LOG_LEVEL: 'silent',
    projectRoot,
    lessonsRoot,
    ...overrides,
  };
}

const llm = {
  capabilities: () => ({ streaming: true }),
  generate: async () => ({ text: '', toolCalls: [] }),
};

const sessionStore = {
  async create() { throw new Error('not used'); },
  async get() { return null; },
  async save(session) { return session; },
};

const courseRunStore = {
  async read() {
    return {
      schemaVersion: 1,
      sequence: 0,
      runs: [],
      alerts: [],
      commands: [],
      receipts: [],
      interventions: [],
      auditEvents: [],
      events: [],
    };
  },
  async transaction() { throw new Error('not used'); },
};

const evidenceStore = {
  kind: 'memory',
  async put() { throw new Error('not used'); },
  async get() { return null; },
  async findById() { return null; },
};

async function readinessApp({ databaseProbe }) {
  return buildApp({
    env: env({ DATABASE_URL: 'postgresql://runtime:secret@example.invalid:6543/postgres' }),
    llm,
    sessionStore,
    courseRunStore,
    evidenceStore,
    databasePool: { query() {}, connect() {}, end() {} },
    databaseProbe,
    serveStatic: false,
    realtimeMode: 'polling',
  });
}

test('readiness requires a token and reports only sanitized dependency status', async (t) => {
  const app = await readinessApp({
    databaseProbe: async () => ({ healthy: true, schemaReady: true, latencyMs: 7 }),
  });
  t.after(() => app.close());

  const unauthorized = await app.inject({ method: 'GET', url: '/api/readiness' });
  assert.equal(unauthorized.statusCode, 401);
  assert.match(unauthorized.headers['cache-control'], /no-store/);

  const response = await app.inject({
    method: 'GET',
    url: '/api/readiness',
    headers: { authorization: `Bearer ${readinessToken}` },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    dependencies: {
      ai: { required: true, configured: true, healthy: true },
      database: {
        required: true,
        configured: true,
        healthy: true,
        schemaReady: true,
        latencyMs: 7,
      },
      evidenceStorage: { required: true, configured: true, healthy: true },
    },
  });
  assert.doesNotMatch(response.body, /postgresql|runtime|secret|example\.invalid/);
});

test('database probe failures return 503 without leaking the database error', async (t) => {
  const app = await readinessApp({
    databaseProbe: async () => {
      throw new Error('password authentication failed for runtime@example.invalid');
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/readiness',
    headers: { 'x-readiness-token': readinessToken },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().dependencies.database.healthy, false);
  assert.doesNotMatch(response.body, /password|runtime|example\.invalid/);
});

test('production without DATABASE_URL refuses state writes and disables demo bootstrap', async (t) => {
  const app = await buildApp({
    env: env({
      DATABASE_URL: undefined,
      S3_BUCKET: undefined,
      S3_ENDPOINT: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
    }),
    llm,
    serveStatic: false,
    realtimeMode: 'polling',
  });
  t.after(() => app.close());

  const readiness = await app.inject({
    method: 'GET',
    url: '/api/readiness',
    headers: { authorization: `Bearer ${readinessToken}` },
  });
  assert.equal(readiness.statusCode, 503);
  assert.equal(readiness.json().dependencies.database.configured, false);

  const createSession = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: 'lesson_gewu_001',
      roleId: 'dragon-counter',
      studentId: 'production-test-student',
      groupId: 'production-test-group',
    },
  });
  assert.equal(createSession.statusCode, 503);
  assert.deepEqual(createSession.json(), { error: '服务暂时不可用，请稍后重试。' });

  const demo = await app.inject({ method: 'POST', url: '/api/teacher/demo' });
  assert.equal(demo.statusCode, 404);
});

test('agent route returns an in-flight conflict and replays a completed leased request', async (t) => {
  const claims = [
    {
      status: 'pending',
      leaseExpiresAt: '2026-07-31T12:00:00.000Z',
    },
    {
      status: 'completed',
      result: {
        events: [{
          type: 'assistant.completed',
          data: { id: 'msg_cached', text: '这是缓存结果。' },
        }],
      },
    },
  ];
  const learnerRequestStore = {
    async claim(input) {
      assert.equal(input.sessionId, 'ses_request_lease');
      assert.equal(input.requestId, 'request-lease-test');
      assert.match(input.requestHash, /^sha256:[a-f0-9]{64}$/);
      return claims.shift();
    },
  };
  const app = await buildApp({
    env: env({ APP_ENV: 'test', EVIDENCE_UPLOAD_MODE: 'proxy' }),
    llm,
    sessionStore,
    courseRunStore,
    evidenceStore,
    learnerRequestStore,
    serveStatic: false,
    realtimeMode: 'polling',
  });
  t.after(() => app.close());
  const payload = {
    sessionId: 'ses_request_lease',
    requestId: 'request-lease-test',
    input: { type: 'user_text', text: '请继续' },
  };

  const pending = await app.inject({ method: 'POST', url: '/api/agent/turn', payload });
  assert.equal(pending.statusCode, 409);
  assert.equal(pending.json().code, 'SESSION_REQUEST_IN_PROGRESS');

  const replay = await app.inject({ method: 'POST', url: '/api/agent/turn', payload });
  assert.equal(replay.statusCode, 200);
  assert.match(replay.headers['content-type'], /^text\/event-stream\b/);
  assert.match(replay.body, /event: assistant\.completed/);
  assert.match(replay.body, /这是缓存结果/);
});

test('PostgreSQL 风格 session store 通过原子入口同时保存状态和回放事件', async (t) => {
  const sessions = new Map();
  let atomicWrite = null;
  const atomicSessionStore = {
    async create(values) {
      const session = createSessionRecord(values);
      sessions.set(session.id, session);
      return session;
    },
    async get(id) {
      return sessions.get(id) || null;
    },
    async save(session) {
      sessions.set(session.id, session);
      return session;
    },
    async saveWithRequestResult(session, request) {
      atomicWrite = structuredClone({ session, request });
      sessions.set(session.id, session);
      return session;
    },
  };
  const learnerRequestStore = {
    async claim() {
      return {
        status: 'acquired',
        leaseToken: '7cf1cf74-5ae3-42a4-9666-8cf3d4a22122',
        leaseExpiresAt: '2026-07-31T12:00:00.000Z',
      };
    },
    async complete() {
      assert.fail('原子 session store 不应再调用独立 complete。');
    },
    async fail() {
      assert.fail('成功的原子提交不应标记失败。');
    },
  };
  const app = await buildApp({
    env: env({ APP_ENV: 'test', EVIDENCE_UPLOAD_MODE: 'proxy' }),
    llm,
    sessionStore: atomicSessionStore,
    courseRunStore: {
      ...courseRunStore,
      async transaction(mutator) {
        return mutator(await courseRunStore.read());
      },
    },
    evidenceStore,
    learnerRequestStore,
    serveStatic: false,
    realtimeMode: 'polling',
  });
  t.after(() => app.close());

  const created = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: 'lesson_gewu_001',
      roleId: 'dragon-counter',
      studentId: 'atomic-route-student',
      groupId: 'atomic-route-group',
    },
  });
  assert.equal(created.statusCode, 201, created.body);

  const response = await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: created.json().id,
      requestId: 'atomic-route-request',
      input: { type: 'lifecycle_event', event: 'role_assigned' },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /event: state\.updated/);
  assert.equal(atomicWrite.request.requestId, 'atomic-route-request');
  assert.equal(
    atomicWrite.request.leaseToken,
    '7cf1cf74-5ae3-42a4-9666-8cf3d4a22122',
  );
  assert.ok(
    atomicWrite.request.result.events.some((event) => event.type === 'state.updated'),
  );
});

test('客户端在 claim 期间断开时会释放取得的 lease，且不调用模型', async (t) => {
  let releaseClaim;
  let markClaimStarted;
  let markLeaseFailed;
  let modelCalls = 0;
  const claimStarted = new Promise((resolve) => { markClaimStarted = resolve; });
  const claimReleased = new Promise((resolve) => { releaseClaim = resolve; });
  const leaseFailed = new Promise((resolve) => { markLeaseFailed = resolve; });
  const learnerRequestStore = {
    async claim() {
      markClaimStarted();
      await claimReleased;
      return {
        status: 'acquired',
        leaseToken: '7cf1cf74-5ae3-42a4-9666-8cf3d4a22122',
        leaseExpiresAt: '2026-07-31T12:00:00.000Z',
      };
    },
    async complete() {
      assert.fail('断开的请求不应完成 lease。');
    },
    async fail(input) {
      markLeaseFailed(input);
      return { status: 'failed' };
    },
  };
  const trackingLlm = {
    capabilities: () => ({ streaming: true }),
    async generate() {
      modelCalls += 1;
      return { text: '不应生成', toolCalls: [] };
    },
  };
  const app = await buildApp({
    env: env({ APP_ENV: 'test', EVIDENCE_UPLOAD_MODE: 'proxy' }),
    llm: trackingLlm,
    sessionStore,
    courseRunStore,
    evidenceStore,
    learnerRequestStore,
    serveStatic: false,
    realtimeMode: 'polling',
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(() => app.close());
  const address = app.server.address();
  assert.equal(typeof address, 'object');
  const serverSocketClosed = new Promise((resolve) => {
    app.server.once('connection', (socket) => socket.once('close', resolve));
  });

  const body = Buffer.from(JSON.stringify({
    sessionId: 'ses_disconnect_during_claim',
    requestId: 'request-disconnect-during-claim',
    input: { type: 'user_text', text: '这条请求会在 claim 时断开' },
  }));
  const outgoing = http.request({
    hostname: '127.0.0.1',
    port: address.port,
    path: '/api/agent/turn',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': body.length,
    },
  });
  outgoing.on('error', () => undefined);
  outgoing.end(body);

  await claimStarted;
  const outgoingClosed = new Promise((resolve) => outgoing.once('close', resolve));
  outgoing.destroy();
  await Promise.all([outgoingClosed, serverSocketClosed]);
  releaseClaim();
  const failed = await Promise.race([
    leaseFailed,
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('等待断连 lease 清理超时。')),
      1_000,
    )),
  ]);

  assert.equal(failed.sessionId, 'ses_disconnect_during_claim');
  assert.equal(failed.requestId, 'request-disconnect-during-claim');
  assert.equal(failed.error.name, 'AbortError');
  assert.equal(modelCalls, 0);
});
