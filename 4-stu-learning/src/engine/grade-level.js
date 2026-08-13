export const GRADE_LEVELS = Object.freeze([
  '小学低年级',
  '小学高年级',
  '初中',
  '高中',
]);

export const DEFAULT_GRADE_LEVEL = '初中';

const GRADE_LEVEL_SET = new Set(GRADE_LEVELS);

const GRADE_MATCHERS = Object.freeze([
  Object.freeze({
    id: '小学低年级',
    pattern: /小学[一二三123](?:年级)?|低年级|(?:^|[\s/、，,])[一二三123]年级/u,
  }),
  Object.freeze({
    id: '小学高年级',
    pattern: /小学[四五六456](?:年级)?|小学高年级|(?:^|[\s/、，,])[四五六456]年级/u,
  }),
  Object.freeze({ id: '初中', pattern: /初中|初[一二三123]/u }),
  Object.freeze({ id: '高中', pattern: /高中|高[一二三123]/u }),
]);

export function isGradeLevel(value) {
  return GRADE_LEVEL_SET.has(String(value || '').trim());
}

export function canonicalGradeLevel(value) {
  const text = String(value || '').trim();
  if (isGradeLevel(text)) return text;
  const matches = GRADE_MATCHERS.filter((matcher) => matcher.pattern.test(text));
  if (matches.length === 1) return matches[0].id;
  if (!matches.length && /小学/u.test(text)) return '小学高年级';
  return null;
}

/**
 * 把 URL、名单或旧会话中的年级描述归一到平台四档。
 * 同时命中多档（例如课程适用范围）时不能冒充学生真实学段，统一回落。
 */
export function resolveGradeLevel(value, fallback = DEFAULT_GRADE_LEVEL) {
  const safeFallback = isGradeLevel(fallback) ? String(fallback) : DEFAULT_GRADE_LEVEL;
  return canonicalGradeLevel(value) || safeFallback;
}
