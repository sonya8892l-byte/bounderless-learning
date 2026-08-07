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

/** 从 restrictions.md 的表格里提取需要脱敏的词：答案、精确数值、引号内的结论。 */
export function protectedTerms(markdown = '') {
  const terms = [];
  for (const line of String(markdown).split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((value) => value.trim());
    if (cells.length !== 4 || cells[0] === '限制项') continue;
    terms.push(...[...cells[1].matchAll(/\d{4}年(?:\d{1,2}月(?:\d{1,2}(?:日至\d{1,2})?日?)?)?|\d+(?:\.\d+)?(?:%|万?m³|米)|\d{3,}/g)].map((match) => match[0]));
    terms.push(...[...`${cells[0]} ${cells[1]}`.matchAll(/["“”']([^"“”']{2,})["“”']/g)].map((match) => match[1]));
    terms.push(...cells[1].split(/[、，；和的]/).map((value) => value.trim()).filter((value) => value.length >= 4 && value !== '这个概念性总结语'));
  }
  // 长词优先替换，避免短词先命中后把长词切碎。
  return [...new Set(terms)].sort((a, b) => b.length - a.length);
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

// Step 采用白名单重建：新增的私有字段（就地引导/脚手架/验收标准、能力标签）自动不下发。
export function sanitizeTaskTools(task) {
  task.tools = (task.tools || []).map(sanitizeTool);
  task.steps = (task.steps || []).map((step) => ({
    id: step.id,
    title: step.title,
    objective: step.objective,
    studentAction: step.studentAction,
    completionMode: step.completionMode,
    evidenceRequirement: step.evidenceRequirement,
    location: step.location,
    modules: step.modules,
    next: step.next,
    tools: (step.tools || []).map(sanitizeTool),
  }));
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
  publicLesson.timeBank.tasks.forEach((task) => {
    task.requiresText = task.verify === 'image_and_text';
    delete task.answer;
    delete task.verify;
    delete task.location;
    delete task.radius;
  });

  return redactPublic(publicLesson, protectedTerms(restrictionMarkdown));
}
