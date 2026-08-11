/**
 * 「取当前任务」的两个取值函数不许同名（R3-1）。
 *
 * 仓里曾经有两个都叫 `currentTaskOf` 的导出函数，签名不兼容：
 *
 * ```js
 * task-advance.js   : currentTaskOf(role, session)     // 收会话
 * agent-context.js  : currentTaskOf(role, taskIndex)   // 收下标
 * ```
 *
 * 搞混不抛错，会静默返回 `tasks[0]`——`Number({}) → NaN`，`NaN || 0 → 0`。
 * 也就是**把学生悄悄退回第一个任务**，没有任何报错、没有任何日志。
 *
 * 这个地雷本来只是"难看"，但 R3-1 要把 `task-advance.js` 那个 import 到十几处，
 * 一旦某处 import 错了文件就会踩上。所以按下标那个改名成 `taskAtIndex`。
 *
 * 这条测试钉的是**命名不许再撞**，以及两个函数各自的契约。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { taskAtIndex } from '../server/course/agent-context.js';
import { currentTaskOf } from '../server/agent/task-advance.js';
import * as agentContext from '../server/course/agent-context.js';
import * as taskAdvance from '../server/agent/task-advance.js';

const role = { id: 'r', tasks: [{ id: 'task-1' }, { id: 'task-2' }, { id: 'task-3' }] };

test('两个模块不许导出同名的取任务函数', () => {
  const shared = Object.keys(agentContext).filter((name) => name in taskAdvance);
  assert.deepEqual(
    shared, [],
    `同名导出会让 import 错文件时静默取到错任务（见本文件模块头）。撞名的是：${shared.join('、')}`,
  );
});

test('taskAtIndex 收下标；currentTaskOf 收会话；各自越界都收敛到最后一个', () => {
  assert.equal(taskAtIndex(role, 2).id, 'task-3');
  assert.equal(currentTaskOf(role, { currentTaskIndex: 2 }).id, 'task-3');
  // 越界收敛：存量会话遇上"课程改版后任务变少"时靠这个不崩。
  assert.equal(taskAtIndex(role, 99).id, 'task-3');
  assert.equal(currentTaskOf(role, { currentTaskIndex: 99 }).id, 'task-3');
});

test('传错参数类型时不会静默退回第一个任务（这正是改名要防的事）', () => {
  // 把 session 传给收下标的那个：改名前这里会静默得到 task-1。
  // 现在两个名字不同，写错就是 import 不到；万一还是传错了，
  // 至少不能"看起来正常"——所以这里断言它**不等于** task-3，
  // 用来说明为什么必须靠名字区分而不能靠运气。
  assert.notEqual(taskAtIndex(role, { currentTaskIndex: 2 })?.id, 'task-3');
  assert.equal(taskAtIndex(role, { currentTaskIndex: 2 })?.id, 'task-1');
});

test('存量会话越界时收敛到末尾任务——课程改版后任务变少的唯一防线', () => {
  // 这条路今天**没有任何别的测试覆盖**（实测：把 12 处夹取全摘掉，全量 302 例照样全绿）。
  //
  // 真实场景：学生做到第 3 个任务 → 课程改版把该角色砍到 2 个任务 → 内容 hash 变了触发
  // 重编译 → 会话恢复（session-factory 的 normalize）原样带回 currentTaskIndex=2，
  // 而它不做任何边界校验。此时 tasks[2] 是 undefined，下游 `task.id` 直接抛。
  //
  // R3-2 把内部换成读图时必须保留这个收敛语义：找不到节点回落末尾，不要返回 undefined。
  const shrunk = { id: 'r', tasks: [{ id: 'task-1' }, { id: 'task-2' }] };
  const staleSession = { currentTaskIndex: 2 };

  assert.equal(currentTaskOf(shrunk, staleSession).id, 'task-2', '越界必须收敛到末尾任务，不能是 undefined');
  assert.equal(taskAtIndex(shrunk, 2).id, 'task-2');
  // 越界很多也一样（比如课程从 6 个任务砍到 2 个）。
  assert.equal(currentTaskOf(shrunk, { currentTaskIndex: 5 }).id, 'task-2');
});

test('空任务列表不抛异常', () => {
  assert.equal(taskAtIndex({ tasks: [] }, 0), undefined);
  assert.equal(currentTaskOf({ tasks: [] }, { currentTaskIndex: 0 }), undefined);
  assert.equal(taskAtIndex(undefined, 0), undefined);
  assert.equal(currentTaskOf(undefined, undefined), undefined);
});
