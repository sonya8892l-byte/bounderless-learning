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
    sessions,
    async create(values) {
      const session = createSessionRecord({ ...values, id: `ses_binding_${sessions.size + 1}` });
      sessions.set(session.id, structuredClone(session));
      return session;
    },
    async get(sessionId) { return sessions.has(sessionId) ? structuredClone(sessions.get(sessionId)) : null; },
    async save(session) { sessions.set(session.id, structuredClone(session)); return session; },
    async remove(sessionId) { return sessions.delete(sessionId); },
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
    state,
    async read() { return structuredClone(state); },
    async transaction(mutator) { return mutator(state); },
  };
}

function llm() {
  return {
    capabilities: () => ({ nativeTools: true, vision: false, streaming: true }),
    async generate() { return { text: '可以开始学习了。', toolCalls: [] }; },
  };
}

function env(overrides = {}) {
  return {
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
    VITE_AMAP_KEY: '',
    VITE_AMAP_SECURITY_CODE: '',
    VITE_AMAP_STYLE: 'amap://styles/normal',
    SESSION_STORE_DIR: '.runtime-must-not-be-used',
    S3_REGION: 'auto',
    S3_PREFIX: 'evidence',
    LOG_LEVEL: 'silent',
    projectRoot: path.join(os.tmpdir(), 'session-activation-binding-test'),
    lessonsRoot,
    ...overrides,
  };
}

async function harness({ model = llm(), envOverrides = {}, teacherId = 'teacher-demo', runStatus = 'active' } = {}) {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const sessionStore = memorySessionStore();
  const courseRunStore = memoryRunStore();
  const realtime = { publish() {}, subscribe() { return () => undefined; } };
  const runtime = createCourseRunService({
    store: courseRunStore,
    getCourse: async () => course,
    realtime,
  });
  const run = await runtime.createRun({ courseId: course.id, status: runStatus, teacherId });
  const snapshot = await runtime.getSnapshot(run.id);
  const participant = snapshot.participants[0];
  const app = await buildApp({
    env: env(envOverrides),
    llm: model,
    sessionStore,
    courseRunStore,
    getCourse: async () => course,
    evidenceStore: {
      kind: 'memory',
      async put() {},
      async get() { return null; },
      async findById() { return null; },
    },
    serveStatic: false,
    realtimeMode: 'polling',
  });
  return {
    app, course, participant, run, runtime, sessionStore,
  };
}

function sessionPayload({ run, participant, roleId } = {}) {
  return {
    courseId: 'lesson_gewu_001',
    ...(roleId ? { roleId } : {}),
    studentId: participant.id,
    groupId: participant.groupId,
    runId: run.id,
    participantId: participant.id,
    grade: '初中',
    gradeSource: 'student_selected',
  };
}

async function sendTeacherCommand(fixture, action, payload = {}) {
  const snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  return fixture.runtime.sendCommand(fixture.run.id, {
    actorId: 'teacher-demo',
    idempotencyKey: `binding-${action}-${crypto.randomUUID()}`,
    expectedVersion: snapshot.run.version,
    action,
    target: { scope: 'all' },
    payload,
    reason: '场次门禁测试',
  });
}

async function completeEntryTasks(fixture, sessionId) {
  const session = await fixture.sessionStore.get(sessionId);
  const entryTrack = fixture.course.phaseTracks[session.phaseId];
  session.completedTaskIds = entryTrack.tasks.map((task) => `${entryTrack.id}:${task.id}`);
  await fixture.sessionStore.save(session);
}

