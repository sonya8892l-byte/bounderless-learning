import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';
import { compileCourse } from '../server/course/compiler.js';
import { createCourseRunService } from '../server/runtime/course-run-service.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');
const teacherToken = 'teacher-reset-integration-token';
const teacherId = 'teacher-primary';

function memorySessionStore() {
  const sessions = new Map();
  let sequence = 0;
  let nextSaveBarrier = null;
  return {
    sessions,
    armNextSaveBarrier() {
      let enter;
      let release;
      const entered = new Promise((resolve) => { enter = resolve; });
      const released = new Promise((resolve) => { release = resolve; });
      nextSaveBarrier = { enter, release, released };
      return { entered, release: () => release() };
    },
    async create(values) {
      sequence += 1;
      const session = createSessionRecord({ ...values, id: `ses_reset_${sequence}` });
      sessions.set(session.id, structuredClone(session));
      return session;
    },
    async get(sessionId) {
      return sessions.has(sessionId) ? structuredClone(sessions.get(sessionId)) : null;
    },
    async save(session) {
      sessions.set(session.id, structuredClone(session));
      if (nextSaveBarrier) {
        const barrier = nextSaveBarrier;
        nextSaveBarrier = null;
        barrier.enter(session.id);
        await barrier.released;
      }
      return session;
    },
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
    kind: 'memory',
    async read() { return structuredClone(state); },
    async transaction(mutator) { return mutator(state, { kind: 'memory' }); },
  };
}

function model() {
  return {
    capabilities: () => ({ nativeTools: true, vision: false, streaming: true }),
    async generate() { return { text: '这条对话会被保存。', toolCalls: [] }; },
  };
}

function appEnv() {
  return {
    APP_ENV: 'preview',
    JOIN_CREDENTIAL_BYPASS: false,
    AI_ENABLED: true,
    EVIDENCE_UPLOAD_MODE: 'proxy',
    ENABLE_DEMO: false,
    TEACHER_API_TOKEN: teacherToken,
    TEACHER_ID: teacherId,
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
    projectRoot,
    lessonsRoot,
  };
}

async function harness() {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const sessionStore = memorySessionStore();
  const courseRunStore = memoryRunStore();
  const realtime = { publish() {}, subscribe() { return () => undefined; } };
  const runtime = createCourseRunService({
    store: courseRunStore,
    getCourse: async () => course,
    realtime,
    requireJoinCredential: true,
  });
  const run = await runtime.createRun({
    courseId: course.id,
    className: '单学生重置集成测试',
    groupCount: 1,
    status: 'active',
    teacherId,
  });
  const initial = await runtime.getSnapshot(run.id);
  const [target, control] = initial.participants;
  const preflight = await runtime.preflight(run.id);
  const credentials = new Map(
    preflight.joinCredentials.map((item) => [item.participantId, item.joinCredential]),
  );
  const app = await buildApp({
    env: appEnv(),
    llm: model(),
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
    app, course, courseRunStore, credentials, initial, run, runtime, sessionStore, target, control,
  };
}

function sessionPayload(fixture, participant) {
  return {
    courseId: fixture.course.id,
    studentId: participant.id,
    groupId: participant.groupId,
    runId: fixture.run.id,
    participantId: participant.id,
    joinCredential: fixture.credentials.get(participant.id),
    grade: '初中',
    gradeSource: 'student_selected',
  };
}

async function createSession(fixture, participant) {
  const response = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture, participant),
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json();
}

async function seedHistoricalLearning(fixture, session, role, phaseId, marker) {
  const saved = await fixture.sessionStore.get(session.id);
  saved.roleId = role.id;
  saved.phaseId = phaseId;
  saved.currentTaskIndex = 1;
  saved.completedTaskIds = [`${role.id}:historical-task`];
  saved.events = [`${role.id}:historical-role-assigned`];
  saved.messages = [
    { role: 'user', content: marker, createdAt: '2026-08-12T01:00:00.000Z' },
    { role: 'assistant', content: `历史回复：${marker}`, createdAt: '2026-08-12T01:00:01.000Z' },
  ];
  saved.taskState = {
    taskId: role.tasks[1]?.id || role.tasks[0].id,
    guidanceStepIndex: 2,
    stepAttempts: { 'historical-step': 3 },
  };
  saved.learningState = {
    ...(saved.learningState || {}),
    roleId: role.id,
    stepId: 'historical-step',
    completedStepIds: ['historical-complete-step'],
    evidenceIds: [`ev_${session.id}`],
  };
  saved.timeBalance = 5;
  saved.pendingTools = { historical_tool: { name: 'open_task_tool', payload: { marker } } };
  await fixture.sessionStore.save(saved);
  return fixture.sessionStore.get(session.id);
}

