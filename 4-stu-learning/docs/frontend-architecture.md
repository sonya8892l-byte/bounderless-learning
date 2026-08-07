# 学生端前端架构规范

> 关联规范：[`dialogue-runtime-protocol.md`](dialogue-runtime-protocol.md) 定义回合理解、学习状态、工具调用、客户端事件和课程小步契约；[`../../6-lessons/COURSE-SUBMISSION-SPEC.md`](../../6-lessons/COURSE-SUBMISSION-SPEC.md) 定义课程团队的提交字段。

## 1. 目标与边界

学生端是课程无关的通用运行壳。课程名称、阶段、角色、角色阶段、Step、工具参数、地图、收集物与素材来自 `6-lessons`。页面和 renderer 中不得按故宫、四渡赤水、角色名称或任务名称增加流程分支。

当前工程已经接入真实对话后端、SSE 流式事件、课程编译器、学习状态机、工具调度、证据上传、高德地图与教师指令接口。浏览器维护界面状态和未提交草稿，服务端维护可推进的学习状态与私有判定配置。

## 2. 从课程内容到学习体验

```text
6-lessons/lesson_xxx/*.md + assets
  → scripts/sync-lessons.mjs
  → src/generated/lesson-public.js + public/lessons
  → engine/lesson-parser.js
       └─ engine/tool-registry.js 解析 A01–A07 与单行 JSON 参数
  → server/course/compiler.js
       ├─ publicLesson / publicConfig：学生可见
       └─ validation / private course：仅服务端可见
  → server/agent/service.js
       ├─ 回合理解、RAG、Prompt、LLM 与流式输出
       ├─ 工具权限、结果校验和 FSM
       └─ assistant / UI / tool / state 事件
  → services/ai-service.js（SSE/API 边界）
  → app-controller.js
       └─ components/activity-tools.js 组合渲染当前 Step
  → 学生操作结果、文件证据和工具值回传服务端
```

课程 Markdown 是内容源。`src/generated` 与 `public/lessons` 是同步产物，只供 Vite、浏览器和服务端稳定读取，不应直接修改。

## 3. 分层职责

### 3.1 页面壳

`src/pages/student-learning.html` 只提供稳定界面区域：

- 教师控制的课程导入等待态；
- 角色领取；
- “我的任务 / 小组”双 Tab；
- 对话消息、快捷回复、阶段卡和输入区；
- 工具卡、导航卡、收集物结果卡；
- 进度、时间银行、角色预览浮层；
- 教师消息、暂停和集合指令反馈。

课程导入期不提供学生操作。教师端开放角色领取后进入课程角色流程。导入占位结构属于平台壳，课程只配置可替换素材。

### 3.2 课程解析与编译

`src/engine/lesson-parser.js` 将 Markdown 转换为统一课程对象：

- `course.md`：标题、核心问题、角色体系、主题和课程级素材；
- `phases.md`：课程阶段、时长、模式、地点和触发条件；
- `roles/*.md`：N 个角色、角色阶段、结构化 Step、位置和课程活动工具；
- `time-bank.md`：CM01 启用状态、规则、计量单位和任务池；
- B1–B6 文件：知识、引导、限制、阶段提示、评估和脚手架；
- `assets/`：背景、地图、角色、收集物和课程媒体。

`server/course/compiler.js` 在同一解析结果上生成双视图：

- `publicLesson` 与工具 `publicConfig` 供学生端渲染；
- 完整课程、工具 `validation`、正确答案、映射、期望识别结果、评估规则和限制只留在服务端。

所有学生端字段必须经过公开过滤。新增工具私有字段时，应同步更新编译器过滤、服务端校验和防泄露测试。

### 3.3 中央工具注册表

`src/engine/tool-registry.js` 是课程活动工具的唯一能力目录，当前稳定 ID 为：

```text
photo · audio · text · sketch · quiz
builder · simulation · team · media · scanner
```

注册表负责：

- A01–A07 模块和中文子类型到工具 ID 的映射；
- 每种工具的通用名称、图标、输出类型和平台默认值；
- 解析 Step 的单行 JSON `工具参数`；
- 合并平台默认值、模块模式推断和课程显式参数；
- 解析工具中的课程素材路径。

