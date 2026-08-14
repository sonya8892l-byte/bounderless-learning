# 课程 Markdown 包提交规范

本文件是课程包的唯一提交标准。Markdown 是结构化课程数据的可读载体；标题层级、字段名、枚举值和引用路径都会被工程解析。课程作者只维护本课内容，平台通用能力由平台层统一提供。所有可填字段、类型、枚举、单位、默认值和约束都在本文件声明，课程开发不依赖其他示例文档。

## 1. 四层与它们的归属文件

这是课程包最重要的结构。任何课程流程都由以下四层组成：

| 层级 | 表达什么 | 写在哪里 | 数量与顺序怎么改 |
|---|---|---|---|
| **Phase（课程阶段）** | 全班当前处于哪一段教学情境，例如“现场采证”“推理推演” | `course.md（课程总表）`的`## 阶段编排`；该阶段的 AI 规则写在`prompts/phaseN-*.md` | 新增、删除或调整`### Phase N：名称`；文件名中的 N 与 Phase 编号一致 |
| **Role（学生角色）** | 学生以什么身份完成专属任务 | `roles/<role-id>.md（角色文件）` | 一个角色对应一个文件；角色数量等于角色文件数量；角色显示顺序由`排序`决定 |
| **Task（任务）** | 角色要完成的一项完整成果 | 角色文件中的`### 任务N：名称`；选择角色前的公共任务写在 Phase 下的`#### 阶段任务N：名称` | 按标题顺序新增、删除或调整任务；`id`在所属轨道内保持稳定 |
| **Step（小步）** | 完成任务所需的一次明确行动与验收 | Task 下的`#### Step N：名称`；阶段任务下使用`##### Step N：名称` | 按标题顺序新增、删除或调整小步；每个 Step 独立配置工具、证据与验收 |

Phase 与角色任务使用两条独立游标：

- `phaseId（当前阶段标识）`决定顶栏阶段、阶段开场和 Phase 提示规则。
- `currentTaskIndex（当前任务序号）`与`guidanceStepIndex（当前小步序号）`决定学生正在做哪项角色任务和哪一步。
- 教师推进 Phase 不会替学生跳过角色任务；完成角色任务也不会自动替教师切换 Phase。
- `#### 阶段任务N`用于选择角色前的公共导入活动。学生完成入口阶段任务后，再进入角色领取和角色任务轨道。

### 1.1 想改什么，就改哪里

| 修改目标 | 文件与字段 |
|---|---|
| 课程名称 | `course.md`第一行`# 课程名称` |
| 场地、时长、年级、分组 | `course.md / ## 基本信息` |
| 课程核心问题 | `course.md / ## 核心问题` |
| Phase 数量、名称、时长、模式、地点 | `course.md / ## 阶段编排 / ### Phase N` |
| Phase 首次进入时显示的话 | `prompts/phaseN-*.md / ## 开场白模板` |
| Phase 中絮絮的目标、行为、边界与转场话术 | 同一 Phase Prompt 的其余四个二级标题 |
| 角色数量 | 新增或删除`roles/*.md` |
| 角色名称 | 对应角色文件第一行`# 角色名称` |
| 角色顺序 | 对应角色文件`## 基本信息 / 排序` |
| 角色地点与围栏 | 对应角色文件`## 基本信息 / 地点、地理围栏` |
| 角色选择文案、图片、收集物 | 对应角色文件`## 基本信息` |
| 角色任务数量、名称和顺序 | 对应角色文件中的`### 任务N：名称` |
| 任务的小步数量、名称和顺序 | 对应 Task 下的`#### Step N：名称` |
| 学生本步要做什么 | Step 的`小步目标`、`学生行动` |
| 使用哪种活动工具 | Task 或 Step 的`功能模块`、`工具参数` |
| 本步需要什么证据 | Step 的`证据要求`、`完成方式`、`##### 验收标准` |
| 学生卡住时如何提示 | Task 或 Step 的`##### 脚手架` |
| AI 当前可引用哪些知识 | `knowledge/*.md`与 Step 的`知识引用` |
| AI 当前不能透露什么 | `course.md / ## 课程限制规则`与 Step 的`限制引用` |
| 全课量规兜底 | `evaluation.md` |
| 时间银行 | `time-bank.md` |
| 课程图片、视频与地图 | `assets/`，再由对应任务或`course.md`字段引用 |

## 2. 平台默认与课程包的边界

平台通用人设、通用话术、语言分级、脚手架等级语义、活动工具底层行为、安全、隐私和全局默认值统一放在`_platform/（平台默认层）`。需要改变所有课程的共同表现时，去平台层修改。

课程包只写本课独有的数据：课程信息、Phase、角色、任务、Step、知识、限制、验收、时间银行和素材。不要把平台通用规则复制进课程文件，也不要在课程 Markdown 中描述前端、数据库、鉴权或部署实现。

**作为课程开发者，请只修改每个 course 包的内容。**

**`_platform/（平台默认层）`如想修改，需要提一个todo而不是直接改。**

## 3. 标准目录

```text
lesson_<series-code>_<nnn>/
├── course.md
├── roles/
│   └── <role-id>.md
├── prompts/
│   └── phaseN-<slug>.md
├── knowledge/
│   └── <topic>.md
├── evaluation.md
├── time-bank.md
└── assets/
    ├── backgrounds/
    ├── maps/
    ├── roles/
    ├── tasks/
    ├── tokens/
    └── videos/
```

课程目录名就是`courseId（课程标识）`。统一格式为`lesson_<系列代码>_<三位数字>`，例如`lesson_youyi_001`。它会进入课程 API、场次、学习会话和持久化记录，发布后不得更名或复用。

`evaluation.md`和`time-bank.md`按课程需要提交。其余运行文件必须与本课实际流程对应；不要创建只供阅读、没有解析消费者的课程说明章节。

### 3.1 全包通用书写规则

| 数据类型 | 规范写法 | 禁止写法 |
|---|---|---|
| 字段名 | 完全使用本文列出的字段名，中英文和大小写不得自行替换 | 自创同义字段、在字段名后加说明 |
| 布尔值 | `true`或`false` | 是／否、开／关、`True` |
| 整数 | 十进制非负整数，需要单位的字段按本文要求附单位 | 中文数字、模糊范围 |
| 稳定 id | 小写英文、数字和连字号，例如`task-1-step-2` | 中文、空格、临时日期、随标题频繁改动 |
| 坐标 | 高德地图使用的 GCJ-02 坐标，严格按`经度, 纬度` | 纬度在前、度分秒、地址文字混入坐标 |
| 课程内素材路径 | 从`assets/`开始的相对路径，例如`assets/tasks/task-1.webp` | 本机绝对路径、临时 blob 地址、不存在的路径 |
| 枚举值 | 只能从字段表给出的合法值中选择 | 自由翻译、缩写或自创值 |
| JSON | 单行、英文双引号、标准 JSON | 单引号、注释、尾随逗号、Markdown 代码围栏 |

不要在课程包中填写本文未列出的字段。工程对部分未知字段会静默忽略，这会造成“文件写了、学生端没变”的假配置。

本文的“必填”分三档，缺失后果不同：

- **解析器硬必填**：缺失直接编译失败。共 12 个：课程`主题模板`；`学生端角色体系`的`collectionName`、`itemName`、`collectionItemName`、`collectionPanelName`、`unlockTarget`、`任务阶段`；角色`基本信息`的`选择说明`、`角色卡图`、`角色徽章图`、`收集物`、`收集物图`。
- **lint 门禁**：缺失或冲突在`npm run lint:lesson -- --strict`中报 error／warning；发布门禁要求 0 error。
- **规范必填**：本文要求填写，但解析器会静默回落默认值；不填不报错，只会得到错误的默认行为。

Phase 标识符全课统一一种拼法：`phase-N`（连字符），不要出现`phase_N`或`phaseN-start`等变体：

| 写法 | 用在哪里 |
|---|---|
| `phase-N` | `course.md / 学生端角色体系 / 任务阶段`、阶段任务 id、知识条目`revealWhen` |
| `phase-N-start` | `time-bank.md / unlock_after`，例如`phase-2-start` |

历史说明：知识`revealWhen`曾用`phase_N`、`unlock_after`曾用`phase-2-start`（无连字符）。运行时仍兼容旧写法，但 lint 会把`unlock_after`的非规范写法报成 error——写错格式（如`phase-2-start`）曾导致解锁门禁静默失效、题目永久开放，所以新课程必须统一为带连字符的写法。

## 4. `course.md`：课程总表

`course.md`集中保存课程级字段、课程目标、阶段编排和课程限制。三个命名空间都直接写在这个文件中：

- `## 课程目标体系`
- `## 阶段编排`
- `## 课程限制规则`

`course.md`固定顺序为：H1 课程名称 → `基本信息` → `核心问题` → `学生端角色体系` → 可选`学习视图` → 可选`学生端视觉素材` → `课程目标体系` → `阶段编排` → `课程限制规则`。不要在根级增加其他 H2 章节。

### 4.1 基本信息

```markdown
# 课程名称

## 基本信息
- 系列：格物
- 系列代码：gewu
- 主题模板：gewu
- 场地：可被高德地图搜索到的完整场馆或建筑名称
- 坐标中心：116.397000, 39.918000
- 时长：120分钟
- 适用年级：小学3—6年级 / 亲子
- 分组：6人一组，每人一个角色
- 课程层级：深度探究版
- 层级代码：inquiry
```

字段契约：

