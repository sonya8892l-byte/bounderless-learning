export const FIRST_MESSAGE_REVEAL_DELAY_MS = 350;
export const MESSAGE_REVEAL_DELAY_MS = 900;
export const TOOL_REVEAL_DELAY_MS = 2_000;
export const PHASE_TRANSITION_DELAY_MS = 2_400;

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
  if (event?.type === 'tool.requested') return TOOL_REVEAL_DELAY_MS;
  if (visibleEventCount === 0) return initialEmpty ? FIRST_MESSAGE_REVEAL_DELAY_MS : 0;
  return MESSAGE_REVEAL_DELAY_MS;
}
