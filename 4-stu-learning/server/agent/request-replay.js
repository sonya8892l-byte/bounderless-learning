import { createHash } from 'node:crypto';
import { planTurnPresentation, TURN_PLAN_VERSION } from '../../src/engine/turn-plan.js';
import { STUDENT_FACING_POLICY_VERSION } from './student-facing-policy.js';
import { TURN_TRACE_SCHEMA_VERSION } from './turn-trace.js';

export const REQUEST_REPLAY_LIMIT = 100;
export const REQUEST_REPLAY_ENVELOPE_VERSION = 1;
export const REQUEST_REPLAY_ENVELOPE_KIND = 'learner_turn_replay';

const VISIBLE_EVENT_KINDS = Object.freeze({
  'assistant.completed': 'message',
  'stage.started': 'stage',
  'ui.quick_replies': 'quick_replies',
  'tool.requested': 'tool',
});
const ALLOWED_REPLAY_EVENT_TYPES = new Set([
  ...Object.keys(VISIBLE_EVENT_KINDS),
  'state.updated',
]);

export class RequestReplayConflictError extends Error {
  constructor(requestId) {
    super(`requestId ${requestId} 已用于不同的请求内容。`);
    this.name = 'RequestReplayConflictError';
    this.code = 'LEARNER_REQUEST_HASH_CONFLICT';
    this.statusCode = 409;
  }
}

function clone(value) {
  return structuredClone(value);
}

