import test from 'node:test';
import assert from 'node:assert/strict';
import { createLLM, LLMTimeoutError } from '../server/services/llm.js';

test('模型不支持 minimal 时自动降为 none 并重试同一请求', async (t) => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    bodies.push(body);
    if (bodies.length === 1) {
      return new Response(JSON.stringify({
        error: {
          message: "Unsupported value: 'minimal' is not supported. Supported values are: 'none', 'low'.",
        },
      }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}', tool_calls: [] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const llm = createLLM({
    baseUrl: 'https://example.test/v1',
    apiKey: 'test-key',
    model: 'gpt-5.5',
    wireApi: 'chat_completions',
    reasoningEffort: 'minimal',
    maxOutputTokens: 192,
    timeoutMs: 5000,
  });
  const result = await llm.generate({
    instructions: '只输出JSON。',
    messages: [{ role: 'user', content: '你好' }],
    jsonMode: true,
  });

  assert.equal(result.text, '{"ok":true}');
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].reasoning_effort, 'minimal');
  assert.equal(bodies[1].reasoning_effort, 'none');
  assert.equal(llm.capabilities().reasoningEffort, 'none');
});

test('调用方取消后终止模型 fetch，且不把取消当成可重试超时', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(options.signal.reason || new DOMException('已取消', 'AbortError'));
      }, { once: true });
    });
  };

  const llm = createLLM({
    baseUrl: 'https://example.test/v1',
    apiKey: 'test-key',
    model: 'test-model',
    wireApi: 'responses',
    timeoutMs: 5000,
  });
  const controller = new AbortController();
  const result = llm.generate({
    instructions: '回答问题。',
    messages: [{ role: 'user', content: '你好' }],
    maxRetries: 2,
    signal: controller.signal,
  });
  controller.abort(new DOMException('用户取消', 'AbortError'));

  await assert.rejects(result, (error) => error.name === 'AbortError');
  assert.equal(calls, 1);
});

test('模型内部超时返回 LLM_TIMEOUT，不伪装成客户端取消', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(options.signal.reason || new DOMException('已取消', 'AbortError'));
      }, { once: true });
    });
  };

  const llm = createLLM({
    baseUrl: 'https://example.test/v1',
    apiKey: 'test-key',
    model: 'test-model',
    wireApi: 'responses',
    timeoutMs: 10,
  });

  await assert.rejects(
    llm.generate({
      instructions: '回答问题。',
      messages: [{ role: 'user', content: '你好' }],
    }),
    (error) => {
      assert.ok(error instanceof LLMTimeoutError);
      assert.equal(error.name, 'LLMTimeoutError');
      assert.equal(error.code, 'LLM_TIMEOUT');
      assert.notEqual(error.name, 'AbortError');
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('流式模型以 length 结束时不把半截文本当成完整回复', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response([
    `data: ${JSON.stringify({ choices: [{ delta: { content: '这是一句还没说完的' }, finish_reason: null }] })}`,
    '',
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] })}`,
    '',
    'data: [DONE]',
    '',
  ].join('\n'), { status: 200, headers: { 'content-type': 'text/event-stream' } });

  const llm = createLLM({
    baseUrl: 'https://example.test/v1',
    apiKey: 'test-key',
    model: 'test-model',
    wireApi: 'chat_completions',
    timeoutMs: 5000,
  });

  await assert.rejects(
    llm.generate({
      instructions: '回答问题。',
      messages: [{ role: 'user', content: '请完整回答' }],
      onTextDelta: () => {},
    }),
    /未完整生成/,
  );
});

test('模型流 EOF 前没有终态时不产出完成消息', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content: '半句' }, finish_reason: null }] })}\n\n`,
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const llm = createLLM({
    baseUrl: 'https://example.test/v1',
    apiKey: 'test-key',
    model: 'test-model',
    wireApi: 'chat_completions',
    timeoutMs: 5000,
  });

  await assert.rejects(
    llm.generate({
      instructions: '回答问题。',
      messages: [{ role: 'user', content: '请完整回答' }],
      onTextDelta: () => {},
    }),
    /完整结束前中断/,
  );
});
