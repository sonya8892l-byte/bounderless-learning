import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

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
  AI_ENABLED: booleanFromEnv.default(true),
  REALTIME_MODE: z.enum(['polling', 'websocket', 'supabase']).default('polling'),
  EVIDENCE_UPLOAD_MODE: z.enum(['proxy', 'direct']).default('proxy'),
  ENABLE_DEMO: booleanFromEnv.default(true),
  READINESS_TOKEN: z.string().min(24).optional(),
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

export function loadEnv({
  projectRoot = defaultProjectRoot,
  lessonsRoot = path.resolve(projectRoot, '../6-lessons'),
} = {}) {
  const parsed = schema.safeParse({
    ...process.env,
    APP_ENV: process.env.APP_ENV || defaultAppEnv(),
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
  if (process.env.ENABLE_DEMO === undefined && ['preview', 'production'].includes(values.APP_ENV)) {
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
