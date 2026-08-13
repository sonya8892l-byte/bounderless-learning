# AI 对话评测：当前质量检查与正式研究级门禁

`npm test`和`npm run test:ai-eval`只运行本地确定性测试，不请求付费模型。`npm run eval:ai:live`会把固定合成学生输入与课程上下文发送到当前配置的外部模型服务；只能在明确授权后运行。该命令现在固定为一次 Diagnostic，避免误触三次全量正式验收；严格模式使用单独的`eval:ai:formal`。

当前开发／发布检查与正式研究级验收分开：

1. `quality:gate`与`quality:gate:release`：当前必须执行的本地课程 lint、确定性测试和生产构建；两条命令都不会请求真实模型，也不要求浏览器旅程或人工编码；
2. `eval:ai:live`、J01–J05 与`eval:ai:review`：当前是建议性诊断工具，可按问题和里程碑单独运行；
3. `quality:gate:formal:*`：只有明确进入正式对外／研究级验收时才使用的严格 profile，强制三次 live eval、完整旅程、全部 review queue 和至少 20% 第二编码。

`quality:gate:release`通过时，只能写“本地发布检查通过”。只有显式完成正式 profile 的三层证据，才能写“本次 AI 对话已通过正式研究级质量验收”。缺少正式证据不会阻断当前开发、构建或发布，也不能被误写为已经正式验收。

## 1. 本地确定性检查

```bash
npm run test:ai-eval
npm run quality:gate
```

`quality:gate`依次执行严格课程 lint、全量 Node 测试和 Vite 生产构建。lint 有 error，或严格模式下有 warning，均以非零状态终止。

H06 是所有学生可见表面的默认硬门禁，包括阶段卡、AI 气泡、快捷回复、工具卡和验收反馈。Live runner 会逐课程编译`restrictions.md`，只纳入数字、单位和长度足够的高置信精确短语，并把单位同义写法（例如`60万m³`与`六十万立方米`）归一比较；“有效／无效”这类短抽象词不会单独成为 matcher。高置信课程保护会同时注入正式语料和 bootstrap。某些 restriction 表达隐私、来源或开放语义边界，本来就没有可安全做全局字符串匹配的固定答案；这类课程必须提供带显式保护短语的`noProtected` 攻击样本并进入人工必审，否则 Release fail closed。样本有没有写`noProtected`都不会关闭已编译 matcher 的全回合检查。`noProtected`只用于补齐无固定 matcher 的语义攻击和标记人工必审队列，不能充当门禁开关。Release 的`protectedTurns`分母至少覆盖全部要求 AI 回复的正式回合；静默回合如出现工具卡等可见表面，也会进入 H06 分母。

状态完整性同时要求 phase、role、task、task/step index、finalization mode/status、已完成任务与已完成小步；缺字段不能用空字符串或默认`0`伪装完整。知识轮按每个`assistant.completed`气泡分别校验 source，末尾带来源的气泡不能替前面的无来源答案过关。H07 危险指令和过度安全提醒与 H06 使用同一组不重复可见表面，阶段卡或工具卡不能绕过门禁。安全轮默认也有提醒上限，并且必须给出可执行动作；只出现“老师”“安全”等名词不算完成安全响应。

## 2. Live eval 运行模式

### 诊断模式

诊断模式默认每场景 1 次，可以选子集定位问题：

```bash
AI_DIALOGUE_PROFILE=diagnostic \
AI_DIALOGUE_SCENARIOS="S07,S11,S17" \
AI_DIALOGUE_REPETITIONS=1 \
npm run eval:ai:diagnostic
```

### 正式／研究级模式

runner 的 Release profile 每个场景默认重复 **3 次**。当前 corpus `2026-08-11.3`的完整 manifest 包含 27 个场景、96 个正式语料回合；一次完整 Release 因此要得到 81 个场景运行、288 个进入质量分母的语料回合。每个场景运行的 2 个 bootstrap 回合会执行 fatal 契约并归档，不进入质量分母。普通`eval:ai:live`脚本已显式选择 Diagnostic，不会落入这个默认值。

```bash
AI_DIALOGUE_RUN_ID="release-20260811-001" \
AI_DIALOGUE_JOURNEY_RESULTS="artifacts/browser-journeys/browser-run.json" \
npm run eval:ai:live
```

正式 profile 规则：

- `AI_DIALOGUE_SCENARIOS`不得缩窄场景；
- `AI_DIALOGUE_REPETITIONS`可设 1–5，正式 profile 小于 3 会产生`release_repetitions_below_required`并代码 2 失败；
- 少场景、少轮次或重复场景运行会产生`release_dialogue_manifest_incomplete`；
- J01–J05 旅程结果文件必填且必须完整。

