import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parsePlatformDefaultDocument } from '../../src/engine/platform-defaults.js';

// 平台缺省层文件清单。与三份底线规则不同，缺省层文件缺失不报错：运行时回落到 JS 里的
// 现有常量，行为与建立缺省层之前完全一致（双轨期）。
export const PLATFORM_DEFAULT_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'defaults', filename: 'defaults.md', title: '数值缺省' }),
  Object.freeze({ id: 'languageLevels', filename: 'language-levels.md', title: '学段表达规范' }),
]);

// _platform/language-levels.md 缺失时的回落值。双轨期内不要删除。
export const LANGUAGE_LEVEL_DEFAULTS = Object.freeze({
  小学低年级: Object.freeze({ words: '15–30', limit: 48, style: '短句、具体词和二选一问题' }),
  小学高年级: Object.freeze({ words: '30–50', limit: 72, style: '一次只给一个行动和一个观察点' }),
  初中: Object.freeze({ words: '50–80', limit: 100, style: '鼓励先尝试，再按需要给提示' }),
  高中: Object.freeze({ words: '80–120', limit: 140, style: '可以使用开放问题并要求说明证据' }),
});

export const DEFAULT_LANGUAGE_LEVEL = '初中';

// 年级文本 → 学段的匹配留在代码里：这是解析逻辑不是文案，顺序敏感（低年级先于小学）。
const GRADE_MATCHERS = Object.freeze([
  Object.freeze({ id: '小学低年级', pattern: /一|二|三年级|低年级/ }),
  Object.freeze({ id: '小学高年级', pattern: /四|五|六年级|小学/ }),
  Object.freeze({ id: '高中', pattern: /高中|高一|高二|高三/ }),
]);

function positiveInteger(value, fallback) {
  const parsed = Math.round(Number.parseFloat(String(value ?? '').match(/\d+(?:\.\d+)?/)?.[0]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 学段规范是分小节的文档，同名键（字数/硬上限/句式）在四个小节里重复，
 * 因此按小节合并而不是走 mergeDefaults 的拍平模型。
 * 课程覆盖用带学段前缀的扁平键，例如 `- 初中硬上限：80`。
 */
export function resolveLanguageLevels(document, courseOverrides = {}) {
  const levels = {};
  for (const [id, base] of Object.entries(LANGUAGE_LEVEL_DEFAULTS)) {
    const entries = document?.sections?.[id]?.entries || {};
    const pick = (key) => courseOverrides[`${id}${key}`] ?? entries[key];
    levels[id] = Object.freeze({
      id,
      words: pick('字数') || base.words,
      limit: positiveInteger(pick('硬上限'), base.limit),
      style: pick('句式') || base.style,
    });
  }
  return Object.freeze(levels);
}

export function languageLevelFor(languageLevels, grade = '') {
  const levels = languageLevels && Object.keys(languageLevels).length
    ? languageLevels
    : resolveLanguageLevels(null);
  const matched = GRADE_MATCHERS.find((matcher) => matcher.pattern.test(String(grade || '')))?.id;
  return levels[matched] || levels[DEFAULT_LANGUAGE_LEVEL];
}

function versionFor(documents) {
  const hash = createHash('sha256');
  for (const definition of PLATFORM_DEFAULT_DEFINITIONS) {
    hash.update(definition.filename);
    hash.update('\0');
    hash.update(documents[definition.id]?.markdown ?? '\u0000missing');
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

export async function loadPlatformDefaults({ lessonsRoot, logger = console } = {}) {
  const directory = path.resolve(lessonsRoot, '_platform');
  const documents = {};
  const missing = [];

  for (const definition of PLATFORM_DEFAULT_DEFINITIONS) {
    let markdown;
    try {
      markdown = await fs.readFile(path.resolve(directory, definition.filename), 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      documents[definition.id] = null;
      missing.push(definition.filename);
      logger?.debug?.(`平台缺省层未提供 _platform/${definition.filename}，回落到代码内缺省值。`);
      continue;
    }
    documents[definition.id] = parsePlatformDefaultDocument(markdown, definition.filename);
  }

  return Object.freeze({
    version: versionFor(documents),
    documents: Object.freeze(documents),
    missing: Object.freeze(missing),
  });
}
