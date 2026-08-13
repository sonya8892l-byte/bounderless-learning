import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { renderPhaseOpening } from '../server/course/phase-policy.js';
import { createAgentService } from '../server/agent/service.js';
import {
  actionForTeacherLifecycleEvent,
  createTeacherCommandAuthority,
} from './helpers/teacher-command-authority.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

// 教师指令落到会话状态：教师运行时（server/runtime/）只持有场次记录，碰不到 agent 会话，
// 所以 advance_phase / set_scaffold 要靠学生端回发 teacher_directive 才能真正生效。
// 这一组锁的就是"指令发出去之后会话真的变了"，防止回到"教师以为生效、实际没生效"。

function silentLlm() {
  let calls = 0;
  return {
    capabilities: () => ({ nativeTools: true, vision: true }),
    get calls() { return calls; },
    generate: async () => {
      calls += 1;
      return { text: '不该被调用。', toolCalls: [] };
    },
  };
}

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = {
        id: 'ses_directive', courseId: values.courseId, roleId: values.roleId,
        studentId: values.studentId, groupId: values.groupId, phaseId: values.phaseId,
        phaseNumber: 2, currentTaskIndex: 0, scaffoldLevel: 0, completedTaskIds: [],
        events: [], messages: [], pendingTools: {}, handledRequestIds: [],
        timeBalance: 0, timeEarned: 0, completedBankTaskIds: [], gifts: [], taskState: {},
        learningState: { evidenceIds: [], completedStepIds: [] },
        locationState: null,
        onboardingState: { arrivedConfirmed: false, readyConfirmed: false, completed: false },
        conversationState: {},
        dialogueState: { pendingQuestion: null, confirmedSlots: {}, recentAssistantFingerprints: [] },
        learnerState: { grade: '初中', scaffoldLevel: 0 },
        environmentState: {},
      };
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

async function directiveAgent() {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const llm = silentLlm();
  const store = memoryStore();
  const authority = createTeacherCommandAuthority();
  const agent = createAgentService({
    llm,
    store,
    getCourse: async () => course,
    consumeTeacherCommand: authority.consume,
  });
  const { session } = await agent.createSession({
    courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1',
  });
  return { agent, authority, course, llm, session, store };
}

function sendDirective(agent, session, authority, data, requestId) {
  const action = actionForTeacherLifecycleEvent('teacher_directive', data);
  const teacherCommandId = authority.issue({
    sessionId: session.id,
    action,
    payload: data,
    commandId: data.teacherCommandId,
  });
  return agent.runTurn({
    sessionId: session.id,
    requestId,
    input: {
      type: 'lifecycle_event',
      event: 'teacher_directive',
      data: { ...data, teacherCommandId },
    },
  });
}

function assistantText(result) {
  return result.events
    .filter((event) => event.type === 'assistant.completed')
    .map((event) => event.data.text)
    .join('');
}

function occurrences(text, expected) {
  if (!expected) return 0;
  return String(text).split(expected).length - 1;
}

test('教师推进阶段写回 session.phaseId，阶段提示词随之换成新阶段那一份', async () => {
  const { agent, authority, course, session, store } = await directiveAgent();

  // 建会话时的阶段来自 course.md 的「任务阶段」，gewu_001 写的是 phase-2。
  assert.equal(session.phaseId, 'phase-2');
  const before = course.phasePrompts['phase-2'];
  const after = course.phasePrompts['phase-3'];
  assert.ok(before && after && before !== after, '前置条件：两个阶段各有一份不同的提示词');

  await sendDirective(agent, session, authority, { phaseId: 'phase-3', teacherCommandId: 'cmd-1' }, 'd-1');

  const saved = await store.get(session.id);
  assert.equal(saved.phaseId, 'phase-3', '会话阶段必须真的变了，否则六份提示词只有一份能生效');
  assert.equal(saved.phaseNumber, 3, 'phaseNumber 要跟着走，位置门禁与阶段判断都读它');
});

