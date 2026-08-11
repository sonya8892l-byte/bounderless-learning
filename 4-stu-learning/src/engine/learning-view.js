export const LEARNING_VIEW_DIALOGUE = 'dialogue';
export const LEARNING_VIEW_CHALLENGE = 'challenge';

const VALID_VIEWS = new Set([LEARNING_VIEW_DIALOGUE, LEARNING_VIEW_CHALLENGE]);

export function initialLearningView(config = {}) {
  if (!config.enabled) return LEARNING_VIEW_DIALOGUE;
  return VALID_VIEWS.has(config.default) ? config.default : LEARNING_VIEW_DIALOGUE;
}

export function canSwitchLearningView(config = {}, target) {
  return Boolean(config.enabled && config.allowStudentSwitch && VALID_VIEWS.has(target));
}

export function nextLearningView({ current, target, config = {} }) {
  return canSwitchLearningView(config, target) ? target : current;
}

export function challengeTaskAccess({ taskIndex, progress, taskCount, roleCompleted = false }) {
  if (taskIndex < 0 || taskIndex >= taskCount) return 'locked';
  if (roleCompleted || taskIndex < progress) return 'completed';
  if (taskIndex === Math.min(progress, Math.max(0, taskCount - 1))) return 'current';
  return 'locked';
}

export function clampChallengePageIndex({ requestedIndex, progress, taskCount, roleCompleted = false, allowAll = false }) {
  if (taskCount <= 0) return 0;
  const highestUnlocked = allowAll || roleCompleted
    ? taskCount - 1
    : Math.min(Math.max(0, progress), taskCount - 1);
  return Math.min(Math.max(0, Number(requestedIndex) || 0), highestUnlocked);
}

export function challengeSubmissionPassed({
  kind,
  taskIndex,
  beforeStepIndex,
  currentTaskIndex,
  runtimeTaskId,
  runtimeStepIndex,
  taskId,
  roleCompleted = false,
}) {
  if (kind === 'task') return roleCompleted || currentTaskIndex > taskIndex;
  return currentTaskIndex > taskIndex
    || (runtimeTaskId === taskId && Number(runtimeStepIndex || 0) > beforeStepIndex);
}