| 字段 | 类型 | 必填 | 合法值／格式 | 实际作用与边界 |
|---|---|---:|---|---|
| H1 标题 | string（字符串） | 是 | 一行纯文本，建议 6—24 字 | 课程列表、学生入口和 AI 课程身份 |
| `系列` | enum（枚举） | 是 | `格物`、`致知`、`铸魂`、`游艺` | 学生入口品牌和教师课程列表 |
| `系列代码` | enum | 是 | 必须与系列对应，见下表 | 课程系列的稳定机器标识；不得自创 |
| `主题模板` | enum | 是 | `gewu`、`zhizhi`、`zhuhun`、`youyi` | 直接选择学生端 CSS 主题；必须与系列代码一致 |
| `场地` | string | 是 | 高德地图可搜索的正式 POI（地点）、场馆或建筑全称；可在括号内加区域 | 用于入口展示、组织问答，也是学生导航在缺少任务坐标时的高德搜索回退 |
| `坐标中心` | coordinate（坐标） | 是 | GCJ-02，`经度, 纬度`，两个十进制数，建议保留 6 位小数 | 教师场次实时地图和安全范围的课程中心；静态地图图片不会代替它 |
| `时长` | duration（时长文本） | 是 | `120分钟`、`5.5小时`、`8—12周`；可加括号说明 | 用于课程信息和时间问答；不驱动 Phase 倒计时 |
| `适用年级` | string | 是 | 使用`小学1—2年级`、`小学3—6年级`、`小学高年级`、`初中`、`高中`、`亲子`；多项用` / `分隔 | 课程信息和组织问答；不会自动切换学生语言难度 |
| `分组` | string | 是 | `N人一组，……`，N 为正整数，后面明确角色或共同任务分工 | 课程信息和组织问答；教师场次的真实小组和名单另行创建 |
| `课程层级` | enum | 否 | `大众体验版`、`深度探究版`、`研究性学习版` | 学生入口的课程深度标签；只在同系列确有分层时填写 |
| `层级代码` | enum | 条件必填 | `experience`、`inquiry`、`research`，依次对应上述三个层级 | 课程层级的稳定机器标识；与`课程层级`同时出现 |

四个系列的配对是固定契约：

| `系列` | `系列代码` | `主题模板` |
|---|---|---|
| 格物 | `gewu` | `gewu` |
| 致知 | `zhizhi` | `zhizhi` |
| 铸魂 | `zhuhun` | `zhuhun` |
| 游艺 | `youyi` | `youyi` |

`场地`不能只写“第11会议室”、“集合点”或“南门”这类无法独立定位的名称。室内课程应写“场馆／园区／建筑全名（楼层与房间）”；任务导航仍以 Task 或 Step 的明确坐标为权威目的地。

`时长`没有固定为小时。课程作者需同时填数字和单位；允许的课程级单位为`分钟`、`小时`、`天`、`周`。只写`6`无法确定语义，禁止使用。旧课程中存在的`min`写法是历史别名，解析器仍会接受，但新课程一律使用中文单位；存量课程将逐步迁移为中文单位。

`遍历模式`是平台预留字段：课程包不要填写。当前所有课程按顺序（sequential）推进执行，`open`／`inquiry`写了不生效，且会被 lint 警告；待运行时真正实现后再在本文开放。

### 4.2 核心问题

```markdown
## 核心问题
用一个学生需要经过整门课程才能回答的真实问题统领全课。
```


| 项目 | 要求 |
|---|---|
| 类型 | string |
| 必填 | 是 |
| 格式 | `## 核心问题`后的第一个非空行；纯文本，不加列表或子标题 |
| 建议长度 | 20—60 字，一句话 |
| 实际作用 | 学生课程入口展示；不代替 Task 和 Step 的可执行目标 |

### 4.3 学生端角色体系

```markdown
## 学生端角色体系
- collectionName：治水官
- itemName：身份
- 选择眉题：{roleCount}种身份 · {roleCount}段证据
- 选择标题：选择你的{collectionName}身份
- 选择说明：每位成员领取一个本组尚未占用的角色。
- collectionItemName：密符
- collectionPanelName：小组密符
- unlockTarget：璇玑时刻
- 任务阶段：phase-2
```

`collectionName`、`itemName`、`collectionItemName`、`collectionPanelName`、`unlockTarget`和`任务阶段`必填。角色选择文案可使用：

- `{roleCount}`：本课角色数量
- `{collectionName}`：角色集合名
- `{itemName}`：角色单位名
- `{collectionItemName}`：收集物名称
- `{unlockTarget}`：集合后的教学目标名

| 字段 | 类型 | 必填 | 合法格式／默认值 | 实际作用 |
|---|---|---:|---|---|
| `collectionName` | string | 是 | 角色集合名，例如“治水官” | 角色选择标题和相关 UI |
| `itemName` | string | 是 | 单个角色的单位名，例如“身份” | 角色选择文案 |
| `选择眉题` | string | 否 | 默认`{roleCount}个角色` | 角色选择页小标题 |
| `选择标题` | string | 否 | 默认`选择你的角色` | 角色选择页主标题 |
| `选择说明` | string | 否 | 默认`选择角色后开始完成本次课程任务。` | 角色选择页规则文案 |
| `collectionItemName` | string | 是 | 角色完成后获得的收集物通称 | 奖励卡和进度文案 |
| `collectionPanelName` | string | 是 | 小组收集面板名 | 学生小组页标题 |
| `unlockTarget` | string | 是 | 学生可理解的集齐目标名 | 只用于学生文案；不会自动推进 Phase |
| `任务阶段` | reference（引用） | 是 | 必须精确引用本文件已定义的`phase-N` | 角色领取后会话的初始 Phase |

角色数量由`roles/*.md`文件数量决定。`{roleCount}`会在学生端自动替换为该数量。

### 4.4 学习视图

只有本课需要指定学生呈现方式时才写：

```markdown
## 学习视图
- enabled：true
- default：dialogue
- allowStudentSwitch：true
```

| 字段 | 类型 | 必填 | 合法值 | 默认值 | 实际作用 |
|---|---|---:|---|---|---|
| `enabled` | boolean | 否 | `true`、`false` | `true` | 是否启用对话／挑战双视图 |
| `default` | enum | 否 | `dialogue`、`challenge` | `dialogue` | 学生首次进入时的默认视图 |
| `allowStudentSwitch` | boolean | 否 | `true`、`false` | `true` | 是否显示学生自主切换入口 |

三个字段的上述值就是平台默认。课程需要不同表现时才写本节；需要修改所有课程的默认时，到平台层处理。

### 4.5 学生端视觉素材

```markdown
## 学生端视觉素材
- 课程封面：assets/backgrounds/cover.png
- 导航地图：assets/maps/navigation-map.png
- 导入占位图：assets/videos/video-storm-coming.png
```

| 字段 | 类型 | 必填 | 格式 | 实际作用 |
|---|---|---:|---|---|
| `课程封面` | asset path（素材路径） | 否 | `assets/backgrounds/<slug>.<ext>` | 课程入口封面；缺省时使用平台默认路径 |
| `导航地图` | asset path | 否 | `assets/maps/<slug>.<ext>` | 学生小组页的静态示意图，同时作为教师快照素材元数据 |
| `导入占位图` | asset path | 否 | `assets/videos/<slug>.<ext>` | 导入媒体没有视频源时的预览图 |

`导航地图`是静态图片，不是教师端的高德实时地图，也不参与 GPS 定位。高德地图使用`坐标中心`、任务坐标和学生实时位置。

平台还保留若干默认图片槽位，当前没有学生端直接展示入口。课程包不要填写`对话背景`、`阶段转场`、`完课证书`或`推演占位图`；需要这些能力时，先在平台层增加真实界面消费者。

### 4.6 课程目标体系

目标按`DK（学科知识）`、`DS（学科能力）`、`DC（课程级核心能力）`记录。每条都是可解析数据，严格使用“编号 + 空格 + 名称 + 全角冒号 + 描述”：

```markdown
## 课程目标体系

### 学科知识 DK
- DK-01 排水系统构成：认识课程要研究的关键系统构成。

### 学科能力 DS
- DS-01 现场观察：从现场对象中提取可复核信息。

### 课程级核心能力 DC
- DC-01 证据意识：用证据支撑结论并说明边界。
```

| 字段 | 类型 | 必填 | 格式／约束 | 实际作用 |
|---|---|---:|---|---|
| 目标 id | reference id（引用标识） | 是 | `DK-01`、`DS-01`或`DC-01`；同一课程内唯一，编号建议两位递增 | 课程私有目标记录和 Task／Step `能力标签`的引用源 |
| 名称 | string | 是 | 2—12 字，不含冒号 | 给课程设计、评价和审计使用 |
| 描述 | string | 是 | 一句可观察、可评价的学习结果 | 课程结构化元数据；当前不直接生成学生分数 |

Task 和 Step 的`能力标签`可引用这里的`DK`、`DS`、`DC`编号，也可引用平台定义的`CC`、`CQ`编号。多个标签使用英文逗号分隔，例如`DK-01, DS-01, DC-01`。需要新增或改动`CC`、`CQ`时，到平台底层的能力树修改。

### 4.7 阶段编排

每个 Phase 使用同一组课程级字段：

```markdown
## 阶段编排

### Phase 1：阶段名称
- 时长：20分钟
- 模式：全班
- 地点：场馆集合区域
```

