import {
  MESSAGE_REVEAL_DELAY_MS,
  TOOL_REVEAL_DELAY_MS,
} from './presentation-timing.js';

export const TURN_PLAN_VERSION = '2026-08-14.1';

const TOOL_PRIORITY = Object.freeze({
  call_teacher: 40,
  show_navigation: 30,
  open_task_tool: 20,
});

function toolPriority(call) {
  return Number(TOOL_PRIORITY[call?.name] || 0);
}

/**
 * 一个回合只给学生一个主要操作。若模型返回多个工具，按安全→导航→任务工具的
 * 固定优先级选一个；出现工具时快捷回复让位，避免同时要求学生点两个入口。
 */
export function selectTurnPrimaryAction({ toolCalls = [], quickReplies = [] } = {}) {
  const candidates = toolCalls.filter(Boolean);
  const selectedTool = candidates
    .map((call, index) => ({ call, index }))
    .sort((a, b) => toolPriority(b.call) - toolPriority(a.call) || a.index - b.index)[0]?.call || null;
  const issues = [];
  if (candidates.length > 1) issues.push('multiple_tools_reduced_to_one');
  if (selectedTool && quickReplies.length) issues.push('quick_replies_suppressed_by_tool');

  if (selectedTool) {
    return {
      toolCalls: [selectedTool],
      quickReplies: [],
      primaryAction: { kind: 'tool', name: selectedTool.name, id: selectedTool.id || '' },
      issues,
    };
  }
  const options = quickReplies.slice(0, 3);
  return {
    toolCalls: [],
    quickReplies: options,
    primaryAction: options.length
      ? { kind: 'quick_replies', name: 'quick_replies', id: '' }
      : { kind: 'none', name: '', id: '' },
    issues,
  };
}

function isVisible(event) {
  return ['assistant.completed', 'stage.started', 'ui.quick_replies', 'tool.requested'].includes(event?.type);
}

function presentationKind(event) {
  if (event.type === 'assistant.completed') return 'message';
  if (event.type === 'stage.started') return 'stage';
  if (event.type === 'ui.quick_replies') return 'quick_replies';
  if (event.type === 'tool.requested') return 'tool';
  return 'state';
}

const TURN_STATE_FIELDS = Object.freeze([
  'phaseId',
  'roleId',
  'taskId',
  'taskIndex',
  'stepId',
  'stepIndex',
  'lifecycle',
  'scaffoldLevel',
  'pendingAdvanceMode',
  'completedTaskCount',
  'completedStepCount',
]);

export function summarizeTurnStateChanges(before = {}, after = {}) {
  return TURN_STATE_FIELDS.flatMap((field) => (
    Object.is(before?.[field], after?.[field])
      ? []
      : [{ field, from: before?.[field] ?? null, to: after?.[field] ?? null }]
  ));
}

function normalizedStateChanges(changes = []) {
  const seen = new Set();
  return (changes || []).flatMap((change) => {
    const value = change && typeof change === 'object'
      ? { field: String(change.field || ''), from: change.from ?? null, to: change.to ?? null }
      : { field: String(change || ''), from: null, to: null };
    if (!value.field) return [];
    const key = JSON.stringify(value);
    if (seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

/**
 * 给已批准的学生端事件附加唯一顺序和揭示节奏。保留消息/阶段原有语义顺序，只把
 * 工具卡稳定移到所有提示之后；非可见事件保持在末尾。
 */
export function planTurnPresentation(events = [], {
  primaryAction = null,
  issues = [],
  nextAction = null,
  safetyAction = null,
  stateChanges = [],
  source = null,
} = {}) {
  const visible = events.filter(isVisible);
  const hidden = events.filter((event) => !isVisible(event));
  const tools = visible.filter((event) => event.type === 'tool.requested');
  if (tools.length > 1) throw new Error('TurnPlan 只能包含一个 tool.requested。');
  const orderedVisible = [
    ...visible.filter((event) => event.type !== 'tool.requested'),
    ...tools,
  ];
  const annotated = orderedVisible.map((event, sequence) => {
    const kind = presentationKind(event);
    const delayMs = sequence === 0
      ? 0
      : kind === 'tool' ? TOOL_REVEAL_DELAY_MS : kind === 'quick_replies' ? 0 : MESSAGE_REVEAL_DELAY_MS;
    return {
      ...event,
      data: {
        ...(event.data || {}),
        presentation: {
          planVersion: TURN_PLAN_VERSION,
          sequence,
          kind,
          delayMs,
        },
      },
    };
  });
  const resolvedPrimaryAction = primaryAction || { kind: 'none', name: '', id: '' };
  const toolEvent = annotated.find((event) => event.type === 'tool.requested') || null;
  const quickReplyEvent = annotated.find((event) => event.type === 'ui.quick_replies') || null;
  const summary = {
    version: TURN_PLAN_VERSION,
    primaryAction: resolvedPrimaryAction,
    nextAction: nextAction || (
      resolvedPrimaryAction.kind === 'none'
        ? { kind: 'continue_dialogue', name: '', id: '' }
        : { ...resolvedPrimaryAction }
    ),
    tool: toolEvent ? {
      name: toolEvent.data?.name || '',
      callId: toolEvent.data?.callId || '',
    } : null,
    quickReplies: {
      questionId: quickReplyEvent?.data?.questionId || '',
      count: Array.isArray(quickReplyEvent?.data?.options) ? quickReplyEvent.data.options.length : 0,
    },
    safetyAction: safetyAction || (
      resolvedPrimaryAction.name === 'call_teacher'
        ? { kind: 'call_teacher', required: true }
        : { kind: 'none', required: false }
    ),
    stateChanges: normalizedStateChanges(stateChanges),
    source: source ? {
      mode: source.mode || '',
      label: source.label || '',
      citationCount: Array.isArray(source.citations) ? source.citations.length : 0,
    } : { mode: '', label: '', citationCount: 0 },
    rhythm: annotated.map((event) => ({
      sequence: event.data.presentation.sequence,
      kind: event.data.presentation.kind,
      delayMs: event.data.presentation.delayMs,
    })),
    visibleCount: annotated.length,
    issues: [...new Set(issues)],
  };
  return { events: [...annotated, ...hidden], summary };
}
