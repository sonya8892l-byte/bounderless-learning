import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { createAgentService } from '../server/agent/service.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

// 语义理解（D6）用的轻量模型桩：按意图返回结构化 JSON。
// 与主模型分开注入，这样"整轮只调一次主模型"这类断言仍然精确。
function understandingLlm(intent = 'chat_offtopic', extra = {}) {
  let calls = 0;
  return {
    capabilities: () => ({ nativeTools: false, vision: false }),
    get calls() { return calls; },
    generate: async () => {
      calls += 1;
      return {
        text: JSON.stringify({
          intent,
          emotion: 'neutral',
          answersPendingQuestion: false,
          want: '',
          confidence: 0.9,
          ...extra,
        }),
        toolCalls: [],
      };
    },
  };
}

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = {
        id: 'ses_test', courseId: values.courseId, roleId: values.roleId,
        studentId: values.studentId, groupId: values.groupId, phaseId: values.phaseId,
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

test('runTurn 可把完整事件交给原子持久化回调，且不重复调用普通 save', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const store = memoryStore();
  const ordinarySave = store.save.bind(store);
  let ordinarySaveCalls = 0;
  store.save = async (session) => {
    ordinarySaveCalls += 1;
    return ordinarySave(session);
  };
  const agent = createAgentService({
    llm: {
      capabilities: () => ({ nativeTools: true, vision: false }),
      generate: async () => ({ text: '', toolCalls: [] }),
    },
    store,
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'dragon-counter',
    studentId: 'atomic-student',
    groupId: 'atomic-group',
  });
  let persisted = null;

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'atomic-turn-request',
    input: { type: 'lifecycle_event', event: 'role_assigned' },
    async persistSession(value) {
      persisted = structuredClone(value);
      await ordinarySave(value.session);
    },
  });

  assert.equal(ordinarySaveCalls, 1, 'createSession 后的 turn 不应再走普通 save');
  assert.ok(persisted.events.some((event) => event.type === 'assistant.completed'));
  assert.ok(persisted.events.some((event) => event.type === 'state.updated'));
  assert.deepEqual(persisted.events, result.events);
  assert.ok(persisted.session.handledRequestIds.includes('atomic-turn-request'));
});

async function enterFirstStage(agent, session, prefix = 'entry') {
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: `${prefix}-ready`,
    input: { type: 'user_text', text: '我已经到位，也准备好了' },
  });
  return {
    result,
    taskRequest: result.events.find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation'),
  };
}

async function completeCurrentTaskSteps(agent, session, task, prefix = 'step') {
  const toolValues = {};
  for (let stepIndex = 0; stepIndex < task.steps.length; stepIndex += 1) {
    const step = task.steps[stepIndex];
    const photo = step.tools.find((tool) => tool.id === 'photo');
    const photoCount = Number(photo?.config?.minCount || 0);
    toolValues[step.id] = photo ? { photo: { count: photoCount } } : {};
    await agent.runTurn({
      sessionId: session.id,
      requestId: `${prefix}-${stepIndex}`,
      input: {
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: {
          taskId: task.id,
          stepId: step.id,
          stepIndex,
          stepText: step.studentAction,
          localEvidenceCount: photoCount,
          toolValues: { [step.id]: toolValues[step.id] },
          stepImages: photo ? ['data:image/jpeg;base64,AA=='] : [],
        },
      },
    });
  }
  return toolValues;
}