test('教师调档写回 session.scaffoldLevel，且可升可降', async () => {
  const { agent, authority, session, store } = await directiveAgent();
  assert.equal(session.scaffoldLevel, 0);

  await sendDirective(agent, session, authority, { scaffoldLevel: 3, teacherCommandId: 'cmd-2' }, 'd-2');
  assert.equal((await store.get(session.id)).scaffoldLevel, 3);

  // tutorPolicy 的自动升档只升不降；老师看得到学生真实状态，必须能调回去。
  await sendDirective(agent, session, authority, { scaffoldLevel: 1, teacherCommandId: 'cmd-3' }, 'd-3');
  assert.equal((await store.get(session.id)).scaffoldLevel, 1, '教师调档必须可降');
});

test('档位越界被夹到平台上限与 0，不写进非法值', async () => {
  const { agent, authority, course, session, store } = await directiveAgent();
  const maxLevel = Number(course?.platformDefaults?.scaffolding?.maxLevel ?? 4);

  await sendDirective(agent, session, authority, { scaffoldLevel: 99 }, 'd-4');
  assert.equal((await store.get(session.id)).scaffoldLevel, maxLevel);

  await sendDirective(agent, session, authority, { scaffoldLevel: -5 }, 'd-5');
  assert.equal((await store.get(session.id)).scaffoldLevel, 0);
});

test('课程里不存在的阶段被忽略，不让「阶段规则」段凭空变空', async () => {
  const { agent, authority, session, store } = await directiveAgent();

  await sendDirective(agent, session, authority, { phaseId: 'phase-99' }, 'd-6');

  const saved = await store.get(session.id);
  assert.equal(saved.phaseId, 'phase-2', '写错阶段号时保持原样：宁可不改，也不要让课程作者写的阶段约束消失');
  assert.equal(saved.phaseNumber, 2);
});

test('教师推进阶段展示一次新 Phase 开场，调脚手架仍静默，二者都不调模型', async () => {
  const { agent, authority, course, llm, session } = await directiveAgent();
  const role = course.roles.find((item) => item.id === session.roleId);
  const opening = renderPhaseOpening(course.phasePolicies['phase-3'], {
    roleName: role.name,
    firstLocation: role.tasks[0].location?.name || role.location,
  });
  assert.ok(opening, 'Phase 3 必须提供开场白模板');

  const advanced = await sendDirective(
    agent,
    session,
    authority,
    { phaseId: 'phase-3', teacherCommandId: 'cmd-trace-7' },
    'd-7-林同学',
  );

  assert.equal(llm.calls, 0, '状态变更不需要模型参与');
  assert.equal(occurrences(assistantText(advanced), opening), 1, '推进阶段应展示一次新阶段开场');
  assert.deepEqual(advanced.trace.teacherCommand, {
    teacherCommandId: 'cmd-trace-7',
    action: 'advance_phase',
  });
  assert.doesNotMatch(JSON.stringify(advanced.trace), /林同学/u);

  const repeated = await sendDirective(
    agent,
    session,
    authority,
    { phaseId: 'phase-3', teacherCommandId: 'cmd-trace-7-repeat' },
    'd-7-repeat',
  );
  assert.equal(occurrences(assistantText(repeated), opening), 0, '重复推进到同一 Phase 不重播开场');

  const scaffold = await sendDirective(
    agent,
    session,
    authority,
    { scaffoldLevel: 2, teacherCommandId: 'cmd-trace-scaffold' },
    'd-7-scaffold',
  );
  assert.equal(
    scaffold.events.some((event) => event.type === 'assistant.completed'),
    false,
    '只调整脚手架时保持静默',
  );
  assert.equal(llm.calls, 0, '教师阶段与脚手架指令都不得调用模型');
});

