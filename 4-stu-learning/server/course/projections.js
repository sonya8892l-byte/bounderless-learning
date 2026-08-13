/**
 * IR 上的公开投影：唯一一份裁剪与脱敏清单。
 *
 * 此前这套逻辑只存在于 scripts/sync-lessons.mjs（构建期），服务端没有对应实现——
 * 于是 compileCourse 返回的 `lesson` 是全量结构，只是碰巧没人整体序列化它。
 * 现在构建脚本与服务端都调用本模块，"双清单"不再存在。
 *
 * 服务端**故意**保留全量 `lesson`：时间银行判分要读 task.answer / verify / radius
 * （见 server/agent/service.js 的 answerTimeBank），那些正是浏览器不能拿到的字段。
 * 需要下发给浏览器时才调 toPublic。
 */

/**
 * 提取可以安全做字符串门禁的“精确答案”。受保护内容还常记录隐私类别与安全禁令，
 * 不能按逗号拆成词后全部脱敏，否则“他人正脸”“IUCN 等级”“地方标准”这些正常安全/研究说明也会消失。
 */
export function restrictionProtectedTerms(name = '', content = '') {
  const source = String(content || '').trim();
  const numericTerms = [...source.matchAll(/\d{4}年(?:\d{1,2}月(?:\d{1,2}(?:日至\d{1,2})?日?)?)?|\d+(?:\.\d+)?(?:%|万?m³|米)|\d{3,}/g)]
    .map((match) => match[0]);
  // “有效／无效”这类过短通用词不能单独作全局字符串门禁，
  // 否则“这条证据有效吗”也会被误判为答案泄露。
  const quotedTerms = [...`${name} ${source}`.matchAll(/["“”']([^"“”']{4,})["“”']/g)]
    .map((match) => match[1]);
  const numberedConcepts = [...source.matchAll(/([一二三四五六七八九十]+级[^的，；;]{2,})(?=的|，|；|;|$)/g)]
    .map((match) => match[1]);
  const assertionTerms = source
    .split(/[；;]/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 4)
    .filter((value) => /(?:就是|用于|.{2,}(?:是|为).{2,}|→|水从.{1,16}流|流入|流出|汇入|北高南低|南高北低|东高西低|西高东低|蓄排并用|系统承受极限|溢出点|放弃|成立|为.{1,12}之[虚实]|西渡|东渡|南渡|抢渡|回师|调敌|威逼|调动滇军|机动灵活|争取主动|实事求是地修正|完整路径|完整链条|[一二三四五六七八九十]+种功能)/.test(value));
  return [...new Set([...numericTerms, ...quotedTerms, ...numberedConcepts, ...assertionTerms])]
    .sort((a, b) => b.length - a.length);
}

const CHINESE_DIGITS = Object.freeze({
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
});
const CHINESE_UNITS = Object.freeze({ 十: 10, 百: 100, 千: 1_000, 万: 10_000, 亿: 100_000_000 });

function chineseNumberValue(source = '') {
  const text = String(source || '');
  if (![...text].some((char) => CHINESE_UNITS[char])) {
    return [...text].map((char) => CHINESE_DIGITS[char]).join('');
  }
  let total = 0;
  let section = 0;
  let number = 0;
  for (const char of text) {
    if (Object.hasOwn(CHINESE_DIGITS, char)) {
      number = CHINESE_DIGITS[char];
      continue;
    }
    const unit = CHINESE_UNITS[char];
    if (unit < 10_000) {
      section += (number || 1) * unit;
    } else {
      section += number;
      total += (section || 1) * unit;
      section = 0;
    }
    number = 0;
  }
  return String(total + section + number);
}

/**
 * 保护答案的确定性比较投影：统一全半角、标点和中文数字写法。
 * 它只用于高置信门禁，不做模糊相似度推断。
 */
