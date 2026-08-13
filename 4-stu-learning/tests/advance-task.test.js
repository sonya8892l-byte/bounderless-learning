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
import {
  actionForTeacherLifecycleEvent,
  createTeacherCommandAuthority,
} from './helpers/teacher-command-authority.js';

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
  const authority = createTeacherCommandAuthority();
  const agent = createAgentService({
    llm,
    store,
    getCourse: async () => course,
    consumeTeacherCommand: authority.consume,
  });
  const { session } = await agent.createSession({ courseId: course.id, roleId, studentId: 'advance-student', groupId: 'advance-group' });
  await agent.runTurn({ sessionId: session.id, requestId: 'assign', input: { type: 'lifecycle_event', event: 'role_assigned' } });
  const ready = await agent.runTurn({ sessionId: session.id, requestId: 'ready', input: { type: 'user_text', text: '我已经到位，也准备好了' } });
  const taskRequest = ready.events.find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation');
  return { agent, authority, session, role, llm, store, taskRequest };
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
    if (tool.id === 'audio') values.audio = { durationSeconds: Number(config.minSeconds || 1), transcript: '发布内容的测试转写' };
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

/**
 * 走完一个任务的所有小步，返回使任务进入当前收口态的那一轮。
 *
 * 默认 `auto_on_last_step` 在最后一步就完成，没有第二次“整包提交”；
 * 只有显式 `explicit_bundle_submit` 的夹具才继续发 `tool_result`。
 */
async function completeAndSubmit({ agent, authority, session, task, callId, prefix }) {
  const toolValues = {};
  let completed = null;
  for (let stepIndex = 0; stepIndex < task.steps.length; stepIndex += 1) {
    const step = task.steps[stepIndex];
    const photo = step.tools.find((tool) => tool.id === 'photo');
    const photoCount = Number(photo?.config?.minCount || 0);
    const teacherApproved = step.completionMode === 'teacher_confirm';
    const teacherCommandId = teacherApproved
      ? authority.issue({ sessionId: session.id, action: 'approve_evidence' })
      : undefined;
    toolValues[step.id] = satisfyStepTools(step);
    completed = await agent.runTurn({
      sessionId: session.id, requestId: `${prefix}-step-${stepIndex}`,
      input: {
        type: 'lifecycle_event', event: 'task_step_completed',
        data: {
          taskId: task.id, stepId: step.id, stepIndex, stepText: step.studentAction,
          localEvidenceCount: photoCount,
          toolValues: { [step.id]: toolValues[step.id] },
          stepImages: photoCount ? ['data:image/jpeg;base64,AA=='] : [],
          // `完成方式：teacher_confirm` 的小步要带教师确认标记，与教师端 approve_evidence
          // 经学生端桥回发的载荷一致。`assembly-speaker` 的任务2 第一小步正是这一种：
          // 老师先确认小步，任务做完后还要再确认一次推进——两次确认是两回事。
          teacherApproved: teacherApproved ? true : undefined,
          teacherCommandId,
        },
      },
    });
  }
  if (task.finalizationMode !== 'explicit_bundle_submit') return completed;
  return agent.runTurn({
    sessionId: session.id, requestId: `${prefix}-submit`,
    input: {
      type: 'tool_result', toolCallId: callId,
      result: {
        status: 'completed', values: { text: '按要求记录完成', toolValues },
        evidence: Array.from({ length: 5 }, (_, index) => ({ id: `${prefix}-ev-${index}`, url: `/uploads/${prefix}-${index}.jpg` })),
      },
    },
  });
}

function teacherLifecycleInput(authority, session, event, data = {}) {
  const teacherCommandId = authority.issue({
    sessionId: session.id,
    action: actionForTeacherLifecycleEvent(event, data),
    payload: data,
  });
  return {
    type: 'lifecycle_event',
    event,
    data: { ...data, teacherCommandId },
  };
}

const openedTaskIndex = (result) => result.events
  .find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation')
  ?.data.payload.taskIndex;

