import test from 'node:test';
import assert from 'node:assert/strict';
import { createFallbackLLM, shouldFallbackFromModelError } from '../server/services/fallback-llm.js';

function fakeClient(generate, capabilities = {}) {
  return {
    generate,
    capabilities: () => ({
      streaming: true,
      nativeTools: false,
      vision: false,
      ...capabilities,
    }),
  };
}

test('专用模型返回 402 时当轮立即回退主模型，并打开长熔断', async () => {
  let time = 1_000;
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const primary = fakeClient(async () => {
    primaryCalls += 1;
    throw Object.assign(new Error('payment required'), { status: 402 });
  });
  const fallback = fakeClient(async () => {
    fallbackCalls += 1;
    return { text: '{"intent":"help_start"}', toolCalls: [] };
  });
  const llm = createFallbackLLM({
    primary,
    fallback,
    purpose: 'understanding',
    hardFailureCircuitMs: 60_000,
    now: () => time,
  });

  assert.equal((await llm.generate({ messages: [] })).text, '{"intent":"help_start"}');
  assert.deepEqual(llm.status(), {
    purpose: 'understanding',
    fallbackActive: true,
    lastFailureCode: 'HTTP_402',
    fallbackCount: 1,
  });

  time += 30_000;
  await llm.generate({ messages: [] });
  assert.equal(primaryCalls, 1);
  assert.equal(fallbackCalls, 2);

  time += 31_000;
  await llm.generate({ messages: [] });
  assert.equal(primaryCalls, 2);
  assert.equal(fallbackCalls, 3);
});

test('专用模型恢复后关闭熔断并清除失败码', async () => {
  let time = 1_000;
  let fail = true;
  const primary = fakeClient(async () => {
    if (fail) throw Object.assign(new Error('unavailable'), { status: 503 });
    return { text: 'primary', toolCalls: [] };
  });
  const fallback = fakeClient(async () => ({ text: 'fallback', toolCalls: [] }));
  const llm = createFallbackLLM({
    primary,
    fallback,
    transientCircuitMs: 1_000,
    now: () => time,
  });

  assert.equal((await llm.generate({ messages: [] })).text, 'fallback');
  fail = false;
  time += 1_001;
  assert.equal((await llm.generate({ messages: [] })).text, 'primary');
  assert.equal(llm.status().fallbackActive, false);
  assert.equal(llm.status().lastFailureCode, null);
});

test('客户端主动取消不触发回退，视觉能力以主模型兜底能力为准', async () => {
  let fallbackCalls = 0;
  const primary = fakeClient(async ({ signal }) => {
    throw signal.reason;
  });
  const fallback = fakeClient(async () => {
    fallbackCalls += 1;
    return { text: 'fallback', toolCalls: [] };
  }, { vision: true });
  const llm = createFallbackLLM({ primary, fallback });
  const controller = new AbortController();
  controller.abort(new DOMException('学生取消', 'AbortError'));

  await assert.rejects(
    llm.generate({ messages: [], signal: controller.signal }),
    (error) => error.name === 'AbortError',
  );
  assert.equal(fallbackCalls, 0);
  assert.equal(llm.capabilities().vision, true);
  assert.equal(shouldFallbackFromModelError(new TypeError('network failed')), true);
});
