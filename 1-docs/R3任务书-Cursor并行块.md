# R3 Cursor 并行块任务书（D1／D2／D3）

> 版本：2026-08-07 晚｜与 Claude 的 R3 主体**并行执行**，文件零重叠
> 主体任务书：[R3任务书-把编译好的东西接上运行时](./R3任务书-把编译好的东西接上运行时.md)

## 读我：这一轮的边界（最重要）

Claude 正在同一个工作树里改运行时推进逻辑。**下面这些文件 Claude 独占，你一行都不要碰**：

```
server/agent/service.js          ← 冲突高发区，Claude 正在重构推进逻辑
server/agent/task-advance.js     ← Claude 新建
server/agent/prompt.js
server/course/task-graph.js
server/runtime/course-run-service.js
src/app-controller.js
tests/ 下的所有既有文件         ← 要加测试请建新文件
```

**你独占**：`src/engine/lesson-parser.js`、`scripts/lint-lesson.mjs`、`6-lessons/**`、`4-stu-learning/docs/**`、`1-docs/**` 中除两份 R3 任务书外的文件，以及你自己新建的测试文件。

每块独立提交，提交信息用 `D1:` / `D2:` / `D3:` 前缀。

## 当前基线（动手前先确认这三个数对得上）

```bash
cd 4-stu-learning
npm test                # 282 通过 0 失败
npm run lint:lesson     # 0 error，57 warning
shasum -a 256 src/generated/lesson-public.js
# 应为 a96c9009d4399f4fbdeda6cc212deaadcaf50a4182edf2b2f4b5583e2d4348d3
```

对不上就先停下来问，不要在漂移的基线上开工。

---

## D1：`失败处理` 与 `教师介入` —— 两个字段解析了但零消费

### 问题（实测数据，不是推测）

```bash
grep -rc '失败处理：' 6-lessons/*/roles/*.md   # 课程里写了 208 处
grep -rn 'failureHandling' server/ src/        # 只有 lesson-parser.js:276 一行赋值
grep -rn 'teacherIntervention' server/ src/    # 只有 lesson-parser.js:277 一行赋值
```

课程团队写了 208 处「学生卡住时怎么办」「什么情况该叫老师」，**解析进内存后没有任何代码读它**。对比 `常见误区`（`commonMisconception`）——同一批字段里唯独它接了，进了 `service.js:327` 和 `prompt.js:151` 的 Prompt。

这不是"预留字段"，是**漏接**：spec 附录 A 把它们标成「未接入：待图执行器接入失败路由」，但实际上失败提示进 Prompt 根本不需要等图执行器。

### 你要做的

**只做校验与规范，不接 Prompt**——接 Prompt 要改 `prompt.js`（Claude 独占）。你的产出是让这两个字段"写错能被发现、写法有据可依"：

先看清存量的实际形状（我已实测，你不必重跑，但要理解）：`失败处理`／`最大尝试`／`教师介入` 三个字段都是 **208 处**，成套出现——迁移脚本给每个 Step 都写齐了。所以"缺字段"类规则在 5 门课上会 0 命中，没有意义。

**真正可校验的是一条配对不变量**：`教师介入：必须` 出现 11 次，`完成方式：teacher_confirm` 也出现 11 次，且我逐 Step 核过——**两者完全配对，无一例外**。这不是巧合，是语义要求：标了「必须叫老师」的 Step，完成方式就该是等老师确认；反之亦然。任何一侧单独出现都是内容错误。

1. `scripts/lint-lesson.mjs` 新增两条规则（写在 `lintCourse` 的 `checkTask` 里，那个函数已经是角色任务与阶段任务共用的，所以阶段任务自动也受约束）：
   - `teacher_intervention_mismatch`（**error**）：Step 的 `教师介入：必须` 与 `完成方式：teacher_confirm` 只出现一侧。两个方向都要报，消息里写清缺的是哪一侧；
   - `empty_failure_handling`（**warning**）：`失败处理` 为空或只写了「无」，同时 `最大尝试` ≥ 1——重试用完后没有任何指引，学生卡在原地。

2. 跑 `npm run lint:lesson` 看实测结果。**预期：新增 0 条**（5 门课当前是干净的）。如果真报出东西，那是我漏看的真实缺口——**不要放宽规则**，把它记在提交信息里。基线 57 warning、0 error 应保持不变。

3. spec 附录 A 那两行改成准确描述，注意两者状态**不同**：
   - `失败处理`：确实零消费 → 「已校验写法，运行时未接（Prompt 接入待 R3 主体）」；
   - `教师介入`：它自己没有代码读，但**通过配对的 `完成方式：teacher_confirm` 间接生效**（那条路径 `service.js:166` 是活的）→ 写成「与 `完成方式：teacher_confirm` 配对生效，lint 强校验配对」。

   **两行都不要标成裸的"生效"或裸的"未接入"**，那会让课程团队误判。

### 验收

新文件 `tests/lint-failure-fields.test.js`：

1. 造一个「`教师介入：必须` 但 `完成方式：ai_evaluation`」的内存假课程 → 报 `teacher_intervention_mismatch` **error**；
2. 反方向：「`完成方式：teacher_confirm` 但没标 `教师介入：必须`」→ 同样报 error；
3. 造一个「`最大尝试：2` ＋ `失败处理：无`」的假课程 → 报 `empty_failure_handling` warning；
4. 反例：配对正确、`失败处理` 写了真内容的课程 → 这两条都不报（防误报，这条最重要）；
5. **5 门真课程仍 0 error、57 warning**——这是本块的回归锁：那 11 对配对关系被钉住，以后有人只改一侧就会红。

