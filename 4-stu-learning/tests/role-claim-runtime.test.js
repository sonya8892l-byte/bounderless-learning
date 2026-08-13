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

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

function memoryStore() {
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

async function fixture({ runStore = memoryStore() } = {}) {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const published = [];
  const runtime = createCourseRunService({
    store: runStore,
    getCourse: async () => course,
    realtime: {
      publish(runId, event) { published.push({ runId, event }); },
      subscribe() { return () => undefined; },
    },
  });
  const run = await runtime.createRun({
    courseId: course.id,
    status: 'active',
    teacherId: 'teacher-demo',
    groupCount: 2,
  });
  return { course, published, run, runtime, store: runStore };
}

async function command(subject, action) {
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  return subject.runtime.sendCommand(subject.run.id, {
    actorId: 'teacher-demo',
    idempotencyKey: `${action}-${crypto.randomUUID()}`,
    expectedVersion: snapshot.run.version,
    action,
    target: { scope: 'all' },
    payload: {},
    reason: '角色领取合同测试',
  });
}

async function bind(subject, participant, roleId, sessionId) {
  return subject.runtime.bindLearnerSession({
    runId: subject.run.id,
    participantId: participant.id,
    sessionId,
    courseId: subject.course.id,
    roleId,
  });
}

test('正式场次以学生为单位，初始不预填角色', async () => {
  const subject = await fixture();
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  assert.equal(snapshot.participants.length, subject.course.roles.length * 2);
  assert.equal(snapshot.participants.every((participant) => !participant.roleId), true);
  assert.equal(snapshot.participants.every((participant) => participant.device.roleClaimed === false), true);
  assert.equal(snapshot.run.roleClaimMode, 'student_claim');
  assert.deepEqual(
    snapshot.run.roleOptions.map((role) => role.id),
    subject.course.roles.map((role) => role.id),
  );
});

test('同组同角色只能有一人领取，不同组可以领取同一角色', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const [first, second] = snapshot.groups[0].members;
  const otherGroup = snapshot.groups[1].members[0];
  const roleId = subject.course.roles[0].id;

  await bind(subject, first, roleId, 'ses-first');
  await assert.rejects(
    bind(subject, second, roleId, 'ses-second'),
    (error) => error.code === 'COURSE_ROLE_TAKEN',
  );
  await bind(subject, otherGroup, roleId, 'ses-other-group');

  const after = await subject.runtime.getSnapshot(subject.run.id);
  assert.equal(after.participants.find((item) => item.id === first.id).roleId, roleId);
  assert.equal(after.participants.find((item) => item.id === second.id).roleId, '');
  assert.equal(after.participants.find((item) => item.id === otherGroup.id).roleId, roleId);
});

test('本地文件存储并发抢同组同角色时只有一人成功', async (t) => {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'role-claim-runtime-'));
  t.after(() => fs.rm(baseDir, { recursive: true, force: true }));
  const subject = await fixture({ runStore: createCourseRunStore({ baseDir }) });
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const [first, second] = snapshot.groups[0].members;
  const roleId = subject.course.roles[0].id;

  const outcomes = await Promise.all([
    [first, 'ses-concurrent-first'],
    [second, 'ses-concurrent-second'],
  ].map(async ([participant, sessionId]) => {
    try {
      await bind(subject, participant, roleId, sessionId);
      return { status: 'claimed', participantId: participant.id };
    } catch (error) {
      return { status: 'rejected', participantId: participant.id, code: error.code };
    }
  }));

  assert.equal(outcomes.filter((outcome) => outcome.status === 'claimed').length, 1);
  assert.deepEqual(
    outcomes.filter((outcome) => outcome.status === 'rejected').map((outcome) => outcome.code),
    ['COURSE_ROLE_TAKEN'],
  );
  const after = await subject.runtime.getSnapshot(subject.run.id);
  const sameGroup = after.participants.filter((participant) => participant.groupId === first.groupId);
  assert.equal(sameGroup.filter((participant) => participant.roleId === roleId).length, 1);
  assert.equal(sameGroup.filter((participant) => !participant.roleId).length >= 1, true);
});

test('调换被占角色时保留旧角色和旧活动会话', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const [first, second] = snapshot.groups[0].members;
  const [roleA, roleB] = subject.course.roles.map((role) => role.id);
  await bind(subject, first, roleA, 'ses-first-a');
  await bind(subject, second, roleB, 'ses-second-b');

  await assert.rejects(
    bind(subject, first, roleB, 'ses-first-b'),
    (error) => error.code === 'COURSE_ROLE_TAKEN',
  );
  const after = await subject.runtime.getSnapshot(subject.run.id);
  const persisted = after.participants.find((item) => item.id === first.id);
  assert.equal(persisted.roleId, roleA);
  assert.equal(persisted.learnerSessionId, 'ses-first-a');
});

