import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkCourseContentVersion } from '../server/agent/content-version-gate.js';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: 'ses_content_version' });
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
    mutate(id, change) {
      const session = structuredClone(sessions.get(id));
      change(session);
      sessions.set(id, session);
    },
  };
}

async function runtimeHarness() {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const store = memoryStore();
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false, streaming: false }),
    async generate() { throw new Error('版本门禁测试不应请求模型。'); },
  };
  const agent = createAgentService({ llm, store, getCourse: async () => course });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: course.roles[0].id,
    studentId: 'content-version-student',
    groupId: 'content-version-group',
  });
  return { agent, course, session, store };
}

test('相同 contentVersion 可继续，旧会话缺版本时仅首次采用当前版本', () => {
  const current = 'sha256:current';
  assert.deepEqual(
    checkCourseContentVersion({ contentVersion: current }, { contentVersion: current }),
    { ok: true, adopted: false, sessionVersion: current, currentVersion: current },
  );
  const legacy = { contentVersion: '' };
  assert.equal(checkCourseContentVersion(legacy, { contentVersion: current }).adopted, true);
  assert.equal(legacy.contentVersion, current);
});

test('活动中会话遇到课程版本变化时明确阻断，不用新任务表静默重建进度', () => {
  const result = checkCourseContentVersion(
    { contentVersion: 'sha256:before' },
    { contentVersion: 'sha256:after' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.sessionVersion, 'sha256:before');
  assert.equal(result.currentVersion, 'sha256:after');
});

test('服务层在处理任何回合前阻断版本错配，且不改动原会话', async () => {
  const { agent, session, store } = await runtimeHarness();
  store.mutate(session.id, (saved) => { saved.contentVersion = 'sha256:old-course'; });

  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'content-version-mismatch',
    input: { type: 'lifecycle_event', event: 'phase_started', data: {} },
  }), (error) => {
    assert.equal(error.code, 'COURSE_VERSION_CHANGED');
    assert.equal(error.details.sessionVersion, 'sha256:old-course');
    return true;
  });

  const stable = await store.get(session.id);
  assert.equal(stable.contentVersion, 'sha256:old-course');
  assert.deepEqual(stable.handledRequestIds, []);
  assert.equal(stable.currentTaskIndex, 0);
});

test('存量会话没有版本时在首个成功回合采用当前版本并持久化', async () => {
  const { agent, course, session, store } = await runtimeHarness();
  store.mutate(session.id, (saved) => { saved.contentVersion = ''; });

  await agent.runTurn({
    sessionId: session.id,
    requestId: 'content-version-adopt',
    input: { type: 'lifecycle_event', event: 'phase_started', data: {} },
  });

  assert.equal((await store.get(session.id)).contentVersion, course.contentVersion);
});
