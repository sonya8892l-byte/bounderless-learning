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
import {
  resolveStepRestrictions,
  restrictionReferenceTitles,
} from '../server/course/restriction-sections.js';

const COMPETENCY_PREFIX = /^(CC|CQ|DK|DS|DC)(-|$)/;
const ASSET_PATH_RE = /lessons\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|svg|mp3|mp4)/gi;

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

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roleFilePath(courseId, roleId) {
  return `6-lessons/${courseId}/roles/${roleId}.md`;
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
    competencyTags: 0,
    badCompetencyTags: 0,
    missingAcceptance: 0,
    nextEdges: 0,
    badNextEdges: 0,
  };

  const knowledgeIds = new Set((course?.knowledge || []).map((item) => item.id));

  const pushIssue = ({
    level,
    code,
    message,
    roleId = '',
    stepId = '',
    line,
    file,
  }) => {
    const role = (course?.roles || []).find((item) => item.id === roleId);
    const resolvedFile = file || (roleId ? roleFilePath(courseId, roleId) : `6-lessons/${courseId}/course.md`);
    const resolvedLine = line
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
    });
  };

  for (const role of course?.roles || []) {
    for (const task of role.tasks || []) {
      for (const tag of task.competencyTags || []) {
        stats.competencyTags += 1;
        if (!COMPETENCY_PREFIX.test(tag)) {
          stats.badCompetencyTags += 1;
          pushIssue({
            level: 'error',
            code: 'bad_competency_tag',
            message: `能力标签前缀非法：${tag}（允许 CC/CQ/DK/DS/DC）`,
            roleId: role.id,
            stepId: task.steps?.[0]?.id || '',
          });
        }
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
              roleId: role.id,
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
              message: `限制引用无法解析：restrictions.md#${title}`,
              roleId: role.id,
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
              roleId: role.id,
              stepId: step.id,
            });
          }
        }

        const acceptance = String(step.acceptance || step.inlineAcceptance || '').trim();
        if (!acceptance) {
          stats.missingAcceptance += 1;
          pushIssue({
            level: 'warning',
            code: 'missing_acceptance',
            message: `Step ${step.id} 缺就地验收标准（##### 验收标准）`,
            roleId: role.id,
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
              roleId: role.id,
              stepId: step.id,
            });
          }
        }
      }
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

  return { issues, stats };
}

export function formatIssue(issue) {
  return `${issue.file}:${issue.line}\n  ${issue.level}  ${issue.message}`;
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
