# 《故宫600年不积水的秘密》课程配置手册

> 课程目录 ID：`lesson_gewu_001`
> 主题模板：`gewu`
> 课程源目录：`6-lessons/lesson_gewu_001/`
> 通用提交规范：[COURSE-SUBMISSION-SPEC.md](../COURSE-SUBMISSION-SPEC.md)
> 对话与小步协议：[dialogue-runtime-protocol.md](../../4-stu-learning/docs/dialogue-runtime-protocol.md)

这份 README 面向课程设计、教研、素材和实施团队，说明本课程全套文件如何配置、文件之间如何绑定，以及当前运行时已经接入到什么程度。

课程内容只维护在本目录。`4-stu-learning/src/generated/` 和 `4-stu-learning/public/lessons/` 都是编译产物，课程团队不要直接编辑。

## 1. 平台提供与课程团队提交

### 1.1 平台统一提供

- 学生端小程序式页面壳、角色领取页、我的任务、小组页和时间银行入口；
- AI 学习同伴“絮絮”的名称、基础形象、待机动画和对话动画；
- 对话状态、流式输出、意图判断、待回答问题、主动提醒和异常恢复；
- A01–A07 活动工具注册表、工具调度和通用交互组件；
- 高德地图加载、导航入口、位置状态基座；
- 教师求助、教师通知、暂停、恢复、证据复核等通用能力；
- 课程 Markdown 解析、公开字段裁剪、防剧透脱敏和课程素材同步。

### 1.2 本课程团队提交

- 课程名称、核心问题、学段、场地、时长和课程叙事；
- 六个治水官的名称、说明、地点、角色任务和收集物；
- 六个课程阶段及每个阶段的 AI 行为提示；
- 每个角色阶段的小步、工具参数、证据要求和通过条件；
- 课程知识、来源、角色可见范围和揭示时机；
- 引导、脚手架、防剧透限制、评估标准和课程目标；
- 时间银行题目、答案、奖励和解锁阶段；
- 课程背景、角色卡、徽章、密符、地图、任务图和课程媒体。

### 1.3 课程团队不要配置

- 絮絮的名称、平台头像和平台动画路径；
- 模型名称、模型密钥、地图密钥和服务地址；
- `open_task_tool`、`show_navigation`、`retrieve_course_knowledge`、`call_teacher` 等智能体内部工具；
- 教师权限、会话存储、SSE、上传接口和安全底线。

课程只需要配置 A01–A07 活动能力。智能体会在当前状态允许时，通过统一调度器打开对应课程工具。

## 2. 当前运行时接入状态

| 内容 | 当前状态 | 配置时的处理方式 |
|---|---|---|
| `course.md`、`phases.md`、`roles/*.md` | 已解析并用于学生端和服务端 | 可按本文语法维护 |
| A01–A07 工具注册表 | 已接入解析器、十种前端 renderer 和服务端基础 validator | 使用 `功能模块` 与 JSON `工具参数` |
| 结构化 Step | 已解析 | 新增或重做任务时优先使用 |
| 本课现有 18 个任务 | 仍以旧版 `引导步骤` 为主 | 可运行；后续逐角色迁移为结构化 Step |
| `knowledge/*.md` | 已进入服务端检索 | 必须填写来源、角色和揭示时机 |
| `guidance/*.md` | 已按角色和任务序号装配 | 当前主要提取任务段中的简短引导语 |
| `scaffolds/*.md` | 已按角色和任务序号装配 | 当前自动使用 L1–L3；L0、L4保留为课程设计内容 |
| `restrictions.md` | 已用于输出防剧透和公开包脱敏 | 解除条件只使用本文列出的格式 |
| `prompts/*.md` | 已按 Phase 装配 | 当前每轮只取阶段文件前部的有限内容 |
| `evaluation.md` | 平台已支持作为 `ai_evaluation` 验收上下文 | 本课现有兼容任务尚未逐步改成结构化 AI 验收 |
| `objectives.md` | 课程资料已保留 | 尚未进入运行时解析；`目标关联`目前是记录字段 |
| Step 中的知识/引导/限制/评估/脚手架引用 | 部分接入 | 知识引用用于定向检索，角色 guidance/scaffold 按任务装配；精确标题定位仍待完善 |
| photo/audio/text/sketch/quiz/builder/simulation/team/media/scanner | 已有前端操作与基础结果校验 | 上线前仍需逐任务验证参数和失败恢复 |
| `ai_evaluation`、`teacher_confirm`、`location_event`、`compound` | 已进入平台状态机 | AI 通过/重试已可用；本课迁移后仍需教师确认、位置与复合规则专项验收 |
| 时间银行选择题、开放题、照片打卡、定位签到、余额与赠时 | 已接入 | 照片已接相机选择与上传；定位已接设备 GPS 和半径校验；目标物视觉识别、停留时长仍需补充 |

配置文件可以提前保留未来字段。上线验收仍以当前代码真实返回的状态为准。

## 3. 完整目录与逐文件作用

