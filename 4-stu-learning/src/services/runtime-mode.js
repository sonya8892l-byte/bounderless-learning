export function resolveStudentRuntime(searchParams = new URLSearchParams()) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams);
  const requestedMode = String(params.get('mode') || '').trim().toLowerCase();
  const standalone = requestedMode === 'standalone';
  const defaultConnected = requestedMode === '';

  return {
    mode: standalone ? 'standalone' : 'connected',
    standalone,
    teacherReleasedRoles: standalone
      || defaultConnected
      || params.get('teacherStart') === '1',
  };
}
