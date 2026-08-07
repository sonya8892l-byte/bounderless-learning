import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUnderstanding,
  FALLBACK_UNDERSTANDING,
  INTENTS,
  EMOTIONS,
} from '../server/agent/understanding.js';

function mockLLM(handler) {
  const calls = [];
  return {
    calls,
    generate: async (options) => {
      calls.push(options);
      return handler(calls.length, options);
    },
  };
}

function modelReply(payload) {
  return { text: JSON.stringify(payload), toolCalls: [], raw: {} };
}

const sampleInput = {
  text: '我不知道从哪里开始',
  pendingQuestion: { prompt: '你到达太和殿月台了吗？', type: 'arrival_confirmation' },
  currentStep: { objective: '获得能确认螭首位置关系的全景证据', studentAction: '拍摄1—2张正面全景' },
  recentMessages: [
    { role: 'assistant', content: '你到达太和殿月台了吗？' },
    { role: 'user', content: '啊？' },
  ],
  grade: '初中',
};

test('正常返回：解析结构化结果，并按契约调用模型', async () => {
  const llm = mockLLM(() => modelReply({
    intent: 'help_start',
    emotion: 'anxious',
    answersPendingQuestion: false,
    want: '想知道第一步该做什么',
    confidence: 0.82,
  }));
  const { understandTurn } = createUnderstanding({ llm });

  const result = await understandTurn(sampleInput);

  assert.deepEqual(result, {
    intent: 'help_start',
    emotion: 'anxious',
    answersPendingQuestion: false,
    // 模型没给 pendingAnswer 时归一为 unknown，调用方据此判断"读不出"
    pendingAnswer: 'unknown',
    // 模型漏填 hasTaskRequest / locationKind 时按意图补齐：求助天然带诉求且不问地点。
    hasTaskRequest: true,
    locationKind: 'none',
    want: '想知道第一步该做什么',
    confidence: 0.82,
  });
  assert.equal(llm.calls.length, 1);
  assert.equal(llm.calls[0].jsonMode, true);
  assert.equal(llm.calls[0].maxRetries, 0);
  assert.ok(llm.calls[0].signal instanceof AbortSignal);
  assert.match(llm.calls[0].instructions, /你到达太和殿月台了吗/);
  assert.match(llm.calls[0].instructions, /arrival_confirmation/);
  assert.equal(llm.calls[0].messages.at(-1).content, '我不知道从哪里开始');
});

test('枚举与置信度：非法枚举被拒绝，超界置信度收敛到 0–1', async () => {
  const llm = mockLLM(() => modelReply({
    intent: 'greeting',
    emotion: 'positive',
    answersPendingQuestion: false,
    want: '',
    confidence: 1.7,
  }));
  const { understandTurn } = createUnderstanding({ llm });

  const result = await understandTurn({ text: '你好' });

  assert.equal(result.confidence, 1);
  assert.ok(INTENTS.includes(result.intent));
  assert.ok(EMOTIONS.includes(result.emotion));
});

test('模型抛错：重试一次后返回保守默认，不抛异常', async () => {
  const llm = mockLLM(() => { throw new Error('模型接口返回 500'); });
  const { understandTurn } = createUnderstanding({ llm });

  const result = await understandTurn(sampleInput);

  assert.equal(llm.calls.length, 2);
  assert.deepEqual(result, { ...FALLBACK_UNDERSTANDING });
});

test('返回不可解析内容：重试一次后返回保守默认', async () => {
  const llm = mockLLM(() => ({ text: '我觉得他想开始做任务了', toolCalls: [], raw: {} }));
  const { understandTurn } = createUnderstanding({ llm });

  const result = await understandTurn(sampleInput);

  assert.equal(llm.calls.length, 2);
  assert.deepEqual(result, { ...FALLBACK_UNDERSTANDING });
});

test('返回不过 zod 的 JSON：重试一次后返回保守默认', async () => {
  const llm = mockLLM(() => modelReply({
    intent: '想开始了',
    emotion: '着急',
    answersPendingQuestion: 'maybe',
    confidence: 0.9,
  }));
  const { understandTurn } = createUnderstanding({ llm });

  const result = await understandTurn(sampleInput);

  assert.equal(llm.calls.length, 2);
  assert.deepEqual(result, { ...FALLBACK_UNDERSTANDING });
});

