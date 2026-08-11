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

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

async function fixture() {
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

test('四渡赤水场次使用中国共产党历史展览馆的课程中心坐标', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ courseId: 'lesson_zhuhun_001', className: '四渡赤水研学班' });
  const snapshot = await service.getSnapshot(run.id);
  assert.deepEqual(snapshot.run.mapCenter, [116.3953, 40.0071]);
  assert.equal(snapshot.run.courseTitle, '得意之笔·四渡赤水');
  assert.equal(snapshot.participants.length, 25);
  assert.ok(snapshot.participants.every((item) => Math.abs(item.location.lng - 116.3953) < 0.001));
  assert.ok(snapshot.participants.every((item) => Math.abs(item.location.lat - 40.0071) < 0.001));
});

test('教师指令支持版本冲突与幂等，并产生学生回执', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[0];
  await service.bindLearnerSession({ runId: run.id, participantId: participant.id, sessionId: 'ses_teacher_test' });
  const input = {
    actorId: 'teacher-demo', idempotencyKey: 'idem-teacher-001', expectedVersion: snapshot.run.version,
    action: 'send_notice', target: { scope: 'participant', id: participant.id },
    payload: { text: '请检查当前证据' }, reason: '学生主动求助',
  };
  const first = await service.sendCommand(run.id, input);
  const duplicate = await service.sendCommand(run.id, input);
  assert.equal(duplicate.id, first.id);
  assert.equal(first.receipts[0].status, 'accepted');
  const pending = await service.commandsForSession('ses_teacher_test', 0);
  assert.equal(pending.commands.length, 1);
  const delivered = await service.confirmCommand('ses_teacher_test', first.id, 'delivered');
  assert.equal(delivered.status, 'delivered');
  const consumed = await service.commandsForSession('ses_teacher_test', 0);
  assert.equal(consumed.commands.length, 0);
  const receipt = await service.confirmCommand('ses_teacher_test', first.id, 'confirmed');
  assert.equal(receipt.status, 'confirmed');
  const confirmedAgain = await service.confirmCommand('ses_teacher_test', first.id, 'delivered');
  assert.equal(confirmedAgain.status, 'confirmed');
  await service.bindLearnerSession({ runId: run.id, participantId: participant.id, sessionId: 'ses_teacher_rebound' });
  const rebound = await service.commandsForSession('ses_teacher_rebound', 0);
  assert.equal(rebound.commands.length, 0);
  await assert.rejects(
    service.sendCommand(run.id, { ...input, idempotencyKey: 'idem-teacher-002', action: 'add_time' }),
    (error) => error.statusCode === 409,
  );
});

test('学生求助五分钟内去重，事件按固定状态机处理', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.ensureDemoRun();
  const snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[2];
  await service.bindLearnerSession({ runId: run.id, participantId: participant.id, sessionId: 'ses_help_test' });
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
  assert.equal(updated.participants.find((item) => item.id === attention.id).device.location, 'ready');
  const [first, second] = updated.groups[0].members;
  await assert.rejects(
    service.updateParticipant(run.id, second.id, { roleId: first.roleId, actorId: 'teacher-demo', reason: '测试重复角色' }),
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

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'lock_roles', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.rolesLocked, true);

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
    payload: { phaseId: 'phase-test-2', phaseName: '测试阶段二' },
  }));
  assert.equal(snapshot.run.phaseIndex, phaseBefore + 1);
  assert.equal(snapshot.run.phaseId, 'phase-test-2');
  assert.equal(snapshot.run.phaseName, '测试阶段二');

  ({ snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'end_run', target: { scope: 'all' },
  }));
  assert.equal(snapshot.run.status, 'completed');
});

test('applyCommand 第二层：participant.learning.* 状态改动', async (t) => {
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
  assert.equal(participantById(snapshot, target.id).learning.timeBalance, before.timeBalance + 5);
  assert.equal(participantsWithDirective(snapshot, result.id).length, 1);

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'set_scaffold',
    target: { scope: 'participant', id: target.id },
    payload: { level: 3 },
  }));
  assert.equal(participantById(snapshot, target.id).learning.scaffoldLevel, 3);

  participantById(snapshot, target.id).location.insideFence = false;
  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'confirm_arrival',
    target: { scope: 'participant', id: target.id },
  }));
  assert.equal(participantById(snapshot, target.id).location.insideFence, true);

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'approve_evidence',
    target: { scope: 'participant', id: target.id },
  }));
  assert.equal(participantById(snapshot, target.id).learning.progress, Math.min(100, before.progress + 12));

  ({ result, snapshot } = await sendAndRefresh(service, run.id, snapshot, {
    action: 'skip_step',
    target: { scope: 'participant', id: target.id },
  }));
  assert.equal(
    participantById(snapshot, target.id).learning.progress,
    Math.min(100, before.progress + 12 + 8),
  );
});

test('applyCommand：仅写 latestDirective、不改 learning/run 的 6 个 action', async (t) => {
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
    'remove_time',
    'send_notice',
    'push_knowledge',
    'reject_evidence',
    'switch_alternative',
    'emergency_rally',
  ]) {
    const { result, snapshot: next } = await sendAndRefresh(service, run.id, snapshot, {
      action,
      target: { scope: 'participant', id: target.id },
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
  const run = await service.createRun({ className: '范围测试班', groupCount: 3 });
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

test('18 个 action 均可被 sendCommand 接受并产生回执', async (t) => {
  const { directory, service } = await fixture();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const run = await service.createRun({ className: '全 action 覆盖班', groupCount: 2 });
  let snapshot = await service.getSnapshot(run.id);
  const participant = snapshot.participants[0];
  const actions = [
    'send_notice', 'push_knowledge', 'add_time', 'remove_time', 'pause', 'resume',
    'release_roles', 'lock_roles', 'start_phase', 'advance_phase', 'end_run',
    'confirm_arrival', 'reject_evidence', 'approve_evidence', 'skip_step',
    'set_scaffold', 'switch_alternative', 'emergency_rally',
  ];

  for (const action of actions) {
    const { result } = await sendAndRefresh(service, run.id, snapshot, {
      action,
      target: action === 'end_run' ? { scope: 'all' } : { scope: 'participant', id: participant.id },
      payload: action === 'add_time'
        ? { amount: 2 }
        : action === 'set_scaffold'
          ? { level: 1 }
          : action === 'advance_phase'
            ? { phaseId: `phase-${action}`, phaseName: '阶段' }
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
