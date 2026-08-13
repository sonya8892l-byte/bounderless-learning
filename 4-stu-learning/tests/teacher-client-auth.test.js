import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearTeacherCredential,
  hasTeacherCredential,
  readTeacherCredential,
  storeTeacherCredential,
  teacherAccessStateForStatus,
  teacherAuthenticatedFetch,
  withTeacherAuthorization,
} from '../../4-tea-leading/teacher-auth.js';
import { qrCodeDataUrl, qrCodeMatrix } from '../../4-tea-leading/qr-code.js';
import {
  buildStudentJoinUrl,
  clearTeacherSnapshots,
  loadTeacherSnapshot,
  resolveStudentAppBase,
  saveTeacherSnapshot,
} from '../../4-tea-leading/teacher-session-data.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] || null,
    serialized: () => JSON.stringify([...values]),
  };
}

test.afterEach(() => clearTeacherCredential(memoryStorage()));

test('教师凭证只进入会话存储，可显式结束会话', () => {
  const storage = memoryStorage();
  const credential = 'temporary-teacher-credential-value';
  assert.equal(storeTeacherCredential(`  ${credential}  `, storage), true);
  assert.equal(hasTeacherCredential(storage), true);
  assert.equal(readTeacherCredential(storage), credential);
  clearTeacherCredential(storage);
  assert.equal(hasTeacherCredential(storage), false);
  assert.equal(storage.serialized().includes(credential), false);
});

test('Authorization 由共享层统一注入，不信任调用方自带的旧值', () => {
  const source = new Headers({ authorization: 'Bearer stale-value', accept: 'application/json' });
  const secured = withTeacherAuthorization(source, 'current-session-value');
  assert.equal(secured.get('authorization'), 'Bearer current-session-value');
  assert.equal(secured.get('accept'), 'application/json');
  assert.equal(source.get('authorization'), 'Bearer stale-value', '不修改调用方的 Headers');
  assert.equal(withTeacherAuthorization(source, '').has('authorization'), false);
});

