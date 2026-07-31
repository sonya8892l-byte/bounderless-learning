# ♟️ 决策参谋

> 核心问题：多数人支持一个方案时，怎样保护有证据的不同意见并共同承担决定？

## 基本信息
- 排序：3
- 地点：遵义会议与苟坝会议专题展陈区
- 地理围栏：中国共产党历史展览馆课程动线内
- 类型：核心角色
- 选择说明：负责还原方案分歧，比较收益、风险、信息可靠度和可逆性，记录决定如何形成与修正。
- 角色卡图：assets/roles/role-card-decision-strategist.png
- 角色徽章图：assets/roles/badge-decision-strategist.png
- 收集物：决策层
- 收集物图：assets/tokens/layer-decision.png
- 关键数据：遵义会议与苟坝会议体现了根据实际调整决策和改进军事指挥机制的过程

## 任务列表

### 任务1：列方案
- id：task-1
- 阶段：Phase 2 展陈采证
- 地点：
- 位置模式：inherit_role
- 坐标：
- 围栏半径：
- 到达验证：manual
- 最短停留：0min
- 建议时长：15min
- 无操作提醒：3min
- 提醒冷却：2min
- 最大主动提醒：2
- 推进方式：auto_after_validation
- 功能模块：A01(拍照采集), A02(表单)
- 任务图：assets/tasks/decision-matrix.svg
- 配置：拍摄至少1处允许拍摄的会议相关展项说明；从材料中提取2个待比较方案或意见，记录提出背景、支持理由、反对理由和材料来源
- 通过条件：至少1张来源照片 + 2个方案条目 + 每个方案含支持与反对理由
- 目标关联：K5(遵义与苟坝), S3(史料实证), S5(决策矩阵)
- AI引导方向：只协助整理材料中出现的意见，不提前给出会议结果或给人物贴对错标签

#### Step 1：拍下方案来源

- id：decision-capture-source
- 小步目标：获得能够追溯会议背景和不同意见的现场材料
- 学生行动：拍摄一张会议相关展项及其说明牌，确保方案背景或讨论对象可以辨认
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少1张有效照片，同时保留展项主体和标题或说明；不得拍入其他参观者正脸
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"minCount":1,"maxCount":3,"accept":"image/*","recognition":"meeting-options-source","prompt":"把会议展项与说明牌一起拍下，优先保留讨论背景和材料来源。"}}
- 知识引用：K-16
- 引导引用：guidance/decision-strategist.md#任务1
- 限制引用：restrictions.md#苟坝会议结论
- 评估引用：evaluation.md#K5, evaluation.md#S3
- 脚手架引用：scaffolds/decision-strategist.md#任务1
- 常见误区：只拍人物照片或场景复原，无法确认材料中讨论的具体问题
- 最大尝试：3
- 失败处理：指出照片缺少展项主体、讨论对象或来源中的哪一项，请学生补拍
- 教师介入：展馆禁止拍摄，或连续3次无法取得可辨认来源
- 通过后：step:decision-build-options

#### Step 2：建立两个方案条目

- id：decision-build-options
- 小步目标：忠实整理材料中出现的两个待比较方案或意见
- 学生行动：分别填写方案A和方案B的背景、主张及材料来源；材料没有说明的内容写“未知”
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：两个方案均包含名称或中性转述、提出背景和来源；不使用没有可靠出处的直接引语
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"option-a","label":"方案A：中性转述","type":"long_text","required":true,"placeholder":"材料中明确出现的意见；不要添加人物原话"},{"id":"context-a","label":"方案A：提出背景","type":"short_text","required":true},{"id":"source-a","label":"方案A：来源","type":"short_text","required":true,"placeholder":"展项标题或照片编号"},{"id":"option-b","label":"方案B：中性转述","type":"long_text","required":true},{"id":"context-b","label":"方案B：提出背景","type":"short_text","required":true},{"id":"source-b","label":"方案B：来源","type":"short_text","required":true}]}}
- 知识引用：K-16
- 引导引用：guidance/decision-strategist.md#任务1
- 限制引用：restrictions.md#决策与结果限制, restrictions.md#史料与表达限制
- 评估引用：evaluation.md#K5, evaluation.md#S3, evaluation.md#C3
- 脚手架引用：scaffolds/decision-strategist.md#任务1
- 常见误区：先认定谁正确，再把材料改写成支持既定结论的直接引语
- 最大尝试：3
- 失败处理：标出缺少中性转述、背景或来源的方案条目，保留已有内容后补充
- 教师介入：学生无法从展项中辨认两个意见，或材料本身只呈现单一方案
- 通过后：step:decision-balance-reasons

