# R3-1 → R3-3：把任务图接成真正的执行器（Claude 块）

> 配套并行块：[`R3任务书-Cursor并行块二.md`](R3任务书-Cursor并行块二.md)（E1 表达式收敛／E2 附录 A 状态／E3 墙钟断言）。
> 前置已完成：R3-0（`推进方式` 三值全部接通，`tests/advance-task.test.js` 6 例）。

## 1. 为什么这三块归我

上一轮 R3-0 治的是"**谁来推**"（自动／学生／教师）。这三块治的是"**往哪推**"——而"往哪推"每错一次，学生就会卡在一个没有出路的任务上，且**不会报错**，只会安静地不动。这类改动的失败模式是静默的，所以不外包。

具体地说，三块各自的决策含量：

- **R3-1**：表面是重构，实际要判断"哪些 `Math.min` 是在取当前任务、哪些是在取**边界内的最后一个**任务"——两者今天恰好同一个表达式，但语义不同，R3-2 换成读图后会分叉。判断错了，R3-2 才会暴雷。
- **R3-2**：`currentTaskIndex` 从"推进依据"降级为"位置读数"，但它同时是**对外契约**（前端 `roleState.progress`、`learning-view.js`、教师端 presence 都在读）。降级而不破契约，需要设计。
- **R3-3**：`open` 模式要定"学生能自选时，AI 该怎么开口"——这是教学语义，不是工程选择。

## 2. 当前基线（每块开工前重跑）

```bash
cd 4-stu-learning
npm test                                        # 297 pass / 0 fail
npm run lint:lesson                             # 0 error，57 warning
shasum -a 256 src/generated/lesson-public.js    # a96c9009d4399f4fbdeda6cc212deaadcaf50a4182edf2b2f4b5583e2d4348d3
```

已核实的图侧事实（2026-08-08 实测，R3-2 的等价性基础）：

| 事实 | 数字 |
|---|---|
| 角色数 | 29 |
| 角色任务节点（`scope === 'role'`） | 87 |
| 带 `prerequisites` 的节点 | 58（**全部是单前置链式**，实测无一个真分叉） |
| `traversalOrder` 与线性 `+1` 不一致的角色 | **0** |
| 5 门课的 `traversalMode` | 全部 `sequential` |
| `traversalOrder` 的运行时读者 | **0**（只有测试与 lint 在用） |
| `currentTaskIndex` 的写入点 | **1 处**（`task-advance.js:85`，R3-0 已收敛） |

最后两行是关键：图**装配好了但没人读**，而写入已经只有一处。所以 R3-2 是"给一个已经收口的写入点换内部实现"，不是"到处改推进逻辑"。

### 2.1 一条对自己的诚实提醒

58 个前置**全是单前置链式**（`task-2` 前置 `task-1`，逐个实测确认）。也就是说：**今天没有任何一门课需要图**。R3-2 换成读图，对存量 5 门课的可观察行为是**零变化**——它不解决任何现存的学生体验问题。

它的价值只有两条，都要如实认：

1. **让 `open`（R3-3）与失败路由成为可能**——那两个才是真需求，但它们依赖读图先落地；
2. **让"教师跳过任务后前置永远不满足"变成可观测的**（§4.2-2）——这是唯一一个今天就可能咬人的场景，因为 R3-0 刚刚给教师发了 `advance_task` 这把能跳任务的刀。

如果做到一半发现 R3-3 不做了，**R3-2 应该跟着不做**，不要留一个纯抽象收益的重写在仓库里。这个判断要在 R3-2 动手前先跟用户确认一次。

## 3. R3-1：收敛"取当前任务"，并把两种语义分开

### 3.1 现状

```bash
grep -c "Math.min(session.currentTaskIndex" server/agent/service.js   # 11
grep -c "taskIndex === session.currentTaskIndex" server/agent/service.js  # 3
```

`server/agent/tools.js` 另有 2 处。**这 16 处的机械替换分给了 Cursor（E1）**，我做的是替换之前的那一步：**分类**。

### 3.2 要判断的事

那 11 处 `role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)]` 里，`Math.min` 的作用有两种可能：

