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
- 关键数据：四渡赤水主要活动区域的河流、山地、渡口与交通线空间关系

## 任务列表

### 任务1：定坐标
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
- 功能模块：A01(拍照采集), A07(扫码), 位置导航
- 任务图：assets/tasks/terrain-map.svg
- 配置：找到长征路线地图或地形模型，拍摄至少2处允许拍摄的局部；分别标注赤水河、乌江、长江、金沙江中能够辨认的水系，并记录展项标题
- 通过条件：至少2张有效证据照片 + 1条展项来源 + 至少2个正确空间标注
- 目标关联：K1(时空坐标), S1(地图判读), S3(史料实证)
- AI引导方向：先问“你能从哪一个方向标记或河流名称确认地图方位”，再帮助学生把看到与推断分开记录

#### Step 1：确认地图展项

- id：map-locate-exhibit
- 小步目标：确认眼前展项属于本角色需要观察的长征路线地图或地形模型
- 学生行动：对准展项整体和标题区域完成一次实物识别
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：识别画面需同时包含地图或模型主体，以及可定位该展项的标题或说明区域
- 功能模块：A07(实物识别)
- 工具参数：{"scanner":{"mode":"object","allowManualEntry":false,"prompt":"请把地图或地形模型主体与展项标题一起放入画面，完成一次实物识别。"}}
- 知识引用：K-11
- 引导引用：guidance/map-strategist.md#任务1
- 限制引用：restrictions.md#核心路线限制
- 评估引用：evaluation.md#S1, evaluation.md#S3
- 脚手架引用：scaffolds/map-strategist.md#任务1
- 常见误区：只识别地图局部，无法确认地图方向、年代和展项来源
- 最大尝试：3
- 失败处理：提醒学生后退一步，把主体和标题同时纳入画面后重新识别；仍失败时允许记录展项标题并由教师确认
- 教师介入：连续3次无法识别目标展项，或现场展项调整、封闭
- 通过后：step:map-capture-water-system

#### Step 2：采集水系证据

- id：map-capture-water-system
- 小步目标：获得能够支持水系相对位置判断的现场图像证据
- 学生行动：拍摄一张地图全景和一张能看清河流名称或图例的局部照片
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少2张照片；一张保留地图整体方向，一张清楚呈现至少一个河流名称或水系图例；不得拍入其他参观者正脸
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"minCount":2,"maxCount":4,"accept":"image/*","recognition":"map-source-and-waterway","prompt":"先拍地图全景，再拍河流名称或图例局部；两张照片都要保留可核对的展项信息。"}}
- 知识引用：K-10, K-11
- 引导引用：guidance/map-strategist.md#任务1
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S1, evaluation.md#S3
- 脚手架引用：scaffolds/map-strategist.md#任务1
- 常见误区：照片只拍到一个地名，无法判断其与其他水系的相对位置
- 最大尝试：3
- 失败处理：指出缺少的是全景、名称或图例中的哪一项，请学生只补拍缺失类型
- 教师介入：展馆禁止拍摄，或连续3次照片仍无法辨认展项信息
- 通过后：step:map-annotate-water-system

#### Step 3：标出可确认水系

- id：map-annotate-water-system
- 小步目标：依据现场证据建立地图方向和水系相对位置
- 学生行动：在课程底图上圈出至少两条能够确认的水系，并用箭头标出它们的相对方向
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：画板中至少出现2个水系标注、1组相对方向箭头，并能对应本阶段照片；无法确认的名称写“待核”。
- 功能模块：A01(画板标注)
- 工具参数：{"sketch":{"width":720,"height":520,"backgroundImage":"assets/tasks/terrain-map.svg","brushColors":["#8d211f","#245c4f","#1f2937"],"prompt":"红色圈水系名称，绿色画相对方向，黑色写照片编号；看不清的地方标“待核”。"}}
- 知识引用：K-10, K-11
- 引导引用：guidance/map-strategist.md#任务1
- 限制引用：restrictions.md#核心路线限制
- 评估引用：evaluation.md#K1, evaluation.md#S1, evaluation.md#C3
- 脚手架引用：scaffolds/map-strategist.md#任务1
- 常见误区：根据记忆补全四渡路线，或把候选位置直接标成史实位置
- 最大尝试：3
- 失败处理：絮絮只指出缺少方向、水系或来源中的哪一类，保留原图并让学生补标
- 教师介入：连续3次仍无法建立任何可核对的空间关系
- 通过后：role-stage:task-2

