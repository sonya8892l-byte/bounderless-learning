import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord } from '../server/services/session-factory.js';
import {
  actionForTeacherLifecycleEvent,
  createTeacherCommandAuthority,
} from './helpers/teacher-command-authority.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: `ses_finalization_${sessions.size + 1}` });
      sessions.set(session.id, structuredClone(session));
      return session;
    },
    async get(id) {
      const session = sessions.get(id);
      return session ? structuredClone(session) : null;
    },
    async save(session) {
      sessions.set(session.id, structuredClone(session));
      return session;
    },
  };
}

function noModelCallsLlm() {
  return {
    capabilities: () => ({ nativeTools: true, vision: false, streaming: false }),
    async generate() {
      throw new Error('教师收口生命周期不应调用模型。');
    },
  };
}

function finalizationSteps(taskId) {
  return [1, 2].map((number) => ({
    id: `${taskId}-runtime-step-${number}`,
    objective: `完成第${number}步`,
    studentAction: `记录第${number}步`,
    completionMode: 'user_confirm',
    evidenceRequirement: '',
    tools: [],
  }));
}

async function harness(mode = 'teacher_confirm') {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const task = role.tasks[0];
  const steps = finalizationSteps(task.id);

  // 保留真实课程、平台话术和工具实例，只把首任务收敛成最小的任务级收口夹具。
  // 这样测试走完整服务链路，同时不依赖某一课正在迁移的照片数量或验收字段。
  Object.assign(task, {
    advanceMode: 'auto_after_validation',
    guidanceSteps: steps.map((step) => step.studentAction),
    steps,
    location: { mode: 'none', verification: 'none', name: '' },
  });
  if (mode == null) delete task.finalizationMode;
  else task.finalizationMode = mode;
  role.tasks[1].location = { mode: 'none', verification: 'none', name: '' };
  course.taskGraph = null;

  const store = memoryStore();
  const authority = createTeacherCommandAuthority();
  const agent = createAgentService({
    llm: noModelCallsLlm(),
    store,
    getCourse: async () => course,
    consumeTeacherCommand: authority.consume,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: role.id,
    studentId: 'finalization-student',
    groupId: 'finalization-group',
  });
  return { agent, authority, course, role, task, store, session };
}

test('旧任务缺收口字段时仍按共享默认值在最后 Step 自动完成', async () => {
  const { agent, role, task, session } = await harness(null);
  assert.equal('finalizationMode' in task, false, '夹具应真实模拟旧／手工任务缺字段');
  await startTask(agent, session, 'legacy-default');

  const firstStep = await completeSteps(agent, session, task, 'legacy-default', [0]);
  assert.equal(firstStep.session.taskState.finalization.mode, 'auto_on_last_step');
  assert.equal(firstStep.session.taskState.finalization.status, 'collecting_steps');
  assert.equal(firstStep.session.currentTaskIndex, 0);

  const completed = await completeSteps(agent, session, task, 'legacy-default', [1]);
  assert.equal(completed.session.currentTaskIndex, 1);
  assert.deepEqual(completed.session.completedTaskIds, [`${role.id}:${task.id}`]);
  assert.equal(
    completed.events.find((event) => event.type === 'tool.requested')?.data.payload.taskId,
    role.tasks[1].id,
    '最后 Step 当轮应打开下一任务',
  );
});

async function startTask(agent, session, prefix) {
  const started = await agent.runTurn({
    sessionId: session.id,
    requestId: `${prefix}-start`,
    input: { type: 'lifecycle_event', event: 'phase_started', data: {} },
  });
  const taskCall = started.events.find((event) => (
    event.type === 'tool.requested' && event.data.name === 'open_task_tool'
  ));
  assert.ok(taskCall, '测试前提：当前任务卡应已打开');
  return taskCall;
}