**牙齿验证**：把两条规则各自注释掉，对应断言必须变红。提交信息里贴出 `npm run lint:lesson` 的实测汇总行。

---

## D2：`遍历模式` 与 `前置` 的课程侧校验

Claude 会在 R3-2／R3-3 让运行时**读**这两个字段。你的活是在那之前把**写错会被静默吃掉**的口子堵上——两边不冲突：你改 lint 和 spec，他改 service。

### 已知的静默失效（我实测过，可直接照做）

```js
// 跨作用域的 前置 会被丢弃，只留一条 warning
buildTaskGraph(
  [{ id: 'scout', tasks: [{ id: 'task-1', steps: [] }] }],
  [{ id: 'phase-1', tasks: [{ id: 'p3', prerequisites: ['task-1'], steps: [] }] }],
);
// → phase-1/p3 的 prerequisites 是 []，warnings 里有 unknown_prerequisite
```

也就是说：阶段任务的 `前置` 指向角色任务时，**依赖关系凭空消失**，课程作者以为设了门禁。

### 你要做的

1. lint 新增 `cross_scope_prerequisite`（**error**）：`前置` 跨作用域（阶段任务指向角色任务、或指向别的 Phase）时明确报错，消息里说清"本轮只支持同作用域，跨作用域等 R3 执行器"。

2. lint 新增 `unsupported_traversal_mode`（**warning**）：`course.md` 写了 `遍历模式：inquiry` 时提示"本期未实现，将按 sequential 运行"。`open` 不报——Claude 这轮会实现它。
   > **2026-08-08 已推翻**：`open` 本轮不做（用户决定），所以"不报"变成了静默陷阱。R3-3′ 已把 `open` 也纳入这条告警。

3. spec §9 补一段「`前置` 的作用域规则」：同作用域可用、跨作用域报错、`open` 本轮落地、`inquiry` 仍未实现。§9 现在只说了写法没说边界。
   > **2026-08-08 已推翻**：§9 现在是一张状态表——`sequential` 生效，`open`／`inquiry` 均为预留且都会收到 warning。

### 验收

新文件 `tests/lint-prerequisite-scope.test.js`，4 例：跨作用域报 error；同作用域不报；`inquiry` 报 warning；`open` 不报。5 门真课仍 0 error。

---

## D3：三份文档的过时表述

这三处我核过，都与代码实际不符：

1. **`1-docs/学生端当前-workflow-与课程编译详解.md` 的 `_platform` 表述**：§11.3（第 952 行）已经更新为「已进入私有编译」，但**第 197 行仍写着「`_platform` 当前不会作为课程目录参与 `sync-lessons.mjs` 的公开编译」**——这句话本身没错（公开链路确实排除它），但紧跟在目录树的「排除」标注后面，容易被读成"整个 _platform 没接入"。补一句指明：私有编译走 `platform-defaults.js`／`platform-rules.js`，六份默认层 md 全部生效，只有**公开**链路排除它。顺带写清覆盖优先级（平台默认 → 课程覆盖）。

2. **`server/config/env.js:35` 的 `AI_WEB_SEARCH_MODE`**：schema 里有 `auto|enabled|disabled` 三个值，但**没有任何代码消费它**（`grep -rn 'AI_WEB_SEARCH_MODE' --include='*.js'` 只有这一行）。在 `docs/` 里标注"已定义未实现"，或者直接提议删掉——你判断，在提交信息里说明理由。**不要改 `env.js` 本身**，删配置项要单独确认。

3. **`6-lessons/COURSE-SUBMISSION-SPEC.md` 的完成方式状态**：实测 5 门课的分布是 `ai_evaluation` 138 / `tool_result` 59 / `teacher_confirm` 11，而 **`location_event` 与 `compound` 真实使用为 0**。但两者的代码路径**都已存在**——`service.js:158` 是 `location_event` 的到达门禁、`service.js:161` 是 `compound` 的（到达 ＋ 工具结果）双条件。所以 spec 里现在那句「尚无课程使用」是准的，**不要改成"未实现"**；要补的是"零使用"这个事实与试点建议，让课程团队知道这两条路可以走但还没人验证过。

### 验收

三处改完，`npm run lint:lesson` 与 `npm test` 数字不变（纯文档块）。每处在提交信息里写清"原文说了什么、实际是什么、依据是哪个文件哪一行"。

---

## 收尾（三块都完成后）

```bash
cd 4-stu-learning && npm test && npm run lint:lesson && npm run build
cd .. && npm run verify
```

- `npm test` **只增不减**（你新增 8 例左右，基线 282 → 290 上下）；
- `lesson-public.js` 的 sha256 **必须不变**——你的三块都不该改变编译产物。变了就是碰到了不该碰的地方，停下来查；
- D1／D2 的 warning 数变化要在提交信息里写明实测数字，不要为了"好看"调规则。

## 有疑问时的判断顺序

1. **先跑一遍验证再问**——这个仓库里"文档说的"和"代码做的"经常不一致，以代码为准；
2. 拿不准是不是 Claude 独占文件，就当是，改别的；
3. 发现主流程的真实 bug（不只是字段没接）——**先记下来告诉我，不要顺手修**，那很可能落在 Claude 正在重构的路径上。
