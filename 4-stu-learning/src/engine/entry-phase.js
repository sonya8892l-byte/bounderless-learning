/**
 * Finds the first executable phase-track task that must happen before role
 * selection.  A course may deliberately place that task in the same phase as
 * role assignment, so the role phase itself is included in the search window.
 */
export function entryPhaseForLesson(lesson = {}) {
  const phases = Array.isArray(lesson.phases) ? lesson.phases : [];
  const rolePhaseId = String(lesson.roleSystem?.phaseId || '');
  const rolePhaseIndex = phases.findIndex((phase) => phase.id === rolePhaseId);
  const candidates = rolePhaseIndex >= 0
    ? phases.slice(0, rolePhaseIndex + 1)
    : phases;
  return candidates.find((phase) => Array.isArray(phase.tasks) && phase.tasks.length > 0) || null;
}