```text
lesson_gewu_001/
├── README.md                   # 本手册
├── course.md                   # 课程身份、角色体系、视觉素材、絮絮本课身份
├── phases.md                   # Phase 1–6 的名称、时长、地点、触发和流程
├── objectives.md               # K/S/C 课程目标体系；当前供教研和人工评估使用
├── evaluation.md               # 课程评估标准；供结构化 ai_evaluation 使用
├── restrictions.md             # 防剧透、跨角色隔离和解除条件
├── time-bank.md                # 时间银行规则、题目、答案和奖励
├── assets-checklist.md         # 素材来源、完成度、授权和占位状态
├── roles/                      # 角色、角色阶段、Step、位置、工具和通过条件
│   ├── dragon-counter.md
│   ├── slope-surveyor.md
│   ├── ditch-finder.md
│   ├── river-guide.md
│   ├── moat-guard.md
│   └── truth-seeker.md
├── guidance/                   # 各角色、各任务的 AI 引导目标和禁止行为
│   ├── dragon-counter.md
│   ├── slope-surveyor.md
│   ├── ditch-finder.md
│   ├── river-guide.md
│   ├── moat-guard.md
│   └── truth-seeker.md
├── scaffolds/                  # 各角色、各任务的 L0–L4 分层帮助
│   ├── dragon-counter.md
│   ├── slope-surveyor.md
│   ├── ditch-finder.md
│   ├── river-guide.md
│   ├── moat-guard.md
│   └── truth-seeker.md
├── knowledge/                  # 服务端知识条目；按主题拆分
│   ├── chishou.md              # 螭首、台基和排水口知识
│   ├── slope-design.md         # 地面坡度和高差设计
│   ├── drainage-ditches.md     # 明沟、暗沟和沟网
│   ├── inner-river.md          # 内金水河及水流路径
│   ├── moat-system.md          # 护城河和外围水系
│   └── overall-system.md       # 综合排水系统与证据整合
├── prompts/                    # 文件名中的数字绑定 Phase
│   ├── phase1-immersive.md     # Phase 1 沉浸叙事
│   ├── phase2-field.md         # Phase 2 现场采证
│   ├── phase3-deduction.md     # Phase 3 推理推演
│   ├── phase4-xuanji.md        # Phase 4 璇玑时刻
│   ├── phase5-summary.md       # Phase 5 总结汇报
│   └── phase6-ending.md        # Phase 6 尾声
└── assets/
    ├── backgrounds/            # 课程封面、聊天背景、转场、证书
    ├── companion/              # 历史副本；当前运行时使用平台统一絮絮素材
    ├── maps/                   # 导航图、排水剖面、河道路径
    ├── roles/                  # 角色卡与角色徽章
    ├── tasks/                  # 任务专用图片
    ├── tokens/                 # 六枚密符图
    └── videos/                 # 导入和推演媒体或占位图
```

`guidance/` 和 `scaffolds/` 中的文件名必须与 `roles/` 的角色 slug 完全一致。上面的树列出全部 Markdown 配置文件；二进制素材逐项见第 17 节和 `assets-checklist.md`。

## 4. ID 与绑定规则

### 4.1 ID 规则总表

| 对象 | 本课格式 | 来源与用途 |
|---|---|---|
| 课程 ID | `lesson_gewu_001` | 目录名、URL参数、会话课程 ID |
| 主题 | `gewu` | `course.md / 主题模板`，选择主题 CSS |
| Phase ID | `phase-1`～`phase-6` | 由 `phases.md` 的 `Phase N` 自动生成 |
| 角色 ID | `dragon-counter` 等 | 由 `roles/{slug}.md` 文件名生成 |
| 角色阶段 ID | `task-1`～`task-3` | 当前建议在角色文件中显式填写 |
| Step ID | 语义化 kebab-case | 必须在课程内稳定，示例 `dragon-photo-context` |
| 知识 ID | `K-01`～`K-19` | `knowledge/*.md` 二级标题 |
| 目标/量规 ID | `K1`～`K6`、`S1`～`S6`、`C1`～`C5` | `objectives.md`、`evaluation.md`、角色 `目标关联` |
| 时间银行 ID | `tb-01`～`tb-10` | `time-bank.md` 任务池 |
| 工具实例 ID | `{roleId}:{taskId}:primary` | 编译器生成，课程团队不要手写 |

知识 ID 带连字符和两位数字，例如 `K-03`；目标 ID 不带连字符，例如 `K3`。两套编号用途不同，不能互换。

### 4.2 角色绑定

以数龙官为例：

```text
roles/dragon-counter.md
guidance/dragon-counter.md
scaffolds/dragon-counter.md
knowledge 条目中的 roles: 数龙官
restrictions.md 中的“数龙官完成任务2后”
```

角色显示名改变时，需要同步检查知识条目的 `roles` 和限制表中的解除条件。

### 4.3 任务序号绑定

当前 guidance、scaffolds 和角色限制均依赖任务序号：

```text
roles/dragon-counter.md       ### 任务2：算其数
guidance/dragon-counter.md    ## 任务2：算其数
scaffolds/dragon-counter.md   ## 或 ### 任务2：算其数
restrictions.md               数龙官完成任务2后
```