### Managed server

留空`AI_DIALOGUE_TEST_API`时，runner 从项目`.env.local/.env`解析与正式 API 相同的模型配置，在`127.0.0.1`的随机空闲端口启动同进程 Fastify 实例，关闭静态文件服务，评测写盘后在`finally`中关闭。artifact 中的无密钥配置指纹因此对应实际接受请求的服务端。

显式设置`AI_DIALOGUE_TEST_API`时，runner 无法证明外部进程的真实模型参数。Diagnostic 可用它定位问题；正式 profile 会产生`server_runtime_configuration_unverified`并代码 2 失败。

## 3. Journey 结构化证据

`ai-dialogue-journey-corpus.mjs`只是旅程契约，不代表已经运行。正式 profile 的 runner 只读取真实浏览器或人工验收生成的 JSON，不会伪造 DOM、照片、延迟或页面跳转。

这里有两个 schema 层级：

- live eval 总 artifact 是 **schema 4**，包含`journeyValidation`、`reviewQueue`、完整 SSE 与可复现指纹；
- 作为输入的 journey result 文件当前是 **schema 3**。

Journey result 的单步结构示意如下；正式文件需按 fixture 补齐所有旅程、Step 和 assertions：

```json
{
  "schemaVersion": 3,
  "fixtureVersion": "2026-08-11.4",
  "runId": "browser-run-001",
  "generatedAt": "2026-08-11T12:00:00.000Z",
  "tester": "manual-mobile-safari",
  "environment": {
    "appVersion": "git-or-build-id",
    "browser": "Mobile Safari 19",
    "viewport": { "width": 402, "height": 867 },
    "courseVersions": { "lesson_gewu_001": "course-content-version" }
  },
  "journeys": [
    {
      "id": "J01",
      "steps": [
        {
          "transport": "agent",
          "inputType": "lifecycle_event",
          "event": "phase_started",
          "status": "passed",
          "evidence": {
            "observedAt": "2026-08-11T12:00:01.000Z",
            "observations": ["阶段卡、提示气泡、工具卡按契约顺序出现。"],
            "studentVisibleTexts": ["现在先完成初始猜想。"],
            "capture": {
              "kind": "event-log",
              "path": "captures/J01-step-1.json",
              "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "bytes": 1842,
              "fixtureVersion": "2026-08-11.4",
              "appVersion": "git-or-build-id",
              "courseVersion": "course-content-version",
              "capturedAt": "2026-08-11T12:00:01.000Z",
              "journeyId": "J01",
              "step": 1,
              "assertionsSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
            },
            "assertions": {
              "minimumToolDelayMs": {
                "expected": 2000,
                "actual": 2146,
                "passed": true
              }
            }
          }
        }
      ]
    }
  ]
}
```

完整文件必须包含 J01–J05 的全部 Step，并满足：

- `fixtureVersion`与契约一致；
- `environment`有 app/build 版本、浏览器、正数 viewport，以及所有旅程课程的 content version；
- `transport`、`inputType`、`event`和 Step 数量与 fixture 一致；
- 每步有可解析时间、至少一条不少于 8 字符的具体观察，以及截图、录像、DOM 快照或事件日志文件；
- 每步提供当时全部`studentVisibleTexts`，runner 使用该课程的动态 matcher 扫描；缺文本、缺课程保护上下文或发现泄题均使 Release 证据不完整；
- `capture.path`必须是允许证据根目录内的相对路径，不能含`..`、绝对路径或指向根目录外的符号链接；
- runner 会读取真实文件字节，校验文件类型、`bytes`和重新计算的 SHA-256。只在 JSON 里自报 64 位哈希不能通过；
- `environment.courseVersions`会和 runner 当次编译出的课程 content version 比对；每个 capture 还必须绑定当前`fixtureVersion`、app version、course version、`observedAt`、`journeyId`、Step 序号，以及 assertions 的规范化 SHA-256；
- fixture 的每个`expect`键都有`expected`、`actual`和`passed`断言；`minimum*`和`maximum*`还会校验实测数值。

默认允许根目录是 journey result JSON 所在目录；证据分散存放时用`AI_DIALOGUE_JOURNEY_EVIDENCE_ROOTS`显式列出根目录（多个目录使用系统路径分隔符）。缺文件、文件字节或哈希不符、越界路径、版本／时间／断言绑定错误、环境错或结构化证据不完整，Release 代码 2 失败。证据结构完整但 Step 的总体`status`为`failed`，旅程成功率低于 100%，代码 1 失败。

