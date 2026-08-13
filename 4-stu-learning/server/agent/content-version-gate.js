export function checkCourseContentVersion(session, course) {
  const sessionVersion = String(session?.contentVersion || '');
  const currentVersion = String(course?.contentVersion || '');
  if (!currentVersion) return { ok: true, adopted: false, sessionVersion, currentVersion };
  if (!sessionVersion) {
    session.contentVersion = currentVersion;
    return { ok: true, adopted: true, sessionVersion: currentVersion, currentVersion };
  }
  return {
    ok: sessionVersion === currentVersion,
    adopted: false,
    sessionVersion,
    currentVersion,
  };
}
