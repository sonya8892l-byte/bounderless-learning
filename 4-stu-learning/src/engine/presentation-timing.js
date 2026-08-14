export const FIRST_MESSAGE_REVEAL_DELAY_MS = 350;
export const CONTENT_REVEAL_INTERVAL_MS = 3_000;
export const MESSAGE_REVEAL_DELAY_MS = CONTENT_REVEAL_INTERVAL_MS;
export const TOOL_REVEAL_DELAY_MS = CONTENT_REVEAL_INTERVAL_MS;
export const PHASE_TRANSITION_DELAY_MS = CONTENT_REVEAL_INTERVAL_MS;

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
 * 对话中的内容按教学节奏逐条揭示。后续消息与任务卡共用统一阅读间隔，
 * 让学生先读完当前内容，再把注意力转到下一项。
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

/**
 * Step 反馈读完后，把消息流里原有的当前任务卡移到最下方。
 * 这里移动原对象，不复制卡片，照片、草稿、callId 和 payload 都继续使用
 * roleState 中的同一份状态。
 */
export function republishActiveTaskMessage(messages = [], taskId = '') {
  if (!taskId || !Array.isArray(messages)) return null;
  const matchesTask = (message) => (
    message?.type === 'task'
    && message.status === 'active'
    && message.payload?.taskId === taskId
  );
  const messageIndex = messages.findIndex(matchesTask);
  if (messageIndex < 0) return null;
  const [message] = messages.splice(messageIndex, 1);
  messages.push(message);
  return message;
}
