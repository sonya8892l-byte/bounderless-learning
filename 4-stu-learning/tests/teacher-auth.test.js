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