async function seedStartedLearning(fixture, participant, session, role, marker) {
  const saved = await fixture.sessionStore.get(session.id);
  saved.roleId = role.id;
  saved.phaseId = fixture.course.lesson.roleSystem.phaseId;
  saved.currentTaskIndex = 1;
  saved.completedTaskIds = [`${role.id}:${role.tasks[0].id}`];
  saved.events = [`${role.id}:role-assigned`];
  saved.messages = [
    { role: 'user', content: marker, createdAt: '2026-08-13T01:00:00.000Z' },
    { role: 'assistant', content: `已记住：${marker}`, createdAt: '2026-08-13T01:00:01.000Z' },
  ];
  saved.taskState = {
    taskId: role.tasks[1]?.id || role.tasks[0].id,
    guidanceStepIndex: 1,
    stepAttempts: { 'test-step': 2 },
  };
  saved.learningState = {
    ...(saved.learningState || {}),
    roleId: role.id,
    stepId: 'test-step',
    completedStepIds: ['test-complete-step'],
    evidenceIds: ['ev_deadbeef'],
  };
  saved.timeBalance = 9;
  saved.timeEarned = 4;
  saved.completedBankTaskIds = ['bank-test'];
  saved.pendingTools = { tool_private: { name: 'open_task_tool', payload: { marker } } };
  await fixture.sessionStore.save(saved);

  await fixture.courseRunStore.transaction((state) => {
    const run = state.runs.find((item) => item.id === fixture.run.id);
    const current = run.participants.find((item) => item.id === participant.id);
    current.name = participant.id === fixture.target.id ? '测试学生甲' : '测试学生乙';
    current.rosterAssigned = true;
    current.roleId = role.id;
    current.roleName = role.name;
    current.roleClaimedAt = '2026-08-13T00:30:00.000Z';
    current.roleClaimSource = 'student';
    current.online = true;
    current.presenceObservedAt = '2026-08-13T00:59:59.000Z';
    current.device = {
      ...current.device,
      loggedIn: true,
      roleClaimed: true,
      network: 'weak',
      location: 'ready',
      camera: 'ready',
      cameraObservedAt: '2026-08-13T00:59:58.000Z',
    };
    current.location = {
      ...current.location,
      lng: participant.id === fixture.target.id ? 116.397 : 116.398,
      lat: participant.id === fixture.target.id ? 39.916 : 39.917,
      accuracyMeters: 8,
      insideFence: true,
      permission: 'granted',
      observedAt: '2026-08-13T00:59:57.000Z',
    };
    current.latestDirective = {
      commandId: `cmd-${participant.id}`,
      action: 'send_notice',
      payload: { text: marker },
    };
    current.learning = {
      ...current.learning,
      progress: participant.id === fixture.target.id ? 67 : 34,
      currentTask: role.tasks[1]?.name || role.tasks[0].name,
      currentTaskId: role.tasks[1]?.id || role.tasks[0].id,
      currentStepId: 'test-step',
      currentStepName: '继续观察',
      evidenceCount: 1,
      dialogueSummary: marker,
      timeBalance: 9,
      scaffoldLevel: 2,
    };
    run.rolesReleased = true;
    run.rolesLocked = true;
  });
  return fixture.sessionStore.get(session.id);
}