test('教师确认到达经一次性授权写入 Agent 到达状态并解除到达提问', async () => {
  const { agent, authority, session, store } = await directiveAgent();
  const commandId = authority.issue({
    sessionId: session.id,
    action: 'confirm_arrival',
  });
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-confirm-arrival',
    input: {
      type: 'lifecycle_event',
      event: 'teacher_confirm_arrival',
      data: { teacherCommandId: commandId, locationObservedAt: new Date().toISOString() },
    },
  });

  const saved = await store.get(session.id);
  assert.equal(saved.locationState.status, 'arrived');
  assert.equal(saved.locationState.verifiedBy, 'teacher');
  assert.equal(saved.dialogueState.confirmedSlots.arrival, true);
  assert.notEqual(saved.dialogueState.pendingQuestion?.kind, 'arrival');
  assert.ok(result.events.some((event) => event.type === 'state.updated'));
});

test('教师确认到达拒绝缺失或过期的定位快照', async () => {
  const { agent, authority, session, store } = await directiveAgent();
  for (const [requestId, locationObservedAt] of [
    ['teacher-arrival-missing-location', undefined],
    ['teacher-arrival-stale-location', new Date(Date.now() - 61_000).toISOString()],
  ]) {
    const commandId = authority.issue({ sessionId: session.id, action: 'confirm_arrival' });
    await assert.rejects(agent.runTurn({
      sessionId: session.id,
      requestId,
      input: {
        type: 'lifecycle_event',
        event: 'teacher_confirm_arrival',
        data: { teacherCommandId: commandId, locationObservedAt },
      },
    }), (error) => error.code === 'TEACHER_LOCATION_SNAPSHOT_STALE');
  }
  assert.notEqual((await store.get(session.id)).locationState?.status, 'arrived');
});

test('伪造或错类型的到达确认不能改变 Agent 位置状态', async () => {
  const { agent, authority, session, store } = await directiveAgent();
  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-confirm-arrival-forged',
    input: {
      type: 'lifecycle_event',
      event: 'teacher_confirm_arrival',
      data: { teacherCommandId: 'cmd_not_issued' },
    },
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');

  const wrongActionId = authority.issue({ sessionId: session.id, action: 'approve_evidence' });
  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-confirm-arrival-wrong-action',
    input: {
      type: 'lifecycle_event',
      event: 'teacher_confirm_arrival',
      data: { teacherCommandId: wrongActionId },
    },
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');

  assert.notEqual((await store.get(session.id)).locationState?.status, 'arrived');
});

test('一条指令可以同时改阶段与档位', async () => {
  const { agent, authority, session, store } = await directiveAgent();

  await sendDirective(agent, session, authority, { phaseId: 'phase-4', scaffoldLevel: 2 }, 'd-8');

  const saved = await store.get(session.id);
  assert.equal(saved.phaseId, 'phase-4');
  assert.equal(saved.phaseNumber, 4);
  assert.equal(saved.scaffoldLevel, 2);
});

test('客户端伪造、串会话和重复消费的教师命令都不改会话状态', async () => {
  const { agent, authority, session, store } = await directiveAgent();
  const forgedInput = (teacherCommandId, scaffoldLevel = 2) => ({
    type: 'lifecycle_event',
    event: 'teacher_directive',
    data: { scaffoldLevel, teacherCommandId },
  });

  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'forged-command',
    input: forgedInput('cmd_not_issued'),
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');

  const foreignId = authority.issue({
    sessionId: 'ses_someone_else',
    action: 'set_scaffold',
  });
  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'foreign-command',
    input: forgedInput(foreignId),
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');

  const wrongActionId = authority.issue({
    sessionId: session.id,
    action: 'advance_phase',
  });
  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'wrong-action-command',
    input: forgedInput(wrongActionId),
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');

  const oneShotId = authority.issue({
    sessionId: session.id,
    action: 'set_scaffold',
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'one-shot-first',
    input: forgedInput(oneShotId, 3),
  });
  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'one-shot-second',
    input: forgedInput(oneShotId, 1),
  }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');

  const saved = await store.get(session.id);
  assert.equal(saved.scaffoldLevel, 3);
  assert.equal(saved.phaseId, 'phase-2');
});