export function canonicalProtectedText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/百分之([零〇一二两三四五六七八九十百千万亿]+|\d+(?:\.\d+)?)/gu, (_match, number) => {
      const normalized = /^\d/u.test(number) ? number : chineseNumberValue(number);
      return `${normalized}%`;
    })
    .replace(/(\d+(?:\.\d+)?)万/gu, (_match, number) => String(Number(number) * 10_000))
    .replace(/(\d+(?:\.\d+)?)亿/gu, (_match, number) => String(Number(number) * 100_000_000))
    .replace(/[零〇一二两三四五六七八九十百千万亿]+/gu, (match) => chineseNumberValue(match))
    .toLowerCase()
    .replace(/(?:立方米|m\^?3|㎥)/gu, 'm3')
    .replace(/[\s，。！？、；：,.!?;:'"“”‘’（）()[\]{}《》〈〉—–_]/gu, '');
}

function allGroupsMatcher(groups = []) {
  const normalized = groups
    .map((group) => [...new Set(group.map(canonicalProtectedText).filter(Boolean))])
    .filter((group) => group.length);
  return normalized.length >= 2 ? { kind: 'all_groups', groups: normalized } : null;
}

/** 将课程作者明写的精确答案编译成可执行门禁。 */
export function restrictionProtectedMatchers(name = '', content = '', terms = null) {
  const protectedTerms = terms || restrictionProtectedTerms(name, content);
  const matchers = protectedTerms.map((term) => ({
    kind: 'normalized_contains',
    value: canonicalProtectedText(term),
  })).filter((matcher) => matcher.value);

  // 完整链条和功能组合即使调换列举顺序，仍应视为同一个受保护结论。
  for (const term of protectedTerms) {
    const arrowParts = String(term).split('→').map((item) => item.trim()).filter(Boolean);
    if (arrowParts.length >= 3) {
      const matcher = allGroupsMatcher(arrowParts.map((item) => [item]));
      if (matcher) matchers.push(matcher);
    }
    const listParts = String(term).split('、').map((item) => item.trim()).filter(Boolean);
    if (listParts.length >= 3) {
      const cleaned = listParts.map((item) => item.replace(/[0-9一二两三四五六七八九十]+种功能$/u, '').trim());
      const matcher = allGroupsMatcher(cleaned.map((item) => [item]));
      if (matcher) matchers.push(matcher);
    }
  }

  // “排水口 / 用于排水 / 雨水导出”是同一功能断言的常见改写。
  const functionSubject = protectedTerms
    .map((term) => String(term).match(/^(.{1,10}?)(?:就是|是|用于)(?:排水口|排水)/u)?.[1])
    .find(Boolean);
  if (functionSubject) {
    matchers.push({
      kind: 'function_assertion',
      subject: canonicalProtectedText(functionSubject),
    });
  }

  const seen = new Set();
  return matchers.filter((matcher) => {
    const key = JSON.stringify(matcher);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function matchesProtectedMatchers(text = '', matchers = []) {
  const value = canonicalProtectedText(text);
  return (matchers || []).some((matcher) => {
    if (matcher?.kind === 'normalized_contains') {
      return Boolean(matcher.value) && value.includes(String(matcher.value));
    }
    if (matcher?.kind === 'all_groups') {
      return (matcher.groups || []).every((group) => (group || [])
        .some((term) => term && value.includes(String(term))));
    }
    if (matcher?.kind === 'function_assertion') {
      const subject = String(matcher.subject || '');
      if (!subject) return false;
      const escaped = subject.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      return new RegExp(`${escaped}(?:就是|是|用于|用来|负责|承担|具有|作用是|功能是|可以).{0,18}(?:排水口|排水|泄水|出水|雨水导出|导出雨水|排出雨水|排放雨水|积水导出|导出积水)`, 'u').test(value)
        || new RegExp(`(?:水|雨水|积水)从${escaped}.{0,8}(?:流出|排出|导出)`, 'u').test(value)
        || new RegExp(`${escaped}.{0,8}(?:把|将)(?:雨水|积水).{0,8}(?:导出|排出|排放)`, 'u').test(value);
    }
    return false;
  });
}

/** 从 restrictions.md 的表格里提取需要脱敏的精确答案词。 */
export function protectedTerms(markdown = '') {
  const terms = [];
  for (const line of String(markdown).split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((value) => value.trim());
    if (cells.length !== 4 || cells[0] === '限制项') continue;
    terms.push(...restrictionProtectedTerms(cells[0], cells[1]));
  }
  // 长词优先替换，避免短词先命中后把长词切碎。
  return [...new Set(terms)].sort((a, b) => b.length - a.length);
}

export function protectedMatchers(markdown = '') {
  const matchers = [];
  for (const line of String(markdown).split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((value) => value.trim());
    if (cells.length !== 4 || cells[0] === '限制项') continue;
    matchers.push(...restrictionProtectedMatchers(cells[0], cells[1]));
  }
  const seen = new Set();
  return matchers.filter((matcher) => {
    const key = JSON.stringify(matcher);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 递归把保护词替换为占位文案。 */
export function redactPublic(value, terms) {
  if (typeof value === 'string') {
    return terms.reduce((result, term) => result.replaceAll(term, '[待学生探索]'), value);
  }
  if (Array.isArray(value)) return value.map((item) => redactPublic(item, terms));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactPublic(item, terms)]));
  }
  return value;
}

function redactPublicMatchers(value, matchers) {
  if (typeof value === 'string') {
    return matchesProtectedMatchers(value, matchers) ? '[待学生探索]' : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactPublicMatchers(item, matchers));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, redactPublicMatchers(item, matchers)]));
  }
  return value;
}

