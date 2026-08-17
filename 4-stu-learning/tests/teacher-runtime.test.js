import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileCourse } from '../server/course/compiler.js';
import { createCourseRunService } from '../server/runtime/course-run-service.js';
import { createCourseRunStore } from '../server/runtime/course-run-store.js';
import { createEvidenceStore } from '../server/services/evidence-store.js';
import { createRuntimeTeacherCommandConsumer } from '../server/app.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

async function fixture({ requireJoinCredential = false } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-runtime-'));
  const events = [];
  const realtime = {
    publish(runId, event) { events.push({ runId, event }); },
    subscribe() { return () => undefined; },
  };
  const service = createCourseRunService({
    store: createCourseRunStore({ baseDir: directory }),
    getCourse: (courseId) => compileCourse({ lessonsRoot, courseId }),
    realtime,
    requireJoinCredential,
  });
  return { directory, events, service };
}

function commandInput(snapshot, overrides = {}) {
  const participant = snapshot.participants[0];
  return {
    actorId: 'teacher-demo',
    idempotencyKey: `idem-${crypto.randomUUID()}`,
    expectedVersion: snapshot.run.version,
    action: 'send_notice',
    target: { scope: 'participant', id: participant.id },
    payload: {},
    reason: '测试教师指令',
    ...overrides,
  };
}

async function sendAndRefresh(service, runId, snapshot, overrides = {}) {
  const result = await service.sendCommand(runId, commandInput(snapshot, overrides));
  const next = await service.getSnapshot(runId);
  return { result, snapshot: next };
}

function participantById(snapshot, participantId) {
  return snapshot.participants.find((item) => item.id === participantId);
}

function participantsWithDirective(snapshot, commandId) {
  return snapshot.participants.filter((item) => item.latestDirective?.commandId === commandId);
}

test('教师场次以小组组织六个角色，不将角色当成小组', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  assert.equal(snapshot.groups.length, 5);
  assert.equal(snapshot.participants.length, 30);
  for (const group of snapshot.groups) {
    assert.equal(group.members.length, 6);
    assert.equal(new Set(group.members.map((member) => member.roleId)).size, 6);
  }
});

test('小组密符按服务端可信角色完成度统计，集齐后只提示教师核对', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  let snapshot = await service.getSnapshot(run.id);
  const initialPhaseId = snapshot.run.phaseId;
  const group = snapshot.groups[0];
  assert.equal(group.collectionTotal, 6);
  assert.equal(group.collectionReady, false);

  for (const participant of group.members) {
    const sessionId = `ses_collection_${participant.id}`;
    await service.bindLearnerSession({
      runId: run.id,
      participantId: participant.id,
      sessionId,
      roleId: participant.roleId,
    });
    await service.reportPresence(sessionId, { online: true }, {
      trustedLearningProjection: {
        sessionId,
        runId: run.id,
        participantId: participant.id,
        roleId: participant.roleId,
        progress: 100,
        evidenceCount: 1,
        currentTask: '角色任务已完成',
        currentTaskId: 'completed-task',
        currentStepId: 'completed-step',
        idleSeconds: 0,
        lastMeaningfulActionAt: new Date().toISOString(),
      },
    });
  }

  snapshot = await service.getSnapshot(run.id);
  const completedGroup = snapshot.groups[0];
  assert.equal(completedGroup.collectionCount, 6);
  assert.equal(completedGroup.collectionTotal, 6);
  assert.equal(completedGroup.collectionReady, true);
  assert.equal(snapshot.run.phaseId, initialPhaseId);
});

