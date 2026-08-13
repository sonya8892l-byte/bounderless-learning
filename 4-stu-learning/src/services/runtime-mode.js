export function resolveStudentRuntime(searchParams = new URLSearchParams(), { allowStandalone = true } = {}) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams);
  const requestedMode = String(params.get('mode') || '').trim().toLowerCase();
  const hasFormalRunIdentity = Boolean(params.get('runId') || params.get('participantId'));
  const standaloneRequested = requestedMode === 'standalone'
    || (requestedMode === '' && !hasFormalRunIdentity);
  const standalone = standaloneRequested && allowStandalone;

  return {
    mode: standalone ? 'standalone' : 'connected',
    standalone,
    standaloneDenied: standaloneRequested && !allowStandalone,
    teacherReleasedRoles: standalone
      || params.get('teacherStart') === '1',
  };
}
