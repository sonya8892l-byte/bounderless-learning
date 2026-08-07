import fs from 'node:fs/promises';
import path from 'node:path';
import { parseLesson } from '../../src/engine/lesson-parser.js';
import { compilePlatformRules } from './platform-rules.js';
import { loadPlatformDefaults, resolveCompanion, resolveLanguageLevels } from './platform-defaults.js';
import { courseOverrideSection } from '../../src/engine/platform-defaults.js';
import { assertVoiceHasNoSpoiler, resolveVoice } from './voice.js';
import { parseRestrictionDocument } from './restriction-sections.js';

export {
  parseRestrictionDocument,
  resolveRestrictionReferences,
  resolveStepRestrictions,
} from './restriction-sections.js';
export { compilePlatformRules } from './platform-rules.js';

const CACHE = new Map();

function clean(value = '') {
  const result = String(value).trim();
  const pair = [["'", "'"], ['"', '"'], ['“', '”']]
    .find(([open, close]) => result.length >= 2 && result.startsWith(open) && result.endsWith(close));
  return pair ? result.slice(1, -1).trim() : result;
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
    const numericTerms = [...cells[1].matchAll(/\d{4}年(?:\d{1,2}月(?:\d{1,2}(?:日至\d{1,2})?日?)?)?|\d+(?:\.\d+)?(?:%|万?m³|米)|\d{3,}/g)].map((match) => match[0]);
    const quotedTerms = [...`${cells[0]} ${cells[1]}`.matchAll(/["“”']([^"“”']{2,})["“”']/g)].map((match) => match[1]);
    const phraseTerms = cells[1]
      .split(/[、，；和的]/)
      .map(clean)
      .filter((value) => value.length >= 4 && !/这个概念性总结语/.test(value));
    rows.push({
      id: `restriction-${rows.length + 1}`,
      name: cells[0],
      protectedContent: cells[1],
      reason: cells[2],
      unlockWhen: cells[3],
      protectedTerms: [...new Set([...numericTerms, ...quotedTerms, ...phraseTerms])],
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
  const cached = CACHE.get(cacheKey);
  if (cached?.platformRules?.version === platformRules.version
    && cached?.platformDefaults?.version === platformDefaults.version) return cached;
  const directory = path.resolve(resolvedLessonsRoot, courseId);
  const files = await collectMarkdown(directory);
  if (!files['course.md']) throw new Error(`课程 ${courseId} 缺少 course.md`);

  const defaultWarnings = [];
  const publicLesson = parseLesson({
    id: courseId,
    files,
    assetBase: `lessons/${courseId}/assets`,
  }, { platformDefaults, onWarning: (warning) => defaultWarnings.push(warning) });
  const roleFiles = Object.fromEntries(
    Object.entries(files).filter(([filename]) => filename.startsWith('roles/')),
  );
  const guidanceFiles = Object.fromEntries(
    Object.entries(files).filter(([filename]) => filename.startsWith('guidance/')),
  );
  const scaffoldFiles = Object.fromEntries(
    Object.entries(files).filter(([filename]) => filename.startsWith('scaffolds/')),
  );

  const roles = publicLesson.roles.map((role) => {
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

  const phasePrompts = Object.fromEntries(
    Object.entries(files)
      .filter(([filename]) => /^prompts\/phase\d+-.+\.md$/.test(filename))
      .map(([filename, markdown]) => [
        `phase-${filename.match(/phase(\d+)/)?.[1]}`,
        markdown,
      ]),
  );

  // 人设侧重是课程私有配置：只在服务端 Prompt 里生效，不经过 parseLesson，因此不会进公开包。
  const { 侧重: sectionEmphasis = '', ...companionOverrides } = courseOverrideSection(files['course.md'], '人设侧重');
  const companion = resolveCompanion(
    platformDefaults.documents.companion,
    companionOverrides,
    sectionEmphasis || courseOverrideSection(files['course.md'], '基本信息')['人设侧重'] || '',
  );
  defaultWarnings.push(...companion.warnings);

  const voice = resolveVoice(
    platformDefaults.documents.voice,
    courseOverrideSection(files['course.md'], '话术覆盖'),
  );
  defaultWarnings.push(...voice.warnings);

  const restrictionMarkdown = files['restrictions.md'] || '';
  const restrictions = parseRestrictionRows(restrictionMarkdown);
  assertVoiceHasNoSpoiler(voice.voice, restrictions.flatMap((rule) => rule.protectedTerms || []));

  const course = {
    id: courseId,
    platformRules,
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
    },
    publicLesson,
    roles,
    knowledge: parseKnowledge(files),
    restrictions,
    restrictionMarkdown,
    restrictionDocument: parseRestrictionDocument(restrictionMarkdown),
    phasePrompts,
    evaluation: files['evaluation.md'] || '',
    files,
  };
  CACHE.set(cacheKey, course);
  return course;
}

export function clearCourseCache() {
  CACHE.clear();
}