function replayLimit(value) {
  return Math.max(1, Number(value) || REQUEST_REPLAY_LIMIT);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function traceRequestIdDigest(requestId) {
  return `sha256:${createHash('sha256')
    .update(`turn-request:${String(requestId || '')}`)
    .digest('hex')}`;
}

function eventTypeCounts(events = []) {
  const counts = {};
  for (const event of events) counts[event?.type] = Number(counts[event?.type] || 0) + 1;
  return counts;
}

function phaseTaskContextForSession(session) {
  if (session.phaseTaskState) return session.phaseTaskState;
  if (session.roleId) return null;
  return {
    phaseId: session.phaseId,
    currentTaskIndex: session.currentTaskIndex,
    completedTaskIds: [...(session.completedTaskIds || [])],
    taskId: session.taskState?.taskId || '',
    guidanceStepIndex: Number(session.taskState?.guidanceStepIndex || 0),
  };
}

function stableRuntimeFromEvent(runtime = {}) {
  return {
    taskId: runtime.taskId || '',
    location: runtime.location || null,
    lastIntent: runtime.lastIntent || '',
    studentSignal: runtime.studentSignal || 'neutral',
    nudgeCount: Number(runtime.nudgeCount || 0),
    guidanceStepIndex: Number(runtime.guidanceStepIndex || 0),
    stageAnnounced: Boolean(runtime.stageAnnounced),
    onboarding: runtime.onboarding || null,
    dialogue: runtime.dialogue || null,
    learner: runtime.learner || null,
    environment: runtime.environment || null,
    learning: runtime.learning || null,
    taskFinalization: runtime.taskFinalization || null,
    lastStepRevision: runtime.lastStepRevision || null,
  };
}

function stableRuntimeFromSession(session = {}) {
  return {
    taskId: session.taskState?.taskId || '',
    location: { ...(session.locationState || {}) },
    lastIntent: session.conversationState?.lastIntent || '',
    studentSignal: session.conversationState?.studentSignal || 'neutral',
    nudgeCount: Number(session.conversationState?.nudgeCount || 0),
    guidanceStepIndex: Number(session.taskState?.guidanceStepIndex || 0),
    stageAnnounced: Boolean(session.taskState?.stageAnnounced),
    onboarding: session.onboardingState || null,
    dialogue: session.dialogueState || null,
    learner: session.learnerState || null,
    environment: session.environmentState || null,
    learning: session.learningState || null,
    taskFinalization: session.taskState?.finalization || null,
    lastStepRevision: session.taskState?.lastStepRevision || null,
  };
}

function terminalProjectionFromEvent(event = {}) {
  const data = event.data || {};
  return {
    phaseId: data.phaseId || '',
    roleId: data.roleId || '',
    phaseTaskContext: data.phaseTaskContext || null,
    currentTaskIndex: Number(data.currentTaskIndex || 0),
    completedTaskIds: data.completedTaskIds || [],
    scaffoldLevel: Number(data.scaffoldLevel || 0),
    scaffoldState: data.scaffoldState || null,
    pendingAdvance: data.pendingAdvance || null,
    taskFinalization: data.taskFinalization || null,
    learningState: data.learningState || null,
    dialogueState: data.dialogueState || null,
    runtime: stableRuntimeFromEvent(data.runtime),
  };
}

function terminalProjectionFromSession(session = {}) {
  return {
    phaseId: session.phaseId || '',
    roleId: session.roleId || '',
    phaseTaskContext: phaseTaskContextForSession(session),
    currentTaskIndex: Number(session.currentTaskIndex || 0),
    completedTaskIds: session.completedTaskIds || [],
    scaffoldLevel: Number(session.scaffoldLevel || 0),
    scaffoldState: {
      schemaVersion: Number(session.scaffoldState?.schemaVersion || 1),
      activeKey: session.scaffoldState?.activeKey || '',
      activeStepKey: session.scaffoldState?.activeStepKey || '',
      level: Number(session.scaffoldLevel || 0),
    },
    pendingAdvance: session.pendingAdvance
      ? { mode: session.pendingAdvance.mode, taskId: session.pendingAdvance.taskId }
      : null,
    taskFinalization: session.taskState?.finalization || null,
    learningState: session.learningState || null,
    dialogueState: session.dialogueState || null,
    runtime: stableRuntimeFromSession(session),
  };
}

function traceStateFromTerminal(event = {}) {
  const data = event.data || {};
  return {
    phaseId: data.phaseId || '',
    roleId: data.roleId || '',
    taskId: data.runtime?.taskId || '',
    taskIndex: Number(data.currentTaskIndex || 0),
    stepId: data.learningState?.stepId ?? null,
    stepIndex: Number(data.runtime?.guidanceStepIndex || 0),
    lifecycle: data.dialogueState?.lifecycle || '',
    scaffoldLevel: Number(data.scaffoldLevel || 0),
    pendingAdvanceMode: data.pendingAdvance?.mode || '',
    completedTaskCount: (data.completedTaskIds || []).length,
    completedStepCount: (data.learningState?.completedStepIds || []).length,
  };
}

function traceStateProjection(state = {}) {
  return Object.fromEntries(Object.keys(traceStateFromTerminal()).map((key) => [key, state[key]]));
}

function validAssistantParts(events) {
  const parts = events.filter((event) => event?.type === 'assistant.completed');
  const ids = new Set();
  let activeGroup = null;
  for (const event of parts) {
    const data = event.data || {};
    if (
      typeof data.id !== 'string' || !data.id
      || ids.has(data.id)
      || typeof data.text !== 'string' || !data.text
      || typeof data.intent !== 'string' || !data.intent
      || typeof data.dialogueMove !== 'string' || !data.dialogueMove
      || typeof data.streamed !== 'boolean'
      || typeof data.degraded !== 'boolean'
      || !data.source || typeof data.source !== 'object'
      || typeof data.source.mode !== 'string'
      || !Array.isArray(data.source.citations)
      || !Number.isInteger(data.partIndex)
      || !Number.isInteger(data.partCount)
      || data.partCount < 1
      || data.partIndex < 0
      || data.partIndex >= data.partCount
    ) return false;
    ids.add(data.id);

    if (data.partIndex === 0) {
      if (activeGroup) return false;
      activeGroup = { count: data.partCount, next: 0 };
    } else if (
      !activeGroup
      || data.partCount !== activeGroup.count
      || data.partIndex !== activeGroup.next
    ) return false;

    activeGroup.next += 1;
    if (activeGroup.next === activeGroup.count) activeGroup = null;
  }
  return activeGroup === null;
}

function validPresentation(events, terminal) {
  const visible = events.filter((event) => Object.hasOwn(VISIBLE_EVENT_KINDS, event?.type));
  const expected = planTurnPresentation(visible.map((event) => {
    const { presentation: _presentation, ...data } = event.data || {};
    return { ...event, data };
  })).events;
  for (let index = 0; index < visible.length; index += 1) {
    const event = visible[index];
    const presentation = event.data?.presentation;
    if (
      presentation?.planVersion !== TURN_PLAN_VERSION
      || presentation.sequence !== index
      || presentation.kind !== VISIBLE_EVENT_KINDS[event.type]
      || !Number.isFinite(presentation.delayMs)
      || presentation.delayMs < 0
      || canonicalJson(presentation) !== canonicalJson(expected[index]?.data?.presentation)
    ) return false;
  }

  const tools = visible.filter((event) => event.type === 'tool.requested');
  const quickReplies = visible.filter((event) => event.type === 'ui.quick_replies');
  if (tools.length > 1 || quickReplies.length > 1) return false;
  if (tools.length && visible.at(-1) !== tools[0]) return false;
  if (tools.length && quickReplies.length) return false;

  const summary = terminal.data?.turnPlan;
  const rhythm = visible.map((event) => ({
    sequence: event.data.presentation.sequence,
    kind: event.data.presentation.kind,
    delayMs: event.data.presentation.delayMs,
  }));
  if (
    summary?.version !== TURN_PLAN_VERSION
    || Number(summary.visibleCount) !== visible.length
    || canonicalJson(summary.rhythm || []) !== canonicalJson(rhythm)
  ) return false;

  const tool = tools[0] || null;
  const quickReply = quickReplies[0] || null;
  if (tool) {
    if (
      summary.primaryAction?.kind !== 'tool'
      || summary.primaryAction?.name !== tool.data?.name
      || summary.primaryAction?.id !== tool.data?.callId
      || summary.tool?.name !== tool.data?.name
      || summary.tool?.callId !== tool.data?.callId
    ) return false;
  } else if (summary.tool !== null) return false;

  if (quickReply) {
    if (
      summary.primaryAction?.kind !== 'quick_replies'
      || summary.primaryAction?.name !== 'quick_replies'
      || summary.primaryAction?.id !== ''
      || summary.quickReplies?.questionId !== (quickReply.data?.questionId || '')
      || Number(summary.quickReplies?.count) !== (quickReply.data?.options || []).length
    ) return false;
  } else if (Number(summary.quickReplies?.count || 0) !== 0) return false;

  if (!tool && !quickReply && (
    summary.primaryAction?.kind !== 'none'
    || summary.primaryAction?.name !== ''
    || summary.primaryAction?.id !== ''
  )) return false;

  const expectedNextAction = summary.primaryAction?.kind === 'none'
    ? { kind: 'continue_dialogue', name: '', id: '' }
    : summary.primaryAction;
  if (canonicalJson(summary.nextAction) !== canonicalJson(expectedNextAction)) return false;

  const expectedSafetyAction = tool?.data?.name === 'call_teacher'
    ? { kind: 'call_teacher', required: true }
    : { kind: 'none', required: false };
  if (canonicalJson(summary.safetyAction) !== canonicalJson(expectedSafetyAction)) return false;

  return true;
}

function incompatible(reason) {
  return { compatible: false, reason, events: [] };
}

export function createReplayEnvelope({ events = [], trace = null, requestDigest = '' } = {}) {
  const terminal = events.at(-1);
  return {
    kind: REQUEST_REPLAY_ENVELOPE_KIND,
    schemaVersion: REQUEST_REPLAY_ENVELOPE_VERSION,
    requestDigest: String(requestDigest || ''),
    versions: {
      traceSchemaVersion: trace?.schemaVersion ?? null,
      studentFacingPolicyVersion: trace?.versions?.studentFacingPolicyVersion || '',
      courseContentVersion: trace?.versions?.contentVersion || '',
      turnPlanVersion: terminal?.data?.turnPlan?.version || trace?.output?.turnPlan?.version || '',
    },
    trace: clone(trace),
    events: clone(events),
    completedAt: new Date().toISOString(),
  };
}

/**
 * Only an envelope produced under the current output boundary may replay
 * student-facing text. Any legacy, stale or malformed result is recovery-only.
 */
export function resolveReplayEnvelope(envelope, {
  requestId = '',
  requestDigest = '',
  courseContentVersion = '',
  session = null,
} = {}) {
  if (!envelope || typeof envelope !== 'object') return incompatible('missing_or_legacy_envelope');
  if (
    envelope.kind !== REQUEST_REPLAY_ENVELOPE_KIND
    || envelope.schemaVersion !== REQUEST_REPLAY_ENVELOPE_VERSION
  ) return incompatible('envelope_version_mismatch');
  if (!requestDigest || envelope.requestDigest !== requestDigest) return incompatible('request_digest_mismatch');
  if (envelope.versions?.traceSchemaVersion !== TURN_TRACE_SCHEMA_VERSION) {
    return incompatible('trace_schema_mismatch');
  }
  if (envelope.versions?.studentFacingPolicyVersion !== STUDENT_FACING_POLICY_VERSION) {
    return incompatible('student_facing_policy_mismatch');
  }
  if (!courseContentVersion || envelope.versions?.courseContentVersion !== courseContentVersion) {
    return incompatible('course_content_version_mismatch');
  }
  if (envelope.versions?.turnPlanVersion !== TURN_PLAN_VERSION) {
    return incompatible('turn_plan_version_mismatch');
  }

  const trace = envelope.trace;
  const events = envelope.events;
  if (!trace || trace.schemaVersion !== TURN_TRACE_SCHEMA_VERSION || !Array.isArray(events)) {
    return incompatible('trace_or_events_missing');
  }
  if (
    typeof trace.traceId !== 'string' || !trace.traceId
    || !requestId
    || trace.requestIdDigest !== traceRequestIdDigest(requestId)
    || trace.courseId !== session?.courseId
  ) return incompatible('trace_identity_mismatch');
  if (
    trace.status !== 'completed' && trace.status !== 'degraded'
  ) return incompatible('trace_status_invalid');
  if (
    trace.versions?.studentFacingPolicyVersion !== STUDENT_FACING_POLICY_VERSION
    || trace.versions?.contentVersion !== courseContentVersion
    || trace.output?.turnPlan?.version !== TURN_PLAN_VERSION
  ) return incompatible('trace_version_mismatch');
  if (events.some((event) => (
    !event || typeof event !== 'object'
    || !ALLOWED_REPLAY_EVENT_TYPES.has(event.type)
    || !event.data || typeof event.data !== 'object'
  ))) return incompatible('event_schema_invalid');

  const stateEvents = events.filter((event) => event?.type === 'state.updated');
  const terminal = events.at(-1);
  if (stateEvents.length !== 1 || terminal?.type !== 'state.updated') {
    return incompatible('terminal_state_missing');
  }
  if (!validAssistantParts(events)) return incompatible('assistant_parts_invalid');
  if (!validPresentation(events, terminal)) return incompatible('presentation_invalid');
  if (
    Number(trace.output?.partCount || 0) !== events.filter((event) => event.type === 'assistant.completed').length
    || canonicalJson(trace.output?.eventTypeCounts || {}) !== canonicalJson(eventTypeCounts(events))
    || Number(trace.output?.turnPlan?.visibleCount || 0) !== Number(terminal.data?.turnPlan?.visibleCount || 0)
  ) return incompatible('trace_event_projection_mismatch');
  if (
    canonicalJson(traceStateProjection(trace.stateAfter))
    !== canonicalJson(traceStateFromTerminal(terminal))
  ) return incompatible('trace_terminal_state_mismatch');
  if (
    !session
    || String(session.contentVersion || '') !== String(courseContentVersion)
    || canonicalJson(terminalProjectionFromEvent(terminal))
      !== canonicalJson(terminalProjectionFromSession(session))
  ) return incompatible('authoritative_state_changed');

  return { compatible: true, reason: '', events: clone(events) };
}

/**
 * 与共享数据库 learner_requests.request_digest 使用同一投影。
 * requestId 是幂等键，不进入摘要；同键重试必须携带相同会话和输入。
 */
export function learnerRequestDigest({ sessionId, input } = {}) {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify({ sessionId, input }))
    .digest('hex')}`;
}

export function rememberRequestResult(session, requestId, replayEnvelope, {
  limit = REQUEST_REPLAY_LIMIT,
  requestDigest = '',
} = {}) {
  if (!requestId) return;
  const retained = replayLimit(limit);
  const existing = Array.isArray(session.handledRequestResults)
    ? session.handledRequestResults.filter((item) => item?.requestId !== requestId)
    : [];
  existing.push({
    requestId,
    requestDigest,
    replayEnvelope: replayEnvelope?.kind === REQUEST_REPLAY_ENVELOPE_KIND
      && replayEnvelope?.schemaVersion === REQUEST_REPLAY_ENVELOPE_VERSION
      ? clone(replayEnvelope)
      : null,
    completedAt: new Date().toISOString(),
  });
  session.handledRequestResults = existing.slice(-retained);

  const handledIds = Array.isArray(session.handledRequestIds)
    ? session.handledRequestIds.filter((item) => item !== requestId)
    : [];
  handledIds.push(requestId);
  session.handledRequestIds = handledIds.slice(-retained);
}

export function replayRequestResult(session, requestId, { requestDigest = '' } = {}) {
  const item = (session.handledRequestResults || [])
    .find((candidate) => candidate?.requestId === requestId);
  if (
    item?.requestDigest
    && requestDigest
    && item.requestDigest !== requestDigest
  ) {
    throw new RequestReplayConflictError(requestId);
  }
  return item?.replayEnvelope ? clone(item.replayEnvelope) : null;
}