题干、选项、字段、卡片、素材、推演规则和正确答案均来自课程。注册表中只允许通用默认值和跨课程能力，不得加入某门课的知识、题目或角色判断。

P01–P05 固定能力和 CM01 不加入活动工具注册表：

- 对话、语音通道、位置、时间与师生通信由平台运行时提供；
- 时间银行由独立面板和 API 管理；
- `open_task_tool` 是模型侧的安全调度入口，具体活动类型由当前课程工具实例决定。

### 3.4 组合工具 renderer

`src/components/activity-tools.js` 保存工具 ID 到 renderer 的唯一映射。`app-controller.js` 只传入当前 Step 的 `tools[]`、草稿证据、`taskId` 和 `stepId`。同一个 Step 可以组合拍照、文字、答题、画板或团队记录，renderer 按课程顺序生成一个组合工具区。

每个 renderer 只负责：

- 根据公开配置展示输入和反馈；
- 把草稿写入 `evidence.toolValues[stepId][toolId]`；
- 执行即时、可恢复的客户端完整性检查；
- 对画板、录音和照片保留待上传文件；
- 不读取正确答案、隐藏映射、评分 Prompt 和未解锁知识；
- 不直接改变 Step、角色阶段或课程阶段状态。

新增活动工具时，需要同时完成：

1. 中央目录及默认配置；
2. 课程参数解析和素材解析；
3. 学生公开字段过滤；
4. renderer、草稿 handler 和序列化；
5. 服务端私有参数校验；
6. 成功、失败、取消、过期和重试测试。

### 3.5 运行状态

客户端维护：

- 当前屏幕、角色、Tab 和打开的浮层；
- 当前学习视图 `learningView` 与闯关页码 `challengePageIndex`；
- 可见消息、流式消息、快捷回复和加载状态；
- 照片、录音、表单、画板及其他未提交工具草稿；
- 本地定位观测、地图实例和临时媒体对象；
- 待处理工具调用 ID 和教师指令回执状态。

服务端维护：

- 会话、课程、角色、课程阶段、角色阶段和当前 Step；
- `pendingQuestion`、对话生命周期、历史摘要、情绪和脚手架等级；
- 当前允许工具、`toolCallId`、已完成 Step、证据 ID 和角色阶段状态；
- 位置验证、停留时间、教师覆盖、时间状态和安全事件。

服务端是进度推进的最终判定方。客户端刷新或接口重试时使用会话 ID 恢复；过期工具结果不能改变新任务状态。

### 3.6 学习视图与共享任务工作区

公开课程对象使用以下配置控制双视图 Gate：

```js
learningView: {
  enabled: true,
  default: 'dialogue',
  allowStudentSwitch: true,
  allowFutureTaskBrowse: false,
}
```

平台默认开启双视图，所有未配置课程默认进入对话模式并允许学生切换；课程可在 `course.md / ## 学习视图` 中显式关闭或覆盖。`learningView` 只描述前端呈现方式，与 URL 中的 `mode=connected/standalone`、任务区的 `activeTab=task/team` 分开管理。Gate 开启时，“我的任务”右下角显示平台级絮絮悬浮按钮：对话页显示“切换为闯关模式”，闯关页显示“切换为智能 AI 模式”；进入“小组”页时隐藏。切换学习视图不能创建会话、调用 Agent、推进 Step 或插入对话消息。

絮絮的名称和媒体路径统一来自 `src/engine/platform-config.js / PLATFORM_COMPANION`，四个键锁定，课程覆盖不生效。性格、语气、口头禅和本课侧重的缺省值在 `_platform/companion.md`，课程可在 `course.md / ## 人设侧重` 里调整——这条通路只影响服务端 System Prompt，编译后的公开课程对象仍不包含 `persona`、`companionIdle` 或 `companionTalk`。学生端消息头像、思考状态和学习视图悬浮入口共用 `companionAvatar()` 渲染组件；动画无法播放时统一显示平台静态头像。悬浮入口使用固定宽度与固定右下角锚点，切换文案和学习视图不会改变其位置。服务端 Agent 提示也直接读取同一份平台配置，保证更换课程时保持一致。