test('教师不能只改场次角色而留下不匹配的活动 Agent 会话', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const participant = snapshot.participants[0];
  const [roleA, roleB] = subject.course.roles.map((role) => role.id);
  await bind(subject, participant, roleA, 'ses-active-role-a');

  await assert.rejects(
    subject.runtime.updateParticipant(subject.run.id, participant.id, {
      roleId: roleB,
      actorId: 'teacher-demo',
      reason: '尝试直接调换角色',
    }),
    (error) => error.code === 'COURSE_PARTICIPANT_SESSION_ACTIVE',
  );
  const after = await subject.runtime.getSnapshot(subject.run.id);
  const persisted = after.participants.find((item) => item.id === participant.id);
  assert.equal(persisted.roleId, roleA);
  assert.equal(persisted.learnerSessionId, 'ses-active-role-a');
});

test('同角色重试幂等，锁定后只能恢复已领取的角色', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const participant = snapshot.participants[0];
  const [roleA, roleB] = subject.course.roles.map((role) => role.id);
  await bind(subject, participant, roleA, 'ses-a-1');
  await command(subject, 'lock_roles');

  await bind(subject, participant, roleA, 'ses-a-2');
  await assert.rejects(
    bind(subject, participant, roleB, 'ses-b'),
    (error) => error.code === 'COURSE_ROLES_LOCKED',
  );
  const after = await subject.runtime.getSnapshot(subject.run.id);
  const persisted = after.participants.find((item) => item.id === participant.id);
  assert.equal(persisted.roleId, roleA);
  assert.equal(persisted.learnerSessionId, 'ses-a-2');
});

test('暂停或集合时同角色重试幂等，不同角色仍被拒绝', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const participant = snapshot.participants[0];
  const [roleA, roleB] = subject.course.roles.map((role) => role.id);
  const sessionId = 'ses-pause-rally-idempotent';
  await bind(subject, participant, roleA, sessionId);

  await command(subject, 'pause');
  const pausedRetry = await subject.runtime.claimRoleForSession({
    runId: subject.run.id,
    participantId: participant.id,
    sessionId,
    courseId: subject.course.id,
    roleId: roleA,
  });
  assert.equal(pausedRetry.runState.claimedRoleId, roleA);
  await assert.rejects(
    subject.runtime.claimRoleForSession({
      runId: subject.run.id,
      participantId: participant.id,
      sessionId,
      courseId: subject.course.id,
      roleId: roleB,
    }),
    (error) => error.code === 'COURSE_RUN_PAUSED',
  );

  await command(subject, 'resume');
  await command(subject, 'emergency_rally');
  const rallyRetry = await subject.runtime.claimRoleForSession({
    runId: subject.run.id,
    participantId: participant.id,
    sessionId,
    courseId: subject.course.id,
    roleId: roleA,
  });
  assert.equal(rallyRetry.runState.claimedRoleId, roleA);
  await assert.rejects(
    subject.runtime.claimRoleForSession({
      runId: subject.run.id,
      participantId: participant.id,
      sessionId,
      courseId: subject.course.id,
      roleId: roleB,
    }),
    (error) => error.code === 'COURSE_RUN_RALLY_ACTIVE',
  );
});

test('角色领取成功后可发布已持久化的实时事件', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const participant = snapshot.participants[0];
  const roleId = subject.course.roles[0].id;
  await bind(subject, participant, roleId, 'ses-realtime-role-claim');
  subject.published.length = 0;

  const didPublish = await subject.runtime.publishRoleClaimed({
    runId: subject.run.id,
    participantId: participant.id,
    roleId,
  });

  assert.equal(didPublish, true);
  assert.equal(subject.published.length, 1);
  assert.equal(subject.published[0].runId, subject.run.id);
  assert.equal(subject.published[0].event.type, 'participant.role_claimed');
  assert.equal(subject.published[0].event.data.participantId, participant.id);
  assert.equal(subject.published[0].event.data.roleId, roleId);
  assert.equal(Number.isInteger(subject.published[0].event.sequence), true);
});

