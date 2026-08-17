import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveAppEnvironment, loadEnv } from '../server/config/env.js';

// loadEnv 只读 process.env，所以每个用例自己搭一份最小环境再还原。
const REQUIRED = {
  OPENAI_BASE_URL: 'https://example.invalid/v1',
  OPENAI_API_KEY: 'test-key',
  OPENAI_MODEL: 'test-main-model',
};

const MANAGED = [
  ...Object.keys(REQUIRED),
  'APP_ENV',
  'VERCEL_ENV',
  'ENABLE_DEMO',
  'OPENAI_UNDERSTAND_MODEL',
  'OPENAI_UNDERSTAND_BASE_URL',
  'OPENAI_UNDERSTAND_API_KEY',
  'OPENAI_UNDERSTAND_WIRE_API',
  'OPENAI_EVALUATION_MODEL',
  'OPENAI_EVALUATION_BASE_URL',
  'OPENAI_EVALUATION_API_KEY',
  'OPENAI_EVALUATION_WIRE_API',
  'AI_UNDERSTAND_PRIMARY_TIMEOUT_MS',
  'AI_UNDERSTAND_TIMEOUT_MS',
  'AI_EVALUATION_TIMEOUT_MS',
  'AI_TIMEOUT_MS',
  'AI_TURN_TIMEOUT_MS',
  'AI_REQUEST_LEASE_MS',
  'TEACHER_API_TOKEN',
  'TEACHER_ID',
  'TEACHER_ACCOUNTS',
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
  assert.equal(env.AI_TIMEOUT_MS, 25_000);
  assert.equal(env.AI_UNDERSTAND_PRIMARY_TIMEOUT_MS, 3_500);
  assert.equal(env.AI_UNDERSTAND_TIMEOUT_MS, 20_000);
  assert.equal(env.AI_TURN_TIMEOUT_MS, 75_000);
  assert.equal(env.AI_REQUEST_LEASE_MS, 85_000);
});

test('Vercel Preview 覆盖误带的本地 APP_ENV，并永久关闭 demo bootstrap', () => {
  const env = withEnv({
    APP_ENV: 'local',
    VERCEL_ENV: 'preview',
    ENABLE_DEMO: 'true',
  }, () => loadEnv());

  assert.equal(env.APP_ENV, 'preview');
  assert.equal(env.ENABLE_DEMO, false);
});

test('托管与手工环境声明按最高安全级别归一', () => {
  const cases = [
    [{ APP_ENV: 'local', VERCEL_ENV: 'preview' }, 'preview'],
    [{ APP_ENV: 'test', VERCEL_ENV: 'production' }, 'production'],
    [{ APP_ENV: 'production', VERCEL_ENV: 'development' }, 'production'],
    [{ APP_ENV: 'preview' }, 'preview'],
    [{ APP_ENV: 'local' }, 'local'],
    [{ APP_ENV: 'test' }, 'test'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(effectiveAppEnvironment(input), expected, JSON.stringify(input));
  }
});

test('当前原型允许六位易记教师访问凭证', () => {
  const env = withEnv({ TEACHER_API_TOKEN: 'sonyal' }, () => loadEnv());
  assert.equal(env.TEACHER_API_TOKEN, 'sonyal');
  assert.deepEqual(env.teacherAccounts, [{
    id: 'teacher-primary',
    token: 'sonyal',
    name: '带队教师',
    experiencePack: false,
  }]);

  assert.throws(
    () => withEnv({ TEACHER_API_TOKEN: 'short' }, () => loadEnv()),
    /TEACHER_API_TOKEN/,
  );
});

test('TEACHER_ACCOUNTS 解析为多套教师身份，并与旧单凭证合并', () => {
  const env = withEnv({
    TEACHER_API_TOKEN: 'admin-token',
    TEACHER_ID: 'teacher-primary',
    TEACHER_ACCOUNTS: JSON.stringify([
      { id: 'exp-1', token: 'experience-one', name: '体验教师1' },
      { id: 'exp-2', token: 'experience-two', name: '体验教师2', experiencePack: false },
    ]),
  }, () => loadEnv());

  assert.deepEqual(env.teacherAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    experiencePack: account.experiencePack,
  })), [
    { id: 'exp-1', name: '体验教师1', experiencePack: true },
    { id: 'exp-2', name: '体验教师2', experiencePack: false },
    { id: 'teacher-primary', name: '带队教师', experiencePack: false },
  ]);
});

