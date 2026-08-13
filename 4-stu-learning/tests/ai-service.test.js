import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_TURN_TIMEOUT_MS,
  AgentRequestError,
  activateAgentSession,
  agentEventReplayKey,
  resolvePublicApiBase,
  resumeAgentSession,
  sendAgentTurn,
  uploadEvidence,
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

function stateEvent() {
  return {
    type: 'state.updated',
    data: { phaseId: 'phase-2', currentTaskIndex: 0, completedTaskIds: [] },
  };
}

const completedTurnEvents = () => [completedEvent(), stateEvent()];

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

test('activateAgentSession 只按会话 id 请求服务端可信绑定', async (t) => {
  const originalFetch = globalThis.fetch;
  let request = null;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      id: 'session/role-a',
      runId: 'run-trusted',
      participantId: 'participant-trusted',
      teacherRunState: { status: 'active' },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await activateAgentSession('session/role-a');
  assert.equal(request.url, '/api/sessions/session%2Frole-a/activate');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.body, '{}');
  assert.equal(result.participantId, 'participant-trusted');
});

test('resumeAgentSession 按场次、学生和课程身份恢复服务端当前会话', async (t) => {
  const originalFetch = globalThis.fetch;
  let request = null;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      id: 'session-current',
      roleId: '',
      runtime: { task: { taskId: 'phase-task-1' } },
      resumed: true,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await resumeAgentSession({
    runId: 'run-1',
    participantId: 'student-1',
    courseId: 'lesson_gewu_001',
    joinCredential: 'join-credential-with-at-least-32-characters',
    grade: '初中',
    gradeSource: 'student_selected',
  });
  assert.equal(request.url, '/api/sessions/resume');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    runId: 'run-1',
    participantId: 'student-1',
    courseId: 'lesson_gewu_001',
    joinCredential: 'join-credential-with-at-least-32-characters',
    grade: '初中',
    gradeSource: 'student_selected',
  });
  assert.equal(result.runtime.task.taskId, 'phase-task-1');
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

test('原始 API 内部错误不会成为学生可见 message，业务校验文案完整保留', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const validationMessage = '第 2 步还需要一张包含主体和周围位置关系的全景照片，请补拍后再次提交。'.repeat(10);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({
        error: 'PostgreSQL password=secret at query (/Users/example/server/store.js:18:4)',
        code: 'INTERNAL_FAILURE',
      }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      error: validationMessage,
      code: 'STEP_EVIDENCE_MISSING',
    }), { status: 422, headers: { 'content-type': 'application/json' } });
  };

  await assert.rejects(
    activateAgentSession('session-internal-error'),
    (error) => error.message === '服务暂时没有响应，请稍后重试。'
      && !/PostgreSQL|password|\/Users\//i.test(error.message),
  );
  await assert.rejects(
    activateAgentSession('session-validation-error'),
    (error) => error.message === validationMessage && !error.message.endsWith('…'),
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
    return sseResponse(completedTurnEvents());
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
  assert.equal(events.length, 2);
  assert.equal(received.length, 2);
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
    return sseResponse(completedTurnEvents());
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
  assert.equal(received.length, 2);
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
    if (calls > 1) return sseResponse(completedTurnEvents());
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
  assert.equal(received.length, 2);
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

test('只收到 assistant.completed、没有权威 state.updated 也按截流失败', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => sseResponse([completedEvent()]);

  await assert.rejects(
    sendAgentTurn(turnPayload, () => {}, {
      maxTransportRetries: 0,
      maxPendingRetries: 0,
    }),
    (error) => error.code === 'AGENT_STREAM_INCOMPLETE' && error.retryable === true,
  );
});

test('同一个本地证据文件重复提交只上传一次', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let sessionHeader = '';
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    calls += 1;
    sessionHeader = options.headers['x-agent-session-id'];
    return new Response(JSON.stringify({ id: 'upload-once', url: '/uploads/upload-once.jpg' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const file = new File(['same evidence'], 'evidence.txt', { type: 'text/plain' });
  const [first, second] = await Promise.all([
    uploadEvidence(file, 'ses_upload_owner'),
    uploadEvidence(file, 'ses_upload_owner'),
  ]);
  assert.equal(calls, 1);
  assert.equal(sessionHeader, 'ses_upload_owner');
  assert.deepEqual(second, first);
});

test('同一文件跨学习会话不共用上传缓存', async (t) => {
  const originalFetch = globalThis.fetch;
  const owners = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    owners.push(options.headers['x-agent-session-id']);
    return new Response(JSON.stringify({ id: `upload-${owners.length}`, url: `/uploads/upload-${owners.length}.jpg` }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const file = new File(['shared device evidence'], 'shared.txt', { type: 'text/plain' });
  await uploadEvidence(file, 'ses_owner_a');
  await uploadEvidence(file, 'ses_owner_b');
  assert.deepEqual(owners, ['ses_owner_a', 'ses_owner_b']);
});

test('证据上传缺少学习会话时在客户端直接拒绝', async () => {
  const file = new File(['orphan evidence'], 'orphan.txt', { type: 'text/plain' });
  await assert.rejects(
    uploadEvidence(file),
    (error) => error.code === 'EVIDENCE_SESSION_REQUIRED' && error.retryable === false,
  );
});

test('证据上传失败不会缓存错误，原文件可以重试', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: '临时失败' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ id: 'upload-retry', url: '/uploads/upload-retry.jpg' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const file = new File(['retry evidence'], 'retry.txt', { type: 'text/plain' });
  await assert.rejects(uploadEvidence(file, 'ses_upload_retry'), /服务暂时没有响应/);
  assert.equal((await uploadEvidence(file, 'ses_upload_retry')).id, 'upload-retry');
  assert.equal(calls, 2);
});