- **(a) 取当前任务**，`Math.min` 只是防越界的保险（正常情况下 index 本来就在范围内）；
- **(b) 故意取"最后一个任务"**，即全部完成后 index 已经越界，这里靠夹取回落到末尾任务，用它的信息渲染收尾文案。

今天两者写法相同、结果相同，所以无人区分。但 R3-2 之后"当前任务"要从遍历序列里取，而"最后一个任务"仍是 `tasks[length-1]`——**(b) 类如果跟着改成读图，全部完成后会取到 `undefined`，收尾话术直接崩**。

做法：逐处读上下文归类，(a) 换 `currentTaskOf`，(b) 换一个新函数 `lastTaskOf(role)` 并在注释里写明"这里要的是末尾任务，不是当前任务"。

### 3.3 验收

- 297 例一个不动（分类正确的判据：行为完全不变）；
- 归类结果写进 `task-advance.js` 的模块注释，附每处的行号与理由；
- **牙齿验证**：把某个 (b) 类改成 `currentTaskOf`，构造"全部任务完成"的会话，断言必须变红。这条测试要留在 `tests/advance-task.test.js` 里——它是 R3-2 的安全网。

## 4. ~~R3-2：`advanceToNextTask` 内部换成读图~~（已取消，2026-08-08）

> **取消原因**：§2.1 那条"诚实提醒"里就写了——R3-2 单独做**零可观测行为变化**（`traversalOrder` 对 29 个角色的输出与线性顺序逐条相同，已实测），它的价值全部寄托在 R3-3 的 `open` 上。用户定了 `open` 本轮不做，R3-2 就只剩"为了将来好改而现在重写一遍"，不值得。
>
> 下面这段设计**原样留档**，不是废纸：真做图执行器时 4.2 的两个判断（`currentTaskIndex` 契约降级、前置不满足不许静默卡死）仍然成立且仍是最难的两处。补漏的动作见 §5 的 R3-3′。

### 4.1 改法（留档）

`advanceToNextTask({ role, session, completion })` 的**签名与返回值不变**，内部从：

```js
session.currentTaskIndex += 1;
const nextTask = tasks[session.currentTaskIndex];
```

换成：

1. 在 `traversalOrder(graph, role.id)` 里定位当前节点；
2. 往后找第一个 `prerequisites` 全在 `session.completedTaskIds` 里的节点；
3. `currentTaskIndex` 设为该节点的 `taskIndex`（**保留字段，只是不再是依据**）。

等价性保证：`traversalOrder` 对 29 个角色的输出与线性顺序**逐条相同**（已实测 0 不一致，`tests/task-graph.test.js` 有断言钉住）。所以 5 门课的行为必须一字不变。

### 4.2 要设计的两件事

**(1) `currentTaskIndex` 的契约降级。** 它有多个外部读者：

```bash
grep -rn "currentTaskIndex" src/ server/app.js server/course/  # 前端 progress、learning-view、presence 上报
```

降级方案：它继续表示"当前任务在 `role.tasks` 里的下标"，这对所有现有读者都成立且不变。**不引入 `currentTaskId` 双写**——上一版任务书写的"双写过渡一个版本再切读"在只有一个写入点的今天是多余的复杂度，砍掉。

**(2) 前置不满足时怎么办。** 图里有 58 个带前置的节点。线性课程里前置天然满足（前一个刚做完），但一旦：

- 教师用 `advance_task` 跳过了某个任务 → 后面某个节点的前置永远不满足 → **学生卡死且无提示**；
- 或者课程写了指向不存在任务的 `前置`（D2 已加 lint 告警，但存量课程可能有）。

这是本块最重要的一个判断：**卡住时必须能被观测到**。方案是找不到可推进节点时，不静默停住，而是记一条会话事件并把等待态标成"需要教师介入"，让教师端看得见。具体做法开工时定，但"不能静默卡死"是硬要求。

### 4.3 验收

- 5 门课 29 个角色的推进序列与 R3-2 之前**逐条相同**（新增一条端到端测试，不只是 `traversalOrder` 单测）；
- 构造一个"前置不满足"的会话 → 断言有可观测信号，**不是静默停住**；
- **牙齿验证**：把读图逻辑改回 `+= 1`，"前置不满足"那条测试必须变红。

## 5. ~~R3-3：`遍历模式：open`~~ → 改为 R3-3′：把 `open` 变成**显式预留**

