import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServerlessHandler } from '../../server/vercel/serverless-handler.mjs';
import { buildApp } from '../server/app.js';
import { LLMTimeoutError } from '../server/services/llm.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

function createMemorySessionStore() {
  const sessions = new Map();

  async function save(session) {
    session.updatedAt = new Date().toISOString();
    sessions.set(session.id, structuredClone(session));
    return session;
  }

  return {
    async create(values) {
      const phaseId = values.phaseId || 'phase-2';
      const session = {
        schemaVersion: 2,
        id: `ses_${crypto.randomUUID().replaceAll('-', '')}`,
        courseId: values.courseId,
        studentId: values.studentId,
        groupId: values.groupId,
        runId: values.runId || null,
        participantId: values.participantId || null,
        roleId: values.roleId,
        grade: values.grade || '初中',
        phaseId,
        phaseNumber: Number.parseInt(phaseId.match(/\d+/)?.[0], 10) || 2,
        currentTaskIndex: 0,
        scaffoldLevel: 0,
        completedTaskIds: [],
        events: [],
        messages: [],
        pendingTools: {},
        handledRequestIds: [],
        timeBalance: Number(values.timeBalance || 0),
        timeEarned: 0,
        completedBankTaskIds: [],
        gifts: [],
        taskState: {},
        learningState: {
          coursePhaseId: phaseId,
          roleId: values.roleId,
          roleStageId: '',
          stepId: '',
          stepStatus: 'active',
          completedStepIds: [],
          completedRoleStageIds: [],
          activeToolCallId: null,
          evidenceIds: [],
          stageValidation: 'pending',
          teacherLock: null,
        },
        locationState: null,
        onboardingState: {
          arrivedConfirmed: false,
          readyConfirmed: false,
          completed: false,
        },
        conversationState: {
          lastIntent: '',
          lastIntentAt: null,
          studentSignal: 'neutral',
          lastNudgeAt: null,
          nudgeCount: 0,
        },
        dialogueState: {
          lifecycle: 'ORIENT_ROLE',
          pendingQuestion: null,
          interruptedQuestion: null,
          confirmedSlots: { arrival: false, readiness: false },
          lastDialogueMove: '',
          lastAssistantText: '',
          recentAssistantFingerprints: [],
          consecutiveMisunderstandings: 0,
          repairCount: 0,
          lastRepairAt: null,
        },
        learnerState: {
          grade: values.grade || '初中',
          engagement: 'unknown',
          emotion: 'neutral',
          preferredInput: 'unknown',
          scaffoldLevel: 0,
          consecutiveDifficulties: 0,
        },
        environmentState: {
          pageVisible: true,
          activeTab: 'task',
          hasDraft: false,
          phaseRemainingSeconds: null,
          teacherCommand: null,
          groupStatus: null,
          observedAt: null,
        },
        createdAt: new Date().toISOString(),
      };
      return save(session);
    },
    async get(id) {
      const session = sessions.get(id);
      return session ? structuredClone(session) : null;
    },
    save,
  };
}

