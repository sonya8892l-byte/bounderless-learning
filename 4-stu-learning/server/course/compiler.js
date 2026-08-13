import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseLesson } from '../../src/engine/lesson-parser.js';
import { compilePlatformRules } from './platform-rules.js';
import {
  loadPlatformDefaults,
  resolveCompanion,
  resolveLanguageLevels,
  resolveLogistics,
  resolveScaffolding,
} from './platform-defaults.js';
import { courseOverrideSection } from '../../src/engine/platform-defaults.js';
import { assertVoiceHasNoSpoiler, resolveVoice } from './voice.js';
import { parseRestrictionDocument } from './restriction-sections.js';
import { buildTaskGraph } from './task-graph.js';
import { compilePhasePolicy } from './phase-policy.js';
import {
  restrictionProtectedMatchers,
  restrictionProtectedTerms,
} from './projections.js';

export {
  parseRestrictionDocument,
  resolveRestrictionReferences,
  resolveStepRestrictions,
} from './restriction-sections.js';
export { compilePlatformRules } from './platform-rules.js';
export { toPublic } from './projections.js';
export { buildTaskGraph, nodeKey, traversalOrder } from './task-graph.js';

const CACHE = new Map();

/**
 * 课程 md 的内容指纹。按文件名排序后逐个喂 hash，保证与磁盘遍历顺序无关。
 * 与 platform-defaults.js / platform-rules.js 的 versionFor 同一套写法。
 */
function courseVersionFor(files) {
  const hash = createHash('sha256');
  for (const filename of Object.keys(files).sort()) {
    hash.update(filename);
    hash.update('\0');
    hash.update(files[filename] ?? '\u0000missing');
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function clean(value = '') {
  const result = String(value).trim();
  const pair = [["'", "'"], ['"', '"'], ['“', '”']]
    .find(([open, close]) => result.length >= 2 && result.startsWith(open) && result.endsWith(close));
  return pair ? result.slice(1, -1).trim() : result;
}

const OVERRIDE_SECTION_BY_PLATFORM_FILE = Object.freeze({
  'defaults.md': '数值默认',
  'tool-defaults.md': '工具默认',
  'companion.md': '人设侧重',
  'voice.md': '话术覆盖',
  'scaffolding.md': '脚手架',
  'logistics.md': '组织信息',
});

function compilerWarningCode(warning = {}) {
  if (warning.code) return String(warning.code);
  const message = String(warning.message || '');
  if (message.includes('锁定')) return 'platform_locked_override';
  if (message.includes('不可覆盖')) return 'platform_immutable_override';
  return 'compiler_warning';
}

/**
 * 编译告警是发布门禁的输入，不是 debug 字符串。每条都必须保留稳定 code、
 * 课程源文件 source 和字段 field。`file` 可以继续指向被覆盖的平台文档，
 * 但 lint 定位必须以 source（例如 course.md）为准。
 */
function structuredCompilerWarning(warning = {}, context = {}) {
  const source = String(context.source || warning.source || warning.file || 'course.md');
  const section = String(context.field || OVERRIDE_SECTION_BY_PLATFORM_FILE[warning.file] || '');
  const field = String(
    warning.field
      || (warning.key && section ? `${section}.${warning.key}` : '')
      || section
      || '编译配置',
  );
  return {
    ...warning,
    level: warning.level === 'error' ? 'error' : 'warning',
    code: compilerWarningCode(warning),
    source,
    field,
  };
}

function parserWarningContext(warning = {}, files = {}) {
  if (warning.code === 'bad_phase_task_executor') {
    return { source: 'phases.md', field: '执行单位' };
  }
  if (warning.file && OVERRIDE_SECTION_BY_PLATFORM_FILE[warning.file]) {
    return { source: 'course.md', field: OVERRIDE_SECTION_BY_PLATFORM_FILE[warning.file] };
  }
  if (warning.taskId) {
    const field = String(warning.field || 'id');
    const value = String(warning.value || '');
    const fieldPattern = new RegExp(`^-\\s*${field.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}[\\s　]*[：:]`, 'm');
    for (const [filename, markdown] of Object.entries(files)) {
      if (filename !== 'phases.md' && !filename.startsWith('roles/')) continue;
      if (!fieldPattern.test(markdown)) continue;
      if (value && !String(markdown).includes(value)) continue;
      return { source: filename, field };
    }
  }
  return {
    source: 'course.md',
    field: String(warning.field || OVERRIDE_SECTION_BY_PLATFORM_FILE[warning.file] || '编译配置'),
  };
}

async function collectMarkdown(directory, base = directory, result = {}) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.resolve(directory, entry.name);
    if (entry.isDirectory()) await collectMarkdown(fullPath, base, result);
    else if (entry.name.endsWith('.md')) {
      result[path.relative(base, fullPath).replaceAll('\\', '/')] = await fs.readFile(fullPath, 'utf8');
    }
  }
  return result;
}

