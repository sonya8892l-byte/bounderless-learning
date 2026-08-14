# 《得意之笔·四渡赤水》课程配置手册

> 课程目录 ID：`lesson_zhuhun_001`  
> 主题模板：`zhuhun`  
> 课程源目录：`6-lessons/lesson_zhuhun_001/`  
> 通用提交规范：[COURSE-SUBMISSION-SPEC.md](../COURSE-SUBMISSION-SPEC.md)  
> 对话与小步协议：[dialogue-runtime-protocol.md](../../4-stu-learning/docs/dialogue-runtime-protocol.md)

这份 README 面向课程设计、党史教研、素材、实施和技术验收团队，说明本课程全套文件怎样配置、怎样形成五个角色的独立智能体体验，以及怎样在同一套平台底座上调用 A01–A07 通用工具。

课程内容只维护在本目录。`4-stu-learning/src/generated/` 和 `4-stu-learning/public/lessons/` 是同步产物，重新同步时会被覆盖。

## 1. 平台提供与课程团队提交

### 1.1 平台统一提供

- 学生端小程序式页面壳、角色选择页、任务对话、小组页和时间银行；
- 统一 AI 学习同伴“絮絮”的名称、基础形象和平台动画；
- 意图理解、历史对话、待回答问题、打断恢复、主动提醒和流式输出；
- A01–A07 活动工具注册表、统一工具调度和结果回传；
- 高德地图、位置上下文、导航入口和到达状态基座；
- 教师求助、教师通知、暂停、恢复、证据复核和安全升级；
- 课程编译、公开字段裁剪、防剧透关键词脱敏和素材同步；
- 会话、任务进度、时间银行和教师指令的运行状态。

### 1.2 本课程团队提交

- 课程主题、核心问题、史料范围、适用学段、场地和时长；
- 地图参谋、情报参谋、决策参谋、示形参谋、通讯兵五个角色；
- 六个课程 Phase 的内容、时长、场地、模式和阶段行为；
- 每个角色的 `task-1`～`task-3`，以及总计 46 个结构化 Step；
- 每个 Step 的学生行动、位置、工具、公开参数、证据要求和通过后；
- 党史知识、资料来源、角色权限、揭示时机和史料边界；
- 任务 guidance、L0–L4 scaffolds、防剧透 restrictions、evaluation 和 objectives；
- 时间银行题目、答案、奖励、解锁阶段；
- 课程封面、背景、角色卡、徽章、五层战图、任务底图、视频占位和场馆授权信息。

### 1.3 课程团队不要配置

- 絮絮的名字、平台头像、基础动画和平台安全规则；
- 模型密钥、地图密钥、接口域名、上传存储和教师权限；
- `open_task_tool`、`show_navigation`、`retrieve_course_knowledge`、`call_teacher` 等智能体内部工具；
- 真实冲突、跟踪、规避监管或伤害行为的现实行动方案。

本课程只配置教学活动和历史推演内容。历史战术工具限定在课程情境中使用。

## 2. 当前运行时接入状态

| 内容 | 当前状态 | 本课配置要求 |
|---|---|---|
| 课程、阶段、角色 | 已解析 | 可直接维护 Markdown |
| A01–A07 工具注册表 | 已接入解析器、十种前端 renderer 和服务端基础 validator | Step 使用标准模块和 JSON 参数 |
| 结构化 Step | 已解析 | 本课 15 个角色阶段全部按结构化 Step 配置 |
| Step 工具合并 | 已接入编译器 | 当前按角色阶段合并工具并去重 |
| Step 级工具验收 | 已接入基础校验 | 每个 Step 仍需做成功、失败、重试和恢复回归 |
| 课程知识检索 | 已接入服务端 | 必须配置角色名、来源和 revealWhen |
| 防剧透输出检查 | 已接入 | restrictions 四列表格必须覆盖关键路线和结论 |
| 任务与 Step 就地引导 | 已从 `roles/*.md` 装配 | `##### 引导`按 Step 优先、任务兜底 |
| 任务与 Step 就地脚手架 | 已从 `roles/*.md` 装配 | `##### 脚手架`使用 L0–L4 |
| phase prompts | 已按 Phase 结构化装配 | 支持章节完整装配，不做字符截断；模板类章节单独记录，不在普通回合反复注入 |
| evaluation | 已进入 `ai_evaluation` 验收上下文 | 模型结合 B5 原文、Step 要求、当前 Step 限制、课程知识和工具结果返回通过/重试 |
| objectives | 课程资料已保留 | 尚未进入运行时解析 |
| `知识引用` | 已接入 | 按 `K-NN` 定向检索，并继续受角色和 `revealWhen` 约束 |
| `限制引用` | 已接入精确定位 | `course.md#课程限制规则/标题` 解析到同名表格行或二、三级标题；当前 Step 的最小限制片段进入对话和 AI 验收 |
| `知识引用`、`限制引用` | 已接入 | 知识按 ID 定向检索；限制按 `course.md#课程限制规则/标题` 精确解析 |
| `ai_evaluation`、`teacher_confirm`、`location_event`、`compound` | 已进入服务端状态机 | 本课图片、实物识别、画板与开放表达使用 AI 通过/重试；其他模式仍需逐任务端到端验收 |
| 时间银行选择题、开放题、照片打卡、定位签到、余额、赠时 | 已接入 | 照片已接相机选择与上传；定位已接设备 GPS 和半径校验；目标物视觉识别、停留时长仍需补充 |

工具 UI、工具结果和服务端 validator 应按上线版本再次核对。本文件明确区分配置已解析与教学验收已执行。

## 3. 完整目录与逐文件作用

