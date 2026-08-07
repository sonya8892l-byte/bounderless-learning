# Cursor 并行块（第二轮）：E1 表达式收敛 · E2 附录 A 守护测试 · E3 墙钟断言去脆

> 上一轮 D1/D2/D3 已提交（`aa0c609`／`4d66faf`／`b3fb3c6`），这轮是新的三块。
> 三块**互不依赖**，可任意顺序、可并行。

## 读我：这一轮的边界（最重要）

Claude 同时在改**推进语义**（R3-1 收敛 → ~~R3-2 读图 → R3-3 `open` 模式~~，后两块 2026-08-08 已取消，见下）。下面这些文件**你不要碰**，否则会撞车：

| 文件 | 谁在改 |
|---|---|
| `server/agent/task-advance.js` | Claude（R3-1 的核心，已提交） |
| `server/agent/service.js` | Claude（同上）——**唯一例外见 E1，R3-1 已提交，你可以动了** |
| `server/agent/turn-router.js` | Claude |
| `server/course/task-graph.js` | ~~Claude（R3-2 要加读图入口）~~ R3-2 取消，本轮无人动 |
| `src/app-controller.js` | Claude |
| `tests/advance-task.test.js` | Claude |
| `tests/task-graph.test.js` | Claude |

你这轮碰的是：`server/agent/tools.js`、`scripts/lint-lesson.mjs`、`tests/understanding.test.js`、`6-lessons/COURSE-SUBMISSION-SPEC.md` 的附录 A，以及三个**新建**测试文件。

**新建测试文件，不要改已有的**（除 E3 明确指定的那一个）。

### ⚠️ 2026-08-08 补：两处新增的交集（拉最新代码后再动手）

`open` 模式取消后 Claude 做了 R3-3′，**动到了你的两个文件**，都已提交：

| 文件 | Claude 改了什么 | 对你的影响 |
|---|---|---|
| `scripts/lint-lesson.mjs` | 末尾 `unsupported_traversal_mode` 那段：从只警告 `inquiry` 改成一张表，`open`／`inquiry` 都警告 | 只碰这一段（约 20 行），你 E2 不动这个文件的话没影响；要动请先 `git pull` |
| `tests/lint-prerequisite-scope.test.js` | 你 D2 建的文件。那条 `test('course.md 写 open 不报错')` 与新行为直接矛盾，已改成两个值都断言收到 warning | 这是唯一一处"改了你的已有测试"，原因是断言本身过时了，不是加需求 |
| `6-lessons/COURSE-SUBMISSION-SPEC.md` | §9 改成状态表；附录 A 的 `遍历模式` 行补了"仅 sequential 执行" | 你 E2 是**建守护测试**、不是改附录 A，所以正常无交集；真要改先 pull |

## 当前基线（动手前先确认这三个数对得上）

```bash
cd 4-stu-learning
npm test                                        # 304 pass / 0 fail（含你已落的 E2/E3 与 Claude 的 R3-0/R3-1/R3-3′）
npm run lint:lesson                             # 0 error，57 warning
shasum -a 256 src/generated/lesson-public.js    # a96c9009d4399f4fbdeda6cc212deaadcaf50a4182edf2b2f4b5583e2d4348d3
```

对不上先停下问，不要往下做——说明工作树里有别人未提交的改动。

**这三个数做完必须仍然成立**（测试数只增不减；sha256 一位都不许变，因为这三块都不碰课程内容）。

⚠️ **有一条已知脆测试**，不是你弄坏的：`tests/serverless-api.test.js` 的「整次 turn 超过服务端 deadline 时返回可重试错误且不保存请求」。它设 `AI_TURN_TIMEOUT_MS: 15`，15 毫秒的预算在跑全量时会被别的测试挤掉，约一半的全量跑会红（单跑该文件 5 次全绿，已实测；在 R3-3′ 之前的 HEAD 上同样会红）。**这正是 E3 那类墙钟断言的问题**，看到它红先单跑该文件确认，再继续。

## E1：把重复的"取当前任务／当前工具"表达式收敛掉

### 问题（实测，不是推测）

同一个表达式在全仓抄了 16 遍：

```bash
grep -c "Math.min(session.currentTaskIndex" server/agent/service.js   # 11
grep -c "taskIndex === session.currentTaskIndex" server/agent/service.js  # 3
```

