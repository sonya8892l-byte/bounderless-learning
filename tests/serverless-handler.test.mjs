import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createServerlessHandler,
  restoreApiRequestUrl,
} from '../server/vercel/serverless-handler.mjs';

test('restores the public API path and preserves the original query', () => {
  const request = {
    url: '/api/serverless?path=sessions%2Fsession-1&include=runtime&tag=one&tag=two',
  };

  assert.equal(
    restoreApiRequestUrl(request),
    '/api/sessions/session-1?include=runtime&tag=one&tag=two',
  );
  assert.equal(request.url, '/api/sessions/session-1?include=runtime&tag=one&tag=two');
});

test('uses the Vercel query.path value when it is provided separately', () => {
  const request = {
    url: '/api/serverless?include=runtime',
    query: { path: 'runs/run-1/snapshot' },
  };

  assert.equal(
    restoreApiRequestUrl(request),
    '/api/runs/run-1/snapshot?include=runtime',
  );
});

test('builds and readies one app for concurrent and subsequent requests', async () => {
  const env = { name: 'test-env' };
  const emitted = [];
  let loadEnvCalls = 0;
  let buildCalls = 0;
  let readyCalls = 0;
  let releaseBuild;
  const buildStarted = new Promise((resolve) => {
    releaseBuild = resolve;
  });
  const app = {
    async ready() {
      readyCalls += 1;
    },
    server: {
      emit(event, request, response) {
        emitted.push({ event, url: request.url, response });
      },
    },
  };

  const handler = createServerlessHandler({
    loadEnv() {
      loadEnvCalls += 1;
      return env;
    },
    async buildApp(options) {
      buildCalls += 1;
      assert.deepEqual(options, {
        env,
        serveStatic: false,
        realtimeMode: 'polling',
      });
      await buildStarted;
      return app;
    },
  });

  const responseA = {};
  const responseB = {};
  const first = handler(
    { url: '/api/serverless?path=health' },
    responseA,
  );
  const second = handler(
    { url: '/api/serverless?path=sessions' },
    responseB,
  );

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(buildCalls, 1);

  releaseBuild();
  await Promise.all([first, second]);
  await handler(
    { url: '/api/serverless?path=map-config' },
    {},
  );

  assert.equal(loadEnvCalls, 1);
  assert.equal(buildCalls, 1);
  assert.equal(readyCalls, 1);
  assert.deepEqual(
    emitted.map(({ event, url }) => ({ event, url })),
    [
      { event: 'request', url: '/api/health' },
      { event: 'request', url: '/api/sessions' },
      { event: 'request', url: '/api/map-config' },
    ],
  );
  assert.equal(emitted[0].response, responseA);
  assert.equal(emitted[1].response, responseB);
});

test('启动失败时返回 JSON 503，并允许后续请求重试', async () => {
  let loadEnvCalls = 0;
  const chunks = [];
  const response = {
    headersSent: false,
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) { chunks.push(chunk); this.headersSent = true; },
  };
  const handler = createServerlessHandler({
    loadEnv() {
      loadEnvCalls += 1;
      throw new Error('TEACHER_ACCOUNTS 必须是 JSON 数组。');
    },
    async buildApp() { throw new Error('should not build'); },
  });

  await handler({ url: '/api/serverless?path=health' }, response);
  assert.equal(response.statusCode, 503);
  assert.match(chunks[0], /TEACHER_ACCOUNTS/);
  assert.equal(loadEnvCalls, 1);

  await handler({ url: '/api/serverless?path=health' }, {
    headersSent: false,
    statusCode: 200,
    setHeader() {},
    end() {},
  });
  assert.equal(loadEnvCalls, 2);
});