| 字段 | 类型 | 必填 | 合法格式／枚举 | 实际作用 |
|---|---|---:|---|---|
| Phase 编号 | integer | 是 | 从`1`开始连续递增，标题格式`### Phase N：名称` | 生成`phase-N`，绑定 Prompt、顶栏和教师推进 |
| Phase 名称 | string | 是 | 2—12 字 | 学生顶栏、教师场次和 AI 阶段身份 |
| `时长` | duration | 是 | 单一数值 + `分钟`或`小时`，例如`20分钟`、`1.5小时`；不得写范围或周 | 驱动学生端阶段倒计时，也进入时间问答 |
| `模式` | string | 是 | 使用`个人`、`小组`、`全班`或清楚的组合，例如`个人 → 小组` | 阶段组织信息和 AI 上下文；不自动改变会话存储单位 |
| `地点` | string | 是 | 本阶段的人类可读地点描述 | 阶段组织信息；不作为 GPS 目的地，定位写在 Task／Step |

教师端是 Phase 推进的权威入口。课程包不要写`触发条件`、`结束条件`、`功能模块`或`流程`作为自动转场承诺；当前这些文字不驱动 Phase 状态机。AI 的转场话术写在对应 Phase Prompt 的`转场条件`。

#### 阶段任务

阶段任务与角色任务使用同一套 Task/Step 字段，额外增加`执行单位`：

```markdown
#### 阶段任务1：任务名称
- id：phase-1-task-1
- 执行单位：个人
- 功能模块：A06(沉浸媒体)
- 工具参数：{"media":{"type":"video","poster":"assets/videos/opening.png","posterOnly":true,"requireCompletion":true}}
- 完成方式：tool_result
- 建议时长：3分钟
- 收口方式：auto_on_last_step
- 推进方式：auto_after_validation
- 通过条件：写明阶段任务的整体达标条件
- 证据要求：写明阶段任务需要的证据
- AI引导方向：用一句话说明阶段任务中 AI 应如何引导

###### 验收标准
写明任务级验收底线。

##### Step 1：小步名称
- id：phase-1-task-1-step-1
- 小步目标：查看开场情境
- 学生行动：观察并确认已查看
- 位置：none
- 完成方式：tool_result
- 证据要求：媒体工具返回查看确认
- 功能模块：A06(沉浸媒体)
- 工具参数：{"media":{"type":"video","poster":"assets/videos/opening.png","posterOnly":true,"requireCompletion":true}}
- 最大尝试：3
- 失败处理：请先查看情境图，再点击确认
- 教师介入：媒体持续无法打开
- 通过后：role-stage:complete

###### 验收标准
媒体工具返回查看确认。
```

`执行单位`是硬枚举：

| 值 | 语义 | 使用要求 |
|---|---|---|
| `个人` | 每个学生各自完成 | 学生会话按个人保存进度；需要每人操作时选它 |
| `小组` | 设计上每组一份 | 任务文案应指明记录人；当前不提供多设备实时共编 |
| `全班` | 教师统一组织的公共活动 | 适合导入媒体、全班发布等阶段任务 |

阶段任务其余字段与第 5 节的 Task／Step 契约完全相同。
`阶段任务 / AI引导方向`是可选的单行引导摘要，会进入阶段任务 AI 上下文。如果已经写了就地`引导`，保留就地段落即可，避免两份文字漂移。

阶段任务的三处补充约定：

- `id`可省略，缺省时自动生成`phase-N-task-M`（N 为 Phase 编号，M 为该 Phase 内阶段任务序号）。
- 阶段任务 Step 的`通过后：role-stage:complete`表示入口任务轨道结束——学生随后进入角色领取，而不是进入某个角色任务。
- `执行单位`当前是组织元数据：`小组`／`全班`任务的进度仍按每名学生的会话分别保存，不提供多设备实时共编，任务文案应指明记录人。

### 4.8 课程限制规则

限制章节必须是可精确引用的命名分区：

```markdown
## 课程限制规则

### 核心数据限制

| 限制项 | 不可透露的内容 | 保护原因 | 解除条件 |
|---|---|---|---|
| 精确数量 | 某个任务答案 | 学生需要自行观察 | 对应任务完成后 |

### 跨角色隔离

- 未解锁前，不能向当前角色透露其他角色的结论。
```

Step 使用完整路径引用：

```markdown
- 限制引用：course.md#课程限制规则/核心数据限制
```

限制表的四列是固定 schema（数据结构）：

| 列 | 类型 | 必填 | 要求／实际作用 |
|---|---|---:|---|
| `限制项` | string | 是 | 课程内唯一的简短名称，也可作为 Step 引用目标 |
| `不可透露的内容` | string | 是 | 列出需要保护的精确数据、答案或关键表述；用于 AI 输出脱敏 |
| `保护原因` | string | 是 | 说明为什么必须由学生自行获得 |
| `解除条件` | enum-like string（受限文本） | 是 | 只写`Phase N开始后`、`<角色名>任务N完成后`、`模拟运行后`或`始终不解除` |

Step 的`限制引用`可以指向命名章节，也可指向表格中的`限制项`，完整写法都是`course.md#课程限制规则/<精确名称>`。多条引用用英文逗号分隔。标题和限制项名必须完全匹配，包括空格和标点。

表格中的保护内容会进入输出保护和解锁判断；命名章节把当前 Step 需要的最小规则片段送入 AI。

## 5. `roles/*.md`：角色、任务和 Step

一个角色一个文件。文件名必须匹配`[a-z0-9]+(?:-[a-z0-9]+)*.md`，例如`field-observer.md`。文件名生成`roleId（角色标识）`，发布并产生学习记录后不要更改。

### 5.1 角色基本信息

```markdown
# 角色名称

## 基本信息
- 排序：1
- 地点：可搜索、可到达的角色活动区域
- 地理围栏：中心(116.3972, 39.9171) 半径100m
- 选择说明：用一句话说明这个角色负责观察和产出什么。
- 角色卡图：assets/roles/role-card-field-observer.png
- 角色徽章图：assets/roles/badge-field-observer.png
- 收集物：A
- 收集物图：assets/tokens/token-A.png
```

| 字段 | 类型 | 必填 | 合法格式／约束 | 实际作用 |
|---|---|---:|---|---|
| H1 角色名称 | string | 是 | 课程内唯一，建议 2—6 字 | 角色选择、AI 当前身份、教师名单和小组统计 |
| `排序` | integer | 是 | 从`1`开始，各角色唯一且连续 | 角色选择页顺序 |
| `地点` | string | 是 | 可识别的场馆子区域，与`course.md / 场地`组合后应可在高德搜索 | 该角色使用`inherit_role`的 Task 默认地点 |
| `地理围栏` | geofence（地理围栏） | 条件必填 | `中心(<经度>, <纬度>) 半径<正数>m`，GCJ-02 | 继承给角色 Task 的坐标和半径 |
| `选择说明` | string | 是 | 一句可执行的职责说明，建议 20—50 字 | 角色选择界面 |
| `角色卡图` | asset path | 是 | `assets/roles/<slug>.<ext>` | 角色选择大卡图片 |
| `角色徽章图` | asset path | 是 | `assets/roles/<slug>.<ext>` | 角色头像、徽章和对话标识 |
| `收集物` | string | 是 | 同一课程各角色建议唯一 | 该角色全部任务完成后的奖励值 |
| `收集物图` | asset path | 是 | `assets/tokens/<slug>.<ext>` | 奖励卡和小组收集页；`tokens`表示课程收集物图片，与账号凭证或 API token 无关 |

角色文件不要增加`类型`、`关键数据`、`密符奖励`、`Phase 3 行为`或`Phase 4 参数`。这些字段没有当前运行消费者，需要的事实写入`knowledge/`，任务行为写入 Task／Step。

三处补充约定：

- `地理围栏`的“条件必填”指：任一 Task 使用`位置模式：inherit_role`的角色必填；全部 Task 都是`位置模式：none`的角色可以不填。
- 角色 H1 可带 emoji 装饰，解析器会剥离 emoji 后作为角色名。知识条目的`roles`做的是精确字符串匹配，必须写剥离后的纯文本名（H1 为`# 🐲 数龙官`时写`数龙官`），带 emoji 会静默匹配失败、该知识永不出现。
- `排序`缺失时按角色文件顺序回落，仍建议显式填写以保证选择页顺序稳定。

### 5.2 Task 字段

```markdown
## 任务列表

### 任务1：任务名称
- id：task-1
- 位置模式：inherit_role
- 到达验证：manual
- 最短停留：0分钟
- 建议时长：15分钟
- 无操作提醒：8分钟
- 提醒冷却：8分钟
- 最大主动提醒：1
- 推进方式：auto_after_validation
- 收口方式：auto_on_last_step
- 任务图：assets/tasks/task-1.jpg
- 配置：用一句话说明学生需要产出什么
- 通过条件：全部必做 Step 通过
- 目标关联：K1(本课关键知识), S1(本任务方法), C1(本任务品质)
- 能力标签：DK-01, DS-01, DC-01
```