```text
lesson_zhuhun_001/
├── README.md                     # 本手册
├── course.md                     # 课程身份、角色、视觉，以及目标体系、阶段编排、限制规则
├── evaluation.md                 # B5 评估表；供 ai_evaluation 结构化通过/重试
├── time-bank.md                  # 时间银行规则、题目、答案和奖励
├── assets-checklist.md           # 素材状态、来源、授权和占位说明
├── roles/
│   ├── map-strategist.md         # 地图参谋：地形层
│   ├── intelligence-strategist.md # 情报参谋：情报层
│   ├── decision-strategist.md    # 决策参谋：决策层
│   ├── feint-strategist.md       # 示形参谋：行动层
│   └── signaler.md               # 通讯兵：视角层
├── knowledge/
│   ├── context-and-timeline.md   # 时间线与历史语境
│   ├── crossings.md              # 四次渡河与路线证据
│   ├── terrain.md                # 川黔滇地形、水系和交通
│   ├── intelligence.md           # 情报、不确定性和信息边界
│   ├── decision-and-governance.md # 决策比较、授权和组织
│   └── perspectives-and-evidence.md # 多视角、基层记录和证据表达
├── prompts/                      # 文件名中的数字绑定 Phase
│   ├── phase1-briefing.md        # Phase 1 局势入场
│   ├── phase2-evidence.md        # Phase 2 展陈采证
│   ├── phase3-deduction.md       # Phase 3 四渡推演
│   ├── phase4-xuanji.md          # Phase 4 璇玑时刻
│   ├── phase5-summary.md         # Phase 5 得意何在
│   └── phase6-ending.md          # Phase 6 归档与尾声
└── assets/
    ├── backgrounds/              # 封面、聊天、转场和证书
    ├── logos/                    # 场馆标识及授权素材
    ├── maps/                     # 场馆导航图
    ├── roles/                    # 五套角色卡与徽章
    ├── tasks/                    # 六张课程任务图与推演材料
    ├── tokens/                   # 五层战图图层
    └── videos/                   # 开场和推演媒体占位
```

上面的树列出全部 Markdown 配置文件；二进制素材逐项见第 17 节和 `assets-checklist.md`。任务引导、脚手架与验收标准直接写在同一个 `roles/*.md` 任务或 Step 中。

## 4. ID、文件名与绑定规则

### 4.1 ID 总表

| 对象 | 本课格式 | 绑定位置 |
|---|---|---|
| 课程 ID | `lesson_zhuhun_001` | 目录名、URL、会话课程 ID |
| 主题 | `zhuhun` | `course.md / 主题模板` |
| Phase ID | `phase-1`～`phase-6` | 由 `Phase N` 标题生成 |
| 角色 ID | 五个英文 slug | `roles/{slug}.md` 文件名 |
| 角色阶段 ID | 每个角色固定 `task-1`～`task-3` | 完成记录、限制解除、工具实例 |
| Step ID | 语义化 kebab-case | 当前课程共 46 个稳定 ID |
| 知识 ID | `K-01`～`K-21` | 服务端检索与当前 Step 的 `知识引用` |
| 目标/量规 ID | `K1`～`K6`、`S1`～`S6`、`C1`～`C6` | objectives、evaluation、角色 `目标关联` |
| 时间银行 ID | `tb-01`～`tb-10` | 时间银行完成记录 |
| 工具实例 ID | `{roleId}:{taskId}:primary` | 编译器自动生成 |

知识 ID 带连字符和两位数字，例如 `K-10`；目标 ID 不带连字符，例如 `K1`。两套编号用途不同，不能互换。

### 4.2 角色文件绑定

```text
roles/map-strategist.md
knowledge 条目中的 roles: 地图参谋
course.md / ## 课程限制规则 中的“地图参谋完成任务N后”
```

角色文件名 slug 变更会产生新的角色 ID，并使旧会话、知识角色过滤和限制解除失去关联。任务级引导、脚手架与验收标准跟随角色任务本身，不存在跨目录序号绑定。

### 4.3 任务序号绑定

当前 restrictions 从“角色显示名完成任务N后”中读取角色和序号，再定位该角色的第 N 个任务，检查完成记录 `{roleId}:{taskId}`。因此：

- 角色阶段显式填写 `id：task-1`、`id：task-2`、`id：task-3`；
- 任务级 `##### 引导`、`##### 脚手架` 与验收标准保留在对应任务内；
- 调整角色任务顺序时同步修改 restrictions；
- Step 使用语义 ID，不占用 `task-N`。

### 4.4 Phase 绑定

```text
course.md / ## 阶段编排                     ## Phase 3：四渡推演
运行时                         phase-3
prompts/phase3-deduction.md   阶段提示词
time-bank.md                  unlock_after: phase-3-start
```

`course.md / 任务阶段` 当前为 `phase-2`，表示角色选择确认后进入展陈采证。

## 5. `course.md` 配置

### 5.1 基本信息

```md
# 得意之笔·四渡赤水

> 在中国共产党历史展览馆，用证据完成一场战略推演

## 基本信息
- 系列：铸魂
- 系列代码：zhuhun
- 主题模板：zhuhun
- 场地：中国共产党历史展览馆
- 时长：5.5小时（含参观、午休与集合）
- 适用年级：小学中高年级 / 初中 / 高中
- 分组：5人一组，每人一个推演角色
```

学生端会读取系列、主题、场地、坐标中心、时长、学段和分组。`坐标中心` 同时作为教师端场次地图的初始中心。未被解析的 `编号`、`最大并行组数` 不写入 `course.md`。

### 5.2 平台统一絮絮

课程不提交 `## 智能体人设`。絮絮的名称、基础形象和动画由平台 `PLATFORM_COMPANION` 锁定，性格与语气的默认值在 `_platform/companion.md`；需要调整语气侧面时写 `course.md / ## 人设侧重`。课程教学目标、阶段行为、知识和边界分别写入阶段提示、知识、引导与限制文件。

### 5.3 五角色体系