test('指定场次只按 participantId 绑定，会话可安全重新激活', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const initial = await service.getSnapshot(run.id);
  const participant = initial.participants[0];

  await assert.rejects(
    service.bindLearnerSession({
      runId: run.id,
      groupId: participant.groupId,
      roleId: participant.roleId,
      sessionId: 'ses_group_role_only',
    }),
    (error) => error.statusCode === 422,
  );
  await assert.rejects(
    service.bindLearnerSession({
      runId: run.id,
      participantId: 'student-not-in-this-run',
      groupId: participant.groupId,
      roleId: participant.roleId,
      sessionId: 'ses_invalid_participant',
    }),
    (error) => error.statusCode === 422,
  );

  await service.bindLearnerSession({
    runId: run.id,
    participantId: participant.id,
    sessionId: 'ses_role_a',
    roleId: participant.roleId,
  });
  await service.bindLearnerSession({
    runId: run.id,
    participantId: participant.id,
    sessionId: 'ses_role_b',
    roleId: participant.roleId,
  });
  assert.equal(
    participantById(await service.getSnapshot(run.id), participant.id).learnerSessionId,
    'ses_role_b',
  );

  await service.activateLearnerSession({
    runId: run.id,
    participantId: participant.id,
    sessionId: 'ses_role_a',
    roleId: participant.roleId,
  });
  assert.equal(
    participantById(await service.getSnapshot(run.id), participant.id).learnerSessionId,
    'ses_role_a',
  );
  await assert.rejects(
    service.activateLearnerSession({ participantId: participant.id, sessionId: 'ses_untrusted' }),
    (error) => error.statusCode === 422,
  );
});

test('教师 runtime 按完整身份返回当前可恢复 session', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  const [participant, neverStarted] = snapshot.participants;
  await service.bindLearnerSession({
    runId: run.id,
    participantId: participant.id,
    courseId: run.courseId,
    sessionId: 'ses_resume_runtime',
    roleId: participant.roleId,
  });

  const resumed = await service.resumeLearnerSession({
    runId: run.id,
    participantId: participant.id,
    courseId: run.courseId,
  });
  assert.equal(resumed.sessionId, 'ses_resume_runtime');
  assert.equal(resumed.runId, run.id);
  assert.equal(resumed.participantId, participant.id);
  assert.equal(resumed.courseId, run.courseId);
  assert.equal(resumed.runState.status, run.status);

  const empty = await service.resumeLearnerSession({
    runId: run.id,
    participantId: neverStarted.id,
    courseId: run.courseId,
  });
  assert.equal(empty.sessionId, null);
  await assert.rejects(
    service.resumeLearnerSession({
      runId: run.id,
      participantId: participant.id,
      courseId: 'lesson_zhizhi_001',
    }),
    (error) => error.statusCode === 422,
  );
});

test('runtime 用 participant 专属凭证阻止可预测 ID 抢绑', async (t) => {
  const { directory, service } = await fixture({ requireJoinCredential: true });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ courseId: 'lesson_gewu_001', status: 'active' });
  const snapshot = await service.getSnapshot(run.id);
  const [owner, other] = snapshot.participants;
  const credentials = (await service.preflight(run.id)).joinCredentials;
  const ownerCredential = credentials.find((item) => item.participantId === owner.id)?.joinCredential;
  const otherCredential = credentials.find((item) => item.participantId === other.id)?.joinCredential;

  await assert.rejects(
    service.validateLearnerBinding({
      runId: run.id,
      participantId: owner.id,
      courseId: run.courseId,
    }),
    (error) => error.statusCode === 401 && error.code === 'JOIN_CREDENTIAL_REQUIRED',
  );
  await assert.rejects(
    service.validateLearnerBinding({
      runId: run.id,
      participantId: owner.id,
      courseId: run.courseId,
      joinCredential: otherCredential,
    }),
    (error) => error.statusCode === 403 && error.code === 'JOIN_CREDENTIAL_INVALID',
  );
  const valid = await service.validateLearnerBinding({
    runId: run.id,
    participantId: owner.id,
    courseId: run.courseId,
    joinCredential: ownerCredential,
  });
  assert.equal(valid.participantId, owner.id);
  assert.equal(snapshot.run.joinCredentialSecret, undefined);
  assert.ok(ownerCredential.length >= 40);
});

test('四渡赤水场次使用中国共产党历史展览馆的课程中心坐标', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ courseId: 'lesson_zhuhun_001', className: '四渡赤水研学班' });
  const snapshot = await service.getSnapshot(run.id);
  assert.deepEqual(snapshot.run.mapCenter, [116.3953, 40.0071]);
  assert.equal(snapshot.run.courseTitle, '得意之笔·四渡赤水');
  assert.equal(snapshot.participants.length, 25);
  assert.ok(snapshot.participants.every((item) => item.location.lng === null));
  assert.ok(snapshot.participants.every((item) => item.location.lat === null));
  assert.ok(snapshot.participants.every((item) => item.positionStatus === 'unknown'));
});