test('状态机只接受当前工具调用，并在证据提交后推进任务', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  // 本用例专门验证任务级整包证据提交，因此显式使用该收口模式。
  // 真课程的默认 auto_on_last_step 由其他回归用例覆盖。
  const task = course.roles.find((role) => role.id === 'dragon-counter').tasks[0];
  task.finalizationMode = 'explicit_bundle_submit';
  const outputs = [
    { text: '证据已记录，继续下一项。', toolCalls: [{ id: 'task-2-call', name: 'open_task_tool', arguments: { toolInstanceId: 'dragon-counter:task-2:primary', reason: '继续采证' } }] },
  ];
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: true }),
    generate: async (request) => request.jsonMode
      ? ({ text: '{"passed":true,"feedback":"照片证据达到当前小步要求。","missing":[]}', toolCalls: [] })
      : outputs.shift(),
  };
  const agent = createAgentService({ llm, store: memoryStore(), getCourse: async () => course });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  const first = await agent.runTurn({ sessionId: session.id, requestId: 'r1', input: { type: 'lifecycle_event', event: 'role_assigned' } });
  assert.equal(first.events.some((event) => event.type === 'tool.requested'), false);
  const entryMessage = first.events.find((event) => event.type === 'assistant.completed').data.text;
  assert.match(entryMessage, /到|到达/);
  assert.doesNotMatch(entryMessage, /准备好/);
  const { result: arrived, taskRequest } = await enterFirstStage(agent, session, 'r2');
  assert.equal(taskRequest.data.payload.taskIndex, 0);
  assert.equal(arrived.events.some((event) => event.type === 'stage.started'), true);
  assert.equal(arrived.session.locationState.status, 'arrived');
  assert.equal(arrived.session.locationState.verifiedBy, 'manual');
  const toolValues = await completeCurrentTaskSteps(agent, session, task, 'r2-step');
  const submitted = await agent.runTurn({
    sessionId: session.id, requestId: 'r3',
    input: {
      type: 'tool_result', toolCallId: taskRequest.data.callId,
      result: {
        status: 'completed', values: { text: '拍到了五张不同角度的照片', toolValues },
        evidence: Array.from({ length: 5 }, (_, index) => ({ id: `ev-${index}`, url: `/uploads/${index}.jpg` })),
      },
    },
  });
  assert.equal(submitted.session.currentTaskIndex, 1);
  assert.deepEqual(submitted.session.completedTaskIds, ['dragon-counter:task-1']);
  assert.equal(submitted.events.find((event) => event.type === 'tool.requested').data.payload.taskIndex, 1);
});

test('照片数量不足返回课程校验原因，不伪装成模型连接失败', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  // EVIDENCE_MINIMUM 是任务级整包提交的校验，夹具必须显式选用该模式。
  const task = course.roles.find((role) => role.id === 'dragon-counter').tasks[0];
  task.finalizationMode = 'explicit_bundle_submit';
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: true }),
    generate: async (request) => request.jsonMode
      ? ({ text: '{"passed":true,"feedback":"照片证据达到当前小步要求。","missing":[]}', toolCalls: [] })
      : ({ text: '已检查。', toolCalls: [] }),
  };
  const agent = createAgentService({ llm, store: memoryStore(), getCourse: async () => course });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  const assigned = await agent.runTurn({
    sessionId: session.id,
    requestId: 'photo-min-1',
    input: { type: 'lifecycle_event', event: 'role_assigned' },
  });
  assert.equal(assigned.events.some((event) => event.type === 'tool.requested'), false);
  const { taskRequest: taskCall } = await enterFirstStage(agent, session, 'photo-min-2');
  const toolValues = await completeCurrentTaskSteps(agent, session, task, 'photo-step');
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id,
      requestId: 'photo-min-3',
      input: {
        type: 'tool_result',
        toolCallId: taskCall.data.callId,
        result: {
          status: 'completed',
          values: { text: '', toolValues },
          evidence: [{ id: 'ev-one', url: '/uploads/one.png' }],
        },
      },
    }),
    (error) => error.code === 'EVIDENCE_MINIMUM' && /已提交 1 张.*还需要 4 张/.test(error.message),
  );
  assert.equal(session.currentTaskIndex, 0);
  assert.deepEqual(session.completedTaskIds, []);
  assert.ok(session.pendingTools[taskCall.data.callId], '数量不足后应保留原任务调用，允许继续补照片再提交');
  const retried = await agent.runTurn({
    sessionId: session.id,
    requestId: 'photo-min-4',
    input: {
      type: 'tool_result',
      toolCallId: taskCall.data.callId,
      result: {
        status: 'completed',
        values: { text: '', toolValues },
        evidence: Array.from({ length: 5 }, (_, index) => ({ id: `ev-${index}`, url: `/uploads/${index}.png` })),
      },
    },
  });
  assert.equal(retried.session.currentTaskIndex, 1);
});

test('简短问候由轻量语义理解判定，自然接住且不调主模型、不检索课程', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  let modelCalls = 0;
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => { modelCalls += 1; return { text: '你好呀，我是絮絮～我在呢。', toolCalls: [] }; },
  };
  const light = understandingLlm('greeting');
  const agent = createAgentService({
    llm,
    understandingLlm: light,
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'hello-1',
    input: { type: 'user_text', text: '你好' },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');
  assert.match(message.data.text, /你好呀.*絮絮/);
  assert.equal(message.data.source.label, '', '寒暄不应标注课程来源');
  assert.equal(message.data.intent, 'social');
  assert.equal(light.calls, 1, '语言输入必经一次语义理解');
  // D6：寒暄改为自然生成，不再用写死话术顶回去，所以这里主模型要被调到。
  assert.equal(modelCalls, 1);
  assert.equal(result.session.conversationState.recentTutorActions.at(-1).action, 'reply_natural');
});

