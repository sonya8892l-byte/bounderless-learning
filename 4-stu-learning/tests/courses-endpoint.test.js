import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';
import { compileCourse } from '../server/course/compiler.js';
import { ensureSessionRuntime } from '../server/agent/session-state.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

function env(overrides = {}) {
  return {
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
    projectRoot: path.join(os.tmpdir(), 'courses-endpoint-test'),
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

async function testApp(overrides = {}) {
  return buildApp({
    env: env(overrides.env),
    llm,
    sessionStore,
    courseRunStore,
    evidenceStore,
    serveStatic: false,
    realtimeMode: 'polling',
    ...overrides,
  });
}

test('/api/courses enumerates the real lesson directories as metadata only', async (t) => {
  const app = await testApp();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/courses' });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['cache-control'], /no-store/);

  const { courses } = response.json();
  assert.equal(courses.length, 5);
  const ids = courses.map((course) => course.id);
  assert.ok(ids.includes('lesson_gewu_001'));
  assert.ok(ids.includes('lesson_zhizhi_002'));
  for (const course of courses) {
    assert.ok(course.id, '每门课要有非空 id');
    assert.ok(course.title, '每门课要有非空 title');
    assert.ok(course.series, '每门课要有非空 series');
  }

  // 列表接口只给元信息——不许把 roles/knowledge/restrictions 等整包课程泄给前端。
  assert.deepEqual(Object.keys(courses[0]).sort(), ['id', 'series', 'title']);
  assert.doesNotMatch(response.body, /"roles"|"knowledge"|"restrictions"/);
});

test('/api/courses skips a course that fails to compile instead of failing the whole list', async (t) => {
  // 造一个假课程源根目录：两门好课、一门编译会炸的课、一个非课程目录。
  const fakeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'courses-endpoint-'));
  t.after(() => fs.rm(fakeRoot, { recursive: true, force: true }));
  for (const dir of ['lesson_alpha', 'lesson_broken', 'lesson_gamma', 'not-a-lesson']) {
    await fs.mkdir(path.join(fakeRoot, dir));
  }

  const app = await testApp({
    env: { lessonsRoot: fakeRoot },
    getCourse: async (courseId) => {
      if (courseId === 'lesson_broken') throw new Error('模拟课程文件缺失');
      return { id: courseId, lesson: { title: `${courseId} 标题`, series: '测试' } };
    },
  });
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/courses' });
  assert.equal(response.statusCode, 200);
  const { courses } = response.json();
  assert.deepEqual(courses.map((course) => course.id), ['lesson_alpha', 'lesson_gamma']);
});

test('Production 即使误配开关也不暴露平台验收跳关接口', async (t) => {
  const app = await testApp({
    env: env({ APP_ENV: 'production', QA_FORCE_COMPLETE_ENABLED: true }),
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/qa/sessions/ses_hidden/complete-current-task',
    payload: { taskId: 'task-1', requestId: 'qa-hidden-request' },
  });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: '接口不存在。' });
});

test('验收接口开启后推进真实会话，并返回统一 state.updated 事件', async (t) => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const session = createSessionRecord({
    id: 'ses_qa_api',
    courseId: course.id,
    roleId: role.id,
    studentId: 'qa-api-student',
    groupId: 'qa-api-group',
    phaseId: course.lesson.roleSystem.phaseId,
  });
  ensureSessionRuntime(session, role.tasks[0]);
  let saved = structuredClone(session);
  const qaStore = {
    async create() { throw new Error('not used'); },
    async get(id) { return id === saved.id ? structuredClone(saved) : null; },
    async save(next) { saved = structuredClone(next); return next; },
  };
  const app = await testApp({
    env: env({ APP_ENV: 'test', QA_FORCE_COMPLETE_ENABLED: true }),
    sessionStore: qaStore,
    getCourse: async () => course,
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: `/api/qa/sessions/${session.id}/complete-current-task`,
    payload: { taskId: role.tasks[0].id, requestId: 'qa-api-request-1' },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.advanced, true);
  assert.equal(body.allTasksCompleted, false);
  assert.equal(body.events.at(-1).type, 'state.updated');
  assert.equal(body.events.at(-1).data.currentTaskIndex, 1);
  assert.equal(saved.currentTaskIndex, 1);
  assert.equal(saved.qaOverrides[0].requestId, 'qa-api-request-1');
});