test('学生安全 runState 只返回本组角色可用性，不泄露同伴身份', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const [first, second] = snapshot.groups[0].members;
  const roleId = subject.course.roles[0].id;
  await bind(subject, first, roleId, 'ses-first');
  await subject.runtime.bindLearnerSession({
    runId: subject.run.id,
    participantId: second.id,
    sessionId: 'ses-second-phase',
    courseId: subject.course.id,
  });

  const runState = await subject.runtime.runStateForSession('ses-second-phase');
  assert.equal(runState.claimedRoleId, '');
  assert.equal(runState.takenRoleIds.includes(roleId), true);
  assert.equal(runState.availableRoleIds.includes(roleId), false);
  assert.equal(JSON.stringify(runState).includes(first.id), false);
  assert.equal(JSON.stringify(runState).includes(first.name), false);
});

test('已导入名单有未领取学生时不能锁定角色', async () => {
  const subject = await fixture();
  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  const csv = ['姓名', ...snapshot.participants.map((_, index) => `学生${index + 1}`)].join('\n');
  await subject.runtime.importRoster(subject.run.id, {
    csv,
    actorId: 'teacher-demo',
    reason: '导入测试名单',
  });
  await command(subject, 'release_roles');

  await assert.rejects(
    command(subject, 'lock_roles'),
    (error) => error.code === 'COURSE_ROLE_CLAIMS_INCOMPLETE',
  );
  const after = await subject.runtime.getSnapshot(subject.run.id);
  assert.equal(after.run.rolesLocked, false);
});

test('锁定角色前拒绝同组重复 roleId 且不产生任何指令写入', async () => {
  const subject = await fixture();
  await command(subject, 'release_roles');
  const run = subject.store.state.runs[0];
  const [first, second] = run.participants.filter(
    (participant) => participant.groupId === run.participants[0].groupId,
  );
  const role = subject.course.roles[0];
  for (const participant of [first, second]) {
    participant.roleId = role.id;
    participant.roleName = role.name;
    participant.roleClaimedAt = '2026-08-11T00:00:00.000Z';
    participant.roleClaimSource = 'student';
    participant.device.roleClaimed = true;
  }
  const before = {
    commands: subject.store.state.commands.length,
    receipts: subject.store.state.receipts.length,
    interventions: subject.store.state.interventions.length,
    auditEvents: subject.store.state.auditEvents.length,
    events: subject.store.state.events.length,
    version: run.version,
  };

  await assert.rejects(
    command(subject, 'lock_roles'),
    (error) => {
      assert.equal(error.code, 'COURSE_ROLE_CLAIMS_CONFLICT');
      assert.deepEqual(error.details.conflicts, [{
        groupId: first.groupId,
        roleId: role.id,
        participantIds: [first.id, second.id],
      }]);
      return true;
    },
  );

  const after = subject.store.state.runs[0];
  assert.equal(after.rolesLocked, false);
  assert.equal(after.version, before.version);
  assert.equal(subject.store.state.commands.length, before.commands);
  assert.equal(subject.store.state.receipts.length, before.receipts);
  assert.equal(subject.store.state.interventions.length, before.interventions);
  assert.equal(subject.store.state.auditEvents.length, before.auditEvents);
  assert.equal(subject.store.state.events.length, before.events);
});

test('旧正式场次清除无领取证据的预填角色，同时保留已有活动会话的真实领取', async () => {
  const subject = await fixture();
  const [roleA, roleB] = subject.course.roles.map((role) => role.id);
  const legacyRun = subject.store.state.runs[0];
  legacyRun.teacherId = 'teacher-demo';
  delete legacyRun.demoMode;
  delete legacyRun.roleClaimMode;
  delete legacyRun.roleOptions;
  Object.assign(legacyRun.participants[0], {
    roleId: roleA,
    roleName: '旧版预填角色',
    learnerSessionId: null,
    device: { ...legacyRun.participants[0].device, roleClaimed: true },
  });
  Object.assign(legacyRun.participants[1], {
    roleId: roleB,
    roleName: '已有会话领取',
    learnerSessionId: 'ses_legacy_claimed',
    device: { ...legacyRun.participants[1].device, roleClaimed: true },
  });

  const snapshot = await subject.runtime.getSnapshot(subject.run.id);
  assert.equal(snapshot.participants[0].roleId, '');
  assert.equal(snapshot.participants[0].device.roleClaimed, false);
  assert.equal(snapshot.participants[1].roleId, roleB);
  assert.equal(snapshot.run.roleClaimMode, 'student_claim');
  assert.deepEqual(snapshot.run.roleOptions.map((role) => role.id), [roleA, roleB]);
  assert.equal(subject.store.state.runs[0].participants[0].roleId, '');
  assert.equal(subject.store.state.runs[0].roleClaimMode, 'student_claim');
});
