import crypto from 'node:crypto';

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value === undefined ? null : value;
}

export function stepEvidenceFingerprint(toolValues = {}, stepId = '') {
  const canonical = JSON.stringify(canonicalValue(toolValues?.[stepId] || {}));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function acceptedStepEvidence(session, stepId) {
  const accepted = session.taskState?.stepEvidenceFingerprints?.[stepId];
  if (!accepted) return null;
  return typeof accepted === 'string'
    ? { fingerprint: accepted, source: 'legacy' }
    : accepted;
}

export function acceptStepEvidence(session, {
  stepId,
  fingerprint,
  source = 'ai_evaluation',
  acceptedAt = new Date().toISOString(),
}) {
  session.taskState ||= {};
  session.taskState.stepEvidenceFingerprints ||= {};
  session.taskState.stepEvidenceFingerprints[stepId] = {
    fingerprint,
    source,
    acceptedAt,
  };
  return session.taskState.stepEvidenceFingerprints[stepId];
}

export function recordStepRevision(session, revision) {
  session.taskState ||= {};
  session.taskState.stepRevisionHistory ||= [];
  const entry = {
    revisionId: String(revision.revisionId || crypto.randomUUID()),
    stepId: String(revision.stepId || ''),
    completionMode: String(revision.completionMode || ''),
    previousFingerprint: String(revision.previousFingerprint || ''),
    currentFingerprint: String(revision.currentFingerprint || ''),
    changed: Boolean(revision.changed),
    passed: Boolean(revision.passed),
    checkedBy: String(revision.checkedBy || 'runtime_validation'),
    feedback: String(revision.feedback || ''),
    revisedAt: revision.revisedAt || new Date().toISOString(),
  };
  session.taskState.stepRevisionHistory.push(entry);
  session.taskState.stepRevisionHistory = session.taskState.stepRevisionHistory.slice(-30);
  session.taskState.lastStepRevision = entry;
  return entry;
}
