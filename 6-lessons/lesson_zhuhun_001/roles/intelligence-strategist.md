# 📡 情报参谋

> 核心问题：双方掌握的信息不同，怎样让对方根据不完整信息作出错误判断？

## 基本信息
- 排序：2
- 地点：情报与通信史料展区
- 地理围栏：中国共产党历史展览馆课程动线内
- 类型：核心角色
- 选择说明：负责辨认电文和情报线索，画出“我方已知、敌方已知、双方未知与可能误判”的信息盲区。
- 角色卡图：assets/roles/role-card-intelligence-strategist.png
- 角色徽章图：assets/roles/badge-intelligence-strategist.png
- 收集物：情报层
- 收集物图：assets/tokens/layer-intelligence.png
- 关键数据：情报来源、可靠度、时效和敌我判断差共同影响行动窗口

## 任务列表

### 任务1：读电文
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
- 功能模块：A01(拍照采集), A07(扫码)
- 任务图：assets/tasks/intelligence-matrix.svg
- 配置：寻找通信、侦察、电台或电文相关展项，拍摄至少2处允许拍摄的证据；记录发送者、接收者、时间、信息内容中能够确认的项目
- 通过条件：至少2张有效照片 + 1条展项来源 + 至少3项信息字段；无法确认的字段标记“未知”
- 目标关联：K4(情报与信息差), S3(史料实证), C3(证据边界)
- AI引导方向：提醒学生从展项说明读取信息，不依据照片模糊字迹补写内容

#### Step 1：采集通信史料

- id：intel-capture-message
- 小步目标：获得能够确认通信史料内容与来源的现场证据
- 学生行动：拍摄一张通信工具或电文展项全景，再拍一张展项说明局部
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少2张照片；全景能确认展项类型，局部能辨认标题、日期、通信主体或说明文字中的至少一项；不得依据模糊字迹补写
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"minCount":2,"maxCount":4,"accept":"image/*","recognition":"message-source-fields","prompt":"先拍展项全景，再拍说明文字局部；文字模糊时换角度，不要凭印象补写。"}}
- 知识引用：K-13
- 引导引用：guidance/intelligence-strategist.md#任务1
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#C3
- 脚手架引用：scaffolds/intelligence-strategist.md#任务1
- 常见误区：只拍电台或物件外观，没有保留展项标题和信息来源
- 最大尝试：3
- 失败处理：指出缺少全景或文字局部中的哪一张，请学生只补拍缺失照片
- 教师介入：展馆禁止拍摄，或连续3次仍无法辨认任何展项来源
- 通过后：step:intel-confirm-fields

#### Step 2：确认电文字段

- id：intel-confirm-fields
- 小步目标：从现场材料中提取可确认字段，并保留材料未说明的空白
- 学生行动：逐项填写发送者、接收者、时间、可确认内容和展项来源；看不清或材料未说明时填写“未知”
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：5个字段均完成，其中至少3项来自照片中可辨认的信息；“未知”允许作为有效记录，禁止补造原句或编号
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"sender","label":"发送者","type":"short_text","required":true,"placeholder":"无法确认时填“未知”"},{"id":"receiver","label":"接收者","type":"short_text","required":true,"placeholder":"无法确认时填“未知”"},{"id":"time","label":"时间","type":"short_text","required":true,"placeholder":"按展项原文记录；未知可保留"},{"id":"content","label":"能够确认的信息内容","type":"long_text","required":true,"placeholder":"只转述清晰可见的内容"},{"id":"source","label":"展项标题或来源","type":"short_text","required":true,"placeholder":"填写展项标题、照片编号或说明牌"}]}}
- 知识引用：K-13
- 引导引用：guidance/intelligence-strategist.md#任务1
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#C3
- 脚手架引用：scaffolds/intelligence-strategist.md#任务1
- 常见误区：把OCR候选文字、个人猜测或现代网络摘要当作电文原文
- 最大尝试：3
- 失败处理：标出缺少来源或越界补写的字段，让学生对照照片改为转述或“未知”
- 教师介入：学生与现场说明存在持续分歧，或材料文字确实无法辨认
- 通过后：step:intel-mark-source-boundary

#### Step 3：判断信息边界

