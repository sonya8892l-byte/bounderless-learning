import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';
import { compileCourse } from '../server/course/compiler.js';
import { createCourseRunService } from '../server/runtime/course-run-service.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

function memorySessionStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: `ses_evidence_${sessions.size + 1}` });
      sessions.set(session.id, structuredClone(session));
      return structuredClone(session);
    },
    async get(id) {
      return sessions.has(id) ? structuredClone(sessions.get(id)) : null;
    },
    async save(session) {
      sessions.set(session.id, structuredClone(session));
      return session;
    },
  };
}

function memoryRunStore() {
  const state = {
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
  return {
    async read() { return structuredClone(state); },
    async transaction(mutator) { return mutator(state); },
  };
}

function memoryEvidenceStore() {
  const objects = new Map();
  return {
    kind: 'memory',
    objects,
    async put({ id, extension, data, contentType, owner }) {
      const filename = `${id}${extension}`;
      objects.set(filename, {
        data: Buffer.from(data),
        contentType,
        owner: structuredClone(owner),
      });
      return filename;
    },
    async get(filename) {
      const object = objects.get(filename);
      return object ? { ...structuredClone(object), data: Buffer.from(object.data) } : null;
    },
    async findById(id) {
      const filename = [...objects.keys()].find((candidate) => candidate.startsWith(`${id}.`));
      return filename ? { filename, ...(await this.get(filename)) } : null;
    },
  };
}

function multipartImage(sessionId) {
  const boundary = `----evidence-${crypto.randomUUID()}`;
  const payload = Buffer.from([
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="evidence.jpg"',
    'Content-Type: image/jpeg',
    '',
    'image-bytes',
    `--${boundary}--`,
    '',
  ].join('\r\n'));
  return {
    payload,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      ...(sessionId ? { 'x-agent-session-id': sessionId } : {}),
    },
  };
}

function fakeLlm() {
  return {
    capabilities: () => ({ nativeTools: true, vision: false, streaming: true }),
    async generate() { return { text: '已收到。', toolCalls: [] }; },
  };
}

async function fixture() {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const sessionStore = memorySessionStore();
  const courseRunStore = memoryRunStore();
  const evidenceStore = memoryEvidenceStore();
  const realtime = { publish() {}, subscribe() { return () => undefined; } };
  const runtime = createCourseRunService({
    store: courseRunStore,
    getCourse: async () => course,
    realtime,
  });
  const app = await buildApp({
    env: {
      APP_ENV: 'test',
      JOIN_CREDENTIAL_BYPASS: true,
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
      SESSION_STORE_DIR: '.runtime-must-not-be-used',
      S3_PREFIX: 'evidence',
      LOG_LEVEL: 'silent',
      projectRoot: path.join(os.tmpdir(), 'evidence-upload-auth-test'),
      lessonsRoot,
    },
    llm: fakeLlm(),
    sessionStore,
    courseRunStore,
    evidenceStore,
    getCourse: async () => course,
    serveStatic: false,
    realtimeMode: 'polling',
  });
  return { app, course, runtime, evidenceStore };
}

async function createLocalSession(app, suffix) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: 'lesson_gewu_001',
      studentId: `student-${suffix}`,
      groupId: `group-${suffix}`,
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
}

async function sendRunCommand(runtime, runId, action) {
  const snapshot = await runtime.getSnapshot(runId);
  return runtime.sendCommand(runId, {
    actorId: 'teacher-demo',
    idempotencyKey: `${action}-${crypto.randomUUID()}`,
    expectedVersion: snapshot.run.version,
    action,
    target: { scope: 'all' },
    payload: {},
    reason: '上传门禁测试',
  });
}

