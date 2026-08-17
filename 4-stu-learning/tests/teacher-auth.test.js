import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerRuntimeRoutes } from '../server/runtime/routes.js';

test('正式教师 API 只接受服务端 token，并忽略客户端伪造 teacherId', async () => {
  const actors = [];
  const app = Fastify({ logger: false });
  await registerRuntimeRoutes(app, {
    runtime: {
      async listRuns(actorId) { actors.push(actorId); return []; },
    },
    enableWebsocket: false,
    enableDemo: false,
    teacherAccess: {
      required: true,
      token: 'teacher-auth-test-token-1234567890',
      teacherId: 'teacher-from-server',
    },
  });

  const missing = await app.inject({ method: 'GET', url: '/api/teacher/runs' });
  assert.equal(missing.statusCode, 401);
  const forged = await app.inject({
    method: 'GET',
    url: '/api/teacher/runs',
    headers: {
      authorization: 'Bearer teacher-auth-test-token-1234567890',
      'x-teacher-id': 'attacker',
    },
  });
  assert.equal(forged.statusCode, 200);
  assert.deepEqual(actors, ['teacher-from-server']);
  await app.close();
});

test('正式环境缺教师 token 时明确关闭教师 API', async () => {
  const app = Fastify({ logger: false });
  await registerRuntimeRoutes(app, {
    runtime: { async listRuns() { return []; } },
    enableWebsocket: false,
    enableDemo: false,
    teacherAccess: { required: true, token: '' },
  });
  const response = await app.inject({ method: 'GET', url: '/api/teacher/runs' });
  assert.equal(response.statusCode, 503);
  await app.close();
});

test('多套教师凭证映射到不同身份，并互相看不到对方场次', async () => {
  const runs = new Map();
  const app = Fastify({ logger: false });
  await registerRuntimeRoutes(app, {
    runtime: {
      async ensureExperienceRun({ teacherId, teacherName }) {
        const existing = [...runs.values()].find((run) => run.teacherId === teacherId);
        if (existing) return existing;
        const run = {
          id: `${teacherId}-run`,
          teacherId,
          teacherName,
          experiencePack: true,
          participants: [{ id: 'student-1-1', name: '体验学生' }],
        };
        runs.set(run.id, run);
        return run;
      },
      async listRuns(teacherId) {
        return [...runs.values()].filter((run) => run.teacherId === teacherId);
      },
      async assertTeacherAccess(runId, teacherId) {
        const run = runs.get(runId);
        if (!run || run.teacherId !== teacherId) {
          throw Object.assign(new Error('你无权访问该班级场次。'), { statusCode: 403 });
        }
      },
      async getSnapshot(runId) {
        return { run: runs.get(runId), participants: runs.get(runId)?.participants || [] };
      },
      async preflight(runId) {
        return {
          joinCredentials: [{
            participantId: 'student-1-1',
            joinCredential: `${runId}-join-credential-value-32ch`,
          }],
        };
      },
    },
    enableWebsocket: false,
    enableDemo: false,
    teacherAccess: {
      required: true,
      accounts: [
        { id: 'exp-1', token: 'experience-token-one-xxxxxx', name: '体验教师1', experiencePack: true },
        { id: 'exp-2', token: 'experience-token-two-xxxxxx', name: '体验教师2', experiencePack: true },
      ],
    },
  });

  const listed1 = await app.inject({
    method: 'GET',
    url: '/api/teacher/runs',
    headers: { authorization: 'Bearer experience-token-one-xxxxxx' },
  });
  const listed2 = await app.inject({
    method: 'GET',
    url: '/api/teacher/runs',
    headers: {
      authorization: 'Bearer experience-token-two-xxxxxx',
      'x-teacher-id': 'exp-1',
    },
  });
  assert.equal(listed1.statusCode, 200);
  assert.equal(listed2.statusCode, 200);
  assert.equal(listed1.json().length, 1);
  assert.equal(listed2.json().length, 1);
  assert.equal(listed1.json()[0].id, 'exp-1-run');
  assert.equal(listed2.json()[0].id, 'exp-2-run');

  const stolen = await app.inject({
    method: 'GET',
    url: '/api/teacher/runs/exp-1-run/snapshot',
    headers: { authorization: 'Bearer experience-token-two-xxxxxx' },
  });
  assert.equal(stolen.statusCode, 403);

  const own = await app.inject({
    method: 'GET',
    url: '/api/teacher/runs/exp-1-run/preflight',
    headers: { authorization: 'Bearer experience-token-one-xxxxxx' },
  });
  assert.equal(own.statusCode, 200);
  assert.equal(own.json().joinCredentials.length, 1);
  await app.close();
});