test('教师指令支持版本冲突与幂等，并产生学生回执', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[0];
  await service.bindLearnerSession({ runId: run.id, participantId: participant.id, sessionId: 'ses_teacher_test', roleId: participant.roleId });
  const input = {
    actorId: 'teacher-demo', idempotencyKey: 'idem-teacher-001', expectedVersion: snapshot.run.version,
    action: 'send_notice', target: { scope: 'participant', id: participant.id },
    payload: { text: '请检查当前证据' }, reason: '学生主动求助',
  };
  const first = await service.sendCommand(run.id, input);
  const duplicate = await service.sendCommand(run.id, input);
  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.runVersion, first.runVersion);
  assert.deepEqual(duplicate.receipts, first.receipts);
  assert.equal(first.receipts[0].status, 'accepted');
  const pending = await service.commandsForSession('ses_teacher_test', 0);
  assert.equal(pending.commands.length, 1);
  const delivered = await service.confirmCommand('ses_teacher_test', first.id, 'delivered');
  assert.equal(delivered.status, 'delivered');
  await assert.rejects(
    service.confirmCommand('ses_teacher_test', first.id, 'failed'),
    (error) => error.statusCode === 409,
  );
  const consumed = await service.commandsForSession('ses_teacher_test', 0);
  assert.equal(consumed.commands.length, 0);
  const receipt = await service.confirmCommand('ses_teacher_test', first.id, 'confirmed');
  assert.equal(receipt.status, 'confirmed');
  const confirmedAgain = await service.confirmCommand('ses_teacher_test', first.id, 'delivered');
  assert.equal(confirmedAgain.status, 'confirmed');
  await service.bindLearnerSession({ runId: run.id, participantId: participant.id, sessionId: 'ses_teacher_rebound', roleId: participant.roleId });
  const rebound = await service.commandsForSession('ses_teacher_rebound', 0);
  assert.equal(rebound.commands.length, 0);
  await assert.rejects(
    service.sendCommand(run.id, { ...input, idempotencyKey: 'idem-teacher-002', action: 'add_time' }),
    (error) => error.statusCode === 409,
  );
});

test('教师指令幂等键只回放同一规范化请求，变更任一语义字段均 409 且零写入', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  const [participant, other] = snapshot.participants;
  const input = commandInput(snapshot, {
    idempotencyKey: 'idem-semantic-command-001',
    action: 'add_time',
    target: { scope: 'participant', id: participant.id },
    payload: { metadata: { beta: 2, alpha: 1 }, amount: '3' },
    reason: '学生主动求助',
  });

  const first = await service.sendCommand(run.id, input);
  const replay = await service.sendCommand(run.id, {
    ...input,
    payload: { amount: 3, metadata: { alpha: 1, beta: 2 } },
  });
  assert.equal(replay.id, first.id);
  assert.equal(replay.runVersion, first.runVersion);
  assert.deepEqual(replay.payload, first.payload);
  assert.deepEqual(replay.receipts, first.receipts);

  const target = path.join(directory, 'course-runs.json');
  const persistedAfterAccept = await fs.readFile(target, 'utf8');
  const conflictCases = [
    ['action', { action: 'remove_time' }],
    ['target', { target: { scope: 'participant', id: other.id } }],
    ['reason', { reason: '改成另一个原因' }],
    ['payload', { payload: { amount: 4, metadata: { alpha: 1, beta: 2 } } }],
  ];
  for (const [field, change] of conflictCases) {
    await assert.rejects(
      service.sendCommand(run.id, { ...input, ...change }),
      (error) => (
        error.statusCode === 409
        && error.code === 'TEACHER_COMMAND_IDEMPOTENCY_CONFLICT'
        && error.details?.teacherCommandId === first.id
        && error.details?.conflictingFields?.includes(field)
      ),
      `${field} 改变必须返回可识别的幂等冲突`,
    );
    assert.equal(await fs.readFile(target, 'utf8'), persistedAfterAccept, `${field} 冲突不得落盘`);
  }

  const after = await service.getReview(run.id);
  assert.equal(after.run.version, first.runVersion);
  assert.equal(after.interventions.length, 1);
  const audit = after.auditEvents.find((item) => item.action === 'teacher.command');
  assert.equal(audit.payload.teacherCommandId, first.id);
  assert.equal(audit.payload.teacherCommandAction, first.action);
});

