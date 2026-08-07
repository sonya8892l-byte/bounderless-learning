# 研学智能体教师端

独立的移动 Web/PWA 教师带队工作台，由学生端 Fastify 服务同时托管，与学生端共享课程场次、小组、任务、告警和教师指令状态。

## 启动

```bash
cd ../4-stu-learning
npm start
```

访问 `http://127.0.0.1:3000/teacher/`。首次进入会创建一个 30 人、5 个学习小组的故宫演示场次。

## 已实现

- 场次中心：创建多课程场次、CSV 名单导入、小组和角色唯一性校验。
- 开课控制台：名单、分组、设备权限、课程版本与围栏检查。
- 地图态势：小组聚合点、位置新鲜度、异常外圈、文本列表降级和小组抽屉。
- 待处理中心：P0/P1/P2 优先级、去重和固定事件状态机。
- 教学遥控：消息、加时、暂停、阶段、提示深度、证据复核、替代任务和紧急集合（各条如何真正落到学生会话，见下节）。
- 课后回看：小组完成情况、干预时间线、审计数据和 JSON 导出。
- 弱网：WebSocket 实时通道、5 秒轮询补偿、最近快照缓存和明确离线状态。

## 教师指令是怎么真正生效的

教师运行时（`4-stu-learning/server/runtime/`）只 `import crypto from 'node:crypto'`，它碰不到 agent 会话存储。也就是说它能改的只有**场次记录**（`run.*`、`participant.learning.*`），而真正驱动学生体验的是 agent 会话（`session.phaseId`、`session.scaffoldLevel`）。

跨这道墙只有一条路，**学生端就是那座桥**：

```
教师发指令 → 场次记录 → 学生端轮询 → applyTeacherCommand → runAgentTurn(lifecycle_event) → 服务端改 session
```

所以判断一条指令有没有真生效，看的不是服务端收没收到，而是 `src/app-controller.js` 的 `applyTeacherCommand` 里有没有对应那一支、并且那一支有没有回发 `lifecycle_event`。指令投递成功但桥上少一格时，教师端照样显示「已发送」，学生那边什么也不会变。

新增教师指令时请沿用这条通路，不要让 runtime 层直连会话存储。

### 已修的三处断链（原先是「教师以为生效、实际没生效」）

| 指令/字段 | 原先的实际行为 | 现在 |
|---|---|---|
| `advance_phase` | `applyTeacherCommand` 里没有这一支，指令被静默丢弃。`session.phaseId` 建会话时由课程 `course.md` 的 `任务阶段` 定下，此后永不变 → 一门课 6 份 `prompts/phaseN-*.md` 只有 1 份进 System Prompt，其余 5 份里的真约束静默失效 | 回发 `teacher_directive` 写 `session.phaseId` ＋ `phaseNumber`；阶段不存在则拒改（宁可不改，也不要让「阶段规则」段凭空变空）。前端同步换倒计时与顶栏 |
| `set_scaffold` | 只写 `participant.learning.scaffoldLevel`（场次里的展示字段），取哪一档提示读的是 `session.scaffoldLevel`，没人改它 | 写回会话 `scaffoldLevel`，夹到平台默认层的 `maxLevel` 与 0 之间。**可升可降**——自动升档只升不降，老师看得到学生真实状态，有权调回去 |
| `evidenceCount` | 全仓唯一赋值是演示种子 `index % 4`，永不更新。老师照着假数字点「人工通过」 | 学生端 presence 上报 `session.learningState.evidenceIds.length`；上报的是累计值，服务端不推断增量，纯心跳不清零 |

覆盖这三条的测试：`4-stu-learning/tests/teacher-directive.test.js`（阶段与档位，6 例）、`4-stu-learning/tests/teacher-evidence-count.test.js`（证据条数，4 例）。

### 新增第 14 条指令：`advance_task`（2026-08-08）

学生抽屉里的「进入下一任务」，标 `HIGH_IMPACT`（要二次确认）。它解开的是课程写了 `推进方式：teacher` 的任务——这类任务学生做完后**故意停住**等老师对齐现场节奏。

以前没有这条指令，所以那类任务做完就永久卡死（`lesson_zhizhi_001` 的 `assembly-speaker` 就有一个）。`skip_step` 顶替不了：它走的是小步完成，推进任务是另一码事。

两条硬门禁在服务端（`server/agent/task-advance.js`）：必须真的处于等待态，且等的必须是教师。学生自主确认的任务（`推进方式：ai_suggest`）老师按了会被拒（`ADVANCE_WRONG_ACTOR`）——不是权限不够，是那个确认本来就该学生自己做。测试：`4-stu-learning/tests/advance-task.test.js`（6 例）。

### 本来就是真的，别当成待做

`approve_evidence` 与 `skip_step` 真的推进/跳过学生小步（`app-controller.js` 判断 `completionMode === 'teacher_confirm'` 后发起 `task_step_completed` 回合）；`add_time`／`remove_time` 真的改学生的倒计时；`pause`／`resume`／`emergency_rally` 真的弹/收学生端遮罩；presence 上报的 `progress` 一直是真值。

### 还差一条：`confirm_arrival` 解不了学生的位置门禁

同一类断链，本轮未修（不在 T1–T4 范围内，且涉及"教师能否远程越过位置校验"的教学语义，需先拍板）：

服务端 `confirm_arrival` 只写 `participant.location.insideFence = true`（`course-run-service.js:393`），而学生端的门禁读的是本地 `roleState.arrived`——它只在学生自己 GPS 测距通过后才置位（`app-controller.js:1432`），`applyTeacherCommand` 里**没有 `confirm_arrival` 分支**。

比其他几条更值得优先，因为学生端会主动把学生指向这个动作：定位失败时的提示原文是「没有取得定位权限，请允许定位或**呼叫老师人工确认**」（`app-controller.js:1429`）。老师确认了，学生依然进不去。

### 已知缺口

- **身份认证**：`4-stu-learning/server/runtime/routes.js` 的 `actor()` 取的是自称请求头 `x-teacher-id`，`assertTeacherAccess` 只比对 `run.teacherId`。任何人带 `teacher-demo` 就能读写全班数据。上线阻塞项，详见 [教师端安全待办](../1-docs/教师端安全待办.md)。
- **`approve_evidence` 仍是盲签**：详情抽屉只给「stepName · 已提交 N 项证据」和一个「人工通过」按钮，老师看不到学生交了什么、也看不到验收标准。教师端 snapshot 目前完全不读课程内容，补齐需要一层教师投影（`toTeacherView`），尚未建。

## 运行存储

本地开发默认使用 `4-stu-learning/.runtime/course-runs.json`，采用原子写入保证演示开箱可用。生产 PostgreSQL 表结构位于 `4-stu-learning/server/runtime/postgres-schema.sql`，域对象 ID 与开发适配器保持一致。

## 隐私边界

教师默认只查看 AI 对话摘要和学习证据。原文入口需要生产身份与授权系统确认后才开放；当前演示会记录请求，不暴露原文。