test('teacherApproved 和 teacherOverride 的客户端布尔值不能伪造跳步', async () => {
  const { agent, authority, session, role } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter',
  });
  const task = role.tasks[0];
  const step = task.steps[0];
  const baseData = {
    taskId: task.id,
    stepId: step.id,
    stepIndex: 0,
    stepText: step.studentAction,
  };

  for (const flag of ['teacherApproved', 'teacherOverride']) {
    await assert.rejects(agent.runTurn({
      sessionId: session.id,
      requestId: `forged-${flag}`,
      input: {
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: { ...baseData, [flag]: true, teacherCommandId: `cmd_forged_${flag}` },
      },
    }), (error) => error.code === 'TEACHER_COMMAND_UNAUTHORIZED');
  }
  assert.equal(session.taskState.guidanceStepIndex, 0);

  const teacherCommandId = authority.issue({
    sessionId: session.id,
    action: 'skip_step',
  });
  const skipped = await agent.runTurn({
    sessionId: session.id,
    requestId: 'authorized-teacher-override',
    input: {
      type: 'lifecycle_event',
      event: 'task_step_completed',
      data: { ...baseData, teacherOverride: true, teacherCommandId },
    },
  });
  assert.equal(skipped.session.taskState.guidanceStepIndex, 1);
});

test('推进方式：teacher 的任务做完后进度不动，等待态落在会话上而不是单次回合载荷', async () => {
  const { agent, authority, session, role, store, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter', advanceModes: { 0: 'teacher' },
  });
  const submitted = await completeAndSubmit({ agent, authority, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'teacher-wait' });

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
  const { agent, authority, session, role, llm, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter', advanceModes: { 0: 'teacher' },
  });
  await completeAndSubmit({ agent, authority, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'teacher-go' });
  const before = llm.mainCalls;

  const advanced = await agent.runTurn({
    sessionId: session.id, requestId: 'teacher-advance',
    input: teacherLifecycleInput(authority, session, 'teacher_advance_task', { taskId: 'task-1' }),
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
  const { agent, authority, session, role, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter',
  });
  // 任务还没做完就按推进。
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id, requestId: 'premature',
      input: teacherLifecycleInput(authority, session, 'teacher_advance_task', { taskId: 'task-1' }),
    }),
    (error) => error.code === 'ADVANCE_NOT_WAITING',
  );
  assert.equal(session.currentTaskIndex, 0);
  assert.deepEqual(session.completedTaskIds, []);

  // 做完之后走的是 auto 主路径（已经自己推进过了），此时再按推进同样不该生效。
  await completeAndSubmit({ agent, authority, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'auto-then-push' });
  assert.equal(session.currentTaskIndex, 1);
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id, requestId: 'premature-2',
      input: teacherLifecycleInput(authority, session, 'teacher_advance_task', { taskId: 'task-2' }),
    }),
    (error) => error.code === 'ADVANCE_NOT_WAITING',
  );
  assert.equal(session.currentTaskIndex, 1, 'auto 任务不该被教师指令再推一格');
});