```md
## 学生端角色体系
- collectionName：推演角色
- itemName：身份
- 选择眉题：{roleCount}种推演身份 · {roleCount}层战图证据
- 选择标题：选择你的推演身份
- 选择说明：每位成员负责一种观察视角。教师核对{roleCount}层{collectionItemName}已汇集后，组织小组共同还原四渡赤水的决策链。
- collectionItemName：战图图层
- collectionPanelName：五层战图
- unlockTarget：璇玑时刻
- 任务阶段：phase-2
```

英文键区分大小写。文案支持 `{roleCount}`、`{collectionName}`、`{itemName}`、`{collectionItemName}`、`{unlockTarget}`。

### 5.4 视觉素材

```md
## 学生端视觉素材
- 课程封面：assets/backgrounds/cover.png
- 对话背景：assets/backgrounds/chat-bg.png
- 阶段转场：assets/backgrounds/phase-transition.png
- 完课证书：assets/backgrounds/certificate-bg.png
- 导航地图：assets/maps/museum-navigation.png
- 导入占位图：assets/videos/video-opening.jpg
- 推演占位图：assets/videos/video-strategy-table.jpg
```

路径统一写为 `assets/...`。课程视觉素材不改变平台絮絮 IP。

## 教研备忘（不参与运行）

以下内容已从 `course.md` 移至本节，仅供课程教研与实施参考，不参与课程编译，也不作为运行时自动聚合、自动转场或自动解锁的承诺。

### 叙事框架

- 开场：学生收到1935年初的局势简报，只知道敌强我弱和原定北渡长江计划。
- 现场：五类角色在展陈中分别采集地形、情报、决策、行动和士兵视角证据。
- 推演：小组依次面对一渡、二渡、三渡、四渡前的有限信息，提交当时可行的行动方案。
- 高潮：教师确认各角色证据已汇集后，组织切换到基层士兵的有限视角，追问“看不见全局的人为何仍能行动”。
- 结局：对照史实复盘，形成带条件的“得意之处”判断并迁移到现实决策。

### 五层战图机制

- 地图参谋完成任务后贡献“地形层”。
- 情报参谋完成任务后贡献“情报层”。
- 决策参谋完成任务后贡献“决策层”。
- 示形参谋完成任务后贡献“行动层”。
- 通讯兵完成任务后贡献“视角层”。
- 各层由教师或活动主持人核对、汇集；人工确认满足阶段条件后进入璇玑时刻。任何单层都不足以解释完整战役。

### 史料边界

- 课程中的日期、路线、会议和战役信息以权威党史资料为依据。
- 学生推演时只获得对应时点已经掌握的信息，避免以后见之明代替当时判断。
- “失散小战士”作为课程情境材料使用，史料出处未核实前必须显示“课程情境材料｜出处待核”。
- AI不得生成历史人物未被可靠史料记录的直接引语、心理活动或私人细节。

### 年级适配

- 小学中高年级：减少专有名词，突出地图、选择与证据卡；不要求记忆完整日期。
- 初中：完整使用时间线、信息矩阵和决策矩阵，要求说明因果关系。
- 高中：增加史料互证、反事实推演和决策机制讨论，要求标注结论边界。

这些说明不会由解析器自动转成限制规则。关键边界需要同步写入：

- `course.md / ## 课程限制规则` 四列表格；
- 对应角色 guidance 的绝对禁止；
- 相关 knowledge 的 content、source 与 revealWhen；
- 阶段 prompt 文件开头。

## 6. `course.md / ## 阶段编排` 与阶段提示词

### 6.1 Phase 语法

```md
## Phase 3：四渡推演
- 时长：60分钟
- 模式：小组协作
- 地点：馆内教育空间或返程后的学习空间
- 功能模块：A03(拼合搭建), A04(兵棋推演), A05(讨论记录)
- 触发条件：Phase 2结束
- 结束条件：完成四轮决策与证据复盘
```

标题必须使用 `## Phase N：名称`。Phase 只保留运行时支持的结构化字段；教研流程写入本 README 的“教研备忘（不参与运行）”，不写进阶段编排。

### 6.2 本课阶段对照

| Phase ID | 名称 | 时长 | 阶段提示词 |
|---|---|---:|---|
| `phase-1` | 局势入场 | 25分钟 | `prompts/phase1-briefing.md` |
| `phase-2` | 展陈采证 | 120分钟 | `prompts/phase2-evidence.md` |
| `phase-3` | 四渡推演 | 60分钟 | `prompts/phase3-deduction.md` |
| `phase-4` | 璇玑时刻 | 30分钟 | `prompts/phase4-xuanji.md` |
| `phase-5` | 得意何在 | 30分钟 | `prompts/phase5-summary.md` |
| `phase-6` | 归档与尾声 | 10分钟 | `prompts/phase6-ending.md` |

prompt 文件必须符合 `prompts/phase数字-名称.md`。运行时只按数字绑定。

阶段提示词按受支持的结构化二级标题完整装配，不做字符截断。每个文件至少写：`## 阶段目标`、絮絮行为类章节、`## 禁止行为`和`## 转场条件`；模板类章节单独记录，不在普通回合反复注入。

## 7. `roles/*.md` 配置

### 7.1 角色基本信息

```md
# 🗺️ 地图参谋

> 核心问题：山脉、河流与渡口怎样改变一支队伍可以选择的路？

## 基本信息
- 排序：1
- 地点：长征路线地图与模型展区
- 地理围栏：中国共产党历史展览馆课程动线内
- 类型：核心角色
- 选择说明：负责读懂川黔滇地形，把河流、渡口、山地和敌我位置整理成可推演的战场底图。
- 角色卡图：assets/roles/role-card-map-strategist.png
- 角色徽章图：assets/roles/badge-map-strategist.png
- 收集物：地形层
- 收集物图：assets/tokens/layer-terrain.png
```

