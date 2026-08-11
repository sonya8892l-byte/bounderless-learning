/**
 * `推进方式` 的三条路（R3-0）。
 *
 * 改造前只有 `auto_after_validation` 真会推进：另外两个值只往 `input.data` 写一个
 * 全仓零消费的标记，而 `input.data` 是单次回合的载荷，教师指令要等下一次轮询才到，
 * 于是任务做完就永久卡住。存量已经踩到——`lesson_zhizhi_001` 的 `assembly-speaker`
 * 有一个 `推进方式：teacher` 的任务。详见 server/agent/task-advance.js 模块头。
 *
 * 这里钉三件事：等待态跨回合活着、解除入口认人、主路径逐字节不变。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createAgentService } from '../server/agent/service.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = {
        id: 'ses_advance', courseId: values.courseId, roleId: values.roleId,
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

/** 主模型调用计数分开记：验收用的 jsonMode 请求不算"絮絮开口"。 */
function countingLlm() {
  let mainCalls = 0;
  return {
    get mainCalls() { return mainCalls; },
    capabilities: () => ({ nativeTools: true, vision: true }),
    generate: async (request) => {
      if (request.jsonMode) return { text: '{"passed":true,"feedback":"证据符合要求。","missing":[]}', toolCalls: [] };
      mainCalls += 1;
      return { text: '好的，继续。', toolCalls: [] };
    },
  };
}

/**
 * 把一个角色带到"第 taskIndex 个任务刚提交完"的状态。
 *
 * 注意课程对象有两份角色数组：`course.roles` 是服务端私有视图（agent 读它），
 * `course.lesson.roles` 是编译产物。改 advanceMode 必须改前者，否则改了个没人看的副本。
 */
async function runUpToSubmission({ courseId, roleId, advanceModes = {} }) {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId });
  const role = course.roles.find((item) => item.id === roleId);
  for (const [index, mode] of Object.entries(advanceModes)) role.tasks[Number(index)].advanceMode = mode;
  const llm = countingLlm();
  const store = memoryStore();
  const agent = createAgentService({ llm, store, getCourse: async () => course });
  const { session } = await agent.createSession({ courseId: course.id, roleId, studentId: 'advance-student', groupId: 'advance-group' });
  await agent.runTurn({ sessionId: session.id, requestId: 'assign', input: { type: 'lifecycle_event', event: 'role_assigned' } });
  const ready = await agent.runTurn({ sessionId: session.id, requestId: 'ready', input: { type: 'user_text', text: '我已经到位，也准备好了' } });
  const taskRequest = ready.events.find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation');
  return { agent, session, role, llm, store, taskRequest };
}

/**
 * 按小步的工具配置凑出一份刚好过服务端校验的工具值。
 *
 * 这里不写死字段名：`lesson_gewu_001` 是照片，`lesson_zhizhi_001` 是必填文字表单和
 * 团队记录，写死任何一门课的字段都会让另一门课在校验层就红，测不到推进本身。
 */
function satisfyStepTools(step) {
  const values = {};
  for (const tool of step.tools || []) {
    const config = tool.config || {};
    if (tool.id === 'photo') values.photo = { count: Number(config.minCount || 1) };
    if (tool.id === 'text') {
      values.text = { fields: Object.fromEntries((config.fields || []).map((field) => [field.id, `${field.label}的测试内容`])) };
    }
    if (tool.id === 'audio') values.audio = { seconds: Number(config.minSeconds || 1), transcript: '发布内容的测试转写' };
    if (tool.id === 'team') {
      const types = config.requiredRecordTypes?.length ? config.requiredRecordTypes : (config.recordTypes || ['记录']);
      const minimum = Math.max(Number(config.minimumEntries || 1), types.length);
      values.team = {
        entries: Array.from({ length: minimum }, (_, index) => ({
          role: (config.roles || ['组员'])[index % (config.roles || ['组员']).length],
          type: types[index % types.length],
          text: `第${index + 1}条测试记录`,
        })),
      };
    }
  }
  return values;
}

/** 走完一个任务的所有小步，再提交工具结果。返回提交那一轮的结果。 */
async function completeAndSubmit({ agent, session, task, callId, prefix }) {
  for (let stepIndex = 0; stepIndex < task.steps.length; stepIndex += 1) {
    const step = task.steps[stepIndex];
    const photo = step.tools.find((tool) => tool.id === 'photo');
    const photoCount = Number(photo?.config?.minCount || 0);
    await agent.runTurn({
      sessionId: session.id, requestId: `${prefix}-step-${stepIndex}`,
      input: {
        type: 'lifecycle_event', event: 'task_step_completed',
        data: {
          taskId: task.id, stepId: step.id, stepIndex, stepText: step.studentAction,
          localEvidenceCount: photoCount,
          toolValues: { [step.id]: satisfyStepTools(step) },
          stepImages: photoCount ? ['data:image/jpeg;base64,AA=='] : [],
          // `完成方式：teacher_confirm` 的小步要带教师确认标记，与教师端 approve_evidence
          // 经学生端桥回发的载荷一致。`assembly-speaker` 的任务2 第一小步正是这一种：
          // 老师先确认小步，任务做完后还要再确认一次推进——两次确认是两回事。
          teacherApproved: step.completionMode === 'teacher_confirm' ? true : undefined,
        },
      },
    });
  }
  return agent.runTurn({
    sessionId: session.id, requestId: `${prefix}-submit`,
    input: {
      type: 'tool_result', toolCallId: callId,
      result: {
        status: 'completed', values: { text: '按要求记录完成' },
        evidence: Array.from({ length: 5 }, (_, index) => ({ id: `${prefix}-ev-${index}`, url: `/uploads/${prefix}-${index}.jpg` })),
      },
    },
  });
}

