import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { createAgentService } from '../server/agent/service.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = {
        id: 'ses_dialogue_contract',
        courseId: values.courseId,
        roleId: values.roleId,
        studentId: values.studentId,
        groupId: values.groupId,
        phaseId: values.phaseId,
        phaseNumber: 2,
        currentTaskIndex: 0,
        scaffoldLevel: 0,
        completedTaskIds: [],
        events: [],
        messages: [],
        pendingTools: {},
        handledRequestIds: [],
        timeBalance: 0,
        timeEarned: 0,
        completedBankTaskIds: [],
        gifts: [],
      };
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

function inertLlm() {
  return {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => ({ text: '我听见了，我们先处理你刚才说的这件事。', toolCalls: [] }),
  };
}

async function harness(llm = inertLlm(), understandingLlm = llm) {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const store = memoryStore();
  const agent = createAgentService({ llm, understandingLlm, store, getCourse: async () => course });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'dragon-counter',
    studentId: 'student-contract',
    groupId: 'group-contract',
  });
  return { agent, course, session };
}

async function assignRole(agent, session, suffix = 'assigned') {
  return agent.runTurn({
    sessionId: session.id,
    requestId: `contract-${suffix}`,
    input: { type: 'lifecycle_event', event: 'role_assigned' },
  });
}

function assistantEvents(result) {
  return result.events.filter((event) => event.type === 'assistant.completed');
}

function assistantMessage(result) {
  const messages = assistantEvents(result);
  assert.equal(messages.length, 1, '一个普通回合最多产生一条智能体气泡');
  return messages[0];
}

function activeQuestion(session) {
  return session.dialogueState?.pendingQuestion;
}

const arrivalQuestionPattern = /(?:到位了吗|到了吗|到达了吗|看到[^。！？?]{0,20}了吗|在[^。！？?]{0,20}了吗)[？?]?/;

test('角色分配后一次只询问到达，并登记唯一待回答问题', async () => {
  const { agent, session } = await harness();
  const result = await assignRole(agent, session);
  const message = assistantMessage(result);

  assert.match(message.data.text, /到|现场|任务点/);
  assert.doesNotMatch(message.data.text, /准备好|开始了吗/);
  assert.equal(activeQuestion(result.session)?.type, 'arrival_confirmation');
  assert.deepEqual(activeQuestion(result.session)?.expectedActs, ['affirm', 'deny', 'request_navigation']);
  assert.equal(result.session.dialogueState?.confirmedSlots?.arrival, false);
  assert.equal(result.session.dialogueState?.confirmedSlots?.readiness, false);
  assert.equal(result.events.some((event) => event.type === 'stage.started'), false);
  assert.equal(result.events.some((event) => event.type === 'tool.requested'), false);
});

test('快捷回复携带问题ID并走确定性状态转换', async () => {
  const { agent, session } = await harness();
  const assigned = await assignRole(agent, session, 'quick-reply-role');
  const question = activeQuestion(assigned.session);
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-quick-reply-arrival',
    input: {
      type: 'quick_reply',
      questionId: question.id,
      act: 'affirm',
      value: '我已到达',
    },
  });
  assert.equal(result.session.dialogueState.confirmedSlots.arrival, true);
  assert.equal(result.session.dialogueState.confirmedSlots.readiness, false);
  assert.equal(activeQuestion(result.session)?.type, 'readiness_confirmation');
  assert.match(assistantMessage(result).data.text, /准备好开始了吗/);
});

test('规则未命中的自然表达由一次语义理解解析当前待回答问题', async () => {
  // "和队友会合啦"不在 entrySignals 的词表里，必须靠语义理解读出这是在答"到了吗"。
  let understandCalls = 0;
  const understandingLlm = {
    capabilities: () => ({ nativeTools: false, vision: false }),
    generate: async ({ jsonMode }) => {
      understandCalls += 1;
      assert.equal(jsonMode, true, '语义理解必须走 JSON 模式');
      return {
        text: JSON.stringify({
          intent: 'answering_question',
          emotion: 'neutral',
          answersPendingQuestion: true,
          pendingAnswer: 'yes',
          want: '告诉同伴自己已经到位',
          confidence: 0.94,
        }),
        toolCalls: [],
      };
    },
  };
  const { agent, session } = await harness(inertLlm(), understandingLlm);
  await assignRole(agent, session, 'semantic-role');
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-semantic-arrival',
    input: { type: 'user_text', text: '我已经和队友会合啦' },
  });
  assert.equal(understandCalls, 1, '一个回合只做一次语义理解');
  assert.equal(result.session.dialogueState.confirmedSlots.arrival, true);
  assert.equal(activeQuestion(result.session)?.type, 'readiness_confirmation');
  assert.match(assistantMessage(result).data.text, /准备好开始了吗/);
});

