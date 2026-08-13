/**
 * 任务收口的纯状态内核。
 *
 * 小步完成、任务收口、任务推进是三件独立的事。本模块只负责前两者之间的边界：
 * 所有小步完成后，任务应该直接完成，还是等待整包提交／教师确认。
 * 它不读写 session，也不推进 currentTaskIndex，服务端与本地预览可以共用同一套语义。
 */

export const TASK_FINALIZATION_MODES = Object.freeze([
  'auto_on_last_step',
  'explicit_bundle_submit',
  'teacher_confirm',
]);

// 每个 Step 已经各自完成合法验收时，任务默认随最后一步完成；只有课程明确要求
// 跨 Step 整包复核或任务级教师终审时，才显式改用另外两种模式。
export const DEFAULT_TASK_FINALIZATION_MODE = 'auto_on_last_step';

export const TASK_FINALIZATION_STATUSES = Object.freeze([
  'collecting_steps',
  'awaiting_bundle_submit',
  'awaiting_teacher_confirm',
  'revision_required',
  'completed',
]);

export function isTaskFinalizationMode(value) {
  return TASK_FINALIZATION_MODES.includes(String(value || '').trim().toLowerCase());
}

export function normalizeTaskFinalizationMode(value, fallback = DEFAULT_TASK_FINALIZATION_MODE) {
  const mode = String(value || '').trim().toLowerCase();
  return isTaskFinalizationMode(mode) ? mode : fallback;
}

function taskStepIds(task) {
  return [...new Set((task?.steps || []).map((step) => String(step?.id || '').trim()).filter(Boolean))];
}

function completedIdsForTask(task, completedStepIds = []) {
  const allowed = new Set(taskStepIds(task));
  return [...new Set(completedStepIds.map((id) => String(id || '').trim()).filter((id) => allowed.has(id)))];
}

function allStepsCompleted(task, completedStepIds) {
  const expected = taskStepIds(task);
  const completed = new Set(completedStepIds);
  return expected.every((id) => completed.has(id));
}

function statusAfterSteps(task, completedStepIds) {
  if (!allStepsCompleted(task, completedStepIds)) return 'collecting_steps';
  const mode = normalizeTaskFinalizationMode(task?.finalizationMode);
  if (mode === 'auto_on_last_step') return 'completed';
  if (mode === 'teacher_confirm') return 'awaiting_teacher_confirm';
  return 'awaiting_bundle_submit';
}

/**
 * 从持久化事实重建收口状态。旧会话无需迁移；调用方可用已有 completedStepIds 恢复。
 */
export function deriveTaskFinalizationStatus(task, {
  completedStepIds = [],
  completed = false,
  revisionRequired = false,
} = {}) {
  if (completed) return 'completed';
  if (revisionRequired) return 'revision_required';
  return statusAfterSteps(task, completedIdsForTask(task, completedStepIds));
}

export function createTaskFinalizationState(task, {
  completedStepIds = [],
  completed = false,
  revision = null,
} = {}) {
  const normalizedIds = completedIdsForTask(task, completedStepIds);
  return {
    taskId: String(task?.id || ''),
    mode: normalizeTaskFinalizationMode(task?.finalizationMode),
    status: deriveTaskFinalizationStatus(task, {
      completedStepIds: normalizedIds,
      completed,
      revisionRequired: Boolean(revision),
    }),
    completedStepIds: normalizedIds,
    revision: revision ? { ...revision } : null,
  };
}

function unchanged(state, reason) {
  return { state, changed: false, reason };
}

function changed(state) {
  return { state, changed: true, reason: null };
}

function withRevision(state, event, fallbackReason) {
  const revision = {
    source: event.type,
    stepId: String(event.stepId || ''),
    reason: String(event.reason || fallbackReason),
  };
  if (
    state.status === 'revision_required'
    && state.revision?.source === revision.source
    && state.revision?.stepId === revision.stepId
    && state.revision?.reason === revision.reason
  ) {
    return unchanged(state, 'revision_already_required');
  }
  return changed({ ...state, status: 'revision_required', revision });
}

function validateState(state, task) {
  if (!state || typeof state !== 'object') return 'invalid_state';
  if (!task || typeof task !== 'object') return 'invalid_task';
  if (String(state.taskId || '') !== String(task.id || '')) return 'task_mismatch';
  if (!TASK_FINALIZATION_STATUSES.includes(state.status)) return 'invalid_status';
  if (!isTaskFinalizationMode(state.mode)) return 'invalid_mode';
  return null;
}

/**
 * 对一个收口事件做纯归约，永不修改传入对象。
 *
 * 返回 `{ state, changed, reason }`。非法、过期或跨模式事件保持原状态，并给出稳定 reason，
 * 方便服务层转换为明确的业务错误。
 */
export function reduceTaskFinalization(state, event, task) {
  const stateError = validateState(state, task);
  if (stateError) return unchanged(state, stateError);
  if (!event || typeof event !== 'object') return unchanged(state, 'invalid_event');
  if (
    (event.type === 'bundle_submitted' || event.type === 'bundle_rejected')
    && state.mode !== 'explicit_bundle_submit'
  ) {
    return unchanged(state, 'mode_rejects_bundle_submission');
  }
  if (
    (event.type === 'teacher_confirmed' || event.type === 'teacher_rejected')
    && state.mode !== 'teacher_confirm'
  ) {
    return unchanged(state, 'mode_rejects_teacher_confirmation');
  }
  if (state.status === 'completed') return unchanged(state, 'already_completed');

  const expectedStepIds = new Set(taskStepIds(task));
  const completedStepIds = completedIdsForTask(task, state.completedStepIds || []);

  if (event.type === 'step_passed') {
    const stepId = String(event.stepId || '');
    if (!expectedStepIds.has(stepId)) return unchanged(state, 'unknown_step');
    if (completedStepIds.includes(stepId)) return unchanged(state, 'step_already_completed');
    const nextCompleted = [...completedStepIds, stepId];
    return changed({
      ...state,
      status: statusAfterSteps({ ...task, finalizationMode: state.mode }, nextCompleted),
      completedStepIds: nextCompleted,
      revision: null,
    });
  }

  if (event.type === 'step_failed') {
    const stepId = String(event.stepId || '');
    if (!expectedStepIds.has(stepId)) return unchanged(state, 'unknown_step');
    if (completedStepIds.includes(stepId)) return unchanged(state, 'step_already_completed');
    return withRevision(state, event, '这一步需要修改后重试。');
  }

  if (event.type === 'bundle_submitted' || event.type === 'bundle_rejected') {
    if (!allStepsCompleted(task, completedStepIds)) return unchanged(state, 'steps_pending');
    if (event.type === 'bundle_rejected') {
      return withRevision(state, event, '整包提交需要修改后重试。');
    }
    return changed({ ...state, status: 'completed', revision: null });
  }

  if (event.type === 'teacher_confirmed' || event.type === 'teacher_rejected') {
    if (!allStepsCompleted(task, completedStepIds)) return unchanged(state, 'steps_pending');
    if (event.type === 'teacher_rejected') {
      return withRevision(state, event, '等待学生修改后再次请教师确认。');
    }
    return changed({ ...state, status: 'completed', revision: null });
  }

  return unchanged(state, 'unsupported_event');
}
