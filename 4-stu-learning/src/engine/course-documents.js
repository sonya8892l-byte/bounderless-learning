const EMBEDDED_DOCUMENTS = Object.freeze([
  Object.freeze({ section: '课程目标体系', filename: 'objectives.md' }),
  Object.freeze({ section: '阶段编排', filename: 'phases.md' }),
  Object.freeze({ section: '课程限制规则', filename: 'restrictions.md' }),
]);

// 这两份文件只服务课程作者，不属于课程运行配置。保留在课程目录中方便维护，
// 但不进入解析、公开投影或课程内容版本，避免改说明文字导致学生会话失效。
export const AUTHORING_ONLY_COURSE_FILES = Object.freeze([
  'README.md',
  'assets-checklist.md',
]);

const AUTHORING_ONLY_COURSE_FILE_SET = new Set(AUTHORING_ONLY_COURSE_FILES);

const MATERIALIZED = Symbol('materializedCourseDocuments');
const DOCUMENT_SOURCES = Symbol('courseDocumentSources');

export function runtimeCourseFiles(inputFiles = {}) {
  return Object.fromEntries(Object.entries(inputFiles || {}).filter(
    ([filename]) => !AUTHORING_ONLY_COURSE_FILE_SET.has(filename),
  ));
}

function exactSectionRange(markdown = '', section = '') {
  const lines = String(markdown || '').split('\n');
  const heading = `## ${section}`;
  const matches = lines
    .map((line, index) => (line.trimEnd() === heading ? index : -1))
    .filter((index) => index >= 0);
  if (!matches.length) return null;
  if (matches.length > 1) {
    throw new Error(`课程配置命名空间重复：course.md 中只能有一个“${heading}”。`);
  }
  const [start] = matches;
  const relativeEnd = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line));
  return {
    lines,
    start,
    end: relativeEnd === -1 ? lines.length : start + 1 + relativeEnd,
  };
}

function materializeEmbeddedSection(markdown, section) {
  const range = exactSectionRange(markdown, section);
  if (!range) return '';
  return range.lines.map((line, index) => {
    if (index < range.start || index >= range.end) return '';
    return line.replace(/^(\s{0,3})#{2,6}(\s+)/, (match, indent, whitespace) => (
      `${indent}${'#'.repeat(match.trimStart().match(/^#+/)?.[0].length - 1)}${whitespace}`
    ));
  }).join('\n');
}

function markMaterialized(files, sources) {
  Object.defineProperty(files, MATERIALIZED, { value: true });
  Object.defineProperty(files, DOCUMENT_SOURCES, { value: Object.freeze(sources) });
  return files;
}

/**
 * 把 course.md 的三个结构化命名空间物化为旧解析器使用的逻辑文档。
 *
 * 物理存储可以是一份 course.md；逻辑键继续存在，供阶段、安全限制及既有
 * 旧解析器继续看到逻辑键；旧 `restrictions.md#...` 引用也只作为迁移兼容。
 * 内嵌与外置禁止并存，避免两份真值。
 */
export function materializeCourseDocuments(inputFiles = {}) {
  if (inputFiles?.[MATERIALIZED]) return inputFiles;
  const files = { ...(inputFiles || {}) };
  const courseMarkdown = String(files['course.md'] || '');
  const sources = {};

  for (const document of EMBEDDED_DOCUMENTS) {
    const embedded = materializeEmbeddedSection(courseMarkdown, document.section);
    const hasEmbedded = Boolean(embedded);
    const hasExternal = Object.prototype.hasOwnProperty.call(inputFiles || {}, document.filename);
    if (hasEmbedded && hasExternal) {
      throw new Error(`课程配置重复来源：course.md / ${document.section} 与 ${document.filename} 同时存在。`);
    }
    if (hasEmbedded) {
      files[document.filename] = embedded;
      sources[document.filename] = Object.freeze({
        sourceFile: 'course.md',
        section: document.section,
        embedded: true,
      });
    } else {
      files[document.filename] = String(files[document.filename] || '');
      sources[document.filename] = Object.freeze({
        sourceFile: hasExternal ? document.filename : 'course.md',
        section: document.section,
        embedded: false,
      });
    }
  }

  return markMaterialized(files, sources);
}

export function courseDocumentSource(files = {}, filename = '') {
  const materialized = materializeCourseDocuments(files);
  return materialized[DOCUMENT_SOURCES]?.[filename] || Object.freeze({
    sourceFile: filename,
    section: '',
    embedded: false,
  });
}

export function courseDocumentSources(files = {}) {
  const materialized = materializeCourseDocuments(files);
  return materialized[DOCUMENT_SOURCES] || Object.freeze({});
}