因此本课角色阶段 ID 保持 `task-1`、`task-2`、`task-3`。调整任务顺序时，四处内容必须一起检查。

### 4.4 Phase 绑定

```text
phases.md                     ## Phase 2：现场采证
运行时                         phase-2
prompts/phase2-field.md       阶段提示词
course.md                     任务阶段：phase-2
time-bank.md                  unlock_after: phase2-start
```

角色任务里的 `阶段：Phase 2 现场采证` 当前作为课程文案保存。课程总阶段推进仍由场次状态和教师指令控制。

## 5. `course.md` 配置

### 5.1 有效结构

```md
# 故宫600年不积水的秘密

> 故宫排水智慧 · 跨学科研学课例

## 基本信息
- 系列：格物
- 系列代码：gewu
- 主题模板：gewu
- 场地：故宫博物院（中轴线区域）
- 时长：6小时（含午休）
- 适用年级：小学高年级 / 初中 / 高中
- 分组：6人一组，每人一个角色

## 智能体人设
- 本课身份：故宫排水探究学习同伴
- 性格：亲切、好奇、尊重证据
- 语气：少年感、清晰、一次只引导一个行动

## 学生端角色体系
- collectionName：治水官
- itemName：身份
- 选择眉题：{roleCount}种身份 · {roleCount}段证据
- 选择标题：选择你的{collectionName}身份
- 选择说明：每位成员负责一个系统环节。集齐{roleCount}枚{collectionItemName}，才能解锁{unlockTarget}。
- collectionItemName：密符
- collectionPanelName：小组密符
- unlockTarget：璇玑时刻
- 任务阶段：phase-2
```

`collectionName` 等英文键区分大小写。角色选择文案支持 `{roleCount}`、`{collectionName}`、`{itemName}`、`{collectionItemName}`、`{unlockTarget}`。

### 5.2 视觉素材

```md
## 学生端视觉素材
- 课程封面：assets/backgrounds/cover.png
- 对话背景：assets/backgrounds/chat-bg.png
- 阶段转场：assets/backgrounds/phase-transition.png
- 完课证书：assets/backgrounds/certificate-bg.png
- 导航地图：assets/maps/navigation-map.png
- 导入占位图：assets/videos/video-storm-coming.png
- 推演占位图：assets/videos/video-simulation.png
```

路径相对于课程目录。统一写成 `assets/...`，区分大小写。

`名字`、`智能体待机动画`、`智能体对话动画` 等历史字段不会覆盖平台统一 IP。当前目录中的 `assets/companion/*.webm` 不参与平台絮絮渲染。

### 5.3 当前未读取字段

`编号`、`坐标中心`、`最大并行组数`、口头禅、特殊行为、叙事框架和密符机制可以作为课程说明保留，当前解析器不会用它们直接控制运行状态。

## 6. `phases.md` 与阶段提示词

### 6.1 Phase 语法

```md
## Phase 2：现场采证
- 时长：90min
- 模式：个人（按角色分散）
- 地点：故宫各区域（由角色决定）
- 功能模块：A01(多模态采集), A02(答题评测), A07(扫码识别)
- 触发条件：Phase 1 结束 + 教师确认
- 结束条件：教师手动推进 或 时间耗尽

### 流程
1. AI根据角色显示目标区域
2. 每个角色完成3个角色阶段
3. 完成后获得密符
```

标题必须使用 `## Phase N：名称`。运行时自动生成 `phase-N`。

### 6.2 本课阶段对照

| Phase ID | 名称 | 时长 | 阶段提示词 |
|---|---|---:|---|
| `phase-1` | 沉浸叙事 | 20min | `prompts/phase1-immersive.md` |
| `phase-2` | 现场采证 | 90min | `prompts/phase2-field.md` |
| `phase-3` | 推理推演 | 40min | `prompts/phase3-deduction.md` |
| `phase-4` | 璇玑时刻 | 30min | `prompts/phase4-xuanji.md` |
| `phase-5` | 总结汇报 | 20min | `prompts/phase5-summary.md` |
| `phase-6` | 尾声 | 10min | `prompts/phase6-ending.md` |

提示词文件名必须符合 `prompts/phase数字-名称.md`。编译器根据文件名中的数字绑定 Phase。

阶段提示词当前按需进入模型上下文，且只截取文件前部的有限内容。最重要的阶段目标、泄题边界和絮絮行为放在文件开头；详细教案仍可保留在后文供课程团队查看。

## 7. `roles/*.md` 配置

### 7.1 角色基本信息

```md
# 🐲 数龙官

> 核心问题：千龙吐水的“千”究竟有多大？

## 基本信息
- 排序：1
- 地点：三大殿三台（太和殿·中和殿·保和殿）
- 地理围栏：中心(116.3972, 39.9171) 半径100m
- 类型：核心角色
- 选择说明：追踪螭首的形态与数量，判断“千龙吐水”的“千”究竟有多大。
- 角色卡图：assets/roles/role-card-dragon-counter.png
- 角色徽章图：assets/roles/badge-dragon-counter.png
- 收集物：Y
- 收集物图：assets/tokens/mifu-Y.png
```

