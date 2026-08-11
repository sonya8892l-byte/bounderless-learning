/**
 * 角色任务的推进语义（R3-0）。
 *
 * ## 为什么需要这个模块
 *
 * `推进方式` 有三个值，但改造前只有一个真的会推进：
 *
 * ```js
 * if (task.advanceMode === 'teacher')      input.data.waitingForTeacher = true;   // 全仓零消费
 * else if (task.advanceMode === 'ai_suggest') input.data.waitingForStudent = true; // 全仓零消费
 * else session.currentTaskIndex += 1;                                             // 只有这条
 * ```
 *
 * 那两个标记只写在 `input.data` 上——**它是单次回合的载荷，回合结束就没了**，
 * 而教师指令要等下一次轮询才到。所以学生做完任务后进度永久停住：
 * 教师端 13 个指令里没有 `advance_task`，`skip_step` 也解不了（它走
 * `task_step_completed`，小步走完只是回到"等工具结果"，推进的唯一入口仍是
 * `finalizeToolResult`）。存量已经踩到：`lesson_zhizhi_001` 的
 * `assembly-speaker`／`id-designer` 各有一个 `推进方式：teacher` 的任务。
 *
 * 修法是把"等谁推进"落到**会话**上（`session.pendingAdvance`，跨回合存活），
 * 并给它两个明确的解除入口：教师指令与学生确认。
 *
 * ## 为什么把 completion 的三个字段一起存下来
 *
 * `continueAtSameLocation`（下一任务同地点就不再要求重新到达）原本从当次
 * `pendingCompletion` 读。等待推进时那个对象早已随回合消失，所以要把
 * 地点与验证方式一起记进 `pendingAdvance`——否则老师推进后学生会被要求
 * 在同一个地点重新走一遍到达验证。
 */

import { traversalOrder } from '../course/task-graph.js';

/**
 * 当前任务。收敛 `role.tasks[Math.min(session.currentTaskIndex, ...)]` 这个到处重复的表达式。
 *
 * ## 那个 `Math.min` 到底在防什么（R3-1 的分类结论）
 *
 * 原本以为这 12 处夹取有两种语义——一种"取当前任务，夹取只是保险"，一种"故意取末尾任务
 * 渲染收尾文案"——如果真有第二种，R3-2 换成读图时它们会取到 `undefined` 把话术搞崩。
 *
 * 逐处读完 ＋ 实测的结论是：**只有一种语义，但夹取确实在承重**。
 *
 * - 单次会话内 `currentTaskIndex` 永不越界：`advanceToNextTask` 在最后一个任务上直接
 *   拒绝推进（见下），所以它顶多等于 `length - 1`；
 * - 但**会话恢复**路径（`session-factory.js` 的 `normalize`）原样带回存量 index，不做
 *   任何边界校验。课程改版后某角色任务变少时，存量会话的 index 就越界了；
 * - 实测：把 12 处夹取全摘掉跑全量，**302 例照样全绿**——也就是说没有任何测试覆盖这条路。
 *   夹取是在保一个真实但无人测试的场景。
 *
 * 所以 R3-2 换成读图时，**这个夹取语义必须保留**：找不到节点时回落到"遍历序列的最后一个"，
 * 而不是返回 `undefined`。丢了它，存量会话在课程改版后会直接崩在取任务这一行。
 */
export function currentTaskOf(role, session) {
  const tasks = role?.tasks || [];
  if (!tasks.length) return undefined;
  const index = Math.min(Number(session?.currentTaskIndex || 0), tasks.length - 1);
  return tasks[index];
}

/** 当前任务对应的工具实例。收敛 tools.js 的私有 currentTool ＋ service.js 抄的 3 遍。 */
export function currentToolOf(role, session) {
  return role.tools.find((tool) => tool.taskIndex === session.currentTaskIndex);
}

/** 该任务完成后由谁推进：`teacher`／`student`／`auto`。未知值按 auto，与解析层的回落一致。 */
export function advanceWaitModeOf(task) {
  if (task?.advanceMode === 'teacher') return 'teacher';
  if (task?.advanceMode === 'ai_suggest') return 'student';
  return 'auto';
}

/** 记下"已完成，等谁推进"。跨回合存活，等的就是下一次（或下几次）回合里的解除。 */
export function markPendingAdvance(session, { task, completedId, mode, completion = {} }) {
  session.pendingAdvance = {
    mode,
    taskId: task?.id || '',
    completedId,
    // 见模块头：等待期间 pendingCompletion 已消失，同地点续做要靠这两个字段。
    completedLocationName: completion.completedLocationName || '',
    completedLocationStatus: completion.completedLocationStatus || '',
    completedVerification: completion.completedVerification || '',
    since: new Date().toISOString(),
  };
  return session.pendingAdvance;
}

export function pendingAdvanceOf(session, task) {
  const pending = session?.pendingAdvance;
  if (!pending) return null;
  // 任务已经不是当时那个（比如教师改了阶段又重开），这条等待就失效了，不要挂着。
  if (task && pending.taskId && pending.taskId !== task.id) return null;
  return pending;
}

export function clearPendingAdvance(session) {
  session.pendingAdvance = null;
}