- id：intel-mark-source-boundary
- 小步目标：区分展项原文、展陈转述和个人推测
- 学生行动：选择最符合史料边界的记录方式
- 位置：none
- 完成方式：tool_result
- 证据要求：正确选择保留未知、标明来源并将推测单独标注的表达
- 功能模块：A02(单选答题)
- 工具参数：{"quiz":{"type":"single_choice","question":"照片中有一处字迹模糊，哪种记录方式符合本课证据规则？","options":["按上下文补出最可能的原句","写“该字段未知”，并保留照片编号供复核","请AI生成一条意思接近的电文原文"],"answer":"写“该字段未知”，并保留照片编号供复核","explanation":"无法确认的史料字段需要保留为空白或未知，不能由AI或学生补造成原文。","retryMessage":"回想任务要求：看不清的字段可以保留“未知”，并留下可复核的来源。"}}
- 知识引用：K-13, K-21
- 引导引用：guidance/intelligence-strategist.md#任务1
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#C3
- 脚手架引用：scaffolds/intelligence-strategist.md#任务1
- 常见误区：认为记录“未知”意味着任务没有完成
- 最大尝试：2
- 失败处理：提示学生比较“可复核记录”和“无法追溯补写”的差异后重选
- 教师介入：连续2次仍选择补造史料原文
- 通过后：role-stage:task-2

### 任务2：划盲区
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
- 功能模块：A02(表单), A01(画板标注)
- 任务图：assets/tasks/intelligence-matrix.svg
- 配置：把证据放入四象限：我方已知、敌方可能已知、双方未知、敌方可能误判；每项同时填写来源与可靠度（高/中/低）
- 通过条件：四个象限均有记录 + 至少5条信息卡 + 每条含来源和可靠度
- 目标关联：K4(情报与信息差), S4(信息不对称分析), C2(战略思维)
- AI引导方向：区分“敌方确实知道”和“我们推测敌方知道”，发现越界断言时要求降低可靠度或补证据

#### Step 1：分类信息卡

- id：intel-sort-information
- 小步目标：建立我方已知、敌方可能已知、双方未知和敌方可能误判四类信息
- 学生行动：把任务1形成的5张信息卡分别放入四个象限；同一张卡只能先选择一个当前最合适的位置
- 位置：none
- 完成方式：tool_result
- 证据要求：5张卡全部完成分类，四个象限均有记录；“敌方可能已知”保持可能性表述
- 功能模块：A03(分类搭建)
- 工具参数：{"builder":{"mode":"evidence-wall","prompt":"把来自任务1的字段卡与一个行动信号卡放入四象限；分类依据是当时各方能否获得信息。","items":[{"id":"sender-card","label":"任务1·发送者字段"},{"id":"receiver-card","label":"任务1·接收者字段"},{"id":"time-card","label":"任务1·时间字段"},{"id":"content-card","label":"任务1·内容字段"},{"id":"signal-card","label":"展项中可被观察的行动信号"}],"zones":[{"id":"ours","label":"我方已知"},{"id":"enemy-maybe","label":"敌方可能已知"},{"id":"unknown","label":"双方未知"},{"id":"misread","label":"敌方可能误判"}],"bindings":{"sender-card":{"taskId":"task-1","stepId":"intel-confirm-fields","toolId":"text","fieldId":"sender","prefix":"发送者："},"receiver-card":{"taskId":"task-1","stepId":"intel-confirm-fields","toolId":"text","fieldId":"receiver","prefix":"接收者："},"time-card":{"taskId":"task-1","stepId":"intel-confirm-fields","toolId":"text","fieldId":"time","prefix":"时间："},"content-card":{"taskId":"task-1","stepId":"intel-confirm-fields","toolId":"text","fieldId":"content","prefix":"内容："}},"zoneMinimums":{"ours":1,"enemy-maybe":1,"unknown":1,"misread":1}}}
- 知识引用：K-13, K-14
- 引导引用：guidance/intelligence-strategist.md#任务2
- 限制引用：restrictions.md#跨角色隔离
- 评估引用：evaluation.md#K4, evaluation.md#S4
- 脚手架引用：scaffolds/intelligence-strategist.md#任务2
- 常见误区：看到一条信息对己方重要，就默认敌方也已经知道
- 最大尝试：3
- 失败处理：提醒学生先问“哪一方通过什么渠道能得到它”，再移动一张最有争议的卡
- 教师介入：学生无法理解四象限含义，或材料来源发生争议
- 通过后：step:intel-rate-reliability

#### Step 2：标记可靠度

