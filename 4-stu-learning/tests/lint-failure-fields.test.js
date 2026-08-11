import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { lintAllCourses, lintCourse, summarizeIssues } from '../scripts/lint-lesson.mjs';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function fakeCourse(stepOverrides = {}) {
  return {
    id: 'lesson_fake',
    knowledge: [],
    restrictionMarkdown: '',
    restrictionDocument: { sections: [], rows: [] },
    roles: [{
      id: 'test-role',
      sourceMarkdown: '- id：bad-step\n',
      tasks: [{
        id: 'task-1',
        steps: [{
          id: 'bad-step',
          title: '测试小步',
          completionMode: 'ai_evaluation',
          teacherIntervention: '',
          failureHandling: '请补拍清晰照片',
          maxAttempts: 2,
          ...stepOverrides,
        }],
      }],
    }],
    lesson: { phases: [], traversalMode: 'sequential' },
  };
}

test('教师介入必须但完成方式不是 teacher_confirm → error', () => {
  const { issues } = lintCourse(fakeCourse({
    teacherIntervention: '必须',
    completionMode: 'ai_evaluation',
  }));
  const hit = issues.filter((item) => item.code === 'teacher_intervention_mismatch');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'error');
  assert.match(hit[0].message, /teacher_confirm/);
});

test('完成方式 teacher_confirm 但未标教师介入必须 → error', () => {
  const { issues } = lintCourse(fakeCourse({
    teacherIntervention: '无',
    completionMode: 'teacher_confirm',
  }));
  const hit = issues.filter((item) => item.code === 'teacher_intervention_mismatch');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'error');
});

test('最大尝试≥1 且失败处理为「无」→ empty_failure_handling warning', () => {
  const { issues } = lintCourse(fakeCourse({
    failureHandling: '无',
    maxAttempts: 2,
  }));
  const hit = issues.filter((item) => item.code === 'empty_failure_handling');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'warning');
});

test('配对正确且有实质失败处理 → 两条规则都不报', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhizhi_001' });
  const step = course.roles.flatMap((role) => role.tasks.flatMap((task) => task.steps))
    .find((item) => item.completionMode === 'teacher_confirm');
  assert.ok(step);
  const { issues } = lintCourse({
    ...course,
    roles: [{
      id: 'test-role',
      sourceMarkdown: `- id：${step.id}\n`,
      tasks: [{ id: 'task-1', steps: [structuredClone(step)] }],
    }],
    lesson: { phases: [], traversalMode: 'sequential' },
  });
  assert.equal(issues.filter((item) => item.code === 'teacher_intervention_mismatch').length, 0);
  assert.equal(issues.filter((item) => item.code === 'empty_failure_handling').length, 0);
});

test('5 门真课程仍 0 error、56 warning（配对回归锁）', async () => {
  const { issues } = await lintAllCourses({ lessonsRoot });
  const summary = summarizeIssues(issues);
  assert.equal(summary.errors, 0);
  assert.equal(summary.warnings, 56);
});
