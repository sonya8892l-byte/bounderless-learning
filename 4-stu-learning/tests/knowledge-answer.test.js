import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: 'ses_knowledge_answer' });
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

function knowledgeUnderstanding() {
  return {
    capabilities: () => ({ nativeTools: false, vision: false }),
    generate: async () => ({
      text: JSON.stringify({
        intent: 'asking_knowledge',
        emotion: 'neutral',
        answersPendingQuestion: false,
        pendingAnswer: 'unknown',
        want: '',
        confidence: 0.99,
      }),
      toolCalls: [],
    }),
  };
}

test('知识回答由模型围绕检索证据总结，并随消息返回可核查来源', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const calls = [];
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    async generate(input) {
      calls.push(input);
      return {
        text: '螭首内部连接排水通道，雨水顺着台基微坡汇入排水孔，再从螭首口排出。',
        toolCalls: [],
      };
    },
  };
  const agent = createAgentService({
    llm,
    understandingLlm: knowledgeUnderstanding(),
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'dragon-counter',
    studentId: 'student-knowledge',
    groupId: 'group-1',
  });
  session.completedTaskIds.push('dragon-counter:task-1');

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'knowledge-source-1',
    input: { type: 'user_text', text: '螭首有什么用？为什么它能排水？' },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');

  assert.equal(message.data.intent, 'course_knowledge');
  assert.equal(message.data.source.mode, 'course');
  assert.equal(message.data.source.citations[0].id, 'K-03');
  assert.match(message.data.source.label, /故宫博物院古建研究/);
  assert.match(calls[0].instructions, /K-03 螭首排水功能/);
  assert.match(calls[0].instructions, /先直接回答他当前的问题/);
  assert.doesNotMatch(message.data.text, /根据课程材料[，,]/, '正文不需要机械朗读来源前缀');
});

test('课程资料未覆盖时明确标注材料不足，不伪装成模型来源', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  let instructions = '';
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    async generate(input) {
      instructions = input.instructions;
      return { text: '这部分课程材料现在还没有开放，我先不猜；可以把问题记下来请老师一起核对。', toolCalls: [] };
    },
  };
  const agent = createAgentService({
    llm,
    understandingLlm: knowledgeUnderstanding(),
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'dragon-counter',
    studentId: 'student-knowledge-missing',
    groupId: 'group-1',
  });

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'knowledge-source-missing',
    input: { type: 'user_text', text: '故宫排水有什么局限？' },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');

  assert.equal(message.data.source.mode, 'course-missing');
  assert.equal(message.data.source.label, '[课程资料暂未覆盖]');
  assert.deepEqual(message.data.source.citations, []);
  assert.match(instructions, /课程知识库暂未检索到/);
  assert.match(instructions, /不要猜测/);
});