test('推进方式：ai_suggest 由学生自己确认；教师按了不算（认人不认权限）', async () => {
  const { agent, authority, session, role, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter', advanceModes: { 0: 'ai_suggest' },
  });
  const submitted = await completeAndSubmit({ agent, authority, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'student-wait' });
  assert.equal(submitted.session.currentTaskIndex, 0);
  assert.equal(submitted.session.pendingAdvance.mode, 'student');

  // 等的是学生，教师指令这时不许顶替——否则老师一按就能替学生跳过自主确认。
  await assert.rejects(
    agent.runTurn({
      sessionId: session.id, requestId: 'wrong-actor',
      input: teacherLifecycleInput(authority, session, 'teacher_advance_task', { taskId: 'task-1' }),
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
  const { agent, authority, session, role, taskRequest } = await runUpToSubmission({
    courseId: 'lesson_gewu_001', roleId: 'dragon-counter',
  });
  assert.equal(role.tasks[0].advanceMode, 'auto_after_validation', '这一条钉的是课程原样的主路径');
  const submitted = await completeAndSubmit({ agent, authority, session, task: role.tasks[0], callId: taskRequest.data.callId, prefix: 'auto' });

  assert.equal(submitted.session.currentTaskIndex, 1, '主路径必须在提交那一轮就推进');
  assert.deepEqual(submitted.session.completedTaskIds, ['dragon-counter:task-1']);
  assert.equal(openedTaskIndex(submitted), 1, '主路径在同一轮就开出下一任务的卡');
  assert.equal(submitted.session.pendingAdvance ?? null, null, '主路径不该留下等待态');
  assert.equal(submitted.events.find((event) => event.type === 'state.updated').data.pendingAdvance, null);
});

test('真课程回归：lesson_zhizhi_001 的 assembly-speaker 经教师终审与教师推进后解开', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhizhi_001' });
  const role = course.roles.find((item) => item.id === 'assembly-speaker');
  // 不改课程：这一门课本来就写了 `推进方式：teacher`。若哪天课程改了写法，这条断言先红。
  assert.equal(role.tasks[1].advanceMode, 'teacher', 'assembly-speaker 的任务2 应仍是教师推进');

  const llm = countingLlm();
  const authority = createTeacherCommandAuthority();
  const agent = createAgentService({
    llm,
    store: memoryStore(),
    getCourse: async () => course,
    consumeTeacherCommand: authority.consume,
  });
  const { session } = await agent.createSession({
    courseId: course.id, roleId: 'assembly-speaker', studentId: 'zhizhi-student', groupId: 'zhizhi-group',
  });
  await agent.runTurn({ sessionId: session.id, requestId: 'z-assign', input: { type: 'lifecycle_event', event: 'role_assigned' } });
  const ready = await agent.runTurn({ sessionId: session.id, requestId: 'z-ready', input: { type: 'user_text', text: '我已经到位，也准备好了' } });
  let callId = ready.events.find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation')?.data.callId;
  assert.ok(callId, '第一任务的工具卡应已打开');

  // 任务1 是 auto，最后一个 Step 通过后应直接进任务2 并开卡。
  const first = await completeAndSubmit({ agent, authority, session, task: role.tasks[0], callId, prefix: 'z-task1' });
  assert.equal(first.session.currentTaskIndex, 1);
  callId = first.events.find((event) => event.type === 'tool.requested' && event.data.payload.renderer !== 'navigation')?.data.callId;
  assert.ok(callId, '任务2 的工具卡应已打开');

  // 任务2 是任务级 teacher_confirm：Step 做完后先等教师终审。
  const second = await completeAndSubmit({ agent, authority, session, task: role.tasks[1], callId, prefix: 'z-task2' });
  assert.equal(second.session.currentTaskIndex, 1, '教师推进的任务做完后不许自己往前走');
  assert.equal(second.session.taskState.finalization.status, 'awaiting_teacher_confirm');
  assert.equal(second.session.pendingAdvance ?? null, null, '终审前还没有进入任务推进等待');
  assert.equal(openedTaskIndex(second), undefined);

  // 教师终审只完成任务；该任务的推进方式也是 teacher，所以仍要再等教师推进。
  const finalized = await agent.runTurn({
    sessionId: session.id, requestId: 'z-finalize',
    input: teacherLifecycleInput(authority, session, 'teacher_finalize_task', { taskId: role.tasks[1].id }),
  });
  assert.equal(finalized.session.currentTaskIndex, 1);
  assert.equal(finalized.session.taskState.finalization.status, 'completed');
  assert.equal(finalized.session.pendingAdvance.mode, 'teacher');

  // 教师推进指令解开 → 进任务3。
  const advanced = await agent.runTurn({
    sessionId: session.id, requestId: 'z-advance',
    input: teacherLifecycleInput(authority, session, 'teacher_advance_task', { taskId: role.tasks[1].id }),
  });
  assert.equal(advanced.session.currentTaskIndex, 2);
  assert.equal(advanced.session.pendingAdvance, null);
  assert.equal(openedTaskIndex(advanced), 2);
});

test('平台验收强制完成会补齐 Step、写真实完成记录并复用唯一推进函数', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const store = memoryStore();
  const agent = createAgentService({ llm: countingLlm(), store, getCourse: async () => course });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: role.id,
    studentId: 'qa-student',
    groupId: 'qa-group',
  });
  session.pendingTools.old = { name: 'open_task_tool' };
  session.pendingAdvance = { mode: 'teacher', taskId: role.tasks[0].id };
  session.learningState.evidenceIds = ['ev_real_existing'];
  await store.save(session);

  const result = await agent.forceCompleteCurrentTask({
    sessionId: session.id,
    taskId: role.tasks[0].id,
    requestId: 'qa-force-1',
  });
  const saved = await store.get(session.id);
  assert.equal(result.advanced, true);
  assert.equal(result.allTasksCompleted, false);
  assert.equal(saved.currentTaskIndex, 1);
  assert.ok(saved.completedTaskIds.includes(`${role.id}:${role.tasks[0].id}`));
  assert.deepEqual(
    role.tasks[0].steps.map((step) => step.id).every((stepId) => saved.learningState.completedStepIds.includes(stepId)),
    true,
  );
  assert.deepEqual(saved.learningState.evidenceIds, ['ev_real_existing'], '验收跳关不得伪造或删除学习证据');
  assert.equal(saved.pendingAdvance, null);
  assert.equal(Object.hasOwn(saved.pendingTools, 'old'), false);
  assert.equal(saved.qaOverrides[0].type, 'qa_override');
  assert.equal(saved.qaOverrides[0].requestId, 'qa-force-1');
  assert.equal(result.events.at(-1).type, 'state.updated');
  assert.equal(result.events.at(-1).data.intent, 'qa_override');
  assert.ok(result.events.some((event) => event.type === 'tool.requested'), '下一任务必须取得可继续使用的工具或导航入口');

  await assert.rejects(
    agent.forceCompleteCurrentTask({ sessionId: session.id, taskId: role.tasks[0].id, requestId: 'qa-stale' }),
    (error) => error.code === 'QA_TASK_EXPIRED',
  );
});