对话模式和闯关模式共用 `renderTaskWorkspace(context)`。两种视图从同一份角色任务、`progress`、`guidanceStepIndices`、证据、工具值、`toolCallId` 和完成状态渲染，继续调用同一组完成小步与提交任务入口。任何时刻只能挂载当前视图的一套可交互工具节点；隐藏视图不得保留第二套答题、画板、录音或上传 DOM 实例。

闯关页以角色任务为分页单位：已完成任务可只读回看，当前任务可操作，未来任务默认锁定。课程验收期可以临时设置 `allowFutureTaskBrowse: true`，放开未来任务页和“下一关”的浏览；未来任务仍标记为待解锁，不能完成 Step 或提交任务。上线前将该配置恢复为 `false`。`challengePageIndex` 只控制查看页，不能代表正式进度。页内 AI 反馈镜像同一轮 SSE 文本，并以随后的 `state.updated` 判断通过或继续修改；请求失败时保留草稿和原进度。

客户端会在周期性 `context_tick` 中上报可选的 `learningView`。服务端只将其记录到 `environmentState`，不把它用于权限、工具有效性或状态推进判定。

### 3.7 真实对话后端

`src/services/ai-service.js` 是浏览器到服务端的 API 边界，当前负责：

- 创建和读取智能体会话；
- 向 `/api/agent/turn` 提交用户文本、快捷回复、生命周期事件和工具结果；
- 消费 `text/event-stream`，即时转发 `assistant.delta`、完整回复、工具请求、UI 和状态事件；
- 压缩并上传图片证据；
- 调用时间银行、学生求助、教师指令、回执和在线状态接口。

`server/agent/service.js` 负责组织运行上下文、检索最小必要课程知识、调用真实 LLM、执行限制与来源策略、验证工具权限和结果、更新状态机并输出事件。模型只能提出回复和工具调用；平台校验通过后才会打开工具或推进状态。

模型、地图、存储和语音服务的服务器密钥只存在服务端环境。浏览器环境只允许保存高德 Web 端公开配置等端侧 SDK 必需参数。

## 4. 工具调用与校验协议

### 4.1 调用

1. 对话策略依据当前 Step 和学生意图决定是否需要工具。
2. 模型调用 `open_task_tool` 时只能提交当前服务端生成的工具实例 ID。
3. 服务端检查会话、角色阶段、Step 和工具实例后发送 `tool.requested`。
4. 客户端按 payload 中的公开 `tools[]` 渲染当前 Step。
5. 未完成的同一工具调用保持唯一，重复请求更新原卡片或被服务端拒绝。

导航和教师求助使用平台固定请求；课程活动继续经过统一 `open_task_tool` 调度，减少模型侧工具数量并避免参数越权。

### 4.2 结果

客户端工具草稿按以下逻辑结构维护并序列化：

```json
{
  "stepId": {
    "photo": {},
    "text": { "fields": {} },
    "quiz": { "answer": "..." },
    "builder": { "placements": {} }
  }
}
```

完成 `ai_evaluation` 小步时，客户端只为当前小步准备压缩后的视觉输入和结构化工具值。提交角色阶段时，客户端一并回传 `toolCallId`、结构化 `toolValues`、照片数量、补充文字和已上传证据 ID。画板与录音等本地二进制结果会转换为证据文件，临时对象、录音器、媒体流和 blob URL 不进入 JSON。

### 4.3 双层校验

客户端校验负责快速反馈：必填、字数上下限、单个小步的照片上下限、录音时长、画板是否完成、答题是否有输入、搭建卡片与区域最低数量、推演轮次和分支去重、团队角色与记录类型、媒体完成和扫码结果。

服务端使用完整私有配置重新校验，并额外检查：

- 会话、`toolCallId`、角色阶段和 Step 是否仍有效；
- 当前 `completionMode` 是否允许该完成事件；
- 客观题答案、数值误差、多选顺序规则；
- 拼合正确映射、区域最低数量、扫码期望结果、推演分支和团队记录类型；
- 位置、教师确认、复合条件及必要的 AI 评估；`ai_evaluation` 使用当前 Step 证据要求、`evaluationRef` 标签、B5 原文、按 `restrictionRef` 精确解析的限制、课程知识和文字/图像结果输出结构化 `passed / retry`，未通过时停留在原 Step；
- 所有必做 Step 是否完成，角色阶段是否可以推进。

