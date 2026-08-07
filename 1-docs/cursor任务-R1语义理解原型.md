# 任务书：R1 语义理解原型（understanding + tutor-policy）

> 读者：Cursor Agent（无本项目上下文，按本文档独立执行）
> 性质：一次性任务书，执行完成后本文档可删除
> 日期：2026-08-06 夜间
> ⚠️ 重要：今晚有另一个 AI agent 在同一工作区改"课程内容与编译器"相关文件。你的任务被设计为与它**零文件交集**。严格遵守第 7 节禁区清单，只新建文件、不修改任何现有文件。

---

## 1. 背景（读完这节就够理解为什么做）

本项目是一个 AI 研学课程平台：学生在故宫等实地场景用手机与 AI 学习同伴"絮絮"对话完成任务。后端在 `4-stu-learning/server/`（Fastify，ESM，Node ≥20.19，测试用 node:test）。

**当前问题**：学生的自由文字输入由正则规则分类（`server/agent/turn-router.js`），语义经常被曲解。真实案例：学生说"你好"或"我不知道从哪里开始"，被正则套进固定流程分支，回复写死的"想学习就说继续"，学生再说一遍又命中同一分支，**陷入死循环**。

**已定案的架构决策（D6，"语义理解优先"）**：一切语言输入必经一次轻量 LLM 语义理解（结构化 JSON 输出），规则只处理非语言输入（工具提交/位置/心跳/按钮）；理解之后由**确定性代码**做教学决策（防复读防循环）；进度判定不经过任何 LLM。

**你今晚做的是这个决策的原型件**：两个独立模块＋各自测试。明天白天由主线 agent 接入 `service.js` 主流程。所以：**模块边界、函数签名必须严格按本文档**，接线时不再改你的接口。

## 2. 开工前必读（只读，禁止修改）

1. `1-docs/目标架构讨论稿-两包md与课程渲染管线.md` 的 §8（三段式接口：理解→决策→生成）
2. `1-docs/问题清单-优先级与解决思路.md` 的 R1 节（验收标准）
3. `4-stu-learning/server/services/llm.js` —— **llm.generate 的真实接口与返回结构以此文件为准**（jsonMode、maxRetries、超时行为等）；你的 mock 要仿照真实返回结构
4. `4-stu-learning/tests/llm.test.js` —— 本仓库测试怎么写、怎么 mock（node:test + assert，无 Jest）
5. `4-stu-learning/server/agent/turn-router.js` —— 只为了解现有意图分类有哪些（参考其意图命名，不 import 它）
6. `4-stu-learning/server/agent/session-state.js` —— 只为了解 session 真实字段名（scaffoldLevel、dialogueState.pendingQuestion 等），**不 import 它**

## 3. 交付物一：`4-stu-learning/server/agent/understanding.js`（新建）

```js
export function createUnderstanding({ llm }) {
  return { understandTurn };
}
```

依赖注入：**不 import env、不自己 createLLM**，llm 从参数传入（测试传 mock，明天接线传真实实例）。

`understandTurn(input)` 签名：

```js
// input：
{
  text: string,                       // 学生这句话（必填）
  pendingQuestion: null | { prompt: string, type: string },   // 当前待答问题
  currentStep: null | { objective: string, studentAction: string },
  recentMessages: Array<{ role: string, content: string }>,   // 最近对话，最多取末尾4条
  grade: string                       // 学段文案，可空串
}
// 返回（Promise）：
{
  intent: string,          // 见下方枚举
  emotion: 'neutral' | 'positive' | 'frustrated' | 'tired' | 'anxious',
  answersPendingQuestion: boolean,   // 这句话是否在回答 pendingQuestion
  want: string,            // 一句话描述学生想要什么，可空串
  confidence: number       // 0–1
}
```

intent 枚举（首版，写成模块导出的常量数组 `INTENTS` 以便测试引用）：

`greeting`（寒暄）、`help_start`（不知道从哪开始）、`help_stuck`（做的过程中卡住）、`asking_knowledge`（问课程知识）、`chat_offtopic`（闲聊跑题）、`emotional_low`（情绪低落/抱怨/累）、`answering_question`（在回答待答问题）、`claim_done`（口头声称完成）、`request_answer`（直接要答案）、`unknown`

实现要求：

1. 调 `llm.generate` 用 **jsonMode**（具体参数名以 llm.js 真实接口为准），llm 层 `maxRetries: 0`——重试由本模块自己管；
2. Prompt 用中文、精简（目标 300–500 字符）：给出枚举清单、pendingQuestion 与 currentStep 摘要、末尾 4 条对话，要求只输出 JSON。**Prompt 中不得包含任何课程答案性内容**（你拿到的输入里本来也没有）；
3. 输出用 **zod** 校验（仓库已有 zod 依赖，不新装包）：枚举合法、confidence 数值收敛到 0–1；
4. **总预算 8 秒**：若 llm.generate 自带超时/abort 机制按真实接口用，否则用 Promise.race 包一层；
5. **降级链（核心要求）**：调用失败/超时/JSON 解析失败/zod 不过 → 重试一次 → 再失败返回保守默认值 `{ intent: 'unknown', emotion: 'neutral', answersPendingQuestion: false, want: '', confidence: 0 }`。**本函数在任何输入下都不抛异常**；
6. 文件头部用中文注释说明模块职责（仿照仓库现有风格，注释密度低）。

## 4. 交付物二：`4-stu-learning/server/agent/tutor-policy.js`（新建）

纯函数，**零 import**（不依赖 session-state.js、不依赖任何 I/O）：

