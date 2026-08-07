# M1 开发任务书 · Cursor 并行块（C1／C2／C3）

> 文档性质：**开发任务书**，2026-08-07 晚下发
> 对应阶段：M1（Course IR ＋三投影），见 [实施计划 §M1](./问题清单-优先级与解决思路.md)
> 分工：M1 主体（IR 收敛、任务图装配、内容 hash 缓存）由另一侧并行进行，**不在本任务书范围内**。本任务书只含三块与主体互不碰同一文件的活。

---

## 0. 开工前必读：你上次之后这些文件被改过

M2 的五个提交（`ff58e7b`…`6dbe4ff`）之后，下列文件被修改，**继续动它们之前请重读**：

| 文件 | 改了什么 |
|---|---|
| `server/agent/service.js` | 摘掉 R1 遗留的不可达代码：`applySemanticUnderstanding`（44 行）、`decision.fastPath` 分支、`needsTurnUnderstanding` 整块。新增 `understandingLlm` / `understandingTimeoutMs` 两个入参 |
| `server/agent/turn-router.js` | 删掉 `fastConversationReply`（11 行写死话术）与 `base()` 里的 `fastPath: false` |
| `server/agent/turn-understanding.js` | **整个文件已删除**（`git rm`） |
| `server/agent/dialogue-policy.js` | 正则里去掉 `onboarding_unclear`（已无生产者） |
| `server/config/env.js` | 新增 `OPENAI_UNDERSTAND_MODEL`（可选）与 `AI_UNDERSTAND_TIMEOUT_MS`（默认 8000，含"必须小于 `AI_TURN_TIMEOUT_MS`"的启动校验） |
| `server/app.js` | 语义理解走独立轻量客户端（无工具、无视觉、`reasoningEffort: 'none'`）。未配 `OPENAI_UNDERSTAND_MODEL` 时复用主客户端，行为与配置前完全一致 |

**硬约束**：不要再引用 `fastPath`、`parseTurnUnderstanding`、`turn-understanding.js`——这三个已不存在。

### 当前基线（请先自行复现，作为"我没弄坏东西"的锚点）

```bash
cd 4-stu-learning && npm test
```

**192 项测试全部通过，约 4 秒。** 这是本任务书所有 DoD 的下界：改完不得低于 192，不得有 fail。

---

## C1：`lintLesson` 课程校验器

### 为什么要做

SPEC v2 承诺了"一条命令输出 file:line 级错误"，但校验器不存在。今天 5 门课的引用其实**全都是通的**（下方基线），所以这一块**不是去救火，是立护栏**——防止后续新课与迁移把它们改坏而无人察觉。

### 落点（全部是新文件，不碰任何现有模块）

- 新建 `4-stu-learning/scripts/lint-lesson.mjs`
- 新建 `4-stu-learning/tests/lint-lesson.test.js`
- `4-stu-learning/package.json` 加一行 script：`"lint:lesson": "node scripts/lint-lesson.mjs"`

**不要动** `server/course/compiler.js`、`scripts/sync-lessons.mjs`、`src/engine/lesson-parser.js`——这三个正在被 M1 主体改造，碰了必冲突。

### 可复用的现成件（不要重写）

| 用途 | 从哪来 |
|---|---|
| 编译一门课拿到全量结构 | `compileCourse({ lessonsRoot, courseId })`，`server/course/compiler.js`。**只调用，不修改** |
| 解析限制引用 → 标题列表 | `restrictionReferenceTitles(step.restrictionRef)`，`server/course/restriction-sections.js` |
| 判断引用能否解析到最小单元 | `resolveStepRestrictions(course, step)`，同上。**注意它同时匹配 `##`/`###` 小节标题与表格行的首列**，只比标题会误报 68 条 |

> 主体改造期间 `compileCourse` 的返回字段 `publicLesson` 会改名为 `lesson`。**C1 请只访问 `course.roles`、`course.knowledge`、`course.restrictionMarkdown`、`course.restrictionDocument` 这几个不改名的字段**，即可完全避开这次改名。素材校验请直接读 `6-lessons/<courseId>/assets/` 目录，不要走 `lesson.assets`。

### 校验规则与实测基线

全部数值是 2026-08-07 实测，可直接写成断言：

| 规则 | 级别 | 5 门课当前基线 |
|---|---|---|
| 知识引用 `knowledgeRef` 的每个 id 存在于 `course.knowledge` | **error** | 403 个引用，死引用 **0** |
| 限制引用 `restrictionRef` 能被 `resolveStepRestrictions` 解析到 | **error** | 216 个引用，死引用 **0** |
| 素材路径（`lessons/<id>/…` 形态的 png/jpg/webp/svg/mp3/mp4）文件存在 | **error** | 89 个引用，缺失 **0** |
| 能力标签前缀 ∈ {CC, CQ, DK, DS, DC} | **error** | 113 个标签：DC 40 ／ DS 41 ／ DK 32，全部合法 |
| Step 缺就地验收标准 | **warning** | **55 个**（`lesson_zhizhi_002` 28 ＋ `lesson_zhizhi_003` 27） |
| `通过后` 目标可解析（`step:` / `role-stage:` / `role:` 前缀，或 `complete`） | **error** | 208 条边，异常 **0** |

