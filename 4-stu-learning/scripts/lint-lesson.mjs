/**
 * 课程包静态校验（lintLesson）。
 *
 * 只读调用 compileCourse / restriction-sections / parseNextRef，不改编译器。
 * 输出 file:line；有 error → exit 1；仅 warning → exit 0；`--strict` 时 warning 也失败。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { auditCourseQuality } from '../server/course/course-quality-audit.js';
import {
  resolveStepRestrictions,
  restrictionReferenceTitles,
} from '../server/course/restriction-sections.js';
import { PHASE_TASK_EXECUTORS } from '../src/engine/lesson-parser.js';
import { isPosterOnlyMedia } from '../src/engine/tool-registry.js';

const COMPETENCY_PREFIX = /^(CC|CQ|DK|DS|DC)(-|$)/;
const ASSET_PATH_RE = /lessons\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|svg|mp3|mp4)/gi;
const ACTIVITY_MODULES = new Set(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07']);

/**
 * 与 task-graph.parseNextRef 同语义的本地副本。
 * 主体的 task-graph.js 可能尚未入库；C1 不依赖未跟踪文件。
 */
function parseNextRef(value = '') {
  const text = String(value || '').trim();
  if (!text) return { kind: 'none', target: '' };
  const separator = text.indexOf(':');
  if (separator === -1) return { kind: 'unknown', target: text };
  const kind = text.slice(0, separator).trim();
  const target = text.slice(separator + 1).trim();
  if (kind === 'step') return { kind: 'step', target };
  if (kind === 'role-stage' || kind === 'role') {
    return target === 'complete'
      ? { kind: 'complete', target: '' }
      : { kind: 'task', target };
  }
  return { kind: 'unknown', target };
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultLessonsRoot = path.resolve(projectRoot, '../6-lessons');

function splitKnowledgeRefs(value = '') {
  return String(value || '')
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitPrerequisites(value = '') {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function requiresTeacherIntervention(step = {}) {
  return String(step.teacherIntervention || '').trim() === '必须';
}

function isEmptyFailureHandling(value = '') {
  const text = String(value || '').trim();
  return !text || text === '无';
}

function buildTaskScopeIndexes(course = {}) {
  const roleTasks = new Map();
  const phaseTasks = new Map();
  for (const role of course.roles || []) {
    roleTasks.set(role.id, new Set((role.tasks || []).map((task) => task.id)));
  }
  for (const phase of course.lesson?.phases || []) {
    phaseTasks.set(phase.id, new Set((phase.tasks || []).map((task) => task.id)));
  }
  return { roleTasks, phaseTasks };
}

function findStepLine(sourceMarkdown = '', stepId = '') {
  if (!stepId) return 1;
  const lines = String(sourceMarkdown).split(/\n/);
  const patterns = [
    new RegExp(`^\\s*-\\s*id\\s*：\\s*${escapeRegExp(stepId)}\\s*$`),
    new RegExp(`^\\s*-\\s*id\\s*:\\s*${escapeRegExp(stepId)}\\s*$`),
  ];
  for (let index = 0; index < lines.length; index += 1) {
    if (patterns.some((pattern) => pattern.test(lines[index]))) return index + 1;
  }
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes(stepId) && /id\s*[:：]/.test(lines[index])) return index + 1;
  }
  return 1;
}

function findAssetLine(sourceMarkdown = '', assetPath = '') {
  const basename = path.basename(assetPath);
  if (!basename) return 1;
  const lines = String(sourceMarkdown).split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].includes(basename) || lines[index].includes(assetPath)) return index + 1;
  }
  return 1;
}