const openedTaskIndex = (result) => result.events
  .find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation')
  ?.data.payload.taskIndex;

test('推进方式：teacher 的任务做完后进度不动，等待态落在会话上而不是单次回合载荷', async () => {
  const { agent, session, role, store, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter', advanceModes: { 0: 'teacher' },
  });
  const submitted = await completeAndSubmit({ agent, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'teacher-wait' });

  assert.equal(submitted.session.currentTaskIndex, 0, '等老师推进期间不许动进度');
  assert.deepEqual(submitted.session.completedTaskIds, ['dragon-counter:task-1'], '任务本身是完成了的');
  assert.equal(submitted.session.pendingAdvance.mode, 'teacher');
  assert.equal(submitted.session.pendingAdvance.taskId, 'task-1');
  // 这条是整个修复的要点：等待态必须**存进会话**才能跨回合活到教师指令那一轮。
  // 改造前它只写在 input.data 上，回合一结束就没了，任务因此永久卡住。
  const reloaded = await store.get(session.id);
  assert.equal(reloaded.pendingAdvance.mode, 'teacher', '重新读会话仍应看到等待态');
  assert.equal(reloaded.pendingAdvance.completedId, 'dragon-counter:task-1');
  // 同地点续做要靠这几个字段：等待期间当次 pendingCompletion 已随回合消失。
  assert.ok(reloaded.pendingAdvance.completedLocationName, '完成时的地点要记下来');
  assert.equal(reloaded.pendingAdvance.completedLocationStatus, 'arrived');
  // 学生端要靠它渲染「等老师确认」，否则界面看不出为什么停住。
  assert.deepEqual(
    submitted.events.find((event) => event.type === 'state.updated').data.pendingAdvance,
    { mode: 'teacher', taskId: 'task-1' },
  );
  // 等待期间不许再开工具卡——currentTaskIndex 没动，开出来就是刚做完那张。
  assert.equal(openedTaskIndex(submitted), undefined, '等待期间不应打开任何任务卡');
});

test('teacher_advance_task 推进一格，并打开下一任务的工具卡（不让絮絮多说一句）', async () => {
  const { agent, session, role, llm, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter', advanceModes: { 0: 'teacher' },
  });
  await completeAndSubmit({ agent, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'teacher-go' });
  const before = llm.mainCalls;

  const advanced = await agent.runTurn({
    sessionId: session.id, requestId: 'teacher-advance',
    input: { type: 'lifecycle_event', event: 'teacher_advance_task', data: { taskId: 'task-1' } },
  });

  assert.equal(advanced.session.currentTaskIndex, 1);
  assert.equal(advanced.session.pendingAdvance, null, '推进后必须清掉等待态，否则下一个任务开不出来');
  assert.equal(openedTaskIndex(advanced), 1, '推进后要真的把下一任务的工具卡开出来');
  assert.ok(advanced.events.some((event) => event.type === 'stage.started'), '新任务要有阶段卡');
  // 推进回合走 silent：stage.started ＋ 第一小步引导已经说清了下一步，
  // 再调主模型只会因为没新话可说而撞上反重复层，冒出一句"这句话我刚才说过了"。
  assert.equal(llm.mainCalls - before, 0, '推进回合不应调用主模型');
  const texts = advanced.events.filter((event) => event.type === 'assistant.completed').map((event) => event.data.text);
  assert.equal(texts.length, 1, '只应有新任务第一小步这一条引导');
  assert.doesNotMatch(texts[0], /刚才说过/);
});

test('没在等待就发 teacher_advance_task：报错且进度、完成记录都不变', async () => {
  const { agent, session, role, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter',
  });
  // 任务还没做完就按推进。
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id, requestId: 'premature',
      input: { type: 'lifecycle_event', event: 'teacher_advance_task', data: { taskId: 'task-1' } },
    }),
    (error) => error.code === 'ADVANCE_NOT_WAITING',
  );
  assert.equal(session.currentTaskIndex, 0);
  assert.deepEqual(session.completedTaskIds, []);

  // 做完之后走的是 auto 主路径（已经自己推进过了），此时再按推进同样不该生效。
  await completeAndSubmit({ agent, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'auto-then-push' });
  assert.equal(session.currentTaskIndex, 1);
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id, requestId: 'premature-2',
      input: { type: 'lifecycle_event', event: 'teacher_advance_task', data: { taskId: 'task-2' } },
    }),
    (error) => error.code === 'ADVANCE_NOT_WAITING',
  );
  assert.equal(session.currentTaskIndex, 1, 'auto 任务不该被教师指令再推一格');
});

