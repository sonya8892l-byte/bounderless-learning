# 教师端 MVP 开发任务书 · Cursor 并行块（TC1／TC2／TC3）

> 文档性质：**开发任务书**，2026-08-07 晚下发
> 对应阶段：教师端最小 MVP（把已发出但不生效的指令接通）
> 分工：断链修复主体（T1 `advance_phase` 接通、T2 `set_scaffold` 写回、T3 `evidenceCount` 真实化）由另一侧并行进行，**不在本任务书范围内**。本任务书只含三块与主体互不碰同一文件的活。

---

## 0. 开工前必读

### 0.1 教师端不是待开发，是已建成但有几根线没接上

先纠正一个容易走偏的预设：`4-tea-leading/` 四个视图（场次／态势／待处理／回看）＋ 491 行 `app.js` 全部跑通，后端 `server/runtime/` 的 18 个指令、场次、告警状态机、CSV 名单导入、弱网轮询、审计全部就位，6 项教师端测试通过。`4-tea-leading/README.md` 列的七块「已实现」名副其实。

**所以本轮不是补功能，是补"教师以为生效、实际没生效"的断链。** 不要新建视图、不要新建接口、不要重写既有模块。

### 0.2 三条断链（主体在修，你需要知道，因为 TC2 会断言它们）

同一个根因：**`server/runtime/course-run-service.js` 只 `import crypto from 'node:crypto'`，完全碰不到 agent 会话存储**。它能改的只有场次记录（`run.*`、`participant.learning.*`），而真正驱动学生体验的是 agent session（`session.phaseId`、`session.scaffoldLevel`）。

| 断链 | 教师看到 | 实际发生 |
|---|---|---|
| `advance_phase` | 「已推进至下一阶段」 | 学生端 `applyTeacherCommand` 的 10 个 `action ===` 分支里**没有这一支**，指令投递成功后被静默丢弃 |
| `set_scaffold` | 「老师已调整后续提示深度」 | 服务端写 `participant.learning.scaffoldLevel`（场次展示字段），而取哪一档提示读的是 `session.scaffoldLevel` |
| `evidenceCount` | 「已提交 N 项证据」 | 全仓只有一处赋值：`course-run-service.js:79` 的 `index % 4`，**演示种子，永不更新** |

### 0.3 已经生效、不要误判为待做的

改动前请确认这几条是对的，别把它们「顺手修坏」：

- `approve_evidence` 与 `skip_step` **真的推进／跳过小步**——`src/app-controller.js:2225-2248` 判断 `completionMode === 'teacher_confirm'` 后直接发起 `task_step_completed` 回合；
- `confirm_arrival` 真的解位置门禁（`course-run-service.js` 里置 `insideFence = true`）；
- presence 上报是真的——`src/app-controller.js:1378` 每次都报真实 `progress`；
- 指令投递链完整：`sendCommand` → 每个 participant 一条 `status: 'accepted'` 回执 → `commandsForSession` 按回执过滤下发。

### 0.4 当前基线（请先自行复现，作为"我没弄坏东西"的锚点）

```bash
cd 4-stu-learning && npm test
```

**223 项测试全部通过，约 4 秒。** 这是本任务书所有 DoD 的下界：改完不得低于 223，不得有 fail。

已知一条既有 flake（**与本轮无关，不要试图修**）：`tests/serverless-api.test.js:442` 「整次 turn 超过服务端 deadline 时返回可重试错误且不保存请求」，用 `AI_TURN_TIMEOUT_MS: 15`（15 毫秒），在改动前的树上就会偶发失败（实测 10 次跑失败 2 次）。跑到它红了重跑一次即可。

---

## TC1：教师端指令回执可见性

### 为什么要做

教师发出指令后只有一个 toast（`app.js` 的 `showToast`），**不知道学生是否真的收到**。现场带 30 个学生时这很要命：老师发了「紧急集合」，看到"已发送"，但不知道是 30 个人都收到了还是只有 3 个。

回执数据**已经存在**，只是没有展示。

### 落点（只碰这两个文件）

- `4-tea-leading/app.js`
- `4-tea-leading/styles.css`

### 数据来源（不要新建接口）

已有的 `GET /api/teacher/runs/:runId/events`，`app.js` 里已经在轮询它。回执状态机在 `server/runtime/course-run-service.js`：

