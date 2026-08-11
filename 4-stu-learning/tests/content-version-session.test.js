import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord, normalizeSessionRecord } from '../server/services/session-factory.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord(values);
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

test('新建会话记录带有 contentVersion，值来自编译产物', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  assert.match(course.contentVersion, /^sha256:[0-9a-f]{64}$/);

  const agent = createAgentService({
    llm: {
      capabilities: () => ({ nativeTools: true, vision: false }),
      generate: async () => ({ text: '', toolCalls: [] }),
    },
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: course.roles[0].id,
    studentId: 'stu_content_version',
    groupId: 'grp_content_version',
  });

  assert.equal(session.contentVersion, course.contentVersion);
});

test('contentVersion 缺失时存空串，不抛错、不阻塞建会话', () => {
  const session = createSessionRecord({
    courseId: 'lesson_gewu_001',
    roleId: 'dragon-counter',
    studentId: 'stu_empty',
  });
  assert.equal(session.contentVersion, '');
});

test('存量会话没有 contentVersion 时 normalize 后补成空串，不报错', () => {
  const legacy = createSessionRecord({
    courseId: 'lesson_gewu_001',
    roleId: 'dragon-counter',
    studentId: 'stu_legacy',
    contentVersion: 'sha256:old',
  });
  delete legacy.contentVersion;

  const normalized = normalizeSessionRecord(legacy);
  assert.ok(normalized);
  assert.equal(normalized.contentVersion, '');
  assert.equal(normalized.id, legacy.id);
});