必填字段：`选择说明`、`角色卡图`、`角色徽章图`、`收集物`、`收集物图`。

`地理围栏` 当前可从“中心(经度, 纬度) 半径Nm”提取坐标和半径。没有坐标时会降级为地点展示和手动确认。

### 7.2 角色阶段字段

```md
### 角色阶段1：观其形
- id：task-1
- 阶段：Phase 2 现场采证
- 配置：识别螭首的位置、形态和出水口
- 位置模式：inherit_role
- 地点：
- 坐标：
- 围栏半径：
- 到达验证：manual
- 最短停留：0min
- 建议时长：15min
- 无操作提醒：3min
- 提醒冷却：2min
- 最大主动提醒：2
- 推进方式：auto_after_validation
- 完成方式：tool_result
- 功能模块：A01(拍照采集)
- 工具参数：{"photo":{"minCount":5,"maxCount":8,"recognition":"course-evidence"}}
- 证据要求：5张照片覆盖全景、侧面和出水口细节
- 通过条件：至少5张有效照片 + 观察说明
- 目标关联：K3, S4, C1
- AI引导方向：引导学生注意材质、出水口和排列规律
```

位置模式：

- `inherit_role` 或 `inherit`：继承角色地点和围栏；
- `none`：无需位置；
- `point`：显示地点和导航，手动确认；
- `geofence`：按坐标、精度、半径和停留时间判断；
- `route`、`area`：字段可解析，使用前需要完成对应位置能力专项验收。

完成方式支持 `user_confirm`、`tool_result`、`ai_evaluation`、`teacher_confirm`、`location_event`、`compound`。当前主任务默认使用 `tool_result`。

### 7.3 旧版 `引导步骤`

本课当前角色文件使用：

```md
- 引导步骤：先观察一处螭首；换角度记录连接方式；补齐全景和细节照片
```

解析器会按分号、换行或句号切成最多 5 个兼容小步，并自动生成 `{task-id}-step-N`。兼容小步统一按 `user_confirm` 处理，无法为每一步精确绑定不同工具和证据。因此，后续修改任务时建议迁移为结构化 Step。

## 8. 结构化 Step

### 8.1 推荐语法

```md
#### Step 1：拍摄螭首与台基全景
- id：dragon-photo-context
- 小步目标：确认螭首在台基排水结构中的位置
- 学生行动：选择一处螭首，拍一张同时包含螭首、出水口和台基边缘的全景
- 位置：inherit
- 完成方式：tool_result
- 功能模块：A01(拍照采集)
- 工具参数：{"minCount":1,"maxCount":2,"recognition":"course-evidence"}
- 证据要求：照片同时包含螭首、出水口和台基边缘
- 知识引用：K-03
- 引导引用：guidance/dragon-counter.md#任务1
- 限制引用：restrictions.md#核心数据限制
- 评估引用：evaluation.md#S4
- 脚手架引用：scaffolds/dragon-counter.md#任务1
- 常见误区：只拍花纹局部，无法判断螭首所在位置
- 最大尝试：3
- 失败处理：升一级脚手架后重新拍摄
- 教师介入：连续3次无法获得有效照片
- 通过后：step:dragon-photo-detail
```

### 8.2 必填约定

- 显式填写稳定 `id`；
- 一步只安排一个主要学生行动；
- 每一步都填写 `位置`，可用 `inherit` 或 `none`；
- 工具步骤填写 `完成方式` 和 `证据要求`；
- `通过后` 指向 `step:{nextStepId}`、`role-stage:task-N` 或 `role-stage:complete`；
- Step ID 不随文案调整而改变。

当前运行时按 Step 数组顺序推进，`通过后` 已保留但尚未作为通用分支图执行。知识、引导、限制、评估和脚手架引用也尚未自动解析对应文件条目。

除知识条目的 `K-NN` 外，引用建议统一写成 `相对文件路径#标题或量规编号`，并与目标文件的标题保持一致。当前解析器把引用当作元数据保存，未来接入解析器时可以直接定位。

## 9. A01–A07 活动工具与 `工具参数`

### 9.1 工具注册表

| 模块 | `功能模块`示例 | 解析后的工具 ID | 课程配置重点 |
|---|---|---|---|
| A01 | `A01(拍照采集)` | `photo` | 张数、接受格式、识别目的 |
| A01 | `A01(语音记录)` | `audio` | 最短/最长录音、语言、转写 |
| A01 | `A01(文字表单)` | `text` | 字段、类型、必填、占位文案 |
| A01 | `A01(画板标注)` | `sketch` | 画布、颜色、底图 |
| A02 | `A02(单选题)` | `quiz` | 题型、题目、公开选项 |
| A03 | `A03(拼合搭建)` | `builder` | 模式、材料、分区和连线 |
| A04 | `A04(沙盘推演)` | `simulation` | 回合、资源、选择和指标 |
| A05 | `A05(组内讨论)` | `team` | 讨论/投票/分工、最低参与量 |
| A06 | `A06(沉浸媒体)` | `media` | 类型、URL、海报、完成要求 |
| A07 | `A07(扫码识别)` | `scanner` | 二维码/实物、提示和手动兜底 |

