function stepCountOf(task = {}) {
  if (task.steps?.length) return task.steps.length;
  if (task.guidanceSteps?.length) return task.guidanceSteps.length;
  return 1;
}

function pendingModeOf(task = {}) {
  if (task.advanceMode === 'teacher') return 'teacher';
  if (task.advanceMode === 'ai_suggest') return 'student';
  return null;
}

export function studentCanCompleteStep(step = {}) {
  return !['teacher_confirm', 'location_event'].includes(step.completionMode);
}

function markLocalTaskCompleted({ roleState, task, taskIndex }) {
  roleState.guidanceStepIndices ||= {};
  roleState.guidanceStepIndices[task.id] = stepCountOf(task);
  roleState.taskFinalizations ||= {};
  roleState.taskFinalizations[task.id] = {
    ...(roleState.taskFinalizations[task.id] || {}),
    taskId: task.id,
    mode: task.finalizationMode || 'auto_on_last_step',
    status: 'completed',
    revision: null,
  };
  roleState.messages ||= [];
  roleState.messages
    .filter((message) => message.type === 'task' && message.payload?.taskId === task.id)
    .forEach((message) => { message.status = 'complete'; });
  roleState.challengePageIndex = taskIndex;
}

function advanceLocalTask({ role, roleState, taskIndex }) {
  const tasks = role?.tasks || [];
  roleState.pendingAdvance = null;
  roleState.progress = taskIndex + 1;
  roleState.completed = roleState.progress >= tasks.length;
  roleState.challengePageIndex = roleState.completed
    ? tasks.length - 1
    : roleState.progress;
  return {
    advanced: true,
    waitingMode: null,
    nextTask: roleState.completed ? null : tasks[roleState.progress],
    roleCompleted: roleState.completed,
  };
}

export function completeLocalTaskProgress({
  role,
  roleState,
  taskId,
  qaOverride = false,
  now = Date.now(),
}) {
  const tasks = role?.tasks || [];
  const taskIndex = tasks.findIndex((task) => task.id === taskId);
  const currentIndex = Math.min(Math.max(0, Number(roleState?.progress || 0)), Math.max(0, tasks.length - 1));
  if (!tasks.length || taskIndex < 0) return { ok: false, code: 'TASK_NOT_FOUND' };
  if (roleState.completed || roleState.progress >= tasks.length) {
    return { ok: false, code: 'TASK_ALREADY_COMPLETED' };
  }
  if (taskIndex !== currentIndex) return { ok: false, code: 'TASK_EXPIRED' };

  const task = tasks[taskIndex];
  markLocalTaskCompleted({ roleState, task, taskIndex });

  if (qaOverride) {
    roleState.qaOverrides ||= [];
    roleState.qaOverrides.push({
      type: 'qa_override',
      actor: 'platform_qa',
      roleId: role.id,
      taskId: task.id,
      taskIndex,
      completedAt: new Date(now).toISOString(),
    });
  }

  const waitingMode = qaOverride ? null : pendingModeOf(task);
  if (waitingMode) {
    roleState.pendingAdvance = {
      taskId: task.id,
      mode: waitingMode,
      completedId: `${role.id}:${task.id}`,
    };
    return {
      ok: true,
      task,
      taskIndex,
      advanced: false,
      waitingMode,
      nextTask: null,
      roleCompleted: false,
    };
  }

  return {
    ok: true,
    task,
    taskIndex,
    ...advanceLocalTask({ role, roleState, taskIndex }),
  };
}

export function resolveLocalPendingAdvance({ role, roleState, taskId, actor = 'student' }) {
  const pending = roleState?.pendingAdvance;
  const expectedMode = actor === 'teacher' ? 'teacher' : 'student';
  if (!pending || pending.taskId !== taskId) return { ok: false, code: 'NO_PENDING_ADVANCE' };
  if (pending.mode !== expectedMode) return { ok: false, code: 'ADVANCE_NOT_AUTHORIZED' };
  const tasks = role?.tasks || [];
  const taskIndex = tasks.findIndex((task) => task.id === taskId);
  if (taskIndex < 0) return { ok: false, code: 'TASK_NOT_FOUND' };
  if (Number(roleState.progress || 0) !== taskIndex) return { ok: false, code: 'TASK_EXPIRED' };
  return {
    ok: true,
    task: tasks[taskIndex],
    taskIndex,
    ...advanceLocalTask({ role, roleState, taskIndex }),
  };
}
