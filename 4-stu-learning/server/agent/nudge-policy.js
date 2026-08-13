function time(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function evaluateNudge({ session, task, input, now = Date.now() }) {
  if (input.type !== 'lifecycle_event' || input.event !== 'context_tick') return { due: false, reason: 'not_tick' };
  const busy = input.data?.busy && typeof input.data.busy === 'object'
    ? Object.entries(input.data.busy).find(([, active]) => active === true)?.[0]
    : '';
  if (input.data?.pageVisible === false || input.data?.hasDraft || busy) {
    return { due: false, reason: 'student_busy', busy: busy || (input.data?.hasDraft ? 'draft' : 'hidden') };
  }
  if (session.learningState?.teacherLock || session.dialogueState?.lifecycle === 'PAUSED_BY_TEACHER') {
    return { due: false, reason: 'teacher_paused' };
  }
  if (['CONVERSATION_REPAIR', 'EMOTIONAL_SUPPORT', 'SAFETY_ESCALATION', 'NETWORK_RECOVERY'].includes(session.dialogueState?.lifecycle)) {
    return { due: false, reason: 'dialogue_interrupted' };
  }
  if (['distressed', 'tired', 'frustrated'].includes(session.conversationState?.studentSignal)) {
    return { due: false, reason: 'student_needs_space' };
  }
  const limit = Number(task?.nudgePolicy?.maxNudges || 0);
  if ((session.conversationState?.nudgeCount || 0) >= limit) return { due: false, reason: 'limit_reached' };
  const lastAction = time(session.taskState?.lastMeaningfulActionAt) || now;
  const idleSeconds = Math.max(0, Math.floor((now - lastAction) / 1000));
  const threshold = Number(task?.timing?.idleNudgeSeconds || 0);
  if (!threshold || idleSeconds < threshold) return { due: false, reason: 'not_due', idleSeconds };
  const cooldown = Number(task?.timing?.nudgeCooldownSeconds || 0);
  const lastNudge = time(session.conversationState?.lastNudgeAt);
  if (lastNudge && now - lastNudge < cooldown * 1000) return { due: false, reason: 'cooldown', idleSeconds };

  const needsArrival = task?.location?.mode !== 'none' && session.locationState?.status !== 'arrived';
  return {
    due: true,
    reason: needsArrival ? 'location_pending' : 'task_idle',
    idleSeconds,
    level: Math.min(2, (session.conversationState?.nudgeCount || 0) + 1),
  };
}

export function recordNudge(session, now = Date.now()) {
  session.conversationState.lastNudgeAt = new Date(now).toISOString();
  session.conversationState.nudgeCount = (session.conversationState.nudgeCount || 0) + 1;
}