function relativeCourseSource(courseId, source = '') {
  const normalized = String(source || '').replaceAll('\\', '/').replace(/^\.\//, '');
  const prefix = `6-lessons/${courseId}/`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

/**
 * 编译 warning 的 source/field/code 是稳定契约；行号尽量从原文反查。
 * 优先用 key/target 找精确值，其次用 Step/Task id，最后才回落到字段名。
 */
function findCompilerWarningLine(course, warning = {}, courseId = '') {
  if (Number(warning.line) > 0) return Number(warning.line);
  const relativeSource = relativeCourseSource(courseId, warning.source || warning.file || 'course.md');
  const markdown = String(course?.files?.[relativeSource] || '');
  if (!markdown) return 1;
  const lines = markdown.split('\n');
  const exactId = warning.stepId || warning.taskId || '';
  const valueNeedles = [warning.key, warning.target, warning.value]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  for (const needle of valueNeedles) {
    const index = lines.findIndex((line) => line.includes(needle));
    if (index >= 0) return index + 1;
  }
  if (exactId) {
    const idPattern = new RegExp(`^\\s*-\\s*id\\s*[：:]\\s*${escapeRegExp(exactId)}\\s*$`);
    const index = lines.findIndex((line) => idPattern.test(line));
    if (index >= 0) return index + 1;
  }
  const field = String(warning.field || '').split('.').at(-1).trim();
  if (field) {
    const fieldPattern = new RegExp(`^\\s*-\\s*${escapeRegExp(field)}\\s*[：:]`);
    const index = lines.findIndex((line) => fieldPattern.test(line));
    if (index >= 0) return index + 1;
  }
  return 1;
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roleFilePath(courseId, roleId) {
  return `6-lessons/${courseId}/roles/${roleId}.md`;
}

function phasesFilePath(courseId, course = null) {
  const source = course?.documentSources?.['phases.md']?.sourceFile || 'phases.md';
  return `6-lessons/${courseId}/${source}`;
}

/**
 * 阶段任务在 phases.md 里的行号。
 *
 * 阶段任务没有 sourceMarkdown（它不像角色那样一文件一角色），所以定位方式与
 * findStepLine 不同：先锚到 `### 阶段任务N：<名字>` 那一行，再在本块内往下找字段行。
 * 找不到字段就退回标题行——报在标题上仍然可用，报在第 1 行就没用了。
 */
function findPhaseTaskLine(markdown = '', task = {}, field = '') {
  const lines = String(markdown).split(/\n/);
  const idPattern = task.id ? new RegExp(`^\\s*-\\s*id\\s*[：:]\\s*${escapeRegExp(task.id)}\\s*$`, 'i') : null;
  const namePattern = task.name
    ? new RegExp(`^###\\s*阶段任务\\d+\\s*[：:]\\s*.*${escapeRegExp(task.name)}`)
    : null;

  let heading = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (namePattern?.test(lines[index])) { heading = index; break; }
    // 没写名字或名字被改过时，用 `- id：` 反查，再往上回退到它所属的标题。
    if (heading === -1 && idPattern?.test(lines[index])) {
      for (let back = index; back >= 0; back -= 1) {
        if (/^###\s*阶段任务\d+\s*[：:]/.test(lines[back])) { heading = back; break; }
      }
      if (heading !== -1) break;
    }
  }
  if (heading === -1) return 1;
  if (!field) return heading + 1;

  const fieldPattern = new RegExp(`^\\s*-\\s*${escapeRegExp(field)}\\s*[：:]`);
  for (let index = heading + 1; index < lines.length; index += 1) {
    if (/^#{1,4}\s/.test(lines[index])) break;
    if (fieldPattern.test(lines[index])) return index + 1;
  }
  return heading + 1;
}

function findPhaseTaskHeadingLines(markdown = '') {
  const lines = String(markdown).split(/\n/);
  const found = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^###\s*阶段任务\d+\s*[：:]/.test(lines[index])) found.push({ line: index + 1, text: lines[index].trim() });
  }
  return found;
}

/**
 * time-bank.md 里某个任务的字段行：先锚 `- id: <taskId>`，再在同一块内往下找字段。
 * 与 findPhaseTaskLine 同思路；找不到就报在 id 行上，不退回第 1 行。
 */
function findTimeBankTaskLine(markdown = '', taskId = '', field = '') {
  const lines = String(markdown || '').split('\n');
  const idPattern = taskId ? new RegExp(`^\\s*-\\s*id\\s*[：:]\\s*${escapeRegExp(taskId)}\\s*$`) : null;
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (idPattern?.test(lines[index])) { start = index; break; }
  }
  if (start === -1) return 1;
  if (!field) return start + 1;
  const fieldPattern = new RegExp(`^\\s*${escapeRegExp(field)}\\s*[：:]`);
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*-\s*id\s*[：:]/.test(lines[index])) break;
    if (fieldPattern.test(lines[index])) return index + 1;
  }
  return start + 1;
}

