import test from 'node:test';
import assert from 'node:assert/strict';
import { lintCourse, summarizeIssues } from '../scripts/lint-lesson.mjs';

function baseCourse(overrides = {}) {
  return {
    id: 'lesson_fake',
    knowledge: [],
    roles: overrides.roles || [{
      id: 'scout',
      sourceMarkdown: '',
      tasks: [
        { id: 'task-1', prerequisites: [], steps: [{ id: 's1', title: 'a' }] },
        { id: 'task-2', prerequisites: ['task-1'], steps: [{ id: 's2', title: 'b' }] },
      ],
    }],
    lesson: {
      traversalMode: overrides.traversalMode || 'sequential',
      phases: overrides.phases || [],
    },
  };
}

test('阶段任务前置指向角色任务 → cross_scope_prerequisite error', () => {
  const course = baseCourse({
    phases: [{
      id: 'phase-1',
      tasks: [{ id: 'p3', prerequisites: ['task-1'], steps: [{ id: 'ps1', title: 'p' }] }],
    }],
  });
  const { issues } = lintCourse(course);
  const hit = issues.filter((item) => item.code === 'cross_scope_prerequisite');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'error');
  assert.match(hit[0].message, /task-1/);
});

test('同角色内前置不报错', () => {
  const { issues } = lintCourse(baseCourse());
  assert.equal(issues.filter((item) => item.code === 'cross_scope_prerequisite').length, 0);
});

test('course.md 写 inquiry → unsupported_traversal_mode warning', () => {
  const { issues } = lintCourse(baseCourse({ traversalMode: 'inquiry' }));
  const hit = issues.filter((item) => item.code === 'unsupported_traversal_mode');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'warning');
});

test('course.md 写 open 不报错', () => {
  const { issues } = lintCourse(baseCourse({ traversalMode: 'open' }));
  assert.equal(issues.filter((item) => item.code === 'unsupported_traversal_mode').length, 0);
  assert.equal(summarizeIssues(issues).errors, 0);
});