test('确认到达后，短回答“好了”解析为当前准备问题并开始阶段', async () => {
  const { agent, session } = await harness();
  await assignRole(agent, session, 'short-answer-role');

  const arrived = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-short-answer-arrived',
    input: { type: 'user_text', text: '我到了' },
  });
  const arrivalReply = assistantMessage(arrived);
  assert.match(arrivalReply.data.text, /准备|现在开始|等一下/);
  assert.doesNotMatch(arrivalReply.data.text, arrivalQuestionPattern);
  assert.equal(arrived.session.dialogueState?.confirmedSlots?.arrival, true);
  assert.equal(arrived.session.dialogueState?.confirmedSlots?.readiness, false);
  assert.equal(activeQuestion(arrived.session)?.type, 'readiness_confirmation');

  const ready = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-short-answer-ready',
    input: { type: 'user_text', text: '好了' },
  });
  assert.equal(ready.session.dialogueState?.confirmedSlots?.arrival, true);
  assert.equal(ready.session.dialogueState?.confirmedSlots?.readiness, true);
  assert.equal(activeQuestion(ready.session), null);
  assert.equal(ready.events.filter((event) => event.type === 'stage.started').length, 1);
});

test('一句“我到了但还没准备好”同时更新到达和准备两个槽位', async () => {
  const { agent, session } = await harness();
  await assignRole(agent, session, 'two-slots-role');

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-two-slots-answer',
    input: { type: 'user_text', text: '我到了但还没准备好' },
  });
  const message = assistantMessage(result);

  assert.equal(result.session.dialogueState?.confirmedSlots?.arrival, true);
  assert.equal(result.session.dialogueState?.confirmedSlots?.readiness, false);
  assert.equal(activeQuestion(result.session)?.type, 'readiness_confirmation');
  assert.match(message.data.text, /等你|准备好|现在开始|等一下/);
  assert.doesNotMatch(message.data.text, arrivalQuestionPattern);
  assert.equal(result.events.some((event) => event.type === 'stage.started'), false);
  assert.equal(result.events.some((event) => event.type === 'tool.requested'), false);
});

test('学生抱怨“你有毒吧”或“一直重复”时进入修复，不再复读到达问题', async (t) => {
  for (const [index, complaint] of ['你有毒吧', '你怎么一直重复'].entries()) {
    await t.test(complaint, async () => {
      const { agent, session } = await harness();
      await assignRole(agent, session, `repair-role-${index}`);
      await agent.runTurn({
        sessionId: session.id,
        requestId: `contract-repair-arrived-${index}`,
        input: { type: 'user_text', text: '我到了' },
      });

      const result = await agent.runTurn({
        sessionId: session.id,
        requestId: `contract-repair-complaint-${index}`,
        input: { type: 'user_text', text: complaint },
      });
      const message = assistantMessage(result);
      const dialogueMove = message.data.dialogueMove || message.data.intent;

      assert.equal(dialogueMove, 'repair_conversation');
      assert.equal(result.session.dialogueState?.repairCount, 1);
      assert.equal(result.session.dialogueState?.confirmedSlots?.arrival, true);
      assert.equal(result.session.dialogueState?.confirmedSlots?.readiness, false);
      assert.match(message.data.text, /刚才|重复|烦|抱歉|你说得对/);
      assert.doesNotMatch(message.data.text, arrivalQuestionPattern);
      assert.equal(result.events.some((event) => event.type === 'stage.started'), false);
    });
  }
});

test('待确认期间连续寒暄会挂起旧问题，下一句“好”不会误确认', async () => {
  const { agent, session } = await harness();
  await assignRole(agent, session, 'greeting-interruption-role');

  const first = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-greeting-interruption-1',
    input: { type: 'user_text', text: '你好' },
  });
  assert.equal(activeQuestion(first.session), null);
  assert.equal(first.session.dialogueState?.interruptedQuestion?.type, 'arrival_confirmation');

  const second = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-greeting-interruption-2',
    input: { type: 'user_text', text: '你好' },
  });
  assert.doesNotMatch(assistantMessage(second).data.text, /问过|选项|到达|准备好开始/);

  const ambiguous = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-greeting-interruption-3',
    input: { type: 'user_text', text: '好' },
  });
  assert.equal(ambiguous.session.dialogueState?.confirmedSlots?.arrival, false);
  assert.equal(ambiguous.session.dialogueState?.confirmedSlots?.readiness, false);
  assert.equal(ambiguous.events.some((event) => event.type === 'stage.started'), false);

  const resumed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-greeting-interruption-4',
    input: { type: 'user_text', text: '继续' },
  });
  assert.equal(resumed.session.dialogueState?.confirmedSlots?.arrival, false);
  assert.equal(resumed.session.dialogueState?.confirmedSlots?.readiness, false);
  assert.equal(activeQuestion(resumed.session)?.type, 'arrival_confirmation');
  assert.equal(resumed.events.some((event) => event.type === 'stage.started'), false);
});