`A01(多模态采集)` 会展开为 photo、audio、text、sketch 四种工具。课程需要更聚焦的操作时，应明确写具体能力。

工具之间默认互相独立。拍照、扫码、语音、文字等能力只有在课程 `功能模块` 中被显式声明时才会渲染；例如只写 `A01(拍照采集)` 时只出现拍照工具，扫码必须单独写 `A07(扫码识别)`。

### 9.2 单工具参数

Step 只配置一个工具时，可以直接填写该工具配置：

```md
- 功能模块：A01(拍照采集)
- 工具参数：{"minCount":3,"maxCount":6,"accept":"image/*","recognition":"course-evidence"}
```

### 9.3 多工具参数

角色阶段同时配置多种工具时，使用工具 ID 作为一级键：

```md
- 功能模块：A01(拍照采集), A02(开放问答)
- 工具参数：{"photo":{"minCount":3,"maxCount":6},"quiz":{"type":"open_response","question":"说明你的估算方法"}}
```

当前编译器会合并角色阶段和所有 Step 的工具，并按工具 ID 去重，形成一个角色阶段活动工具实例。Step 级独立调用和独立验收仍需要按任务回归验证。

### 9.4 参数公开与私有边界

课程源中的 `工具参数` 可以同时包含公开交互配置和平台支持的私有验证配置：

- 公开：题干、公开选项、字段名、底图、张数、录音时长、回合数和学生提示；
- 私有：`answer`、`answers`、`expectedResults`、`correctMapping`、`validConnections`、`explanation`、`retryMessage`、`evaluationPrompt`，以及 choice 中的 `score`、`correct`。

同步脚本和服务端工具编译器会从学生端公开配置中删除上述私有键，同时在服务端课程对象中保留它们用于基础校验。原始 `toolParameters` 字符串也不会下发浏览器。

不要自创未经脱敏器登记的私有键，也不要写入 API Key、教师评语、学生隐私或模型 System Prompt。每次新增验证字段后，都要先更新公开字段裁剪测试。

当前服务端可校验客观 quiz、数值容差、builder 映射、scanner 预期结果和十种工具的基础完成条件。平台已为结构化 `ai_evaluation` 接入文字/图片/画板的真实模型验收，并在未通过时停留原 Step；本课旧版任务需要先迁移成结构化 Step 才能逐项启用。

### 9.5 照片数量

不要只依赖中文文案推断张数。推荐显式配置：

```json
{"photo":{"minCount":5,"maxCount":8}}
```

兼容提取只稳定识别“至少5张”“最少5张”“≥5张”等表达。

## 10. 本课角色、任务、工具和素材对照

### 10.1 六个角色

| 排序 | role ID | 显示名 | 收集物 | 角色卡 / 徽章 / 收集物图 |
|---:|---|---|---|---|
| 1 | `dragon-counter` | 数龙官 | Y | `role-card-dragon-counter.png` / `badge-dragon-counter.png` / `mifu-Y.png` |
| 2 | `slope-surveyor` | 测坡官 | I | `role-card-slope-surveyor.png` / `badge-slope-surveyor.png` / `mifu-I.png` |
| 3 | `ditch-finder` | 寻沟官 | N | `role-card-ditch-finder.png` / `badge-ditch-finder.png` / `mifu-N.png` |
| 4 | `river-guide` | 引河官 | S | `role-card-river-guide.png` / `badge-river-guide.png` / `mifu-S.png` |
| 5 | `moat-guard` | 护城官 | H | `role-card-moat-guard.png` / `badge-moat-guard.png` / `mifu-H.png` |
| 6 | `truth-seeker` | 真相官 | U | `role-card-truth-seeker.png` / `badge-truth-seeker.png` / `mifu-U.png` |

六枚密符按角色排序组成 `Y-I-N-S-H-U`。显示名称、密符名称和解锁目标均来自课程配置。

### 10.2 当前任务工具