```js
export function decideTutorAction(understanding, context) → {
  action: string,        // 见下方枚举
  params: object,        // 例如 { scaffoldLevelDelta: 1 } 或 {}
  reason: string         // 一句中文，说明为什么选这个动作（给日志与测试用）
}
```

`context`（由调用方明天从 session 拼装，今晚按此契约设计）：

```js
{
  scaffoldLevel: number,               // 0–4
  pendingQuestion: null | object,
  currentStep: null | { objective: string, studentAction: string },
  recentActions: Array<{ intent: string, action: string }>,  // 最近的决策记录，最新在末尾，可为空数组
  idleSeconds: number
}
```

action 枚举（导出常量数组 `TUTOR_ACTIONS`）：

`reply_natural`（自然回应接住这句话）、`give_scaffold`（给当前步的分级提示）、`advance_pending_question`（把回答交给待答问题流转）、`comfort`（安抚情绪优先）、`redirect_task`（指回当前任务的一个具体动作）

决策规则（按优先级实现）：

1. `emotional_low` 或 emotion 为 `frustrated`/`tired` → `comfort`（情绪优先于一切任务推进）；
2. `answersPendingQuestion === true` → `advance_pending_question`；
3. `greeting` / `chat_offtopic` → `reply_natural`；
4. `help_start` / `help_stuck` / `request_answer` → `give_scaffold`（request_answer 也走脚手架，不给答案）；
5. `claim_done` → `redirect_task`（平台规则：口头完成不推进，指引学生用工具提交）；
6. `unknown` 或 `confidence < 0.4` → `reply_natural`（温和澄清一句）；
7. **防复读（本模块存在的核心理由）**：
   - 若同类求助 intent（help_start/help_stuck/request_answer 视为同类）上一次已给过 `give_scaffold`，这次必须**换策略**：`params.scaffoldLevelDelta = +1`（升档，上限 4），reason 注明"同类求助第二次，升档"；
   - 若 recentActions 末尾已连续 2 次同一 action，第三次**强制换**为备选动作（give_scaffold→redirect_task；reply_natural→redirect_task；其余→reply_natural），reason 注明"防复读强制换"。

## 5. 交付物三：测试（两个新文件）

`4-stu-learning/tests/understanding.test.js`（mock llm，**绝不调真实模型、不读 .env**）：

1. 正常返回合法 JSON → 解析结果字段正确，且传给 llm 的调用开启了 jsonMode、prompt 里包含 pendingQuestion 内容；
2. llm 抛错 → 自动重试一次（断言 generate 被调 2 次）→ 仍失败 → 返回保守默认值，不抛异常；
3. llm 返回不可解析/不过 zod 的内容 → 同样走重试→默认链；
4. llm 挂起超时（用一个永不 resolve 的 promise + 短预算注入，若你把预算做成可注入参数）→ 默认值。为了这条可测，允许 `createUnderstanding({ llm, timeoutMs })` 多收一个可选 timeoutMs（默认 8000）。

`4-stu-learning/tests/tutor-policy.test.js`（纯函数直测）：

1. greeting → reply_natural；
2. help_start 第一次 → give_scaffold 且无 delta；同类求助第二次（recentActions 里已有一条 help/give_scaffold）→ give_scaffold + scaffoldLevelDelta:+1，且 scaffoldLevel 已到 4 时不越界；
3. frustrated + help_stuck 同时出现 → comfort（情绪优先）；
4. answersPendingQuestion → advance_pending_question；
5. claim_done → redirect_task；
6. 连续 2 次 reply_natural 后第三次同意图 → 被强制换成 redirect_task。

## 6. 验证方式（只跑这两条，别的都不要跑）

```bash
cd 4-stu-learning && node --test tests/understanding.test.js tests/tutor-policy.test.js
```

**禁止**：跑全量 `npm test`、`npm run sync:lessons`、`npm run build`、启动 dev server——另一个 agent 正在改这些命令涉及的文件，全量跑必红，且可能互相干扰。

## 7. 禁区清单（另一个 agent 今晚的领地，一个字都不能改）

- `6-lessons/**`（全部课程内容）
- `4-stu-learning/src/**`（含 engine、generated、services、components、页面）
- `4-stu-learning/server/course/**`
- `4-stu-learning/server/agent/` 下的**现有文件**：service.js、prompt.js、turn-router.js、session-state.js、dialogue-policy.js、nudge-policy.js、tools.js（你只新建 understanding.js、tutor-policy.js 两个新文件）
- `4-stu-learning/scripts/**`、`4-stu-learning/tests/` 下的**现有测试文件**
- `4-stu-learning/public/**`、`1-docs/**`（只读）、根目录 `scripts/**`、`api/**`、`server/**`
- 任何 `.env*`、`package.json`、`package-lock.json`（**不新装任何依赖**）
- **不做任何 git 操作**（不 commit、不 branch、不 stash）

## 8. 完成后

把执行结果写到**新建文件** `1-docs/R1原型-执行记录.md`：做了什么、两条测试命令的输出摘要、设计上拿不准的点（列问题即可，不要自作主张改禁区文件来解决）。

## 9. 验收清单（自查）

- [ ] 只新建了 4 个文件（understanding.js、tutor-policy.js、两个测试）＋1 个执行记录，未改动任何现有文件
- [ ] understanding.js 任何输入不抛异常，降级链完整（失败→重试1次→保守默认）
- [ ] tutor-policy.js 纯函数零 import，防复读两条规则可测试证明
- [ ] 两个测试文件全绿，mock 不触网、不读 env
- [ ] 未安装依赖、未跑全量测试/构建/同步、无 git 操作