必填字段为 `选择说明`、`角色卡图`、`角色徽章图`、`收集物`、`收集物图`。

本课当前角色 `地理围栏` 是场馆动线文字，没有经纬度，运行时会作为 `point` 地点处理，主要提供导航和手动到达确认。正式启用 GPS 围栏时，需要提交合法坐标、半径、精度要求和停留时间。

### 7.2 角色阶段

```md
### 任务1：定坐标
- id：task-1
- 阶段：Phase 2 展陈采证
- 配置：确认地图展项，采集水系证据，并在底图中标出可确认内容
- 位置模式：inherit_role
- 到达验证：manual
- 最短停留：0分钟
- 建议时长：20分钟
- 无操作提醒：3分钟
- 提醒冷却：2分钟
- 最大主动提醒：2
- 推进方式：auto_after_validation
- 完成方式：compound
- 功能模块：A07(实物识别), A01(拍照采集), A01(画板标注)
- 证据要求：完成展项确认、至少2张来源照片和1张标注图
- 通过条件：三个必做 Step 完成
- 目标关联：K1, S1, S3
- AI引导方向：先确认地图方位与来源，再进行空间判断
```

任务 ID 保持 `task-1`～`task-3`。位置模式支持 `inherit_role`、`none`、`point`、`geofence`、`route`、`area`。

## 8. 结构化 Step 配置

### 8.1 标准模板

```md
#### Step 2：采集水系证据
- id：map-capture-water-system
- 小步目标：获得可复核的地图和水系照片
- 学生行动：拍一张地图全景，再拍一张河流名称或图例局部
- 位置：inherit
- 完成方式：tool_result
- 功能模块：A01(拍照采集)
- 工具参数：{"photo":{"minCount":2,"maxCount":4,"accept":"image/*","recognition":"map-source-and-waterway"}}
- 证据要求：至少2张照片，并保留展项标题或说明牌
- 知识引用：K-10, K-11
- 限制引用：course.md#课程限制规则/核心路线限制
- 常见误区：只拍地图局部，无法确认地图来源和方位
- 最大尝试：3
- 失败处理：提示调整角度并保留“待核”字段
- 教师介入：展项不可拍摄或无法找到指定区域
- 通过后：step:map-annotate-water-system

##### 引导
先确认地图来源与方向，再提取水系证据。

##### 脚手架
| 等级 | AI回应策略 |
|---|---|
| L0 | 肯定已确认的来源，不增加新线索。 |
| L1 | 先找指北针、图例或熟悉的河流名称。 |

##### 验收标准
照片能确认地图来源、方向和水系信息；无法辨认处保留“待核”。
```

### 8.2 配置原则

- 每个 Step 显式填写唯一 `id`；
- 每步只安排一个主要行动；
- 所有 Step 都写 `位置`，现场步骤通常使用 `inherit`；
- 只需结构校验的工具操作写 `tool_result`，需要判断图片、画板或开放表达质量时写 `ai_evaluation`；简单阅读确认可写 `user_confirm`；
- `证据要求` 描述学生可理解的达标条件；
- `通过后` 指向 `step:{nextStepId}`、`role-stage:task-N` 或 `role-stage:complete`；
- 工具参数区分公开交互键与平台支持的私有验证键；
- 史实答案、标准路线、评分阈值和扫码预期值放服务端私有配置。

当前运行时按 Step 数组顺序推进；`通过后：step:<id>`不改变 Step 游标，跨任务边进入任务图。知识引用已用于当前小步检索；限制引用按 `course.md#课程限制规则/标题` 精确解析并进入对话与 AI 验收。引导、脚手架与 Step 验收标准从当前任务单元就地读取；三类旧引用不产生行为。

除知识条目的 `K-NN` 外，引用统一写成 `相对文件路径#标题或量规编号`。保持真实路径和标题一致，便于当前验收上下文和后续精确装配稳定使用。

### 8.3 完成方式状态

| completionMode | 适用场景 | 当前说明 |
|---|---|---|
| `user_confirm` | 阅读、观看、低风险观察 | 已有直接确认流程 |
| `tool_result` | 拍照、录音、表单、画板、扫码 | 通过活动工具结果推进 |
| `ai_evaluation` | 开放表达、图片或示意图评分 | 已调用真实模型并返回结构化通过/重试；未通过停留原 Step，达到最大尝试次数后建议呼叫老师 |
| `teacher_confirm` | 开放成果、集体展示 | 字段已解析，需教师端验收链路测试 |
| `location_event` | GPS、围栏和停留 | 服务端有状态模型，学生端真实 GPS 仍需验收 |
| `compound` | 多个条件组合 | 建议用于角色阶段，组合规则需按任务配置 validator |

## 9. A01–A07 活动工具与 JSON

### 9.1 工具注册表

| 模块 | 课程写法 | 工具 ID | 主要公开配置 |
|---|---|---|---|
| A01 | `A01(拍照采集)` | `photo` | minCount、maxCount、accept、prompt |
| A01 | `A01(语音记录)` | `audio` | minSeconds、maxSeconds、language、transcribe |
| A01 | `A01(文字表单)` | `text` | fields 数组、字段类型、required、placeholder |
| A01 | `A01(画板标注)` | `sketch` | width、height、backgroundImage、brushColors、prompt |
| A02 | `A02(单选/多选/排序/开放题)` | `quiz` | type、question、options、公开反馈 |
| A03 | `A03(拼合/流程/证据墙)` | `builder` | mode、items、zones、connections、prompt |
| A04 | `A04(沙盘推演)` | `simulation` | rounds、resources、choices、metrics、prompt |
| A05 | `A05(讨论/投票/分工)` | `team` | mode、prompt、minimumEntries、roles |
| A06 | `A06(沉浸媒体)` | `media` | type、url、poster、title、requireCompletion |
| A07 | `A07(扫码/实物识别)` | `scanner` | mode、allowManualEntry、prompt |