#### Step 3：检查正反理由

- id：decision-balance-reasons
- 小步目标：理解比较方案时需要同时保存支持和反对理由
- 学生行动：选择最适合进入下一阶段风险比较的记录方式
- 位置：none
- 完成方式：tool_result
- 证据要求：正确选择同时记录两个方案的支持理由、反对理由和来源的做法
- 功能模块：A02(单选答题)
- 工具参数：{"quiz":{"type":"single_choice","question":"怎样整理两个方案，才能进入公平的风险比较？","options":["只记录多数人支持方案的优点","给每个方案分别记录支持理由、反对理由和材料来源","先看后来结果，再删除失败方案的合理理由"],"answer":"给每个方案分别记录支持理由、反对理由和材料来源","explanation":"风险比较需要对两个方案使用相同结构，并保留当时材料中的正反理由。","retryMessage":"再想想：两个方案需要接受相同维度的检查，后来结果不能替代当时证据。"}}
- 知识引用：K-16, K-17
- 引导引用：guidance/decision-strategist.md#任务1
- 限制引用：restrictions.md#苟坝会议结论
- 评估引用：evaluation.md#S3, evaluation.md#S5, evaluation.md#C4
- 脚手架引用：scaffolds/decision-strategist.md#任务1
- 常见误区：用支持人数代替理由质量，或删除后来没有采用的方案依据
- 最大尝试：2
- 失败处理：提示学生检查两个方案是否使用了同一套记录字段后重选
- 教师介入：连续2次仍以人物或人数作为唯一判断依据
- 通过后：role-stage:task-2

### 任务2：比风险
- id：task-2
- 阶段：Phase 2 展陈采证
- 地点：
- 位置模式：inherit_role
- 坐标：
- 围栏半径：
- 到达验证：manual
- 最短停留：0min
- 建议时长：15min
- 无操作提醒：3min
- 提醒冷却：2min
- 最大主动提醒：2
- 推进方式：auto_after_validation
- 功能模块：A04(沙盘推演), A02(表单)
- 任务图：assets/tasks/decision-matrix.svg
- 配置：为每个方案评估目标一致度、证据可靠度、成功收益、失败代价和可逆性；保留至少1条少数意见并写明复核办法
- 通过条件：完成2个方案的五维比较 + 1条少数意见保护机制 + 小组提交阶段选择
- 目标关联：K5(遵义与苟坝), S5(决策矩阵), C1(实事求是), C4(民主与担当)
- AI引导方向：追问“如果这一判断错了，代价能否承受”，完成前不揭示史实结论

#### Step 1：完成五维比较

