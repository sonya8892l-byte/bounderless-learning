export function resolveStudentRuntime(
  searchParams = new URLSearchParams(),
  { allowStandalone = true, defaultStandalone = false } = {},
) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams);
  const requestedMode = String(params.get('mode') || '').trim().toLowerCase();
  const hasFormalRunIdentity = Boolean(params.get('runId') || params.get('participantId'));
  const standaloneRequested = requestedMode === 'standalone'
    || (requestedMode === '' && defaultStandalone && !hasFormalRunIdentity);
  const standalone = standaloneRequested && allowStandalone;
  const localPrototypeConnected = requestedMode === ''
    && !hasFormalRunIdentity
    && !standalone;

  return {
    mode: standalone ? 'standalone' : 'connected',
    standalone,
    standaloneDenied: standaloneRequested && !allowStandalone,
    teacherReleasedRoles: standalone
      || localPrototypeConnected
      || params.get('teacherStart') === '1',
  };
}
