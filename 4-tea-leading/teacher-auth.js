const STORAGE_KEY = 'teacher-access-session';

export const TEACHER_ACCESS_EVENT = 'teacher-access-state';

let memoryCredential = '';

function availableStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.sessionStorage || null;
  } catch {
    return null;
  }
}

function normalizedCredential(value) {
  return String(value || '').trim();
}

export function readTeacherCredential(storage) {
  if (memoryCredential) return memoryCredential;
  try {
    memoryCredential = normalizedCredential(availableStorage(storage)?.getItem(STORAGE_KEY));
  } catch {
    memoryCredential = '';
  }
  return memoryCredential;
}

export function storeTeacherCredential(value, storage) {
  const credential = normalizedCredential(value);
  memoryCredential = credential;
  const target = availableStorage(storage);
  try {
    if (credential) target?.setItem(STORAGE_KEY, credential);
    else target?.removeItem(STORAGE_KEY);
  } catch {
    // Safari 无痕窗口等环境可能禁用 sessionStorage，本页内存会话仍可用。
  }
  return Boolean(credential);
}

export function clearTeacherCredential(storage) {
  memoryCredential = '';
  try {
    availableStorage(storage)?.removeItem(STORAGE_KEY);
  } catch {
    // 清理失败时也不再保留内存凭证。
  }
}

export function hasTeacherCredential(storage) {
  return Boolean(readTeacherCredential(storage));
}

export function teacherAccessStateForStatus(status) {
  if (Number(status) === 401) {
    return {
      kind: 'credential-required',
      status: 401,
      message: '教师访问凭证无效或已过期，请重新输入。',
    };
  }
  if (Number(status) === 503) {
    return {
      kind: 'server-configuration',
      status: 503,
      message: '教师端认证尚未在服务器配置，请联系管理员后重试。',
    };
  }
  return null;
}

export function withTeacherAuthorization(headers, credential = readTeacherCredential()) {
  const secured = new Headers(headers || {});
  secured.delete('authorization');
  const normalized = normalizedCredential(credential);
  if (normalized) secured.set('authorization', `Bearer ${normalized}`);
  return secured;
}

function isSameOriginApiRequest(input) {
  const raw = typeof Request !== 'undefined' && input instanceof Request ? input.url : String(input || '');
  if (raw.startsWith('/api/')) return true;
  const currentOrigin = globalThis.location?.origin;
  if (!currentOrigin) return false;
  try {
    const url = new URL(raw, currentOrigin);
    return url.origin === currentOrigin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function announceAccessState(accessState) {
  if (!accessState || typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;
  globalThis.dispatchEvent(new CustomEvent(TEACHER_ACCESS_EVENT, { detail: accessState }));
}

export async function teacherAuthenticatedFetch(input, init = {}, dependencies = {}) {
  const credential = readTeacherCredential(dependencies.storage);
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== 'function') throw new Error('当前环境不支持网络请求。');
  const headers = isSameOriginApiRequest(input)
    ? withTeacherAuthorization(init.headers, credential)
    : withTeacherAuthorization(init.headers, '');
  const response = await fetchImpl(input, {
    ...init,
    headers,
  });
  const accessState = teacherAccessStateForStatus(response.status);
  if (accessState?.kind === 'credential-required') clearTeacherCredential(dependencies.storage);
  if (accessState) {
    dependencies.onAccessState?.(accessState);
    announceAccessState(accessState);
  }
  return response;
}