### 9.2 单工具 JSON

Step 只调用一个工具时可以直接写配置，也可以保留工具 ID 外层。本课统一保留工具 ID 外层，便于审计：

```md
- 功能模块：A01(画板标注)
- 工具参数：{"sketch":{"width":720,"height":520,"backgroundImage":"assets/tasks/terrain-map.svg","brushColors":["#8d211f","#245c4f","#1f2937"],"prompt":"红色实线表示史料可确认，绿色虚线表示推演。"}}
```

### 9.3 多工具 JSON

角色阶段同时声明多工具时，必须使用工具 ID 作为一级键：

```md
- 功能模块：A01(拍照采集), A01(文字表单), A02(开放题)
- 工具参数：{"photo":{"minCount":2},"text":{"fields":[{"id":"source","label":"来源","type":"short_text","required":true}]},"quiz":{"type":"open_response","question":"说明你的判断依据"}}
```

编译器会合并角色阶段和 Step 工具，并按工具 ID 去重。当前仍以一个角色阶段 activity 实例向学生端调度。

### 9.4 私有答案边界

课程源允许在 `工具参数` 中配置服务端校验需要的私有字段。同步脚本和服务端工具编译器当前会删除公开工具配置中的：

```text
answer, answers, expectedResults, correctMapping, validConnections,
explanation, retryMessage, evaluationPrompt,
choices[].score, choices[].correct
```

原始 `toolParameters` 字符串也不会写入浏览器课程包。私有字段仍保留在服务端课程对象，用于 quiz、builder、scanner 等基础 validator。

不要自创未经裁剪器登记的私有字段。新增验证字段时，需要同步更新 `sanitizeTool`、`publicTool` 和防泄漏测试。

本课上线前仍必须检查：

```text
4-stu-learning/src/generated/lesson-public.js
```

文件中不能出现任何任务答案、未解锁路线、内部评分规则和扫码预期值。

## 10. 本课五角色、三任务与 46 个 Step

### 10.1 角色和素材

| 排序 | role ID | 角色 | 图层 | 角色卡 / 徽章 / 图层图 |
|---:|---|---|---|---|
| 1 | `map-strategist` | 地图参谋 | 地形层 | `role-card-map-strategist.png` / `badge-map-strategist.png` / `layer-terrain.png` |
| 2 | `intelligence-strategist` | 情报参谋 | 情报层 | `role-card-intelligence-strategist.png` / `badge-intelligence-strategist.png` / `layer-intelligence.png` |
| 3 | `decision-strategist` | 决策参谋 | 决策层 | `role-card-decision-strategist.png` / `badge-decision-strategist.png` / `layer-decision.png` |
| 4 | `feint-strategist` | 示形参谋 | 行动层 | `role-card-feint-strategist.png` / `badge-feint-strategist.png` / `layer-action.png` |
| 5 | `signaler` | 通讯兵 | 视角层 | `role-card-signaler.png` / `badge-signaler.png` / `layer-perspective.png` |

### 10.2 地图参谋：9 Steps

| task | 任务 | Step ID | 工具 |
|---|---|---|---|
| `task-1` | 定坐标 | `map-locate-exhibit` | scanner |
|  |  | `map-capture-water-system` | photo |
|  |  | `map-annotate-water-system` | sketch |
| `task-2` | 布态势 | `map-place-situation-cards` | builder |
|  |  | `map-mark-evidence-boundary` | sketch |
|  |  | `map-explain-terrain-constraint` | text |
| `task-3` | 拟路线 | `map-draw-candidate-route` | sketch |
|  |  | `map-complete-route-matrix` | text |
|  |  | `map-check-route-evidence` | quiz |

任务底图：`assets/tasks/terrain-map.svg`。

### 10.3 情报参谋：9 Steps

| task | 任务 | Step ID | 工具 |
|---|---|---|---|
| `task-1` | 读电文 | `intel-capture-message` | photo |
|  |  | `intel-confirm-fields` | text |
|  |  | `intel-mark-source-boundary` | quiz |
| `task-2` | 划盲区 | `intel-sort-information` | builder |
|  |  | `intel-rate-reliability` | text |
|  |  | `intel-correct-overclaim` | quiz |
| `task-3` | 测判断 | `intel-select-signal` | quiz |
|  |  | `intel-run-branches` | simulation |
|  |  | `intel-record-window-risk` | text |

任务底图：`assets/tasks/intelligence-matrix.svg`。

### 10.4 决策参谋：9 Steps

| task | 任务 | Step ID | 工具 |
|---|---|---|---|
| `task-1` | 列方案 | `decision-capture-source` | photo |
|  |  | `decision-build-options` | text |
|  |  | `decision-balance-reasons` | quiz |
| `task-2` | 比风险 | `decision-score-options` | text |
|  |  | `decision-test-failure` | simulation |
|  |  | `decision-record-team-decision` | team |
| `task-3` | 复决策 | `decision-read-new-evidence` | media |
|  |  | `decision-compare-version` | builder |
|  |  | `decision-write-revision` | text |

任务材料：任务1–2使用 `assets/tasks/decision-matrix.svg`，任务3使用 `assets/tasks/decision-review-card.svg`。

### 10.5 示形参谋：9 Steps

| task | 任务 | Step ID | 工具 |
|---|---|---|---|
| `task-1` | 排行动 | `feint-capture-deployment` | photo |
|  |  | `feint-order-actions` | quiz |
|  |  | `feint-source-action-cards` | text |
| `task-2` | 辨虚实 | `feint-build-signal-chain` | builder |
|  |  | `feint-add-alternative` | text |
|  |  | `feint-check-evidence` | quiz |
| `task-3` | 演反应 | `feint-run-reactions` | simulation |
|  |  | `feint-discuss-fallback` | team |
|  |  | `feint-record-robustness` | text |