async function createClaimedRoleSession(fixture, roleId, phaseSessionId = '') {
  let sessionId = phaseSessionId;
  if (!sessionId) {
    const phaseResponse = await fixture.app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: sessionPayload(fixture),
    });
    assert.equal(phaseResponse.statusCode, 201);
    sessionId = phaseResponse.json().id;
  }
  await completeEntryTasks(fixture, sessionId);
  const claimed = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${sessionId}/claim-role`,
    payload: { roleId },
  });
  assert.equal(claimed.statusCode, 200);
  const assigned = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: `claim-${roleId}-${crypto.randomUUID()}`,
      input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId } },
    },
  });
  assert.equal(assigned.statusCode, 200);
  assert.equal((await fixture.sessionStore.get(sessionId)).roleId, roleId);
  return fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.participant.id,
      courseId: fixture.course.id,
    },
  });
}

test('POST /api/sessions 可以用平台默认学段，场次身份缺失或不匹配仍返回 422', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const base = sessionPayload(fixture);

  const missingGrade = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { ...base, grade: undefined, gradeSource: undefined },
  });
  assert.equal(missingGrade.statusCode, 201);
  assert.equal(missingGrade.json().grade, '初中');
  assert.equal(fixture.sessionStore.sessions.size, 1);

  const missingParticipant = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { ...base, participantId: undefined },
  });
  assert.equal(missingParticipant.statusCode, 422);
  assert.match(missingParticipant.json().error, /学生身份/);
  assert.equal(fixture.sessionStore.sessions.size, 1);

  const mismatchedParticipant = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { ...base, participantId: 'student-from-another-run' },
  });
  assert.equal(mismatchedParticipant.statusCode, 422);
  assert.match(mismatchedParticipant.json().error, /不匹配/);
  assert.equal(fixture.sessionStore.sessions.size, 1);

  const mismatchedCourse = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { ...base, courseId: 'lesson_zhizhi_001' },
  });
  assert.equal(mismatchedCourse.statusCode, 422);
  assert.match(mismatchedCourse.json().error, /不匹配/);
  assert.equal(fixture.sessionStore.sessions.size, 1);
});

test('draft 场次可以预建等候会话，但老师开始前任何学习回合都被拒绝', async (t) => {
  const fixture = await harness({ runStatus: 'draft' });
  t.after(() => fixture.app.close());
  const created = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(created.statusCode, 201);

  const beforeStart = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: created.json().id,
      requestId: 'draft-run-cannot-learn',
      input: { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
    },
  });
  assert.equal(beforeStart.statusCode, 409);
  assert.equal(beforeStart.json().code, 'COURSE_RUN_NOT_ACTIVE');

  await sendTeacherCommand(fixture, 'start_phase');
  const snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(snapshot.run.status, 'active');
});

test('Preview 入课和恢复必须验证 participant 专属高熵凭证', async (t) => {
  const teacherToken = 'teacher-token-for-join-credential-tests';
  const fixture = await harness({
    envOverrides: {
      APP_ENV: 'preview',
      JOIN_CREDENTIAL_BYPASS: true,
      TEACHER_API_TOKEN: teacherToken,
      TEACHER_ID: 'teacher-primary',
    },
    teacherId: 'teacher-primary',
  });
  t.after(() => fixture.app.close());

  const unauthorizedSnapshot = await fixture.app.inject({
    method: 'GET',
    url: `/api/teacher/runs/${fixture.run.id}/snapshot`,
  });
  assert.equal(unauthorizedSnapshot.statusCode, 401);

  const snapshotResponse = await fixture.app.inject({
    method: 'GET',
    url: `/api/teacher/runs/${fixture.run.id}/snapshot`,
    headers: { authorization: `Bearer ${teacherToken}` },
  });
  assert.equal(snapshotResponse.statusCode, 200);
  const teacherSnapshot = snapshotResponse.json();
  const owner = teacherSnapshot.participants[0];
  const other = teacherSnapshot.participants[1];
  assert.equal(JSON.stringify(teacherSnapshot).includes('joinCredential'), false);
  assert.equal(JSON.stringify(teacherSnapshot).includes('joinCredentialSecret'), false);
  assert.equal(JSON.stringify(fixture.run).includes('joinCredentialSecret'), false);

  const preflight = await fixture.app.inject({
    method: 'GET',
    url: `/api/teacher/runs/${fixture.run.id}/preflight`,
    headers: { authorization: `Bearer ${teacherToken}` },
  });
  assert.equal(preflight.statusCode, 200);
  const ownerCredential = preflight.json().joinCredentials
    .find((item) => item.participantId === owner.id).joinCredential;
  const otherCredential = preflight.json().joinCredentials
    .find((item) => item.participantId === other.id).joinCredential;
  assert.ok(ownerCredential.length >= 40);
  assert.notEqual(ownerCredential, otherCredential);

  const missingCredential = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, participant: owner }),
  });
  assert.equal(missingCredential.statusCode, 401);
  assert.equal(missingCredential.json().code, 'JOIN_CREDENTIAL_REQUIRED');
  assert.equal(fixture.sessionStore.sessions.size, 0);

  const forgedOtherParticipant = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      ...sessionPayload({ ...fixture, participant: other }),
      joinCredential: ownerCredential,
    },
  });
  assert.equal(forgedOtherParticipant.statusCode, 403);
  assert.equal(forgedOtherParticipant.json().code, 'JOIN_CREDENTIAL_INVALID');
  assert.equal(fixture.sessionStore.sessions.size, 0);

  const joined = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      ...sessionPayload({ ...fixture, participant: owner }),
      joinCredential: ownerCredential,
    },
  });
  assert.equal(joined.statusCode, 201);
  assert.equal(joined.json().participantId, owner.id);
  assert.equal(JSON.stringify(joined.json()).includes('joinCredential'), false);
  assert.equal(fixture.sessionStore.sessions.get(joined.json().id).joinCredential, undefined);

  const resumeWithoutCredential = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: owner.id,
      courseId: fixture.course.id,
    },
  });
  assert.equal(resumeWithoutCredential.statusCode, 401);
  assert.equal(resumeWithoutCredential.json().code, 'JOIN_CREDENTIAL_REQUIRED');

  const forgedResume = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: owner.id,
      courseId: fixture.course.id,
      joinCredential: otherCredential,
    },
  });
  assert.equal(forgedResume.statusCode, 403);
  assert.equal(forgedResume.json().code, 'JOIN_CREDENTIAL_INVALID');

  const resumed = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: owner.id,
      courseId: fixture.course.id,
      joinCredential: ownerCredential,
    },
  });
  assert.equal(resumed.statusCode, 200);
  assert.equal(resumed.json().id, joined.json().id);
  assert.equal(JSON.stringify(resumed.json()).includes('joinCredential'), false);
});

test('刷新时恢复当前 roleless 阶段会话，重复恢复不新建 session', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const created = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(created.statusCode, 201);
  const createdSession = created.json();
  assert.equal(createdSession.roleId, '');
  assert.ok(createdSession.runtime?.task?.taskId);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const resumed = await fixture.app.inject({
      method: 'POST',
      url: '/api/sessions/resume',
      payload: {
        runId: fixture.run.id,
        participantId: fixture.participant.id,
        courseId: fixture.course.id,
      },
    });
    assert.equal(resumed.statusCode, 200);
    const body = resumed.json();
    assert.equal(body.id, createdSession.id);
    assert.equal(body.roleId, '');
    assert.equal(body.runtime.task.taskId, createdSession.runtime.task.taskId);
    assert.equal(body.phaseTaskContext.taskId, createdSession.phaseTaskContext.taskId);
    assert.equal(body.resumed, true);
    assert.ok(body.teacherRunState);
  }
  assert.equal(fixture.sessionStore.sessions.size, 1);
});

test('恢复旧会话时可继续使用默认学段，后续仍可用名单学段更新', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const created = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(created.statusCode, 201);

  const legacy = await fixture.sessionStore.get(created.json().id);
  legacy.grade = '初中';
  legacy.gradeSource = 'platform_default';
  legacy.learnerState.grade = '初中';
  await fixture.sessionStore.save(legacy);

  const missingGrade = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.participant.id,
      courseId: fixture.course.id,
    },
  });
  assert.equal(missingGrade.statusCode, 200);
  assert.equal(missingGrade.json().grade, '初中');

  const repaired = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.participant.id,
      courseId: fixture.course.id,
      grade: '高中',
      gradeSource: 'student_selected',
    },
  });
  assert.equal(repaired.statusCode, 200);
  assert.equal(repaired.json().grade, '高中');
  assert.equal(repaired.json().gradeSource, 'student_selected');
  const saved = await fixture.sessionStore.get(created.json().id);
  assert.equal(saved.grade, '高中');
  assert.equal(saved.learnerState.grade, '高中');
});

test('恢复始终返回当前绑定的已选角色会话', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const roleA = fixture.course.roles[0].id;
  const roleBId = fixture.course.roles[1].id;
  await sendTeacherCommand(fixture, 'release_roles');

  const roleAResponse = await createClaimedRoleSession(fixture, roleA);
  assert.equal(roleAResponse.statusCode, 200);
  const roleAId = roleAResponse.json().id;

  const roleBResponse = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId: roleBId }),
  });
  assert.equal(roleBResponse.statusCode, 201);
  const roleB = roleBResponse.json();

  const resumed = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.participant.id,
      courseId: fixture.course.id,
    },
  });
  assert.equal(resumed.statusCode, 200);
  assert.equal(resumed.json().id, roleB.id);
  assert.equal(resumed.json().roleId, roleB.roleId);
  assert.ok(resumed.json().runtime?.task);
  assert.notEqual(resumed.json().id, roleAId);
});

test('阶段会话先原子领取角色，再在同一 session 完成角色补绑', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const phaseResponse = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(phaseResponse.statusCode, 201);
  const phaseSessionId = phaseResponse.json().id;
  await sendTeacherCommand(fixture, 'release_roles');
  const roleId = fixture.course.roles[0].id;

  const prematureClaim = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${phaseSessionId}/claim-role`,
    payload: { roleId },
  });
  assert.equal(prematureClaim.statusCode, 409);
  assert.equal(prematureClaim.json().code, 'PHASE_TASKS_INCOMPLETE');
  assert.equal((await fixture.runtime.runStateForSession(phaseSessionId)).claimedRoleId, '');

  const bypassEntry = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId }),
  });
  assert.equal(bypassEntry.statusCode, 409);
  assert.equal(bypassEntry.json().code, 'PHASE_TASKS_INCOMPLETE');

  await completeEntryTasks(fixture, phaseSessionId);
  const staleSession = await fixture.sessionStore.get(phaseSessionId);
  staleSession.contentVersion = 'stale-course-version';
  await fixture.sessionStore.save(staleSession);
  const staleClaim = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${phaseSessionId}/claim-role`,
    payload: { roleId },
  });
  assert.equal(staleClaim.statusCode, 409);
  assert.equal(staleClaim.json().code, 'COURSE_VERSION_CHANGED');
  assert.equal((await fixture.runtime.runStateForSession(phaseSessionId)).claimedRoleId, '');
  assert.equal((await fixture.sessionStore.get(phaseSessionId)).roleId, '');
  staleSession.contentVersion = fixture.course.contentVersion;
  await fixture.sessionStore.save(staleSession);

  const bypassContinuity = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId }),
  });
  assert.equal(bypassContinuity.statusCode, 409);
  assert.equal(bypassContinuity.json().code, 'PHASE_SESSION_REUSE_REQUIRED');

  const claimed = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${phaseSessionId}/claim-role`,
    payload: { roleId },
  });
  assert.equal(claimed.statusCode, 200);
  assert.equal(claimed.json().sessionId, phaseSessionId);
  assert.equal(claimed.json().teacherRunState.claimedRoleId, roleId);
  assert.equal((await fixture.sessionStore.get(phaseSessionId)).roleId, roleId);

  const sessionCountAfterClaim = fixture.sessionStore.sessions.size;
  const duplicateRoleSession = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId }),
  });
  assert.equal(duplicateRoleSession.statusCode, 409);
  assert.equal(duplicateRoleSession.json().code, 'COURSE_ROLE_SESSION_EXISTS');
  assert.equal(fixture.sessionStore.sessions.size, sessionCountAfterClaim);
  assert.equal(
    (await fixture.runtime.runStateForSession(phaseSessionId)).claimedRoleId,
    roleId,
  );

  const assigned = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: phaseSessionId,
      requestId: 'phase-session-role-assigned',
      input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId } },
    },
  });
  assert.equal(assigned.statusCode, 200);
  const saved = await fixture.sessionStore.get(phaseSessionId);
  assert.equal(saved.roleId, roleId);
  const snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  const participant = snapshot.participants.find((item) => item.id === fixture.participant.id);
  assert.equal(participant.learnerSessionId, phaseSessionId);
  assert.equal(participant.roleId, roleId);
});

