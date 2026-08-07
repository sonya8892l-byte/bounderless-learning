/**
 * 活动组织信息回合（分诊链 L3）的验收。
 *
 * 这一层治的是过去无处可去的一类问题：学生问"几点集合""厕所在哪""接下来干什么"，
 * 旧实现把它们落进默认自然回应，于是要么被防复读改成指回任务，要么让模型自由发挥
 * 编一个楼层出来。这里锁三件事：如实回答、只用课程包里有的字段、没有的明说不知道。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { createAgentService } from '../server/agent/service.js';
import { buildAgentPrompt } from '../server/agent/prompt.js';
import { decisionForTutorAction } from '../server/agent/turn-router.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = {
        id: 'ses_logistics', ...values,
        phaseNumber: 2, currentTaskIndex: 0, scaffoldLevel: 0, completedTaskIds: [],
        events: [], messages: [], pendingTools: {}, handledRequestIds: [],
        timeBalance: 0, timeEarned: 0, completedBankTaskIds: [], gifts: [],
      };
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

function understandingFor(overrides) {
  return {
    capabilities: () => ({ nativeTools: false, vision: false }),
    generate: async () => ({
      text: JSON.stringify({
        intent: 'asking_logistics',
        emotion: 'neutral',
        answersPendingQuestion: false,
        pendingAnswer: 'unknown',
        hasTaskRequest: true,
        locationKind: 'none',
        want: '',
        confidence: 0.9,
        ...overrides,
      }),
      toolCalls: [],
    }),
  };
}

async function harness(understandingOverrides = {}) {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhizhi_001' });
  const prompts = [];
  const agent = createAgentService({
    llm: {
      capabilities: () => ({ nativeTools: true, vision: false }),
      generate: async ({ instructions }) => {
        prompts.push(instructions);
        return { text: '这个阶段计划 27 分钟，具体以老师安排为准。', toolCalls: [] };
      },
    },
    understandingLlm: understandingFor(understandingOverrides),
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id, roleId: course.roles[0].id, studentId: 'st-logistics', groupId: 'g1',
  });
  return { agent, session, course, prompts };
}

async function say(agent, session, text, index) {
  const result = await agent.runTurn({
    sessionId: session.id, requestId: `logistics-${index}`, input: { type: 'user_text', text },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');
  return { result, intent: message?.data.intent || '', text: message?.data.text || '' };
}

test('问活动安排走组织信息回合，不被当成任务求助', async () => {
  const { agent, session } = await harness();
  await say(agent, session, '我已经到位，也准备好了', 'entry');
  const turn = await say(agent, session, '我们几点结束', 'ask');

  assert.equal(turn.intent, 'activity_logistics');
  assert.ok(turn.text.trim(), '组织信息问题必须得到回答');
});

test('组织信息回合的 Prompt 只装配运营字段，且带上"不许猜"硬约束', async () => {
  const { agent, session, prompts } = await harness();
  await say(agent, session, '我已经到位，也准备好了', 'entry');
  await say(agent, session, '我们几点结束', 'ask');

  const prompt = prompts.at(-1);
  assert.match(prompt, /活动组织信息/);
  assert.match(prompt, /国家动物博物馆/, '场地取自课程 md');
  assert.match(prompt, /不许推测/, '硬约束必须在 Prompt 里');
  assert.match(prompt, /问一下带队老师最快/, '信息缺失话术必须给到模型');
});

test('课程包没写的设施方位不进 Prompt——不给模型可编的素材', async () => {
  const { course } = await harness();
  const role = course.roles[0];
  const decision = decisionForTutorAction('answer_logistics', {});
  const { instructions } = buildAgentPrompt({
    course,
    session: {
      id: 's', phaseId: course.lesson.roleSystem.phaseId, currentTaskIndex: 0, scaffoldLevel: 0,
      messages: [], completedTaskIds: [], events: [],
    },
    role,
    knowledge: [],
    input: { type: 'user_text', text: '厕所在哪' },
    decision,
  });

  assert.doesNotMatch(instructions, /厕所在[一二三四五1-5]层/);
  assert.doesNotMatch(instructions, /饮水处在/);
});

test('组织信息回合不检索课程知识库，也不给脚手架', () => {
  const decision = decisionForTutorAction('answer_logistics', {});

  assert.equal(decision.needsKnowledge, false, '组织信息不是课程知识');
  assert.equal(decision.includeLogistics, true);
  assert.equal(decision.fastGuidance, undefined, '不是教学回合，不走脚手架');
});

test('平台 logistics.md 缺失时回落到代码内默认，不报错', async () => {
  const { resolveLogistics } = await import('../server/course/platform-defaults.js');
  const { logistics, warnings } = resolveLogistics(null, {});

  assert.deepEqual(warnings, []);
  assert.ok(logistics.phrases['信息缺失'].includes('带队老师'));
  assert.ok(logistics.constraints.length > 0, '缺文件也必须有硬约束文本');
});

test('课程可以覆盖组织信息话术', async () => {
  const { resolveLogistics } = await import('../server/course/platform-defaults.js');
  const { logistics } = resolveLogistics(null, { 信息缺失: '这个我不清楚，去问李老师。' });

  assert.equal(logistics.phrases['信息缺失'], '这个我不清楚，去问李老师。');
});