test('证据上传必须携带存在的学习会话，本地会话也会写入归属', async (t) => {
  const { app, evidenceStore } = await fixture();
  t.after(() => app.close());

  const anonymous = await app.inject({ method: 'POST', url: '/api/uploads', ...multipartImage() });
  assert.equal(anonymous.statusCode, 409);
  assert.equal(anonymous.json().code, 'EVIDENCE_SESSION_REQUIRED');

  const unknown = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage('ses_does_not_exist'),
  });
  assert.equal(unknown.statusCode, 409);
  assert.equal(unknown.json().code, 'EVIDENCE_SESSION_INVALID');

  const session = await createLocalSession(app, 'local');
  const uploaded = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage(session.id),
  });
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const record = await evidenceStore.findById(uploaded.json().id);
  assert.deepEqual(record.owner, {
    sessionId: session.id,
    runId: null,
    participantId: null,
  });

  const anonymousRead = await app.inject({ method: 'GET', url: uploaded.json().url });
  assert.equal(anonymousRead.statusCode, 401);
  assert.equal(anonymousRead.json().code, 'EVIDENCE_READ_FORBIDDEN');
  const ownerRead = await app.inject({
    method: 'GET', url: uploaded.json().url, headers: { 'x-agent-session-id': session.id },
  });
  assert.equal(ownerRead.statusCode, 200);
  assert.equal(ownerRead.body, 'image-bytes');

  const otherSession = await createLocalSession(app, 'reader-attacker');
  const crossSessionRead = await app.inject({
    method: 'GET', url: uploaded.json().url, headers: { 'x-agent-session-id': otherSession.id },
  });
  assert.equal(crossSessionRead.statusCode, 403);
  assert.equal(crossSessionRead.json().code, 'EVIDENCE_READ_FORBIDDEN');
});

test('教师场次暂停、集合、结束和旧绑定都拒绝新证据上传', async (t) => {
  const { app, course, runtime, evidenceStore } = await fixture();
  t.after(() => app.close());
  const run = await runtime.createRun({ courseId: course.id, status: 'active', teacherId: 'teacher-demo' });
  const participant = (await runtime.getSnapshot(run.id)).participants[0];
  const created = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: course.id,
      studentId: participant.id,
      groupId: participant.groupId,
      runId: run.id,
      participantId: participant.id,
      grade: '初中',
      gradeSource: 'student_selected',
    },
  });
  assert.equal(created.statusCode, 201, created.body);

  const beforePause = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage(created.json().id),
  });
  assert.equal(beforePause.statusCode, 201, beforePause.body);
  const owned = await evidenceStore.findById(beforePause.json().id);
  assert.deepEqual(owned.owner, {
    sessionId: created.json().id,
    runId: run.id,
    participantId: participant.id,
  });

  await sendRunCommand(runtime, run.id, 'pause');
  const paused = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage(created.json().id),
  });
  assert.equal(paused.statusCode, 409);
  assert.equal(paused.json().code, 'COURSE_RUN_PAUSED');

  await sendRunCommand(runtime, run.id, 'resume');
  const replacement = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: course.id,
      studentId: participant.id,
      groupId: participant.groupId,
      runId: run.id,
      participantId: participant.id,
      grade: '初中',
      gradeSource: 'student_selected',
    },
  });
  assert.equal(replacement.statusCode, 201, replacement.body);
  const inactive = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage(created.json().id),
  });
  assert.equal(inactive.statusCode, 409);
  assert.equal(inactive.json().code, 'COURSE_SESSION_INACTIVE');

  await sendRunCommand(runtime, run.id, 'emergency_rally');
  const rally = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage(replacement.json().id),
  });
  assert.equal(rally.statusCode, 409);
  assert.equal(rally.json().code, 'COURSE_RUN_RALLY_ACTIVE');

  await sendRunCommand(runtime, run.id, 'resume');
  await sendRunCommand(runtime, run.id, 'end_run');
  const ended = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage(replacement.json().id),
  });
  assert.equal(ended.statusCode, 409);
  assert.equal(ended.json().code, 'COURSE_RUN_COMPLETED');
});

test('tool_result 和时间银行不能引用其他会话上传的证据', async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  const owner = await createLocalSession(app, 'owner');
  const attacker = await createLocalSession(app, 'attacker');
  const uploaded = await app.inject({
    method: 'POST', url: '/api/uploads', ...multipartImage(owner.id),
  });
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const evidence = uploaded.json();

  const toolResult = await app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: attacker.id,
      requestId: 'cross-session-tool-result',
      input: {
        type: 'tool_result',
        toolCallId: 'untrusted-tool-call',
        result: { status: 'completed', evidence: [evidence] },
      },
    },
  });
  assert.equal(toolResult.statusCode, 409);
  assert.equal(toolResult.json().code, 'EVIDENCE_OWNERSHIP_MISMATCH');

  const timeBank = await app.inject({
    method: 'POST',
    url: '/api/time-bank/answer',
    payload: {
      sessionId: attacker.id,
      taskId: 'untrusted-time-bank-task',
      answer: '跨会话证据不应被接受',
      evidence: [evidence],
    },
  });
  assert.equal(timeBank.statusCode, 409);
  assert.equal(timeBank.json().code, 'EVIDENCE_OWNERSHIP_MISMATCH');
});