/**
 * 直接读取 phases.md 的阶段任务执行单位。
 *
 * parser 会把非法值归一为「全班」并只留下 warning；如果 lint 只看编译结果，
 * 作者原来写的「全组」等值会失去证据，随后静默按全班执行。
 */
function findInvalidPhaseTaskExecutors(markdown = '') {
  const lines = String(markdown || '').split('\n');
  const invalid = [];
  let inPhaseTask = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^###\s*阶段任务\d+\s*[：:]/.test(line)) {
      inPhaseTask = true;
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) inPhaseTask = false;
    if (!inPhaseTask) continue;
    const match = line.match(/^\s*-\s*执行单位\s*[：:]\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[1].trim();
    if (!PHASE_TASK_EXECUTORS.includes(value)) invalid.push({ line: index + 1, value });
  }
  return invalid;
}

/**
 * 原始 Markdown 的活动模块与工具参数门禁。
 *
 * tool-registry 只识别 A01–A07；未知模块目前会被静默丢弃，若整行都无法识别还会
 * 回落成一个文字工具。`teacher_confirm` 是 Step 完成方式，不是活动工具参数。
 */
function findUnsupportedToolDeclarations(files = {}) {
  const found = [];
  for (const [relativeFile, markdown] of Object.entries(files)) {
    const lines = String(markdown || '').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*-\s*功能模块\s*[：:]/.test(line)) {
        for (const match of line.matchAll(/\bA\d{2}\b/gi)) {
          const module = match[0].toUpperCase();
          if (!ACTIVITY_MODULES.has(module)) {
            found.push({
              code: 'unknown_activity_module',
              line: index + 1,
              relativeFile,
              value: module,
            });
          }
        }
      }
      if (/^\s*-\s*工具参数\s*[：:]/.test(line) && /["']teacher_confirm["']\s*:/.test(line)) {
        found.push({
          code: 'unsupported_tool_parameter',
          line: index + 1,
          relativeFile,
          value: 'teacher_confirm',
        });
      }
    }
  }
  return found;
}

function collectAssetPaths(value, bucket = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(ASSET_PATH_RE)) bucket.add(match[0]);
    return bucket;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetPaths(item, bucket);
    return bucket;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAssetPaths(item, bucket);
  }
  return bucket;
}

function resolveAssetFsPath(lessonsRoot, assetPath) {
  const normalized = String(assetPath).replace(/^\/+/, '');
  const parts = normalized.split('/');
  if (parts[0] !== 'lessons' || parts.length < 3) return '';
  const courseId = parts[1];
  return path.join(lessonsRoot, courseId, ...parts.slice(2));
}

/**
 * 校验一门已编译课程。可注入假 course 做负例测试。
 * @returns {{ issues: Array, stats: object }}
 */