async function seedResetSideEffects(fixture) {
  await fixture.courseRunStore.transaction((state) => {
    const runId = fixture.run.id;
    state.commands.push(
      { id: 'cmd-target-reset', runId },
      { id: 'cmd-control-keep', runId },
    );
    state.receipts.push(
      {
        commandId: 'cmd-target-reset', participantId: fixture.target.id,
        learnerSessionId: 'target-old', status: 'accepted', deliveredAt: null,
      },
      {
        commandId: 'cmd-control-keep', participantId: fixture.control.id,
        learnerSessionId: 'control-current', status: 'accepted', deliveredAt: null,
      },
    );
    state.alerts.push(
      {
        id: 'alert-target-help', runId, participantId: fixture.target.id,
        groupId: fixture.target.groupId, type: 'student_help', status: 'open',
        resolution: '', createdAt: '2026-08-13T01:01:00.000Z', updatedAt: '2026-08-13T01:01:00.000Z',
      },
      {
        id: 'alert-target-safety', runId, participantId: fixture.target.id,
        groupId: fixture.target.groupId, type: 'safety_help', status: 'acknowledged',
        resolution: '', createdAt: '2026-08-13T01:02:00.000Z', updatedAt: '2026-08-13T01:02:00.000Z',
      },
      {
        id: 'alert-target-terminal', runId, participantId: fixture.target.id,
        groupId: fixture.target.groupId, type: 'student_help', status: 'false_alarm',
        resolution: '已核实为误报', createdAt: '2026-08-13T01:03:00.000Z', updatedAt: '2026-08-13T01:03:00.000Z',
      },
      {
        id: 'alert-control-open', runId, participantId: fixture.control.id,
        groupId: fixture.control.groupId, type: 'student_help', status: 'open',
        resolution: '', createdAt: '2026-08-13T01:04:00.000Z', updatedAt: '2026-08-13T01:04:00.000Z',
      },
    );
  });
}

function resetUrl(fixture, participant = fixture.target) {
  return `/api/teacher/runs/${fixture.run.id}/participants/${participant.id}/reset-learning`;
}

function teacherHeaders(token = teacherToken) {
  return { authorization: `Bearer ${token}` };
}