### 任务2：布态势
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
- 功能模块：A01(画板标注), A01(文字输入)
- 任务图：assets/tasks/terrain-map.svg
- 配置：在空白底图上标出红军所在区域、敌军可能形成的封锁方向、至少2个渡河点候选和1处地形约束；每个标记附一句证据说明
- 通过条件：完成四类标注 + 至少3条证据说明 + 明确区分展陈信息与个人推断
- 目标关联：K2(敌我态势), S1(地图判读), S6(因果表达), C3(证据边界)
- AI引导方向：追问“这条路线能走”和“这条路线值得走”各自需要什么证据，不提供史实路线

#### Step 1：摆放态势卡

- id：map-place-situation-cards
- 小步目标：把不同类型的空间信息放进同一张态势底图
- 学生行动：把红军区域、敌军封锁方向、两个候选渡口和一处地形约束卡分别放入对应区域
- 位置：inherit
- 完成方式：tool_result
- 证据要求：6张卡全部进入作品区；每张卡保留“展陈信息”或“推演假设”标签，不得把候选渡口写成史实渡口
- 功能模块：A03(拼合搭建)
- 工具参数：{"builder":{"mode":"evidence-wall","prompt":"先按证据性质分区，再摆放态势卡。红军区域与地形约束需要现场证据；两个渡口仍是候选。","items":[{"id":"red-area","label":"红军所在区域｜展陈信息"},{"id":"block-north","label":"敌军封锁方向A｜待核"},{"id":"crossing-a","label":"候选渡口A｜推演假设"},{"id":"crossing-b","label":"候选渡口B｜推演假设"},{"id":"terrain-river","label":"河流约束｜展陈信息"},{"id":"terrain-mountain","label":"山地或交通约束｜待核"}],"zones":[{"id":"confirmed","label":"展陈可确认"},{"id":"inference","label":"个人推演"},{"id":"unknown","label":"仍待核验"}],"correctMapping":{"red-area":"confirmed","block-north":"unknown","crossing-a":"inference","crossing-b":"inference","terrain-river":"confirmed","terrain-mountain":"unknown"},"retryMessage":"先看卡片末尾的证据性质：展陈信息、推演假设和待核内容要分别归位。"}}
- 知识引用：K-02, K-10, K-12
- 引导引用：guidance/map-strategist.md#任务2
- 限制引用：restrictions.md#核心路线限制
- 评估引用：evaluation.md#K2, evaluation.md#S1, evaluation.md#C3
- 脚手架引用：scaffolds/map-strategist.md#任务2
- 常见误区：把所有卡都放进“展陈可确认”，忽略敌军认知和候选路线属于推演
- 最大尝试：3
- 失败处理：提示学生先检查卡片上的证据性质标签，再只调整有争议的一张卡
- 教师介入：学生对展项来源持续存在冲突且无法现场核验
- 通过后：step:map-mark-evidence-boundary

#### Step 2：画出空间关系