加上 `server/agent/tools.js` 的 2 处（`tools.js:41`、`tools.js:45`），一共 **12 处 `Math.min` ＋ 4 处 `tools.find`**。

`server/agent/task-advance.js` 已经导出了收敛函数（Claude 在 R3-0 建的，**已提交，可以直接 import**）：

```js
export function currentTaskOf(role, session)   // 取当前任务，含 Math.min 夹取
```

"取当前工具"那个语义**已经有一个私有实现**了：`server/agent/tools.js:40` 的 `function currentTool(role, session)`。它没被导出，所以 `service.js` 又抄了 3 遍。**要做的是把它提升成共享导出，而不是新写一个**——新写就是第二份实现，回到起点。

### 你要做的

**⚠️ 时序**：E1 动 `service.js`，而 Claude 的 R3-1 也动它。**先做 E2、E3，E1 放到最后**；开工前确认 Claude 已经说过"R3-1 已提交"。如果还没提交，就只做 `tools.js` 那 2 处（那个文件 Claude 不碰），`service.js` 的 14 处留着。

1. 把 `server/agent/task-advance.js` 里的 `currentToolOf` 加成导出，**函数体逐字照抄 `tools.js:40` 现有的那个**，不要"顺手加空值兜底"：

```js
/** 当前任务对应的工具实例。收敛 tools.js 的私有 currentTool ＋ service.js 抄的 3 遍。 */
export function currentToolOf(role, session) {
  return role.tools.find((tool) => tool.taskIndex === session.currentTaskIndex);
}
```

2. `server/agent/tools.js`：删掉私有的 `currentTool`，改 import `currentToolOf`；`tools.js:45` 换成 `currentTaskOf`。
3. （Claude 提交 R3-1 之后）把 `service.js` 里剩下的换掉。

### 边界（这条最容易做错）

`currentTaskOf` 在 `role.tasks` 为空时返回 `undefined`，原表达式 `role.tasks[Math.min(0, -1)]` 即 `role.tasks[-1]` 也是 `undefined`。**行为相同**，可直接替换。

`currentToolOf` 必须**逐字保留** `role.tools.find(...)`：不要写成 `(role?.tools || []).find(...)`。看着更安全，但那会把"`role.tools` 是 undefined"从抛错变成静默返回 `undefined`，而下游 `taskToolCall(tool)` 拿到 `undefined` 只会渲染出一张空工具卡——**错误从崩溃降级成了静默坏体验**，这个方向是错的。行为不变优先。

### 验收

```bash
cd 4-stu-learning && npm test    # 297 一个不少，一个不多
grep -rn "Math.min(session.currentTaskIndex" server/    # 只应剩 task-advance.js 内部那 1 处
```

**这一步严禁改变任何行为**。不要顺手"优化"取值逻辑、不要加空值兜底、不要改函数签名。判断标准就一条：**297 例一个不动**。

不新增测试——这块的验收就是"存量测试全绿且数量不变"。如果你觉得需要新测试来证明收敛正确，说明你改动的不只是表达式形状，停下来问。

## E2：给 spec 附录 A 加一条守护测试（防它再次漂成愿望清单）

### 问题

附录 A（`COURSE-SUBMISSION-SPEC.md` 末尾的"字段 → 运行时状态"表）**今天是准的**——你上一轮 D1 已经把 `失败处理`／`教师介入` 那几行改对了，我核过，措辞比我原本想要求的还准。**这一块不是让你再改它。**

问题是它**没有任何东西守着**。这张表被改错过至少两次：

- `推进方式` 长期标着"生效"，实际三个值里两个是死的（R3-0 才接通，2026-08-08）；
- `### 阶段任务N` 一度需要人工提醒才没标成"生效"。

它是课程团队唯一的权威参考。标错一格，课程团队就会写一个不生效的字段，而且**要到现场上课才发现**。这类漂移必须由测试拦，不能靠人记得核。

### 你要做的

只新建一个文件：`4-stu-learning/tests/spec-appendix-status.test.js`。**不改 spec，不改任何代码。**

思路：解析附录 A 的表格行，对标成"生效"的字段，断言它在 `server/` 里真有消费者。

```js
// 读 ../6-lessons/COURSE-SUBMISSION-SPEC.md，取附录 A 的表格行。
// 对每行：状态列含"生效"且不含"未接"/"预留"/"废止" → 该字段必须在 server/ 下有消费者。
// 中文字段名到驼峰的映射在 src/engine/lesson-parser.js 里查（如 遍历模式 → traversalMode）。
// 查不到映射的字段跳过并在测试输出里列名字——不要静默跳过，那等于没测。
```

