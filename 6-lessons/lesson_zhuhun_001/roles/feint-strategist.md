# 🎭 示形参谋

> 核心问题：怎样用可被敌方观察到的行动改变其部署，同时为真正目标创造窗口？

## 基本信息
- 排序：4
- 地点：四渡赤水战术部署展区
- 地理围栏：中国共产党历史展览馆课程动线内
- 类型：核心角色
- 选择说明：负责拆解行动顺序和虚实关系，推演我方信号、敌方判断与兵力调动之间的连锁反应。
- 角色卡图：assets/roles/role-card-feint-strategist.png
- 角色徽章图：assets/roles/badge-feint-strategist.png
- 收集物：行动层
- 收集物图：assets/tokens/layer-action.png
- 关键数据：行动的空间、时间、可见信号和真正目标共同构成虚实行动链

## 任务列表

### 任务1：排行动
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
- 功能模块：A01(拍照采集), A02(排序答题)
- 任务图：assets/tasks/feint-route.svg
- 配置：寻找四渡赤水战术部署展项，拍摄至少1处允许拍摄的展项说明；提取4张行动卡，按时间顺序排列，并给每张卡标注地点、可见信号和材料来源
- 通过条件：至少1张展项来源照片 + 4张行动卡 + 顺序、地点和来源完整
- 目标关联：K3(四次渡河), S3(史料实证), S6(因果表达)
- AI引导方向：帮助核对卡片依据和时间顺序；若后续行动尚未解锁，仅提示回看展项位置，不直接补出路线

#### Step 1：采集部署展项

- id：feint-capture-deployment
- 小步目标：获得可以支持行动顺序判断的现场展项来源
- 学生行动：拍摄一张战术部署展项全景和一张包含日期、先后词或图例的局部照片
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少2张照片；全景能够确认展项，局部至少呈现日期、先后词、地点或图例中的一项；不得拍摄未允许区域
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"minCount":2,"maxCount":4,"accept":"image/*","recognition":"deployment-sequence-source","prompt":"先拍展项全景，再拍能够支持先后顺序的日期、文字或图例局部。"}}
- 知识引用：K-03, K-04
- 引导引用：guidance/feint-strategist.md#任务1
- 限制引用：restrictions.md#核心路线限制
- 评估引用：evaluation.md#K3, evaluation.md#S3
- 脚手架引用：scaffolds/feint-strategist.md#任务1
- 常见误区：只拍路线终点或结果，没有保留判断行动先后的材料线索
- 最大尝试：3
- 失败处理：指出缺少全景来源或顺序线索中的哪一张照片，请学生补拍
- 教师介入：展馆禁止拍摄，或连续3次仍无法取得任何顺序线索
- 通过后：step:feint-order-actions

#### Step 2：排列行动逻辑

- id：feint-order-actions
- 小步目标：在不提前打开完整史实路线的前提下建立行动影响的先后链
- 学生行动：根据现场材料排列四张行动逻辑卡，并为每一处相邻关系指出一条日期、先后词、地点或图例依据
- 位置：inherit
- 完成方式：tool_result
- 证据要求：四张卡形成一条可解释的因果顺序；排序依据来自任务照片或展项先后词，不补写尚未解锁的渡口和完整路线
- 功能模块：A02(排序答题)
- 工具参数：{"quiz":{"type":"ordering","question":"根据现场材料，排列一条行动产生战略窗口的基本逻辑。","options":["敌方根据可见信号调整部署","原计划遇到新的现实约束","我方获得重新选择方向的窗口","我方采取可被观察的阶段行动"],"answer":["原计划遇到新的现实约束","我方采取可被观察的阶段行动","敌方根据可见信号调整部署","我方获得重新选择方向的窗口"],"explanation":"这条顺序用于检查因果结构，不等于提前公布四渡赤水的完整路线。","retryMessage":"先找起点：现实约束变化后才需要行动；窗口通常出现在敌方反应之后。"}}
- 知识引用：K-04, K-15
- 引导引用：guidance/feint-strategist.md#任务1
- 限制引用：restrictions.md#三渡完整方案, restrictions.md#四渡完整方案
- 评估引用：evaluation.md#S6, evaluation.md#C2
- 脚手架引用：scaffolds/feint-strategist.md#任务1
- 常见误区：用已知结局直接排列完整史实路线，或把敌方反应放在可见行动之前
- 最大尝试：3
- 失败处理：只提示相邻两张卡的因果冲突，请学生回看照片中的先后词后调整
- 教师介入：连续3次无法建立基本先后关系，或学生持续引用未开放路线答案
- 通过后：step:feint-source-action-cards