客户端显示“已填写”或“已完成操作”只表示本地草稿完整。只有服务端返回的 `state.updated` 可以更新正式进度。

## 5. 客户端事件渲染

学生端按稳定事件类型渲染：

- `assistant.delta`：追加到当前流式气泡；
- `assistant.completed`：补齐文本、来源标签和引用；
- `stage.started`：显示角色阶段名称、地点、主要任务和 `suggestedSeconds`；
- `ui.quick_replies`：显示与唯一待回答问题绑定的快捷选项；
- `tool.requested`：渲染导航、教师求助或课程活动卡；
- `state.updated`：同步当前 Step、进度、位置和完成状态；
- `agent.error`：保留草稿并显示可操作的重试原因；
- 教师消息与指令：以系统卡或高优先级全屏层呈现。

多条初始消息按节奏逐条进入；流式文字立即显示。阶段卡、对话气泡和工具卡各自承担不同信息，避免重复整段任务说明。

## 6. 新课程接入

1. 在 `6-lessons` 新建符合规范的课程目录；
2. 按 `COURSE-SUBMISSION-SPEC.md` 提供 `course.md`、`phases.md`、`roles/*.md`、B1–B6、可选 `time-bank.md` 和素材；
3. 为每个正式 Step 配置显式位置、完成方式、活动工具和单行 JSON 参数；
4. 执行 `npm run sync:lessons`；
5. 检查公开课程对象不含答案、映射、期望识别结果和隐藏知识；
6. 分别验证至少一个纯观察 Step、组合工具 Step、位置 Step 和教师确认 Step；
7. 运行课程解析测试、智能体测试和前端构建；
8. 使用 `?lesson=lesson_xxx` 进行默认 AI connected 模式的移动端回归。

课程 ID 最终应由登录会话、课程码或教师场次下发。URL 参数只服务本地演示和开发验证。

学生端未提供 `mode` 时默认连接 API 与 AI，并为独立体验自动开放角色。显式
`mode=connected` 用于教师管理场景，此时角色仍等待教师开放，也可在开发验证中附加
`teacherStart=1`。只有显式 `mode=standalone` 才使用不调用 AI 的本地课程包模式。

## 7. 当前接入状态与后续接口

以下链路已经接入：真实 LLM 对话和 SSE、课程知识检索、限制过滤、统一活动工具注册表、10 种活动 renderer、结构化工具草稿、服务端私有校验、`ai_evaluation` 结构化通过/重试、图片与录音证据上传、高德导航和围栏观测、时间银行照片/GPS 验证、学生求助与教师指令轮询。

以下能力仍需在现有接口上继续完善，课程 README 和演示验收中要明确其状态：

- `ai_evaluation`：当前输出结构化 `passed / retry`，达到 Step 最大尝试次数后建议呼叫老师；后续可将建议升级为教师端可领取的正式 `teacher_required` 审核队列；
- `teacher_confirm`：服务端已有完成方式校验，教师“审核通过/退回”还需与当前 Step 的完成事件完整关联；
- `compound`：当前覆盖位置与工具的基础组合，后续需支持课程声明的 AND/OR 条件树；
- A05 团队协作：当前 renderer 可记录本机讨论产出，组员实时合并、投票一致性和证据看板同步仍需实时通道；
- A07 实物识别：二维码/条码优先使用浏览器能力并支持手输；配置为 `ai_evaluation` 的实物图像会进入视觉验收，定制识别模型、标准对象库和置信度阈值仍需独立服务；
- P02 语音通道：A01 录音证据已使用浏览器录音能力；全局对话 TTS、唤醒词、静音策略和小程序原生 STT 仍需端能力接入；
- CM01 拍照打卡和定位签到：相机上传、文字补充、设备 GPS、课程坐标和半径校验已接入；目标物图像语义与持续停留验证仍需加强；
- 弱网恢复：需继续补齐工具草稿持久化、上传队列、断线重试和会话恢复测试。