test('教师可一键清零单学生全部学习态，原链接从导入任务干净重入', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());

  const historicalTargetSessionA = await createSession(fixture, fixture.target);
  const historicalTargetSessionB = await createSession(fixture, fixture.target);
  const targetSession = await createSession(fixture, fixture.target);
  const controlSession = await createSession(fixture, fixture.control);
  const targetRole = fixture.course.roles[0];
  const controlRole = fixture.course.roles[1];
  const historicalRoleA = fixture.course.roles[2];
  const historicalRoleB = fixture.course.roles[3];
  const targetMarker = 'RESET-TARGET-PRIVATE-DIALOGUE';
  const historicalMarkerA = 'RESET-TARGET-HISTORICAL-PHASE-3';
  const historicalMarkerB = 'RESET-TARGET-HISTORICAL-PHASE-4';
  const controlMarker = 'RESET-CONTROL-MUST-SURVIVE';
  await seedHistoricalLearning(
    fixture,
    historicalTargetSessionA,
    historicalRoleA,
    'phase-3',
    historicalMarkerA,
  );
  await seedHistoricalLearning(
    fixture,
    historicalTargetSessionB,
    historicalRoleB,
    'phase-4',
    historicalMarkerB,
  );
  await seedStartedLearning(fixture, fixture.target, targetSession, targetRole, targetMarker);
  const controlStoredBefore = await seedStartedLearning(
    fixture,
    fixture.control,
    controlSession,
    controlRole,
    controlMarker,
  );
  await seedResetSideEffects(fixture);
  const targetSessionIds = [historicalTargetSessionA.id, historicalTargetSessionB.id, targetSession.id];

  const before = await fixture.runtime.getSnapshot(fixture.run.id);
  const targetBefore = before.participants.find((item) => item.id === fixture.target.id);
  const controlBefore = before.participants.find((item) => item.id === fixture.control.id);
  const targetCredentialBefore = fixture.credentials.get(fixture.target.id);

  for (const headers of [{}, teacherHeaders('wrong-teacher-token')]) {
    const unauthorized = await fixture.app.inject({
      method: 'POST', url: resetUrl(fixture), headers,
    });
    assert.equal(unauthorized.statusCode, 401);
    for (const sessionId of targetSessionIds) assert.ok(await fixture.sessionStore.get(sessionId));
  }

  const reset = await fixture.app.inject({
    method: 'POST',
    url: resetUrl(fixture),
    headers: teacherHeaders(),
  });
  assert.equal(reset.statusCode, 200, reset.body);
  assert.equal(reset.headers['cache-control'], 'no-store');
  assert.equal(reset.json().participantId, fixture.target.id);
  assert.equal(reset.json().previousSessionId, targetSession.id);
  assert.equal(reset.json().sessionId, null);
  assert.equal(reset.json().alreadyReset, false);
  for (const sessionId of targetSessionIds) {
    assert.equal(
      await fixture.sessionStore.get(sessionId),
      null,
      '同一学生的当前与历史进度、对话必须连同 session 删除',
    );
  }

  const after = await fixture.runtime.getSnapshot(fixture.run.id);
  const targetAfter = after.participants.find((item) => item.id === fixture.target.id);
  const controlAfter = after.participants.find((item) => item.id === fixture.control.id);
  assert.equal(targetAfter.learnerSessionId, null);
  assert.equal(targetAfter.name, targetBefore.name);
  assert.equal(targetAfter.groupId, targetBefore.groupId);
  assert.equal(targetAfter.rosterAssigned, true);
  assert.equal(targetAfter.roleId, '');
  assert.equal(targetAfter.roleName, '');
  assert.equal(targetAfter.roleClaimedAt, null);
  assert.equal(targetAfter.roleClaimSource, '');
  assert.equal(targetAfter.device.roleClaimed, false);
  assert.equal(targetAfter.online, false);
  assert.equal(targetAfter.presenceObservedAt, null);
  assert.equal(targetAfter.device.loggedIn, false);
  assert.equal(targetAfter.device.network, 'offline');
  assert.equal(targetAfter.device.location, 'unknown');
  assert.equal(targetAfter.device.camera, 'unknown');
  assert.equal(targetAfter.device.cameraObservedAt, null);
  assert.equal(targetAfter.location.lng, null);
  assert.equal(targetAfter.location.lat, null);
  assert.equal(targetAfter.location.accuracyMeters, null);
  assert.equal(targetAfter.location.insideFence, null);
  assert.equal(targetAfter.location.permission, 'unknown');
  assert.equal(targetAfter.locationObservedAt, null);
  assert.equal(targetAfter.latestDirective, null);
  assert.equal(targetAfter.learning.progress, 0);
  assert.equal(targetAfter.learning.currentTask, '待开始');
  assert.equal(targetAfter.learning.currentTaskId, '');
  assert.equal(targetAfter.learning.currentStepId, '');
  assert.equal(targetAfter.learning.evidenceCount, 0);
  assert.equal(targetAfter.learning.dialogueSummary, '');
  assert.equal(targetAfter.learning.timeBalance, 0);
  assert.equal(targetAfter.learning.scaffoldLevel, 0);
  assert.equal(after.run.rolesReleased, before.run.rolesReleased);
  assert.equal(after.run.rolesLocked, before.run.rolesLocked);
  assert.deepEqual(controlAfter, controlBefore, '控制学生投影不得被单人重置改写');
  assert.deepEqual(await fixture.sessionStore.get(controlSession.id), controlStoredBefore);
  const internalParticipant = fixture.courseRunStore.state.runs
    .find((item) => item.id === fixture.run.id)
    .participants.find((item) => item.id === fixture.target.id);
  assert.deepEqual(
    [...internalParticipant.retiredLearnerSessionIds].sort(),
    [...targetSessionIds].sort(),
    '全部历史会话都必须进入墓碑列表，防止旧页面重新激活',
  );

  const preflightAfter = await fixture.runtime.preflight(fixture.run.id);
  assert.equal(
    preflightAfter.joinCredentials.find((item) => item.participantId === fixture.target.id)?.joinCredential,
    targetCredentialBefore,
    '专属链接凭证应保留',
  );
  const review = await fixture.runtime.getReview(fixture.run.id);
  assert.ok(review.auditEvents.some((item) => (
    item.action === 'participant.learning_reset'
      && item.subject?.participantId === fixture.target.id
      && item.reason === '教师一键清零学生学习记录'
  )));
  assert.equal(JSON.stringify(review).includes(targetMarker), false, '审计不复制已删除的对话原文');
  assert.equal(JSON.stringify(review).includes(historicalMarkerA), false);
  assert.equal(JSON.stringify(review).includes(historicalMarkerB), false);
  assert.equal(JSON.stringify(review).includes(controlMarker), true, '控制学生学习摘要应保留');
  const storedRunState = await fixture.courseRunStore.read();
  const targetAlerts = storedRunState.alerts.filter((item) => item.participantId === fixture.target.id);
  assert.ok(targetAlerts.every((item) => ['resolved', 'false_alarm'].includes(item.status)));
  for (const alert of targetAlerts.filter((item) => item.id !== 'alert-target-terminal')) {
    assert.equal(alert.status, 'resolved');
    assert.equal(alert.resolution, '教师一键清零学生学习记录');
    assert.equal(alert.updatedAt, reset.json().resetAt);
  }
  assert.equal(storedRunState.alerts.find((item) => item.id === 'alert-target-terminal').status, 'false_alarm');
  assert.equal(storedRunState.alerts.find((item) => item.id === 'alert-control-open').status, 'open');
  assert.equal(
    storedRunState.receipts.find((item) => item.commandId === 'cmd-target-reset').status,
    'failed',
  );
  assert.equal(
    storedRunState.receipts.find((item) => item.commandId === 'cmd-control-keep').status,
    'accepted',
  );

  for (const [index, sessionId] of targetSessionIds.entries()) {
    const oldLookup = await fixture.app.inject({ method: 'GET', url: `/api/sessions/${sessionId}` });
    assert.equal(oldLookup.statusCode, 404);
    const oldActivate = await fixture.app.inject({
      method: 'POST', url: `/api/sessions/${sessionId}/activate`, payload: {},
    });
    assert.equal(oldActivate.statusCode, 404);
    const oldTurn = await fixture.app.inject({
      method: 'POST',
      url: '/api/agent/turn',
      payload: {
        sessionId,
        requestId: `turn-after-learning-reset-${index}`,
        input: { type: 'user_text', text: '旧页面不应继续写入' },
      },
    });
    assert.equal(oldTurn.statusCode, 200, oldTurn.body);
    assert.match(oldTurn.body, /event: agent\.error/);
    assert.match(oldTurn.body, /"code":"AGENT_TURN_FAILED"/);
    assert.equal(await fixture.sessionStore.get(sessionId), null, '旧 turn 不得复活已删除会话');
  }

  const missingResume = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.target.id,
      courseId: fixture.course.id,
      joinCredential: targetCredentialBefore,
    },
  });
  assert.equal(missingResume.statusCode, 404);
  assert.equal(missingResume.json().code, 'SESSION_RESUME_NOT_FOUND');
  const afterMissingResume = await fixture.runtime.getSnapshot(fixture.run.id);
  const targetAfterMissingResume = afterMissingResume.participants
    .find((item) => item.id === fixture.target.id);
  assert.equal(targetAfterMissingResume.learnerSessionId, null);
  assert.equal(targetAfterMissingResume.online, false, '无会话 resume 不等于学生已到课');
  assert.equal(targetAfterMissingResume.presenceObservedAt, null);
  assert.equal(targetAfterMissingResume.device.loggedIn, false);
  assert.equal(targetAfterMissingResume.device.network, 'offline');
  assert.equal(targetAfterMissingResume.locationObservedAt, null);

  const reentered = await createSession(fixture, fixture.target);
  assert.notEqual(reentered.id, targetSession.id);
  assert.equal(reentered.roleId, '');
  assert.equal(reentered.currentTaskIndex, 0);
  assert.deepEqual(reentered.completedTaskIds, []);
  assert.equal(reentered.phaseTaskContext.taskId, fixture.course.phaseTracks[reentered.phaseId].tasks[0].id);
  const resumedFresh = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.target.id,
      courseId: fixture.course.id,
      joinCredential: targetCredentialBefore,
    },
  });
  assert.equal(resumedFresh.statusCode, 200, resumedFresh.body);
  assert.equal(resumedFresh.json().id, reentered.id);
  assert.equal(resumedFresh.json().runtime.task.guidanceStepIndex, 0);
  assert.deepEqual(resumedFresh.json().dialogueHistory, []);
  assert.equal(resumedFresh.json().teacherRunState.claimedRoleId, '');

  await fixture.courseRunStore.transaction((state) => {
    const run = state.runs.find((item) => item.id === fixture.run.id);
    run.status = 'completed';
    run.version += 1;
  });
  const completedReset = await fixture.app.inject({
    method: 'POST',
    url: resetUrl(fixture, fixture.control),
    headers: teacherHeaders(),
  });
  assert.equal(completedReset.statusCode, 409);
  assert.equal(completedReset.json().code, 'COURSE_RUN_COMPLETED');
  assert.deepEqual(await fixture.sessionStore.get(controlSession.id), controlStoredBefore);
});