| 角色 | task | 任务名 | 当前解析工具 | 任务图 |
|---|---|---|---|---|
| 数龙官 | `task-1` | 观其形 | photo | `assets/tasks/chishou-front.jpg` |
| 数龙官 | `task-2` | 算其数 | photo + quiz | 角色卡回退 |
| 数龙官 | `task-3` | 验其差 | text + audio | 角色卡回退 |
| 测坡官 | `task-1` | 察其势 | photo | `assets/maps/drainage-profile.png` |
| 测坡官 | `task-2` | 量其度 | photo + quiz | 角色卡回退 |
| 测坡官 | `task-3` | 析其理 | text + sketch | 角色卡回退 |
| 寻沟官 | `task-1` | 寻其踪 | photo | 角色卡回退 |
| 寻沟官 | `task-2` | 探其网 | sketch + quiz | 角色卡回退 |
| 寻沟官 | `task-3` | 绘其图 | sketch + builder | 角色卡回退 |
| 引河官 | `task-1` | 追其源 | photo | `assets/maps/inner-river-path.png` |
| 引河官 | `task-2` | 测其流 | photo + audio + quiz | 角色卡回退 |
| 引河官 | `task-3` | 演其变 | text + simulation | `assets/videos/video-simulation.png` |
| 护城官 | `task-1` | 观其堤 | photo | 角色卡回退 |
| 护城官 | `task-2` | 验其深 | photo + audio + quiz | 角色卡回退 |
| 护城官 | `task-3` | 解其用 | text + quiz | 角色卡回退 |
| 真相官 | `task-1` | 汇其证 | photo + audio + text + scanner | 角色卡回退 |
| 真相官 | `task-2` | 辨其伪 | text + quiz | 角色卡回退 |
| 真相官 | `task-3` | 断其案 | text + audio + builder | 角色卡回退 |

表中“当前解析工具”来自现有 `功能模块`。任务尚未填写显式工具 JSON 时会使用平台默认参数，上线前应逐任务补足最小张数、字段、题型、底图和完成要求。扫码只在任务明确要求二维码/对象识别时配置，例如真相官收集其他角色证据。

## 11. `knowledge/*.md`

### 11.1 条目语法

```md
## K-03 螭首的工程功能
- topic: 螭首排水功能
- content: 课程知识正文
- tags: 螭首, 排水, 工程, 坡度
- source: 故宫博物院古建研究
- roles: 数龙官, 测坡官
- revealTiming: after_task1
```

字段名使用英文小写，区分大小写：`topic`、`content`、`tags`、`source`、`roles`、`revealTiming`。

`roles` 使用角色显示名，不使用 role slug。可用 `全角色共享` 或 `全部角色`。

当前支持的揭示写法：

- `always_available` 或包含 `always`；
- `after_task1`、`after_task2`、`after_task3`；
- `phase2`、`phase3`、`phase4` 等；
- 真相官历史兼容规则 `phase2_truth_seeker_task2`。

知识 ID 必须在整门课程内唯一。检索主要依据 topic、title 和 tags，因此标签要覆盖学生可能使用的说法。

### 11.2 本课知识范围

| 文件 | ID | 主要角色/主题 |
|---|---|---|
| `knowledge/chishou.md` | K-01～K-04 | 数龙官、螭首功能与文化 |
| `knowledge/slope-design.md` | K-05～K-07 | 测坡官、坡度与流向 |
| `knowledge/drainage-ditches.md` | K-08～K-10 | 寻沟官、明暗沟和分级网络 |
| `knowledge/inner-river.md` | K-11～K-13 | 引河官、内金水河 |
| `knowledge/moat-system.md` | K-14～K-16 | 护城官、护城河蓄排 |
| `knowledge/overall-system.md` | K-17～K-19 | 全景、因势利导、系统边界 |

精确数值可以保留在服务端知识正文，但必须同时在 `restrictions.md` 中建立保护项和解除条件。

## 12. `guidance/*.md`

每个角色一个同 slug 文件，并按任务序号分段：

```md
# 数龙官 · 引导规则

## 任务1：观其形

### 引导目标
帮助学生从无目的观看转为带着问题观察。

### 引导策略
- 先问：“你能看到螭首和台基怎样连接吗？”
- 学生只拍局部时，提醒补一张环境全景。

### 绝对禁止
- 不提前透露螭首总数。
```

当前编译器按第 N 个任务段绑定，标题文字不会参与自动校验。任务顺序调整后要人工核对。

运行时目前会从当前任务 guidance 中抽取简短引导，完整规则尚未逐条编译进每轮 Prompt。关键防剧透仍应写入 `restrictions.md`。

## 13. `scaffolds/*.md`

推荐结构：

```md
## 任务1：观其形

| 等级 | AI回应 |
|---|---|
| L0 | 肯定具体观察，不增加提示。 |
| L1 | “先看看嘴部和台基边缘有什么连接。” |
| L2 | 提供两个观察点：出水口、台基边缘。 |
| L3 | 展示一张与答案无关的观察方法示例。 |
| L4 | 打开半成品记录模板，由学生完成关键判断。 |
```

当前自动提示主要读取 L1–L3 表格行。L0 和 L4仍应保留，供后续运行时和教师调节使用。

脚手架不能突破 restrictions 的揭示时机。L4也只帮助完成当前操作，不直接给出受保护答案。

## 14. `restrictions.md`

### 14.1 可执行表格

```md
| 限制项 | 不可透露的内容 | 保护原因 | 解除条件 |
|---|---|---|---|
| 螭首总数 | 1142这个精确数字 | 数龙官需要自行估算 | 数龙官完成任务2后 |
| 完整水系图 | 五级排水的完整路径 | 小组需要自行拼合 | Phase 4 开始后 |
```

表格必须恰好四列。当前解除条件支持：

