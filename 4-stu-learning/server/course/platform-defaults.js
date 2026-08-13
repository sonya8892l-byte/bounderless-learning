import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mergeDefaults, parsePlatformDefaultDocument } from '../../src/engine/platform-defaults.js';
import { PLATFORM_COMPANION } from '../../src/engine/platform-config.js';
import {
  DEFAULT_GRADE_LEVEL,
  resolveGradeLevel,
} from '../../src/engine/grade-level.js';

// 平台默认层文件清单。与三份底线规则不同，默认层文件缺失不报错：运行时回落到 JS 里的
// 现有常量，行为与建立默认层之前完全一致（双轨期）。
export const PLATFORM_DEFAULT_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'defaults', filename: 'defaults.md', title: '数值默认' }),
  Object.freeze({ id: 'languageLevels', filename: 'language-levels.md', title: '学段表达规范' }),
  Object.freeze({ id: 'companion', filename: 'companion.md', title: '絮絮人设' }),
  Object.freeze({ id: 'voice', filename: 'voice.md', title: '流程话术' }),
  Object.freeze({ id: 'scaffolding', filename: 'scaffolding.md', title: '脚手架等级' }),
  Object.freeze({ id: 'toolDefaults', filename: 'tool-defaults.md', title: '工具显示名与默认字段' }),
  Object.freeze({ id: 'logistics', filename: 'logistics.md', title: '活动组织信息回答规则' }),
]);

// _platform/logistics.md 的默认话术与硬约束。缺文件时回落到这里，行为与建文件前一致。
export const LOGISTICS_DEFAULTS = Object.freeze({
  rules: Object.freeze([
    '课程包里没写的现场设施位置一律不许猜，只能说没有这个信息、问带队老师最快。',
    '只说课程配置里有的时长，不报绝对时刻。',
    '不替老师做安排，不承诺提前走、换组或跳过任务。',
    '不评价活动安排本身。',
  ]),
  phrases: Object.freeze({
    信息缺失: '我这里没有这个信息，问一下带队老师最快。',
    设施位置: '这个我没有场馆平面图，问带队老师或者现场工作人员最快。',
    时间安排: '这个阶段计划{duration}。具体几点结束要看现场进度，以带队老师的安排为准。',
    需要老师定: '这个要带队老师决定，我没法替老师安排。你现在就可以去问问。',
    找老师: '带队老师在带着大家走这条路线。如果一时找不到，先待在原地不要走开，我可以帮你呼叫老师。',
    身体不适: '先停下来，别再继续任务。我现在帮你叫老师，你待在原地不要独自走开。',
    走失: '先停在原地不要再移动，也不要自己找路。我现在帮你呼叫老师，把你现在能看到的标志物告诉我。',
    拉回一句: '先回到手上这一小步——{stepLabel}。',
  }),
});

const LOGISTICS_FALLBACK_DOCUMENT = Object.freeze({
  filename: 'logistics.md',
  declaration: Object.freeze({
    overridable: true,
    merge: 'by-key',
    courseField: '组织信息',
    locked: Object.freeze([]),
  }),
  entries: Object.freeze({ ...LOGISTICS_DEFAULTS.phrases }),
  sections: Object.freeze({}),
  markdown: '',
});

/**
 * 组织信息回答规则。硬约束（不许猜设施位置等）取文档正文喂 Prompt；
 * 默认话术按键合并，课程可用 `## 组织信息` 小节逐条覆盖。
 */
export function resolveLogistics(document, courseOverrides = {}) {
  const { entries, warnings } = mergeDefaults(document || LOGISTICS_FALLBACK_DOCUMENT, courseOverrides);
  const phrases = {};
  for (const [key, value] of Object.entries(LOGISTICS_DEFAULTS.phrases)) {
    phrases[key] = String(entries[key] || value).trim() || value;
  }
  const constraints = String(document?.sections?.['硬约束']?.body || '').trim();
  return {
    logistics: Object.freeze({
      phrases: Object.freeze(phrases),
      // 缺文件时用代码内的规则清单，保证 Prompt 里这段硬约束永远存在。
      constraints: constraints || LOGISTICS_DEFAULTS.rules.map((line) => `- ${line}`).join('\n'),
    }),
    warnings,
  };
}

export const SCAFFOLDING_DEFAULTS = Object.freeze({
  maxLevel: 4,
  upgradeOnRepeatHelp: true,
  fallbackHint: '先选一条最容易确认的现场线索，说说你看到了什么。',
  levels: Object.freeze({
    L0: '不主动给提示，等学生先试',
    L1: '点一个观察方向或行动入口，不给步骤',
    L2: '给出可执行的一小步，仍不透露结论',
    L3: '把关键线索说得更具体，仍要求学生自己验',
    L4: '兜底提示，尽量逼近答案边界但不直接公布保护词',
  }),
});

