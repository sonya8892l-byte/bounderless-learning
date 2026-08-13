export const FIRST_MESSAGE_REVEAL_DELAY_MS = 350;
export const MESSAGE_REVEAL_DELAY_MS = 900;
export const TOOL_REVEAL_DELAY_MS = 2_000;
export const PHASE_TRANSITION_DELAY_MS = 2_400;

export function isAuditOnlyTransportEvent(event) {
  return event?.type === 'assistant.delta';
}

const PASSIVE_PRESENTATION_EVENTS = new Set([
  'assistant.completed',
  'stage.started',
  'tool.requested',
  'ui.quick_replies',
]);

/**
 * A context tick can finish after the learner has already resumed work.  Its
 * authoritative state event must still be applied, while a now-stale reminder
 * should stay out of the conversation.
 */
export function shouldSuppressPassivePresentation(event, {
  passive = false,
  requestLastLocalActionAt = null,
  currentLastLocalActionAt = null,
  pageHidden = false,
} = {}) {
  if (!passive || !PASSIVE_PRESENTATION_EVENTS.has(event?.type)) return false;
  const learnerResumed = Number.isFinite(Number(requestLastLocalActionAt))
    && Number.isFinite(Number(currentLastLocalActionAt))
    && Number(currentLastLocalActionAt) !== Number(requestLastLocalActionAt);
  return learnerResumed || pageHidden;
}

/**
 * 对话中的内容按教学节奏逐条揭示。工具卡需要留出一段更明显的停顿，
 * 让学生先读完絮絮的说明，再把注意力转到操作区。
 */
export function visibleEventDelay(event, {
  visibleEventCount = 0,
  initialEmpty = false,
  completesStream = false,
} = {}) {
  if (completesStream) return 0;
  const plannedDelay = Number(event?.data?.presentation?.delayMs);
  if (visibleEventCount > 0 && Number.isFinite(plannedDelay) && plannedDelay >= 0) return plannedDelay;
  if (event?.type === 'tool.requested') return TOOL_REVEAL_DELAY_MS;
  if (visibleEventCount === 0) return initialEmpty ? FIRST_MESSAGE_REVEAL_DELAY_MS : 0;
  return MESSAGE_REVEAL_DELAY_MS;
}