test('静默状态心跳不打扰学生，达到课程阈值后由规则层生成一次提醒', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  let modelCalls = 0;
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => {
      modelCalls += 1;
      return { text: '还顺利吗？如果找不到观察点，我可以再打开位置卡。', toolCalls: [] };
    },
  };
  const store = memoryStore();
  const agent = createAgentService({ llm, store, getCourse: async () => course });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  const quiet = await agent.runTurn({
    sessionId: session.id,
    requestId: 'tick-1',
    input: { type: 'lifecycle_event', event: 'context_tick', data: { pageVisible: true, hasDraft: false } },
  });
  assert.equal(quiet.events.some((event) => event.type === 'assistant.completed'), false);
  assert.equal(modelCalls, 0);

  session.taskState.lastMeaningfulActionAt = new Date(Date.now() - 9 * 60_000).toISOString();
  await store.save(session);
  const nudged = await agent.runTurn({
    sessionId: session.id,
    requestId: 'tick-2',
    input: { type: 'lifecycle_event', event: 'context_tick', data: { pageVisible: true, hasDraft: false } },
  });
  assert.equal(nudged.events.some((event) => event.type === 'assistant.completed'), true);
  assert.equal(nudged.session.conversationState.nudgeCount, 1);
  assert.equal(modelCalls, 0);
});

test('学生口头说完成不会推进任务，只有通过工具提交才更新状态', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => ({ text: '收到。请在任务卡里提交证据，我才能帮你检查。', toolCalls: [] }),
  };
  const agent = createAgentService({ llm, store: memoryStore(), getCourse: async () => course });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  await enterFirstStage(agent, session, 'done-entry');
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'done-1',
    input: { type: 'user_text', text: '我做完了' },
  });
  assert.equal(result.session.currentTaskIndex, 0);
  assert.deepEqual(result.session.completedTaskIds, []);
});

test('明确位置问题由流程层即时打开导航，不等待模型选择工具', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  let modelCalls = 0;
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => { modelCalls += 1; throw new Error('位置问题不应调用主模型'); },
  };
  const light = understandingLlm('asking_location');
  const agent = createAgentService({
    llm, understandingLlm: light, store: memoryStore(), getCourse: async () => course,
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'navigation-1',
    input: { type: 'user_text', text: '我现在刚到午门，太和殿在哪儿？' },
  });
  assert.equal(modelCalls, 0, '导航有确定的工具动作，不应等主模型');
  assert.equal(light.calls, 1);
  assert.match(result.events.find((event) => event.type === 'assistant.completed').data.text, /高德地图/);
  assert.equal(result.events.find((event) => event.type === 'tool.requested').data.payload.renderer, 'navigation');
});

test('模型连接失败时返回同伴式降级消息，不抛出整轮错误', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const warnings = [];
  const upstreamError = Object.assign(new Error('上游拒绝：secret-token-must-not-leak'), {
    name: 'LLMError',
    status: 403,
    body: 'api-key=secret-token-must-not-leak',
  });
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => { throw upstreamError; },
  };
  const agent = createAgentService({
    llm,
    store: memoryStore(),
    getCourse: async () => course,
    logger: {
      warn(fields, message) {
        warnings.push({ fields, message });
      },
    },
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  await enterFirstStage(agent, session, 'degraded-entry');
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'degraded-1',
    input: { type: 'user_text', text: '我想先跟你聊聊天' },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');
  assert.equal(message.data.degraded, true);
  assert.match(message.data.text, /确认|我在|连接/);
  assert.deepEqual(warnings, [{
    fields: {
      modelError: {
        name: 'LLMError',
        code: null,
        status: 403,
      },
    },
    message: 'model request degraded',
  }]);
  assert.doesNotMatch(JSON.stringify(warnings), /secret-token|api-key/);
});

test('任务求助直接使用课程脚手架即时回应，不占用模型调用', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  let modelCalls = 0;
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => { modelCalls += 1; throw new Error('课程脚手架不应等待主模型'); },
  };
  const light = understandingLlm('help_stuck');
  const agent = createAgentService({
    llm, understandingLlm: light, store: memoryStore(), getCourse: async () => course,
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  await enterFirstStage(agent, session, 'help-entry');
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'task-help-1',
    input: { type: 'user_text', text: '我不知道这个任务怎么做，给我一点提示' },
    onTextDelta: () => {},
  });
  assert.equal(modelCalls, 0, '分级提示是课程原文，直接用');
  const message = result.events.find((event) => event.type === 'assistant.completed');
  assert.match(message.data.text, /先试一个小步骤/);
  assert.match(message.data.text, /画面里除了对象本身.*台基边缘.*周围参照/);
  assert.doesNotMatch(message.data.text, /检查这张图能不能说清它与台基的位置关系/);
  assert.equal(message.data.source.mode, 'course-config');
  assert.equal(result.session.conversationState.recentTutorActions.at(-1).action, 'give_scaffold');
});