- id：intel-rate-reliability
- 小步目标：为分类判断补充来源、可靠度和核验办法
- 学生行动：分别给5张信息卡选择高、中或低可靠度，并为低可靠度卡写出一种核验办法
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：5张卡均有可靠度；至少1张卡保留低或中可靠度；低可靠度信息填写可执行的核验办法
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"sender-rating","label":"发送者字段：可靠度与理由","type":"short_text","required":true,"placeholder":"高/中/低 + 照片或来源"},{"id":"receiver-rating","label":"接收者字段：可靠度与理由","type":"short_text","required":true},{"id":"time-rating","label":"时间字段：可靠度与理由","type":"short_text","required":true},{"id":"content-rating","label":"内容字段：可靠度与理由","type":"short_text","required":true},{"id":"signal-rating","label":"行动信号：可靠度与理由","type":"short_text","required":true},{"id":"verification-method","label":"一条低可靠度信息的核验办法","type":"long_text","required":true,"placeholder":"回看展项、寻找独立来源或请教师核验"}]}}
- 知识引用：K-13, K-14
- 引导引用：guidance/intelligence-strategist.md#任务2
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#S4, evaluation.md#C3
- 脚手架引用：scaffolds/intelligence-strategist.md#任务2
- 常见误区：把重复出现的同一转述当作多个独立来源，从而全部评为高可靠度
- 最大尝试：3
- 失败处理：絮絮只指出缺少来源、可靠度或核验办法的一项，请学生补齐
- 教师介入：学生连续3次把个人推测标为高可靠度且拒绝补证据
- 通过后：step:intel-correct-overclaim

#### Step 3：修正越界判断

- id：intel-correct-overclaim
- 小步目标：把关于敌方认知的确定断言改写为带证据边界的判断
- 学生行动：选择最符合当前证据的表述
- 位置：none
- 完成方式：tool_result
- 证据要求：选择同时说明推测性质、依据和替代可能的表达
- 功能模块：A02(单选答题)
- 工具参数：{"quiz":{"type":"single_choice","question":"只有一条行动信号证据时，怎样记录敌方是否已经知道？","options":["敌方一定已经知道，并会按我们预想行动","根据这条信号，敌方可能知道；还需说明观察渠道和其他解释","只要我方看得到，敌方就必然看得到"],"answer":"根据这条信号，敌方可能知道；还需说明观察渠道和其他解释","explanation":"敌方认知通常属于推测，需要说明渠道、可靠度和替代解释。","retryMessage":"注意“敌方已知”需要证据；当前更合适的是保留“可能”与其他解释。"}}
- 知识引用：K-14
- 引导引用：guidance/intelligence-strategist.md#任务2
- 限制引用：restrictions.md#跨角色隔离
- 评估引用：evaluation.md#K4, evaluation.md#S4, evaluation.md#C3
- 脚手架引用：scaffolds/intelligence-strategist.md#任务2
- 常见误区：把“可能观察到信号”写成“必然形成某种判断”
- 最大尝试：2
- 失败处理：请学生回看四象限中“敌方可能已知”的措辞后重选
- 教师介入：连续2次仍把敌方认知写成没有来源的确定事实
- 通过后：role-stage:task-3

### 任务3：测判断
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
- 功能模块：A02(表单), A01(文字输入)
- 任务图：assets/tasks/intelligence-matrix.svg
- 配置：选择一个行动信号，预测敌方看到它后最可能形成的两种判断；填写判断依据、我方可利用的窗口和判断失败风险
- 通过条件：提交2种敌方判断 + 每种至少1条依据 + 1项利用窗口 + 1项失败风险
- 目标关联：K4(情报与信息差), K6(虚实行动链), S5(决策矩阵), C2(战略思维)
- AI引导方向：帮助学生形成多种解释，避免把敌方反应写成必然结果

#### Step 1：选择行动信号

- id：intel-select-signal
- 小步目标：选定一个可能被敌方观察、且适合进行多分支分析的信号
- 学生行动：从当前开放的三类信号中选择一类，作为本轮判断测试对象
- 位置：none
- 完成方式：tool_result
- 证据要求：完成选择，并能在下一步说明该信号通过什么渠道可能被观察
- 功能模块：A02(单选答题)
- 工具参数：{"quiz":{"type":"single_choice","question":"选择一个准备测试的行动信号：","options":["公开可观察的行军方向","渡口附近出现的行动迹象","可能被截获或转述的通信线索"],"answer":null,"explanation":"三种信号都可以进入推演，重点是说明观察渠道和不确定性。"}}
- 知识引用：K-14, K-15
- 引导引用：guidance/intelligence-strategist.md#任务3
- 限制引用：restrictions.md#三四渡虚实关系
- 评估引用：evaluation.md#S4, evaluation.md#S5
- 脚手架引用：scaffolds/intelligence-strategist.md#任务3
- 常见误区：选择与当前证据无关的信号，或直接写出尚未解锁的完整行动链
- 最大尝试：2
- 失败处理：提示学生从任务1、任务2已有证据中选择最接近的一类信号
- 教师介入：学生反复引用尚未开放的完整史实路线
- 通过后：step:intel-run-branches

