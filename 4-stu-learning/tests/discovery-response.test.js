import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: 'ses_discovery_response' });
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

function discoveryUnderstanding() {
  return {
    capabilities: () => ({ nativeTools: false, vision: false }),
    generate: async () => ({
      text: JSON.stringify({
        intent: 'student_discovery',
        emotion: 'neutral',
        answersPendingQuestion: false,
        pendingAnswer: 'unknown',
        hasTaskRequest: true,
        locationKind: 'none',
        want: '分享现场观察和初步猜想',
        confidence: 0.96,
      }),
      toolCalls: [],
    }),
  };
}

function progressSnapshot(session) {
  return {
    currentTaskIndex: session.currentTaskIndex,
    guidanceStepIndex: session.taskState?.guidanceStepIndex,
    stageAnnounced: session.taskState?.stageAnnounced,
    scaffoldLevel: session.scaffoldLevel,
    completedTaskIds: structuredClone(session.completedTaskIds || []),
    completedStepIds: structuredClone(session.learningState?.completedStepIds || []),
    stepStatus: structuredClone(session.learningState?.stepStatus || {}),
    finalization: structuredClone(session.taskState?.finalization || null),
    pendingAdvance: structuredClone(session.pendingAdvance || null),
    pendingToolIds: Object.keys(session.pendingTools || {}).sort(),
    activeToolCallId: session.learningState?.activeToolCallId || '',
  };
}

async function harness(mainGenerate) {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const calls = [];
  const agent = createAgentService({
    llm: {
      capabilities: () => ({ nativeTools: true, vision: false }),
      generate: async (input) => {
        calls.push(input);
        return mainGenerate(input);
      },
    },
    understandingLlm: discoveryUnderstanding(),
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'dragon-counter',
    studentId: 'student-discovery',
    groupId: 'group-discovery',
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'discovery-enter-stage',
    input: { type: 'user_text', text: '我已经到位，也准备好了' },
  });
  return { agent, course, session, calls };
}

test('学生发现由主模型结合当前任务引导回应，且不推进任务或偷跑 L1', async () => {
  const { agent, session, calls } = await harness(async () => ({
    text: '你注意到了嘴部开口，这个观察很具体。它和台基交界的位置，还能给你的猜想增加什么证据？',
    toolCalls: [],
  }));
  const before = progressSnapshot(session);

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'discovery-safe-response',
    input: { type: 'user_text', text: '我发现它们的嘴都是张开的，好像和水有关系。' },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');
  const prompt = calls[0];

  assert.equal(calls.length, 1, '发现回合调用一次主模型生成教学回应');
  assert.equal(message.data.intent, 'student_discovery');
  assert.equal(message.data.source.mode, 'course-config');
  assert.deepEqual(message.data.source.citations, []);
  assert.match(message.data.text, /嘴部开口/);
  assert.match(prompt.instructions, /任务：观其形/);
  assert.match(prompt.instructions, /当前小步/);
  assert.match(prompt.instructions, /对学生的每一个发现都表现出真诚的兴趣/);
  assert.match(prompt.instructions, /当学生发现排水功能时/);
  assert.match(prompt.instructions, /绝对禁止/);
  assert.match(prompt.instructions, /先具体承接学生说出的可观察内容/);
  assert.doesNotMatch(prompt.instructions, /画面里除了对象本身.*台基边缘.*周围参照/);
  assert.doesNotMatch(prompt.instructions, /当前脚手架档位语义/);
  assert.doesNotMatch(prompt.instructions, /\[可用课程知识\]/);
  assert.deepEqual(prompt.tools, []);
  assert.equal(result.events.some((event) => event.type === 'tool.requested'), false);
  assert.equal(result.events.some((event) => event.type === 'stage.started'), false);
  assert.equal(result.events.some((event) => event.type === 'ui.quick_replies'), false);
  assert.deepEqual(progressSnapshot(result.session), before);
  assert.equal(
    result.session.conversationState.recentTutorActions.at(-1).action,
    'respond_to_discovery',
  );
});

test('发现回应模型失败时使用专用降级话术，学习状态仍保持不变', async () => {
  const { agent, session } = await harness(async () => {
    throw new Error('主模型暂时不可用');
  });
  const before = progressSnapshot(session);

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'discovery-degraded-response',
    input: { type: 'user_text', text: '我发现有的嘴更大，有的嘴更小。' },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');

  assert.equal(message.data.intent, 'student_discovery');
  assert.equal(message.data.degraded, true);
  assert.match(message.data.text, /收到你的发现/);
  assert.doesNotMatch(message.data.text, /你是在问当前任务/);
  assert.equal(result.events.some((event) => event.type === 'tool.requested'), false);
  assert.deepEqual(progressSnapshot(result.session), before);
});

test('发现回应即使生成受保护结论，也继续经过统一防剧透终检', async () => {
  const { agent, session } = await harness(async () => ({
    text: '螭首就是排水口，水从螭首嘴里流出。',
    toolCalls: [],
  }));
  const before = progressSnapshot(session);

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'discovery-protected-response',
    input: { type: 'user_text', text: '我猜它可能和下雨有关。' },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');

  assert.doesNotMatch(message.data.text, /螭首就是排水口|水从螭首嘴里流出/);
  assert.match(message.data.text, /探索区/);
  assert.deepEqual(progressSnapshot(result.session), before);
});