- id：map-mark-evidence-boundary
- 小步目标：用不同视觉符号区分事实位置、封锁方向和候选路线
- 学生行动：在底图上用实线标现场可确认信息，用虚线标个人推演，并画出至少一个被河流或山地阻断的位置
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少包含1个实线事实标记、2个虚线候选标记、1个封锁方向和1处地形阻断；标注与上一步态势卡一致
- 功能模块：A01(画板标注)
- 工具参数：{"sketch":{"width":720,"height":520,"backgroundImage":"assets/tasks/terrain-map.svg","brushColors":["#8d211f","#245c4f","#1f2937"],"prompt":"红色实线表示展陈可确认，绿色虚线表示推演，黑色叉号标地形阻断。"}}
- 知识引用：K-02, K-10, K-11
- 引导引用：guidance/map-strategist.md#任务2
- 限制引用：restrictions.md#核心路线限制
- 评估引用：evaluation.md#S1, evaluation.md#S6, evaluation.md#C3
- 脚手架引用：scaffolds/map-strategist.md#任务2
- 常见误区：只标位置，不说明河流、山地或交通线怎样影响行动
- 最大尝试：3
- 失败处理：絮絮高亮缺少的一类符号，只要求补画该类信息
- 教师介入：连续3次作品仍无法区分事实标记与推演标记
- 通过后：step:map-explain-terrain-constraint

#### Step 3：解释地形约束

- id：map-explain-terrain-constraint
- 小步目标：把地图标记转化为可供小组使用的路线约束
- 学生行动：分别写下一条“能否通行”的证据和一条“是否值得走”的判断，并说明仍缺什么信息
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：三个字段全部填写；通行证据引用现场照片或标注图，价值判断使用条件句，缺失信息不得虚构补全
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"passability","label":"能否通行：现场证据","type":"long_text","required":true,"placeholder":"例：照片2显示……因此这段可能/不可能通行"},{"id":"value","label":"是否值得走：带条件判断","type":"long_text","required":true,"placeholder":"只有在……条件满足时，这条方向才值得考虑"},{"id":"missing","label":"仍缺的信息","type":"short_text","required":true,"placeholder":"敌军位置、补给、渡河条件等"}]}}
- 知识引用：K-10, K-12
- 引导引用：guidance/map-strategist.md#任务2
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S1, evaluation.md#S6, evaluation.md#C3
- 脚手架引用：scaffolds/map-strategist.md#任务2
- 常见误区：把“地图上连得起来”直接等同于“战略上值得走”
- 最大尝试：3
- 失败处理：分别提示证据、判断或未知中缺少的一栏，不改写学生结论
- 教师介入：学生坚持把未开放路线作为唯一正确答案
- 通过后：role-stage:task-3

### 任务3：拟路线
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
- 功能模块：A01(画板标注), A02(表单)
- 任务图：assets/tasks/terrain-map.svg
- 配置：只依据本角色已采集证据，提出一条阶段性转移路线；填写目标、地形优势、主要风险、仍缺信息各1项
- 通过条件：提交1条连续路线 + 4项理由完整 + 至少引用2条现场证据
- 目标关联：K3(四次渡河), S5(决策矩阵), C1(实事求是), C2(战略思维)
- AI引导方向：检查路线是否连续、理由是否来自当前证据；学生提交后仍不评价是否“猜中”史实

#### Step 1：绘制候选路线

- id：map-draw-candidate-route
- 小步目标：形成一条基于当前证据、可以被检查的阶段性路线
- 学生行动：从当前起点画到一个候选终点，标出渡河点、转向点和备用出口
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：路线连续，至少包含1个渡河点、1个转向点和1个备用出口；不得照抄尚未解锁的史实路线
- 功能模块：A01(画板标注)
- 工具参数：{"sketch":{"width":720,"height":520,"backgroundImage":"assets/tasks/terrain-map.svg","brushColors":["#8d211f","#245c4f","#1f2937"],"prompt":"用红线画主路线、绿线画备用出口、黑圈标渡河点；这是候选方案，请勿写成史实路线。"}}
- 知识引用：K-12
- 引导引用：guidance/map-strategist.md#任务3
- 限制引用：restrictions.md#一渡完整方案, restrictions.md#二渡完整方案
- 评估引用：evaluation.md#S1, evaluation.md#S5, evaluation.md#C2
- 脚手架引用：scaffolds/map-strategist.md#任务3
- 常见误区：只画一条没有起点、渡河点或出口的直线
- 最大尝试：3
- 失败处理：指出路线断点所在区段，请学生只补连接或备用出口
- 教师介入：连续3次路线仍穿越明显不可通行区域，且学生无法说明证据
- 通过后：step:map-complete-route-matrix