async function completeSteps(agent, session, task, prefix, indexes = task.steps.map((_, index) => index)) {
  let result = null;
  for (const stepIndex of indexes) {
    const step = task.steps[stepIndex];
    result = await agent.runTurn({
      sessionId: session.id,
      requestId: `${prefix}-step-${stepIndex}`,
      input: {
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: {
          taskId: task.id,
          stepId: step.id,
          stepIndex,
          stepText: step.studentAction,
        },
      },
    });
  }
  return result;
}

function teacherCommand(authority, session, event, taskId, reason = '') {
  const data = { taskId, reason };
  const teacherCommandId = authority.issue({
    sessionId: session.id,
    action: actionForTeacherLifecycleEvent(event, data),
    payload: { reason },
  });
  return {
    type: 'lifecycle_event',
    event,
    data: { ...data, teacherCommandId },
  };
}

async function rejectsWithCode(promise, code, reason = null) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    if (reason !== null) assert.equal(error.details?.reason, reason);
    return true;
  });
}

test('teacher_confirm：所有 Step 完成后只进入教师终审，学生整包提交被明确拒绝', async () => {
  const { agent, task, session, store } = await harness();
  const taskCall = await startTask(agent, session, 'teacher-await');
  const completedSteps = await completeSteps(agent, session, task, 'teacher-await');

  assert.equal(completedSteps.session.taskState.finalization.status, 'awaiting_teacher_confirm');
  assert.deepEqual(
    completedSteps.session.taskState.finalization.completedStepIds,
    task.steps.map((step) => step.id),
  );
  assert.deepEqual(completedSteps.session.completedTaskIds, []);
  assert.equal(completedSteps.session.currentTaskIndex, 0);
  assert.equal(completedSteps.events.some((event) => event.type === 'tool.requested'), false);
  assert.match(
    completedSteps.events.find((event) => event.type === 'assistant.completed')?.data.text || '',
    /老师|教师/,
  );

  await rejectsWithCode(agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-await-student-bundle',
    input: {
      type: 'tool_result',
      toolCallId: taskCall.data.callId,
      result: { status: 'completed', values: { text: '学生尝试再次提交' }, evidence: [] },
    },
  }), 'TASK_FINALIZATION_MODE_REJECTS_BUNDLE');

  const stable = await store.get(session.id);
  assert.equal(stable.taskState.finalization.status, 'awaiting_teacher_confirm');
  assert.equal(stable.currentTaskIndex, 0);
  assert.deepEqual(stable.completedTaskIds, []);
});

test('teacher_finalize_task：确认后只完成并推进一次，重复命令幂等或稳定拒绝', async () => {
  const { agent, authority, role, task, session, store } = await harness();
  await startTask(agent, session, 'teacher-confirm');
  await completeSteps(agent, session, task, 'teacher-confirm');

  const confirmedInput = teacherCommand(authority, session, 'teacher_finalize_task', task.id);
  const confirmed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-confirm-once',
    input: confirmedInput,
  });
  const completedId = `${role.id}:${task.id}`;

  assert.equal(confirmed.session.currentTaskIndex, 1);
  assert.deepEqual(confirmed.session.completedTaskIds, [completedId]);
  const openedTasks = confirmed.events
    .filter((event) => event.type === 'tool.requested')
    .map((event) => event.data.payload.taskId);
  assert.deepEqual(openedTasks, [role.tasks[1].id]);

  const replay = await agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-confirm-once',
    input: confirmedInput,
  });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.events, confirmed.events);
  assert.equal(replay.session.currentTaskIndex, 1);

  await rejectsWithCode(agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-confirm-repeated-new-request',
    input: confirmedInput,
  }), 'TEACHER_COMMAND_UNAUTHORIZED');

  const stable = await store.get(session.id);
  assert.equal(stable.currentTaskIndex, 1);
  assert.equal(stable.completedTaskIds.filter((id) => id === completedId).length, 1);
  assert.equal(
    Object.values(stable.pendingTools).filter((pending) => pending.payload?.taskId === role.tasks[1].id).length,
    1,
  );
});

