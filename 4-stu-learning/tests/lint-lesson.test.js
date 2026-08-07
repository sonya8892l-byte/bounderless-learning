import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
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

test('5 门真课程：零 error，恰好 55 条缺验收 warning', async () => {
  const { issues, stats } = await lintAllCourses({ lessonsRoot });
  const summary = summarizeIssues(issues);
  assert.equal(summary.errors, 0);
  assert.equal(summary.warnings, 55);
  assert.equal(exitCodeForIssues(issues), 0);
  assert.equal(exitCodeForIssues(issues, { strict: true }), 1);

  const knowledgeRefs = stats.reduce((sum, item) => sum + item.knowledgeRefs, 0);
  const restrictionRefs = stats.reduce((sum, item) => sum + item.restrictionRefs, 0);
  const competencyTags = stats.reduce((sum, item) => sum + item.competencyTags, 0);
  const nextEdges = stats.reduce((sum, item) => sum + item.nextEdges, 0);
  assert.equal(knowledgeRefs, 403);
  assert.equal(restrictionRefs, 216);
  assert.equal(competencyTags, 113);
  assert.equal(nextEdges, 208);
  assert.equal(stats.reduce((sum, item) => sum + item.missingAcceptance, 0), 55);
  assert.equal(stats.reduce((sum, item) => sum + item.deadKnowledgeRefs, 0), 0);
  assert.equal(stats.reduce((sum, item) => sum + item.deadRestrictionRefs, 0), 0);
  assert.equal(stats.reduce((sum, item) => sum + item.missingAssets, 0), 0);
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