test('入口任务完成后教师推进 Phase，学生仍可在原会话领取角色', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const created = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(created.statusCode, 201);
  const sessionId = created.json().id;
  const entryPhaseId = created.json().phaseId;
  await completeEntryTasks(fixture, sessionId);
  await sendTeacherCommand(fixture, 'release_roles');
  await sendTeacherCommand(fixture, 'advance_phase');
  const advanced = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(advanced.run.phaseId, 'phase-2');
  assert.notEqual(advanced.run.phaseId, entryPhaseId);

  const roleId = fixture.course.roles[0].id;
  const claimed = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${sessionId}/claim-role`,
    payload: { roleId },
  });

  assert.equal(claimed.statusCode, 200);
  assert.equal(claimed.json().sessionId, sessionId);
  assert.equal(claimed.json().teacherRunState.phaseId, 'phase-2');
  assert.equal(claimed.json().teacherRunState.claimedRoleId, roleId);
  const saved = await fixture.sessionStore.get(sessionId);
  assert.equal(saved.roleId, roleId);
  assert.equal(saved.phaseTaskState.phaseId, entryPhaseId);
  assert.equal(saved.phaseId, fixture.course.lesson.roleSystem.phaseId);
});

test('同组角色冲突返回可刷新的学生安全 runState', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  await sendTeacherCommand(fixture, 'release_roles');
  const snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  const [owner, contender] = snapshot.groups[0].members;
  const roleId = fixture.course.roles[0].id;
  const ownerSession = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, participant: owner }),
  });
  const contenderSession = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, participant: contender }),
  });
  assert.equal(ownerSession.statusCode, 201);
  assert.equal(contenderSession.statusCode, 201);
  await completeEntryTasks(fixture, ownerSession.json().id);
  await completeEntryTasks(fixture, contenderSession.json().id);
  assert.equal((await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${ownerSession.json().id}/claim-role`,
    payload: { roleId },
  })).statusCode, 200);

  const conflict = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${contenderSession.json().id}/claim-role`,
    payload: { roleId },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().code, 'COURSE_ROLE_TAKEN');
  assert.equal(conflict.json().kind, 'validation');
  assert.equal(conflict.json().details.runState.takenRoleIds.includes(roleId), true);
  assert.equal(conflict.json().details.runState.availableRoleIds.includes(roleId), false);
  assert.equal(JSON.stringify(conflict.json().details.runState).includes(owner.id), false);
});

test('同一阶段会话并发领取不同角色时只提交一条一致轨道', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  await sendTeacherCommand(fixture, 'release_roles');
  const phaseResponse = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(phaseResponse.statusCode, 201);
  const sessionId = phaseResponse.json().id;
  await completeEntryTasks(fixture, sessionId);
  const [roleA, roleB] = fixture.course.roles.map((role) => role.id);

  const responses = await Promise.all([roleA, roleB].map((roleId) => fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${sessionId}/claim-role`,
    payload: { roleId },
  })));
  const success = responses.find((response) => response.statusCode === 200);
  const rejected = responses.find((response) => response.statusCode === 409);
  assert.ok(success);
  assert.equal(rejected?.json().code, 'ROLE_ALREADY_ASSIGNED');
  const saved = await fixture.sessionStore.get(sessionId);
  const runState = await fixture.runtime.runStateForSession(sessionId);
  assert.equal(saved.roleId, success.json().roleId);
  assert.equal(runState.claimedRoleId, success.json().roleId);
});