test('teacher_reject_task：打回末步、重做后重新等待确认，再确认才推进', async () => {
  const { agent, authority, role, task, session, store } = await harness();
  await startTask(agent, session, 'teacher-revision');
  await completeSteps(agent, session, task, 'teacher-revision');

  const rejected = await agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-revision-reject',
    input: teacherCommand(authority, session, 'teacher_reject_task', task.id, '请补充最后一步的判断依据'),
  });
  const lastStepIndex = task.steps.length - 1;
  const lastStepId = task.steps[lastStepIndex].id;

  assert.equal(rejected.session.taskState.finalization.status, 'revision_required');
  assert.equal(rejected.session.taskState.finalization.revision.reason, '请补充最后一步的判断依据');
  assert.equal(rejected.session.taskState.guidanceStepIndex, lastStepIndex);
  assert.equal(rejected.session.taskState.finalization.completedStepIds.includes(lastStepId), false);
  assert.equal(rejected.session.learningState.completedStepIds.includes(lastStepId), false);
  assert.equal(rejected.session.currentTaskIndex, 0);
  assert.deepEqual(rejected.session.completedTaskIds, []);

  await rejectsWithCode(agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-revision-premature-confirm',
    input: teacherCommand(authority, session, 'teacher_finalize_task', task.id),
  }), 'TASK_FINALIZATION_TEACHER_REJECTED', 'steps_pending');

  const resubmitted = await completeSteps(
    agent,
    session,
    task,
    'teacher-revision-resubmit',
    [lastStepIndex],
  );
  assert.equal(resubmitted.session.taskState.finalization.status, 'awaiting_teacher_confirm');
  assert.equal(resubmitted.session.taskState.finalization.revision, null);

  const confirmed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-revision-confirm',
    input: teacherCommand(authority, session, 'teacher_finalize_task', task.id),
  });
  assert.equal(confirmed.session.currentTaskIndex, 1);
  assert.deepEqual(confirmed.session.completedTaskIds, [`${role.id}:${task.id}`]);

  const stable = await store.get(session.id);
  assert.equal(stable.currentTaskIndex, 1);
  assert.equal(stable.completedTaskIds.length, 1);
});

test('教师收口命令：错误任务 ID 与错误收口模式均明确拒绝且不改进度', async () => {
  const teacher = await harness('teacher_confirm');
  await startTask(teacher.agent, teacher.session, 'teacher-invalid-id');
  await completeSteps(teacher.agent, teacher.session, teacher.task, 'teacher-invalid-id');
  await rejectsWithCode(teacher.agent.runTurn({
    sessionId: teacher.session.id,
    requestId: 'teacher-invalid-id-command',
    input: teacherCommand(
      teacher.authority,
      teacher.session,
      'teacher_finalize_task',
      'outdated-task-id',
    ),
  }), 'TASK_FINALIZATION_EXPIRED');
  const teacherStable = await teacher.store.get(teacher.session.id);
  assert.equal(teacherStable.taskState.finalization.status, 'awaiting_teacher_confirm');
  assert.equal(teacherStable.currentTaskIndex, 0);

  const explicit = await harness('explicit_bundle_submit');
  await startTask(explicit.agent, explicit.session, 'teacher-wrong-mode');
  await completeSteps(explicit.agent, explicit.session, explicit.task, 'teacher-wrong-mode');
  await rejectsWithCode(explicit.agent.runTurn({
    sessionId: explicit.session.id,
    requestId: 'teacher-wrong-mode-command',
    input: teacherCommand(
      explicit.authority,
      explicit.session,
      'teacher_finalize_task',
      explicit.task.id,
    ),
  }), 'TASK_FINALIZATION_TEACHER_REJECTED', 'mode_rejects_teacher_confirmation');
  const explicitStable = await explicit.store.get(explicit.session.id);
  assert.equal(explicitStable.taskState.finalization.status, 'awaiting_bundle_submit');
  assert.equal(explicitStable.currentTaskIndex, 0);
  assert.deepEqual(explicitStable.completedTaskIds, []);
});