- id：decision-score-options
- 小步目标：用同一套维度比较两个方案的收益、风险和信息质量
- 学生行动：分别为方案A、方案B填写目标一致度、证据可靠度、成功收益、失败代价和可逆性，并给出一句评分依据
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：两个方案的五个维度均完成；每个方案至少引用1条任务1材料；分数或高低判断附带理由
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"a-goal","label":"方案A｜目标一致度及依据","type":"short_text","required":true,"placeholder":"高/中/低 + 依据"},{"id":"a-reliability","label":"方案A｜证据可靠度及依据","type":"short_text","required":true},{"id":"a-benefit","label":"方案A｜成功收益","type":"short_text","required":true},{"id":"a-cost","label":"方案A｜失败代价","type":"short_text","required":true},{"id":"a-reversible","label":"方案A｜可逆性","type":"short_text","required":true},{"id":"b-goal","label":"方案B｜目标一致度及依据","type":"short_text","required":true},{"id":"b-reliability","label":"方案B｜证据可靠度及依据","type":"short_text","required":true},{"id":"b-benefit","label":"方案B｜成功收益","type":"short_text","required":true},{"id":"b-cost","label":"方案B｜失败代价","type":"short_text","required":true},{"id":"b-reversible","label":"方案B｜可逆性","type":"short_text","required":true}]}}
- 知识引用：K-13, K-17
- 引导引用：guidance/decision-strategist.md#任务2
- 限制引用：restrictions.md#苟坝会议结论
- 评估引用：evaluation.md#S5, evaluation.md#C1, evaluation.md#C4
- 脚手架引用：scaffolds/decision-strategist.md#任务2
- 常见误区：给出分数却没有证据，或对偏爱的方案使用更宽松的标准
- 最大尝试：3
- 失败处理：指出缺少维度或证据依据的一个方案，请学生只补该部分
- 教师介入：小组对评分标准持续争执，无法使用同一维度比较
- 通过后：step:decision-test-failure

#### Step 2：测试错误前提

- id：decision-test-failure
- 小步目标：检验关键判断出错时两个方案的失败代价和调整空间
- 学生行动：运行两轮风险测试：一轮假设敌情判断错误，一轮假设行动窗口已经变化
- 位置：none
- 完成方式：tool_result
- 证据要求：完成2轮不同风险测试；每轮选择一个应对方案，保留失败代价和是否还能调整的记录
- 功能模块：A04(沙盘推演)
- 工具参数：{"simulation":{"rounds":2,"allowRepeat":false,"prompt":"用两个不同方案检验失败代价、调整空间和证据可靠度。","roundPrompts":["第1轮：假设一项敌情判断有误，选择应对方式。","第2轮：假设行动窗口缩短，改选另一方案继续检验。"],"resources":{"候选方案":2,"复核机会":1},"choices":[{"id":"continue-a","label":"继续方案A并设置复核点","publicFeedback":"请检查复核点出现前的失败代价是否能够承受。","effects":{"risk":1,"reversible":1}},{"id":"continue-b","label":"继续方案B并设置退出条件","publicFeedback":"请检查退出条件是否清楚，以及何时重新讨论。","effects":{"risk":1,"reversible":2}},{"id":"pause-review","label":"暂缓决定，先补充关键证据","publicFeedback":"补证据会消耗窗口；请比较延误风险与错误行动风险。","effects":{"time":-1,"reliability":2}}],"metrics":[{"id":"risk","label":"失败代价","initial":0,"initialLabel":"待评估"},{"id":"reversible","label":"调整空间","initial":0,"initialLabel":"待评估"},{"id":"time","label":"时间变化","initial":0,"initialLabel":"待评估"},{"id":"reliability","label":"证据可靠度","initial":0,"initialLabel":"待评估"}]}}
- 知识引用：K-13, K-17
- 引导引用：guidance/decision-strategist.md#任务2
- 限制引用：restrictions.md#苟坝会议结论
- 评估引用：evaluation.md#S5, evaluation.md#C1, evaluation.md#C4
- 脚手架引用：scaffolds/decision-strategist.md#任务2
- 常见误区：只运行有利于偏爱方案的情形，不检验前提出错或窗口消失
- 最大尝试：3
- 失败处理：提示第二轮更换风险情境，比较失败代价和可逆性
- 教师介入：学生把沙盘输出当作历史会议结论，或无法形成任何风险分支
- 通过后：step:decision-record-team-decision

#### Step 3：记录小组决定与异议

