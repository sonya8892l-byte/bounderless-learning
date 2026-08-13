export const SCAFFOLD_CONTEXT_SCHEMA_VERSION = 1;
export const DEFAULT_SCAFFOLD_HELP_TYPE = 'task_help';

function clean(value = '') {
  return String(value || '').trim();
}

function clampLevel(value, maximum = 4) {
  const max = Math.max(0, Math.min(4, Number.isFinite(Number(maximum)) ? Math.trunc(Number(maximum)) : 4));
  const level = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
  return Math.max(0, Math.min(max, level));
}

export function scaffoldStepKey({ taskId = '', stepId = '' } = {}) {
  return `${clean(taskId) || '_task'}::${clean(stepId) || '_step'}`;
}

export function scaffoldContextKey({
  taskId = '',
  stepId = '',
  helpType = DEFAULT_SCAFFOLD_HELP_TYPE,
} = {}) {
  return `${scaffoldStepKey({ taskId, stepId })}::${clean(helpType) || DEFAULT_SCAFFOLD_HELP_TYPE}`;
}

export function scaffoldContextForTask(task, session, helpType = DEFAULT_SCAFFOLD_HELP_TYPE) {
  const stepIndex = Math.max(0, Number(session?.taskState?.guidanceStepIndex || 0));
  const stepId = task?.steps?.[stepIndex]?.id
    || (task?.id ? `${task.id}-step-${stepIndex + 1}` : '');
  return {
    taskId: task?.id || session?.taskState?.taskId || '',
    stepId,
    helpType: clean(helpType) || DEFAULT_SCAFFOLD_HELP_TYPE,
  };
}

function stateDefaults() {
  return {
    schemaVersion: SCAFFOLD_CONTEXT_SCHEMA_VERSION,
    byContext: {},
    stepOverrides: {},
    activeKey: '',
    activeStepKey: '',
  };
}

export function ensureScaffoldState(session) {
  if (!session.scaffoldState || typeof session.scaffoldState !== 'object') {
    session.scaffoldState = stateDefaults();
  }
  session.scaffoldState.schemaVersion = SCAFFOLD_CONTEXT_SCHEMA_VERSION;
  session.scaffoldState.byContext ||= {};
  session.scaffoldState.stepOverrides ||= {};
  session.scaffoldState.activeKey ||= '';
  session.scaffoldState.activeStepKey ||= '';
  return session.scaffoldState;
}

export function scaffoldLevelFor(session, context = {}, { maxLevel = 4 } = {}) {
  const state = ensureScaffoldState(session);
  const stepKey = scaffoldStepKey(context);
  const key = scaffoldContextKey(context);
  const override = state.stepOverrides[stepKey];
  const contextual = state.byContext[key]?.level;
  return clampLevel(override ?? contextual ?? 0, maxLevel);
}

/**
 * 激活当前任务/小步/求助类型。旧会话首次进入时可把全局档位迁入当前上下文；
 * 一旦 scaffoldState 已有上下文，切换任务或小步永远从自己的档位开始，避免跨关泄漏。
 */
export function activateScaffoldContext(session, context = {}, {
  maxLevel = 4,
  migrateLegacy = false,
} = {}) {
  const state = ensureScaffoldState(session);
  const key = scaffoldContextKey(context);
  const stepKey = scaffoldStepKey(context);
  if (
    migrateLegacy
    && !Object.keys(state.byContext).length
    && !Object.keys(state.stepOverrides).length
    && Number(session.scaffoldLevel || 0) > 0
  ) {
    state.byContext[key] = {
      level: clampLevel(session.scaffoldLevel, maxLevel),
      source: 'legacy_migration',
    };
  }
  state.activeKey = key;
  state.activeStepKey = stepKey;
  const level = scaffoldLevelFor(session, context, { maxLevel });
  session.scaffoldLevel = level;
  if (session.learnerState) session.learnerState.scaffoldLevel = level;
  return { key, stepKey, level };
}

export function setScaffoldContextLevel(session, context = {}, level = 0, {
  maxLevel = 4,
  source = 'automatic',
} = {}) {
  const state = ensureScaffoldState(session);
  const key = scaffoldContextKey(context);
  state.byContext[key] = {
    level: clampLevel(level, maxLevel),
    source,
  };
  return activateScaffoldContext(session, context, { maxLevel });
}

export function setScaffoldStepOverride(session, context = {}, level = 0, {
  maxLevel = 4,
  source = 'teacher',
} = {}) {
  const state = ensureScaffoldState(session);
  const stepKey = scaffoldStepKey(context);
  state.stepOverrides[stepKey] = clampLevel(level, maxLevel);
  state.lastOverride = { stepKey, source };
  return activateScaffoldContext(session, context, { maxLevel });
}

export function scaffoldStateSnapshot(session) {
  const state = ensureScaffoldState(session);
  return {
    schemaVersion: state.schemaVersion,
    activeKey: state.activeKey,
    activeStepKey: state.activeStepKey,
    level: Number(session.scaffoldLevel || 0),
  };
}
