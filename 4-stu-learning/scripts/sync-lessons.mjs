import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { loadPlatformDefaults } from '../server/course/platform-defaults.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = resolve(projectRoot, '../6-lessons');
const publicLessonsRoot = resolve(projectRoot, 'public/lessons');
const generatedFile = resolve(projectRoot, 'src/generated/lesson-public.js');

async function collectMarkdown(directory, base = directory, result = {}) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectMarkdown(fullPath, base, result);
    } else if (extname(entry.name) === '.md') {
      const key = relative(base, fullPath).replaceAll('\\', '/');
      result[key] = await readFile(fullPath, 'utf8');
    }
  }

  return result;
}

const lessonIds = (await readdir(lessonsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort();

// 清理已删课程的过期产物：课程从 6-lessons 删除后，public/lessons 下的旧目录
// 不会自动消失，会被打进部署产物。
const staleDirectories = (await readdir(publicLessonsRoot, { withFileTypes: true }).catch(() => []))
  .filter((entry) => entry.isDirectory() && !lessonIds.includes(entry.name))
  .map((entry) => entry.name);
for (const name of staleDirectories) {
  await rm(resolve(publicLessonsRoot, name), { recursive: true, force: true });
}
if (staleDirectories.length) {
  console.log(`已清理 ${staleDirectories.length} 个过期课程产物：${staleDirectories.join(', ')}`);
}

// 公开包与服务端课程包读同一份平台缺省层，避免两条编译链各自持有一套数值缺省。
const platformDefaults = await loadPlatformDefaults({ lessonsRoot });

const publicLessons = {};

function protectedTerms(markdown = '') {
  const terms = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((value) => value.trim());
    if (cells.length !== 4 || cells[0] === '限制项') continue;
    terms.push(...[...cells[1].matchAll(/\d{4}年(?:\d{1,2}月(?:\d{1,2}(?:日至\d{1,2})?日?)?)?|\d+(?:\.\d+)?(?:%|万?m³|米)|\d{3,}/g)].map((match) => match[0]));
    terms.push(...[...`${cells[0]} ${cells[1]}`.matchAll(/["“”']([^"“”']{2,})["“”']/g)].map((match) => match[1]));
    terms.push(...cells[1].split(/[、，；和的]/).map((value) => value.trim()).filter((value) => value.length >= 4 && value !== '这个概念性总结语'));
  }
  return [...new Set(terms)].sort((a, b) => b.length - a.length);
}

function redactPublic(value, terms) {
  if (typeof value === 'string') {
    return terms.reduce((result, term) => result.replaceAll(term, '[待学生探索]'), value);
  }
  if (Array.isArray(value)) return value.map((item) => redactPublic(item, terms));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactPublic(item, terms)]));
  }
  return value;
}

function sanitizeTool(tool) {
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
function sanitizeTaskTools(task) {
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

for (const lessonId of lessonIds) {
  const sourceDirectory = resolve(lessonsRoot, lessonId);
  const publicDirectory = resolve(publicLessonsRoot, lessonId);
  const assetDirectory = resolve(sourceDirectory, 'assets');

  await rm(publicDirectory, { recursive: true, force: true });
  await mkdir(publicDirectory, { recursive: true });
  const publicAssetDirectory = resolve(publicDirectory, 'assets');
  try {
    await cp(assetDirectory, publicAssetDirectory, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(publicAssetDirectory, { recursive: true });
  }

  const source = {
    id: lessonId,
    files: await collectMarkdown(sourceDirectory),
    assetBase: `lessons/${lessonId}/assets`,
  };
  const lesson = parseLesson(source, {
    platformDefaults,
    onWarning: (warning) => console.warn(`[${lessonId}] ${warning.message}`),
  });

  // 浏览器只接收渲染所需的公开字段。真值、知识、限制和答案留在服务端课程包。
  lesson.roles.forEach((role) => {
    delete role.keyData;
    role.tasks.forEach((task) => {
      delete task.guide;
      sanitizeTaskTools(task);
    });
  });
  lesson.timeBank.tasks.forEach((task) => {
    task.requiresText = task.verify === 'image_and_text';
    delete task.answer;
    delete task.verify;
    delete task.location;
    delete task.radius;
  });
  publicLessons[lessonId] = redactPublic(lesson, protectedTerms(source.files['restrictions.md']));
}

await mkdir(dirname(generatedFile), { recursive: true });
await writeFile(
  generatedFile,
  `// 此文件由 scripts/sync-lessons.mjs 自动生成，只包含学生端公开课程字段。\nexport default ${JSON.stringify(publicLessons, null, 2)};\n`,
  'utf8',
);

console.log(`已同步 ${lessonIds.length} 门课程：${lessonIds.join(', ')}`);