实现细节你定，但要满足两条：

1. **不能靠一张硬编码的字段白名单**。那样表加了新行测试也不会发现，等于没守。要从 spec 文本里真的解析出来。
2. **失败信息要能直接行动**：报出是哪个字段、标的什么状态、在 `server/` 里搜不到什么标识符。

### 边界

- 如果你在实现过程中发现**某一行其实标错了**（标"生效"但真的搜不到消费者），**不要顺手改 spec**。把字段名报给我，我判断是标错了还是代码里换了名字——这两种情况的修法相反，改错方向会把一个真 bug 掩盖成文档问题。
- 拿不准某个字段算不算"有消费者"（比如只在注释里出现），就算**没有**，然后报给我。宁可测试太严被人来问，不要太松放过漂移。

### 验收

```bash
cd 4-stu-learning
node --test tests/spec-appendix-status.test.js    # 绿
npm test                                          # 297 + 你新增的例数
npm run lint:lesson                               # 仍 0 error 57 warning
shasum -a 256 src/generated/lesson-public.js      # sha256 一位不变（你没碰课程内容）
```

**牙齿验证**：临时把 spec 里 `失败处理` 那行的状态改成"生效"，这条测试必须变红；改回来再提交。**这一步必须真做并把结果写进 commit message**——守护测试自己不被验证过，就只是一个总是绿的装饰。

## E3：两条墙钟断言会随机变红

### 问题（我实测撞到过）

`tests/understanding.test.js` 有两条按真实时间判断的断言：

```js
tests/understanding.test.js:154:  assert.ok(Date.now() - startedAt < 2000, '必须在总预算内返回');
tests/understanding.test.js:201:  assert.ok(Date.now() - startedAt < 1_500, `不应耗尽 5s 预算，实际 ${Date.now() - startedAt}ms`);
```

`npm test` 并行跑 40 个测试文件时，第 154 行会偶发变红（我遇到过一次：单独跑 3 次全绿，全量跑第一次红、后两次绿）。**这不是 bug，是断言太脆**——它想证明的是"预算机制生效、没有重试到超时"，不是"这台机器有多快"。

### 你要做的

改 `tests/understanding.test.js`（**这是唯一允许你改的已有测试文件**）。

把"经过的墙钟时间"换成"**可观测的行为**"。这两条断言真正要证的是：

- 第 154 行：预算耗尽后**不再重试**（模型调用次数应为 1，而不是 2），且返回的是保守默认值；
- 第 201 行：没有把 5s 预算跑满——等价说法是**底层请求被取消了**（`AbortSignal` 已 abort），而不是自然返回。

优先改成断言调用次数与 abort 状态。保留时间断言也行，但阈值要放到不会误报的量级（如 `< 10_000`），并在注释里写明"这条只防死循环，不测性能"。

### 边界

**不要改被测代码**（`server/agent/understanding.js`）。这块只动测试。如果你发现必须改被测代码才能观测到（比如现在拿不到调用次数），停下来问——那说明可观测性不足，是另一件事。

### 验收

```bash
cd 4-stu-learning
node --test tests/understanding.test.js       # 10 pass
for i in 1 2 3 4 5; do npm test 2>&1 | grep "^ℹ fail"; done   # 五次全 0
```

测试数仍是 297（改断言不改数量）。

## 收尾（三块都完成后）

```bash
cd 4-stu-learning
npm test              # ≥ 297，0 fail
npm run lint:lesson   # 0 error，57 warning
npm run build
cd .. && npm run verify
shasum -a 256 4-stu-learning/src/generated/lesson-public.js   # a96c9009… 不变
```

按块分开提交，每个 commit message 写清"改了什么 ＋ 为什么 ＋ 牙齿验证结果"。

## 有疑问时的判断顺序

1. **先查代码，别猜。** 上一轮我给你的任务书里有三条断言是错的（我自己没核就写了），你如果发现任务书与代码不符，**以代码为准**并告诉我。
2. **只改任务书点名的文件。** 手痒想顺手修的，记下来单独说。
3. **行为不变的块（E1）就是真不变。** 判断标准是测试数与结果都不动，不是"我觉得等价"。
4. **拿不准是不是越界了，就是越界了。** 停下来问，比回滚便宜。