| 字段 | 类型 | 必填 | 合法值／默认 | 实际作用 |
|---|---|---:|---|---|
| `id` | id | 是 | 当前角色内唯一，建议`task-N` | 进度、事件、工具实例和任务图稳定键 |
| `位置模式` | enum | 是 | `inherit_role`、`none`、`point`、`geofence` | 选择任务位置来源；见下表 |
| `地点` | string | 条件必填 | `point`或`geofence`时填可识别的具体地点 | 任务卡和高德导航名称 |
| `坐标` | coordinate | 条件必填 | GCJ-02，`经度, 纬度` | `point`建议必填；`geofence`必填；学生导航的权威目的地 |
| `围栏半径` | number + unit | `geofence`必填 | 正整数 + `m`，例如`80m` | GPS 到达判定半径 |
| `到达验证` | enum | 是 | `none`、`manual`、`geofence`、`teacher` | 无门槛、学生手动确认、GPS 围栏验证、教师根据学生实时位置快照确认 |
| `最短停留` | duration | 否 | 显式`秒`、`分钟`或`小时`；默认`0秒` | 到达后的最短停留时长 |
| `建议时长` | duration | 否 | 默认`15分钟` | 任务时长提示与 AI 时间上下文 |
| `无操作提醒` | duration | 否 | 默认`8分钟` | 超过该时间没有动作时允许发主动提醒 |
| `提醒冷却` | duration | 否 | 默认`8分钟` | 同一任务两次主动提醒的最短间隔 |
| `最大主动提醒` | integer | 否 | 大于等于`0`，默认`1` | 当前任务最多自动提醒次数 |
| `推进方式` | enum | 否 | 默认`auto_after_validation`；见下表 | 任务完成后进入下一任务的控制权 |
| `收口方式` | enum | 否 | 默认`auto_on_last_step`；见下表 | 全部 Step 通过后如何完成整项 Task |
| `任务图` | asset path | 否 | `assets/tasks/<slug>.<ext>` | 任务卡头图；缺省时回退到角色卡图 |
| `配置` | string | 是 | 一句可执行的产出要求 | 学生任务卡和 AI 任务上下文 |
| `通过条件` | string | 是 | 一句可核验的整体达标条件 | 任务级验收上下文 |
| `完成方式` | enum | 条件必填 | `收口方式：explicit_bundle_submit`时必填，决定整包验收路径，枚举同 Step | 任务级验收路径；有 Step 时以当前 Step 为准 |
| `证据要求` | string | 条件必填 | `explicit_bundle_submit`整包验收时的任务级证据要求 | 任务级验收上下文 |
| `目标关联` | string | 是 | 逗号分隔的知识／方法／品质线索，使用`K1(...)`、`S1(...)`、`C1(...)`这类可读写法 | 语义线索；注意隐藏语义：`K<N>`会隐式关联知识条目`K-0N`并获得检索加权（Step 未写`知识引用`时生效），`S／C`仅是上下文，与`DK／DS／DC`编号无映射 |
| `能力标签` | id[] | 是 | `CC`、`CQ`、`DK`、`DS`、`DC`开头的已定义 id，逗号分隔 | 私有课程能力元数据；不直接推进进度或计分 |
| `前置` | id[] | 否 | 当前角色内已定义 Task id，英文逗号分隔 | 角色任务图的前置门禁 |

位置模式：

| 值 | 行为 |
|---|---|
| `inherit_role` | 继承角色基本信息的`地点`和`地理围栏` |
| `none` | 本任务没有位置卡和到达门槛 |
| `point` | 显示单一目的地；应配`地点`和`坐标` |
| `geofence` | 使用 GPS 圆形围栏；必须配`地点`、`坐标`和`围栏半径` |

课程不要使用`route`、`area`、`approved_scope`或`teacher_approved_route`。当前学生端没有对应的路线、多边形或教师批准范围状态机。

任务级时长字段统一使用`秒`、`分钟`或`小时`。只写数字会被解释为秒，课程包禁止这种模糊写法。`min`是旧课程遗留别名（解析器仍接受，新课程勿用）；`课时`、`天`、`周`不是合法的任务级时长单位——解析器不认识它们，会静默错解析为秒，发布前务必检查。

`## 任务列表`是角色文件的结构约定，解析器只识别`### 任务N：`标题、不依赖这个 H2；建议保留以方便阅读。

新课程的 Task 必须有显式 Step（`#### Step N`）。没有显式 Step 的旧写法仅为存量兼容保留：解析器会把`引导步骤`合成为`user_confirm`小步，strict lint 无法识别这种任务的验收质量。

`到达验证：teacher`只在教师端根据 60 秒内的学生位置快照发出“确认到达”时生效。需要教师审核学生任务证据时，使用 Step `完成方式：teacher_confirm`，不要用到达验证字段替代。

#### 推进方式

| 值 | 行为 |
|---|---|
| `auto_after_validation` | 任务验收通过后自动进入下一任务 |
| `ai_suggest` | AI 提示学生确认后推进 |
| `teacher` | 等教师端推进 |

#### 收口方式

| 值 | 行为 |
|---|---|
| `auto_on_last_step` | 最后一个必做 Step 通过后完成任务 |
| `explicit_bundle_submit` | Step 全部通过后，学生再点击整包提交；Task 的`完成方式`和`证据要求`决定整包验收 |
| `teacher_confirm` | Step 全部通过后，等待教师人工终审 |

### 5.3 Task 就地引导与脚手架

```markdown
##### 引导
说明本任务的引导目标、提问顺序和不能提前说出的结论。

##### 脚手架
| L0 | 肯定学生当前有效动作，不增加答案线索。 |
| L1 | 给一个观察方向。 |
| L2 | 给一个可执行方法。 |
| L3 | 给结构化核验框架。 |
| L4 | 给完整核验步骤，仍由学生填写结论。 |
```

Task 级内容作为本任务的默认值。Step 写了同名段落时，Step 优先。脚手架等级的通用语义由平台层统一定义；课程只写本任务的具体提示。

### 5.4 Step 字段

```markdown
#### Step 1：小步名称
- id：task-1-step-1
- 小步目标：写明本步结束时要获得的结果
- 学生行动：写明学生现在要做的一个明确动作
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少1张清楚照片；主体与环境参照同时入镜
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"prompt":"请拍摄主体与环境参照。","minCount":1,"maxCount":2,"accept":"image/*"}}
- 知识引用：K-01
- 限制引用：course.md#课程限制规则/核心数据限制
- 常见误区：只拍局部，无法判断位置关系
- 最大尝试：3
- 失败处理：指出缺少主体、环境参照或清晰度中的首要一项
- 教师介入：连续3次仍无法取得可辨认证据
- 通过后：step:task-1-step-2

##### 脚手架
| L1 | 检查画面中是否同时有主体和环境参照。 |
| L4 | 按“主体完整、环境可定位、比例可比较”逐项核验。 |

##### 验收标准
至少1张清楚照片；主体与环境参照同时入镜。
```

| 字段 | 类型 | 必填 | 合法值／默认 | 实际作用 |
|---|---|---:|---|---|
| `id` | id | 是 | 当前 Task 内唯一，建议`<task-id>-step-N` | Step 进度、证据、工具状态和重放的稳定键 |
| `小步目标` | string | 是 | 可观察的单一结果 | AI 当前目标和任务卡说明 |
| `学生行动` | string | 是 | 以动词开头的一个明确动作 | 学生本步主指令和默认引导步骤 |
| `位置` | enum | 是 | `inherit`、`none`、`point`、`geofence` | 继承 Task 位置或定义本步独立位置 |
| `地点`、`坐标`、`围栏半径` | 见 Task 位置字段 | 条件必填 | `point`、`geofence`时按 Task 同样的坐标与半径契约填写 | 覆盖 Task 默认位置 |
| `最短停留`、`到达验证` | duration + enum | 否 | 同 Task 契约 | 本步位置门槛 |
| `完成方式` | enum | 是 | 见下表 | 选择本步的权威验收路径 |
| `证据要求` | string | 条件必填 | `tool_result`、`ai_evaluation`、`teacher_confirm`、`compound`需写可核验证据 | 任务卡和验收上下文 |
| `功能模块` | enum list（枚举列表） | 使用工具时必填 | 第 6 节列出的`A01`—`A07`，多项用逗号分隔 | 选择本步活动工具 |
| `工具参数` | JSON | 使用工具时必填 | 必须符合第 6 节对应工具 schema | 实例化工具的题目、素材、选项和验收门槛 |
| `知识引用` | id[] | 否 | `K-01, K-02`，必须在`knowledge/*.md`中存在 | 定向检索当前需要的知识条目 |
| `限制引用` | reference[] | 否 | `course.md#课程限制规则/<精确名称>` | 注入当前需要的限制片段 |
| `能力标签` | id[] | 否 | 同 Task `能力标签` | Step 级私有能力元数据 |
| `常见误区` | string | 是 | 一句描述学生最可能出现的具体偏差 | AI 当前小步的诊断上下文 |
| `最大尝试` | integer | 否 | 大于等于`1`，默认`3` | AI 验收尝试上限；达上限后可进入教师审核 |
| `失败处理` | string | 是 | 明确学生未达标后 AI 先指出哪一项、要求补什么 | 失败反馈策略与发布校验 |
| `教师介入` | string | 是 | `teacher_confirm`必须精确写`必须`；其他方式写需人工处理的具体条件 | 教师审核入口和发布校验；只写说明不会自动召唤教师 |
| `通过后` | reference | 是 | `step:<stepId>`、`role-stage:<taskId>`或`role-stage:complete` | 小步出边和角色任务图推进 |

#### 完成方式

| 值 | 使用场景 |
|---|---|
| `user_confirm` | 学生确认已完成，无工具证据 |
| `tool_result` | 由活动工具的数量、必填项、正确答案或完成轮次确定性判定；必须配工具 |
| `ai_evaluation` | 先通过工具底线，再由 AI 按证据与验收标准判定；必须配证据、工具和验收标准 |
| `teacher_confirm` | 提交后等教师人工审核；`教师介入`必须写`必须` |
| `location_event` | 由位置到达事件判定；`位置`必须为`point`或`geofence`，且配好定位字段 |
| `compound` | 组合工具、位置或其他证据；必须在`证据要求`和`验收标准`中列明每个组成条件 |

`user_confirm`适合阅读完成、规则确认等无证据动作，不要用它代替拍照、答题或数据填写的真实验收。

#### 通过后

任务推进分五层，各管一段，不要互相替代：