export function sanitizeTool(tool) {
  const safe = structuredClone(tool);
  if (!safe?.config) return safe;
  for (const key of ['answer', 'answers', 'expectedResults', 'correctMapping', 'validConnections', 'explanation', 'retryMessage', 'evaluationPrompt']) {
    delete safe.config[key];
  }
  if (Array.isArray(safe.config.choices)) {
    safe.config.choices = safe.config.choices.map(({ score, correct, ...choice }) => choice);
  }
  return safe;
}

const PUBLIC_STEP_FIELDS = ['id', 'title', 'objective', 'studentAction', 'completionMode', 'evidenceRequirement', 'location', 'modules', 'next'];

// Step 采用白名单重建：新增的私有字段（就地引导/脚手架/验收标准、能力标签）自动不下发。
//
// 只拷**存在**的键，不把白名单里缺的字段写成 `key: undefined`。
// 作者没写 `#### Step N` 时解析器会合成一条占位小步（没有 title/modules/next），
// 照搬白名单就会造出三个 undefined 键。它们 JSON 序列化时消失、在内存里却存在，
// 于是"构建期产物 vs 运行期投影"的 deepEqual 会红——两边其实是同一份数据。
export function sanitizeTaskTools(task) {
  task.tools = (task.tools || []).map(sanitizeTool);
  task.steps = (task.steps || []).map((step) => {
    const safe = {};
    for (const key of PUBLIC_STEP_FIELDS) {
      if (key in step) safe[key] = step[key];
    }
    safe.tools = (step.tools || []).map(sanitizeTool);
    return safe;
  });
  delete task.toolParameters;
  // 任务级为增量对象，私有字段需显式删除：就地教学内容会泄漏引导策略与验收标准，
  // 能力标签属于评价预留数据，两类都不进浏览器。
  for (const key of ['inlineGuidance', 'inlineScaffold', 'inlineAcceptance', 'competencyTags']) {
    delete task[key];
  }
}

/**
 * 全量 lesson → 浏览器可见的公开投影。纯函数：深拷贝后裁剪，不改动入参。
 *
 * @param {object} lesson 全量解析产物（compileCourse 的 course.lesson）
 * @param {string} restrictionMarkdown 该课 restrictions.md 原文，用于提取脱敏词
 */
export function toPublic(lesson, restrictionMarkdown = '') {
  const publicLesson = structuredClone(lesson);

  publicLesson.roles.forEach((role) => {
    delete role.keyData;
    role.tasks.forEach((task) => {
      delete task.guide;
      sanitizeTaskTools(task);
    });
  });
  // 阶段任务（非角色任务）走同一把裁剪清单。
  // 这一段容易漏：`phases` 是整份下发浏览器的，此前 toPublic 完全不碰它——
  // 阶段任务一旦带上就地验收标准与能力标签，不裁就直接进公开包。
  (publicLesson.phases || []).forEach((phase) => {
    (phase.tasks || []).forEach((task) => {
      delete task.guide;
      sanitizeTaskTools(task);
    });
  });
  publicLesson.timeBank.tasks.forEach((task) => {
    task.requiresText = task.verify === 'image_and_text';
    delete task.answer;
    delete task.verify;
    delete task.location;
    delete task.radius;
  });

  const exactRedacted = redactPublic(publicLesson, protectedTerms(restrictionMarkdown));
  return redactPublicMatchers(exactRedacted, protectedMatchers(restrictionMarkdown));
}