test('推进阶段的幂等回放使用原指令的服务端补全 payload', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  const input = commandInput(snapshot, {
    idempotencyKey: 'idem-advance-phase-replay',
    action: 'advance_phase',
    target: { scope: 'all' },
    payload: {},
    reason: '进入下一阶段',
  });

  const first = await service.sendCommand(run.id, input);
  const replay = await service.sendCommand(run.id, input);
  assert.equal(replay.id, first.id);
  assert.deepEqual(replay.payload, first.payload);
  assert.ok(first.payload.phaseId);
  assert.ok(first.payload.phaseName);

  await assert.rejects(
    service.sendCommand(run.id, { ...input, payload: { phaseId: 'phase-does-not-match' } }),
    (error) => (
      error.statusCode === 409
      && error.code === 'TEACHER_COMMAND_IDEMPOTENCY_CONFLICT'
      && error.details?.conflictingFields?.includes('payload')
    ),
  );
});

test('待处理教师指令绑定派发时的会话，角色切换不能误领或改写回执', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '会话指令隔离班', groupCount: 2, status: 'active' });
  let snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[0];
  await service.bindLearnerSession({
    runId: run.id,
    participantId: participant.id,
    sessionId: 'ses_role_a',
    courseId: snapshot.run.courseId,
  });
  const sent = await service.sendCommand(run.id, commandInput(snapshot, {
    action: 'set_scaffold',
    target: { scope: 'participant', id: participant.id },
    payload: { level: 2 },
  }));

  await service.bindLearnerSession({
    runId: run.id,
    participantId: participant.id,
    sessionId: 'ses_role_b',
    courseId: snapshot.run.courseId,
  });
  assert.equal((await service.commandsForSession('ses_role_b', 0)).commands.length, 0);
  await assert.rejects(
    service.confirmCommand('ses_role_b', sent.id, 'failed'),
    (error) => error.statusCode === 404,
  );

  await service.activateLearnerSession({
    runId: run.id,
    participantId: participant.id,
    sessionId: 'ses_role_a',
    courseId: snapshot.run.courseId,
  });
  const returned = await service.commandsForSession('ses_role_a', 0);
  assert.equal(returned.commands.length, 1);
  assert.equal(returned.commands[0].id, sent.id);
});