1. Step 之间按 Markdown 书写顺序执行（运行时就是下标 +1）；`step:<stepId>`当前只是声明性的出边记录，不改变执行顺序。
2. 最后一个 Step 通过后，`收口方式`决定任务立即完成、整包提交还是等教师终审。
3. 任务完成后，`推进方式`决定自动推进、学生确认后推进还是等教师推进。
4. 真正选择下一个 Task 时，任务图按`前置`（门禁）和`role-stage:<taskId>`（出边）做拓扑推进：`前置`未完成的任务会被挡住，不会放行。
5. 阶段任务（入口轨道）不进角色任务图，完成即进入角色领取。

三个取值的含义：

- `step:<stepId>`：声明本步的下一小步；实际执行顺序仍以书写顺序为准。
- `role-stage:<taskId>`：当前任务完成后允许进入指定角色任务（仍受`前置`门禁约束）。
- `role-stage:complete`：当前轨道结束——角色任务轨道或入口阶段任务轨道。

Step 可以在字段后写`##### 引导`、`##### 脚手架`和`##### 验收标准`。Step 级内容覆盖 Task 级同名内容。课程包不要使用`引导引用`、`脚手架引用`或`评估引用`；这三个引用字段当前没有执行消费者。

## 6. 活动工具

`功能模块`选择活动能力，`工具参数`配置本课内容。工具通常写在执行它的 Step 中；写在 Task 中的工具仅用于没有显式 Step 的存量兼容任务，新课程不要这样写。

位置导航、阶段倒计时、师生通信和主 AI 对话由平台提供，不写进`功能模块`。工具的全局显示名和默认字段文案属于`_platform/（平台默认层）`；课程包只配置本课的题目、提示、素材、选项和验收规则。

### 6.1 通用写法

当前共有 7 个模块、10 种工具：

| 模块 | 工具键 | 学生端工具 | 典型用途 |
|---|---|---|---|
| `A01` | `photo` | 拍照采集 | 拍摄现场证据 |
| `A01` | `audio` | 语音记录 | 录制现场口述 |
| `A01` | `text` | 文字表单 | 填写观察、判断和结构化字段 |
| `A01` | `sketch` | 画板标注 | 圈画、连线和绘制示意图 |
| `A02` | `quiz` | 答题评测 | 一道单选、多选、判断、排序、填空或开放题 |
| `A03` | `builder` | 拼合搭建 | 卡片分类、排序、流程和证据墙 |
| `A04` | `simulation` | 沙盘推演 | 多轮选择、资源和指标变化 |
| `A05` | `team` | 团队协作 | 记录角色贡献、核验意见和讨论结论 |
| `A06` | `media` | 沉浸媒体 | 展示图片、音频、视频或静态情境图 |
| `A07` | `scanner` | 扫码识别 | 识别课程码、条码或采集实物图像 |

每个`工具参数`都采用“工具键 → 配置对象”的结构，即使本步只有一个工具，也不要省略外层工具键：

```markdown
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"prompt":"拍摄一张全景。","minCount":1,"maxCount":3}}
```

同一个 Step 可以组合多个工具。`功能模块`列出全部能力，`工具参数`为每个工具分别提供配置；学生必须完成本步全部必需工具：

```markdown
- 功能模块：A01(拍照/文字), A05(讨论记录)
- 工具参数：{"photo":{"prompt":"拍摄现场对象。","minCount":1,"maxCount":2},"text":{"fields":[{"id":"observation","label":"观察结论","type":"long_text","required":true,"minLength":20}]},"team":{"prompt":"记录一条同伴核验意见。","minimumEntries":1}}
```

JSON 书写规则：

- 必须写在一行，使用英文双引号，不能写注释、尾随逗号或 Markdown 代码围栏。
- 布尔值使用`true`或`false`，数字不能加单位；单位写进提示文字或字段标签。
- 外层键必须与`功能模块`选择的工具一致，例如`A02`使用`quiz`。
- `id`在同一个工具内必须唯一且保持稳定，建议使用小写英文、数字和连字符。
- 素材路径相对于当前课程目录书写，例如`assets/tasks/drain-reference.jpg`。
- 不要填写本章未列出的字段。当前解析器会保留部分未知字段，但学生端不会因此产生功能。

字段表中的类型记号：`string（字符串）`、`integer（整数）`、`number（数值）`、`boolean（布尔值）`、`enum（枚举值）`、`object（对象）`、`string[]（字符串数组）`和`object[]（对象数组）`。

所有工具共用同一种任务卡外壳：顶部显示图标、工具名、模块编号和完成状态，主体显示课程提示、交互控件与当前结果。多个工具按照配置顺序纵向排列。

完成方式与工具的关系：

| `完成方式` | 工具行为 |
|---|---|
| `tool_result` | 按数量、必填项、正确答案、轮次等确定性规则验收 |
| `ai_evaluation` | 先完成工具必填规则，再由 AI 按`证据要求`和`##### 验收标准`判断；照片、画板和实物图像可以进入视觉检查 |
| `teacher_confirm` | 工具用于收集和展示结果，最终由教师端人工通过 |
| `compound` | 组合工具、位置或其他证据；必须在验收标准中说明组合条件 |

### 6.2 `photo`：拍照采集

```markdown
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"prompt":"拍摄一张同时包含主体和环境参照的全景。","minCount":1,"maxCount":3,"accept":"image/*","referenceImage":"assets/tasks/photo-reference.jpg"}}
```

| 字段 | 类型 | 必填 | 默认值 | 作用 |
|---|---|---:|---|---|
| `prompt` | string | 否 | 平台提示 | 拍摄要求 |
| `minCount` | integer | 否 | `1` | 最少照片数 |
| `maxCount` | integer | 否 | `6` | 最多照片数，必须不小于`minCount` |
| `accept` | string | 否 | `"image/*"` | 文件选择器接受的类型 |
| `referenceImage` | string | 否 | 空 | 工具卡顶部显示的拍摄参考图 |

学生端显示相机/相册入口、已选数量、照片缩略图和逐张删除按钮。`tool_result`只验证照片数量；需要判断画面内容时使用`ai_evaluation`并写清验收标准。

不要配置`recognition`。照片是否进入 AI 视觉检查由 Step 的`完成方式`控制。

### 6.3 `audio`：语音记录

```markdown
- 功能模块：A01(录音)
- 工具参数：{"audio":{"prompt":"用自己的话描述水流方向和判断依据。","minSeconds":5,"maxSeconds":60}}
```

| 字段 | 类型 | 必填 | 默认值 | 作用 |
|---|---|---:|---|---|
| `prompt` | string | 否 | 平台提示 | 口述任务要求 |
| `minSeconds` | integer | 否 | `3` | 最短录音秒数 |
| `maxSeconds` | integer | 否 | `90` | 最长录音秒数，到时自动停止 |

学生端显示开始、停止、重新录音、录音时长和音频播放器。浏览器支持语音识别时会同时显示中文转写；不支持时仍可提交录音。

不要配置`language`或`transcribe`。当前识别语言由平台固定管理，课程包不能切换。

### 6.4 `text`：文字表单

```markdown
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"object-type","label":"观察对象","type":"select","required":true,"options":["螭首","沟渠","河道"]},{"id":"observation","label":"观察与判断","type":"long_text","required":true,"placeholder":"写出看到的现象和判断依据。","minLength":20,"maxLength":200}]}}
```

`fields`是字段数组。每个字段支持：

| 字段 | 类型 | 必填 | 作用 |
|---|---|---:|---|
| `id` | string | 是 | 字段稳定标识，同一表单内唯一 |
| `label` | string | 是 | 学生端字段名称 |
| `type` | enum | 是 | `short_text`、`long_text`、`number`或`select` |
| `required` | boolean | 否 | 是否必填，默认`false` |
| `placeholder` | string | 否 | 输入提示 |
| `minLength` | integer | 否 | 文本最少字数 |
| `maxLength` | integer | 否 | 文本最多字数 |
| `options` | string[] | `select`必填 | 下拉候选项，只使用字符串数组 |

学生端根据`type`显示单行输入框、多行文本框、数字输入框或下拉选择框。验收会检查必填项和文本长度。

数字字段当前只收集数值，不支持课程级`min`、`max`或`step`门槛；需要判断数值正确性时使用`quiz`填空题。

### 6.5 `sketch`：画板标注

```markdown
- 功能模块：A01(画板标注)
- 工具参数：{"sketch":{"prompt":"在底图上圈出积水风险点并画出水流方向。","width":720,"height":420,"brushColors":["#8d211f","#245c4f","#1f2937"],"backgroundImage":"assets/maps/drain-base.png"}}
```

| 字段 | 类型 | 必填 | 默认值 | 作用 |
|---|---|---:|---|---|
| `prompt` | string | 否 | 平台提示 | 绘制要求 |
| `width` | integer | 否 | `720` | 画布内部宽度 |
| `height` | integer | 否 | `420` | 画布内部高度 |
| `brushColors` | string[] | 否 | 平台色组 | 可选择的画笔颜色，使用 CSS 颜色值 |
| `backgroundImage` | string | 否 | 空 | 画布底图路径 |

学生端显示颜色按钮、清空按钮和可触控画布。验收至少要求学生产生一份画板结果；内容质量需要使用`ai_evaluation`或`teacher_confirm`。

### 6.6 `quiz`：答题评测

每个`quiz`只配置一道题。多道题拆成多个 Step，以便分别保存进度和反馈。

```markdown
- 功能模块：A02(单选题)
- 工具参数：{"quiz":{"type":"single_choice","question":"哪项证据最能说明水流方向？","options":["地面坡度","屋顶颜色","游客数量"],"answer":"地面坡度","retryMessage":"回到现场证据，判断哪一项会直接影响水的运动。"}}
```