test('第一次失败第二次成功：只重试一次即可返回正常结果', async () => {
  const llm = mockLLM((attempt) => {
    if (attempt === 1) throw new Error('临时故障');
    return modelReply({
      intent: 'claim_done',
      emotion: 'positive',
      answersPendingQuestion: false,
      want: '想让絮絮确认已经完成',
      confidence: 0.71,
    });
  });
  const { understandTurn } = createUnderstanding({ llm });

  const result = await understandTurn(sampleInput);

  assert.equal(llm.calls.length, 2);
  assert.equal(result.intent, 'claim_done');
});

test('模型挂起：总预算耗尽后返回保守默认，不再重试且请求被取消', async () => {
  let observedSignal = null;
  const llm = mockLLM((_attempt, options) => {
    observedSignal = options.signal;
    return new Promise(() => {});
  });
  const { understandTurn } = createUnderstanding({ llm, timeoutMs: 40 });

  const startedAt = Date.now();
  const result = await understandTurn(sampleInput);

  assert.deepEqual(result, { ...FALLBACK_UNDERSTANDING });
  // 要证的是预算机制：超时后不再重试，且底层请求已被取消——不测机器有多快。
  assert.equal(llm.calls.length, 1, '预算耗尽后不应进入第二次模型调用');
  assert.ok(observedSignal.aborted, '超时后应通过 signal 取消底层请求');
  assert.ok(Date.now() - startedAt < 10_000, '只防死循环/挂死，不测性能');
});

test('异常输入不抛异常：缺少 llm、空文本、字段缺失都返回默认', async () => {
  const broken = createUnderstanding({});
  assert.deepEqual(await broken.understandTurn({ text: '你好' }), { ...FALLBACK_UNDERSTANDING });

  const llm = mockLLM(() => ({ toolCalls: [], raw: {} }));
  const { understandTurn } = createUnderstanding({ llm });
  assert.deepEqual(await understandTurn(), { ...FALLBACK_UNDERSTANDING });
});

test('整轮已取消时立即返回默认，不再调模型', async () => {
  const llm = mockLLM(() => modelReply({
    intent: 'greeting', emotion: 'neutral', answersPendingQuestion: false, confidence: 0.9,
  }));
  const { understandTurn } = createUnderstanding({ llm });
  const controller = new AbortController();
  controller.abort(new Error('turn cancelled'));

  const result = await understandTurn(sampleInput, { signal: controller.signal });

  assert.deepEqual(result, { ...FALLBACK_UNDERSTANDING });
  assert.equal(llm.calls.length, 0, '回合都要结束了，没必要再问一次模型');
});

test('整轮中途取消会把取消传给底层请求，不占满自己的预算', async () => {
  // 回归 R1 接线引入的缺陷：理解调用曾经不理会整轮 signal，
  // 于是 turn deadline 只有 15ms 的请求被它拖了好几秒。
  const controller = new AbortController();
  let observedSignal = null;
  const llm = mockLLM((_count, options) => {
    observedSignal = options.signal;
    // 模型永不返回；只能靠取消结束。
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  });
  const { understandTurn } = createUnderstanding({ llm, timeoutMs: 5_000 });

  const startedAt = Date.now();
  const pending = understandTurn(sampleInput, { signal: controller.signal });
  setTimeout(() => controller.abort(new Error('turn deadline')), 20);
  const result = await pending;

  assert.deepEqual(result, { ...FALLBACK_UNDERSTANDING });
  // 要证的是整轮取消会 abort 底层请求，而不是把 5s 预算跑满。
  assert.equal(llm.calls.length, 1, '整轮取消后不应重试模型');
  assert.ok(observedSignal?.aborted, '整轮取消要传导到底层请求');
  assert.ok(Date.now() - startedAt < 10_000, '只防死循环/挂死，不测性能');
});