test('推进方式：ai_suggest 由学生自己确认；教师按了不算（认人不认权限）', async () => {
  const { agent, session, role, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter', advanceModes: { 0: 'ai_suggest' },
  });
  const submitted = await completeAndSubmit({ agent, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'student-wait' });
  assert.equal(submitted.session.currentTaskIndex, 0);
  assert.equal(submitted.session.pendingAdvance.mode, 'student');

  // 等的是学生，教师指令这时不许顶替——否则老师一按就能替学生跳过自主确认。
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id, requestId: 'wrong-actor',
      input: { type: 'lifecycle_event', event: 'teacher_advance_task', data: { taskId: 'task-1' } },
    }),
    (error) => error.code === 'ADVANCE_WRONG_ACTOR',
  );
  assert.equal(session.currentTaskIndex, 0);

  const advanced = await agent.runTurn({
    sessionId: session.id, requestId: 'student-advance',
    input: { type: 'lifecycle_event', event: 'student_advance_task', data: { taskId: 'task-1' } },
  });
  assert.equal(advanced.session.currentTaskIndex, 1);
  assert.equal(advanced.session.pendingAdvance, null);
  assert.equal(openedTaskIndex(advanced), 1);
});

test('auto_after_validation 主路径行为不变：提交即推进、当轮开新卡、不留等待态', async () => {
  const { agent, session, role, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter',
  });
  assert.equal(role.tasks[0].advanceMode, 'auto_after_validation', '这一条钉的是课程原样的主路径');
  const submitted = await completeAndSubmit({ agent, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'auto' });

  assert.equal(submitted.session.currentTaskIndex, 1, '主路径必须在提交那一轮就推进');
  assert.deepEqual(submitted.session.completedTaskIds, ['dragon-counter:task-1']);
  assert.equal(openedTaskIndex(submitted), 1, '主路径在同一轮就开出下一任务的卡');
  assert.equal(submitted.session.pendingAdvance ?? null, null, '主路径不该留下等待态');
  assert.equal(submitted.events.find((event) => event.type === 'state.updated').data.pendingAdvance, null);
});

test('真课程回归：lesson_zhizhi_001 的 assembly-speaker 走到那个 teacher 任务并被解开', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhizhi_001' });
  const role = course.roles.find((item) => item.id === 'assembly-speaker');
  // 不改课程：这一门课本来就写了 `推进方式：teacher`。若哪天课程改了写法，这条断言先红。
  assert.equal(role.tasks[1].advanceMode, 'teacher', 'assembly-speaker 的任务2 应仍是教师推进');

  const llm = countingLlm();
  const agent = createAgentService({ llm, store: memoryStore(), getCourse: async () => course });
  const { session } = await agent.createSession({
    courseId: course.id, roleId: 'assembly-speaker', studentId: 'zhizhi-student', groupId: 'zhizhi-group',
  });
  await agent.runTurn({ sessionId: session.id, requestId: 'z-assign', input: { type: 'lifecycle_event', event: 'role_assigned' } });
  const ready = await agent.runTurn({ sessionId: session.id, requestId: 'z-ready', input: { type: 'user_text', text: '我已经到位，也准备好了' } });
  let callId = ready.events.find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation')?.data.callId;
  assert.ok(callId, '第一任务的工具卡应已打开');

  // 任务1 是 auto，提交后应直接进任务2 并开卡。
  const first = await completeAndSubmit({ agent, session, task: role.tasks[0], callId, prefix: 'z-task1' });
  assert.equal(first.session.currentTaskIndex, 1);
  callId = first.events.find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation')?.data.callId;
  assert.ok(callId, '任务2 的工具卡应已打开');

  // 任务2 是 teacher：做完卡住。
  const second = await completeAndSubmit({ agent, session, task: role.tasks[1], callId, prefix: 'z-task2' });
  assert.equal(second.session.currentTaskIndex, 1, '教师推进的任务做完后不许自己往前走');
  assert.equal(second.session.pendingAdvance.mode, 'teacher');
  assert.equal(openedTaskIndex(second), undefined);

  // 教师指令解开 → 进任务3。
  const advanced = await agent.runTurn({
    sessionId: session.id, requestId: 'z-advance',
    input: { type: 'lifecycle_event', event: 'teacher_advance_task', data: { taskId: role.tasks[1].id } },
  });
  assert.equal(advanced.session.currentTaskIndex, 2);
  assert.equal(advanced.session.pendingAdvance, null);
  assert.equal(openedTaskIndex(advanced), 2);
});
