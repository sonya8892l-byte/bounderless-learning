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

/**
 * 遍历模式：运行时只执行 sequential，其余两个值都必须告警。
 *
 * `open` 原本被刻意放过（断言"写 open 不报错"），前提是本轮会实现它。那件事已取消，
 * 而 `traversalMode` 在 server/ 下**零消费者**——放过它等于给课程作者一个静默陷阱：
 * 写下 open、lint 全绿、学生端照线性跑，作者以为自己开了自选顺序。
 *
 * 所以两个未实现的值一视同仁：字段可以写（预留），但必须收到"现在不生效"的回执。
 */
for (const mode of ['open', 'inquiry']) {
  test(`course.md 写 ${mode} → unsupported_traversal_mode warning（本期只执行 sequential）`, () => {
    const { issues } = lintCourse(baseCourse({ traversalMode: mode }));
    const hit = issues.filter((item) => item.code === 'unsupported_traversal_mode');
    assert.equal(hit.length, 1, `${mode} 必须收到告警，否则课程作者会以为它生效了`);
    assert.equal(hit[0].level, 'warning');
    assert.match(hit[0].message, new RegExp(mode), '告警要点名是哪个模式，否则作者不知道改哪一行');
    assert.match(hit[0].message, /sequential/, '要说清运行时实际按什么跑，否则"未实现"读不出后果');
    assert.match(hit[0].file, /course\.md$/, '遍历模式写在 course.md，告警要指到那里');
    // 只是"未实现"，不是"写错了"——预留字段不该拦住编译。
    assert.equal(summarizeIssues(issues).errors, 0, '未实现只报 warning，不许升级成 error 挡住编译');
  });
}

test('course.md 写 sequential（或省略）不告警', () => {
  for (const course of [baseCourse(), baseCourse({ traversalMode: 'sequential' })]) {
    const { issues } = lintCourse(course);
    assert.equal(issues.filter((item) => item.code === 'unsupported_traversal_mode').length, 0);
    assert.equal(summarizeIssues(issues).errors, 0);
  }
});