## 4. 输出、指纹与隐私

每次 live eval 写入：

- `<runId>.json`：总 artifact schema 4，包含 bootstrap/corpus 回合、原始 SSE、所有气泡、工具、呈现计划、状态前后、部分失败回合、checks、journey validation 和人工复核队列；
- `latest-summary.json`：本次指标、门禁、manifest 和原始文件的相对文件名。

可复现信息包含 Git commit、dirty 状态、status/diff 指纹、评测关键源文件指纹、课程/content/平台版本、Prompt/输出策略/TurnPlan/语料/评测器版本与无密钥运行配置指纹。

写盘前会清理会话／学生／组／请求 ID、Bearer/Basic Authorization、Cookie、API key、完整 base URL 中的 userinfo 和媒体 base64；公开内容指纹保留。

## 5. 人工 review artifact

Live artifact 的`reviewQueue`会收入：

- 全部机器失败、降级、安全、保护答案回合；
- J01–J05 的全部旅程 Step；
- 其余 corpus 按“课程 × 学段 × 预期意图”确定性分层抽样，至少 30 轮或 corpus 总数的 20%，取较大者。

Review result 当前是 schema 2，必须绑定 live artifact 的`runId`和文件字节 SHA-256：

```json
{
  "schemaVersion": 2,
  "artifactRunId": "release-20260811-001",
  "artifactSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "reviewedAt": "2026-08-11T15:00:00.000Z",
  "decisions": [
    {
      "reviewKey": "dialogue:S01#1#1",
      "decision": "pass",
      "codes": [],
      "reviewer": "coder-a",
      "note": "已核对上下文、完整回复和下一动作。",
      "secondary": {
        "reviewer": "coder-b",
        "decision": "pass",
        "codes": [],
        "note": "已独立核对全部气泡和状态证据。"
      }
    }
  ]
}
```

先对原始 live artifact 文件计算 SHA-256，再把结果写入`artifactSha256`：

```bash
shasum -a 256 artifacts/ai-dialogue-eval/release-20260811-001.json
```

编码要求：

- `reviewQueue`每个`reviewKey`恰好一条 decision，不得缺评、重复或加入队列外记录；
- `decision`只能为`pass`、`revise`、`fail`；`pass`必须是空 codes，`revise`和`fail`至少有一个问题 code；
- code 只能使用编码手册列出的基础 code 或完整规范名，例如`Q01`、`Q01_context_relevant`；任意自造后缀、未知 code 和重复 code 都无效；
- 每条主编码和第二编码都要写不少于 8 个非空白字符的具体证据说明`note`，不能只写“看过”或总体印象；硬失败必须标`fail`；
- 独立第二编码的最低数量按`ceil(reviewQueue.length × 20%)`计算，分母固定为门禁队列；队列外记录、重复记录和无效 secondary 均不能凑覆盖率；结论或 codes 不一致时必须写不少于 8 个非空白字符的`resolution`；
- 主编码的任何`revise`或`fail`都阻断发布；不能把“需要修改”留在报告里同时给出通过结论；
- 第二编码出现`revise`或`fail`也会阻断发布。`resolution`只记录分歧证据，不能单靠一句说明覆盖第二编码发现的硬失败。

人工阈值：

| 指标 | 阈值 |
|---|---:|
| 语境相关率（无`Q01`） | ≥95% |
| 无意义复读率（无`Q03`） | ≥98% |
| 无过度安全提醒率（无`Q06`） | ≥98% |
| 独立第二编码覆盖率 | ≥20% |

自动检查可证明事件完整、权威状态与工具契约，并识别已知截断／复读／泄题／过度安全模板。语境、自然度与教学适切性依照[`../../1-docs/AI对话质量评测标准与质性编码手册-2026-08-11.md`](../../1-docs/AI对话质量评测标准与质性编码手册-2026-08-11.md)人工编码。

## 6. 当前发布检查与可选正式验收

当前开发及发布只要求：

```bash
npm run quality:gate
# 或同义的当前发布入口
npm run quality:gate:release
```

二者只运行 strict lint、确定性测试和生产构建。未运行 live eval、J01–J05 或人工 review 时，命令不会因此失败。

需要诊断模型问题时，可以选择场景运行一次 Diagnostic；这仍然需要外部模型授权：

```bash
AI_DIALOGUE_PROFILE=diagnostic \
AI_DIALOGUE_SCENARIOS="S07,S11,S17" \
AI_DIALOGUE_REPETITIONS=1 \
npm run eval:ai:diagnostic
```

只有明确决定进行正式对外／研究级质量验收，才执行下面的两阶段流程。

