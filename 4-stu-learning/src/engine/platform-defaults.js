// 平台缺省层文档的解析与合并。纯函数、无 IO，服务端课程编译与浏览器公开包编译共用同一份实现，
// 避免两条链各自持有一套缺省值。文件读取与版本计算见 server/course/platform-defaults.js。

export const MERGE_STRATEGIES = Object.freeze(['by-key', 'replace', 'append']);

const DECLARATION_ALIASES = Object.freeze({
  overridable: 'overridable',
  merge: 'merge',
  'course-field': 'courseField',
  locked: 'locked',
});

function unquote(value = '') {
  const result = String(value).trim();
  const pair = [["'", "'"], ['"', '"'], ['“', '”']]
    .find(([open, close]) => result.length >= 2 && result.startsWith(open) && result.endsWith(close));
  return pair ? result.slice(1, -1).trim() : result;
}

// 声明块允许行尾注释：`> merge: by-key   # by-key 逐键覆盖｜replace 整体替换`
function stripInlineComment(value = '') {
  return String(value).replace(/\s+#.*$/, '').trim();
}

function parseLockedList(value = '') {
  return [...new Set(
    String(value)
      .split(/[,，、;；]/)
      .map((item) => unquote(item))
      .filter(Boolean),
  )];
}

function parseDeclarationLine(line, declaration, filename) {
  const match = line.match(/^>\s*([a-zA-Z][\w-]*)\s*[:：]\s*(.*)$/);
  if (!match) return false;
  const key = DECLARATION_ALIASES[match[1].toLowerCase()];
  if (!key) return false;
  const value = stripInlineComment(match[2]);

  if (key === 'overridable') {
    if (!['true', 'false'].includes(value.toLowerCase())) {
      throw new Error(`平台缺省层 ${filename} 的 overridable 只能是 true 或 false，实际写了：${value}`);
    }
    declaration.overridable = value.toLowerCase() === 'true';
    return true;
  }
  if (key === 'merge') {
    if (!MERGE_STRATEGIES.includes(value)) {
      throw new Error(`平台缺省层 ${filename} 的 merge 只能是 ${MERGE_STRATEGIES.join(' / ')}，实际写了：${value}`);
    }
    declaration.merge = value;
    return true;
  }
  if (key === 'locked') {
    declaration.locked = parseLockedList(value);
    return true;
  }
  declaration.courseField = unquote(value);
  return true;
}

/**
 * 把一份平台缺省层 md 解析成结构化文档。
 * 头部声明块决定覆盖属性；`## 小节` 下的 `- 键：值` 进 sections，小节之前的进 entries，
 * 其余正文按小节收进 body（voice.md 这类模板文件用 body）。
 */
export function parsePlatformDefaultDocument(markdown, filename = '') {
  const text = String(markdown ?? '').replace(/\r\n?/g, '\n');
  const declaration = { overridable: false, merge: 'by-key', courseField: '', locked: [] };
  const entries = {};
  const sections = {};
  let section = null;

  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      section = { entries: {}, body: '' };
      sections[unquote(heading[1])] = section;
      continue;
    }
    if (!section && parseDeclarationLine(line, declaration, filename)) continue;

    const entry = line.match(/^[-*]\s*([^：:]+)[：:]\s*(.*)$/);
    if (entry) {
      const key = unquote(entry[1]);
      const value = unquote(entry[2]);
      if (section) section.entries[key] = value;
      else entries[key] = value;
      continue;
    }
    if (section && line.trim() && !line.startsWith('>')) {
      section.body = section.body ? `${section.body}\n${line}` : line;
    }
  }

  for (const value of Object.values(sections)) {
    value.body = value.body.trim();
    Object.freeze(value.entries);
    Object.freeze(value);
  }

  return Object.freeze({
    filename,
    declaration: Object.freeze({ ...declaration, locked: Object.freeze(declaration.locked) }),
    entries: Object.freeze(entries),
    sections: Object.freeze(sections),
    markdown: text.trim(),
  });
}

/** 把顶层键值与各小节键值拍平成一张表。小节内同名键覆盖顶层。 */
export function documentEntries(document) {
  const result = { ...(document?.entries || {}) };
  for (const section of Object.values(document?.sections || {})) {
    Object.assign(result, section.entries);
  }
  return result;
}

/** 从 course.md 里取出某个覆盖小节的键值表。课程没写这一节时返回空表。 */
export function courseOverrideSection(courseMarkdown, sectionName) {
  if (!courseMarkdown || !sectionName) return {};
  const document = parsePlatformDefaultDocument(courseMarkdown, 'course.md');
  return { ...(document.sections[sectionName]?.entries || {}) };
}

function lockedWarning(filename, key) {
  return { file: filename, key, message: `平台缺省层 ${filename} 锁定了「${key}」，课程的覆盖已忽略。` };
}

function immutableWarning(filename, key) {
  return { file: filename, key, message: `平台缺省层 ${filename} 不可覆盖，课程写的「${key}」已忽略。` };
}

/**
 * 按 D4 白名单把课程覆盖合并到平台缺省之上。
 * 被拦下的键不静默丢弃，一律进 warnings 由调用方上报。
 */
export function mergeDefaults(document, courseOverrides = {}) {
  const filename = document?.filename || '';
  const base = documentEntries(document);
  const overrides = Object.fromEntries(
    Object.entries(courseOverrides || {}).filter(([key]) => String(key).trim()),
  );
  const warnings = [];
  if (!Object.keys(overrides).length) return { entries: base, warnings };

  if (!document?.declaration?.overridable) {
    for (const key of Object.keys(overrides)) warnings.push(immutableWarning(filename, key));
    return { entries: base, warnings };
  }

  const locked = new Set(document.declaration.locked);
  const allowed = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (locked.has(key)) warnings.push(lockedWarning(filename, key));
    else allowed[key] = value;
  }

  if (document.declaration.merge === 'replace') {
    const kept = Object.fromEntries(Object.entries(base).filter(([key]) => locked.has(key)));
    return { entries: { ...allowed, ...kept }, warnings };
  }

  if (document.declaration.merge === 'append') {
    const entries = { ...base };
    for (const [key, value] of Object.entries(allowed)) {
      entries[key] = entries[key] ? `${entries[key]}\n${value}` : value;
    }
    return { entries, warnings };
  }

  return { entries: { ...base, ...allowed }, warnings };
}