#### Step 3：补齐行动卡依据

- id：feint-source-action-cards
- 小步目标：让行动链中的每一环都带有地点、可见信号或材料来源
- 学生行动：为四张行动逻辑卡分别填写现场线索，并标明照片编号或展项标题
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：四张卡均有来源；至少两张卡写出地点或可见信号；无法确认的行动细节明确标“待核”。
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"constraint-source","label":"现实约束卡｜现场线索与来源","type":"long_text","required":true},{"id":"action-source","label":"可见行动卡｜地点或信号与来源","type":"long_text","required":true},{"id":"reaction-source","label":"敌方反应卡｜材料依据或待核说明","type":"long_text","required":true},{"id":"window-source","label":"新窗口卡｜材料依据或待核说明","type":"long_text","required":true}]}}
- 知识引用：K-04, K-15
- 引导引用：guidance/feint-strategist.md#任务1
- 限制引用：restrictions.md#核心路线限制
- 评估引用：evaluation.md#S3, evaluation.md#S6, evaluation.md#C3
- 脚手架引用：scaffolds/feint-strategist.md#任务1
- 常见误区：为补齐卡片而虚构部队番号、日期、地点或敌方心理
- 最大尝试：3
- 失败处理：指出缺少来源的一张卡；找不到材料时允许写“待核”，不自动生成历史细节
- 教师介入：现场材料与课程卡存在明显冲突，需要教师核验
- 通过后：role-stage:task-2

### 任务2：辨虚实
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
- 功能模块：A01(画板标注), A02(表单)
- 任务图：assets/tasks/feint-route.svg
- 配置：选取相邻两次行动，分别标注“敌方能看到什么、敌方可能怎么判断、我方真正需要什么”；至少提出1种其他解释
- 通过条件：完成三栏虚实图 + 1种替代解释 + 至少2条证据引用
- 目标关联：K4(情报与信息差), K6(虚实行动链), S4(信息不对称分析), C2(战略思维)
- AI引导方向：通过问题促使学生找到信号、判断和目标的差异，完成前不说出三渡四渡的虚实结论

#### Step 1：搭建信号链

- id：feint-build-signal-chain
- 小步目标：区分可见信号、敌方判断、我方需要和替代解释
- 学生行动：把四张关系卡分别放入“看见什么、可能怎么判断、我方需要什么、其他解释”四栏
- 位置：none
- 完成方式：tool_result
- 证据要求：四张卡全部完成分类；“敌方判断”保持可能性表述，“其他解释”不得与原判断完全相同
- 功能模块：A03(分类搭建)
- 工具参数：{"builder":{"mode":"flow","prompt":"把同一组行动线索拆成四栏，先区分信号和解释，再讨论真正需要。","items":[{"id":"visible","label":"任务1·可被观察的行动信号"},{"id":"enemy-judgment","label":"敌方可能形成的判断"},{"id":"our-need","label":"我方希望获得的时间或空间窗口"},{"id":"alternative","label":"同一信号的另一种解释"}],"zones":[{"id":"seen","label":"敌方看见什么"},{"id":"judge","label":"敌方可能怎么判断"},{"id":"need","label":"我方真正需要什么"},{"id":"other","label":"替代解释"}],"bindings":{"visible":{"taskId":"task-1","stepId":"feint-source-action-cards","toolId":"text","fieldId":"action-source","prefix":"行动信号："}},"correctMapping":{"visible":"seen","enemy-judgment":"judge","our-need":"need","alternative":"other"},"retryMessage":"依次核对：可见信号、敌方判断、我方需要和替代解释要放进不同栏。"}}
- 知识引用：K-14, K-15
- 引导引用：guidance/feint-strategist.md#任务2
- 限制引用：restrictions.md#三四渡虚实关系
- 评估引用：evaluation.md#K4, evaluation.md#S4, evaluation.md#C2
- 脚手架引用：scaffolds/feint-strategist.md#任务2
- 常见误区：把敌方看到的动作直接等同于我方真正目标
- 最大尝试：3
- 失败处理：追问“对方直接看到的是哪一张卡”，只要求先纠正信号栏
- 教师介入：连续3次仍无法区分观察事实和对行动的解释
- 通过后：step:feint-add-alternative

#### Step 2：写出替代解释