#### Step 2：填写路线矩阵

- id：map-complete-route-matrix
- 小步目标：说明候选路线的目标、优势、风险和信息边界
- 学生行动：根据刚画的路线填写目标、地形优势、主要风险和仍缺信息四项
- 位置：none
- 完成方式：tool_result
- 证据要求：四个字段均完成；优势和风险各引用至少一个现场观察；未知项保持为未知
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"goal","label":"阶段目标","type":"short_text","required":true,"placeholder":"保存力量、寻找出口、争取补给等"},{"id":"advantage","label":"地形优势与证据","type":"long_text","required":true,"placeholder":"引用照片或标注图说明"},{"id":"risk","label":"主要风险与证据","type":"long_text","required":true,"placeholder":"写出最可能使路线失效的条件"},{"id":"unknown","label":"仍缺信息","type":"short_text","required":true,"placeholder":"当前无法确认的信息"}]}}
- 知识引用：K-12
- 引导引用：guidance/map-strategist.md#任务3
- 限制引用：restrictions.md#核心路线限制
- 评估引用：evaluation.md#S5, evaluation.md#C1, evaluation.md#C3
- 脚手架引用：scaffolds/map-strategist.md#任务3
- 常见误区：只写路线好处，不写失败风险和未知信息
- 最大尝试：3
- 失败处理：仅提示缺失字段，并邀请学生回看自己的路线图与照片
- 教师介入：连续3次仍无法给出任何现场证据
- 通过后：step:map-check-route-evidence

#### Step 3：核对证据充分性

- id：map-check-route-evidence
- 小步目标：判断候选路线是否已具备进入小组推演的最低证据条件
- 学生行动：选择目前最符合你这条路线证据状态的描述
- 位置：none
- 完成方式：tool_result
- 证据要求：选择能够同时保留现场证据、风险和未知项的选项
- 功能模块：A02(单选答题)
- 工具参数：{"quiz":{"type":"single_choice","question":"哪一种提交方式最适合把候选路线带入小组推演？","options":["路线与史实一致，所以无需再写风险","引用至少2条现场证据，同时保留主要风险和未知信息","只要地图上能连起来，就可以认定路线可行"],"answer":"引用至少2条现场证据，同时保留主要风险和未知信息","explanation":"推演方案需要可追溯证据，也要保留风险与未知，不能用后来结果证明当时判断。","retryMessage":"再检查一下：候选路线进入推演时，证据、风险和未知三项都需要保留。"}}
- 知识引用：K-04, K-12
- 引导引用：guidance/map-strategist.md#任务3
- 限制引用：restrictions.md#教学限制
- 评估引用：evaluation.md#S3, evaluation.md#S5, evaluation.md#C1
- 脚手架引用：scaffolds/map-strategist.md#任务3
- 常见误区：用是否猜中史实路线代替对证据质量的检查
- 最大尝试：2
- 失败处理：提示学生对照路线矩阵中的风险和未知项后重新选择
- 教师介入：连续2次仍坚持以史实一致作为唯一判断标准
- 通过后：role-stage:complete

## Phase 3 行为
- 向小组贡献：地形底图、候选渡口和交通约束
- 拼合贡献：五层战图中的“地形层”
- 需要其他角色：情报参谋提供敌方关注方向，示形参谋提供行动节奏

## Phase 4 璇玑参数
- 负责说明：全局地图上可见的信息，基层行动者当时可能看不到哪些