test('平台验收完成最后一关时 advanced=false 仍返回角色全部完成，且不可重复记账', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const store = memoryStore();
  const agent = createAgentService({ llm: countingLlm(), store, getCourse: async () => course });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: role.id,
    studentId: 'qa-final-student',
    groupId: 'qa-final-group',
  });

  for (let index = 0; index < role.tasks.length - 1; index += 1) {
    const interim = await agent.forceCompleteCurrentTask({
      sessionId: session.id,
      taskId: role.tasks[index].id,
      requestId: `qa-force-${index}`,
    });
    assert.equal(interim.advanced, true);
  }
  const lastTask = role.tasks.at(-1);
  const final = await agent.forceCompleteCurrentTask({
    sessionId: session.id,
    taskId: lastTask.id,
    requestId: 'qa-force-final',
  });
  const saved = await store.get(session.id);
  assert.equal(final.advanced, false, '末关没有下一任务，推进函数按约定返回 false');
  assert.equal(final.allTasksCompleted, true);
  assert.equal(saved.currentTaskIndex, role.tasks.length - 1, '末关索引不得越界');
  assert.equal(saved.completedTaskIds.filter((id) => id.startsWith(`${role.id}:`)).length, role.tasks.length);
  assert.equal(saved.qaOverrides.length, role.tasks.length);
  assert.equal(saved.events.filter((event) => event === `${role.id}:all-tasks-completed`).length, 1);
  assert.equal(final.events.at(-1).data.qaOverride.allTasksCompleted, true);

  await assert.rejects(
    agent.forceCompleteCurrentTask({ sessionId: session.id, taskId: lastTask.id, requestId: 'qa-force-final-again' }),
    (error) => error.code === 'QA_TASK_ALREADY_COMPLETED',
  );
  const unchanged = await store.get(session.id);
  assert.equal(unchanged.qaOverrides.length, role.tasks.length);
  assert.equal(unchanged.events.filter((event) => event === `${role.id}:all-tasks-completed`).length, 1);
});
