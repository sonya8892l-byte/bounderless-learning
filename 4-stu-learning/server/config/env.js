import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseTeacherAccounts } from './teacher-accounts.js';

const defaultProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean' || value === undefined) return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean());

const schema = z.object({
  APP_ENV: z.enum(['local', 'development', 'test', 'preview', 'production']).default('local'),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  AI_ENABLED: booleanFromEnv.default(true),
  REALTIME_MODE: z.enum(['polling', 'websocket', 'supabase']).default('polling'),
  EVIDENCE_UPLOAD_MODE: z.enum(['proxy', 'direct']).default('proxy'),
  ENABLE_DEMO: booleanFromEnv.default(true),
  // 只允许 test 环境显式跳过学生专属入课凭证；preview / production 永远强制验证。
  JOIN_CREDENTIAL_BYPASS: booleanFromEnv.default(false),
  // 仅供本地／预览验收真实推进测试会话。生产环境会在运行时强制关闭。
  QA_FORCE_COMPLETE_ENABLED: booleanFromEnv.default(false),
  READINESS_TOKEN: z.string().min(24).optional(),
  // 当前原型允许产品负责人使用 6 位及以上的易记教师凭证。
  // 正式开放给多人前，应切换为组织账号登录或高强度凭证。
  TEACHER_API_TOKEN: z.string().min(6).optional(),
  TEACHER_ID: z.string().min(1).max(100).default('teacher-primary'),
  // 多套教师体验账号：JSON 数组 [{id, token, name, experiencePack?}]。
  // 与 TEACHER_API_TOKEN 并存时合并；JSON 条目默认会自动建 1 人体验场次。
  // Vercel 仪表盘有时会把 JSON 先解析再注入，这里统一收成字符串。
  TEACHER_ACCOUNTS: z.preprocess((value) => {
    if (value == null || value === '') return undefined;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return value;
    }
  }, z.string().optional()),
  OPENAI_BASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  // 语义理解用的轻量模型。不配置时复用 OPENAI_MODEL（行为不变，只是每回合多打一次主模型）。
  OPENAI_UNDERSTAND_MODEL: z.string().min(1).optional(),
  // 轻量模型可以住在另一个服务商（如 DeepSeek 官方）。这三个不配就沿用主模型那套。
  OPENAI_UNDERSTAND_BASE_URL: z.string().url().optional(),
  // 允许留空：配置文件里留着占位的空行不该导致服务起不来，空值等于"沿用主模型的 key"。
  OPENAI_UNDERSTAND_API_KEY: z.string().optional(),
  OPENAI_UNDERSTAND_WIRE_API: z.enum(['responses', 'chat_completions']).optional(),
  // 验收可以独立选模型和服务商；不配置时仍使用主模型，但拥有自己的超时与重试预算。
  OPENAI_EVALUATION_MODEL: z.string().min(1).optional(),
  OPENAI_EVALUATION_BASE_URL: z.string().url().optional(),
  OPENAI_EVALUATION_API_KEY: z.string().optional(),
  OPENAI_EVALUATION_WIRE_API: z.enum(['responses', 'chat_completions']).optional(),
  OPENAI_WIRE_API: z.enum(['responses', 'chat_completions']).default('responses'),
  AI_TOOL_MODE: z.enum(['auto', 'native', 'structured']).default('auto'),
  // 当前未实现：services/llm.js 硬编码 webSearch: false；接线前配置它没有效果。
  AI_WEB_SEARCH_MODE: z.enum(['auto', 'enabled', 'disabled']).default('auto'),
  AI_VISION_MODE: z.enum(['auto', 'enabled', 'disabled']).default('auto'),
  AI_REASONING_EFFORT: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']).default('minimal'),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(2000).default(192),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(60000).default(25000),
  // 专用理解模型应快速响应；超过这个窗口就把剩余预算交给主模型兜底。
  AI_UNDERSTAND_PRIMARY_TIMEOUT_MS: z.coerce.number().int().min(500).max(10000).default(3500),
  // 语义理解的总预算（含专用模型尝试与主模型兜底），必须短于整轮预算。
  AI_UNDERSTAND_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(20000),
  // 验收最多重试一次。默认 28s × 2 加退避仍能留在 70s 整轮预算内。
  AI_EVALUATION_TIMEOUT_MS: z.coerce.number().int().min(5000).max(34000).default(28000),
  AI_TURN_TIMEOUT_MS: z.coerce.number().int().min(10000).max(75000).default(75000),
  AI_REQUEST_LEASE_MS: z.coerce.number().int().min(15000).max(85000).default(85000),
  VITE_AMAP_KEY: z.string().default(''),
  VITE_AMAP_SECURITY_CODE: z.string().default(''),
  VITE_AMAP_STYLE: z.string().default('amap://styles/normal'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_STORE_DIR: z.string().default('.runtime'),
  DATABASE_URL: z.string().url().optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(4).default(2),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(5000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(8000),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  DB_MAX_LIFETIME_SECONDS: z.coerce.number().int().min(30).max(1800).default(300),
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PREFIX: z.string().default('evidence'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(100_000).max(4_000_000).default(4_000_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

function defaultAppEnv() {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'local';
}

export function effectiveAppEnvironment(env = {}) {
  const declared = [env.APP_ENV, env.VERCEL_ENV].filter(Boolean);
  if (declared.includes('production')) return 'production';
  if (declared.includes('preview')) return 'preview';
  return env.APP_ENV || (env.VERCEL_ENV === 'development' ? 'development' : 'local');
}

export function qaForceCompleteEnabled(env = {}) {
  // Vercel 的托管环境优先级高于手工导入的 APP_ENV，避免整包导入本地 .env 时误开公网验收接口。
  const appEnvironment = effectiveAppEnvironment(env);
  if (appEnvironment === 'production') return false;
  // 本地服务默认也是普通学生体验；只有专门的 QA 运行才开放跳关接口。
  return env.QA_FORCE_COMPLETE_ENABLED === true;
}

export function loadEnv({
  projectRoot = defaultProjectRoot,
  lessonsRoot = path.resolve(projectRoot, '../6-lessons'),
} = {}) {
  const parsed = schema.safeParse({
    ...process.env,
    APP_ENV: effectiveAppEnvironment({
      APP_ENV: process.env.APP_ENV || defaultAppEnv(),
      VERCEL_ENV: process.env.VERCEL_ENV,
    }),
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`智能体服务环境变量校验失败：${fields}`);
  }
  const values = {
    ...parsed.data,
    projectRoot: path.resolve(projectRoot),
    lessonsRoot: path.resolve(lessonsRoot),
  };
  try {
    values.teacherAccounts = parseTeacherAccounts(parsed.data);
  } catch (error) {
    // 托管环境不要因为教师账号 JSON 损坏而让学生端和 health 一起 500。
    if (!['preview', 'production'].includes(effectiveAppEnvironment(values))) throw error;
    values.teacherAccountsError = error.message;
    values.teacherAccounts = parseTeacherAccounts({
      TEACHER_API_TOKEN: parsed.data.TEACHER_API_TOKEN,
      TEACHER_ID: parsed.data.TEACHER_ID,
    });
  }
  if (['preview', 'production'].includes(effectiveAppEnvironment(values))) {
    values.ENABLE_DEMO = false;
  }
  if (values.AI_TIMEOUT_MS >= values.AI_TURN_TIMEOUT_MS) {
    throw new Error('AI_TIMEOUT_MS 必须小于 AI_TURN_TIMEOUT_MS。');
  }
  if (values.AI_REQUEST_LEASE_MS < values.AI_TURN_TIMEOUT_MS + 5_000) {
    throw new Error('AI_REQUEST_LEASE_MS 必须至少比 AI_TURN_TIMEOUT_MS 多 5000 毫秒。');
  }
  if (values.AI_UNDERSTAND_TIMEOUT_MS >= values.AI_TURN_TIMEOUT_MS) {
    throw new Error('AI_UNDERSTAND_TIMEOUT_MS 必须小于 AI_TURN_TIMEOUT_MS：语义理解只是回合的第一段。');
  }
  if (values.AI_UNDERSTAND_PRIMARY_TIMEOUT_MS >= values.AI_UNDERSTAND_TIMEOUT_MS) {
    throw new Error('AI_UNDERSTAND_PRIMARY_TIMEOUT_MS 必须小于 AI_UNDERSTAND_TIMEOUT_MS，给主模型回退保留时间。');
  }
  if ((values.AI_EVALUATION_TIMEOUT_MS * 2) + 1_000 >= values.AI_TURN_TIMEOUT_MS) {
    throw new Error('AI_EVALUATION_TIMEOUT_MS 的两次尝试加退避必须小于 AI_TURN_TIMEOUT_MS。');
  }
  // 轻量模型指到了别的服务商却没给对应的 key，等于拿甲家的钥匙敲乙家的门：
  // 每个回合的第一段都会 401，而降级链会把它咽下去，只在日志里留痕。启动时就说清楚。
  if (values.OPENAI_UNDERSTAND_BASE_URL
    && values.OPENAI_UNDERSTAND_BASE_URL !== values.OPENAI_BASE_URL
    && !values.OPENAI_UNDERSTAND_API_KEY) {
    throw new Error('配了 OPENAI_UNDERSTAND_BASE_URL 指向另一个服务商，就必须同时配 OPENAI_UNDERSTAND_API_KEY，否则语义理解会一直认证失败。');
  }
  if (values.OPENAI_EVALUATION_BASE_URL
    && values.OPENAI_EVALUATION_BASE_URL !== values.OPENAI_BASE_URL
    && !values.OPENAI_EVALUATION_API_KEY) {
    throw new Error('配了 OPENAI_EVALUATION_BASE_URL 指向另一个服务商，就必须同时配 OPENAI_EVALUATION_API_KEY，否则验收会一直认证失败。');
  }
  return values;
}