function createMemoryCourseRunStore() {
  let state = {
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
  let queue = Promise.resolve();

  return {
    async read() {
      await queue;
      return structuredClone(state);
    },
    transaction(mutator) {
      const operation = queue.then(async () => {
        const nextState = structuredClone(state);
        const result = await mutator(nextState);
        state = nextState;
        return result;
      });
      queue = operation.catch(() => undefined);
      return operation;
    },
  };
}

function createMemoryEvidenceStore() {
  const objects = new Map();
  return {
    kind: 'memory',
    async put({ id, extension, data, contentType }) {
      const filename = `${id}${extension}`;
      objects.set(filename, { data: Buffer.from(data), contentType });
      return filename;
    },
    async get(filename) {
      const object = objects.get(filename);
      return object
        ? { data: Buffer.from(object.data), contentType: object.contentType }
        : null;
    },
    async findById(id) {
      const filename = [...objects.keys()].find((candidate) => candidate.startsWith(`${id}.`));
      if (!filename) return null;
      return { filename, ...(await this.get(filename)) };
    },
  };
}

function fakeLlm() {
  return {
    capabilities() {
      return {
        wireApi: 'responses',
        nativeTools: true,
        vision: false,
        streaming: true,
        webSearch: false,
      };
    },
    async generate({ jsonMode = false, onTextDelta }) {
      if (onTextDelta) onTextDelta('我正在听你说。');
      if (jsonMode) {
        return {
          text: JSON.stringify({
            speechAct: 'social',
            answersPendingQuestion: false,
            pendingAnswer: 'unknown',
            emotion: 'neutral',
            taskRelation: 'unrelated',
            confidence: 0.98,
            dialogueMove: 'acknowledge_student',
            reply: '我在听，你可以接着说。',
          }),
          toolCalls: [],
        };
      }
      return { text: '我在听，你可以接着说。', toolCalls: [] };
    },
  };
}

function request(port, pathname, { method = 'GET', json } = {}) {
  return new Promise((resolve, reject) => {
    const body = json === undefined ? null : Buffer.from(JSON.stringify(json));
    const requestOptions = {
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: body ? {
        'content-type': 'application/json',
        'content-length': body.length,
      } : {},
    };
    const outgoing = http.request(requestOptions, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    outgoing.setTimeout(3_000, () => outgoing.destroy(new Error('测试 HTTP 请求超时。')));
    outgoing.on('error', reject);
    if (body) outgoing.write(body);
    outgoing.end();
  });
}

test('serverless handler serves API-only sessions and SSE entirely from memory', async (t) => {
  const env = {
    APP_ENV: 'test',
    AI_ENABLED: true,
    EVIDENCE_UPLOAD_MODE: 'proxy',
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
    S3_REGION: 'auto',
    S3_PREFIX: 'evidence',
    LOG_LEVEL: 'error',
    projectRoot: path.join(os.tmpdir(), 'forbidden-city-serverless-memory-test'),
    lessonsRoot,
  };
  const sessionStore = createMemorySessionStore();
  const courseRunStore = createMemoryCourseRunStore();
  const evidenceStore = createMemoryEvidenceStore();
  let app;

  const handler = createServerlessHandler({
    loadEnv: () => env,
    buildApp: async (options) => {
      app = await buildApp({
        ...options,
        llm: fakeLlm(),
        sessionStore,
        courseRunStore,
        evidenceStore,
      });
      return app;
    },
  });
  const server = http.createServer((incoming, outgoing) => {
    handler(incoming, outgoing).catch((error) => {
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'content-type': 'application/json' });
      outgoing.end(JSON.stringify({ error: error.message }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (app) await app.close();
  });
  const port = server.address().port;

  const health = await request(port, '/api/serverless?path=health');
  assert.equal(health.statusCode, 200);
  assert.equal(health.headers.location, undefined);
  assert.match(health.headers['cache-control'], /no-store/);
  assert.equal(JSON.parse(health.body).ok, true);

  const courses = [
    { courseId: 'lesson_gewu_001', roleId: 'dragon-counter' },
    { courseId: 'lesson_zhuhun_001', roleId: 'map-strategist' },
  ];
  const createdSessions = [];
  for (const [index, course] of courses.entries()) {
    const response = await request(port, '/api/serverless?path=sessions', {
      method: 'POST',
      json: {
        ...course,
        studentId: `student-${index + 1}`,
        groupId: `group-${index + 1}`,
      },
    });
    assert.equal(response.statusCode, 201, response.body);
    const session = JSON.parse(response.body);
    assert.equal(session.courseId, course.courseId);
    assert.equal(session.roleId, course.roleId);
    assert.match(session.id, /^ses_[a-f0-9]+$/);
    createdSessions.push(session);
  }

  const live = await request(
    port,
    '/api/serverless?path=teacher%2Fruns%2Frun-test%2Flive',
  );
  assert.equal(live.statusCode, 404);

  const roleAssigned = await request(port, '/api/serverless?path=agent%2Fturn', {
    method: 'POST',
    json: {
      sessionId: createdSessions[0].id,
      requestId: 'serverless-role-assigned',
      input: { type: 'lifecycle_event', event: 'role_assigned' },
    },
  });
  assert.equal(roleAssigned.statusCode, 200, roleAssigned.body);
  assert.match(roleAssigned.headers['content-type'], /^text\/event-stream\b/);
  assert.match(roleAssigned.body, /event: assistant\.completed/);

  const streamedTurn = await request(port, '/api/serverless?path=agent%2Fturn', {
    method: 'POST',
    json: {
      sessionId: createdSessions[0].id,
      requestId: 'serverless-streamed-turn',
      input: { type: 'user_text', text: '量子薯片真香' },
    },
  });
  assert.equal(streamedTurn.statusCode, 200, streamedTurn.body);
  assert.match(streamedTurn.headers['content-type'], /^text\/event-stream\b/);
  assert.match(streamedTurn.body, /event: assistant\.delta/);
  assert.match(streamedTurn.body, /event: assistant\.completed/);
});

test('模型内部超时时 SSE 返回降级完成事件，不静默结束', async (t) => {
  const timeoutLlm = {
    capabilities() {
      return {
        wireApi: 'responses',
        nativeTools: true,
        vision: false,
        streaming: true,
        webSearch: false,
      };
    },
    async generate() {
      throw new LLMTimeoutError(new DOMException('模型响应超时。', 'TimeoutError'));
    },
  };
  const app = await buildApp({
    env: {
      APP_ENV: 'test',
      AI_ENABLED: true,
      EVIDENCE_UPLOAD_MODE: 'proxy',
      ENABLE_DEMO: false,
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
      S3_REGION: 'auto',
      S3_PREFIX: 'evidence',
      LOG_LEVEL: 'silent',
      projectRoot: path.join(os.tmpdir(), 'forbidden-city-timeout-sse-test'),
      lessonsRoot,
    },
    llm: timeoutLlm,
    sessionStore: createMemorySessionStore(),
    courseRunStore: createMemoryCourseRunStore(),
    evidenceStore: createMemoryEvidenceStore(),
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
      studentId: 'timeout-student',
      groupId: 'timeout-group',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const sessionId = created.json().id;

  const roleAssigned = await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'timeout-role-assigned',
      input: { type: 'lifecycle_event', event: 'role_assigned' },
    },
  });
  assert.equal(roleAssigned.statusCode, 200, roleAssigned.body);

  const timedOut = await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'timeout-user-turn',
      input: { type: 'user_text', text: '量子薯片真香' },
    },
  });

  assert.equal(timedOut.statusCode, 200, timedOut.body);
  assert.match(timedOut.headers['content-type'], /^text\/event-stream\b/);
  assert.match(timedOut.body, /event: assistant\.completed/);
  assert.match(timedOut.body, /"degraded":true/);
});