test('受保护内容在流式分片中被拦截，整轮只调用一次模型', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  let modelCalls = 0;
  const deltas = [];
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async ({ onTextDelta }) => {
      modelCalls += 1;
      onTextDelta?.('答案可能是1');
      onTextDelta?.('142个。');
      return { text: '答案可能是1142个。', toolCalls: [] };
    },
  };
  const agent = createAgentService({
    llm,
    understandingLlm: understandingLlm('chat_offtopic'),
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'dragon-counter', studentId: 's1', groupId: 'g1' });
  await enterFirstStage(agent, session, 'stream-guard-entry');
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'stream-guard-1',
    input: { type: 'user_text', text: '我们随便聊聊吧' },
    onTextDelta: (text) => deltas.push(text),
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');
  assert.equal(modelCalls, 1);
  assert.equal(deltas.join('').includes('1142'), false);
  assert.match(message.data.text, /仍在探索区/);
});

test('时间银行拍照任务必须上传真实证据，不能再用完成按钮直接通过', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const store = memoryStore();
  const mutationGuards = [];
  const agent = createAgentService({
    llm: { capabilities: () => ({ nativeTools: true }), generate: async () => ({ text: '', toolCalls: [] }) },
    store,
    getCourse: async () => course,
    async persistLearnerMutation(session, runtimeGuard) {
      mutationGuards.push(structuredClone(runtimeGuard));
      return store.save(session);
    },
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'map-strategist', studentId: 's-bank-photo', groupId: 'g1' });
  const missing = await agent.answerTimeBank({ sessionId: session.id, taskId: 'tb-05', evidence: [] });
  assert.equal(missing.correct, false);
  const passed = await agent.answerTimeBank({
    sessionId: session.id,
    taskId: 'tb-05',
    evidence: [{ id: 'ev-bank-photo', url: '/uploads/photo.jpg', mimeType: 'image/jpeg' }],
  });
  assert.equal(passed.correct, true);
  assert.equal(session.learningState.evidenceIds.includes('ev-bank-photo'), true);
  session.timeBalance = 5;
  await agent.giftTime({ sessionId: session.id, roleId: 'signaler', amount: 1 });
  assert.deepEqual(mutationGuards, [
    { required: true, operation: 'time_bank_answer' },
    { required: true, operation: 'time_bank_gift' },
  ]);
});

test('时间银行定位签到按课程坐标和半径校验', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const agent = createAgentService({
    llm: { capabilities: () => ({ nativeTools: true }), generate: async () => ({ text: '', toolCalls: [] }) },
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId: 'map-strategist', studentId: 's-bank-location', groupId: 'g1' });
  const outside = await agent.answerTimeBank({
    sessionId: session.id, taskId: 'tb-08', location: { lng: 116.1, lat: 39.7, accuracyMeters: 10 },
  });
  assert.equal(outside.correct, false);
  const inside = await agent.answerTimeBank({
    sessionId: session.id, taskId: 'tb-08', location: { lng: 116.3953, lat: 40.0071, accuracyMeters: 10 },
  });
  assert.equal(inside.correct, true);
});

test('结构化小步由服务端校验当前工具结果，空结果不能绕过扫码步骤', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const agent = createAgentService({
    llm: {
      capabilities: () => ({ nativeTools: true, vision: true }),
      generate: async () => ({ text: '{"passed":true,"feedback":"展项主体与标题可核对。","missing":[]}', toolCalls: [] }),
    },
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'map-strategist',
    studentId: 's-step-validation',
    groupId: 'g1',
  });
  await enterFirstStage(agent, session, 'scanner-step-entry');
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id,
      requestId: 'scanner-step-empty',
      input: {
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: { taskId: 'task-1', stepIndex: 0, toolValues: {} },
      },
    }),
    (error) => error.code === 'STEP_SCAN_REQUIRED',
  );
  assert.equal(session.taskState.guidanceStepIndex, 0);
  const completed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'scanner-step-valid',
    input: {
      type: 'lifecycle_event',
      event: 'task_step_completed',
      data: {
        taskId: 'task-1',
        stepIndex: 0,
        toolValues: {
          'map-locate-exhibit': {
            scanner: { result: '已采集待AI核验的实物图像' },
          },
        },
        stepImages: ['data:image/jpeg;base64,AA=='],
      },
    },
  });
  assert.equal(completed.session.taskState.guidanceStepIndex, 1);
});