test('恢复接口区分无历史会话、身份不匹配与损坏绑定', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  const neverStarted = snapshot.participants[1];

  const missing = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: neverStarted.id,
      courseId: fixture.course.id,
    },
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().code, 'SESSION_RESUME_NOT_FOUND');

  const mismatch = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.participant.id,
      courseId: 'lesson_zhizhi_001',
    },
  });
  assert.equal(mismatch.statusCode, 422);

  await fixture.runtime.bindLearnerSession({
    runId: fixture.run.id,
    participantId: fixture.participant.id,
    courseId: fixture.course.id,
    sessionId: 'ses_missing_from_agent_store',
  });
  const stale = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.participant.id,
      courseId: fixture.course.id,
    },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().code, 'SESSION_RESUME_STALE_BINDING');
});

test('阶段→角色 A→角色 B→角色 A 后，教师场次只指向当前会话', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const roleA = fixture.course.roles[0].id;
  const roleB = fixture.course.roles[1].id;

  const phaseResponse = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(phaseResponse.statusCode, 201);
  const phaseSession = phaseResponse.json();
  await sendTeacherCommand(fixture, 'release_roles');

  const roleAResponse = await createClaimedRoleSession(fixture, roleA, phaseSession.id);
  assert.equal(roleAResponse.statusCode, 200);
  const roleASession = roleAResponse.json();

  const roleBResponse = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId: roleB }),
  });
  assert.equal(roleBResponse.statusCode, 201);
  const roleBSession = roleBResponse.json();
  let snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(
    snapshot.participants.find((item) => item.id === fixture.participant.id).learnerSessionId,
    roleBSession.id,
  );

  const activation = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${roleASession.id}/activate`,
    payload: {
      runId: 'client-cannot-override-run',
      participantId: 'client-cannot-override-participant',
    },
  });
  assert.equal(activation.statusCode, 200);
  assert.equal(activation.json().id, roleASession.id);
  assert.equal(activation.json().runId, fixture.run.id);
  assert.equal(activation.json().participantId, fixture.participant.id);
  assert.ok(activation.json().teacherRunState);

  snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(
    snapshot.participants.find((item) => item.id === fixture.participant.id).learnerSessionId,
    roleASession.id,
  );
  assert.equal(roleASession.id, phaseSession.id);

  const standalone = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: fixture.course.id,
      studentId: 'standalone-student',
      groupId: 'standalone-group',
    },
  });
  assert.equal(standalone.statusCode, 201);
  const untrustedActivation = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${standalone.json().id}/activate`,
  });
  assert.equal(untrustedActivation.statusCode, 422);
});