- 发指令时每个目标 participant 建一条回执，初始 `status: 'accepted'`；
- 学生端应用后回报 `delivered`（`src/app-controller.js:2257`）；
- 学生点确认弹窗后回报 `confirmed`（`src/app-controller.js:2379`，仅 `pause`／`emergency_rally` 这类走弹窗的指令）；
- 状态流转在 `confirmCommand()`，`failed` 也是合法终态。

三态含义要在 UI 上说清，别让老师把 `accepted`（服务端已接单）误读成「学生已收到」：

| 状态 | 含义 | 建议文案 |
|---|---|---|
| `accepted` | 服务端已接单，学生端还没拉到 | 已下发 |
| `delivered` | 学生端已应用 | 已送达 N/M |
| `confirmed` | 学生本人点了确认 | 已确认 N/M |
| `failed` | 应用失败 | 失败 N |

### 要求

1. 指令列表／详情里显示该指令的回执聚合（如「已送达 28/30 · 已确认 12/30」），随轮询更新；
2. `HIGH_IMPACT` 那批指令（`app.js:7`：`pause`／`advance_phase`／`end_run`／`approve_evidence`／`skip_step`／`emergency_rally`）要更醒目——这些是会真影响学生的；
3. 弱网／离线时（`app.js` 已有 `setConnection`）显示为"状态未知"，**不要显示成失败**；
4. 无障碍：状态变化要能被读屏感知（`aria-live` 或等效），颜色不能是唯一区分手段。

### DoD

1. 教师发一条指令后，UI 能看到回执状态并随学生端应用而更新；
2. 三态文案与上表一致，`accepted` 没有被写成「学生已收到」；
3. 离线时不误报失败；
4. `npm test` ≥ 223 通过、0 失败（本块不应影响任何测试）。

---

## TC2：教师端指令效果测试补齐

### 为什么要做

`4-stu-learning/tests/teacher-runtime.test.js` 现有 6 例覆盖场次组织／坐标／幂等与版本冲突／求助去重／名单导入／证据存储，**缺一张「18 个 action 各自到底改了什么」的断言表**。

这张表的价值不只是覆盖率——**它会直接暴露 §0.2 那三条断链修好没有**。主体正在修 T1／T2，你这张表就是它们的验收网。

### 落点（只碰这一个文件）

`4-stu-learning/tests/teacher-runtime.test.js`

### 怎么写

权威实现是 `server/runtime/course-run-service.js` 的 `applyCommand()`（约 371-395 行）。**先读它，按它的实际行为逐条断言**，不要按 action 名字猜语义。

它今天分两层：

```js
// 第一层：改场次记录 run.*
release_roles → run.rolesReleased = true
lock_roles    → run.rolesLocked = true
start_phase   → run.status = 'active'
pause         → run.paused = true
resume        → run.paused = false
end_run       → run.status = 'completed'
advance_phase → run.phaseIndex += 1; run.phaseId = payload.phaseId || `phase-${run.phaseIndex + 1}`

// 第二层：对每个目标 participant
（全部 action）  → participant.latestDirective = {...}
add_time        → participant.learning.timeBalance += payload.amount || 3
set_scaffold    → participant.learning.scaffoldLevel = payload.level || 0
confirm_arrival → participant.location.insideFence = true
approve_evidence→ participant.learning.progress += 12（上限 100）
skip_step       → participant.learning.progress += 8（上限 100）
```

注意 `remove_time`／`send_notice`／`push_knowledge`／`reject_evidence`／`switch_alternative`／`emergency_rally` 在服务端**没有状态改动**，只留 `latestDirective`——这是设计，不是 bug，断言要断言「只留指令、不改状态」。

还要覆盖 `target.scope` 的四种取值（`all`／`group`／`role`／`participant`，schema 在 `server/runtime/routes.js:5`）：断言只有目标范围内的 participant 被改，范围外的不受影响。

### 边界（重要）

- **只写测试，不改实现。** 如果你断言时发现某个 action 的行为「看起来不对」，**不要顺手改 `course-run-service.js`**——那个文件本轮属于主体。把疑点写进提交信息或单独留一条 `test.todo`，我来判断；
- 特别地：`set_scaffold` 只写 `participant.learning.scaffoldLevel` 而不写 `session.scaffoldLevel` 是**已知断链**（主体 T2 在修）。这里就断言当前的场次记录行为即可，不要去测 session；
- 别引入新的测试框架或断言库——照现有 `node:test` ＋ `node:assert/strict` 的写法。

