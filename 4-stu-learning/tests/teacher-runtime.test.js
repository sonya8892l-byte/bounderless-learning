import assert from 'node:assert/strict';
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
  const pending = await service.commandsForSession('ses_teacher_test', 0);
  assert.equal(pending.commands.length, 1);
  const receipt = await service.confirmCommand('ses_teacher_test', first.id, 'confirmed');
  assert.equal(receipt.status, 'confirmed');
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
