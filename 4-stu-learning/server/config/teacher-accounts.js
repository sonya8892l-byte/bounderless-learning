import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const MAX_TEACHER_ACCOUNTS = 20;

const accountSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  token: z.string().min(6).max(200),
  name: z.string().min(1).max(100).optional(),
  experiencePack: z.boolean().optional(),
});

function secureEqual(expected = '', actual = '') {
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(actual));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function normalizeAccount(account, { experiencePackDefault = false, fallbackName = '带队教师' } = {}) {
  return {
    id: String(account.id),
    token: String(account.token),
    name: String(account.name || fallbackName),
    experiencePack: account.experiencePack === undefined
      ? experiencePackDefault
      : account.experiencePack === true,
  };
}

function parseJsonAccounts(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('TEACHER_ACCOUNTS 必须是 JSON 数组。');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('TEACHER_ACCOUNTS 必须是非空 JSON 数组。');
  }
  if (parsed.length > MAX_TEACHER_ACCOUNTS) {
    throw new Error(`TEACHER_ACCOUNTS 最多 ${MAX_TEACHER_ACCOUNTS} 套。`);
  }
  return parsed.map((item, index) => {
    const result = accountSchema.safeParse(item);
    if (!result.success) {
      throw new Error(`TEACHER_ACCOUNTS[${index}] 无效。`);
    }
    return normalizeAccount(result.data, {
      experiencePackDefault: true,
      fallbackName: `体验教师${index + 1}`,
    });
  });
}

function assertUniqueAccounts(accounts) {
  const ids = new Set();
  for (const account of accounts) {
    if (ids.has(account.id)) {
      throw new Error(`教师账号 id「${account.id}」重复。`);
    }
    ids.add(account.id);
    const tokenClash = accounts.some((other) => other !== account && secureEqual(other.token, account.token));
    if (tokenClash) {
      throw new Error('教师访问凭证不能重复。');
    }
  }
  return accounts;
}

export function parseTeacherAccounts(env = {}) {
  const accounts = parseJsonAccounts(env.TEACHER_ACCOUNTS);
  const legacyToken = String(env.TEACHER_API_TOKEN || '').trim();
  if (legacyToken) {
    const legacy = normalizeAccount({
      id: env.TEACHER_ID || 'teacher-primary',
      token: legacyToken,
      name: env.TEACHER_NAME || '带队教师',
      experiencePack: false,
    }, { experiencePackDefault: false });
    const sameId = accounts.find((account) => account.id === legacy.id);
    const sameToken = accounts.find((account) => secureEqual(account.token, legacy.token));
    if (sameId && !secureEqual(sameId.token, legacy.token)) {
      throw new Error(`TEACHER_ID「${legacy.id}」与 TEACHER_ACCOUNTS 中的同名账号凭证不一致。`);
    }
    if (sameToken && sameToken.id !== legacy.id) {
      throw new Error('TEACHER_API_TOKEN 与 TEACHER_ACCOUNTS 中的另一套账号凭证重复。');
    }
    if (!sameId && !sameToken) accounts.push(legacy);
  }
  return assertUniqueAccounts(accounts);
}

export function teacherAccountsFromEnv(env = {}) {
  if (Array.isArray(env.teacherAccounts) && env.teacherAccounts.length) {
    return env.teacherAccounts;
  }
  return parseTeacherAccounts(env);
}

export function normalizeTeacherAccess(teacherAccess = {}) {
  if (Array.isArray(teacherAccess.accounts) && teacherAccess.accounts.length) {
    return teacherAccess.accounts.map((account, index) => normalizeAccount(account, {
      experiencePackDefault: account.experiencePack === true,
      fallbackName: account.name || `体验教师${index + 1}`,
    }));
  }
  if (teacherAccess.token) {
    return [normalizeAccount({
      id: teacherAccess.teacherId || 'teacher-primary',
      token: teacherAccess.token,
      name: teacherAccess.teacherName || '带队教师',
      experiencePack: teacherAccess.experiencePack === true,
    }, { experiencePackDefault: false })];
  }
  return [];
}

export function resolveTeacherAccount(accounts, providedToken) {
  const token = String(providedToken || '');
  if (!token || !Array.isArray(accounts) || !accounts.length) return null;
  let matched = null;
  for (const account of accounts) {
    if (secureEqual(account.token, token)) matched = account;
  }
  return matched;
}
