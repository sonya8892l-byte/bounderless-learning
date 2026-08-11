import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';

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
