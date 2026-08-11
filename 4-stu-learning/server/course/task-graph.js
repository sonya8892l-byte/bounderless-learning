/**
 * 任务图装配（D2：`前置` 为进度语义权威，`通过后` 是线性课程的语法糖）。
 *
 * 本模块**只装配、不执行**。运行时的推进仍是 service.js 的 currentTaskIndex += 1，
 * 换成读图是 R3 的事——先把图立住，R3 才有东西可读。
 *
 * ## 为什么节点键是 `roleId/taskId` 而不是 taskId
 *
 * task id 在课程内**不保证唯一**。实测：lesson_gewu_001 的 18 个任务去重后只有 3 个，
 * lesson_zhuhun_001 的 15 个去重后也只有 3 个——每个角色都从 task-1 重新编号。
 * gewu 的 step id 同样跨角色重复（54 个去重后 9 个）。
 * 按 taskId 建索引会把 18 个任务静默塌成 3 个，且不报错。所以键必须带角色前缀。
 *
 * ## 两种作用域：角色任务与阶段任务
 *
 * 角色任务的键是 `roleId/taskId`，阶段任务（非角色任务：全班看短片、小组拼合、个人反思）
 * 的键是 `phaseId/taskId`。两者同处一个 Map 但撞不上——角色 slug 不会等于 `phase-N`。
 * 阶段节点刻意 `roleId: ''`，因此 traversalOrder 过滤角色时自动把它们排除在外。
 * 跨作用域的边本轮不支持：阶段任务与角色任务之间的依赖要等执行器（R3）定清语义。
 *
 * ## `通过后` 的三种前缀
 *
 * - `step:<stepId>`      同任务内的下一小步（小步层保持线性，不进任务图的边）
 * - `role-stage:<taskId>` 跨任务：本任务完成后解锁该任务
 * - `role:<taskId>`       同上（历史写法，语义等价）
 * - `*:complete`          角色终止
 */

export function nodeKey(roleId, taskId) {
  return `${roleId}/${taskId}`;
}

/**
 * 阶段任务的节点键。
 *
 * 与角色节点同处一个命名空间，但撞不上：作用域段这里是 `phase-1` 这样的阶段 id，
 * 角色那边是角色 slug（`dragon-counter`、`label-recorder`…），两者不会相等。
 */
export function phaseNodeKey(phaseId, taskId) {
  return `${phaseId}/${taskId}`;
}