任务底图：`assets/tasks/feint-route.svg`。

### 10.6 通讯兵：10 Steps

| task | 任务 | Step ID | 工具 |
|---|---|---|---|
| `task-1` | 收残讯 | `signal-capture-evidence` | photo |
|  |  | `signal-sort-known-unknown` | builder |
|  |  | `signal-mark-evidence-boundary` | quiz |
| `task-2` | 译行动 | `signal-read-command` | media |
|  |  | `signal-extract-command` | text |
|  |  | `signal-retell-command` | audio |
|  |  | `signal-compare-retelling` | team |
| `task-3` | 写边界 | `signal-write-draft` | text |
|  |  | `signal-label-sentences` | builder |
|  |  | `signal-check-boundary` | quiz |

任务底图：`assets/tasks/limited-message.svg`。

五个角色合计覆盖 photo、audio、text、sketch、quiz、builder、simulation、team、media、scanner 十种工具。课程验收需要覆盖所有十种 renderer 和结果回传。

## 11. `knowledge/*.md`

### 11.1 条目语法

```md
## K-14 信息不对称四象限
- topic: 信息盲区矩阵
- content: 课程知识正文
- tags: 我方已知, 敌方已知, 双方未知, 误判, 四象限
- source: 课程方法工具《鲁班锁·情报盲区图》
- roles: 情报参谋, 示形参谋
- revealWhen: always
```

字段名使用英文小写且区分大小写：`topic`、`content`、`tags`、`source`、`roles`、`revealWhen`。

`roles` 写角色显示名，可使用逗号分隔，也可写 `全角色共享`。揭示时机当前支持：

- 包含 `always` 的公开条目；
- `after_task1`、`after_task2`、`after_task3`；
- `phase2`、`phase3`、`phase4`、`phase5` 等。

### 11.2 本课知识范围

| 文件 | ID | 内容 |
|---|---|---|
| `context-and-timeline.md` | K-01～K-04 | 时空坐标、兵力概括、初始计划、连续调整 |
| `crossings.md` | K-05～K-09 | 四次渡河和后续脱困行动链 |
| `terrain.md` | K-10～K-12 | 地形约束、地图读取、路线与目标 |
| `intelligence.md` | K-13～K-15 | 情报质量、信息盲区、示形条件 |
| `decision-and-governance.md` | K-16～K-18 | 遵义会议、苟坝会议、指挥机制 |
| `perspectives-and-evidence.md` | K-19～K-21 | 双视角、失散小战士边界、证据等级 |

党史条目必须写明可核验来源。来源存在差异时，在 content 中说明资料边界，不将单一二手表述写成唯一结论。

知识检索先按当前角色和 `revealWhen` 过滤可见条目，再用 title、topic、tags 与当前问题计算相关度。Step 的 `知识引用` 会为对应 ID 增加优先级，但不会绕过角色或揭示时机。学生可能使用的简称、地名和同义表达应进入 tags。

## 12. 任务与 Step 的就地引导

本课把任务专属教学策略直接写在对应任务或 Step 的 `##### 引导`中。Step 级内容优先于任务级内容；都缺失时只使用任务行动、证据要求和平台通用规则。必须执行的泄题边界仍写入 `course.md / ## 课程限制规则`，场馆安全规则同时写入阶段 Prompt 和教师实施方案。

## 13. 任务与 Step 的就地脚手架

本课把 L0–L4 具体话术写在对应任务或 Step 的 `##### 脚手架`表格中。运行时按当前 Step 与求助类型取档，缺档时向下取最近档；进入新 Step 后重新校准。L4只能提供可编辑框架，不能透露未解锁路线、会议结果、历史人物心理或未核实情境。

## 14. `course.md / ## 课程限制规则`

### 14.1 可执行限制表

```md
| 限制项 | 不可透露的内容 | 保护原因 | 解除条件 |
|---|---|---|---|
| 一渡完整方案 | 受保护路线正文 | 地图参谋需先推演 | 地图参谋完成任务2后 |
| 后续脱困路径 | 受保护行动链 | 小组需先完成推演 | Phase 5开始后 |
```

表格必须恰好四列。当前解除条件支持：

- `角色显示名完成任务N后`；
- 包含 `Phase N` 的阶段条件；
- `模拟运行后`。

本课限制依赖：

- 地图参谋 `task-2`、`task-3`；
- 示形参谋 `task-2`、`task-3`；
- 决策参谋 `task-2`；
- Phase 4、Phase 5。

因此各角色阶段 ID 必须保持 `task-1`～`task-3`。

### 14.2 必须同时维护的边界

- 不生成历史人物未经可靠史料记载的直接引语；
- 不虚构心理活动、私人对话、伤亡数字和战场细节；
- “约3万人对约40万人”必须保留“约”和统计边界；
- 学生方案、课程卡片和 AI 推断不能标成史实；
- “失散小战士”必须标记“课程情境材料｜史料出处待核”；
- 战术推演不能转为现实冲突建议；
- 出现走失、身体不适或危险时停止课程并呼叫老师。

四列表格继续用于声明可按阶段解锁的受保护结论。具名 `##` / `###` 列表章节可以由 Step 使用 `course.md#课程限制规则/标题` 精确引用，引用后其最小章节正文会进入当前对话和 AI 验收；没有被引用的列表不会自动进入每轮 Prompt。平台安全和全课程强制边界仍应放在平台规则、对应 phase prompt 或 guidance 中，避免只依赖某个 Step。

## 15. `evaluation.md` 与 `course.md / ## 课程目标体系`

### 15.1 `course.md / ## 课程目标体系`

本课角色任务使用 `目标关联` 记录 K/S/C 编号。`course.md / ## 课程目标体系` 是课程目标的权威说明。