**这条最容易做错**：缺就地验收标准必须是 **warning，不能是 error**。zhizhi_002/003 一共缺 55 个，教研已定案暂不补写（那两门课要上线前才人工补）。如果判成 error，`--strict` 会让这两门课编译不过，直接卡住主流程。

### 输出格式

每条问题输出 `file:line`。行号请用"在源 md 里搜索该 Step 的 `- id：<stepId>` 行"的方式定位——`compileCourse` 不返回行号，但 `course.roles[].sourceMarkdown` 持有角色文件原文，按行扫一遍即可。

```
6-lessons/lesson_zhizhi_002/roles/status-verifier.md:88
  warning  Step verifier-check-sources 缺就地验收标准（##### 验收标准）
```

结尾给汇总，并按最高级别决定退出码：有 error → 退出码 1；只有 warning → 退出码 0。

### `--strict`

加 `--strict` 时 warning 也算失败（退出码 1）。**默认不开**，因为默认档要能对 5 门课全绿。

### DoD

1. `npm run lint:lesson` 对 5 门课**零 error**，warning 恰好 55 条；
2. `npm run lint:lesson -- --strict` 退出码 1（因为那 55 条 warning）；

> **验收后基线已上调：55 → 57**（2026-08-07，P 系列）。`lesson_gewu_001` Phase 1 迁成三个阶段任务，其中两个没写 `##### 验收标准` → 多两条同类 warning。这是真缺口不是误报，所以上调基线而不是放宽检查。lint 现在还多两条阶段任务专属规则：`bad_executor`、`phase_task_in_role_file`（详见[问题清单](./问题清单-优先级与解决思路.md) P 系列）。C1 交付本身未被改动。
3. `tests/lint-lesson.test.js` 至少 5 例，其中**必须包含一条"注入式"负例**——在内存里造一个带死知识引用的假课程，断言校验器报 error。只断言"真课程全绿"的测试没有牙齿，真课程本来就是绿的；
4. `npm test` ≥ 192 通过、0 失败。

---

## C2：X2 卫生清理

三项都已实测确认，互不相干，可一次提交。

### C2-1 删孤儿模块 `src/services/map-service.js`

实测**零引用**（全仓搜索 `map-service` 只命中它自己；实际在用的是同目录的 `amap-service.js`）。删掉，并检查 `README` 是否提到它、提到就一起改。

### C2-2 删 `#teacherGateButton` 残留

`src/pages/student-learning.html:50`，一个永久 `disabled` 的按钮。连带清掉只服务于它的 CSS 与 JS 取元素代码（若有）。

### C2-3 标注 `AI_WEB_SEARCH_MODE` 未实现

`server/config/env.js:29` 定义了 `AI_WEB_SEARCH_MODE: z.enum(['auto','enabled','disabled']).default('auto')`，但 `server/services/llm.js:292` 硬编码 `webSearch: false`——这个配置项**当前完全不生效**。

**不要删掉它**（删配置项属于对外行为变更）。在 `env.js` 该行上方加一句注释说明"当前未实现：`services/llm.js` 硬编码 `webSearch: false`；接线前配置它没有效果"，并在 `.env.example` 里同样标注。

### DoD

`npm test` ≥ 192 通过、0 失败；`npm run build` 通过；`grep -rn "map-service\|teacherGateButton"` 只剩 `amap-service` 的命中。

---

## C3：`contentVersion` 入 session

### 背景与接口约定

M1 主体会给编译产物加一个顶层字段：

```js
course.contentVersion   // 形如 'sha256:3f2a…'，课程 md ＋ 平台包内容的联合 hash
```

会话创建时要把它记下来，这样任何一次学习记录都能追溯到"当时那一版课程内容"。这是评价体系未来做离线 join 的三要素之一（任务标签 × 完成记录 × 课程版本），本轮只存，**不做任何计算、不做画像、不进 Prompt、不进公开包**。

### 落点

- `server/services/session-factory.js`：`createSessionRecord()` 加字段 `contentVersion: values.contentVersion || ''`
- 建会话的调用处把编译产物的 `course.contentVersion` 传进去
- 相应测试

### 时序（重要）

`course.contentVersion` 由主体产出，**可能还没落地**。如果你开工时它还不存在：按上面的写法实现（`|| ''` 兜底），字段读不到就存空串，**不要为此改 `compiler.js`**——那是主体的文件。等主体落地后字段自动有值。

### DoD

1. 新建会话的记录里有 `contentVersion` 字段；
2. `contentVersion` 缺失时存空串，不抛错、不阻塞建会话；
3. 存量会话（无此字段）恢复正常，不报错；
4. `npm test` ≥ 192 通过、0 失败。

---

## 边界（三块共同适用）

- **不碰**：`server/course/compiler.js`、`scripts/sync-lessons.mjs`、`src/engine/lesson-parser.js`、`server/course/projections.js`（新）、`server/course/task-graph.js`（新）——全部属于 M1 主体；
- **不做**：能力标签的任何运行行为（不进公开包、不进 Prompt、无 UI、无计算）。这是既定边界，不是欠账；
- **不做**：`service.js` 的推进逻辑（`currentTaskIndex += 1`）。那是 R3，依赖主体的任务图；
- 每块独立提交，提交信息写清 `C1:` / `C2:` / `C3:` 前缀，方便交叉核对。