test('TEACHER_ACCOUNTS 非法 JSON 或重复凭证时启动失败', () => {
  assert.throws(
    () => withEnv({ TEACHER_ACCOUNTS: '{not-json' }, () => loadEnv()),
    /TEACHER_ACCOUNTS/,
  );
  assert.throws(
    () => withEnv({
      TEACHER_ACCOUNTS: JSON.stringify([
        { id: 'exp-1', token: 'same-token' },
        { id: 'exp-2', token: 'same-token' },
      ]),
    }, () => loadEnv()),
    /不能重复/,
  );
});

test('托管环境教师账号 JSON 损坏时回退单凭证，不拖垮整站', () => {
  const env = withEnv({
    APP_ENV: 'production',
    VERCEL_ENV: 'production',
    TEACHER_API_TOKEN: 'sonyal1',
    TEACHER_ACCOUNTS: '{not-json',
  }, () => loadEnv());

  assert.equal(env.teacherAccounts.length, 1);
  assert.equal(env.teacherAccounts[0].token, 'sonyal1');
  assert.match(env.teacherAccountsError, /TEACHER_ACCOUNTS/);
});

test('配置了轻量理解模型与预算时按配置读出', () => {
  const env = withEnv({
    OPENAI_UNDERSTAND_MODEL: 'test-small-model',
    AI_UNDERSTAND_TIMEOUT_MS: '4500',
  }, () => loadEnv());

  assert.equal(env.OPENAI_UNDERSTAND_MODEL, 'test-small-model');
  assert.equal(env.AI_UNDERSTAND_TIMEOUT_MS, 4_500);
});

test('验收默认沿用主模型身份，但拥有独立的 28 秒预算', () => {
  const env = withEnv({}, () => loadEnv());

  assert.equal(env.OPENAI_EVALUATION_MODEL, undefined);
  assert.equal(env.AI_EVALUATION_TIMEOUT_MS, 28_000);
});

test('验收的两次尝试必须装得进整轮预算', () => {
  assert.throws(
    () => withEnv({
      AI_EVALUATION_TIMEOUT_MS: '30000',
      AI_TURN_TIMEOUT_MS: '60000',
      AI_REQUEST_LEASE_MS: '65000',
    }, () => loadEnv()),
    /AI_EVALUATION_TIMEOUT_MS/,
  );
});

test('验收模型跨服务商时必须提供对应密钥', () => {
  assert.throws(
    () => withEnv({
      OPENAI_EVALUATION_MODEL: 'evaluation-model',
      OPENAI_EVALUATION_BASE_URL: 'https://evaluation.invalid/v1',
    }, () => loadEnv()),
    /OPENAI_EVALUATION_API_KEY/,
  );
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

test('专用理解模型预算必须给主模型回退留出时间', () => {
  assert.throws(
    () => withEnv({
      AI_UNDERSTAND_PRIMARY_TIMEOUT_MS: '5000',
      AI_UNDERSTAND_TIMEOUT_MS: '5000',
    }, () => loadEnv()),
    /AI_UNDERSTAND_PRIMARY_TIMEOUT_MS/,
  );
});

test('轻量模型可以住在另一个服务商：地址与密钥各自独立', () => {
  const env = withEnv({
    OPENAI_UNDERSTAND_MODEL: 'deepseek-chat',
    OPENAI_UNDERSTAND_BASE_URL: 'https://api.deepseek.invalid/v1',
    OPENAI_UNDERSTAND_API_KEY: 'sk-understand-key',
    OPENAI_UNDERSTAND_WIRE_API: 'chat_completions',
  }, () => loadEnv());

  assert.equal(env.OPENAI_UNDERSTAND_BASE_URL, 'https://api.deepseek.invalid/v1');
  assert.equal(env.OPENAI_UNDERSTAND_API_KEY, 'sk-understand-key');
  assert.equal(env.OPENAI_BASE_URL, 'https://example.invalid/v1', '主模型地址不受影响');
  assert.equal(env.OPENAI_API_KEY, 'test-key', '主模型密钥不受影响');
});

test('指到别家服务商却没给密钥时启动即失败，不留到运行期 401', () => {
  assert.throws(
    () => withEnv({
      OPENAI_UNDERSTAND_MODEL: 'deepseek-chat',
      OPENAI_UNDERSTAND_BASE_URL: 'https://api.deepseek.invalid/v1',
    }, () => loadEnv()),
    /OPENAI_UNDERSTAND_API_KEY/,
  );
});

test('轻量模型与主模型同址时不要求独立密钥', () => {
  const env = withEnv({
    OPENAI_UNDERSTAND_MODEL: 'test-small-model',
    OPENAI_UNDERSTAND_BASE_URL: 'https://example.invalid/v1',
  }, () => loadEnv());

  assert.equal(env.OPENAI_UNDERSTAND_API_KEY, undefined, '同一个网关沿用主模型密钥即可');
});