test('Agent 教师命令桥只消费当前会话未使用的服务端指令', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  let snapshot = await service.getSnapshot(run.id);
  const [owner, other] = snapshot.participants;
  await service.bindLearnerSession({ runId: run.id, participantId: owner.id, sessionId: 'ses_command_owner', roleId: owner.roleId });
  await service.bindLearnerSession({ runId: run.id, participantId: other.id, sessionId: 'ses_command_other', roleId: other.roleId });

  const sent = await sendAndRefresh(service, run.id, snapshot, {
    action: 'set_scaffold',
    target: { scope: 'participant', id: owner.id },
    payload: { level: 2 },
  });
  snapshot = sent.snapshot;
  const command = sent.result;
  assert.equal(command.receipts[0].targetSnapshot.taskId, owner.learning.currentTaskId);
  assert.equal(command.receipts[0].targetSnapshot.stepId, owner.learning.currentStepId);
  const consume = createRuntimeTeacherCommandConsumer(service);
  const requirement = { commandId: command.id, action: 'set_scaffold' };

  await assert.rejects(consume({
    sessionId: 'ses_command_other',
    requirement,
    input: {
      type: 'lifecycle_event',
      event: 'teacher_directive',
      data: { scaffoldLevel: 99, teacherCommandId: command.id },
    },
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');
  assert.equal((await service.commandsForSession('ses_command_owner', 0)).commands.length, 1);

  const input = {
    type: 'lifecycle_event',
    event: 'teacher_directive',
    data: { scaffoldLevel: 99, teacherCommandId: command.id },
  };
  const grant = await consume({ sessionId: 'ses_command_owner', requirement, input });
  assert.equal(grant.sessionId, 'ses_command_owner');
  assert.equal(grant.commandId, command.id);
  assert.equal(grant.action, 'set_scaffold');
  assert.equal(typeof grant.commit, 'function');
  assert.equal(typeof grant.release, 'function');
  assert.equal(input.data.scaffoldLevel, 2, '特权参数取服务端 payload，忽略客户端伪造值');
  assert.equal(input.data.taskId, owner.learning.currentTaskId);
  assert.equal((await service.commandsForSession('ses_command_owner', 0)).commands.length, 1, '状态落盘前不提前消费回执');

  await assert.rejects(consume({
    sessionId: 'ses_command_owner',
    requirement,
    input,
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');
  await grant.commit();
  assert.equal((await service.commandsForSession('ses_command_owner', 0)).commands.length, 0);

  await assert.rejects(consume({
    sessionId: 'ses_command_owner',
    requirement,
    input,
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');

  const phaseSent = await sendAndRefresh(service, run.id, snapshot, {
    action: 'advance_phase',
    target: { scope: 'all' },
    payload: { phaseId: 'phase-3' },
  });
  const phaseInput = {
    type: 'lifecycle_event',
    event: 'teacher_directive',
    data: { phaseId: 'phase-99', scaffoldLevel: 4, teacherCommandId: phaseSent.result.id },
  };
  const phaseGrant = await consume({
    sessionId: 'ses_command_owner',
    requirement: { commandId: phaseSent.result.id, action: 'advance_phase' },
    input: phaseInput,
  });
  assert.equal(phaseInput.data.phaseId, 'phase-3');
  assert.equal(Object.hasOwn(phaseInput.data, 'scaffoldLevel'), false);
  await phaseGrant.commit();
});

test('学生求助五分钟内去重，事件按固定状态机处理', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[2];
  await assert.rejects(
    service.requestHelp({
      sessionId: '伪造的会话',
      participantId: participant.id,
      kind: 'safety',
      reason: '伪造安全告警',
    }),
    (error) => error.statusCode === 404,
  );
  await service.bindLearnerSession({ runId: run.id, participantId: participant.id, sessionId: 'ses_help_test', roleId: participant.roleId });
  await assert.rejects(
    service.requestHelp({
      sessionId: 'ses_help_test',
      participantId: snapshot.participants[3].id,
      kind: 'safety',
      reason: '串用其他学生身份',
    }),
    (error) => error.statusCode === 403,
  );
  const first = await service.requestHelp({ sessionId: 'ses_help_test', kind: 'task', reason: '我不知道下一步做什么' });
  const duplicate = await service.requestHelp({ sessionId: 'ses_help_test', kind: 'task', reason: '再次求助' });
  assert.equal(duplicate.id, first.id);
  const acknowledged = await service.updateAlert(run.id, first.id, { status: 'acknowledged', actorId: 'teacher-demo', reason: '教师已看到' });
  assert.equal(acknowledged.status, 'acknowledged');
  const resolved = await service.updateAlert(run.id, first.id, { status: 'resolved', actorId: 'teacher-demo', reason: '已通过远程提示解决' });
  assert.equal(resolved.status, 'resolved');
});

test('名单导入、设备重检和角色唯一性均由服务端校验', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '测试班', groupCount: 5 });
  const imported = await service.importRoster(run.id, { csv: '姓名\n甲\n乙\n丙', actorId: 'teacher-demo', reason: '测试导入' });
  assert.equal(imported.imported, 3);
  const snapshot = await service.getSnapshot(run.id);
  assert.deepEqual(snapshot.participants.slice(0, 3).map((item) => item.name), ['甲', '乙', '丙']);
  const attention = snapshot.participants.find((item) => item.device.location !== 'ready');
  await service.updateParticipant(run.id, attention.id, { recheckDevice: true, actorId: 'teacher-demo', reason: '重新检测' });
  const updated = await service.getSnapshot(run.id);
  assert.equal(updated.participants.find((item) => item.id === attention.id).device.location, 'checking');
  assert.equal(updated.participants.find((item) => item.id === attention.id).device.camera, 'checking');
  const [first, second] = updated.groups[0].members;
  const roleId = updated.run.roleOptions[0].id;
  await service.updateParticipant(run.id, first.id, {
    roleId,
    actorId: 'teacher-demo',
    reason: '教师分配首个角色',
  });
  await assert.rejects(
    service.updateParticipant(run.id, second.id, { roleId, actorId: 'teacher-demo', reason: '测试重复角色' }),
    (error) => error.statusCode === 409,
  );
});

test('证据存储在未配置对象存储时使用本地适配器', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-store-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = createEvidenceStore({ projectRoot: directory });
  const filename = await store.put({ id: 'ev_abc123', extension: '.png', data: Buffer.from('image'), contentType: 'image/png' });
  const found = await store.findById('ev_abc123');
  assert.equal(store.kind, 'local');
  assert.equal(filename, 'ev_abc123.png');
  assert.equal(found.data.toString(), 'image');
});

test('applyCommand 第一层：run.* 状态改动', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '指令测试班', groupCount: 3, status: 'draft' });
  let snapshot = await service.getSnapshot(run.id);

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'release_roles', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.rolesReleased, true);
  assert.equal(snapshot.run.rolesLocked, false);

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'lock_roles', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.rolesLocked, true);
  assert.equal(snapshot.run.rolesReleased, true);

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'start_phase', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.status, 'active');

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'pause', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.paused, true);

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'resume', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.paused, false);

  const phaseBefore = snapshot.run.phaseIndex;
  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'advance_phase',
    target: { scope: 'all' },
    payload: { phaseId: 'phase-2', phaseName: '客户端伪造名称' },
  }));
  assert.equal(snapshot.run.phaseIndex, phaseBefore + 1);
  assert.equal(snapshot.run.phaseId, 'phase-2');
  assert.notEqual(snapshot.run.phaseName, '客户端伪造名称');

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'end_run', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.status, 'completed');

  const completedVersion = snapshot.run.version;
  await assert.rejects(
    service.sendCommand(run.id, commandInput(snapshot, {
      action: 'start_phase', target: { scope: 'all' },
    })),
    (error) => error.statusCode === 409 && /已结束/.test(error.message),
  );
  snapshot = await service.getSnapshot(run.id);
  assert.equal(snapshot.run.status, 'completed');
  assert.equal(snapshot.run.version, completedVersion);
});

