const STORAGE_PREFIX = 'forbidden-city-study:join';

function credentialKey(params, courseId) {
  const runId = String(params.get('runId') || '').trim();
  const participantId = String(params.get('participantId') || '').trim();
  if (!runId || !participantId || !courseId) return '';
  return `${STORAGE_PREFIX}:${encodeURIComponent(courseId)}:${encodeURIComponent(runId)}:${encodeURIComponent(participantId)}`;
}

export function consumeJoinCredential(params, {
  courseId,
  storage,
  replaceSearch,
  fragmentParams = new URLSearchParams(),
  replaceLocation,
} = {}) {
  const key = credentialKey(params, courseId);
  const supplied = String(fragmentParams.get('joinCredential') || params.get('joinCredential') || '').trim();
  let stored = '';
  try {
    stored = key ? String(storage?.getItem(key) || '') : '';
    if (key && supplied) storage?.setItem(key, supplied);
  } catch {
    // Some embedded browsers disable sessionStorage. The in-memory value still
    // works for the current page; refresh then requires opening the issued link again.
  }
  params.delete('joinCredential');
  fragmentParams.delete('joinCredential');
  if (supplied) {
    if (replaceLocation) replaceLocation({ searchParams: params, fragmentParams });
    else replaceSearch?.(params);
  }
  return supplied || stored || '';
}