test('本地 demo 无凭证时仍正常请求，不伪造 Bearer', async () => {
  const storage = memoryStorage();
  let authorization = 'not-observed';
  const response = await teacherAuthenticatedFetch('/api/teacher/runs', {}, {
    storage,
    fetchImpl: async (input, init) => {
      authorization = new Headers(init.headers).get('authorization');
      return new Response('[]', { status: 200 });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(authorization, null);
});

test('教师 API 与地图配置请求都自动带 Bearer', async () => {
  const storage = memoryStorage();
  const credential = 'one-tab-teacher-session-value';
  storeTeacherCredential(credential, storage);
  const requests = [];
  const fetchImpl = async (input, init) => {
    requests.push({ input, authorization: new Headers(init.headers).get('authorization') });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await teacherAuthenticatedFetch('/api/teacher/runs', {}, { fetchImpl, storage });
  await teacherAuthenticatedFetch('/api/map-config', {}, { fetchImpl, storage });
  assert.deepEqual(requests.map(({ input }) => input), ['/api/teacher/runs', '/api/map-config']);
  assert.deepEqual(requests.map(({ authorization }) => authorization), [
    `Bearer ${credential}`,
    `Bearer ${credential}`,
  ]);
});

test('凭证不会被带到站外请求', async () => {
  const storage = memoryStorage();
  storeTeacherCredential('same-origin-only-credential', storage);
  let authorization = 'not-observed';
  await teacherAuthenticatedFetch('https://example.invalid/resource', {
    headers: { authorization: 'Bearer caller-provided-value' },
  }, {
    storage,
    fetchImpl: async (input, init) => {
      authorization = new Headers(init.headers).get('authorization');
      return new Response('{}', { status: 200 });
    },
  });
  assert.equal(authorization, null);
});

test('401 清理失效会话并只上报可展示状态', async () => {
  const storage = memoryStorage();
  const credential = 'expired-teacher-session-value';
  storeTeacherCredential(credential, storage);
  const states = [];
  await teacherAuthenticatedFetch('/api/teacher/runs', {}, {
    storage,
    fetchImpl: async () => new Response('{}', { status: 401 }),
    onAccessState: (value) => states.push(value),
  });
  assert.equal(readTeacherCredential(storage), '');
  assert.deepEqual(states, [teacherAccessStateForStatus(401)]);
  assert.equal(JSON.stringify(states).includes(credential), false);
});

test('503 进入服务器配置态，不把凭证写入状态或错误文案', async () => {
  const storage = memoryStorage();
  const credential = 'configured-client-session-value';
  storeTeacherCredential(credential, storage);
  const states = [];
  await teacherAuthenticatedFetch('/api/teacher/runs', {}, {
    storage,
    fetchImpl: async () => new Response('{}', { status: 503 }),
    onAccessState: (value) => states.push(value),
  });
  assert.deepEqual(states, [teacherAccessStateForStatus(503)]);
  assert.equal(JSON.stringify(states).includes(credential), false);
});

test('快照进入当前标签页缓存前深度剔除学生入课凭证，退出后清除', () => {
  const sessionStorage = memoryStorage();
  const localStorage = memoryStorage();
  const joinCredential = 'student-private-join-credential-value';
  const snapshot = {
    run: { id: 'run-1' },
    participants: [{ id: 'student-1', joinCredential }],
    groups: [{ id: 'group-1', members: [{ id: 'student-1', joinCredential }] }],
  };
  assert.equal(saveTeacherSnapshot('run-1', snapshot, sessionStorage), true);
  const cached = loadTeacherSnapshot('run-1', sessionStorage);
  assert.equal(JSON.stringify(cached).includes(joinCredential), false);
  assert.equal(cached.participants[0].joinCredential, undefined);
  assert.equal(cached.groups[0].members[0].joinCredential, undefined);
  assert.equal(sessionStorage.serialized().includes(joinCredential), false);
  assert.equal(localStorage.serialized().includes(joinCredential), false);
  clearTeacherSnapshots(sessionStorage);
  assert.equal(sessionStorage.serialized().includes(joinCredential), false);
  assert.equal(loadTeacherSnapshot('run-1', sessionStorage), null);
});

test('专属学习链接把凭证放在 fragment，首个 HTTP request 不含凭证', () => {
  const joinCredential = 'fragment-only-student-credential-value';
  const href = buildStudentJoinUrl({
    baseUrl: 'https://preview.example.edu/student/',
    courseId: 'lesson_gewu_001',
    runId: 'run-1',
    participant: { id: 'student-1', groupId: 'group-1', joinCredential },
  });
  const url = new URL(href);
  assert.equal(url.searchParams.get('runId'), 'run-1');
  assert.equal(url.searchParams.get('participantId'), 'student-1');
  assert.equal(url.searchParams.has('joinCredential'), false);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('joinCredential'), joinCredential);
  const firstRequestUrl = `${url.origin}${url.pathname}${url.search}`;
  assert.equal(firstRequestUrl.includes(joinCredential), false);
  assert.equal(firstRequestUrl.includes('joinCredential'), false);
});

test('学生端地址在本地联调与统一部署下都可确定解析', () => {
  assert.equal(resolveStudentAppBase({
    origin: 'http://127.0.0.1:3000', hostname: '127.0.0.1', port: '3000', protocol: 'http:',
  }), 'http://127.0.0.1:5173/');
  assert.equal(resolveStudentAppBase({
    origin: 'https://preview.example.edu', hostname: 'preview.example.edu', port: '', protocol: 'https:',
  }), 'https://preview.example.edu/student/');
  assert.equal(resolveStudentAppBase({
    origin: 'https://preview.example.edu', hostname: 'preview.example.edu', port: '', protocol: 'https:',
  }, '/custom-student/'), 'https://preview.example.edu/custom-student/');
});

test('二维码完全在本地生成，图像 data URL 不含凭证原文', () => {
  const joinCredential = 'qr-private-student-credential-value';
  const href = buildStudentJoinUrl({
    baseUrl: 'https://preview.example.edu/student/',
    courseId: 'lesson_gewu_001',
    runId: 'run-1',
    participant: { id: 'student-1', groupId: 'group-1', joinCredential },
  });
  const matrix = qrCodeMatrix(href);
  assert.equal(matrix.length, 65);
  assert.equal(matrix.every((row) => row.length === 65), true);
  const image = qrCodeDataUrl(href);
  assert.match(image, /^data:image\/svg\+xml/u);
  assert.equal(image.includes(joinCredential), false);
});

test('教师 PWA 源码保持单一鉴权通道，无持久快照凭证和静态凭证', async () => {
  const directory = path.join(projectRoot, '4-tea-leading');
  const [app, amap, auth, sessionData, qrCode, html, worker] = await Promise.all([
    fs.readFile(path.join(directory, 'app.js'), 'utf8'),
    fs.readFile(path.join(directory, 'amap-service.js'), 'utf8'),
    fs.readFile(path.join(directory, 'teacher-auth.js'), 'utf8'),
    fs.readFile(path.join(directory, 'teacher-session-data.js'), 'utf8'),
    fs.readFile(path.join(directory, 'qr-code.js'), 'utf8'),
    fs.readFile(path.join(directory, 'index.html'), 'utf8'),
    fs.readFile(path.join(directory, 'sw.js'), 'utf8'),
  ]);
  assert.match(app, /teacherAuthenticatedFetch\(`\$\{API\}\$\{path\}`/u);
  assert.doesNotMatch(app, /(?<!Authenticated)fetch\s*\(/u);
  assert.match(amap, /teacherAuthenticatedFetch\(CONFIG_URL/u);
  assert.doesNotMatch(amap, /(?<!Authenticated)fetch\s*\(/u);
  assert.match(auth, /sessionStorage/u);
  assert.doesNotMatch(`${app}\n${amap}\n${auth}`, /URLSearchParams|location\.search|[?&](?:token|access_token)=/u);
  assert.doesNotMatch(`${app}\n${amap}\n${auth}\n${html}`, /TEACHER_API_TOKEN\s*[:=]\s*['"][^'"]+/u);
  assert.doesNotMatch(app, /localStorage\.(?:getItem|setItem)\(`teacher-snapshot:/u);
  assert.match(app, /saveTeacherSnapshot\(state\.runId, state\.snapshot\)/u);
  assert.match(app, /clearTeacherSnapshots\(\)/u);
  assert.doesNotMatch(app, /data-join-credential/u);
  assert.match(app, /if \(error\.status !== 404\) throw error;/u);
  assert.doesNotMatch(app, /run\.status === 'draft' \? actionButton\('start_phase'/u);
  assert.match(app, /const HIGH_IMPACT = new Set\(\[[^\]]*'start_phase'/u);
  assert.match(app, /participant\.learning\.teacherApprovalAllowed === true/u);
  assert.match(app, /participant\.learning\.pendingAdvanceMode === 'teacher'/u);
  assert.match(app, /teacherApprovalAllowed \? actionButton\('approve_evidence'/u);
  assert.match(app, /teacherApprovalKind === 'task_teacher_confirm' \? actionButton\('reject_evidence'/u);
  assert.match(app, /awaitingTeacherAdvance \? actionButton\('advance_task'/u);
  assert.doesNotMatch(qrCode, /fetch\s*\(|api\.qr|quickchart|googleapis/u);
  assert.match(sessionData, /url\.hash = new URLSearchParams/u);
  assert.match(html, /id="teacherCredential"[^>]+type="password"/u);
  assert.match(app, /hasTeacherCredential\(\)\) return;/u);
  assert.match(worker, /\.\/teacher-auth\.js/u);
  assert.match(worker, /\.\/teacher-session-data\.js/u);
});