- id：feint-add-alternative
- 小步目标：避免把敌方反应固定为单一路径
- 学生行动：根据同一行动信号，分别写出敌方可能相信的解释、另一种解释和两种解释各自需要的证据
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：两种解释不同；每种解释至少附1条当前证据或待核条件；使用“可能、如果”表述
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"interpretation-a","label":"解释A：敌方可能相信什么","type":"long_text","required":true},{"id":"evidence-a","label":"解释A：依据或成立条件","type":"long_text","required":true},{"id":"interpretation-b","label":"解释B：另一种可能","type":"long_text","required":true},{"id":"evidence-b","label":"解释B：依据或待核条件","type":"long_text","required":true}]}}
- 知识引用：K-14, K-15
- 引导引用：guidance/feint-strategist.md#任务2
- 限制引用：restrictions.md#三四渡虚实关系
- 评估引用：evaluation.md#S4, evaluation.md#C2, evaluation.md#C3
- 脚手架引用：scaffolds/feint-strategist.md#任务2
- 常见误区：把后来敌方实际反应写成当时唯一可能的解释
- 最大尝试：3
- 失败处理：提示两种解释中语义重复的一项，请学生改变观察渠道、敌方前提或时间条件
- 教师介入：学生无法提出第二种解释，或持续以结果倒推必然性
- 通过后：step:feint-check-evidence

#### Step 3：检查虚实判断依据

- id：feint-check-evidence
- 小步目标：确认虚实判断需要信号、观察条件和敌方既有判断共同支持
- 学生行动：选择一组能够支持“示形可能产生作用”的最低条件
- 位置：none
- 完成方式：tool_result
- 证据要求：正确识别信号可见、符合敌方已有判断、调动留下窗口三项条件
- 功能模块：A02(多选答题)
- 工具参数：{"quiz":{"type":"multiple_choice","question":"示形可能影响敌方判断，至少需要检查哪些条件？","options":["信号能够被敌方观察","信号符合敌方已有判断","敌方调动可能留下我方可利用窗口","行动最后成功，所以此前条件无需核验"],"answer":["信号能够被敌方观察","信号符合敌方已有判断","敌方调动可能留下我方可利用窗口"],"explanation":"示形能否发挥作用取决于观察、认知和窗口条件；最后结果不能替代当时检验。","retryMessage":"再检查前三个环节：信号怎样被看见、怎样被解释、反应是否留下窗口。"}}
- 知识引用：K-15
- 引导引用：guidance/feint-strategist.md#任务2
- 限制引用：restrictions.md#三四渡虚实关系
- 评估引用：evaluation.md#K6, evaluation.md#S4, evaluation.md#C2
- 脚手架引用：scaffolds/feint-strategist.md#任务2
- 常见误区：把历史结果成功当作示形在当时必然有效的证据
- 最大尝试：3
- 失败处理：提示学生沿“被看见—被解释—留下窗口”重新检查选项
- 教师介入：连续3次仍以结果作为唯一依据
- 通过后：role-stage:task-3

### 任务3：演反应
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
- 功能模块：A04(沙盘推演), A05(讨论记录)
- 任务图：assets/tasks/feint-route.svg
- 配置：在路径推演器中提交“我方行动—敌方第一反应—我方后续窗口—失败风险”行动链，并运行至少2种敌方反应
- 通过条件：1条四环行动链 + 2种敌方反应分支 + 1项失败风险 + 保留运行记录
- 目标关联：K6(虚实行动链), S4(信息不对称分析), S5(决策矩阵), C2(战略思维)
- AI引导方向：避免把敌方反应固定为单一路径，提醒学生评估示形被识破后的后果

#### Step 1：运行敌方反应

