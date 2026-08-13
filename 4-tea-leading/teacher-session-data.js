const SNAPSHOT_PREFIX = 'teacher-snapshot:';

function availableStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

export function teacherSnapshotKey(runId) {
  const normalized = String(runId || '').trim();
  return normalized ? `${SNAPSHOT_PREFIX}${normalized}` : '';
}

export function saveTeacherSnapshot(runId, snapshot, storage) {
  const key = teacherSnapshotKey(runId);
  if (!key || !snapshot) return false;
  try {
    const redacted = JSON.stringify(snapshot, (field, value) => (
      field === 'joinCredential' || field === 'joinCredentialSecret' ? undefined : value
    ));
    availableStorage(storage)?.setItem(key, redacted);
    return true;
  } catch {
    return false;
  }
}

export function loadTeacherSnapshot(runId, storage) {
  const key = teacherSnapshotKey(runId);
  if (!key) return null;
  try {
    const raw = availableStorage(storage)?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTeacherSnapshots(storage) {
  const target = availableStorage(storage);
  if (!target) return;
  try {
    const keys = [];
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (key?.startsWith(SNAPSHOT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => target.removeItem(key));
  } catch {
    // 浏览器禁用会话存储时，页面内存会在退出后另行清理。
  }
}

export function resolveStudentAppBase(locationLike = globalThis.location, configuredUrl = '') {
  const origin = String(locationLike?.origin || '');
  const configured = String(configuredUrl || '').trim();
  if (configured) return new URL(configured, origin || undefined).href;
  const hostname = String(locationLike?.hostname || '').toLowerCase();
  const port = String(locationLike?.port || '');
  const protocol = String(locationLike?.protocol || 'http:');
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    if (port === '3000') return `${protocol}//${hostname === '::1' ? '[::1]' : hostname}:5173/`;
    return `${origin}/`;
  }
  return new URL('/student/', origin).href;
}

export function buildStudentJoinUrl({ baseUrl, courseId, runId, participant } = {}) {
  const credential = String(participant?.joinCredential || '').trim();
  if (!baseUrl || !courseId || !runId || !participant?.id || !participant?.groupId || !credential) {
    throw new Error('学生专属入课信息不完整。');
  }
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('lesson', String(courseId));
  url.searchParams.set('mode', 'connected');
  url.searchParams.set('runId', String(runId));
  url.searchParams.set('participantId', String(participant.id));
  url.searchParams.set('studentId', String(participant.id));
  url.searchParams.set('groupId', String(participant.groupId));
  url.hash = new URLSearchParams({ joinCredential: credential }).toString();
  return url.href;
}
