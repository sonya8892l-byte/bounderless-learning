import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from '../server/config/env.js';

// loadEnv 只读 process.env，所以每个用例自己搭一份最小环境再还原。
const REQUIRED = {
  OPENAI_BASE_URL: 'https://example.invalid/v1',
  OPENAI_API_KEY: 'test-key',
  OPENAI_MODEL: 'test-main-model',
};

const MANAGED = [
  ...Object.keys(REQUIRED),
  'OPENAI_UNDERSTAND_MODEL',
  'AI_UNDERSTAND_TIMEOUT_MS',
  'AI_TIMEOUT_MS',
  'AI_TURN_TIMEOUT_MS',
  'AI_REQUEST_LEASE_MS',
];

function withEnv(values, run) {
  const saved = Object.fromEntries(MANAGED.map((key) => [key, process.env[key]]));
  for (const key of MANAGED) delete process.env[key];
  Object.assign(process.env, REQUIRED, values);
  try {
    return run();
  } finally {
    for (const key of MANAGED) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('轻量理解模型未配置时保持缺席，由 app 层回落到主模型', () => {
  const env = withEnv({}, () => loadEnv());

  assert.equal(env.OPENAI_UNDERSTAND_MODEL, undefined, '不配置就该是 undefined，不要偷偷填成主模型');
  assert.equal(env.OPENAI_MODEL, 'test-main-model');
  assert.equal(env.AI_UNDERSTAND_TIMEOUT_MS, 8_000);
});

test('配置了轻量理解模型与预算时按配置读出', () => {
  const env = withEnv({
    OPENAI_UNDERSTAND_MODEL: 'test-small-model',
    AI_UNDERSTAND_TIMEOUT_MS: '4500',
  }, () => loadEnv());

  assert.equal(env.OPENAI_UNDERSTAND_MODEL, 'test-small-model');
  assert.equal(env.AI_UNDERSTAND_TIMEOUT_MS, 4_500);
});

test('理解预算不小于整轮预算时启动即失败', () => {
  assert.throws(
    () => withEnv({
      AI_TIMEOUT_MS: '10000',
      AI_TURN_TIMEOUT_MS: '15000',
      AI_REQUEST_LEASE_MS: '20000',
      AI_UNDERSTAND_TIMEOUT_MS: '15000',
    }, () => loadEnv()),
    /AI_UNDERSTAND_TIMEOUT_MS/,
  );
});