**用户已定：`open` 本轮不做，保留未来空间即可。** R3-2（读图取代 `+= 1`）随之一并取消——`open` 是它唯一的可观测收益，5 门课全是 `sequential`，只做 R3-2 等于零行为变化的重写。

取消带来一个**必须补的漏**，这就是 R3-3′：

`traversalMode` 在 `server/` 下**零消费者**（实测），所以写 `open` 与写 `sequential` 行为完全一样。而 D2 当时刻意只警告 `inquiry`、**放过 `open`**（`tests/lint-prerequisite-scope.test.js` 有一条 `test('course.md 写 open 不报错')`），前提是本轮会实现它。前提没了，放过它就从"合理"变成**静默陷阱**：课程作者写下 `open`，lint 全绿，学生端照线性跑，作者以为自己开了自选顺序。

R3-3′ 的三处改动：

1. `scripts/lint-lesson.mjs`：`unsupported_traversal_mode` 覆盖 `open` 与 `inquiry` 两个值（改成一张表，顺带把"运行时按 sequential 处理"写进 message）；
2. `tests/lint-prerequisite-scope.test.js`：那条"写 open 不报错"改成两个值都必须收到 warning，并断言 warning **不升级成 error**（预留字段不该挡编译）；
3. spec §9 改成一张状态表：`sequential` 生效、`open`/`inquiry` 预留；并写明「未来空间落在**图**上而不是这个字段值上」——`前置` 已装配成真的任务图节点与边，图执行器落地时读那张图。

`traversalOrder`／`前置` 的装配**一行不动**。未来空间保在图里，不保在一个会骗人的字段值上。

## 6. 全局验收

```bash
cd 4-stu-learning && npm test    # ≥ 297，只增不减（实际交付 304）
npm run lint:lesson              # 0 error
npm run build
cd .. && npm run verify
```

实际交付范围是 **R3-0 ＋ R3-1 ＋ R3-3′**（R3-2 与 R3-3 已取消，见 §4／§5）。逐条结果：

1. **等价性**：本轮没有替换推进实现，5 门课 29 个角色的顺序天然不变；
2. ~~**不静默卡死**：前置不满足时有可观测信号~~ → 随 R3-2 取消。**这条仍是欠账**：教师 `advance_task` 跳过任务后，后续带前置的节点无人校验（今天线性推进也不读前置，所以不会卡死，但也等于前置对运行时无效）；
3. **零泄漏**：`前置`／`遍历模式` 不进浏览器包 ✅；
4. **runtime 墙不破**：`course-run-service.js` 的 import 仍只有 `node:crypto` 一行 ✅；
5. **公开包指纹不变**：`a96c9009…` ✅（本轮不碰课程内容，R3-3′ 只动 lint 与文档）；
6. **牙齿验证**：R3-1 摘掉夹取 → 2 条变红；R3-1 恢复同名导出 → import 失败；R3-3′ 把 `open` 从告警表里删掉 → 1 条变红。全部实测过 ✅。

## 7. 与 Cursor 的交接点

| 时点 | 动作 |
|---|---|
| R3-1 分类完成并提交后 | 告诉 Cursor "R3-1 已提交"，它才能动 `service.js` 的 14 处（E1 后半） |
| Cursor 加 `currentToolOf` 到 `task-advance.js` 时 | 该文件我也在改——**它只加新导出、不改已有函数**，冲突面很小，但我提交前要看一眼 |

其余文件无交集：Cursor 这轮碰 `tools.js`、`lint-lesson.mjs`、`understanding.test.js`、spec 附录 A。

## 8. 本轮不做

- **阶段任务的执行**（学生端渲染集体任务需要"无 roleId 会话"或"小组共享会话"，是独立一轮）；
- **图执行器本体**（R3-2）与 `open`／`inquiry` 两个遍历模式——用户已定本轮只保留未来空间。`前置` 仍装配进图但运行时不读；下一轮做时 §4 的留档就是起点；
- `失败处理`／`教师介入` 的失败路由运行时（D1 已加 lint，运行时挂点等 R3-2 的图跑通再接）；
- E3 教师身份认证（`x-teacher-id`）——**上线阻塞项**，需独立立项；
- `toTeacherView`；
- #12 轻量回合日志（用户已明确延后）。