| 字段 | 类型 | 必填 | 作用 |
|---|---|---:|---|
| `type` | enum | 是 | 题型，见下表 |
| `question` | string | 是 | 题目正文 |
| `options` | string[] | 选择/排序题必填 | 候选项 |
| `answer` | string、number或string[] | 客观题必填 | 正确答案；只在服务端保存，不下发学生端 |
| `retryMessage` | string | 否 | 错误后的重试提示 |
| `placeholder` | string | 否 | 填空或开放回答占位文字 |
| `minLength` | integer | 开放回答建议填写 | 最少回答字数 |
| `tolerance` | number | 数值填空可选 | 数值答案允许误差，默认`0` |

| `type` | 学生端样式 | `answer`写法 |
|---|---|---|
| `single_choice` | 单选卡片 | 单个字符串 |
| `multiple_choice` | 多选卡片 | 字符串数组，顺序不影响服务端判定 |
| `true_false` | 正确/错误单选 | `"正确"`或`"错误"`；不写`options`时使用默认选项 |
| `ordering` | 带上下移动按钮的排序列表 | 按正确顺序排列的字符串数组 |
| `fill_blank` | 文本输入框 | 字符串或数字；数字可配`tolerance` |
| `open_response` | 多行文本框 | 不写`answer`，使用`minLength`或`ai_evaluation` |

多选题示例：

```markdown
- 工具参数：{"quiz":{"type":"multiple_choice","question":"哪些属于现场可直接观察的证据？","options":["排水口位置","地面坡度","完整历史结论"],"answer":["排水口位置","地面坡度"],"retryMessage":"只选择你在现场能够直接确认的内容。"}}
```

不要配置`explanation`。当前学生端不会展示答案解析；需要解释时写在 AI 反馈、`通过后`或后续 Step 中。

### 6.7 `builder`：拼合搭建

```markdown
- 功能模块：A03(分类拼合)
- 工具参数：{"builder":{"prompt":"把证据卡放进对应类别。","items":[{"id":"slope","label":"地面有高低差"},{"id":"color","label":"屋顶颜色不同"}],"zones":[{"id":"water","label":"影响水流"},{"id":"other","label":"与水流无直接关系"}],"correctMapping":{"slope":"water","color":"other"},"retryMessage":"判断每张卡是否会直接改变水的运动。","zoneMinimums":{"water":1,"other":1}}}
```

| 字段 | 类型 | 必填 | 作用 |
|---|---|---:|---|
| `prompt` | string | 否 | 拼合要求 |
| `items` | object[] | 是 | 待放置卡片，每项写`id`和`label` |
| `zones` | object[] | 是 | 目标区域，每项写`id`和`label` |
| `correctMapping` | object | 否 | 私有正确映射，键为卡片 id、值为区域 id |
| `retryMessage` | string | 否 | 映射错误时的提示 |
| `zoneMinimums` | object | 否 | 每个区域最少卡片数，键为区域 id |
| `bindings` | object | 否 | 将前面 Step 的学生结果动态写入指定卡片 |

学生端显示卡片库和一个或多个放置区域。学生选择卡片后点击“放到这里”，也可以点击已放置卡片将其撤回。全部卡片必须放置；配置`correctMapping`后还会在服务端核对正确区域。

`bindings`按卡片 id 配置来源：

```markdown
- 工具参数：{"builder":{"prompt":"把上一小步写下的句子分类。","items":[{"id":"sentence-1","label":"第1句"}],"zones":[{"id":"evidence","label":"证据"},{"id":"inference","label":"推断"}],"bindings":{"sentence-1":{"taskId":"task-1","stepId":"write-draft","toolId":"text","fieldId":"draft","split":"sentences","index":0,"prefix":"第1句："}}}}
```

| binding 字段 | 作用 |
|---|---|
| `taskId`、`stepId`、`toolId` | 指定来源任务、小步和工具 |
| `fieldId` | 读取文字表单中的字段 |
| `property` | 读取其他工具结果属性，例如团队记录的`entries` |
| `split` | 当前支持`sentences`，按句号、问号、分号或换行切分 |
| `index` | 读取切分后的第几个片段，从`0`开始 |
| `prefix` | 显示在动态内容前的文字 |

不要配置`mode`、`connections`、`categories`或`minimumItems`。当前拼合工具统一使用“卡片库＋区域”界面，这些字段不会改变交互。

### 6.8 `simulation`：沙盘推演

```markdown
- 功能模块：A04(沙盘推演)
- 工具参数：{"simulation":{"rounds":2,"allowRepeat":false,"prompt":"运行两个不同方案，比较系统压力。","roundPrompts":["第1轮：建立基线。","第2轮：换一种情景比较。"],"resources":{"排水能力":"固定","上游来水":"随降雨增加"},"choices":[{"id":"normal","label":"常规降雨","publicFeedback":"系统保持稳定。","effects":{"pressure":1,"risk":0}},{"id":"storm","label":"暴雨","publicFeedback":"系统压力明显增加。","effects":{"pressure":4,"risk":3}}],"metrics":[{"id":"pressure","label":"系统压力","initial":0,"initialLabel":"待运行"},{"id":"risk","label":"溢流风险","initial":0,"initialLabel":"待运行"}]}}
```

| 字段 | 类型 | 必填 | 作用 |
|---|---|---:|---|
| `rounds` | integer | 否 | 推演轮数，默认`1` |
| `allowRepeat` | boolean | 否 | 是否允许不同轮次重复选择同一方案 |
| `prompt` | string | 否 | 总体推演提示 |
| `roundPrompts` | string[] | 否 | 每轮单独提示，顺序对应轮次 |
| `resources` | object | 否 | 资源名称及当前数量或状态 |
| `choices` | object[] | 是 | 可选方案 |
| `metrics` | object[] | 否 | 结果指标 |

每个`choice`支持：

| 字段 | 类型 | 必填 | 作用 |
|---|---|---:|---|
| `id` | string | 是 | 方案稳定标识 |
| `label` | string | 是 | 方案名称 |
| `publicFeedback` | string | 否 | 运行后显示的结果说明 |
| `effects` | object | 否 | 指标增减值；键必须对应`metrics.id`，值为数字 |

每个`metric`支持`id`、`label`、`initial`和`initialLabel`。学生端显示资源摘要、指标卡、方案按钮、“运行第 N 轮”和推演历史。完成条件是运行足够轮次；`allowRepeat:false`时每轮必须选择不同方案。

不要配置`mode`、`axes`、`budget`、`dimensions`、`minimumItems`、`scenarios`或`variables`。当前界面只消费本节列出的轮次、资源、选择和指标。

### 6.9 `team`：团队协作记录

```markdown
- 功能模块：A05(讨论记录)
- 工具参数：{"team":{"prompt":"记录一条观察结论和一条待核问题。","minimumEntries":2,"roles":["观察员","核验员","记录员"],"recordTypes":["观察结论","待核问题","修订意见"],"requiredRecordTypes":["观察结论","待核问题"]}}
```

| 字段 | 类型 | 必填 | 默认值 | 作用 |
|---|---|---:|---|---|
| `prompt` | string | 否 | 平台提示 | 记录要求 |
| `minimumEntries` | integer | 否 | `1` | 最少记录条数 |
| `roles` | string[] | 否 | 空 | 要求每条记录选择贡献角色 |
| `recordTypes` | string[] | 否 | 空 | 可选择的记录类型 |
| `requiredRecordTypes` | string[] | 否 | 空 | 完成前必须至少出现一次的记录类型，必须来自`recordTypes` |

学生端显示角色下拉框、记录类型下拉框、文字输入和记录列表。配置`roles`后每条记录必须选择角色；配置`requiredRecordTypes`后必须覆盖规定类型。

当前工具保存的是本学生会话中的团队记录，不提供多台设备实时共同编辑。不要配置`mode`、`options`或`recordMinorityOpinion`；投票、听证、核验等语义写进`prompt`、`recordTypes`和`requiredRecordTypes`。

### 6.10 `media`：沉浸媒体

真实视频示例：

```markdown
- 功能模块：A06(视频)
- 工具参数：{"media":{"type":"video","url":"assets/videos/opening.mp4","poster":"assets/videos/opening.jpg","title":"暴雨将至","prompt":"观看材料后记录你最关注的现象。","requireCompletion":true}}
```

只有静态情境图时使用显式`posterOnly`契约：

```markdown
- 功能模块：A06(情境图)
- 工具参数：{"media":{"type":"video","poster":"assets/videos/opening.jpg","posterOnly":true,"title":"暴雨将至","prompt":"查看情境图后继续。","requireCompletion":true}}
```

| 字段 | 类型 | 必填 | 作用 |
|---|---|---:|---|
| `type` | enum | 是 | `image`、`audio`或`video` |
| `url` | string | 图片/音频/真实视频必填 | 媒体文件路径 |
| `poster` | string | 否 | 视频封面；`posterOnly:true`时必填 |
| `posterOnly` | boolean | 否 | 只展示静态情境图；仅允许`type:"video"`、无`url`且有`poster` |
| `title` | string | 否 | 媒体标题 |
| `prompt` | string | 否 | 查看要求 |
| `requireCompletion` | boolean | 否 | 是否必须点击完成，默认`true` |

学生端根据`type`显示图片、音频播放器或视频播放器，并显示“我已看完”按钮。`posterOnly`显示静态情境图和“我已查看情境图”。当前完成规则记录学生的确认操作，不检测实际播放百分比。

要求完成的媒体必须提供可用`url`，或满足完整的`posterOnly`条件；否则课程校验报错，学生无法完成。

