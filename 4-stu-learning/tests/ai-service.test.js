import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_TURN_TIMEOUT_MS,
  AgentRequestError,
  agentEventReplayKey,
  resolvePublicApiBase,
  sendAgentTurn,
} from '../src/services/ai-service.js';

const turnPayload = {
  sessionId: 'session_frontend_idempotency',
  requestId: 'request_same_logical_action',
  input: { type: 'user_message', text: '请给我下一步提示' },
};

function completedEvent() {
  return {
    type: 'assistant.completed',
    data: {
      id: 'msg_stable_replay',
      text: '先观察屋檐下的排水方向。',
      source: { label: '课程包', citations: [] },
    },
  };
}

function sseResponse(events) {
  const body = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
    .join('');
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

test('学生端 turn 的默认总超时为 100 秒', () => {
  assert.equal(AGENT_TURN_TIMEOUT_MS, 100_000);
});

test('公开 API 基地址在敏感变量被 Vercel 脱敏时回退到同源 /api', () => {
  assert.equal(resolvePublicApiBase('[SENSITIVE]'), '/api');
  assert.equal(resolvePublicApiBase(''), '/api');
  assert.equal(resolvePublicApiBase('/api/'), '/api');
  assert.equal(resolvePublicApiBase('https://api.example.test/'), 'https://api.example.test');
});

test('409 错误保留 HTTP 状态、业务码和租约恢复元数据', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: '这个会话还有一条请求正在处理，请稍后重试。',
    code: 'SESSION_REQUEST_IN_PROGRESS',
    retryable: true,
    leaseExpiresAt: '2026-07-31T12:01:20.000Z',
  }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

  await assert.rejects(
    sendAgentTurn(turnPayload, () => {}, {
      maxPendingRetries: 0,
      maxTransportRetries: 0,
    }),
    (error) => {
      assert.ok(error instanceof AgentRequestError);
      assert.equal(error.status, 409);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'SESSION_REQUEST_IN_PROGRESS');
      assert.equal(error.retryable, true);
      assert.equal(error.leaseExpiresAt, '2026-07-31T12:01:20.000Z');
      return true;
    },
  );
});

test('网络中断后自动重试沿用同一个 requestId', async (t) => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    bodies.push(JSON.parse(options.body));
    if (calls === 1) {
      throw new TypeError('模拟网络中断');
    }
    return sseResponse([completedEvent()]);
  };

  const received = [];
  const events = await sendAgentTurn(turnPayload, (event) => received.push(event), {
    timeoutMs: 100,
    maxTransportRetries: 1,
    maxPendingRetries: 0,
    retryBaseDelayMs: 0,
    maxRetryDelayMs: 0,
  });

  assert.equal(calls, 2);
  assert.deepEqual(
    bodies.map((body) => body.requestId),
    ['request_same_logical_action', 'request_same_logical_action'],
  );
  assert.equal(events.length, 1);
  assert.equal(received.length, 1);
  assert.equal(received[0].data.id, 'msg_stable_replay');
});

test('浏览器 100 秒预算是整次 turn 上限，不因重试重新计时', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(options.signal.reason || new DOMException('超时', 'AbortError'));
      }, { once: true });
    });
  };

  await assert.rejects(
    sendAgentTurn(turnPayload, () => {}, {
      timeoutMs: 10,
      maxTransportRetries: 1,
      maxPendingRetries: 0,
      retryBaseDelayMs: 0,
      maxRetryDelayMs: 0,
    }),
    (error) => error.code === 'AGENT_REQUEST_TIMEOUT',
  );
  assert.equal(calls, 1);
});

test('租约占用的 409 会用原 requestId 轮询并接收服务端回放', async (t) => {
  const originalFetch = globalThis.fetch;
  const bodies = [];
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    bodies.push(JSON.parse(options.body));
    if (calls === 1) {
      return new Response(JSON.stringify({
        error: '请求正在处理。',
        code: 'SESSION_REQUEST_IN_PROGRESS',
        retryable: true,
        leaseExpiresAt: '2026-07-31T12:01:20.000Z',
      }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    }
    return sseResponse([completedEvent()]);
  };

  const received = [];
  await sendAgentTurn(turnPayload, (event) => received.push(event), {
    maxPendingRetries: 1,
    maxTransportRetries: 0,
    retryBaseDelayMs: 0,
    maxRetryDelayMs: 0,
  });

  assert.equal(calls, 2);
  assert.deepEqual(
    bodies.map((body) => body.requestId),
    ['request_same_logical_action', 'request_same_logical_action'],
  );
  assert.equal(received.length, 1);
  assert.equal(received[0].data.id, 'msg_stable_replay');
});

test('流中断后的回放会抑制重复终态事件，delta 仍允许相同文本片段', async (t) => {
  const originalFetch = globalThis.fetch;
  const encodedEvent = new TextEncoder().encode(
    `event: assistant.completed\ndata: ${JSON.stringify(completedEvent().data)}\n\n`,
  );
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    calls += 1;
    if (calls > 1) return sseResponse([completedEvent()]);
    let reads = 0;
    return {
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            async read() {
              reads += 1;
              if (reads === 1) return { value: encodedEvent, done: false };
              throw new TypeError('连接在终态事件后中断');
            },
          };
        },
      },
    };
  };

  const received = [];
  await sendAgentTurn(turnPayload, (event) => received.push(event), {
    maxTransportRetries: 1,
    maxPendingRetries: 0,
    retryBaseDelayMs: 0,
    maxRetryDelayMs: 0,
  });

  assert.equal(calls, 2);
  assert.equal(received.length, 1);
  assert.equal(received[0].data.id, 'msg_stable_replay');
  assert.equal(agentEventReplayKey({ type: 'assistant.delta', data: { text: '的' } }), null);
  assert.equal(
    agentEventReplayKey(completedEvent()),
    agentEventReplayKey(completedEvent()),
  );
});

test('收到 delta 却没有 completed 时按不完整回复报错', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => sseResponse([
    { type: 'assistant.delta', data: { text: '这是一句没有传完的' } },
  ]);

  await assert.rejects(
    sendAgentTurn(turnPayload, () => {}, {
      maxTransportRetries: 0,
      maxPendingRetries: 0,
    }),
    (error) => error.code === 'AGENT_STREAM_INCOMPLETE' && error.retryable === true,
  );
});