#### Step 2：运行判断分支

- id：intel-run-branches
- 小步目标：比较同一行动信号可能引发的不同敌方反应
- 学生行动：连续运行两轮，分别测试“敌方相信信号”和“敌方怀疑或未按预期行动”两种分支
- 位置：none
- 完成方式：tool_result
- 证据要求：完成2轮且选择不同反应；运行记录保留每轮判断及公开反馈，模拟结果不得作为史实证据
- 功能模块：A04(沙盘推演)
- 工具参数：{"simulation":{"rounds":2,"allowRepeat":false,"prompt":"运行两个不同的敌方反应分支，比较窗口和不确定性。","roundPrompts":["第1轮：选择敌方对信号的一种初始判断。","第2轮：改选另一种反应，检查原判断失效时会发生什么。"],"resources":{"证据卡":5,"时间窗口":"待判断"},"choices":[{"id":"believe","label":"敌方相信信号并调整部署","publicFeedback":"可能形成短暂窗口；需要继续检查信号能否被观察和窗口持续多久。","effects":{"window":2,"exposure":1}},{"id":"doubt","label":"敌方怀疑信号并保留兵力","publicFeedback":"窗口可能缩小；需要准备替代方案并寻找新情报。","effects":{"window":-1,"exposure":1}},{"id":"other","label":"敌方形成另一种解释","publicFeedback":"原有预测失效；请说明还可能出现什么解释。","effects":{"window":0,"uncertainty":2}}],"metrics":[{"id":"window","label":"可利用窗口","initial":0,"initialLabel":"待判断"},{"id":"uncertainty","label":"不确定性","initial":0,"initialLabel":"待判断"},{"id":"exposure","label":"信号暴露","initial":0,"initialLabel":"待判断"}]}}
- 知识引用：K-15
- 引导引用：guidance/intelligence-strategist.md#任务3
- 限制引用：restrictions.md#三四渡虚实关系
- 评估引用：evaluation.md#S4, evaluation.md#S5, evaluation.md#C2
- 脚手架引用：scaffolds/intelligence-strategist.md#任务3
- 常见误区：两轮都选择同一反应，或把模拟反馈当作敌方真实行动
- 最大尝试：3
- 失败处理：提醒学生第二轮必须选择与第一轮不同的反应，并保留失败可能
- 教师介入：学生将模拟结果持续称为史实，或无法理解条件分支
- 通过后：step:intel-record-window-risk

#### Step 3：记录窗口与风险

- id：intel-record-window-risk
- 小步目标：为两个敌方判断分支补足依据、利用窗口和失效条件
- 学生行动：分别写出两种判断的依据，再记录可利用窗口、失败风险和使判断失效的新信息
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：判断A和判断B各有至少1条依据；窗口、失败风险和失效信息均完成；表述使用“可能、如果、在……条件下”
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"basis-a","label":"判断A及依据","type":"long_text","required":true,"placeholder":"如果敌方相信……依据是……"},{"id":"basis-b","label":"判断B及依据","type":"long_text","required":true,"placeholder":"如果敌方怀疑或另作判断……依据是……"},{"id":"window","label":"我方可能利用的窗口","type":"long_text","required":true},{"id":"risk","label":"判断失败风险","type":"long_text","required":true},{"id":"invalidate","label":"哪条新信息会使判断失效","type":"short_text","required":true}]}}
- 知识引用：K-13, K-15
- 引导引用：guidance/intelligence-strategist.md#任务3
- 限制引用：restrictions.md#三四渡虚实关系
- 评估引用：evaluation.md#S4, evaluation.md#S5, evaluation.md#C2
- 脚手架引用：scaffolds/intelligence-strategist.md#任务3
- 常见误区：只写成功窗口，不记录信号未被相信或被识破的失败风险
- 最大尝试：3
- 失败处理：絮絮只提示缺少的分支、窗口或风险字段，不补写历史行动结论
- 教师介入：连续3次仍只能给出单一路径或确定性结论
- 通过后：role-stage:complete

## Phase 3 行为
- 向小组贡献：情报四象限、可靠度和敌方可能反应
- 拼合贡献：五层战图中的“情报层”
- 需要其他角色：地图参谋提供空间位置，示形参谋提供可被观察的行动信号

## Phase 4 璇玑参数
- 负责说明：命令经过层级传递后，基层个体实际得到的信息如何缩减