/** 解析 `通过后` 的取值 → { kind, target }。空值与无前缀都归为 unknown。 */
export function parseNextRef(value = '') {
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

/**
 * 由 `通过后` 反向推导出每个任务的入边（`前置`）。
 *
 * 课程若显式写了 `前置`，以它为权威；只有 `前置` 为空时才用 `通过后` 推导。
 * 这正是 D2 说的"`通过后` 保留为线性语法糖，编译期转换"。
 */
export function buildTaskGraph(roles = [], phases = []) {
  const nodes = new Map();
  const warnings = [];
  // 显式声明了 `前置` 的节点：它们的入边由课程作者决定，不接受语法糖回填。
  const declaredNodes = new Set();

  for (const role of roles) {
    for (const [taskIndex, task] of (role.tasks || []).entries()) {
      const key = nodeKey(role.id, task.id);
      if (nodes.has(key)) warnings.push({ code: 'duplicate_task', message: `任务节点重复：${key}` });
      nodes.set(key, {
        key,
        scope: 'role',
        roleId: role.id,
        taskId: task.id,
        taskIndex,
        prerequisites: [],
        next: [],
        terminal: false,
      });
    }
  }

  // 阶段任务（非角色任务）。刻意**不带 roleId**：它们不属于任何角色，
  // traversalOrder 按 roleId 过滤，因此这些节点自动不进角色遍历——
  // 87 个角色节点、29 个终止节点的既有口径不受影响。执行是 R3 的事。
  for (const phase of phases) {
    for (const [taskIndex, task] of (phase.tasks || []).entries()) {
      const key = phaseNodeKey(phase.id, task.id);
      if (nodes.has(key)) warnings.push({ code: 'duplicate_task', message: `任务节点重复：${key}` });
      nodes.set(key, {
        key,
        scope: 'phase',
        roleId: '',
        phaseId: phase.id,
        executor: task.executor || '全班',
        taskId: task.id,
        taskIndex,
        prerequisites: [],
        next: [],
        terminal: false,
      });
    }
  }

  const resolveTarget = (scopeId, target) => {
    const key = nodeKey(scopeId, target);
    return nodes.has(key) ? key : '';
  };

  // 角色任务与阶段任务的边解析规则完全一样，只差作用域前缀（角色 slug / 阶段 id）。
  // 所以把这段抽出来共用：写两遍必然会漂。跨作用域的边本轮不支持——
  // 阶段任务与角色任务之间的依赖要等执行器（R3）定清语义再开。
  const linkEdges = (scopeId, tasks) => {
    for (const task of tasks || []) {
      const node = nodes.get(nodeKey(scopeId, task.id));
      if (!node) continue;

      // 显式 `前置` 优先：写了就以它为权威，语法糖不再往这个节点加入边。
      const declared = (task.prerequisites || [])
        .map((value) => String(value).trim())
        .filter(Boolean);
      if (declared.length) {
        declaredNodes.add(node.key);
        for (const value of declared) {
          const target = resolveTarget(scopeId, value);
          if (target) node.prerequisites.push(target);
          else warnings.push({ code: 'unknown_prerequisite', message: `${node.key} 的前置 ${value} 不存在` });
        }
      }

      // 出边与终止标记始终从 `通过后` 读取——它们和入边是两件事，
      // 写了 `前置` 的任务同样需要知道自己是不是角色的最后一个任务。
      for (const step of task.steps || []) {
        const { kind, target } = parseNextRef(step.next);
        if (kind === 'complete') {
          node.terminal = true;
          continue;
        }
        if (kind === 'task') {
          const targetKey = resolveTarget(scopeId, target);
          if (!targetKey) {
            warnings.push({ code: 'unknown_next', message: `${node.key} 的小步 ${step.id} 指向不存在的任务 ${target}` });
            continue;
          }
          if (!node.next.includes(targetKey)) node.next.push(targetKey);
          continue;
        }
        if (kind === 'unknown') {
          warnings.push({ code: 'unparsable_next', message: `${node.key} 的小步 ${step.id} 的通过后无法解析：${step.next}` });
        }
        // kind === 'step'：小步层线性推进，不构成任务图的边。
      }
    }
  };

  for (const role of roles) linkEdges(role.id, role.tasks);
  for (const phase of phases) linkEdges(phase.id, phase.tasks);

  // 出边确定后回填入边，得到 `前置` 语义。
  // 显式声明过 `前置` 的节点跳过回填：作者写的入边是权威，语法糖不能往里加。
  for (const node of nodes.values()) {
    for (const targetKey of node.next) {
      const target = nodes.get(targetKey);
      if (!target || declaredNodes.has(targetKey)) continue;
      if (!target.prerequisites.includes(node.key)) target.prerequisites.push(node.key);
    }
  }

  return { nodes, warnings };
}

/**
 * 按拓扑顺序给出每个角色的任务序列。
 *
 * 入度为 0 的节点按课程书写顺序（taskIndex）起步，因此线性课程的结果与
 * 今天 `currentTaskIndex += 1` 的遍历完全一致——这是 R3 切换的等价性保证。
 */
export function traversalOrder(graph, roleId) {
  const nodes = [...graph.nodes.values()]
    .filter((node) => node.roleId === roleId)
    .sort((a, b) => a.taskIndex - b.taskIndex);
  const scope = new Set(nodes.map((node) => node.key));
  const pending = new Map(nodes.map((node) => [
    node.key,
    node.prerequisites.filter((key) => scope.has(key)).length,
  ]));

  const order = [];
  while (order.length < nodes.length) {
    const ready = nodes.find((node) => pending.get(node.key) === 0);
    if (!ready) break; // 有环：交给调用方判断，不静默丢节点。
    order.push(ready.key);
    pending.set(ready.key, -1);
    for (const targetKey of ready.next) {
      if (pending.has(targetKey) && pending.get(targetKey) > 0) {
        pending.set(targetKey, pending.get(targetKey) - 1);
      }
    }
  }
  return order;
}