```md
## 知识领域（K）
- K1 时间与空间：建立课程所需的基本时空坐标

## 学科能力（S）
- S3 史料实证（历史）：区分展陈、研究、课程材料和推测

## 核心能力（C）
- C3 证据边界：清楚标记史实、合理推断、未知和情境

## 年级适配
- 小学中高年级：减少专有名词，突出地图、选择与证据卡
```

目标条目使用 `- 编号 名称：说明`，编号在文件内唯一。年级适配可供教研和 Prompt 设计参考，当前不会自动切换工具或评分规则。

当前状态：文件尚未被解析为运行时对象，不能仅靠目标编号触发工具、知识或评分。

### 15.2 `evaluation.md`

推荐维护四类信息：

```md
| 目标 | 评估方式 | 证据来源 | 5分标准 |
|---|---|---|---|
| S1 地图判读 | 标注图与说明 | sketch + text | 方位、图例、来源和边界完整 |
```

当前状态：服务端在 `ai_evaluation` 时携带 B5 课程级原文、Step 就地验收标准、精确解析的限制、证据要求、课程知识和工具结果，返回结构化 `passed/retry`。达到最大尝试次数会建议教师介入；需要强制人工确认的 Step 使用`完成方式：teacher_confirm`与`教师介入：必须`。

课程团队可以直接通过已登记的私有 `工具参数` 配置：客观题答案、数值容差、builder 正确映射、scanner 预期结果和工具基础完成条件。平台内置 validator 会执行这些规则。

以下能力仍需要平台工程接入或专项验收：

- B5 分维度分数、教师终审和正式审核队列；
- 开放式 builder 作品的视觉连线与语义判断；
- 真实小组成员参与和跨设备同步；
- 教师确认、持续停留位置事件和复杂复合条件。

## 16. `time-bank.md`

### 16.1 设置

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

设置字段不加列表符号。

### 16.2 任务

```md
- id: tb-02
  type: quiz
  question: "四渡赤水主要发生在哪三省交界区域？"
  options: [川黔滇, 湘鄂赣, 陕甘宁]
  answer: 川黔滇
  reward: 2min
  unlock_after: phase-2-start
```

开放题：

```md
- id: tb-10
  type: quiz
  question: "新证据出现后，你的小组改变过哪一个判断？为什么？"
  answer_type: open_ended
  min_length: 30
  reward: 3min
  unlock_after: phase-3-start
```

照片打卡与定位签到：

```md
- id: tb-06
  type: photo_checkpoint
  description: "找到一项带日期的展项，拍照并记录标题"
  hint: "照片之外再补一句说明"
  verify: image_and_text
  reward: 2min
  unlock_after: phase-2-start

- id: tb-08
  type: location_checkin
  description: "到达课程集合区域"
  location: [116.3953, 40.0071]
  radius: 300m
  reward: 1min
  unlock_after: phase-2-start
```

任务 ID 必须为 `tb-数字`。`options` 使用半角逗号分隔。当前选择题、开放题、奖励、总上限和赠时可运行。

`photo_checkpoint` 会调起相机或图片选择并上传证据；`verify: image_and_text` 还要求学生补充至少 4 个字。`verify: image_recognition` 当前只校验照片已上传，尚未判断画面是否包含指定展项。

`location_checkin` 会读取设备 GPS，并按 `location: [经度, 纬度]` 与 `radius: 300m` 校验距离；服务端会把设备定位精度计入容差，上限为 100 米。当前没有停留时长校验，场馆内测试时需核对坐标系、设备授权和实际漂移，并准备教师确认方案。

时间银行 `answer` 会在生成公开课程包时删除。

## 17. `assets/` 与素材台账

### 17.1 课程级素材

| 用途 | 路径 | 当前台账状态 |
|---|---|---|
| 课程封面 | `assets/backgrounds/cover.png` | 已复用参考素材 |
| 对话背景 | `assets/backgrounds/chat-bg.png` | 占位，需正式制作 |
| 阶段转场 | `assets/backgrounds/phase-transition.png` | 占位 |
| 完课证书 | `assets/backgrounds/certificate-bg.png` | 占位 |
| 场馆导航图 | `assets/maps/museum-navigation.png` | 占位，需核对动线与版权 |
| 开场媒体 | `assets/videos/video-opening.jpg` | 图片占位 |
| 推演媒体 | `assets/videos/video-strategy-table.jpg` | 图片占位 |

### 17.2 五层战图与任务底图

| 图层/底图 | 路径 |
|---|---|
| 地形层 | `assets/tokens/layer-terrain.png` |
| 情报层 | `assets/tokens/layer-intelligence.png` |
| 决策层 | `assets/tokens/layer-decision.png` |
| 行动层 | `assets/tokens/layer-action.png` |
| 视角层 | `assets/tokens/layer-perspective.png` |
| 地图任务底图 | `assets/tasks/terrain-map.svg` |
| 情报矩阵 | `assets/tasks/intelligence-matrix.svg` |
| 决策矩阵 | `assets/tasks/decision-matrix.svg` |
| 决策复核情境卡 | `assets/tasks/decision-review-card.svg` |
| 示形路线 | `assets/tasks/feint-route.svg` |
| 通讯命令 | `assets/tasks/limited-message.svg` |

文件存在只代表路径可加载。正式状态以 `assets-checklist.md` 为准。

### 17.3 授权与史料标识

- 展馆照片、展项、地图、电文影印件需要记录来源和展示权限；
- 历史人物照片不得经过改变事实含义的生成式编辑；
- 课程情境图标注“情境复原”或“课程插图”；
- 未核实的“失散小战士”材料不得配真实人物照片；
- 场馆 logo `assets/logos/cpcmuseum.png` 当前没有学生端课程字段直接引用，使用前确认授权与展示位置；
- 学生现场照片不得包含其他参观者正脸、证件或私人信息。

