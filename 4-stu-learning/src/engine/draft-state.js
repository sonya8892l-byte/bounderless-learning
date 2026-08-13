function hasMeaningfulToolValue(value) {
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasMeaningfulToolValue);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => (
    !['processing', 'recording', 'error'].includes(key) && hasMeaningfulToolValue(item)
  ));
}

export function hasCurrentTaskDraft({ evidenceByTask = {}, taskId = '', chatDraft = '' } = {}) {
  if (String(chatDraft || '').trim()) return true;
  if (!taskId) return false;
  const evidence = evidenceByTask?.[taskId];
  return Boolean(evidence?.text?.trim()
    || evidence?.files?.length
    || hasMeaningfulToolValue(evidence?.toolValues));
}

export function hasActiveEvidenceProcessing({ uploadCount = 0, toolValues = [] } = {}) {
  if (Number(uploadCount) > 0) return true;
  const values = Array.isArray(toolValues) ? toolValues : Object.values(toolValues || {});
  return values.some((value) => value?.processing === true);
}