test('教师锁定角色后不能激活旧角色会话，重新开放后才能切换', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const roleA = fixture.course.roles[0].id;
  const roleB = fixture.course.roles[1].id;
  await sendTeacherCommand(fixture, 'release_roles');

  const roleAResponse = await createClaimedRoleSession(fixture, roleA);
  const roleBResponse = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId: roleB }),
  });
  assert.equal(roleAResponse.statusCode, 200);
  assert.equal(roleBResponse.statusCode, 201);
  const roleASessionId = roleAResponse.json().id;
  const roleBSessionId = roleBResponse.json().id;

  await sendTeacherCommand(fixture, 'lock_roles');
  const lockedActivation = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${roleASessionId}/activate`,
  });
  assert.equal(lockedActivation.statusCode, 409);
  assert.equal(lockedActivation.json().code, 'COURSE_ROLES_LOCKED');
  let snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(
    snapshot.participants.find((item) => item.id === fixture.participant.id).learnerSessionId,
    roleBSessionId,
  );

  await sendTeacherCommand(fixture, 'release_roles');
  const unlockedActivation = await fixture.app.inject({
    method: 'POST',
    url: `/api/sessions/${roleASessionId}/activate`,
  });
  assert.equal(unlockedActivation.statusCode, 200);
  snapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(
    snapshot.participants.find((item) => item.id === fixture.participant.id).learnerSessionId,
    roleASessionId,
  );
});

test('服务端权威拦截入口任务未完成、未领取角色、暂停、集合、结束和旧绑定会话', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());
  const roleId = fixture.course.roles[0].id;
  const created = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture),
  });
  assert.equal(created.statusCode, 201);
  const phaseSessionId = created.json().id;

  const preboundRole = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId }),
  });
  assert.equal(preboundRole.statusCode, 409);
  assert.equal(preboundRole.json().code, 'PHASE_TASKS_INCOMPLETE');

  const locked = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: phaseSessionId,
      requestId: 'binding-role-locked',
      input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId } },
    },
  });
  assert.equal(locked.statusCode, 409);
  assert.equal(locked.json().code, 'COURSE_ROLE_CLAIM_REQUIRED');
  await sendTeacherCommand(fixture, 'release_roles');

  const unclaimedRoleTurn = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: phaseSessionId,
      requestId: 'binding-role-claim-required',
      input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId } },
    },
  });
  assert.equal(unclaimedRoleTurn.statusCode, 409);
  assert.equal(unclaimedRoleTurn.json().code, 'COURSE_ROLE_CLAIM_REQUIRED');
  assert.equal((await fixture.runtime.runStateForSession(phaseSessionId)).claimedRoleId, '');
  assert.equal((await fixture.sessionStore.get(phaseSessionId)).roleId, '');

  await sendTeacherCommand(fixture, 'pause');
  const paused = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: phaseSessionId,
      requestId: 'binding-paused',
      input: { type: 'user_text', text: '我还想继续。' },
    },
  });
  assert.equal(paused.statusCode, 409);
  assert.equal(paused.json().code, 'COURSE_RUN_PAUSED');
  assert.equal(paused.json().kind, 'validation');
  assert.equal(paused.json().details.runState.paused, true);

  await sendTeacherCommand(fixture, 'resume');
  await sendTeacherCommand(fixture, 'emergency_rally');
  const rally = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: phaseSessionId,
      requestId: 'binding-rally',
      input: { type: 'user_text', text: '我还想继续。' },
    },
  });
  assert.equal(rally.statusCode, 409);
  assert.equal(rally.json().code, 'COURSE_RUN_RALLY_ACTIVE');

  await sendTeacherCommand(fixture, 'resume');
  await sendTeacherCommand(fixture, 'release_roles');
  await createClaimedRoleSession(fixture, roleId, phaseSessionId);
  const replacementRoleId = fixture.course.roles[1].id;
  const replacement = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId: replacementRoleId }),
  });
  assert.equal(replacement.statusCode, 201);
  const inactive = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: phaseSessionId,
      requestId: 'binding-old-session',
      input: { type: 'user_text', text: '旧会话不应继续推进。' },
    },
  });
  assert.equal(inactive.statusCode, 409);
  assert.equal(inactive.json().code, 'COURSE_SESSION_INACTIVE');
  const inactiveTimeBank = await fixture.app.inject({
    method: 'POST',
    url: '/api/time-bank/answer',
    payload: {
      sessionId: phaseSessionId,
      taskId: 'old-session-cannot-advance-time-bank',
      answer: '旧会话不应改变任何进度。',
    },
  });
  assert.equal(inactiveTimeBank.statusCode, 409);
  assert.equal(inactiveTimeBank.json().code, 'COURSE_SESSION_INACTIVE');

  await sendTeacherCommand(fixture, 'end_run');
  const ended = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId: replacement.json().id,
      requestId: 'binding-ended',
      input: { type: 'user_text', text: '课程结束后不应推进。' },
    },
  });
  assert.equal(ended.statusCode, 409);
  assert.equal(ended.json().code, 'COURSE_RUN_COMPLETED');

  const sessionCount = fixture.sessionStore.sessions.size;
  const recreateAfterEnd = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload({ ...fixture, roleId }),
  });
  assert.equal(recreateAfterEnd.statusCode, 409);
  assert.equal(recreateAfterEnd.json().code, 'COURSE_RUN_COMPLETED');
  assert.equal(fixture.sessionStore.sessions.size, sessionCount);
  const finalSnapshot = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(
    finalSnapshot.participants.find((item) => item.id === fixture.participant.id).learnerSessionId,
    replacement.json().id,
  );
});

test('慢 AI 回合期间暂停场次，落盘前二次门禁阻止进度和对话写入', async (t) => {
  let releaseModel;
  let markModelStarted;
  const modelStarted = new Promise((resolve) => { markModelStarted = resolve; });
  const fixture = await harness({
    model: {
      capabilities: () => ({ nativeTools: true, vision: false, streaming: true }),
      async generate(request) {
        if (request.jsonMode && /语义理解模块/.test(request.instructions || '')) {
          return {
            text: JSON.stringify({
              intent: 'unknown', emotion: 'neutral', answersPendingQuestion: false,
              pendingAnswer: 'unknown', hasTaskRequest: false, locationKind: 'none',
              want: '请求开放回答', confidence: 0.9,
            }),
            toolCalls: [],
          };
        }
        markModelStarted();
        return new Promise((resolve) => { releaseModel = () => resolve({ text: '这条回复不应在暂停后落盘。', toolCalls: [] }); });
      },
    },
  });
  t.after(() => fixture.app.close());
  await sendTeacherCommand(fixture, 'release_roles');
  const roleId = fixture.course.roles[0].id;
  const created = await createClaimedRoleSession(fixture, roleId);
  assert.equal(created.statusCode, 200);
  const sessionId = created.json().id;
  const assigned = await fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'mid-turn-role-assigned',
      input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId } },
    },
  });
  assert.equal(assigned.statusCode, 200);
  const before = await fixture.sessionStore.get(sessionId);

  const pendingTurn = fixture.app.inject({
    method: 'POST',
    url: '/api/agent/turn',
    payload: {
      sessionId,
      requestId: 'mid-turn-user-text',
      input: { type: 'user_text', text: '量子薯片今天是蓝色的。' },
    },
  });
  await modelStarted;
  await sendTeacherCommand(fixture, 'pause');
  releaseModel();
  const response = await pendingTurn;
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /COURSE_RUN_PAUSED/);
  const after = await fixture.sessionStore.get(sessionId);
  assert.deepEqual(after.messages, before.messages);
  assert.equal(after.currentTaskIndex, before.currentTaskIndex);
  assert.deepEqual(after.completedTaskIds, before.completedTaskIds);
});
