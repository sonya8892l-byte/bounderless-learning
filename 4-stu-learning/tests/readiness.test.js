import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';
import { createAgentService } from '../server/agent/service.js';
import { compileCourse } from '../server/course/compiler.js';
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
  assert.equal(createSession.statusCode, 422);
  assert.equal(createSession.json().code, 'COURSE_RUN_REQUIRED');

  const demo = await app.inject({ method: 'POST', url: '/api/teacher/demo' });
  assert.equal(demo.statusCode, 404);
});

test('Vercel Preview 优先于误带的本地环境配置，关闭 demo 并强制正式场次', async (t) => {
  const app = await buildApp({
    env: env({
      APP_ENV: 'local',
      VERCEL_ENV: 'preview',
      ENABLE_DEMO: true,
      DATABASE_URL: undefined,
      S3_BUCKET: undefined,
      S3_ENDPOINT: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
      TEACHER_API_TOKEN: undefined,
    }),
    llm,
    serveStatic: false,
    realtimeMode: 'polling',
  });
  t.after(() => app.close());

  const standalone = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: 'lesson_gewu_001',
      roleId: 'dragon-counter',
      studentId: 'preview-student',
      groupId: 'preview-group',
    },
  });
  assert.equal(standalone.statusCode, 422);
  assert.equal(standalone.json().code, 'COURSE_RUN_REQUIRED');

  const demo = await app.inject({ method: 'POST', url: '/api/teacher/demo' });
  assert.equal(demo.statusCode, 404);

  const teacherRuns = await app.inject({ method: 'GET', url: '/api/teacher/runs' });
  assert.equal(teacherRuns.statusCode, 503);
  assert.match(teacherRuns.json().error, /认证尚未配置/);
});

test('DB completed lease 只重放兼容 envelope，存量结果仅恢复当前权威状态', async (t) => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const sessions = new Map();
  const replaySessionStore = {
    async create(values) {
      const session = createSessionRecord({ ...values, id: 'ses_request_lease' });
      sessions.set(session.id, structuredClone(session));
      return session;
    },
    async get(id) {
      const session = sessions.get(id);
      return session ? structuredClone(session) : null;
    },
    async save(session) {
      sessions.set(session.id, structuredClone(session));
      return session;
    },
  };
  const seedAgent = createAgentService({
    llm,
    store: replaySessionStore,
    getCourse: async () => course,
  });
  const { session } = await seedAgent.createSession({
    courseId: course.id,
    roleId: 'dragon-counter',
    studentId: 'request-lease-student',
    groupId: 'request-lease-group',
  });
  const turnInput = { type: 'lifecycle_event', event: 'role_assigned' };
  const seeded = await seedAgent.runTurn({
    sessionId: session.id,
    requestId: 'request-lease-test',
    input: turnInput,
  });
  const claims = [
    {
      status: 'pending',
      leaseExpiresAt: '2026-07-31T12:00:00.000Z',
    },
    {
      status: 'completed',
      result: seeded.replayEnvelope,
    },
    {
      status: 'completed',
      result: {
        events: [{ type: 'assistant.completed', data: { text: '存量未验证文本' } }],
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
    sessionStore: replaySessionStore,
    courseRunStore,
    evidenceStore,
    learnerRequestStore,
    getCourse: async () => course,
    serveStatic: false,
    realtimeMode: 'polling',
  });
  t.after(() => app.close());
  const payload = {
    sessionId: session.id,
    requestId: 'request-lease-test',
    input: turnInput,
  };

  const pending = await app.inject({ method: 'POST', url: '/api/agent/turn', payload });
  assert.equal(pending.statusCode, 409);
  assert.equal(pending.json().code, 'SESSION_REQUEST_IN_PROGRESS');

  const replay = await app.inject({ method: 'POST', url: '/api/agent/turn', payload });
  assert.equal(replay.statusCode, 200);
  assert.match(replay.headers['content-type'], /^text\/event-stream\b/);
  assert.match(replay.body, /event: assistant\.completed/);
  assert.match(replay.body, /欢迎你/);

  const legacy = await app.inject({ method: 'POST', url: '/api/agent/turn', payload });
  assert.equal(legacy.statusCode, 200);
  assert.doesNotMatch(legacy.body, /存量未验证文本/);
  assert.doesNotMatch(legacy.body, /event: assistant\.completed/);
  assert.match(legacy.body, /event: state\.updated/);
  assert.match(legacy.body, /authoritative_recovery/);
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
  assert.equal(atomicWrite.request.result.kind, 'learner_turn_replay');
  assert.equal(atomicWrite.request.result.schemaVersion, 1);
  assert.match(atomicWrite.request.result.requestDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(atomicWrite.request.result.trace.schemaVersion, 3);
  assert.equal(atomicWrite.request.result.events.at(-1).type, 'state.updated');
  assert.deepEqual(atomicWrite.request.runtimeGuard, {
    required: true,
    operation: 'learner_turn',
    roleAssignment: true,
    requestedRoleId: '',
    teacherCommandId: '',
    teacherCommandAction: '',
  });
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

// D6 的第一段是"轻量"模型。配了 OPENAI_UNDERSTAND_MODEL 却仍打主模型，
// 就等于每个自由文字回合白付一次主模型的钱，而且从外部看不出来——所以在这里锁住。
test('配置 OPENAI_UNDERSTAND_MODEL 后，语义理解打小模型而生成打主模型', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const models = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    models.push(body.model);
    // 理解层要 JSON；生成层这里给纯文本即可。
    const content = body.response_format?.type === 'json_object'
      ? JSON.stringify({
        intent: 'chat_offtopic',
        emotion: 'neutral',
        answersPendingQuestion: false,
        pendingAnswer: 'unknown',
        want: '',
        confidence: 0.9,
      })
      : '我在听呢。';
    return new Response(JSON.stringify({
      choices: [{ message: { content, tool_calls: [] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const sessions = new Map();
  const app = await buildApp({
    env: env({
      APP_ENV: 'test',
      OPENAI_WIRE_API: 'chat_completions',
      OPENAI_MODEL: 'main-model',
      OPENAI_UNDERSTAND_MODEL: 'small-model',
      AI_UNDERSTAND_TIMEOUT_MS: 8_000,
      DATABASE_URL: undefined,
      S3_BUCKET: undefined,
      S3_ENDPOINT: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
    }),
    // 不传 llm：这条用例要验的正是 buildApp 自己建的那两个客户端。
    sessionStore: {
      async create(values) {
        const session = createSessionRecord(values);
        sessions.set(session.id, session);
        return session;
      },
      async get(id) { return sessions.get(id) || null; },
      async save(session) { sessions.set(session.id, session); return session; },
    },
    courseRunStore: {
      ...courseRunStore,
      async transaction(mutator) { return mutator(await courseRunStore.read()); },
    },
    evidenceStore,
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
      studentId: 'understand-model-student',
      groupId: 'understand-model-group',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const sessionId = created.json().id;

  await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'understand-model-role',
      input: { type: 'lifecycle_event', event: 'role_assigned' },
    },
  });
  models.length = 0;

  const response = await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'understand-model-turn',
      input: { type: 'user_text', text: '你们那儿今天下雨了吗' },
    },
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal(models[0], 'small-model', '语义理解必须走小模型');
  assert.ok(models.includes('main-model'), '回应生成仍走主模型');
});