### 6.11 `scanner`：扫码与实物识别

二维码示例：

```markdown
- 功能模块：A07(扫码)
- 工具参数：{"scanner":{"mode":"qr","prompt":"扫描展项旁的课程二维码。","expectedResults":["DRAIN-01","DRAIN-02"],"allowManualEntry":true}}
```

实物图像示例：

```markdown
- 完成方式：ai_evaluation
- 功能模块：A07(实物识别)
- 工具参数：{"scanner":{"mode":"object","prompt":"拍摄展项主体，交由 AI 按本步验收标准核验。","allowManualEntry":false}}
```

| 字段 | 类型 | 必填 | 默认值 | 作用 |
|---|---|---:|---|---|
| `mode` | enum | 否 | `qr` | `qr`识别课程码；`object`采集实物图像 |
| `prompt` | string | 否 | 平台提示 | 扫描或拍摄要求 |
| `expectedResults` | string[] | 二维码需要限制结果时填写 | 空 | 允许通过的码值，只在服务端保存 |
| `allowManualEntry` | boolean | 否 | `true` | 识别失败时是否允许手动输入码值 |

`qr`模式调用浏览器条码识别能力，支持时识别二维码、Code 128和EAN-13；识别失败可按配置手动输入。学生端显示拍摄入口、预览图、手动输入和识别结果。

`object`模式只负责采集图像，必须配`完成方式：ai_evaluation`、明确的`证据要求`和`##### 验收标准`，由 AI 判断对象是否符合要求。`expectedResults`只用于码值，不用于实物识别。

### 6.12 当前禁止使用的无效字段

以下字段会被当作普通 JSON 数据保留，但当前没有对应的学生端交互或验收消费者。课程包不要填写：

| 工具 | 不要填写 |
|---|---|
| `photo` | `recognition` |
| `audio` | `language`、`transcribe` |
| `quiz` | `explanation` |
| `builder` | `mode`、`connections`、`categories`、`minimumItems` |
| `simulation` | `mode`、`axes`、`budget`、`dimensions`、`minimumItems`、`scenarios`、`variables` |
| `team` | `mode`、`options`、`recordMinorityOpinion` |

如果课程需要这些能力，应先在平台工具实现和校验器中增加明确消费者，再更新本规范；不要通过自定义 JSON 键模拟尚未实现的功能。

## 7. `prompts/phaseN-*.md`：Phase 提示规则

每个 Phase 必须有且只有一份 Prompt。文件名使用`phaseN-<slug>.md`，N 必须与`course.md / ### Phase N`的编号完全一致，`slug`使用小写英文、数字和连字号。

文件必须且只能包含以下五个二级标题，顺序固定：

````markdown
## 阶段目标
学生在本阶段要形成什么认识或成果。

## 絮絮行为
- 应如何提问、反馈和组织对话。

## 开场白模板
```text
进入本阶段时向学生显示的完整开场白。
```

## 禁止行为
- 本阶段不能做什么、不能提前说什么。

## 转场条件
- 达到什么状态时可以提示学生等待教师推进。
````

| 二级标题 | 类型 | 必填 | 内容要求 | 实际作用 |
|---|---|---:|---|---|
| `阶段目标` | Markdown string | 是 | 说明学生在本阶段应形成的认识或成果，不超过 5 条 | 进入该 Phase 的主 AI 上下文 |
| `絮絮行为` | Markdown list | 是 | 使用“应……”说明提问、反馈、组织方式 | 进入该 Phase 的主 AI 上下文 |
| `开场白模板` | multiline string（多行字符串） | 是 | 一段学生可直接阅读的完整话术；可放在`text`代码围栏中 | 学生首次进入该 Phase 时原样显示一次，不调用主模型，刷新不重复 |
| `禁止行为` | Markdown list | 是 | 只写本阶段特有的剧透、替代学生或越权边界 | 进入该 Phase 的主 AI 上下文；平台安全规则仍保持最高优先级 |
| `转场条件` | Markdown list | 是 | 说明 AI 什么时候可以说“本阶段已就绪，请等待教师” | 只约束 AI 转场话术；真实 Phase 推进由教师端执行 |

`开场白模板`支持`{角色名}`、`{首个地点}`和`{学生名字}`三个占位符。平台会去掉代码围栏和`###`标记，保留内部标题文字和换行。

不要增加`角色行为差异`、`关键提示词`、`流程`或其他二级标题。角色差异写进对应角色的 Task／Step，具体提示写进就地`引导`和`脚手架`。
文件从`## 阶段目标`直接开始，不要增加 H1 标题或开头引用，这些文字不进入结构化 Phase Policy（阶段策略）。

## 8. `knowledge/*.md`：课程知识

每个知识文件可包含多个知识条目。字段名严格使用下列英文，不要翻译：

```markdown
## K-01 条目标题
- topic：排水构造
- content：供 AI 检索的一条可核验事实、方法或边界。
- tags：排水, 结构, 现场观察
- source：出版物、官方展签、数据库或可追溯链接
- roles：角色中文名称, 另一个角色中文名称
- revealWhen：phase-2
```

| 字段 | 类型 | 必填 | 合法值／格式 | 实际作用 |
|---|---|---:|---|---|
| H2 中的 id | id | 是 | `K-01`、`K-02`……，全课知识条目全局唯一 | Step `知识引用`和检索的稳定键 |
| H2 中的标题 | string | 是 | 简短、可检索的知识名称 | AI 引用标题 |
| `topic` | string | 是 | 一个主题短语 | 语义检索字段 |
| `content` | string | 是 | 必须写在同一行；一条可核验事实、方法或解释边界 | AI 实际可检索的私有知识正文 |
| `tags` | string[] | 是 | 中英文逗号分隔的检索词 | 检索匹配 |
| `source` | string | 是 | 可追溯来源名；有公开页面时可包含 URL | AI 回答的来源引用信息 |
| `roles` | string[] | 否 | 剥离 emoji 后的角色 H1 纯文本名，或单独写`全角色共享`；逗号分隔；缺省即`全角色共享` | 检索角色可见性；不使用 role id |
| `revealWhen` | enum-like string | 是 | `always`、`after_taskN`或`phase-N` | 最早可检索时机 |

`after_taskN`表示当前角色的第 N 个 Task 完成后可用；`phase-N`表示进入 Phase N 后可用（与阶段 id 同一拼法；旧写法`phase_N`运行时仍兼容，但新课程不要再用）。不要写自然语言条件、括号补充或未列出的别名。

两处静默失败警告：

- 字段名只认`revealWhen`。旧课程使用的`revealTiming`是历史别名（解析器兼容、正在迁移），新课程不要使用。
- 条件值必须严格是上述三种枚举之一。无法匹配的条件**不会报错**，该知识会永久不可见；同理`content_always_available`这类写法会被宽松地当成`always`（后半段条件失效）。提交前逐条核对拼写。

课程答案、可检索事实和解释边界集中写在知识条目中，不要重复写进角色基本信息。

## 9. `evaluation.md`：全课验收兜底

`evaluation.md`是可选的服务端私有 Prompt 文档。Task 或 Step 已写`##### 验收标准`时，就地标准优先；只有就地标准缺失时，AI 验收才读取本文件整份正文作为兜底。

```markdown
# 课程评估规范

## 评估原则
- 证据优先于结论完整度。
- 允许带边界的暂定结论。

## 通用量规
| 维度 | 达标表现 | 需要修订 |
|---|---|---|
| 证据 | 来源清楚且与主张对应 | 只有结论或来源不明 |
```

| 区块 | 必填 | 内容要求 |
|---|---:|---|
| H1 标题 | 是 | 固定用途说明，例如`课程评估规范` |
| `## 评估原则` | 是 | 3—6 条全课通用的证据、推理、表达与修订原则 |
| `## 通用量规` | 是 | 三列表格`维度 \| 达标表现 \| 需要修订`；每个维度都必须可观察 |

AI 完成方式已用到的每个 Step 都应写就地`##### 验收标准`。课程已完全做到就地验收时，可以不提交`evaluation.md`。不要在 Step 中写`评估引用`，该字段不会定向切片本文件。

## 10. `time-bank.md`：时间银行

时间银行是可选课程机制，独立于角色任务进度。它只更新可赚取和赠送的时间余额，不推进 Task 或 Step。不需要这个机制时，不提交`time-bank.md`。

本文件使用严格的英文 snake_case（下划线命名）字段和英文冒号。设置项不加列表符号；任务以`- id:`开始，其余字段缩进两个空格。

```markdown
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

## 任务池

- id: tb-01
  type: quiz
  question: "题目正文"
  options: [选项A, 选项B, 选项C]
  answer: 选项A
  reward: 2min
  unlock_after: phase-2-start
  hint: "答错后的一条提示"
```

`任务池`下直接连续写任务记录。不要增加“快问快答类”、“拍照打卡类”等子标题，它们不是时间银行数据字段。文件也不需要 H1 标题或开头引用。

基本与赠送字段：

| 字段 | 类型 | 必填 | 合法值／默认 | 实际作用 |
|---|---|---:|---|---|
| `enabled` | boolean | 是 | `true`、`false` | 时间银行入口总开关 |
| `initial_balance` | number + unit | 是 | 非负数 + `min`，建议`0min` | 学生初始时间余额 |
| `currency_unit` | string | 是 | 当前统一写`分钟` | 学生端余额和奖励单位文案 |
| `max_earn_total` | number + unit | 是 | 正数 + `min` | 每名学生全课最多赚取数 |
| `max_earn_per_task` | number + unit | 是 | 正数 + `min`，不得大于`max_earn_total` | 单个时间银行任务奖励上限 |
| `tasks_visible_at_once` | integer | 是 | 大于等于`1`，建议`3` | “赚取”页同时展示的未完成任务数 |
| `allow_gift_to_self` | boolean | 是 | 建议`false` | 是否把当前角色也列为赠送目标 |
| `max_gift_per_action` | number + unit | 是 | 正数 + `min` | 一次赠送上限 |
| `min_gift_amount` | number + unit | 是 | 正数 + `min`，应整除赠送上限 | 赠送按钮的最小值和递增步长 |