- `角色显示名完成任务N后`；
- `Phase N 开始后` 或其他包含 `Phase N` 的表达；
- `模拟运行后`，对应运行事件 `xuanji-simulation:completed`。

角色任务解除先按角色显示名和“任务N”的序号定位第 N 个任务，再检查完成记录 `{roleId}:{taskId}`。本课继续使用 `task-1`～`task-3`，以保持旧会话、工具实例和跨文件引用稳定。

跨角色隔离、叙事限制和安全限制的普通列表可供课程审查使用；当前结构化防剧透主要读取四列表格。

## 15. `evaluation.md` 与 `objectives.md`

### 15.1 `objectives.md`

本课使用 K、S、C 三类课程目标。角色任务通过 `目标关联` 保存对应编号。

```md
## 知识领域（K）
- K3 螭首功能与礼制象征：理解工程与文化双重意义

## 学科能力（S）
- S4 史料实证（历史）：区分一手证据、二手资料与推测

## 核心能力（C）
- C1 证据意识：用采集证据支撑结论并标明等级
```

每条使用 `- 编号 名称：说明`。同一编号只定义一次，角色任务中的 `目标关联` 使用同一编号。

当前状态：文件供课程设计、教研复核和人工报告使用，解析器尚未把目标定义转为运行时对象。

### 15.2 `evaluation.md`

推荐继续维护：

```md
| 目标 | 评估方式 | 证据来源 | 5分标准 |
|---|---|---|---|
| K3 螭首功能 | 任务证据与解释 | 照片 + 表单 | 能用证据说明结构和作用 |
```

当前状态：服务端会在结构化 `ai_evaluation` 中携带 `evaluation.md` 原文与 Step 的评估引用，返回 `passed/retry`。本课当前任务仍以兼容引导步骤为主，尚未逐角色配置对应 AI 验收小步。

客观题答案、数值容差、builder 映射和 scanner 预期结果由课程团队写入已登记的私有 `工具参数`，平台内置 validator 会执行基础校验。开放成果可以通过 `ai_evaluation` 获得 B5 通过/重试和图像语义反馈；教师终审、分维度分数和复杂组合条件仍需专项验收。

## 16. `time-bank.md`

### 16.1 设置语法

设置行不加列表符号：

```md
## 基本设置

enabled: true
initial_balance: 0min
currency_unit: 分钟

## 赚取规则

max_earn_total: 15min
max_earn_per_task: 3min
tasks_visible_at_once: 3

## 分配规则

allow_gift_to_self: false
max_gift_per_action: 5min
min_gift_amount: 1min
gift_target: same_group_only
```

### 16.2 任务语法

任务 ID 必须符合 `tb-数字`，字段使用缩进：

```md
- id: tb-01
  type: quiz
  question: "题目"
  options: [选项A, 选项B, 选项C]
  answer: 选项B
  reward: 2min
  unlock_after: phase2-start
  hint: "提示"
```

开放题：

```md
- id: tb-10
  type: quiz
  question: "写出你的判断和依据。"
  answer_type: open_ended
  min_length: 20
  reward: 3min
  unlock_after: phase3-start
```

照片打卡与定位签到：

```md
- id: tb-05
  type: photo_checkpoint
  description: "找到一处指定展项并拍照"
  hint: "遵守场馆拍摄规定"
  verify: image_and_text
  reward: 3min
  unlock_after: phase2-start

- id: tb-08
  type: location_checkin
  description: "到达课程集合区域"
  location: [116.4003, 39.9203]
  radius: 20m
  reward: 2min
  unlock_after: phase2-start
```

当前选择题和开放题可校验。`photo_checkpoint` 会调起相机或图片选择、上传证据；`verify: image_and_text` 还会要求至少 4 个字的补充说明。`verify: image_recognition` 当前只校验照片已上传，尚未判断照片中是否确有课程指定目标物。

`location_checkin` 会请求设备 GPS，并按 `location: [经度, 纬度]`、`radius: 20m` 做距离校验；服务端会把设备定位精度计入容差，上限为 100 米。当前没有停留时长校验，课程团队应结合场馆定位误差设置合理半径，并保留教师现场确认方案。

`answer` 保留在服务端课程包，生成浏览器公开包时会删除。

## 17. `assets/` 与素材清单

### 17.1 必须存在的课程级素材

| 字段 | 当前路径 |
|---|---|
| 课程封面 | `assets/backgrounds/cover.png` |
| 对话背景 | `assets/backgrounds/chat-bg.png` |
| 阶段转场 | `assets/backgrounds/phase-transition.png` |
| 完课证书 | `assets/backgrounds/certificate-bg.png` |
| 导航地图 | `assets/maps/navigation-map.png` |
| 导入占位 | `assets/videos/video-storm-coming.png` |
| 推演占位 | `assets/videos/video-simulation.png` |

### 17.2 角色素材

每个角色必须独立提交：

- `assets/roles/role-card-{roleId}.png`；
- `assets/roles/badge-{roleId}.png`；
- `assets/tokens/{collection-file}.png`。

任务图可选。缺少任务图时，学生端回退到该角色的角色卡图。