- id：feint-run-reactions
- 小步目标：通过不同敌方反应检验行动链的稳健性
- 学生行动：运行两轮推演，分别选择“敌方相信信号”和“敌方识破或不按预期行动”
- 位置：none
- 完成方式：tool_result
- 证据要求：完成2轮不同分支；每轮保留我方窗口和暴露风险反馈，模拟记录不得标为史实
- 功能模块：A04(沙盘推演)
- 工具参数：{"simulation":{"rounds":2,"allowRepeat":false,"prompt":"运行两个不同反应分支，检查行动链在不利条件下是否仍有出口。","roundPrompts":["第1轮：选择敌方对行动信号的一种反应。","第2轮：改选另一种反应，检查备用方案和退出条件。"],"resources":{"行动卡":4,"备用出口":1},"choices":[{"id":"believe","label":"敌方相信信号并调动兵力","publicFeedback":"可能出现行动窗口；仍需判断窗口长度和信号成本。","effects":{"window":2,"exposure":1}},{"id":"detect","label":"敌方识破信号并保留部署","publicFeedback":"原窗口缩小；需要备用方案、退出条件或新情报。","effects":{"window":-2,"exposure":2}},{"id":"delay","label":"敌方迟疑并延后反应","publicFeedback":"局势仍不确定；时间消耗可能同时影响双方。","effects":{"window":0,"time":-1}}],"metrics":[{"id":"window","label":"行动窗口","initial":0,"initialLabel":"未形成"},{"id":"exposure","label":"暴露风险","initial":0,"initialLabel":"待判断"},{"id":"time","label":"时间变化","initial":0,"initialLabel":"待判断"}]}}
- 知识引用：K-15
- 引导引用：guidance/feint-strategist.md#任务3
- 限制引用：restrictions.md#四渡完整方案
- 评估引用：evaluation.md#K6, evaluation.md#S4, evaluation.md#C2
- 脚手架引用：scaffolds/feint-strategist.md#任务3
- 常见误区：两轮都运行成功分支，忽略示形被识破或敌方另作反应
- 最大尝试：3
- 失败处理：提醒第二轮改用失败或偏离预期的反应分支
- 教师介入：学生把推演结果写成史实，或持续跳过失败分支
- 通过后：step:feint-discuss-fallback

#### Step 2：讨论备用方案

- id：feint-discuss-fallback
- 小步目标：形成示形失效时的退出条件和备用行动原则
- 学生行动：与同伴至少记录两条讨论结果：一条备用方案，一条停止或调整示形的触发条件
- 位置：none
- 完成方式：tool_result
- 证据要求：至少2条组内记录；分别包含备用方案与退出条件，并说明依据来自哪一轮推演
- 功能模块：A05(团队讨论)
- 工具参数：{"team":{"mode":"discussion","prompt":"根据两轮运行记录，分别写下备用方案和退出条件；保留不同意见，不讨论现实冲突操作。","minimumEntries":2,"roles":["行动链说明人","风险提醒人","记录人"],"recordTypes":["备用方案","退出条件","不同意见"],"requiredRecordTypes":["备用方案","退出条件"]}}
- 知识引用：K-15
- 引导引用：guidance/feint-strategist.md#任务3
- 限制引用：restrictions.md#安全限制
- 评估引用：evaluation.md#S5, evaluation.md#C2, evaluation.md#协作维度
- 脚手架引用：scaffolds/feint-strategist.md#任务3
- 常见误区：备用方案仍依赖敌方一定按原预测行动，没有真正处理失败分支
- 最大尝试：3
- 失败处理：提示小组分别补“如果被识破怎么办”和“何时停止”中的缺失项
- 教师介入：讨论转向现实跟踪、规避监管或伤害建议，或组内冲突持续
- 通过后：step:feint-record-robustness

#### Step 3：归纳行动链边界

- id：feint-record-robustness
- 小步目标：形成带条件的四环行动链和风险结论
- 学生行动：填写“我方行动—敌方第一反应—我方后续窗口—失败风险”，再写出一项使行动链失效的新信息
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：四环完整；引用两轮模拟记录；至少包含1项失败风险和1项失效信息；不用必然性语言
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"our-action","label":"我方行动信号","type":"long_text","required":true},{"id":"enemy-reaction","label":"敌方可能的第一反应","type":"long_text","required":true},{"id":"window","label":"我方可能获得的后续窗口","type":"long_text","required":true},{"id":"failure-risk","label":"失败风险","type":"long_text","required":true},{"id":"invalidating-info","label":"使行动链失效的新信息","type":"short_text","required":true}]}}
- 知识引用：K-15
- 引导引用：guidance/feint-strategist.md#任务3
- 限制引用：restrictions.md#四渡完整方案, restrictions.md#安全限制
- 评估引用：evaluation.md#S4, evaluation.md#S5, evaluation.md#C2
- 脚手架引用：scaffolds/feint-strategist.md#任务3
- 常见误区：省略失败风险，或把模拟中的敌方反应写成唯一历史事实
- 最大尝试：3
- 失败处理：指出四环中断的位置，只要求补充缺失环节或风险
- 教师介入：连续3次仍无法形成两种反应或安全边界
- 通过后：role-stage:complete

## Phase 3 行为
- 向小组贡献：行动时间线、可见信号和敌方反应分支
- 拼合贡献：五层战图中的“行动层”
- 需要其他角色：情报参谋评估敌方认知，决策参谋评估风险是否可承受

## Phase 4 璇玑参数
- 负责说明：宏观行动设计如何转化为基层能够执行的局部步骤