function completedTaskKey(roleId, taskId) {
  return `${roleId}:${taskId}`;
}

function isTaskCompleted(session, roleId, taskId) {
  return session.completedTaskIds.includes(completedTaskKey(roleId, taskId));
}

function advanceResult({ role, session, nextTask, completion = {} }) {
  return {
    advanced: true,
    nextTask,
    continueAtSameLocation: Boolean(
      completion.completedLocationStatus === 'arrived'
      && completion.completedLocationName
      && nextTask.location?.name === completion.completedLocationName,
    ),
    previousVerification: completion.completedVerification,
  };
}

/** 线性 +1：不传 taskGraph 时的唯一行为，也是图有环时的回退路径。 */
function advanceLinear({ role, session, completion = {} }) {
  const tasks = role?.tasks || [];
  if (session.currentTaskIndex >= tasks.length - 1) {
    session.events.push(`${role.id}:all-tasks-completed`);
    return { advanced: false };
  }
  session.currentTaskIndex += 1;
  return advanceResult({ role, session, nextTask: tasks[session.currentTaskIndex], completion });
}

/**
 * 按任务图拓扑序找下一任务，并校验同角色 `前置` 是否都已出现在 completedTaskIds。
 *
 * 遍历模式口径（文档由 claude 收口）：
 * - `sequential`：按图拓扑推进 + 前置门禁（5 门存量课未写该字段，解析回落 sequential）；
 * - `open` / `inquiry`：仍不生效，维持预留（lesson-parser.js 注释口径不变）。
 */
function advanceWithGraph({ role, session, completion = {}, taskGraph }) {
  const tasks = role?.tasks || [];
  const roleId = role.id;
  const roleNodes = [...taskGraph.nodes.values()].filter((node) => node.roleId === roleId);
  const order = Array.isArray(taskGraph.testTraversalOrder)
    ? taskGraph.testTraversalOrder
    : traversalOrder(taskGraph, roleId);

  if (order.length < roleNodes.length) {
    console.warn(`[task-advance] 角色 ${roleId} 的任务图有环，回退线性推进`);
    return advanceLinear({ role, session, completion });
  }

  for (const key of order) {
    const node = taskGraph.nodes.get(key);
    if (!node || isTaskCompleted(session, roleId, node.taskId)) continue;

    const blockedBy = [];
    for (const prereqKey of node.prerequisites) {
      const prereqNode = taskGraph.nodes.get(prereqKey);
      if (!prereqNode || prereqNode.roleId !== roleId) continue;
      if (!isTaskCompleted(session, roleId, prereqNode.taskId)) {
        blockedBy.push(prereqNode.taskId);
      }
    }
    if (blockedBy.length) {
      return { advanced: false, blockedBy };
    }

    const taskIndex = tasks.findIndex((task) => task.id === node.taskId);
    if (taskIndex < 0) return { advanced: false };
    session.currentTaskIndex = taskIndex;
    return advanceResult({ role, session, nextTask: tasks[taskIndex], completion });
  }

  session.events.push(`${role.id}:all-tasks-completed`);
  return { advanced: false };
}

/**
 * 往前推一格。**唯一的写入点**。
 *
 * @returns {{ advanced: boolean, nextTask?: object, continueAtSameLocation?: boolean, previousVerification?: string, blockedBy?: string[] }}
 */
export function advanceToNextTask({ role, session, completion = {}, taskGraph = null }) {
  if (!taskGraph?.nodes?.size) {
    return advanceLinear({ role, session, completion });
  }
  return advanceWithGraph({ role, session, completion, taskGraph });
}

/**
 * 解除一条等待并推进。教师指令与学生确认共用。
 *
 * 只做合法性校验，不做教学判断——教师是现场的权威（沿用 T1 的口径）。但两条硬门禁：
 * ① 必须真的处于等待态；② 等的必须是这个 actor。否则老师一按按钮就能把学生
 * 推过**还没做**的任务，那不是"干预"，是丢进度。
 *
 * @param {'teacher'|'student'} actor 谁在解除
 * @returns {{ ok: boolean, reason?: string, result?: object }}
 */
export function resolvePendingAdvance({ role, session, actor, taskId = '', taskGraph = null }) {
  const task = currentTaskOf(role, session);
  const pending = pendingAdvanceOf(session, task);
  if (!pending) {
    return { ok: false, reason: 'NOT_WAITING' };
  }
  if (pending.mode !== actor) {
    return { ok: false, reason: 'WRONG_ACTOR' };
  }
  // 指令带了 taskId 就必须对得上：教师端的指令可能在学生已经换任务之后才轮询到。
  if (taskId && pending.taskId && taskId !== pending.taskId) {
    return { ok: false, reason: 'TASK_CHANGED' };
  }
  // 等待态本身就是"完成之后"才进入的，这里再核一次已完成记录，防止
  // pendingAdvance 被别的路径写脏后把学生推过没做的任务。
  if (pending.completedId && !session.completedTaskIds.includes(pending.completedId)) {
    return { ok: false, reason: 'NOT_COMPLETED' };
  }

  const result = advanceToNextTask({ role, session, completion: pending, taskGraph });
  clearPendingAdvance(session);
  return { ok: true, result };
}