### 17.3 素材状态

`assets-checklist.md` 是课程团队的制作与授权台账，不参与解析。文件真实存在只表示路径可加载，仍需查看清单中的“正式/占位/待提交”状态。

替换素材时保持文件名和路径不变，可以避免修改 Markdown。展馆、历史图片和地图应记录来源、授权范围和修改说明。

## 18. 公开字段与服务端私有字段

### 18.1 会进入浏览器

- 课程标题、简介、场地、时长、学段和主题；
- Phase 的学生可见字段；
- 角色名称、选择说明、地点和素材；
- 任务名称、配置、通过条件、Step 行动和证据要求；
- A01–A07 的公开工具配置；
- 时间银行题干、选项、提示和奖励；
- 课程素材文件。

### 18.2 保留在服务端

- `knowledge/*.md` 正文和来源；
- `guidance/*.md`、`scaffolds/*.md`、`prompts/*.md`；
- `restrictions.md`、`evaluation.md`；
- 时间银行答案和验证字段；
- 角色关键数据和内部引导方向。

### 18.3 禁止写入公开配置

- API Key、账号、学生隐私数据；
- 正确答案、评分阈值、扫码预期值；
- 未解锁的精确数据和标准路线；
- 模型 System Prompt 或教师内部处理说明。

同步脚本会根据 `restrictions.md` 对公开字段做关键词脱敏。课程团队仍需人工检查生成文件，防止同义表达或新工具参数造成遗漏。

## 19. 同步、重启与预览

从本课程目录进入学生端工程：

```bash
cd ../../4-stu-learning
```

### 19.1 修改素材后

```bash
npm run sync:lessons
```

然后浏览器强制刷新。同步命令会重新复制 `assets/`，并覆盖 `4-stu-learning/public/lessons/lesson_gewu_001/`。

### 19.2 修改 Markdown 后

开发服务运行中时，先停止旧进程，再启动：

```bash
npm run dev
```

`predev` 会自动同步课程。Node 服务会缓存已经编译的课程，单独修改 `6-lessons` 不会触发当前 API 进程自动重编译，因此 Markdown 修改后需要重启 API 或整个 `npm run dev`。

### 19.3 预览本课

```text
http://127.0.0.1:5173/?lesson=lesson_gewu_001&teacherStart=1
```

`teacherStart=1` 只用于本地模拟教师已开放角色领取。

### 19.4 验证

```bash
npm test
npm run build
```

还应人工测试六个角色各自的入场、到达、三个任务、证据不足、重复提交、求助和密符获得流程。

## 20. 上线前检查清单

### 课程与阶段

- [ ] 目录名保持 `lesson_gewu_001`，`主题模板` 为 `gewu`。
- [ ] `任务阶段：phase-2` 在 `phases.md` 中存在。
- [ ] Phase 1–6 各有唯一编号和对应 prompt 文件。
- [ ] 阶段时长、场地、触发条件和教师流程已由实施团队确认。

### 角色与任务

- [ ] 六个 role slug 与 guidance、scaffolds 文件一一对应。
- [ ] 知识条目的 `roles` 使用最新角色显示名。
- [ ] 每个角色的任务 ID 保持 `task-1`、`task-2`、`task-3`。
- [ ] 新改任务已经使用结构化 Step，并显式配置 Step ID、位置、完成方式和通过后。
- [ ] 每个小步只要求一个主要行动。
- [ ] 每个现场任务有位置模式；无需位置时明确写 `none`。

### 工具与证据

- [ ] 工具均来自 A01–A07 注册表。
- [ ] 多工具 `工具参数` 使用 photo、audio、text、sketch、quiz、builder、simulation、team、media、scanner 作为一级键。
- [ ] 拍照任务显式填写 `photo.minCount`。
- [ ] 答案和内部验证值只使用第 9.4 节已登记的私有键，公开键中没有受保护内容。
- [ ] `ai_evaluation`、`teacher_confirm`、位置和组合条件已做专项真实验收。

### 知识、限制和评估

- [ ] K-01～K-19 无重复 ID，topic、tags、source、roles、revealTiming 完整。
- [ ] 所有精确受保护数据都出现在 restrictions 四列表格中。
- [ ] restrictions 中的角色名和任务序号与角色文件一致。
- [ ] guidance 和 scaffolds 的任务顺序与 roles 一致。
- [ ] 自动评分任务已有服务端 validator；没有把 `evaluation.md` 当作已自动执行。

### 素材与公开安全

- [ ] 课程级视觉素材全部可加载。
- [ ] 六套角色卡、徽章和密符图与角色配置一致。
- [ ] `assets-checklist.md` 中所有正式上线项已从占位改为完成。
- [ ] 素材来源、版权、现场拍摄和未成年人隐私要求已经核对。
- [ ] 生成的 `src/generated/lesson-public.js` 中没有答案、密钥、受保护值和内部提示。

### 技术验证

- [ ] 已执行 `npm run sync:lessons`。
- [ ] Markdown 更新后已重启 API。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] 六个角色至少各完成一轮移动端端到端测试。
