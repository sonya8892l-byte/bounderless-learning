import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileCourse } from '../server/course/compiler.js';
import { createCourseRunService } from '../server/runtime/course-run-service.js';
import { createCourseRunStore } from '../server/runtime/course-run-store.js';
import { registerRuntimeRoutes } from '../server/runtime/routes.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

async function fixture(t, { status = 'active' } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-presence-integrity-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const getCourse = (courseId) => compileCourse({ lessonsRoot, courseId });
  const service = createCourseRunService({
    store: createCourseRunStore({ baseDir: directory }),
    getCourse,
    realtime: { publish() {}, subscribe() { return () => undefined; } },
  });
  const run = await service.createRun({ courseId: 'lesson_gewu_001', status });
  return { getCourse, run, service };
}

function projection(run, participant, sessionId, overrides = {}) {
  return {
    sessionId,
    runId: run.id,
    participantId: participant.id,
    progress: 0,
    currentTask: '权威当前任务',
    currentTaskId: participant.roleTaskId || '',
    currentStepId: 'trusted-step-1',
    currentStepName: '权威当前小步',
    currentStepCompletionMode: 'ai_evaluation',
    currentStepAttempts: 3,
    currentStepMaxAttempts: 3,
    taskFinalizationStatus: 'collecting_steps',
    teacherApprovalAllowed: true,
    teacherApprovalKind: 'ai_max_attempts',
    pendingAdvanceMode: '',
    evidenceCount: 0,
    idleSeconds: 3,
    lastMeaningfulActionAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

async function participant(service, runId, participantId) {
  return (await service.getSnapshot(runId)).participants.find((item) => item.id === participantId);
}

test('正式新场次不预造已登录、设备权限、GPS 和学习进度', async (t) => {
  const { run, service } = await fixture(t, { status: 'draft' });
  const snapshot = await service.getSnapshot(run.id);

  assert.ok(snapshot.participants.length > 0);
  assert.equal(snapshot.summary.online, 0);
  assert.equal(snapshot.summary.averageProgress, 0);
  for (const item of snapshot.participants) {
    assert.match(item.name, /^学习者\d+$/u);
    assert.equal(item.rosterAssigned, false);
    assert.equal(item.online, false);
    assert.equal(item.presenceObservedAt, null);
    assert.equal(item.device.loggedIn, false);
    assert.equal(item.device.roleClaimed, false);
    assert.equal(item.device.location, 'unknown');
    assert.equal(item.device.camera, 'unknown');
    assert.equal(item.device.cameraObservedAt, null);
    assert.equal(item.device.network, 'offline');
    assert.equal(item.location.lng, null);
    assert.equal(item.location.lat, null);
    assert.equal(item.location.accuracyMeters, null);
    assert.equal(item.location.insideFence, null);
    assert.equal(item.locationObservedAt, null);
    assert.equal(item.positionAgeSeconds, null);
    assert.equal(item.positionStatus, 'unknown');
    assert.equal(item.learning.progress, 0);
    assert.equal(item.learning.currentTaskId, '');
    assert.equal(item.learning.currentStepId, '');
    assert.equal(item.learning.evidenceCount, 0);
  }

  const preflight = await service.preflight(run.id);
  assert.equal(preflight.ready, false);
  assert.equal(preflight.checks.find((check) => check.id === 'roster').passed, false);
  assert.equal(preflight.checks.find((check) => check.id === 'permissions').passed, false);

  await service.bindLearnerSession({
    runId: run.id,
    participantId: snapshot.participants[0].id,
    sessionId: 'ses_without_imported_roster',
  });
  const afterLogin = await service.preflight(run.id);
  assert.equal(
    afterLogin.checks.find((check) => check.id === 'roster').passed,
    false,
    '中性占位名不是真实名单，即使会话已登录也不能让名单检查通过',
  );
});

test('教师重检不伪造相机权限，只有学生设备实际上报才变为 ready', async (t) => {
  const { run, service } = await fixture(t);
  const target = (await service.getSnapshot(run.id)).participants[0];
  const sessionId = 'ses_camera_permission_integrity';
  await service.bindLearnerSession({ runId: run.id, participantId: target.id, sessionId });

  await service.updateParticipant(run.id, target.id, {
    recheckDevice: true,
    actorId: 'teacher-demo',
    reason: '请学生重新检查设备',
  });
  let current = await participant(service, run.id, target.id);
  assert.equal(current.device.camera, 'checking');
  assert.equal(current.device.location, 'checking');

  await service.reportPresence(sessionId, { camera: { permission: 'granted' } });
  current = await participant(service, run.id, target.id);
  assert.equal(current.device.camera, 'ready');
  assert.ok(Number.isFinite(Date.parse(current.device.cameraObservedAt)));

  await service.reportPresence(sessionId, { camera: { permission: 'denied' } });
  current = await participant(service, run.id, target.id);
  assert.equal(current.device.camera, 'attention');
});

test('心跳时间与定位采样时间分离，拒绝定位和无坐标心跳不刷新 GPS', async (t) => {
  const { getCourse, run, service } = await fixture(t);
  const initial = (await service.getSnapshot(run.id)).participants[0];
  const course = await getCourse(run.courseId);
  const role = course.roles.find((item) => item.tasks.some((task) => Array.isArray(task.location?.coordinates)));
  const task = role.tasks.find((item) => Array.isArray(item.location?.coordinates));
  const sessionId = 'ses_location_integrity';
  await service.updateParticipant(run.id, initial.id, {
    roleId: role.id,
    actorId: 'teacher-demo',
    reason: '定位诚信测试分配角色',
  });
  await service.bindLearnerSession({
    runId: run.id,
    participantId: initial.id,
    sessionId,
    roleId: role.id,
  });
  const trusted = projection(run, { ...initial, roleTaskId: task.id }, sessionId, {
    roleId: role.id,
    currentTask: task.name,
    currentTaskId: task.id,
    currentStepId: task.steps?.[0]?.id || '',
  });

  await service.reportPresence(sessionId, {
    online: true,
    location: {
      permission: 'granted',
      lng: Number(task.location.coordinates[0]) + 1,
      lat: Number(task.location.coordinates[1]) + 1,
      accuracyMeters: 8,
      insideFence: true,
    },
  }, { trustedLearningProjection: trusted });
  const located = await participant(service, run.id, initial.id);
  assert.equal(located.positionStatus, 'fresh');
  assert.equal(located.location.insideFence, false, '客户端伪造 insideFence=true 不能覆盖服务端围栏计算');
  const firstLocationAt = located.locationObservedAt;
  const firstPresenceAt = located.presenceObservedAt;

  await new Promise((resolve) => setTimeout(resolve, 5));
  await service.reportPresence(sessionId, { online: false, network: 'offline' }, {
    trustedLearningProjection: trusted,
  });
  const heartbeatOnly = await participant(service, run.id, initial.id);
  assert.equal(heartbeatOnly.online, false);
  assert.equal(heartbeatOnly.locationObservedAt, firstLocationAt);
  assert.ok(Date.parse(heartbeatOnly.presenceObservedAt) >= Date.parse(firstPresenceAt));

  await new Promise((resolve) => setTimeout(resolve, 5));
  await service.reportPresence(sessionId, {
    location: {
      permission: 'denied',
      // 即使恶意客户端把旧坐标一起传回，denied 也不是新 GPS 样本。
      lng: task.location.coordinates[0],
      lat: task.location.coordinates[1],
      insideFence: true,
    },
  }, { trustedLearningProjection: trusted });
  const denied = await participant(service, run.id, initial.id);
  assert.equal(denied.device.location, 'attention');
  assert.equal(denied.location.permission, 'denied');
  assert.equal(denied.locationObservedAt, firstLocationAt);
  assert.equal(denied.location.insideFence, false);

  await new Promise((resolve) => setTimeout(resolve, 5));
  await service.reportPresence(sessionId, {
    location: {
      permission: 'granted',
      lng: task.location.coordinates[0],
      lat: task.location.coordinates[1],
      accuracyMeters: 6,
      insideFence: false,
    },
  }, { trustedLearningProjection: trusted });
  const fresh = await participant(service, run.id, initial.id);
  assert.ok(Date.parse(fresh.locationObservedAt) > Date.parse(firstLocationAt));
  assert.equal(fresh.location.insideFence, true, '客户端伪造 insideFence=false 也不影响服务端计算');
});

test('客户端伪造学习字段无效，暂停、集合和结课后冻结权威学习投影', async (t) => {
  const { run, service } = await fixture(t);
  const initialSnapshot = await service.getSnapshot(run.id);
  const target = initialSnapshot.participants[0];
  const sessionId = 'ses_learning_projection_integrity';
  await service.bindLearnerSession({ runId: run.id, participantId: target.id, sessionId });
  const baselineProjection = projection(run, target, sessionId, {
    progress: 17,
    currentTask: '服务端任务',
    currentTaskId: 'trusted-task',
    currentStepId: 'trusted-step',
    evidenceCount: 2,
  });
  await service.reportPresence(sessionId, {
    progress: 100,
    currentTask: '伪造任务',
    currentTaskId: 'forged-task',
    currentStepId: 'forged-step',
    evidenceCount: 99,
    idleSeconds: 99_999,
  }, { trustedLearningProjection: baselineProjection });
  let current = await participant(service, run.id, target.id);
  assert.deepEqual({
    progress: current.learning.progress,
    currentTask: current.learning.currentTask,
    currentTaskId: current.learning.currentTaskId,
    currentStepId: current.learning.currentStepId,
    currentStepName: current.learning.currentStepName,
    currentStepCompletionMode: current.learning.currentStepCompletionMode,
    currentStepAttempts: current.learning.currentStepAttempts,
    currentStepMaxAttempts: current.learning.currentStepMaxAttempts,
    teacherApprovalAllowed: current.learning.teacherApprovalAllowed,
    teacherApprovalKind: current.learning.teacherApprovalKind,
    evidenceCount: current.learning.evidenceCount,
  }, {
    progress: 17,
    currentTask: '服务端任务',
    currentTaskId: 'trusted-task',
    currentStepId: 'trusted-step',
    currentStepName: '权威当前小步',
    currentStepCompletionMode: 'ai_evaluation',
    currentStepAttempts: 3,
    currentStepMaxAttempts: 3,
    teacherApprovalAllowed: true,
    teacherApprovalKind: 'ai_max_attempts',
    evidenceCount: 2,
  });

  let snapshot = await service.getSnapshot(run.id);
  await service.sendCommand(run.id, {
    actorId: 'teacher-demo',
    idempotencyKey: 'pause-presence-integrity',
    expectedVersion: snapshot.run.version,
    action: 'pause',
    target: { scope: 'all' },
    payload: {},
    reason: '测试暂停期间投影冻结',
  });
  await service.reportPresence(sessionId, {}, {
    trustedLearningProjection: { ...baselineProjection, progress: 88, evidenceCount: 8 },
  });
  current = await participant(service, run.id, target.id);
  assert.equal(current.learning.progress, 17);
  assert.equal(current.learning.evidenceCount, 2);

  snapshot = await service.getSnapshot(run.id);
  await service.sendCommand(run.id, {
    actorId: 'teacher-demo',
    idempotencyKey: 'rally-presence-integrity',
    expectedVersion: snapshot.run.version,
    action: 'emergency_rally',
    target: { scope: 'all' },
    payload: { rallyPoint: '集合点' },
    reason: '测试集合期间投影冻结',
  });
  await service.reportPresence(sessionId, {}, {
    trustedLearningProjection: { ...baselineProjection, progress: 89, evidenceCount: 9 },
  });
  current = await participant(service, run.id, target.id);
  assert.equal(current.learning.progress, 17);
  assert.equal(current.learning.evidenceCount, 2);

  snapshot = await service.getSnapshot(run.id);
  await service.sendCommand(run.id, {
    actorId: 'teacher-demo',
    idempotencyKey: 'resume-presence-integrity',
    expectedVersion: snapshot.run.version,
    action: 'resume',
    target: { scope: 'all' },
    payload: {},
    reason: '结课前恢复场次',
  });
  snapshot = await service.getSnapshot(run.id);
  await service.sendCommand(run.id, {
    actorId: 'teacher-demo',
    idempotencyKey: 'end-presence-integrity',
    expectedVersion: snapshot.run.version,
    action: 'end_run',
    target: { scope: 'all' },
    payload: {},
    reason: '测试结课后投影冻结',
  });
  await service.reportPresence(sessionId, {}, {
    trustedLearningProjection: { ...baselineProjection, progress: 100, evidenceCount: 99 },
  });
  current = await participant(service, run.id, target.id);
  assert.equal(current.learning.progress, 17);
  assert.equal(current.learning.evidenceCount, 2);
});

test('学生端定时定位只在已授权时取新样本，并在关键会话节点立即触发投影', async () => {
  const source = await fs.readFile(path.join(projectRoot, 'src/app-controller.js'), 'utf8');
  assert.match(source, /navigator\.permissions\.query\(\{ name: 'geolocation' \}\)/u);
  assert.match(source, /permission\.state !== 'granted'[\s\S]{0,120}return/u);
  assert.match(source, /maximumAge: 0/u);
  assert.match(source, /state\.updated[\s\S]{0,9000}reportCurrentPresence\(\{ owner: role, track: roleState \}\)/u);
  const roleSelection = source.slice(
    source.indexOf('async function performRoleSelection'),
    source.indexOf('function renderHeader'),
  );
  assert.match(roleSelection, /activateAgentSession\(/u);
  assert.match(roleSelection, /reportCurrentPresence\(\{ owner: role, track: roleState \}\)/u);
  assert.match(source, /resumeConnectedLearningSession\([\s\S]{0,5000}reportCurrentPresence/u);
  const reporter = source.slice(
    source.indexOf('async function reportCurrentPresence'),
    source.indexOf('async function sendContextTick'),
  );
  assert.doesNotMatch(reporter, /\bprogress\s*:/u);
  assert.doesNotMatch(reporter, /\bevidenceCount\s*:/u);
  assert.doesNotMatch(reporter, /\bcurrentTaskId\s*:/u);
});

test('presence HTTP 边界严格拒绝客户端学习投影和 insideFence', async () => {
  const handlers = new Map();
  const app = {
    addHook() {},
    get() {},
    patch() {},
    post(route, ...args) { handlers.set(route, args.at(-1)); },
  };
  let captured = null;
  const trustedLearningProjection = {
    sessionId: 'ses-route',
    runId: 'run-route',
    participantId: 'student-route',
    progress: 0,
  };
  await registerRuntimeRoutes(app, {
    enableDemo: false,
    enableWebsocket: false,
    runtime: {
      reportPresence(sessionId, body, options) {
        captured = { sessionId, body, options };
        return { ok: true };
      },
    },
    resolveLearnerProjection: async () => trustedLearningProjection,
  });
  const handler = handlers.get('/api/student/sessions/:sessionId/presence');
  const request = (body) => ({ params: { sessionId: 'ses-route' }, body });

  await assert.rejects(() => handler(request({ progress: 100 }), {}));
  await assert.rejects(() => handler(request({ evidenceCount: 99 }), {}));
  await assert.rejects(() => handler(request({
    location: { permission: 'granted', lng: 116.4, lat: 39.9, insideFence: true },
  }), {}));

  await handler(request({
    online: true,
    camera: { permission: 'granted' },
    location: { permission: 'granted', lng: 116.4, lat: 39.9, accuracyMeters: 8 },
  }), {});
  assert.deepEqual(captured, {
    sessionId: 'ses-route',
    body: {
      online: true,
      camera: { permission: 'granted' },
      location: { permission: 'granted', lng: 116.4, lat: 39.9, accuracyMeters: 8 },
    },
    options: { trustedLearningProjection },
  });
});

test('确认到达只接受当前会话中 60 秒内且未变化的定位快照', async (t) => {
  const { run, service } = await fixture(t);
  const snapshot = await service.getSnapshot(run.id);
  const target = snapshot.participants[0];
  const sessionId = 'ses_arrival_snapshot_integrity';
  await service.bindLearnerSession({ runId: run.id, participantId: target.id, sessionId });

  const sendConfirmation = async (idempotencyKey) => {
    const current = await service.getSnapshot(run.id);
    return service.sendCommand(run.id, {
      actorId: 'teacher-demo',
      idempotencyKey,
      expectedVersion: current.run.version,
      action: 'confirm_arrival',
      target: { scope: 'participant', id: target.id },
      payload: {},
      reason: '核对定位快照时效',
    });
  };

  const missing = await sendConfirmation('arrival-snapshot-missing');
  await assert.rejects(
    service.assertCommandTargetCurrent(sessionId, missing.id),
    (error) => error.code === 'TEACHER_LOCATION_SNAPSHOT_STALE',
  );

  await service.reportPresence(sessionId, {
    location: { permission: 'granted', lng: 116.4, lat: 39.9, accuracyMeters: 10 },
  });
  const currentCommand = await sendConfirmation('arrival-snapshot-current');
  assert.equal(await service.assertCommandTargetCurrent(sessionId, currentCommand.id), true);

  await new Promise((resolve) => setTimeout(resolve, 5));
  await service.reportPresence(sessionId, {
    location: { permission: 'granted', lng: 116.4001, lat: 39.9001, accuracyMeters: 10 },
  });
  await assert.rejects(
    service.assertCommandTargetCurrent(sessionId, currentCommand.id),
    (error) => error.code === 'TEACHER_LOCATION_SNAPSHOT_STALE',
  );
});