export function lintCourse(course, options = {}) {
  const lessonsRoot = options.lessonsRoot || defaultLessonsRoot;
  const courseId = options.courseId || course?.id || 'unknown';
  const issues = [];
  const stats = {
    knowledgeRefs: 0,
    deadKnowledgeRefs: 0,
    restrictionRefs: 0,
    deadRestrictionRefs: 0,
    assetRefs: 0,
    missingAssets: 0,
    missingMediaSources: 0,
    competencyTags: 0,
    badCompetencyTags: 0,
    missingAcceptance: 0,
    nextEdges: 0,
    badNextEdges: 0,
    phaseTasks: 0,
    badExecutors: 0,
    misplacedPhaseTasks: 0,
    teacherInterventionMismatches: 0,
    emptyFailureHandling: 0,
    crossScopePrerequisites: 0,
    unsupportedTraversalModes: 0,
    compilerWarnings: 0,
    unknownActivityModules: 0,
    unsupportedToolParameters: 0,
    timeBankUnlocks: 0,
    badUnlockAfter: 0,
    qualityIssues: 0,
  };

  const knowledgeIds = new Set((course?.knowledge || []).map((item) => item.id));
  const scopeIndexes = buildTaskScopeIndexes(course);

  const phasesMarkdown = course?.files?.['phases.md'] || '';

  const pushIssue = ({
    level,
    code,
    message,
    roleId = '',
    stepId = '',
    phaseTask = null,
    field = '',
    source = '',
    line,
    file,
  }) => {
    const role = (course?.roles || []).find((item) => item.id === roleId);
    // 阶段任务不属于任何角色，落点是 phases.md；角色任务落 roles/<id>.md。
    const resolvedFile = file
      || (phaseTask ? phasesFilePath(courseId, course) : '')
      || (roleId ? roleFilePath(courseId, roleId) : `6-lessons/${courseId}/course.md`);
    const resolvedLine = line
      || (phaseTask ? findPhaseTaskLine(phasesMarkdown, phaseTask, field) : 0)
      || (stepId && role ? findStepLine(role.sourceMarkdown, stepId) : 1);
    issues.push({
      level,
      code,
      message,
      file: resolvedFile,
      line: resolvedLine,
      courseId,
      roleId,
      stepId,
      phaseId: phaseTask?.phaseId || '',
      source: source || relativeCourseSource(courseId, resolvedFile),
      field,
    });
  };

  /**
   * 一个任务的全部检查。角色任务与阶段任务共用——两者的字段表本来就是同一套
   * （`parseTaskBlock`），检查写两遍必然会漂：给角色任务加了新规则而阶段任务漏掉。
   *
   * `where` 决定 issue 报到哪个文件哪一行：角色任务靠 roleId + stepId，
   * 阶段任务靠 phases.md 里的 `### 阶段任务N` 标题加字段名。
   */
  const checkTask = (task, where) => {
    const prereqs = splitPrerequisites(task.prerequisites);
    if (where.roleId && prereqs.length) {
      const allowed = scopeIndexes.roleTasks.get(where.roleId) || new Set();
      for (const prereq of prereqs) {
        if (allowed.has(prereq)) continue;
        stats.crossScopePrerequisites += 1;
        pushIssue({
          level: 'error',
          code: 'cross_scope_prerequisite',
          message: `前置「${prereq}」不在角色 ${where.roleId} 内（本轮只支持同作用域；跨角色/阶段任务等 R3 执行器）`,
          ...where,
          stepId: task.steps?.[0]?.id || '',
          field: '前置',
        });
      }
    }
    if (where.phaseTask && prereqs.length) {
      const allowed = scopeIndexes.phaseTasks.get(where.phaseTask.phaseId) || new Set();
      for (const prereq of prereqs) {
        if (allowed.has(prereq)) continue;
        stats.crossScopePrerequisites += 1;
        pushIssue({
          level: 'error',
          code: 'cross_scope_prerequisite',
          message: `前置「${prereq}」不在 Phase ${where.phaseTask.phaseId} 内（本轮只支持同 Phase 内阶段任务互相引用）`,
          ...where,
          field: '前置',
        });
      }
    }

    for (const tag of task.competencyTags || []) {
      stats.competencyTags += 1;
      if (!COMPETENCY_PREFIX.test(tag)) {
        stats.badCompetencyTags += 1;
        pushIssue({
          level: 'error',
          code: 'bad_competency_tag',
          message: `能力标签前缀非法：${tag}（允许 CC/CQ/DK/DS/DC）`,
          ...where,
          stepId: where.stepId || task.steps?.[0]?.id || '',
          field: '能力标签',
        });
      }
    }

    const mediaDeclarations = [
      ...(task.tools || []).map((tool) => ({ tool, stepId: '' })),
      ...(task.steps || []).flatMap((step) => (step.tools || []).map((tool) => ({
        tool,
        stepId: step.id || '',
      }))),
    ];
    const seenMedia = new Set();
    for (const { tool, stepId } of mediaDeclarations) {
      if (tool?.id !== 'media') continue;
      const type = String(tool.config?.type || '').trim().toLowerCase();
      if (!['video', 'audio', 'image'].includes(type)) continue;
      const source = String(tool.config?.url || '').trim();
      if (source || isPosterOnlyMedia(tool.config)) continue;
      const key = `${type}:${tool.config?.poster || ''}:${tool.config?.requireCompletion !== false}`;
      if (seenMedia.has(key)) continue;
      seenMedia.add(key);
      stats.missingMediaSources += 1;
      const required = tool.config?.requireCompletion !== false;
      pushIssue({
        level: required ? 'error' : 'warning',
        code: 'missing_media_source',
        message: `${type} 工具缺少可用 url${required ? '，且该任务要求完成媒体后推进' : ''}。视频若只需静态情境图，须同时配置非空 poster 与 posterOnly: true；其他情况须补充真实媒体源。`,
        ...where,
        stepId,
        field: '工具参数',
      });
    }

    for (const step of task.steps || []) {
        const refs = splitKnowledgeRefs(step.knowledgeRef);
        for (const ref of refs) {
          stats.knowledgeRefs += 1;
          if (!knowledgeIds.has(ref)) {
            stats.deadKnowledgeRefs += 1;
            pushIssue({
              level: 'error',
              code: 'dead_knowledge_ref',
              message: `知识引用不存在：${ref}`,
              ...where,
              stepId: step.id,
            });
          }
        }

        const titles = restrictionReferenceTitles(step.restrictionRef);
        const resolved = resolveStepRestrictions(course, step);
        const resolvedTitles = new Set(resolved.map((item) => item.title));
        for (const title of titles) {
          stats.restrictionRefs += 1;
          if (!resolvedTitles.has(title)) {
            stats.deadRestrictionRefs += 1;
            pushIssue({
              level: 'error',
              code: 'dead_restriction_ref',
              message: `限制引用无法解析：course.md#课程限制规则/${title}`,
              ...where,
              stepId: step.id,
            });
          }
        }

        for (const tag of step.competencyTags || []) {
          stats.competencyTags += 1;
          if (!COMPETENCY_PREFIX.test(tag)) {
            stats.badCompetencyTags += 1;
            pushIssue({
              level: 'error',
              code: 'bad_competency_tag',
              message: `能力标签前缀非法：${tag}（允许 CC/CQ/DK/DS/DC）`,
              ...where,
              stepId: step.id,
            });
          }
        }

        const acceptance = String(step.acceptance || step.inlineAcceptance || '').trim();
        if (!acceptance && 'title' in step) {
          stats.missingAcceptance += 1;
          pushIssue({
            level: 'warning',
            code: 'missing_acceptance',
            message: `Step ${step.id} 缺就地验收标准（##### 验收标准）`,
            ...where,
            stepId: step.id,
          });
        }

        const nextText = String(step.next || '').trim();
        if (nextText) {
          stats.nextEdges += 1;
          const parsed = parseNextRef(nextText);
          if (parsed.kind === 'unknown' || parsed.kind === 'none') {
            stats.badNextEdges += 1;
            pushIssue({
              level: 'error',
              code: 'bad_next_ref',
              message: `通过后目标无法解析：${nextText}`,
              ...where,
              stepId: step.id,
            });
          }
        }

        const needsTeacher = requiresTeacherIntervention(step);
        const isTeacherConfirm = step.completionMode === 'teacher_confirm';
        if (needsTeacher && !isTeacherConfirm) {
          stats.teacherInterventionMismatches += 1;
          pushIssue({
            level: 'error',
            code: 'teacher_intervention_mismatch',
            message: `Step ${step.id} 标了「教师介入：必须」但完成方式不是 teacher_confirm（当前：${step.completionMode || '未设置'}）`,
            ...where,
            stepId: step.id,
            field: '教师介入',
          });
        }
        if (isTeacherConfirm && !needsTeacher) {
          stats.teacherInterventionMismatches += 1;
          pushIssue({
            level: 'error',
            code: 'teacher_intervention_mismatch',
            message: `Step ${step.id} 完成方式为 teacher_confirm 但未标「教师介入：必须」`,
            ...where,
            stepId: step.id,
            field: '完成方式',
          });
        }

        const maxAttempts = Number(step.maxAttempts || 0);
        if (maxAttempts >= 1 && isEmptyFailureHandling(step.failureHandling)) {
          stats.emptyFailureHandling += 1;
          pushIssue({
            level: 'warning',
            code: 'empty_failure_handling',
            message: `Step ${step.id} 最大尝试 ${maxAttempts} 次但失败处理为空或「无」——重试用完后学生没有指引`,
            ...where,
            stepId: step.id,
            field: '失败处理',
          });
        }
    }
  };

  // 源码级门禁必须先于编译结果检查：非法值在 parser 中会回落成「全班」。
  for (const invalid of findInvalidPhaseTaskExecutors(phasesMarkdown)) {
    stats.badExecutors += 1;
    pushIssue({
      level: 'error',
      code: 'bad_executor',
      message: `执行单位非法：${invalid.value || '(空)'}（允许 ${PHASE_TASK_EXECUTORS.join(' / ')}）。修复：直接改阶段编排的原字段，不能依赖 parser 回落。`,
      file: phasesFilePath(courseId, course),
      line: invalid.line,
      field: '执行单位',
    });
  }

  for (const invalid of findUnsupportedToolDeclarations(course?.sourceFiles || course?.files || {})) {
    if (invalid.code === 'unknown_activity_module') stats.unknownActivityModules += 1;
    else stats.unsupportedToolParameters += 1;
    pushIssue({
      level: 'error',
      code: invalid.code,
      message: invalid.code === 'unknown_activity_module'
        ? `功能模块 ${invalid.value} 不受支持（只允许 A01–A07）。修复：改用已注册活动工具；教师确认请写「完成方式：teacher_confirm」。`
        : `工具参数 ${invalid.value} 没有活动工具消费者。修复：删除该参数；教师确认请写「完成方式：teacher_confirm」并配「教师介入：必须」。`,
      file: `6-lessons/${courseId}/${invalid.relativeFile}`,
      line: invalid.line,
      field: invalid.code === 'unknown_activity_module' ? '功能模块' : '工具参数',
    });
  }

  for (const role of course?.roles || []) {
    for (const task of role.tasks || []) checkTask(task, { roleId: role.id });
  }

  // 阶段任务（非角色任务）：走同一批检查，外加两条只对它成立的。
  for (const phase of course?.lesson?.phases || []) {
    for (const task of phase.tasks || []) {
      const where = { phaseTask: { id: task.id, name: task.name, phaseId: phase.id } };
      checkTask(task, where);

      stats.phaseTasks += 1;
      if (!PHASE_TASK_EXECUTORS.includes(task.executor)) {
        stats.badExecutors += 1;
        pushIssue({
          level: 'error',
          code: 'bad_executor',
          // 解析层遇到非法值会落回「全班」并告警，所以这里不是"跑不起来"，
          // 而是"跑起来了但不是作者想的那样"——静默走默认最难查，必须报成 error。
          message: `执行单位非法：${task.executor || '(空)'}（允许 ${PHASE_TASK_EXECUTORS.join(' / ')}）`,
          ...where,
          field: '执行单位',
        });
      }

      const acceptance = String(task.inlineAcceptance || task.acceptance || '').trim();
      if (!acceptance) {
        stats.missingAcceptance += 1;
        pushIssue({
          level: 'warning',
          code: 'missing_acceptance',
          message: `阶段任务 ${task.id} 缺就地验收标准（##### 验收标准）`,
          ...where,
        });
      }

      for (const assetPath of collectAssetPaths({ tools: task.tools, image: task.image })) {
        stats.assetRefs += 1;
        const fsPath = resolveAssetFsPath(lessonsRoot, assetPath);
        if (!fsPath || !fs.existsSync(fsPath)) {
          stats.missingAssets += 1;
          pushIssue({
            level: 'error',
            code: 'missing_asset',
            message: `素材文件不存在：${assetPath}`,
            ...where,
            line: findAssetLine(phasesMarkdown, assetPath) || undefined,
          });
        }
      }
    }
  }

  // 位置写错：阶段任务写进了 roles/*.md。那里的 `### 阶段任务N` 谁都不读——
  // parseRole 的正则不认它，parsePhases 也不看角色文件，于是整块内容静默消失。
  for (const role of course?.roles || []) {
    for (const { line, text } of findPhaseTaskHeadingLines(role.sourceMarkdown)) {
      stats.misplacedPhaseTasks += 1;
      pushIssue({
        level: 'error',
        code: 'phase_task_in_role_file',
        message: `阶段任务写在角色文件里不会被解析：${text}（应移到课程阶段编排的对应 Phase 下）`,
        roleId: role.id,
        line,
      });
    }
  }

  // time-bank unlock_after：规范写法 phase-N-start（与阶段 id 同源）。
  // 旧窄正则只认 phaseN-start；写成 phase_2-start 之类会匹配失败、requiredPhase 变 NaN，
  // 运行时的门禁条件被静默跳过，题目永久解锁且无报错——所以这里必须报 error。
  // N 还必须在 1..本课 Phase 数之间。
  const timeBankMarkdown = course?.files?.['time-bank.md'] || '';
  const definedPhaseCount = (course?.lesson?.phases || []).length;
  for (const task of course?.lesson?.timeBank?.tasks || []) {
    const value = String(task.unlockAfter || '').trim();
    if (!value) continue;
    stats.timeBankUnlocks += 1;
    const match = value.match(/^phase-(\d+)-start$/i);
    const phaseNumber = match ? Number.parseInt(match[1], 10) : 0;
    if (!match || (definedPhaseCount > 0 && (phaseNumber < 1 || phaseNumber > definedPhaseCount))) {
      stats.badUnlockAfter += 1;
      pushIssue({
        level: 'error',
        code: 'bad_unlock_after',
        message: !match
          ? `unlock_after 写法非法：${value}（规范写法 phase-N-start，例如 phase-2-start；旧写法 phase2-start 请一并改掉）`
          : `unlock_after 引用了不存在的 Phase ${phaseNumber}（本课只定义了 ${definedPhaseCount} 个 Phase）`,
        file: `6-lessons/${courseId}/time-bank.md`,
        line: findTimeBankTaskLine(timeBankMarkdown, task.id, 'unlock_after'),
        field: 'unlock_after',
      });
    }
  }

  // 素材：扫 roles（含字段里的 lessons/… 路径），落盘路径对 6-lessons/<id>/ 校验；不走 lesson.assets
  const assetOwner = new Map();
  for (const role of course?.roles || []) {
    const clone = { ...role };
    delete clone.sourceMarkdown;
    const found = collectAssetPaths(clone);
    for (const assetPath of found) {
      if (!assetOwner.has(assetPath)) assetOwner.set(assetPath, role);
    }
  }
  for (const assetPath of collectAssetPaths(course?.roles || [])) {
    stats.assetRefs += 1;
    const fsPath = resolveAssetFsPath(lessonsRoot, assetPath);
    if (!fsPath || !fs.existsSync(fsPath)) {
      stats.missingAssets += 1;
      const owner = assetOwner.get(assetPath);
      pushIssue({
        level: 'error',
        code: 'missing_asset',
        message: `素材文件不存在：${assetPath}`,
        roleId: owner?.id || '',
        file: owner ? roleFilePath(courseId, owner.id) : `6-lessons/${courseId}/course.md`,
        line: owner ? findAssetLine(owner.sourceMarkdown, assetPath) : 1,
      });
    }
  }

  // 运行时**只**执行 sequential：`traversalMode` 在 server/ 下零消费者，
  // 推进仍是 task-advance.js 的 `currentTaskIndex += 1`。所以除 sequential
  // 以外的每个值都要告警——写了它的课程会按线性跑，而作者以为不是。
  //
  // 早先只警告 inquiry、放过 open，是因为当时计划本轮落地 open；那件事已取消，
  // 放过它就变成了静默陷阱：课程作者写下 open，lint 全绿，学生端照线性走。
  const traversalMode = String(course?.lesson?.traversalMode || 'sequential').toLowerCase();
  const UNSUPPORTED_TRAVERSAL_MODES = {
    open: '学生在已解锁任务间自选',
    inquiry: '由 methodology.md 驱动、无任务顺序',
  };
  if (UNSUPPORTED_TRAVERSAL_MODES[traversalMode]) {
    stats.unsupportedTraversalModes += 1;
    pushIssue({
      level: 'warning',
      code: 'unsupported_traversal_mode',
      message: `遍历模式 ${traversalMode}（${UNSUPPORTED_TRAVERSAL_MODES[traversalMode]}）本期未实现，`
        + '运行时将按 sequential 处理；字段可以先写占位，但不要依赖它改变推进顺序',
      file: `6-lessons/${courseId}/course.md`,
      line: 1,
      field: '遍历模式',
    });
  }

  for (const warning of course?.platformDefaults?.warnings || []) {
    stats.compilerWarnings += 1;
    const warningSource = String(warning.source || warning.file || 'course.md');
    const warningFile = warningSource.startsWith('6-lessons/')
      ? warningSource
      : `6-lessons/${courseId}/${warningSource}`;
    pushIssue({
      level: warning.level === 'error' ? 'error' : 'warning',
      code: warning.code || 'compiler_warning',
      message: warning.message || `课程编译告警：${warning.code || 'compiler_warning'}`,
      file: warningFile,
      line: findCompilerWarningLine(course, warning, courseId),
      source: warningSource,
      field: warning.field || warning.key || '编译配置',
      roleId: warning.roleId || '',
      stepId: warning.stepId || '',
      phaseTask: warning.phaseId ? { phaseId: warning.phaseId } : null,
    });
  }

  const quality = auditCourseQuality(course, { lessonsRoot, courseId });
  for (const issue of quality.issues) {
    stats.qualityIssues += 1;
    issues.push({
      level: issue.level,
      code: issue.code,
      message: issue.message,
      file: issue.file,
      line: issue.line || 1,
      courseId: issue.courseId || courseId,
      course: issue.course || issue.courseId || courseId,
      roleId: issue.roleId || '',
      stepId: issue.stepId || '',
      phaseId: issue.phaseId || '',
      source: issue.source || '',
      field: issue.field || '',
    });
  }

  return { issues, stats };
}