- id：decision-record-team-decision
- 小步目标：形成可执行的阶段选择，同时保护有证据的少数意见
- 学生行动：组内讨论后至少记录两条内容：阶段选择与理由、少数意见及其复核条件
- 位置：none
- 完成方式：tool_result
- 证据要求：至少2条组内记录；一条明确小组阶段选择和依据，一条保留不同意见、核验办法或重新讨论触发点
- 功能模块：A05(团队投票与异议记录)
- 工具参数：{"team":{"mode":"vote","prompt":"先记录小组选择及证据，再单独记录少数意见、复核办法和重新讨论条件；不要把课程投票写成历史事实。","minimumEntries":3,"roles":["记录人","复核人","风险提醒人"],"recordTypes":["小组选择与证据","少数意见","复核或重议条件"],"requiredRecordTypes":["小组选择与证据","少数意见","复核或重议条件"]}}
- 知识引用：K-17
- 引导引用：guidance/decision-strategist.md#任务2
- 限制引用：restrictions.md#苟坝会议结论, restrictions.md#教学限制
- 评估引用：evaluation.md#C4, evaluation.md#协作维度
- 脚手架引用：scaffolds/decision-strategist.md#任务2
- 常见误区：只记录多数选择，省略少数意见、风险证据和复核条件
- 最大尝试：3
- 失败处理：提醒小组补齐“选择依据”或“少数意见复核”中的缺失记录，不替小组裁决
- 教师介入：投票平局、讨论冲突持续，或少数成员无法表达意见
- 通过后：role-stage:task-3

### 任务3：复决策
- id：task-3
- 阶段：Phase 2 展陈采证
- 地点：
- 位置模式：inherit_role
- 坐标：
- 围栏半径：
- 到达验证：manual
- 最短停留：0min
- 建议时长：15min
- 无操作提醒：3min
- 提醒冷却：2min
- 最大主动提醒：2
- 推进方式：auto_after_validation
- 功能模块：A01(文字输入), A02(反思表单)
- 任务图：assets/tasks/decision-matrix.svg
- 配置：阅读本轮开放的课程复核材料后，写出原方案保留、修改或放弃的部分；用“新证据—判断变化—责任安排”完成复盘
- 通过条件：三段式复盘完整 + 引用至少2条证据 + 明确1项统一行动安排
- 目标关联：K5(遵义与苟坝), S6(因果表达), C1(实事求是), C4(民主与担当)
- AI引导方向：让学生说明改变的证据与责任安排，避免把少数意见自动视为正确答案

#### Step 1：读取新增材料

- id：decision-read-new-evidence
- 小步目标：在任务2完成后获得用于复盘的新增课程推演材料
- 学生行动：完整查看本轮开放的课程复核卡，找出一条能够改变原判断的新信息
- 位置：none
- 完成方式：tool_result
- 证据要求：完成材料查看；明确区分“课程推演信息”和“历史知识”，不把课程情境改写成历史人物直接引语
- 功能模块：A06(沉浸媒体)
- 工具参数：{"media":{"type":"image","url":"assets/tasks/decision-review-card.svg","title":"本轮新增课程材料｜复核与决策机制","requireCompletion":true,"prompt":"材料在任务2完成后开放。阅读时寻找改变原方案前提的新信息，并保留课程推演标识。"}}
- 知识引用：K-17, K-18
- 引导引用：guidance/decision-strategist.md#任务3
- 限制引用：restrictions.md#苟坝会议结论
- 评估引用：evaluation.md#K5, evaluation.md#C1
- 脚手架引用：scaffolds/decision-strategist.md#任务3
- 常见误区：把课程推演卡当成历史原件，或只记结论而忽略复核依据和决定形成过程
- 最大尝试：2
- 失败处理：重新显示材料，并提示学生只找“改变了哪个前提”的一句证据
- 教师介入：材料无法加载，或学生对史料来源提出需要现场核验的问题
- 通过后：step:decision-compare-version