### DoD

1. 18 个 action 每个都有断言，包含「无状态改动」那 6 个；
2. `target.scope` 四种取值各有一例，含"范围外不受影响"的反向断言；
3. `applyCommand` 的两层结构都被覆盖（`run.*` 与 `participant.*`）；
4. 未改动 `server/` 下任何实现文件（`git diff --stat` 只有测试文件）；
5. `npm test` ≥ 223 ＋ 你新增的例数，0 失败。

---

## TC3：`x-teacher-id` 认证缺口的安全说明

### 为什么要做

教师端**当前没有身份认证**。这是上线阻塞项，但修它牵动部署与账号体系，工期不可控，所以本轮不修——**但必须写清楚**，否则很容易被"教师端已实现"的表象盖过去，带着这个缺口上线。

### 落点（全新文件，不改任何代码）

`1-docs/教师端安全待办.md`

### 必须写清的事实（请自行核对代码后再写，不要照抄）

1. `server/runtime/routes.js:3` —— `const actor = (request) => request.headers['x-teacher-id'] || 'teacher-demo'`。身份完全来自**客户端自称的请求头**，没有任何验证；默认值还是一个真实可用的教师 ID；
2. `server/runtime/course-run-service.js` 的 `assertTeacherAccess(runId, teacherId)` —— 只比对 `run.teacherId !== teacherId`。所以带上 `x-teacher-id: teacher-demo` 就能读写演示场次的全部数据；
3. 影响面要逐条列出这些接口能做什么：`GET .../snapshot`（全班姓名、实时位置、进度）、`POST .../commands`（发紧急集合、结束场次、暂停）、`POST .../roster/import`（覆盖名单）、`PATCH .../participants/:id`、`POST .../audit`（写审计记录，含 `privacy.override`）；
4. `4-tea-leading/app.js:4` 的 `TEACHER_ID = 'teacher-demo'` 是前端硬编码常量；
5. 隐私边界的现状：`4-tea-leading/README.md` 写「教师默认只查看 AI 对话摘要和学习证据，原文入口需要生产身份与授权系统确认后才开放」——`app.js:457` 的 `request-transcript` 目前只记审计、不返原文。**这条设计是对的**，要写明它依赖的正是尚不存在的身份系统。

### 要求

- 列出上线前必须补的项（真实身份认证、会话令牌、按班级／场次的授权边界、审计中的操作者可信化），每项写清「不做的后果」；
- 区分**演示环境可接受**与**生产不可接受**——现在这套是为了本地演示开箱可用，不是有人偷懒，文档要讲清这个语境；
- 明确标注定位：这是**待办说明**，不是设计方案。不要在文档里设计具体的认证实现（选 JWT 还是 session、接哪家 IdP 都还没定）；
- 不要写代码，不要改 `routes.js`。

### DoD

1. 文件存在，上述 5 条事实都有对应代码位置（`file:line`）且经你自行核对无误；
2. 影响面按接口逐条列清；
3. 没有任何代码改动（`git diff --stat` 只有这一个新增 md）；
4. `npm test` 不受影响。

---

## 边界（三块共同适用）

- **不碰**（本轮属于断链修复主体）：
  - `src/app-controller.js`
  - `server/agent/service.js`
  - `server/runtime/course-run-service.js`
  - `server/runtime/routes.js`
- **不做**：教师身份认证的**实现**（TC3 只写说明）；
- **不做**：`toTeacherView` 教师投影。教师端 snapshot 现在完全不读课程内容，先建就是空接口；
- **不做**：让 `server/runtime/` 直接 import agent 会话存储。`course-run-service.js` 的 import 保持只有 `node:crypto`——跨墙要走「学生端作为桥」那条既有通路（`approve_evidence` 走的就是它），这是主体 T1／T2 的做法，本任务书三块都不需要跨墙；
- **不做**：能力标签的任何运行行为（不进公开包、不进 Prompt、无 UI、无计算）。既定边界，不是欠账；
- 每块独立提交，提交信息写清 `TC1:` / `TC2:` / `TC3:` 前缀，方便交叉核对。
