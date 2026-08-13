export const STUDENT_TEACHER_COMMAND_ACTIONS = Object.freeze([
  'send_notice',
  'push_knowledge',
  'add_time',
  'remove_time',
  'pause',
  'resume',
  'release_roles',
  'lock_roles',
  'start_phase',
  'advance_phase',
  'end_run',
  'confirm_arrival',
  'reject_evidence',
  'approve_evidence',
  'skip_step',
  'set_scaffold',
  'switch_alternative',
  'emergency_rally',
  'advance_task',
]);

const ACTION_SET = new Set(STUDENT_TEACHER_COMMAND_ACTIONS);

function failed(action, code, message, error = null) {
  return {
    action,
    handled: false,
    code,
    message,
    error,
  };
}

/**
 * Exhaustive, transport-independent teacher-command dispatcher.
 *
 * A command is handled only after its action-specific handler completes.
 * Missing/unknown handlers and thrown application errors are explicit
 * failures so the caller can send a `failed` receipt instead of silently
 * acknowledging work that never happened.
 */
export async function dispatchTeacherCommand(command, handlers = {}) {
  const action = String(command?.action || '').trim();
  if (!ACTION_SET.has(action)) {
    return failed(action, 'TEACHER_COMMAND_UNSUPPORTED', `学生端不支持教师指令「${action || '空指令'}」。`);
  }
  const handler = handlers[action];
  if (typeof handler !== 'function') {
    return failed(action, 'TEACHER_COMMAND_HANDLER_MISSING', `教师指令「${action}」缺少学生端处理器。`);
  }
  try {
    const value = await handler(command);
    if (value === false || value?.handled === false) {
      return failed(
        action,
        value?.code || 'TEACHER_COMMAND_NOT_APPLIED',
        value?.message || `教师指令「${action}」没有应用。`,
      );
    }
    return { action, handled: true, code: 'TEACHER_COMMAND_APPLIED', value };
  } catch (error) {
    return failed(
      action,
      error?.code || 'TEACHER_COMMAND_APPLICATION_FAILED',
      error?.message || `教师指令「${action}」应用失败。`,
      error,
    );
  }
}