test('applyCommand 第二层：教师时间指令不改学生时间银行', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '参与者指令班', groupCount: 3 });
  let snapshot = await service.getSnapshot(run.id);
  const target = snapshot.participants[0];
  const before = {
    timeBalance: target.learning.timeBalance,
    scaffoldLevel: target.learning.scaffoldLevel,
    progress: target.learning.progress,
    insideFence: target.location.insideFence,
  };

  let result;
  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'add_time',
    target: { scope: 'participant', id: target.id },
    payload: { amount: 5 },
  }));
  assert.equal(participantById(snapshot, target.id).learning.timeBalance, before.timeBalance);
  assert.equal(participantsWithDirective(snapshot, result.id).length, 1);

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'remove_time',
    target: { scope: 'participant', id: target.id },
    payload: { amount: 2 },
  }));
  assert.equal(participantById(snapshot, target.id).learning.timeBalance, before.timeBalance);

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'set_scaffold',
    target: { scope: 'participant', id: target.id },
    payload: { level: 3 },
  }));
  assert.equal(participantById(snapshot, target.id).learning.scaffoldLevel, 3);

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'confirm_arrival',
    target: { scope: 'participant', id: target.id },
  }));
  assert.equal(
    participantById(snapshot, target.id).location.insideFence,
    before.insideFence,
    '发指令只创建回执，不先伪写学生已到达',
  );

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'approve_evidence',
    target: { scope: 'participant', id: target.id },
  }));
  assert.equal(participantById(snapshot, target.id).learning.progress, before.progress);

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'skip_step',
    target: { scope: 'participant', id: target.id },
  }));
  assert.equal(participantById(snapshot, target.id).learning.progress, before.progress);
});