test('session 已写入但尚未 bind 时遇到清零，create 不得恢复被删会话或留下 stale binding', async (t) => {
  const fixture = await harness();
  t.after(() => fixture.app.close());

  const originalSession = await createSession(fixture, fixture.target);
  const credential = fixture.credentials.get(fixture.target.id);
  const barrier = fixture.sessionStore.armNextSaveBarrier();
  t.after(() => barrier.release());

  const racingCreatePromise = fixture.app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: sessionPayload(fixture, fixture.target),
  });
  const racingSessionId = await barrier.entered;
  assert.notEqual(racingSessionId, originalSession.id);
  assert.ok(await fixture.sessionStore.get(racingSessionId), '竞态会话已 INSERT/save，但此时尚未绑定到 runtime');

  const beforeReset = await fixture.runtime.getSnapshot(fixture.run.id);
  assert.equal(
    beforeReset.participants.find((item) => item.id === fixture.target.id).learnerSessionId,
    originalSession.id,
    '新会话 bind 之前 runtime 仍指向原会话',
  );
  const reset = await fixture.app.inject({
    method: 'POST',
    url: resetUrl(fixture),
    headers: teacherHeaders(),
  });
  assert.equal(reset.statusCode, 200, reset.body);
  assert.equal(reset.json().previousSessionId, originalSession.id);
  assert.equal(await fixture.sessionStore.get(originalSession.id), null);
  assert.equal(await fixture.sessionStore.get(racingSessionId), null);

  barrier.release();
  const racingCreate = await racingCreatePromise;
  assert.equal(racingCreate.statusCode, 409, racingCreate.body);
  assert.equal(racingCreate.json().code, 'COURSE_SESSION_RESET');
  assert.equal(await fixture.sessionStore.get(racingSessionId), null, '失败 create 不得把竞态会话重新写回 store');

  const afterRace = await fixture.runtime.getSnapshot(fixture.run.id);
  const targetAfterRace = afterRace.participants.find((item) => item.id === fixture.target.id);
  assert.equal(targetAfterRace.learnerSessionId, null);
  assert.equal(targetAfterRace.roleId, '');
  assert.equal(targetAfterRace.online, false);
  const internalTarget = fixture.courseRunStore.state.runs
    .find((item) => item.id === fixture.run.id)
    .participants.find((item) => item.id === fixture.target.id);
  assert.ok(internalTarget.retiredLearnerSessionIds.includes(originalSession.id));
  assert.ok(internalTarget.retiredLearnerSessionIds.includes(racingSessionId));

  for (const sessionId of [originalSession.id, racingSessionId]) {
    const activate = await fixture.app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/activate`,
      payload: {},
    });
    assert.equal(activate.statusCode, 404);
  }

  const cleanSession = await createSession(fixture, fixture.target);
  assert.notEqual(cleanSession.id, racingSessionId);
  assert.equal(cleanSession.roleId, '');
  assert.equal(cleanSession.currentTaskIndex, 0);
  const cleanResume = await fixture.app.inject({
    method: 'POST',
    url: '/api/sessions/resume',
    payload: {
      runId: fixture.run.id,
      participantId: fixture.target.id,
      courseId: fixture.course.id,
      joinCredential: credential,
    },
  });
  assert.equal(cleanResume.statusCode, 200, cleanResume.body);
  assert.equal(cleanResume.json().id, cleanSession.id);
  assert.deepEqual(cleanResume.json().dialogueHistory, []);
  assert.equal(cleanResume.json().runtime.task.guidanceStepIndex, 0);
});
