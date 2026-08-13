export function createTeacherCommandAuthority() {
  const issued = new Map();
  let sequence = 0;

  function issue({ sessionId, action, payload = {}, commandId } = {}) {
    sequence += 1;
    const id = commandId || `cmd_test_${sequence}`;
    issued.set(id, {
      commandId: id,
      sessionId: String(sessionId || ''),
      action: String(action || ''),
      payload,
      consumed: false,
    });
    return id;
  }

  async function consume({ sessionId, requirement }) {
    const command = issued.get(requirement.commandId);
    if (
      !command
      || command.consumed
      || command.sessionId !== String(sessionId)
      || command.action !== requirement.action
    ) return null;
    command.consumed = true;
    return {
      sessionId: command.sessionId,
      commandId: command.commandId,
      action: command.action,
    };
  }

  return { issue, consume };
}

export function actionForTeacherLifecycleEvent(event, data = {}) {
  if (event === 'teacher_confirm_arrival') return 'confirm_arrival';
  if (event === 'teacher_finalize_task') return 'approve_evidence';
  if (event === 'teacher_reject_task') return 'reject_evidence';
  if (event === 'teacher_advance_task') return 'advance_task';
  if (event === 'teacher_directive') return data.phaseId ? 'advance_phase' : 'set_scaffold';
  if (event === 'task_step_completed' && data.teacherOverride === true) return 'skip_step';
  if (event === 'task_step_completed' && data.teacherApproved === true) return 'approve_evidence';
  return '';
}