test('applyCommand：仅写 latestDirective、不改 learning/run 的 5 个 action', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '只留指令班', groupCount: 3 });
  let snapshot = await service.getSnapshot(run.id);
  const target = snapshot.participants[1];
  const baseline = {
    runVersion: snapshot.run.version,
    paused: snapshot.run.paused,
    progress: target.learning.progress,
    timeBalance: target.learning.timeBalance,
    scaffoldLevel: target.learning.scaffoldLevel,
    insideFence: target.location.insideFence,
  };

  for (const action of [
    'send_notice',
    'push_knowledge',
    'reject_evidence',
    'switch_alternative',
    'emergency_rally',
  ]) {
    const { result, snapshot: next } = await sendAndRefresh(service, run.id, snapshot, {
      action,
      target: action === 'emergency_rally'
        ? { scope: 'all' }
        : { scope: 'participant', id: target.id },
      payload: action === 'send_notice'
        ? { text: '请继续任务' }
        : action === 'emergency_rally'
          ? { rallyPoint: '集合点', message: '请集合' }
          : {},
    });
    snapshot = next;
    const updated = participantById(snapshot, target.id);
    assert.equal(updated.latestDirective?.commandId, result.id);
    assert.equal(updated.latestDirective?.action, action);
    assert.equal(updated.learning.progress, baseline.progress);
    assert.equal(updated.learning.timeBalance, baseline.timeBalance);
    assert.equal(updated.learning.scaffoldLevel, baseline.scaffoldLevel);
    assert.equal(updated.location.insideFence, baseline.insideFence);
  }
});

test('target.scope 四种取值只影响目标范围内的 participant', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  let snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[0];
  const groupId = participant.groupId;
  const roleId = participant.roleId;
  const groupMembers = snapshot.participants.filter((item) => item.groupId === groupId);
  const roleMembers = snapshot.participants.filter((item) => item.roleId === roleId);
  assert.ok(groupMembers.length > 1);
  assert.ok(roleMembers.length > 1);

  let result;
  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'send_notice',
    target: { scope: 'all' },
    payload: { text: '全班广播' },
  }));
  assert.equal(participantsWithDirective(snapshot, result.id).length, snapshot.participants.length);

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'send_notice',
    target: { scope: 'group', id: groupId },
    payload: { text: '小组广播' },
  }));
  assert.equal(participantsWithDirective(snapshot, result.id).length, groupMembers.length);
  assert.ok(snapshot.participants.some((item) => item.groupId !== groupId && item.latestDirective?.commandId !== result.id));

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'send_notice',
    target: { scope: 'role', id: roleId },
    payload: { text: '角色广播' },
  }));
  assert.equal(participantsWithDirective(snapshot, result.id).length, roleMembers.length);
  assert.ok(snapshot.participants.some((item) => item.roleId !== roleId && item.latestDirective?.commandId !== result.id));

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'send_notice',
    target: { scope: 'participant', id: participant.id },
    payload: { text: '单人提示' },
  }));
  assert.equal(participantsWithDirective(snapshot, result.id).length, 1);
  assert.equal(participantsWithDirective(snapshot, result.id)[0].id, participant.id);
  assert.ok(snapshot.participants.some((item) => item.id !== participant.id && item.latestDirective?.commandId !== result.id));
});

test('19 个 action 均可被 sendCommand 接受并产生回执', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '全 action 覆盖班', groupCount: 2, status: 'draft' });
  let snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[0];
  const actions = [
    'start_phase', 'send_notice', 'push_knowledge', 'add_time', 'remove_time', 'pause', 'resume',
    'release_roles', 'lock_roles', 'advance_phase',
    'confirm_arrival', 'reject_evidence', 'approve_evidence', 'skip_step',
    'set_scaffold', 'switch_alternative', 'emergency_rally', 'advance_task', 'end_run',
  ];
  const runWideActions = new Set([
    'pause', 'resume', 'release_roles', 'lock_roles', 'start_phase',
    'advance_phase', 'end_run', 'emergency_rally',
  ]);

  for (const action of actions) {
    const { result } = await sendAndRefresh(service, run.id, snapshot, {
      action,
      target: runWideActions.has(action) ? { scope: 'all' } : { scope: 'participant', id: participant.id },
      payload: action === 'add_time'
        ? { amount: 2 }
        : action === 'set_scaffold'
          ? { level: 1 }
          : action === 'advance_phase'
            ? { phaseId: 'phase-2', phaseName: '客户端阶段名' }
            : action === 'send_notice'
              ? { text: '继续' }
              : action === 'emergency_rally'
                ? { rallyPoint: '广场', message: '集合' }
                : {},
    });
    snapshot = await service.getSnapshot(run.id);
    assert.equal(result.action, action);
    assert.ok(result.receipts.length >= 1);
    assert.equal(result.receipts[0].status, 'accepted');
  }
});