export function formatIssue(issue) {
  const code = issue.code ? `${issue.code}  ` : '';
  const field = issue.field ? `[字段：${issue.field}] ` : '';
  return `${issue.file}:${issue.line}\n  ${issue.level}  ${code}${field}${issue.message}`;
}

export function summarizeIssues(issues = []) {
  const errors = issues.filter((item) => item.level === 'error').length;
  const warnings = issues.filter((item) => item.level === 'warning').length;
  return { errors, warnings };
}

export function exitCodeForIssues(issues = [], { strict = false } = {}) {
  const { errors, warnings } = summarizeIssues(issues);
  if (errors > 0) return 1;
  if (strict && warnings > 0) return 1;
  return 0;
}

export async function lintAllCourses({
  lessonsRoot = defaultLessonsRoot,
  courseIds,
  clearCache = true,
} = {}) {
  if (clearCache) clearCourseCache();
  const ids = courseIds || fs.readdirSync(lessonsRoot)
    .filter((name) => name.startsWith('lesson_'))
    .sort();

  const allIssues = [];
  const allStats = [];
  for (const courseId of ids) {
    const course = await compileCourse({ lessonsRoot, courseId });
    const result = lintCourse(course, { lessonsRoot, courseId });
    allIssues.push(...result.issues);
    allStats.push({ courseId, ...result.stats });
  }
  return { issues: allIssues, stats: allStats };
}

function printReport(issues) {
  for (const issue of issues) {
    console.log(formatIssue(issue));
    console.log('');
  }
  const { errors, warnings } = summarizeIssues(issues);
  console.log(`汇总：${errors} error，${warnings} warning`);
}

async function main(argv = process.argv.slice(2)) {
  const strict = argv.includes('--strict');
  const { issues } = await lintAllCourses({ lessonsRoot: defaultLessonsRoot });
  printReport(issues);
  process.exitCode = exitCodeForIssues(issues, { strict });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