function parseEntryFields(block) {
  const fields = {};
  for (const match of block.matchAll(/^[-*]\s*([^：:\n]+)[：:]\s*(.+)$/gm)) {
    fields[clean(match[1])] = clean(match[2]);
  }
  return fields;
}

function parseKnowledge(files) {
  const entries = [];
  for (const [filename, markdown] of Object.entries(files)) {
    if (!filename.startsWith('knowledge/')) continue;
    const headings = [...markdown.matchAll(/^##\s+(K-\d+)\s+(.+)$/gm)];
    headings.forEach((heading, index) => {
      const block = markdown.slice(heading.index, headings[index + 1]?.index ?? markdown.length);
      const fields = parseEntryFields(block);
      entries.push({
        id: heading[1],
        title: clean(heading[2]),
        topic: fields.topic || clean(heading[2]),
        content: fields.content || '',
        tags: (fields.tags || '').split(/[,，]/).map(clean).filter(Boolean),
        source: fields.source || '课程知识库',
        roles: (fields.roles || '全角色共享').split(/[,，]/).map(clean).filter(Boolean),
        revealWhen: fields.revealWhen || fields.revealTiming || 'always',
      });
    });
  }
  return entries;
}

function parseRestrictionRows(markdown = '') {
  const rows = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map(clean);
    if (cells.length !== 4 || cells[0] === '限制项') continue;
    const protectedTerms = restrictionProtectedTerms(cells[0], cells[1]);
    rows.push({
      id: `restriction-${rows.length + 1}`,
      name: cells[0],
      protectedContent: cells[1],
      reason: cells[2],
      unlockWhen: cells[3],
      protectedTerms,
      protectedMatchers: restrictionProtectedMatchers(cells[0], cells[1], protectedTerms),
    });
  }
  return rows;
}

function taskSection(markdown = '', taskIndex, headingLevel = '##') {
  const regex = new RegExp(`^${headingLevel.replaceAll('#', '\\#')}#?\\s*(?:任务|角色阶段)${taskIndex + 1}[：:].*$`, 'gm');
  const match = regex.exec(markdown);
  if (!match) return '';
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(new RegExp(`\\n${headingLevel.replaceAll('#', '\\#')}#?\\s*(?:任务|角色阶段)\\d+[：:]`));
  return `${match[0]}${next === -1 ? rest : rest.slice(0, next)}`.trim();
}

function minimumFrom(text, fallback = 1) {
  const value = Number.parseInt(String(text).match(/(?:最少|至少|≥)\s*(\d+)/)?.[1], 10);
  return Number.isFinite(value) ? value : fallback;
}

function configuredTools(task) {
  const taskTools = task.tools || [];
  const stepTools = (task.steps || []).flatMap((step) => step.tools || []);
  const tools = [...taskTools, ...stepTools];
  return tools.filter((tool, index) => tools.findIndex((candidate) => candidate.id === tool.id) === index);
}

function publicTool(tool) {
  const result = structuredClone(tool);
  for (const key of ['answer', 'answers', 'expectedResults', 'correctMapping', 'validConnections', 'explanation', 'retryMessage', 'evaluationPrompt']) {
    delete result.config?.[key];
  }
  if (Array.isArray(result.config?.choices)) {
    result.config.choices = result.config.choices.map(({ score, correct, ...choice }) => choice);
  }
  return result;
}

function publicStep(step) {
  return {
    id: step.id,
    title: step.title,
    objective: step.objective,
    studentAction: step.studentAction,
    completionMode: step.completionMode,
    evidenceRequirement: step.evidenceRequirement,
    location: step.location,
    modules: step.modules,
    next: step.next,
    tools: (step.tools || []).map(publicTool),
  };
}

function buildToolInstances(role) {
  return role.tasks.map((task, taskIndex) => {
    const tools = configuredTools(task);
    const photo = tools.find((tool) => tool.id === 'photo');
    const minEvidenceCount = photo
      ? Math.max(
        Number(photo.config?.minCount || 1),
        minimumFrom(task.passCondition, 0),
        minimumFrom(task.requirement, 0),
      )
      : 0;
    return {
      id: `${role.id}:${task.id}:primary`,
      roleId: role.id,
      taskId: task.id,
      roleStageId: task.roleStageId || task.id,
      taskIndex,
      renderer: 'activity',
      primaryRenderer: task.toolType,
      title: task.name,
      instructions: task.requirement,
      modules: task.modules,
      publicConfig: {
        tools: tools.map(publicTool),
        minEvidenceCount,
        placeholder: task.toolType === 'sketch' ? '描述你的示意图结构或绘制思路…' : '记录你看到的现象、数据或判断…',
        image: task.image,
        location: task.location,
        timing: task.timing,
        nudgePolicy: task.nudgePolicy,
        advanceMode: task.advanceMode,
        completionMode: task.completionMode || 'tool_result',
        evidenceRequirement: task.evidenceRequirement || task.passCondition,
        steps: (task.steps || []).map(publicStep),
      },
      validation: {
        passCondition: task.passCondition,
        minEvidenceCount,
        requiredToolIds: tools.map((tool) => tool.id),
        tools,
        steps: task.steps || [],
        completionMode: task.completionMode || 'tool_result',
      },
    };
  });
}

export async function compileCourse({ lessonsRoot, courseId }) {
  const resolvedLessonsRoot = path.resolve(lessonsRoot);
  const cacheKey = `${resolvedLessonsRoot}\0${courseId}`;
  const platformRules = await compilePlatformRules({ lessonsRoot: resolvedLessonsRoot });
  const platformDefaults = await loadPlatformDefaults({ lessonsRoot: resolvedLessonsRoot });
  const directory = path.resolve(resolvedLessonsRoot, courseId);
  const files = await collectMarkdown(directory);
  if (!files['course.md']) throw new Error(`课程 ${courseId} 缺少 course.md`);

  // 缓存按内容失效：课程 md ＋ 平台包三者任一变化就重编译，改 md 不必重启。
  // 读文件本身很便宜（几十个 md），真正贵的是下面的解析与装配。
  const courseVersion = courseVersionFor(files);
  const cached = CACHE.get(cacheKey);
  if (cached?.platformRules?.version === platformRules.version
    && cached?.platformDefaults?.version === platformDefaults.version
    && cached?.courseVersion === courseVersion) return cached;

  const defaultWarnings = [];
  const parserWarnings = [];
  // 全量解析产物。含 keyData／guide／就地验收标准／能力标签与时间银行答案——
  // 服务端要用（时间银行判分读 task.answer/verify/radius），下发浏览器前必须过 toPublic。
  const lesson = parseLesson({
    id: courseId,
    files,
    assetBase: `lessons/${courseId}/assets`,
  }, { platformDefaults, onWarning: (warning) => parserWarnings.push(warning) });
  defaultWarnings.push(...parserWarnings.map((warning) => structuredCompilerWarning(
    warning,
    parserWarningContext(warning, files),
  )));
  const roleFiles = Object.fromEntries(
    Object.entries(files).filter(([filename]) => filename.startsWith('roles/')),
  );
  const guidanceFiles = Object.fromEntries(
    Object.entries(files).filter(([filename]) => filename.startsWith('guidance/')),
  );
  const scaffoldFiles = Object.fromEntries(
    Object.entries(files).filter(([filename]) => filename.startsWith('scaffolds/')),
  );

  const roles = lesson.roles.map((role) => {
    // v2 就地内容优先；旧布局（guidance/、scaffolds/ 独立目录）作为兼容期回退。
    const guidance = guidanceFiles[`guidance/${role.id}.md`] || '';
    const scaffold = scaffoldFiles[`scaffolds/${role.id}.md`] || '';
    return {
      ...role,
      tools: buildToolInstances(role),
      tasks: role.tasks.map((task, taskIndex) => ({
        ...task,
        guidance: task.inlineGuidance || taskSection(guidance, taskIndex, '##') || task.guide,
        scaffold: task.inlineScaffold || taskSection(scaffold, taskIndex, '##'),
        acceptance: task.inlineAcceptance || '',
      })),
      sourceMarkdown: roleFiles[`roles/${role.id}.md`] || '',
    };
  });

  // 阶段任务也要经过与角色任务相同的工具实例装配，服务端才能把它们当成一条
  // 真正可执行的任务轨道。它只留在私有 Course 对象里，公开课程包仍由 toPublic 裁剪。
  const phaseTracks = Object.fromEntries((lesson.phases || []).map((phase) => {
    const track = {
      id: phase.id,
      scope: 'phase',
      phaseId: phase.id,
      name: phase.name || '课程导入',
      location: phase.location || lesson.venue || '',
      geofence: '',
      tasks: (phase.tasks || []).map((task) => ({
        ...task,
        guidance: task.inlineGuidance || task.guide || '',
        scaffold: task.inlineScaffold || '',
        acceptance: task.inlineAcceptance || '',
      })),
    };
    track.tools = buildToolInstances(track);
    return [phase.id, track];
  }));

  const phasePrompts = Object.fromEntries(
    Object.entries(files)
      .filter(([filename]) => /^prompts\/phase\d+-.+\.md$/.test(filename))
      .map(([filename, markdown]) => [
        `phase-${filename.match(/phase(\d+)/)?.[1]}`,
        markdown,
      ]),
  );
  const phasePolicies = Object.fromEntries(Object.entries(phasePrompts).map(([phaseId, markdown]) => {
    const filename = Object.keys(files).find((name) => (
      /^prompts\/phase\d+-.+\.md$/.test(name)
      && `phase-${name.match(/phase(\d+)/)?.[1]}` === phaseId
    )) || '';
    const policy = compilePhasePolicy(markdown, { file: filename });
    defaultWarnings.push(...policy.warnings.map((warning) => structuredCompilerWarning(warning, {
      source: filename,
      field: 'Phase Prompt',
    })));
    return [phaseId, policy];
  }));

  // 人设侧重是课程私有配置：只在服务端 Prompt 里生效，不经过 parseLesson，因此不会进公开包。
  const { 侧重: sectionEmphasis = '', ...companionOverrides } = courseOverrideSection(files['course.md'], '人设侧重');
  const companion = resolveCompanion(
    platformDefaults.documents.companion,
    companionOverrides,
    sectionEmphasis || courseOverrideSection(files['course.md'], '基本信息')['人设侧重'] || '',
  );
  defaultWarnings.push(...companion.warnings.map((warning) => structuredCompilerWarning(warning, {
    source: 'course.md',
    field: '人设侧重',
  })));

  const voice = resolveVoice(
    platformDefaults.documents.voice,
    courseOverrideSection(files['course.md'], '话术覆盖'),
  );
  defaultWarnings.push(...voice.warnings.map((warning) => structuredCompilerWarning(warning, {
    source: 'course.md',
    field: '话术覆盖',
  })));

  const scaffolding = resolveScaffolding(
    platformDefaults.documents.scaffolding,
    courseOverrideSection(files['course.md'], '脚手架'),
  );
  defaultWarnings.push(...scaffolding.warnings.map((warning) => structuredCompilerWarning(warning, {
    source: 'course.md',
    field: '脚手架',
  })));

  const logistics = resolveLogistics(
    platformDefaults.documents.logistics,
    courseOverrideSection(files['course.md'], '组织信息'),
  );
  defaultWarnings.push(...logistics.warnings.map((warning) => structuredCompilerWarning(warning, {
    source: 'course.md',
    field: '组织信息',
  })));

  // 任务图：角色任务运行时由 task-advance.js 读取拓扑顺序与前置门禁。
  // 阶段任务（非角色任务）一并进图做编译检查，但不带 roleId，所以不进角色遍历。
  const taskGraph = buildTaskGraph(roles, lesson.phases);
  defaultWarnings.push(...taskGraph.warnings.map((warning) => structuredCompilerWarning(warning)));

  const restrictionMarkdown = files['restrictions.md'] || '';
  const restrictions = parseRestrictionRows(restrictionMarkdown);
  assertVoiceHasNoSpoiler(voice.voice, restrictions.flatMap((rule) => rule.protectedTerms || []));

  // 课程内容 ＋ 平台包的联合指纹。会话记录下它就能追溯"当时那一版内容"。
  const contentVersion = `sha256:${createHash('sha256')
    .update(courseVersion).update('\0')
    .update(platformRules.version).update('\0')
    .update(platformDefaults.version)
    .digest('hex')}`;

  const course = {
    id: courseId,
    schemaVersion: 1,
    courseVersion,
    contentVersion,
    platformRules,
    lesson,
    platformDefaults: {
      version: platformDefaults.version,
      missing: platformDefaults.missing,
      warnings: defaultWarnings,
      languageLevels: resolveLanguageLevels(
        platformDefaults.documents.languageLevels,
        courseOverrideSection(files['course.md'], '学段规范'),
      ),
      companion: companion.companion,
      voice: voice.voice,
      scaffolding: scaffolding.scaffolding,
      logistics: logistics.logistics,
    },
    roles,
    phaseTracks,
    taskGraph,
    knowledge: parseKnowledge(files),
    restrictions,
    restrictionMarkdown,
    restrictionDocument: parseRestrictionDocument(restrictionMarkdown),
    phasePrompts,
    phasePolicies,
    evaluation: files['evaluation.md'] || '',
    files,
  };
  CACHE.set(cacheKey, course);
  return course;
}

export function clearCourseCache() {
  CACHE.clear();
}