test('连续抱怨保持在对话修复，明确说“继续”后才恢复未完成入场', async () => {
  const { agent, session } = await harness();
  await assignRole(agent, session, 'repair-interruption-role');
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-repair-interruption-arrived',
    input: { type: 'user_text', text: '我到了' },
  });

  await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-repair-interruption-1',
    input: { type: 'user_text', text: '你有毒吧' },
  });
  const repeated = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-repair-interruption-2',
    input: { type: 'user_text', text: '你有毒吧' },
  });
  assert.doesNotMatch(assistantMessage(repeated).data.text, /问过|点下面的选项|到达了吗/);
  assert.equal(repeated.session.dialogueState?.confirmedSlots?.readiness, false);

  const resumed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-repair-interruption-continue',
    input: { type: 'user_text', text: '继续' },
  });
  assert.equal(resumed.session.dialogueState?.confirmedSlots?.arrival, true);
  assert.equal(resumed.session.dialogueState?.confirmedSlots?.readiness, true);
  assert.equal(resumed.events.filter((event) => event.type === 'stage.started').length, 1);
});

test('无语义输入“==”只触发轻量澄清，不推进学习状态', async () => {
  const { agent, session } = await harness();
  await assignRole(agent, session, 'unclear-role');

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-unclear-symbols',
    input: { type: 'user_text', text: '==' },
  });

  assert.equal(result.session.currentTaskIndex, 0);
  assert.deepEqual(result.session.completedTaskIds, []);
  assert.equal(result.session.dialogueState?.confirmedSlots?.arrival, false);
  assert.equal(result.session.dialogueState?.confirmedSlots?.readiness, false);
  assert.equal(activeQuestion(result.session)?.type, 'arrival_confirmation');
  assert.equal(result.events.some((event) => event.type === 'stage.started'), false);
  assert.equal(result.events.some((event) => event.type === 'tool.requested'), false);
});

test('入场和阶段流程气泡不显示课程配置来源标签', async () => {
  const { agent, session } = await harness();
  const assigned = await assignRole(agent, session, 'source-role');
  assert.equal(assistantMessage(assigned).data.source.label, '');

  const started = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-source-started',
    input: { type: 'user_text', text: '我已经到位，也准备好了' },
  });
  const messages = assistantEvents(started);
  assert.ok(messages.length > 0, '阶段开始需要一条当前行动提示');
  for (const message of messages) assert.equal(message.data.source.label, '');
});

test('阶段开始只产生一条当前行动气泡和一张阶段卡', async () => {
  const { agent, session } = await harness();
  await assignRole(agent, session, 'stage-role');

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-stage-started',
    input: { type: 'user_text', text: '我已经到位，也准备好了' },
  });
  const stageCards = result.events.filter((event) => event.type === 'stage.started');
  const messages = assistantEvents(result);

  assert.equal(stageCards.length, 1, '阶段开始必须产生一张阶段卡');
  assert.equal(messages.length, 1, '阶段卡之外只补充一条当前行动气泡');
  assert.ok(stageCards[0].data.stageName);
  assert.ok(stageCards[0].data.mainTask);
  assert.equal(stageCards[0].data.suggestedSeconds, 15 * 60);
  assert.equal(messages[0].data.text.includes(stageCards[0].data.mainTask), false);
});

test('自由文本“完成了”不能推进需要证据验收的结构化小步', async () => {
  const { agent, session } = await harness();
  await assignRole(agent, session, 'evidence-role');
  const started = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-evidence-started',
    input: { type: 'user_text', text: '我已经到位，也准备好了' },
  });
  const taskTool = started.events.find((event) => (
    event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation'
  ));
  assert.ok(taskTool, '进入阶段后应存在等待证据的任务工具');
  const guidanceStepIndex = started.session.taskState.guidanceStepIndex;

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'contract-evidence-text-only',
    input: { type: 'user_text', text: '完成了' },
  });

  assert.equal(result.session.currentTaskIndex, 0);
  assert.deepEqual(result.session.completedTaskIds, []);
  assert.equal(result.session.taskState.guidanceStepIndex, guidanceStepIndex);
  assert.ok(result.session.pendingTools[taskTool.data.callId], '自由文本不能替代当前小步的照片、AI或教师验收');
  assert.equal(result.events.some((event) => event.type === 'stage.started'), false);
});
