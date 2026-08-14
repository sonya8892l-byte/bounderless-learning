import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { QUALITY_ISSUE_CODES } from '../server/course/course-quality-audit.js';
import {
  exitCodeForIssues,
  lintAllCourses,
  lintCourse,
  summarizeIssues,
} from '../scripts/lint-lesson.mjs';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function cloneCourse(course) {
  return structuredClone({
    id: course.id,
    knowledge: course.knowledge,
    restrictionMarkdown: course.restrictionMarkdown,
    restrictionDocument: course.restrictionDocument,
    roles: course.roles,
  });
}

test('6 门真课程通过结构与语义质量门禁，包括显式声明的静态情境图', async () => {
  // 固定已入库的六门课做统计基线：目录里可能出现未提交的 WIP 课程，
  // 聚合数字只对已知良好基线负责；新课程正式入库时加进列表并更新下方统计。
  const committedCourseIds = [
    'lesson_gewu_001',
    'lesson_youyi_001',
    'lesson_zhizhi_001',
    'lesson_zhizhi_002',
    'lesson_zhizhi_003',
    'lesson_zhuhun_001',
  ];
  const { issues, stats } = await lintAllCourses({ lessonsRoot, courseIds: committedCourseIds });
  const structural = issues.filter((issue) => !QUALITY_ISSUE_CODES.includes(issue.code));
  const summary = summarizeIssues(structural);
  assert.equal(summary.errors, 0);
  assert.equal(summary.warnings, 0);
  assert.equal(exitCodeForIssues(structural), 0);
  assert.equal(exitCodeForIssues(structural, { strict: true }), 0);
  const missingMedia = structural.filter((issue) => issue.code === 'missing_media_source');
  assert.equal(missingMedia.length, 0);

  const knowledgeRefs = stats.reduce((sum, item) => sum + item.knowledgeRefs, 0);
  const restrictionRefs = stats.reduce((sum, item) => sum + item.restrictionRefs, 0);
  const competencyTags = stats.reduce((sum, item) => sum + item.competencyTags, 0);
  const nextEdges = stats.reduce((sum, item) => sum + item.nextEdges, 0);
  assert.equal(knowledgeRefs, 413);
  assert.equal(restrictionRefs, 221);
  // 各课 Phase 1 入口任务的能力标签与角色任务一并校验。
  assert.equal(competencyTags, 144);
  // 六门课的可执行入口任务和明确 `通过后` 一并进图。
  assert.equal(nextEdges, 229);
  assert.equal(stats.reduce((sum, item) => sum + item.missingAcceptance, 0), 0);
  assert.equal(stats.reduce((sum, item) => sum + item.deadKnowledgeRefs, 0), 0);
  assert.equal(stats.reduce((sum, item) => sum + item.deadRestrictionRefs, 0), 0);
  assert.equal(stats.reduce((sum, item) => sum + item.missingAssets, 0), 0);
  assert.equal(stats.reduce((sum, item) => sum + item.missingMediaSources, 0), 0);
  assert.equal(stats.reduce((sum, item) => sum + item.qualityIssues, 0), 0);
  // 六门课共 40 个带 unlock_after 的时间银行任务，全部必须是规范写法 phase-N-start。
  assert.equal(stats.reduce((sum, item) => sum + item.timeBankUnlocks, 0), 40);
  assert.equal(stats.reduce((sum, item) => sum + item.badUnlockAfter, 0), 0);
});

test('注入死知识引用必须报 error（负例）', async () => {
  clearCourseCache();
  const course = cloneCourse(await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' }));
  const step = course.roles[0].tasks[0].steps[0];
  step.knowledgeRef = `${step.knowledgeRef || ''}, K-DEAD-REF`.replace(/^,\s*/, '');

  const { issues } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const dead = issues.filter((item) => item.code === 'dead_knowledge_ref');
  assert.ok(dead.length >= 1);
  assert.equal(dead[0].level, 'error');
  assert.match(dead[0].message, /K-DEAD-REF/);
  assert.equal(exitCodeForIssues(issues), 1);
});

test('注入无法解析的限制引用必须报 error', async () => {
  clearCourseCache();
  const course = cloneCourse(await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' }));
  const step = course.roles[0].tasks[0].steps[0];
  step.restrictionRef = 'restrictions.md#绝不存在的限制标题';

  const { issues } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const dead = issues.filter((item) => item.code === 'dead_restriction_ref');
  assert.ok(dead.length >= 1);
  assert.equal(dead[0].level, 'error');
});

test('注入非法能力标签前缀必须报 error', async () => {
  clearCourseCache();
  const course = cloneCourse(await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' }));
  course.roles[0].tasks[0].competencyTags = ['XX-99'];

  const { issues } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const bad = issues.filter((item) => item.code === 'bad_competency_tag');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].level, 'error');
});

test('缺就地验收标准是 warning 不是 error', async () => {
  clearCourseCache();
  const course = cloneCourse(await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' }));
  const step = course.roles[0].tasks[0].steps[0];
  step.acceptance = '';
  step.inlineAcceptance = '';

  const { issues } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const missing = issues.filter((item) => item.code === 'missing_acceptance' && item.stepId === step.id);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].level, 'warning');
  assert.equal(exitCodeForIssues(missing), 0);
  assert.equal(exitCodeForIssues(missing, { strict: true }), 1);
});

test('注入坏的通过后目标必须报 error', async () => {
  clearCourseCache();
  const course = cloneCourse(await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' }));
  const step = course.roles[0].tasks[0].steps[0];
  step.next = '随便写的下一站';

  const { issues } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const bad = issues.filter((item) => item.code === 'bad_next_ref');
  assert.ok(bad.length >= 1);
  assert.equal(bad[0].level, 'error');
});

test('注入非规范 unlock_after 必须报 error（负例）', async () => {
  clearCourseCache();
  const compiled = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  // unlock_after 检查需要 lesson.timeBank 和 time-bank.md 原文，cloneCourse 默认不带。
  const course = {
    ...cloneCourse(compiled),
    lesson: structuredClone(compiled.lesson),
    files: compiled.files,
  };
  course.lesson.timeBank.tasks[0].unlockAfter = 'phase_2-start';

  const { issues } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const bad = issues.filter((item) => item.code === 'bad_unlock_after');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].level, 'error');
  assert.match(bad[0].message, /phase_2-start/);
  assert.equal(exitCodeForIssues(issues), 1);
});

test('unlock_after 引用超出本课 Phase 数必须报 error（负例）', async () => {
  clearCourseCache();
  const compiled = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const course = {
    ...cloneCourse(compiled),
    lesson: structuredClone(compiled.lesson),
    files: compiled.files,
  };
  course.lesson.timeBank.tasks[0].unlockAfter = 'phase-9-start';

  const { issues } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const bad = issues.filter((item) => item.code === 'bad_unlock_after');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].level, 'error');
  assert.match(bad[0].message, /Phase 9/);
});