test('整次 turn 超过服务端 deadline 时返回可重试错误且不保存请求', async (t) => {
  let modelCalls = 0;
  let observedSignal = null;
  const deadlineLlm = {
    capabilities() {
      return {
        wireApi: 'responses',
        nativeTools: true,
        vision: false,
        streaming: true,
        webSearch: false,
      };
    },
    async generate({ signal }) {
      modelCalls += 1;
      observedSignal = signal;
      // 模型永不返回；只能靠 turn deadline 的 abort 结束。
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  };
  const sessionStore = createMemorySessionStore();
  const app = await buildApp({
    env: {
      APP_ENV: 'test',
      AI_ENABLED: true,
      // 15ms 在全量并行跑时 CPU 被挤占，deadline 常在模型被调之前就触发（modelCalls=0）。
      // 要测的是「deadline 机制 + 不重试 + 不保存请求」，不是机器有多快。
      AI_TURN_TIMEOUT_MS: 500,
      EVIDENCE_UPLOAD_MODE: 'proxy',
      ENABLE_DEMO: false,
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
      S3_REGION: 'auto',
      S3_PREFIX: 'evidence',
      LOG_LEVEL: 'silent',
      projectRoot: path.join(os.tmpdir(), 'forbidden-city-turn-deadline-test'),
      lessonsRoot,
    },
    llm: deadlineLlm,
    sessionStore,
    courseRunStore: createMemoryCourseRunStore(),
    evidenceStore: createMemoryEvidenceStore(),
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
      studentId: 'deadline-student',
      groupId: 'deadline-group',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const sessionId = created.json().id;

  await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'deadline-role-assigned',
      input: { type: 'lifecycle_event', event: 'role_assigned' },
    },
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'deadline-user-turn',
      input: { type: 'user_text', text: '量子薯片真香' },
    },
  });

  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.body, /event: agent\.error/);
  assert.match(response.body, /"code":"AI_TURN_TIMEOUT"/);
  assert.ok(modelCalls <= 1, `deadline 后不应重试模型，实际调用 ${modelCalls} 次`);
  if (modelCalls > 0) {
    assert.ok(observedSignal?.aborted, '模型被调用时，turn deadline 应 abort 底层请求');
  }
  const session = await sessionStore.get(sessionId);
  assert.equal(session.handledRequestIds.includes('deadline-user-turn'), false);
});