#### Step 2：整理判断变化

- id：decision-compare-version
- 小步目标：保留原方案痕迹并区分保留、修改和放弃的内容
- 学生行动：把原判断、新证据、保留内容、修改内容、放弃内容和行动责任卡放入对应区域
- 位置：none
- 完成方式：tool_result
- 证据要求：6张卡全部进入作品区；原判断不得删除，新证据与至少一项修改或放弃建立对应关系
- 功能模块：A03(版本对照搭建)
- 工具参数：{"builder":{"mode":"flow","prompt":"保留原判断，再按新信息整理保留、修改、放弃和责任安排。","items":[{"id":"original","label":"任务2·原阶段选择"},{"id":"new-evidence","label":"新增课程材料中的关键信息"},{"id":"keep","label":"仍然保留的判断"},{"id":"change","label":"需要修改的判断"},{"id":"drop","label":"需要放弃的判断"},{"id":"responsibility","label":"统一行动与责任安排"}],"zones":[{"id":"before","label":"原判断"},{"id":"trigger","label":"新信息"},{"id":"after","label":"保留/修改/放弃"},{"id":"action","label":"统一行动"}],"bindings":{"original":{"taskId":"task-2","stepId":"decision-record-team-decision","toolId":"team","property":"entries","prefix":"原讨论："}},"correctMapping":{"original":"before","new-evidence":"trigger","keep":"after","change":"after","drop":"after","responsibility":"action"},"retryMessage":"请保留原判断和触发信息，再把保留、修改、放弃与责任安排放到对应阶段。"}}
- 知识引用：K-17, K-18
- 引导引用：guidance/decision-strategist.md#任务3
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S6, evaluation.md#C1, evaluation.md#C4
- 脚手架引用：scaffolds/decision-strategist.md#任务3
- 常见误区：用新结论覆盖原记录，使判断变化无法追溯
- 最大尝试：3
- 失败处理：提醒学生先保留原判断，再补放新证据与行动责任卡
- 教师介入：学生拒绝保留原版本，或无法区分课程模拟与历史事实
- 通过后：step:decision-write-revision

#### Step 3：完成决策复盘

- id：decision-write-revision
- 小步目标：用证据说明判断为什么改变，以及决定后怎样共同承担行动
- 学生行动：用“新证据—判断变化—责任安排”完成三段式复盘，并引用至少2条证据
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：三个字段完整；至少引用任务1现场材料和任务3新增材料各1条；明确一项统一行动安排，不把课程投票写成历史会议事实
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"new-evidence","label":"新证据及来源","type":"long_text","required":true,"placeholder":"至少引用两条不同阶段证据"},{"id":"change","label":"判断变化","type":"long_text","required":true,"placeholder":"原来认为……现在保留/修改/放弃……因为……"},{"id":"responsibility","label":"统一行动与责任安排","type":"long_text","required":true,"placeholder":"决定形成后，谁核验、谁执行、何时复盘"}]}}
- 知识引用：K-17, K-18
- 引导引用：guidance/decision-strategist.md#任务3
- 限制引用：restrictions.md#教学限制, restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S6, evaluation.md#C1, evaluation.md#C4
- 脚手架引用：scaffolds/decision-strategist.md#任务3
- 常见误区：用后来结果证明原方案毫无价值，或把少数意见本身当作正确证据
- 最大尝试：3
- 失败处理：指出复盘缺少证据、变化或责任中的哪一段，请学生补齐原文
- 教师介入：连续3次仍无法区分历史事实、课程模拟决定和个人评价
- 通过后：role-stage:complete

## Phase 3 行为
- 向小组贡献：方案矩阵、异议记录和复核条件
- 拼合贡献：五层战图中的“决策层”
- 需要其他角色：情报参谋评估信息可靠度，地图参谋评估路线可行性

## Phase 4 璇玑参数
- 负责说明：统一行动的形成需要哪些讨论、复核与责任机制