test('非法教师参数在写入场次、指令和回执之前被拒绝', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '非法指令参数班', groupCount: 2, status: 'active' });
  const before = await service.getSnapshot(run.id);
  const participant = before.participants[0];
  const invalidInputs = [
    { action: 'add_time', target: { scope: 'participant', id: participant.id }, payload: { amount: 'abc' } },
    { action: 'set_scaffold', target: { scope: 'participant', id: participant.id }, payload: { level: 99 } },
    { action: 'advance_phase', target: { scope: 'all' }, payload: { phaseId: 'phase-99' } },
    { action: 'pause', target: { scope: 'participant', id: participant.id }, payload: {} },
  ];

  for (const input of invalidInputs) {
    await assert.rejects(
      service.sendCommand(run.id, commandInput(before, input)),
      (error) => [400, 409].includes(error.statusCode),
    );
  }
  const after = await service.getSnapshot(run.id);
  assert.equal(after.run.version, before.run.version);
  assert.equal(after.run.status, before.run.status);
  assert.equal(after.participants[0].learning.timeBalance, participant.learning.timeBalance);
  assert.equal(after.participants[0].learning.scaffoldLevel, participant.learning.scaffoldLevel);
});

test('体验场次按教师隔离，每人只有一名体验学生', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const first = await service.ensureExperienceRun({ teacherId: 'exp-1', teacherName: '体验教师1' });
  const firstAgain = await service.ensureExperienceRun({ teacherId: 'exp-1', teacherName: '体验教师1' });
  const second = await service.ensureExperienceRun({ teacherId: 'exp-2', teacherName: '体验教师2' });

  assert.equal(first.id, firstAgain.id);
  assert.notEqual(first.id, second.id);
  assert.equal(first.experiencePack, true);
  assert.equal(first.teacherId, 'exp-1');
  assert.equal(second.teacherId, 'exp-2');

  const firstSnapshot = await service.getSnapshot(first.id);
  const secondSnapshot = await service.getSnapshot(second.id);
  assert.equal(firstSnapshot.groups.length, 1);
  assert.equal(firstSnapshot.participants.length, 1);
  assert.equal(firstSnapshot.participants[0].name, '体验学生');
  assert.equal(firstSnapshot.participants[0].id, 'student-1-1');
  assert.equal(secondSnapshot.participants[0].id, 'student-1-1');

  await assert.rejects(
    service.assertTeacherAccess(first.id, 'exp-2'),
    (error) => error.statusCode === 403,
  );
  await service.assertTeacherAccess(first.id, 'exp-1');

  const listed = await service.listRuns('exp-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, first.id);
  assert.equal((await service.listRuns('exp-2'))[0].id, second.id);

  const preflight = await service.preflight(first.id);
  assert.equal(preflight.joinCredentials.length, 1);
  assert.equal(preflight.joinCredentials[0].participantId, 'student-1-1');
  assert.ok(preflight.joinCredentials[0].joinCredential.length >= 32);
});

test('体验账号为每门课各建一场，进度按教师隔离', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const courseIds = ['lesson_gewu_001', 'lesson_zhizhi_001', 'lesson_zhuhun_001'];

  await service.ensureExperienceRun({
    teacherId: 'exp-1',
    teacherName: '体验教师1',
    courseIds,
  });
  await service.ensureExperienceRun({
    teacherId: 'exp-2',
    teacherName: '体验教师2',
    courseIds,
  });

  const firstRuns = await service.listRuns('exp-1');
  const secondRuns = await service.listRuns('exp-2');
  assert.equal(firstRuns.length, 3);
  assert.equal(secondRuns.length, 3);
  assert.deepEqual(firstRuns.map((run) => run.courseId).sort(), [...courseIds].sort());
  assert.deepEqual(secondRuns.map((run) => run.courseId).sort(), [...courseIds].sort());
  assert.equal(firstRuns.every((run) => run.experiencePack === true), true);
  assert.equal(
    firstRuns.some((run) => secondRuns.some((other) => other.id === run.id)),
    false,
  );

  const gewu = firstRuns.find((run) => run.courseId === 'lesson_gewu_001');
  await assert.rejects(
    service.assertTeacherAccess(gewu.id, 'exp-2'),
    (error) => error.statusCode === 403,
  );
});
