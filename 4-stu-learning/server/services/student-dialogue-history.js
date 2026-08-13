const LEGACY_INTERNAL_USER_MESSAGE = /^(?:context_tick|location_updated|phase_started|photo_removed|role_assigned|student_advance_task|task_step_completed|task_step_revised|teacher_advance_task|teacher_confirm_arrival|teacher_directive|teacher_finalize_task|teacher_reject_task|tool_result)(?:\s|$)/u;

const DEFAULT_MAX_ITEMS = 200;
const DEFAULT_MAX_TEXT_LENGTH = 8_000;
const DEFAULT_MAX_TOTAL_LENGTH = 120_000;

function boundedText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

function isStudentVisibleUserMessage(message, text) {
  if (message?.studentVisible === true) return true;
  if (message?.studentVisible === false) return false;
  if (['user_text', 'quick_reply'].includes(message?.inputType)) return true;
  if (message?.inputType) return false;
  // 旧会话还没有 inputType。排除服务端为了模型上下文合成的生命周期／工具文本，
  // 其余 user 消息按学生真实输入兼容恢复。
  return !LEGACY_INTERNAL_USER_MESSAGE.test(text);
}

function safeMessageId(value, fallback) {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 160 ? id : fallback;
}

function safeCreatedAt(value) {
  const createdAt = typeof value === 'string' ? value.trim() : '';
  return createdAt && createdAt.length <= 64 ? createdAt : null;
}

/**
 * Project the private Agent prompt history into the small, student-safe transcript
 * returned only by the credential-checked resume endpoint.
 */
export function studentDialogueHistory(session, {
  maxItems = DEFAULT_MAX_ITEMS,
  maxTextLength = DEFAULT_MAX_TEXT_LENGTH,
  maxTotalLength = DEFAULT_MAX_TOTAL_LENGTH,
} = {}) {
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const textLimit = Math.max(0, Math.min(
    DEFAULT_MAX_TEXT_LENGTH,
    Number(maxTextLength) || 0,
  ));
  const candidates = messages.flatMap((message, index) => {
    const role = message?.role === 'user' || message?.role === 'assistant'
      ? message.role
      : '';
    const text = boundedText(message?.content ?? message?.text, textLimit);
    if (!role || !text) return [];
    if (role === 'user' && !isStudentVisibleUserMessage(message, text)) return [];
    if (role === 'assistant' && message?.studentVisible === false) return [];
    const source = role === 'assistant'
      ? boundedText(message?.sourceLabel ?? message?.source?.label, 300)
      : '';
    return [{
      id: safeMessageId(message?.id, `dialogue-${index}`),
      role,
      text,
      source,
      createdAt: safeCreatedAt(message?.createdAt),
    }];
  });

  const selected = [];
  let totalLength = 0;
  const itemLimit = Math.max(0, Math.min(DEFAULT_MAX_ITEMS, Number(maxItems) || 0));
  const totalLimit = Math.max(0, Math.min(DEFAULT_MAX_TOTAL_LENGTH, Number(maxTotalLength) || 0));
  for (let index = candidates.length - 1; index >= 0 && selected.length < itemLimit; index -= 1) {
    const item = candidates[index];
    const itemLength = item.text.length + item.source.length;
    if (selected.length && totalLength + itemLength > totalLimit) break;
    if (!selected.length && itemLength > totalLimit) {
      if (totalLimit > 0) selected.push({ ...item, text: item.text.slice(0, totalLimit) });
      break;
    }
    selected.push(item);
    totalLength += itemLength;
  }
  return selected.reverse();
}