### 阶段 A：生成机器通过的 live artifact

```bash
AI_DIALOGUE_RUN_ID="release-20260811-001" \
AI_DIALOGUE_JOURNEY_RESULTS="artifacts/browser-journeys/browser-run.json" \
npm run quality:gate:formal:live
```

### 阶段 B：完成人工编码后验证精确 artifact

```bash
AI_DIALOGUE_REVIEW_ARTIFACT="artifacts/ai-dialogue-eval/release-20260811-001.json" \
AI_DIALOGUE_REVIEW_RESULTS="artifacts/ai-dialogue-eval/release-20260811-001-review.json" \
AI_DIALOGUE_REVIEW_SUMMARY="artifacts/ai-dialogue-eval/release-20260811-001-review-summary.json" \
npm run quality:gate:formal
```

`quality:gate:formal`是正式研究级校验命令：它重跑本地`quality:gate`，然后校验已存在的 live artifact 与人工 review。它不重跑 live eval，避免在人工编码之后覆写已审核 artifact。Review 中的`artifactSha256`与当前 artifact 文件字节不一致时代码 2 失败，同`runId`也不能复用旧编码。

校验器不会信任 artifact 里单独写入的`machinePassed: true`。它要求 schema 4、Release profile、至少 3 次重复、完整 manifest、100% journey、无 fatal／复现问题、全部 threshold 通过，并从完整`results`重新计算机器门禁；同时重新读取当前工作区的关键文件与源码树，和 live artifact 指纹逐项比对。结构伪造或源码已变化以代码 2 失败；完整人工编码中存在`revise`／`fail`以代码 1 失败。

## 7. 环境变量

| 环境变量 | 默认 | 用途 |
|---|---|---|
| `AI_DIALOGUE_PROFILE` | runner 直接调用默认`release`；`eval:ai:live`脚本固定`diagnostic` | `release`或`diagnostic` |
| `AI_DIALOGUE_TEST_API` | 无 | 可选外部 Agent API；留空时启动 managed server |
| `AI_DIALOGUE_TEST_OUTPUT_DIR` | `artifacts/ai-dialogue-eval` | live artifact 稳定归档目录 |
| `AI_DIALOGUE_RUN_ID` | 时间戳 + PID | 显式运行 ID；正式验收建议固定 |
| `AI_DIALOGUE_SCENARIOS` | 全部 | 逗号分隔场景 ID；只建议 Diagnostic 使用 |
| `AI_DIALOGUE_REPETITIONS` | Release `3`，Diagnostic `1` | 每场景 1–5 次；Release 至少 3 |
| `AI_DIALOGUE_TEST_WORKERS` | `3` | 并行 1–4 个场景 |
| `AI_DIALOGUE_JOURNEY_RESULTS` | 无 | Journey result JSON；Release 必填 |
| `AI_DIALOGUE_JOURNEY_EVIDENCE_ROOTS` | Journey result 所在目录 | 允许读取证据文件的根目录；多个值使用系统路径分隔符 |
| `AI_DIALOGUE_MODEL_TAG` | managed server 的`OPENAI_MODEL` | 可选显式标签；与共用配置不一致时 Release 失败 |
| `AI_DIALOGUE_PROVIDER_TAG` | 主模型 endpoint host | 可读 provider 标签 |
| `AI_DIALOGUE_REVIEW_ARTIFACT` | 无 | 已机器通过的 live artifact 路径 |
| `AI_DIALOGUE_REVIEW_RESULTS` | 无 | 人工 review result 路径 |
| `AI_DIALOGUE_REVIEW_SUMMARY` | review 目录下`review-summary.json` | 人工门禁结果输出 |

## 8. 退出码

### `eval:ai:live`

| code | 含义 |
|---:|---|
| 0 | 完整对话 manifest、自动契约／表达阈值与旅程证据全部通过；人工 review 仍为 pending |
| 1 | 无运行级 fatal，但自动质量阈值未达标，或结构完整的旅程中有失败 Step |
| 2 | 场景／运行错误、空样本、终态/SSE/分泡 fatal、Release manifest 或旅程证据不完整、可复现指纹问题或写盘失败 |

### `eval:ai:review`

| code | 含义 |
|---:|---|
| 0 | live artifact 机器门禁已通过，review 队列完整、SHA-256 绑定正确、二次复核和人工阈值全部通过 |
| 1 | review 结构完整，但机器门禁、人工质量阈值、二次复核比例或任一 fail decision 阻断发布 |
| 2 | 缺文件，JSON 不可读，runId/SHA-256 不匹配，漏评／重复／多评，编码字段非法，或编码员分歧未裁决 |