const SCAFFOLDING_FALLBACK_DOCUMENT = Object.freeze({
  filename: 'scaffolding.md',
  declaration: Object.freeze({
    overridable: true,
    merge: 'by-key',
    courseField: '脚手架',
    locked: Object.freeze([]),
  }),
  entries: Object.freeze({
    ...SCAFFOLDING_DEFAULTS.levels,
    最高等级: String(SCAFFOLDING_DEFAULTS.maxLevel),
    升档触发: '同类求助第二次',
    默认提示: SCAFFOLDING_DEFAULTS.fallbackHint,
  }),
  sections: Object.freeze({}),
  markdown: '',
});

export function resolveScaffolding(document, courseOverrides = {}) {
  const { entries, warnings } = mergeDefaults(document || SCAFFOLDING_FALLBACK_DOCUMENT, courseOverrides);
  const maxLevel = Math.min(4, positiveInteger(entries['最高等级'], SCAFFOLDING_DEFAULTS.maxLevel));
  const trigger = String(entries['升档触发'] || '同类求助第二次');
  return {
    scaffolding: Object.freeze({
      maxLevel,
      upgradeOnRepeatHelp: !/不升|关闭|false|否/.test(trigger),
      // 「默认提示」是现行键名，「缺省提示」是旧名。两个都读：键名改动不该让课程或
      // _platform/scaffolding.md 里已写好的 L0 回落话术静默失效。
      fallbackHint: String(entries['默认提示'] || entries['缺省提示'] || SCAFFOLDING_DEFAULTS.fallbackHint).trim()
        || SCAFFOLDING_DEFAULTS.fallbackHint,
      levels: Object.freeze({
        L0: entries.L0 || SCAFFOLDING_DEFAULTS.levels.L0,
        L1: entries.L1 || SCAFFOLDING_DEFAULTS.levels.L1,
        L2: entries.L2 || SCAFFOLDING_DEFAULTS.levels.L2,
        L3: entries.L3 || SCAFFOLDING_DEFAULTS.levels.L3,
        L4: entries.L4 || SCAFFOLDING_DEFAULTS.levels.L4,
      }),
    }),
    warnings,
  };
}

// _platform/companion.md 缺失时的回落。素材路径不进 md：浏览器在构建期就要用到它们，
// 读不到 md，因此始终以 platform-config.js 为准，并同样锁定不许课程覆盖。
const COMPANION_FALLBACK_DOCUMENT = Object.freeze({
  filename: 'companion.md',
  declaration: Object.freeze({
    overridable: true,
    merge: 'by-key',
    courseField: '人设侧重',
    locked: Object.freeze(['name', 'posterAsset', 'idleAsset', 'talkAsset']),
  }),
  entries: Object.freeze({
    name: PLATFORM_COMPANION.name,
    character: PLATFORM_COMPANION.character,
    tone: PLATFORM_COMPANION.tone,
  }),
  sections: Object.freeze({}),
  markdown: '',
});

export function resolveCompanion(document, courseOverrides = {}, emphasis = '') {
  const { entries, warnings } = mergeDefaults(document || COMPANION_FALLBACK_DOCUMENT, courseOverrides);
  return {
    companion: Object.freeze({
      name: entries.name || PLATFORM_COMPANION.name,
      character: entries.character || PLATFORM_COMPANION.character,
      tone: entries.tone || PLATFORM_COMPANION.tone,
      catchphrase: String(entries['口头禅'] || '').trim(),
      emphasis: String(emphasis || '').trim(),
      posterAsset: PLATFORM_COMPANION.posterAsset,
      idleAsset: PLATFORM_COMPANION.idleAsset,
      talkAsset: PLATFORM_COMPANION.talkAsset,
    }),
    warnings,
  };
}

// _platform/language-levels.md 缺失时的回落值。双轨期内不要删除。
export const LANGUAGE_LEVEL_DEFAULTS = Object.freeze({
  小学低年级: Object.freeze({ words: '15–30', limit: 48, style: '短句、具体词和二选一问题' }),
  小学高年级: Object.freeze({ words: '30–50', limit: 72, style: '一次只给一个行动和一个观察点' }),
  初中: Object.freeze({ words: '50–80', limit: 100, style: '鼓励先尝试，再按需要给提示' }),
  高中: Object.freeze({ words: '80–120', limit: 140, style: '可以使用开放问题并要求说明证据' }),
});

export const DEFAULT_LANGUAGE_LEVEL = DEFAULT_GRADE_LEVEL;

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
  const matched = resolveGradeLevel(grade, DEFAULT_LANGUAGE_LEVEL);
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
      logger?.debug?.(`平台默认层未提供 _platform/${definition.filename}，回落到代码内默认值。`);
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
