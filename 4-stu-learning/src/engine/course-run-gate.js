const COURSE_RUN_GATE_CODES = new Set([
  'COURSE_RUN_NOT_ACTIVE',
  'COURSE_RUN_PAUSED',
  'COURSE_RUN_RALLY_ACTIVE',
  'COURSE_RUN_COMPLETED',
  'COURSE_SESSION_INACTIVE',
  'COURSE_ROLES_LOCKED',
]);

export function courseRunGateFromError(error, current = {}) {
  const code = String(error?.code || '');
  if (!COURSE_RUN_GATE_CODES.has(code)) return null;
  const serverState = error?.details?.runState && typeof error.details.runState === 'object'
    ? error.details.runState
    : {};
  const gate = {
    status: current.status || null,
    paused: Boolean(current.paused),
    rallyActive: Boolean(current.rallyActive),
    rolesReleased: Boolean(current.rolesReleased),
    rolesLocked: Boolean(current.rolesLocked),
    sessionInactive: Boolean(current.sessionInactive),
    ...serverState,
    code,
    message: error?.message || '当前学习状态已由老师更新。',
  };

  if (code === 'COURSE_RUN_NOT_ACTIVE') {
    gate.status = serverState.status || 'draft';
    gate.paused = false;
    gate.rallyActive = false;
  }
  if (code === 'COURSE_RUN_PAUSED') {
    gate.status = serverState.status || 'active';
    gate.paused = true;
    gate.rallyActive = false;
  }
  if (code === 'COURSE_RUN_RALLY_ACTIVE') {
    gate.status = serverState.status || 'active';
    gate.rallyActive = true;
  }
  if (code === 'COURSE_RUN_COMPLETED') {
    gate.status = 'completed';
    gate.paused = false;
    gate.rallyActive = false;
  }
  if (code === 'COURSE_SESSION_INACTIVE') gate.sessionInactive = true;
  if (code === 'COURSE_ROLES_LOCKED') {
    gate.rolesReleased = false;
    gate.rolesLocked = true;
  }
  return gate;
}