test('ai_evaluation 小步只有模型验收通过后才推进，并接收画板图像', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const evaluationCalls = [];
  const outputs = [
    { text: '{"passed":true,"feedback":"展项主体与标题可核对。","missing":[]}', toolCalls: [] },
    { text: '{"passed":true,"feedback":"全景和局部证据能够互相核对。","missing":[]}', toolCalls: [] },
    { text: '{"passed":false,"feedback":"方向关系还不清楚。","missing":["补一组相对方向箭头"]}', toolCalls: [] },
    { text: '{"passed":true,"feedback":"水系与方向已经可以互相核对。","missing":[]}', toolCalls: [] },
  ];
  const agent = createAgentService({
    llm: {
      capabilities: () => ({ nativeTools: true, vision: true }),
      generate: async (request) => {
        evaluationCalls.push(request);
        return outputs.shift();
      },
    },
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'map-strategist',
    studentId: 's-ai-evaluation',
    groupId: 'g1',
  });
  await enterFirstStage(agent, session, 'ai-step-entry');
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'ai-step-scanner',
    input: {
      type: 'lifecycle_event', event: 'task_step_completed',
      data: {
        taskId: 'task-1', stepIndex: 0,
        toolValues: { 'map-locate-exhibit': { scanner: { result: '已采集待AI核验的实物图像' } } },
        stepImages: ['data:image/jpeg;base64,AA=='],
      },
    },
  });
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id,
      requestId: 'ai-step-scanner-stale',
      input: {
        type: 'lifecycle_event', event: 'task_step_completed',
        data: {
          taskId: 'task-1', stepIndex: 0,
          toolValues: { 'map-locate-exhibit': { scanner: { result: '重复的旧结果' } } },
        },
      },
    }),
    (error) => error.code === 'TASK_STEP_EXPIRED',
  );
  assert.equal(session.taskState.guidanceStepIndex, 1);
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'ai-step-photo',
    input: {
      type: 'lifecycle_event', event: 'task_step_completed',
      data: {
        taskId: 'task-1', stepIndex: 1,
        toolValues: { 'map-capture-water-system': { photo: { count: 2 } } },
        stepImages: ['data:image/jpeg;base64,AA=='],
      },
    },
  });
  const image = 'data:image/jpeg;base64,AA==';
  const retry = await agent.runTurn({
    sessionId: session.id,
    requestId: 'ai-step-retry',
    input: {
      type: 'lifecycle_event', event: 'task_step_completed',
      data: {
        taskId: 'task-1', stepIndex: 2,
        toolValues: { 'map-annotate-water-system': { sketch: { completed: true } } },
        stepImages: [image],
      },
    },
  });
  assert.equal(retry.session.taskState.guidanceStepIndex, 2);
  assert.match(retry.events.find((event) => event.type === 'assistant.completed').data.text, /方向关系还不清楚/);

  const passed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'ai-step-pass',
    input: {
      type: 'lifecycle_event', event: 'task_step_completed',
      data: {
        taskId: 'task-1', stepIndex: 2,
        toolValues: { 'map-annotate-water-system': { sketch: { completed: true } } },
        stepImages: [image],
      },
    },
  });
  assert.equal(passed.session.currentTaskIndex, 1, '最后一个 Step 验收通过后应自动完成并推进任务');
  assert.deepEqual(passed.session.completedTaskIds, ['map-strategist:task-1']);
  assert.equal(passed.session.taskState.guidanceStepIndex, 0, '推进后的小步索引属于下一任务');
  assert.equal(
    passed.events.find((event) => event.type === 'tool.requested')?.data.payload.taskIndex,
    1,
    '同一轮应打开下一任务卡',
  );
  assert.equal(evaluationCalls.length, 4);
  assert.deepEqual(evaluationCalls[2].images, [image]);
  assert.equal(evaluationCalls[2].jsonMode, true);
  assert.match(evaluationCalls[0].instructions, /\[平台规则｜最高优先级\]/);
  assert.match(evaluationCalls[0].instructions, /禁止建议学生攀爬、跳跃、靠近水域边缘/);
  assert.match(evaluationCalls[0].instructions, /不主动询问学生的家庭信息、联系方式、健康状况/);
  assert.ok(evaluationCalls[0].instructions.indexOf('[平台规则｜最高优先级]') < evaluationCalls[0].instructions.indexOf('[小步验收器职责]'));
  assert.match(evaluationCalls[0].messages[0].content, /当前小步限制：[\s\S]*一渡完整方案/);
  assert.match(evaluationCalls[1].messages[0].content, /当前小步限制：[\s\S]*不生成毛泽东/);
});
