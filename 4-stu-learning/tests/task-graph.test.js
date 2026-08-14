import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { buildTaskGraph, nodeKey, parseNextRef, traversalOrder } from '../server/course/task-graph.js';

const lessonsRoot = resolve(import.meta.dirname, '../../6-lessons');
const COURSE_IDS = ['lesson_gewu_001', 'lesson_youyi_001', 'lesson_zhizhi_001', 'lesson_zhizhi_002', 'lesson_zhizhi_003', 'lesson_zhuhun_001'];

test('通过后的三种前缀都能解析', () => {
  assert.deepEqual(parseNextRef('step:task-1-step-2'), { kind: 'step', target: 'task-1-step-2' });
  assert.deepEqual(parseNextRef('role-stage:task-2'), { kind: 'task', target: 'task-2' });
  assert.deepEqual(parseNextRef('role:complete'), { kind: 'complete', target: '' });
  assert.deepEqual(parseNextRef('role-stage:complete'), { kind: 'complete', target: '' });
  assert.deepEqual(parseNextRef(''), { kind: 'none', target: '' });
  assert.deepEqual(parseNextRef('随便写的'), { kind: 'unknown', target: '随便写的' });
});

test('跨角色重名的 task id 不会塌成一个节点', async () => {
  clearCourseCache();
  // lesson_gewu_001 的 6 个角色都从 task-1 重新编号：按 taskId 建索引会得到 3 个节点。
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const rawIds = new Set(course.roles.flatMap((role) => role.tasks.map((task) => task.id)));
  assert.equal(rawIds.size, 3, '前提：这门课的 task id 跨角色重复');

  const graph = buildTaskGraph(course.roles);
  const expected = course.roles.reduce((sum, role) => sum + role.tasks.length, 0);
  assert.equal(graph.nodes.size, expected, '节点数必须等于任务总数，不能被重名塌掉');
  assert.equal(graph.nodes.size, 18);
  assert.equal(graph.warnings.filter((item) => item.code === 'duplicate_task').length, 0);
});

// 数字不变，口径收窄：图里现在还有阶段任务节点（非角色任务，见 tests/phase-tasks.test.js），
// 所以这里数的是 scope==='role' 的节点，而不是 graph.nodes.size。
// 103 这个数必须钉死——它是"阶段任务不污染角色任务"的那道保险。
test('6 门课共 103 个角色任务节点、30 个终止节点，零告警', async () => {
  clearCourseCache();
  let nodes = 0;
  let terminals = 0;
  let roles = 0;

  for (const courseId of COURSE_IDS) {
    const course = await compileCourse({ lessonsRoot, courseId });
    const graph = course.taskGraph;
    nodes += [...graph.nodes.values()].filter((node) => node.scope === 'role').length;
    roles += course.roles.length;
    for (const role of course.roles) {
      const roleTerminals = [...graph.nodes.values()].filter((node) => node.roleId === role.id && node.terminal);
      assert.equal(roleTerminals.length, 1, `${courseId}/${role.id} 应恰好有一个终止节点`);
      terminals += roleTerminals.length;
    }
    const graphIssues = graph.warnings.filter((item) => item.code !== undefined);
    assert.deepEqual(graphIssues, [], `${courseId} 的任务图不该有告警`);
  }

  assert.equal(nodes, 103);
  assert.equal(roles, 30);
  assert.equal(terminals, 30);
});

test('图的遍历顺序与今天的 currentTaskIndex += 1 完全一致', async () => {
  clearCourseCache();
  for (const courseId of COURSE_IDS) {
    const course = await compileCourse({ lessonsRoot, courseId });
    for (const role of course.roles) {
      // 现状：推进就是按 role.tasks 的书写顺序逐个 +1。
      const legacy = role.tasks.map((task) => nodeKey(role.id, task.id));
      assert.deepEqual(
        traversalOrder(course.taskGraph, role.id),
        legacy,
        `${courseId}/${role.id}：图遍历必须与线性推进等价，否则 R3 切换会改变行为`,
      );
    }
  }
});

test('显式写的 前置 优先于 通过后 推导', () => {
  const roles = [{
    id: 'r1',
    tasks: [
      { id: 't1', steps: [{ id: 's1', next: 'role-stage:t2' }] },
      { id: 't2', steps: [{ id: 's2', next: 'role-stage:t3' }] },
      // t3 显式声明只依赖 t1，应当覆盖 t2 推导出的入边。
      { id: 't3', prerequisites: ['t1'], steps: [{ id: 's3', next: 'role:complete' }] },
    ],
  }];

  const graph = buildTaskGraph(roles);
  assert.deepEqual(graph.nodes.get('r1/t3').prerequisites, ['r1/t1']);
  assert.equal(graph.nodes.get('r1/t3').terminal, true);
});

test('指向不存在的任务时报告告警，不静默丢边', () => {
  const roles = [{
    id: 'r1',
    tasks: [{ id: 't1', steps: [{ id: 's1', next: 'role-stage:并不存在' }] }],
  }];

  const graph = buildTaskGraph(roles);
  assert.equal(graph.warnings.length, 1);
  assert.equal(graph.warnings[0].code, 'unknown_next');
  assert.match(graph.warnings[0].message, /并不存在/);
});