任务公共字段：

| 字段 | 类型 | 必填 | 合法值／格式 | 实际作用 |
|---|---|---:|---|---|
| `id` | id | 是 | 只允许`tb-01`、`tb-02`……，全文唯一 | 完成记录的稳定键 |
| `type` | enum | 是 | `quiz`、`photo_checkpoint`、`location_checkin` | 选择学生端题型 |
| `question` | string | `quiz`必填 | 单行题目 | 学生端任务标题 |
| `description` | string | 拍照／定位必填 | 单行可执行指令 | 学生端任务标题 |
| `hint` | string | 否 | 一条不直接泄露答案的提示 | 答错或任务卡的提示 |
| `reward` | number + unit | 是 | 正数 + `min`，不得超过`max_earn_per_task` | 完成后增加的时间余额 |
| `unlock_after` | enum-like string | 是 | `phase-N-start`，例如`phase-2-start`；N 必须是本课已定义 Phase | 题目最早显示 Phase |

`quiz`额外字段：

| 字段 | 类型 | 必填 | 要求 |
|---|---|---:|---|
| `options` | scalar[]（标量数组） | 客观题必填 | 单行方括号列表，例如`[甲, 乙, 丙]` |
| `answer` | scalar | 客观题必填 | 必须与某个`options`完全一致；服务端严格字符串比对 |
| `answer_type` | enum | 开放题必填 | 只允许`open_ended` |
| `min_length` | integer | 开放题必填 | 最少回答字符数，大于等于`1` |

`photo_checkpoint`额外字段：

| 字段 | 类型 | 必填 | 合法值 | 真实验收 |
|---|---|---:|---|---|
| `verify` | enum | 是 | `image_recognition`、`image_and_text` | `image_recognition`当前只验证已上传一张图片；`image_and_text`还要求至少 4 个字的说明 |

`image_recognition`这个名称目前不代表真实图像内容识别。如果课程必须确认照片中的对象，请把该活动放进正式 Step，使用`photo` + `ai_evaluation`或`teacher_confirm`。

`location_checkin`额外字段：

| 字段 | 类型 | 必填 | 要求 |
|---|---|---:|---|
| `location` | coordinate | 是 | GCJ-02，方括号内`经度, 纬度`，例如`[116.397000, 39.918000]` |
| `radius` | number + unit | 是 | 正整数 + `m`，例如`30m` |

`answer`、`verify`、`location`和`radius`只在服务端保留，不会下发学生浏览器。不要填写`maxBalance`、`correct_answer`、`photo_checkin`、`location_checkin`、`allowGift`或`gift_target`；这些写法没有对应的当前课程配置消费者。

## 11. 素材引用

`assets/`中只放本课运行会实际加载的素材。目录名是语义分类，真实用途由 Markdown 字段引用决定。

| 目录 | 放什么 | 由哪个字段引用 | 学生端用途 |
|---|---|---|---|
| `assets/backgrounds/` | 课程封面 | `course.md / 课程封面` | 课程入口封面 |
| `assets/maps/` | 静态导航示意图、画板底图 | `course.md / 导航地图`或`sketch.backgroundImage` | 小组页示意图或可标注底图；不参与 GPS／高德定位 |
| `assets/roles/` | 角色卡、角色徽章 | 角色`角色卡图`、`角色徽章图` | 角色选择、对话头像和小组页 |
| `assets/tasks/` | 任务卡图片、工具参考图 | Task `任务图`或工具资产字段 | 任务卡、拍照参考图等 |
| `assets/tokens/` | 角色完成后的收集物图片 | 角色`收集物图` | 奖励卡和小组收集页；这里的 token 是“奖励物”，与鉴权无关 |
| `assets/videos/` | 图片、音频、视频和静态海报 | `media.url`、`media.poster`、`course.md / 导入占位图` | 沉浸媒体工具 |

素材文件契约：

| 项目 | 要求 |
|---|---|
| 路径 | Markdown 和 JSON 中都写从`assets/`开始的相对路径；解析器兼容省略前缀的旧写法（存量课程迁移中），新课程一律带前缀 |
| 文件名 | 小写英文、数字和连字号；不含空格，不使用`最终版`、`新`、日期等临时词 |
| 图片格式 | `.webp`、`.png`、`.jpg`、`.jpeg`或`.svg`；照片优先 WebP/JPEG，需透明背景使用 PNG/WebP |
| 音频格式 | `.mp3`、`.m4a`或`.wav`；优先 MP3/M4A |
| 视频格式 | `.mp4`或`.webm`；优先 H.264 MP4 |
| 安全 | 不得包含未解锁答案、个人隐私、无授权人脸或不安全操作示范 |
| 完整性 | 引用路径大小写与实际文件完全一致；未被任何字段引用的素材应删除 |

只在需要展示一张人工设计的课程示意图或画板底图时增加`assets/maps/`。真实地点导航与教师实时地图只需配置坐标，无需制作静态 map 图片。

## 12. 提交前验证

在仓库根目录运行：

```bash
npm run lint:lesson --workspace 4-stu-learning -- --strict
npm test
npm run build
```

发布门禁：

- 该课程能完整编译，且 strict lint 为 0 error / 0 warning。
- `系列`、`系列代码`和`主题模板`是本规范列出的同一组固定配对。
- `场地`可在高德搜索，`坐标中心`和所有任务坐标都是 GCJ-02 的`经度, 纬度`。
- 课程时长、Phase 时长和 Task／Step 时长都带明确单位，且各自符合本文约束；任务级时长只使用`秒`／`分钟`／`小时`（不写`min`、`课时`、`天`、`周`）。
- 所有 Phase 编号从 1 连续递增，每个 Phase 恰好对应一份 Prompt。
- 所有 Role／Task／Step／Knowledge／Time Bank id 在各自作用域内唯一，引用目标都存在。
- 每个角色至少有一个 Task；每个 Task 都有显式 Step。
- 每个 Step 的`完成方式`与位置、工具、证据和教师介入字段互相一致；AI 验收 Step 有证据要求和就地验收标准。
- 任务只使用本文列出的位置模式、推进方式、收口方式和完成方式。
- 知识条目只使用`revealWhen`字段，条件值只使用`always`／`after_taskN`／`phase_N`三种枚举。
- 所有知识引用、限制引用、任务图片和工具素材路径可解析。
- 每份 Phase Prompt 只有五个标准二级标题，且开场白非空。
- `工具参数`是标准 JSON，只使用第 6 节列出的字段，工具类型、字段必填性和 Step `完成方式`一致。
- 时间银行只使用 snake_case 字段，题目 id 为`tb-NN`，奖励不超过单题和全课上限。
- `assets/`中没有未引用素材，也没有引用了但缺失的文件。
- 构建后的学生端课程包可以渲染课程入口、角色选择、任务卡和工具卡。

## 附录 A：字段 → 消费点对照表

下表只列进入实际运行流程的字段。发布校验字段和课程目标记录已在对应章节说明。

| 字段 | 层级 | 消费点 | 状态 |
|---|---|---|---|
| `id` | Task／Step | 进度、工具实例和事件记录 | **生效** |
| Phase `名称／时长／模式／地点` | Phase | 顶栏、倒计时和阶段组织上下文 | **生效** |
| `prompts/phaseN-*.md` | Phase | Phase AI 规则与首次开场 | **生效** |
| `配置／通过条件` | Task | 任务卡说明与 AI 验收上下文 | **生效** |
| `收口方式` | Task | 最后一个 Step 后的任务完成状态机 | **生效** |
| `推进方式` | Task | 任务完成后的推进控制 | **生效** |
| `任务图` | Task | 任务卡配图 | **生效** |
| `位置模式／位置／地点／坐标／围栏半径／最短停留／到达验证` | Task／Step | 位置门禁与到达判定 | **生效** |
| `建议时长／无操作提醒／提醒冷却／最大主动提醒` | Task | 时长提示与主动提醒节奏 | **生效** |
| `功能模块／工具参数` | Task／Step | 活动工具实例化与校验 | **生效** |
| `小步目标／学生行动／证据要求` | Step | 任务卡、对话上下文和验收 | **生效** |
| `完成方式` | Step | Step 验收路径 | **生效** |
| `最大尝试` | Step | AI 验收尝试计数与教师审核入口 | **生效** |
| `知识引用` | Step | 定向知识检索 | **生效** |
| `限制引用` | Step | 精确限制片段与防剧透 | **生效** |
| `AI引导方向` | 阶段任务 | 阶段任务的对话引导 | **生效** |
| `##### 引导` | Task／Step | 当前任务或小步的引导方向 | **生效** |
| `##### 脚手架` | Task／Step | 当前 L 档具体提示 | **生效** |
| `##### 验收标准` | Task／Step | AI 阅卷标准 | **生效** |
| `常见误区` | Step | 当前小步对话上下文 | **生效** |
| `前置` | 角色 Task | 任务图门禁 | **生效** |
| `#### 阶段任务N` | Phase | 选择角色前的入口任务轨道 | **生效** |
| `通过后：role-stage:<id>` | Step | 角色任务图出边与下一任务 | **生效** |