### 17.4 平台絮絮素材

絮絮待机和对话动画来自平台路径 `/assets/video/xuxu-idle.webm`、`/assets/video/xuxu-talk.webm`，无需复制到 lesson。

## 18. 公开字段与服务端私有字段

### 18.1 浏览器公开内容

- 课程、阶段、角色和角色选择文案；
- 角色地点、任务名称、学生行动、证据要求和通过条件；
- 角色卡、徽章、图层、任务底图和媒体；
- A01–A07 的公开 UI 参数；
- 时间银行题干、选项、提示和奖励。

### 18.2 服务端私有内容

- 课程知识正文、来源和揭示规则；
- guidance、scaffolds、phase prompts；
- restrictions、evaluation；
- 时间银行答案、验证方式和定位参数；
- 未解锁路线、会议结论、评分规则和模型内部提示。

### 18.3 主任务工具答案

结构化 Step 可以在课程源中填写服务端验证所需答案。`sanitizeTool` 和 `publicTool` 会剥离已登记的私有键，原始工具参数不会下发浏览器。

这是一套明确字段名单的裁剪机制。任何新增私有字段都必须先扩充裁剪规则和测试，再写入课程源。

上线检查至少搜索：

```text
"answer"
"expectedResults"
1935年1月29日
1935年2月18日至21日
1935年3月21日至22日
失散小战士追赶队伍
```

不得在浏览器包中出现受保护内容、私有答案、API Key、学生隐私和内部 Prompt。

## 19. 同步、重启与预览

从课程目录进入学生端：

```bash
cd ../../4-stu-learning
```

### 19.1 修改素材

```bash
npm run sync:lessons
```

同步会重新复制本课 `assets/` 到 `public/lessons/lesson_zhuhun_001/assets/`。随后在浏览器强制刷新。

### 19.2 修改 Markdown

开发服务正在运行时，停止旧进程后重新启动：

```bash
npm run dev
```

`predev` 会执行课程同步。服务端编译器会缓存已经加载的课程，Markdown 修改后需要重启 API 或整个开发服务。

### 19.3 预览 URL

```text
http://127.0.0.1:5173/?lesson=lesson_zhuhun_001&teacherStart=1
```

`teacherStart=1` 只用于本地模拟教师开放角色选择页。

### 19.4 验证命令

```bash
npm test
npm run build
```

课程专项测试还应覆盖：五角色入场、46 Step、十种工具、史料防剧透、五层战图、时间银行、教师求助和弱网重试。

## 20. 上线前检查清单

### 课程与阶段

- [ ] 课程目录 ID 为 `lesson_zhuhun_001`，主题为 `zhuhun`。
- [ ] `任务阶段：phase-2` 与 `course.md / ## 阶段编排` 一致。
- [ ] Phase 1–6 各有唯一编号和对应 prompt 文件。
- [ ] 推演阶段只开放当时可获得的信息，没有以后见之明代替当时判断。
- [ ] 开场、采证、推演、璇玑、总结和尾声的教师推进条件已确认。

### 角色、任务与 Step

- [ ] 五个 role slug 与知识条目的角色名、限制解除条件一一对应。
- [ ] 每个角色固定三个任务，ID 为 `task-1`、`task-2`、`task-3`。
- [ ] 46 个 Step ID 全部唯一且与本 README 对照一致。
- [ ] 每个 Step 只有一个主要行动，并显式填写位置、完成方式、证据要求和通过后。
- [ ] 角色显示名变更已同步 knowledge roles 与 restrictions。
- [ ] 每个任务／Step 的就地引导、脚手架与验收标准位于正确任务单元，且不泄露未解锁史实。

### 十种活动工具

- [ ] photo：相机、数量、预览、上传和失败重试通过。
- [ ] audio：录音、时长、权限、播放和转写通过。
- [ ] text：动态字段、必填、类型和草稿恢复通过。
- [ ] sketch：底图、笔刷、标注保存和结果提交通过。
- [ ] quiz：单选、排序、开放题、答案私有化和重试通过。
- [ ] builder：证据墙、分类、顺序或连接结果通过。
- [ ] simulation：多分支、回合、指标和记录通过。
- [ ] team：讨论、参与记录、角色和小组同步通过。
- [ ] media：媒体加载、播放完成、失败兜底通过。
- [ ] scanner：扫码/实物识别、权限、结果和手动兜底通过。

### 知识、限制和评估

- [ ] K-01～K-21 无重复 ID，来源、角色和 revealWhen 完整。
- [ ] 一渡、二渡、三渡、四渡、苟坝结论、后续路径和璇玑情境均受 restrictions 保护。
- [ ] restrictions 中角色任务解除条件仍对应 `task-N`。
- [ ] 未核验情境始终显示“课程情境材料｜史料出处待核”。
- [ ] guidance、scaffolds、prompt 和 restrictions 对直接引语、心理活动和现实战术的边界一致。
- [ ] 自动评分任务已有服务端 validator，没有把 evaluation 原文当作已执行规则。

### 素材与场馆

- [ ] 五套角色卡、徽章、图层和任务底图均已替换正式素材。
- [ ] 场馆导航图符合真实允许动线。
- [ ] 所有展馆、地图、电文、照片和 logo 的授权已经记录。
- [ ] 图片没有虚构史料感，也没有其他参观者正脸和证件。
- [ ] `assets-checklist.md` 中上线项全部标为完成。

### 公开安全与技术

- [ ] 已执行 `npm run sync:lessons`。
- [ ] Markdown 更新后已重启 API。
- [ ] 公开课程包不含 quiz answer、扫码预期值、受保护路线和内部评分。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] 五个角色各完成至少一次移动端端到端测试。
- [ ] 46 个 Step 和十种工具均有成功、取消、失败、重试和过期结果测试。
