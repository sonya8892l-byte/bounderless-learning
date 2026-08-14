import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { advanceToNextTask } from '../server/agent/task-advance.js';
import { buildTaskGraph, nodeKey, traversalOrder } from '../server/course/task-graph.js';

const lessonsRoot = resolve(import.meta.dirname, '../../6-lessons');
const COURSE_IDS = ['lesson_gewu_001', 'lesson_youyi_001', 'lesson_zhizhi_001', 'lesson_zhizhi_002', 'lesson_zhizhi_003', 'lesson_zhuhun_001'];

function makeRole(tasks, roleId = 'scout') {
  return { id: roleId, tasks };
}

test('图序覆盖数组序：a → b → c（非 a → c → b）', () => {
  const role = makeRole([
    { id: 'a', name: '任务A', prerequisites: [], steps: [{ id: 'a-s1', next: 'role-stage:b' }] },
    { id: 'c', name: '任务C', prerequisites: ['b'], steps: [] },
    { id: 'b', name: '任务B', prerequisites: [], steps: [{ id: 'b-s1', next: 'role-stage:c' }] },
  ]);
  const taskGraph = buildTaskGraph([role]);
  const session = { currentTaskIndex: 0, completedTaskIds: ['scout:a'], events: [] };

  const result = advanceToNextTask({ role, session, taskGraph });

  assert.equal(result.advanced, true);
  assert.equal(result.nextTask.id, 'b');
  assert.equal(session.currentTaskIndex, 2);
});

test('前置未满足时 blockedBy 生效且 index 不动', () => {
  const role = makeRole([
    { id: 'need', name: '前置关', prerequisites: [] },
    { id: 'next', name: '下一关', prerequisites: ['need'] },
  ]);
  const taskGraph = buildTaskGraph([role]);
  // 测试专用：模拟「遍历序里先遇到 next，但它的前置 need 还没完成」的不一致态。
  taskGraph.testTraversalOrder = ['scout/next', 'scout/need'];
  const session = { currentTaskIndex: 1, completedTaskIds: [], events: [] };
  const before = session.currentTaskIndex;

  const result = advanceToNextTask({ role, session, taskGraph });

  assert.equal(result.advanced, false);
  assert.deepEqual(result.blockedBy, ['need']);
  assert.equal(session.currentTaskIndex, before);
});

test('不传 taskGraph = 老行为（逐字节线性 +1）', () => {
  const role = makeRole([
    { id: 'a', name: '任务A', prerequisites: [] },
    { id: 'c', name: '任务C', prerequisites: ['b'] },
    { id: 'b', name: '任务B', prerequisites: [] },
  ]);
  const session = { currentTaskIndex: 0, completedTaskIds: ['scout:a'], events: [] };

  const result = advanceToNextTask({ role, session });

  assert.equal(result.advanced, true);
  assert.equal(session.currentTaskIndex, 1);
  assert.equal(result.nextTask.id, 'c');
});

test('5 门课 × 每角色：图遍历序仍等于 role.tasks 数组序（零行为变化）', async () => {
  clearCourseCache();
  for (const courseId of COURSE_IDS) {
    const course = await compileCourse({ lessonsRoot, courseId });
    for (const role of course.roles) {
      const legacy = role.tasks.map((task) => nodeKey(role.id, task.id));
      assert.deepEqual(
        traversalOrder(course.taskGraph, role.id),
        legacy,
        `${courseId}/${role.id}`,
      );
    }
  }
});

test('任务图有环时回退线性推进、不抛错', () => {
  const role = makeRole([
    { id: 'a', name: '任务A', prerequisites: ['b'] },
    { id: 'b', name: '任务B', prerequisites: ['a'] },
  ]);
  const taskGraph = buildTaskGraph([role]);
  assert.ok(traversalOrder(taskGraph, role.id).length < role.tasks.length);

  const session = { currentTaskIndex: 0, completedTaskIds: ['scout:a'], events: [] };
  const result = advanceToNextTask({ role, session, taskGraph });

  assert.equal(result.advanced, true);
  assert.equal(session.currentTaskIndex, 1);
  assert.equal(result.nextTask.id, 'b');
});
