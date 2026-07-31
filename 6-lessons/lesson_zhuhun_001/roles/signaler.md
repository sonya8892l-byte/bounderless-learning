# 📻 通讯兵

> 核心问题：只收到局部命令、看不到全局时，一个人依据什么确认信息并可靠行动？

## 基本信息
- 排序：5
- 地点：亲历者回忆与士兵生活展区
- 地理围栏：中国共产党历史展览馆课程动线内
- 类型：核心角色
- 选择说明：负责从基层视角检查命令如何传递、确认和执行，记录全局战略在个人信息中留下的有限线索。
- 角色卡图：assets/roles/role-card-signaler.png
- 角色徽章图：assets/roles/badge-signaler.png
- 收集物：视角层
- 收集物图：assets/tokens/layer-perspective.png
- 关键数据：基层行动者通常只掌握完成当前行动所需的局部信息

## 任务列表

### 任务1：收残讯
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
- 功能模块：A01(拍照采集/语音), A07(扫码)
- 任务图：assets/tasks/limited-message.svg
- 配置：寻找通信工具、口述回忆或士兵生活相关展项，拍摄至少2处允许拍摄的证据；记录一名基层行动者可能收到的信息和仍然不知道的信息
- 通过条件：至少2张有效照片 + 1条展项来源 + “已知/未知”各至少2项
- 目标关联：K4(情报与信息差), S3(史料实证), C5(多视角同理)
- AI引导方向：从物件和展项说明出发，避免代替历史人物编写心理或对话

#### Step 1：采集基层通信证据

- id：signal-capture-evidence
- 小步目标：获得能够说明基层信息如何传递的物件或回忆材料证据
- 学生行动：拍摄一张通信工具、口述回忆或士兵生活展项全景，再拍一张对应说明牌局部
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少2张照片；全景能够确认展项类型，局部保留标题、用途、回忆来源或时间中的至少一项；不识别其他参观者身份
- 功能模块：A01(拍照)
- 工具参数：{"photo":{"minCount":2,"maxCount":4,"accept":"image/*","recognition":"grassroots-communication-source","prompt":"先拍展项全景，再拍说明文字；照片用于判断基层能收到什么信息和还不知道什么。"}}
- 知识引用：K-19
- 引导引用：guidance/signaler.md#任务1
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务1
- 常见误区：从物件外观直接编写普通士兵的经历、原话或心理活动
- 最大尝试：3
- 失败处理：指出缺少展项主体或说明来源中的哪张照片，请学生补拍
- 教师介入：展馆禁止拍摄，或连续3次无法取得可辨认来源
- 通过后：step:signal-sort-known-unknown

#### Step 2：区分已知与未知

- id：signal-sort-known-unknown
- 小步目标：从基层视角区分执行当前行动所需信息和无法获得的全局信息
- 学生行动：把6张信息卡放入“基层可以确认、需要再次确认、当时无法知道”三个区域
- 位置：inherit
- 完成方式：tool_result
- 证据要求：6张卡全部分类；“基层可以确认”和“当时无法知道”各至少2张；不能用全局战图替基层补信息
- 功能模块：A03(分类搭建)
- 工具参数：{"builder":{"mode":"evidence-wall","prompt":"站在基层行动者当时的位置分类：哪些能直接确认，哪些要向上级核对，哪些属于全局信息。","items":[{"id":"current-action","label":"当前需要完成的动作"},{"id":"time-place","label":"命令中明确的时间或地点"},{"id":"confirm-person","label":"可以确认信息的对象"},{"id":"global-purpose","label":"行动的完整战略目的"},{"id":"whole-route","label":"后续全部路线"},{"id":"enemy-full-plan","label":"敌方完整部署与真实意图"}],"zones":[{"id":"known","label":"基层可以确认"},{"id":"needs-confirmation","label":"需要再次确认"},{"id":"unknown","label":"当时无法知道"}],"correctMapping":{"current-action":"known","time-place":"known","confirm-person":"needs-confirmation","global-purpose":"unknown","whole-route":"unknown","enemy-full-plan":"unknown"},"retryMessage":"先判断完成当前动作是否真的需要这项信息，再区分可确认、需追问和当时无法知道。"}}
- 知识引用：K-19
- 引导引用：guidance/signaler.md#任务1
- 限制引用：restrictions.md#跨角色隔离
- 评估引用：evaluation.md#K4, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务1
- 常见误区：认为可靠执行必须先知道全部战略原因和后续路线
- 最大尝试：3
- 失败处理：追问“完成当前动作真的需要知道这一项吗”，请学生只调整一张有争议的卡
- 教师介入：连续3次仍无法区分当前命令与全局解释
- 通过后：step:signal-mark-evidence-boundary

#### Step 3：检查叙述边界

- id：signal-mark-evidence-boundary
- 小步目标：用可追溯语言描述基层视角，同时保留推断和未知
- 学生行动：选择一组符合史料边界的基层信息记录
- 位置：none
- 完成方式：tool_result
- 证据要求：正确选择同时区分材料明确说明、合理推测和无法确认的表达
- 功能模块：A02(单选答题)
- 工具参数：{"quiz":{"type":"single_choice","question":"根据一件通信工具展项，哪种记录最符合证据边界？","options":["这名士兵一定知道全局计划，也完全理解每次转向原因","展项说明这种工具用于传递信息；基层能收到什么需结合具体命令，其他内容暂时未知","请AI补写一段士兵当时说过的话，让记录更生动"],"answer":"展项说明这种工具用于传递信息；基层能收到什么需结合具体命令，其他内容暂时未知","explanation":"物件能支持传递方式判断，无法直接证明某个普通士兵的具体经历、原话和心理。","retryMessage":"回到展项能直接证明的范围：它说明传递方式，具体人物信息仍需史料。"}}
- 知识引用：K-19, K-21
- 引导引用：guidance/signaler.md#任务1
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#C3, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务1
- 常见误区：把课程插图、物件功能或合理想象直接当作具体人物史料
- 最大尝试：2
- 失败处理：提示学生区分“物件功能”和“人物经历”后重新选择
- 教师介入：连续2次仍选择虚构人物直接引语或经历
- 通过后：role-stage:task-2

### 任务2：译行动
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
- 功能模块：A02(表单), A05(组内讨论)
- 任务图：assets/tasks/limited-message.svg
- 配置：读取一张经过裁剪的命令卡，填写“要做什么、何时何地、向谁确认、缺什么信息、何时呼叫上级”；与同伴复述并核对差异
- 通过条件：五项信息完整 + 完成1次同伴复述核对 + 标记至少1项不能自行猜测的内容
- 目标关联：S4(信息不对称分析), C4(民主与担当), C5(多视角同理)
- AI引导方向：帮助区分执行所需信息和全局解释，强调关键信息缺失时的确认机制

#### Step 1：阅读裁剪命令

- id：signal-read-command
- 小步目标：体验基层行动者只能获得局部命令的信息条件
- 学生行动：完整查看课程提供的裁剪命令卡，只记录卡片明确出现的内容
- 位置：none
- 完成方式：tool_result
- 证据要求：完成命令卡查看；不得使用全局战图补出卡片中没有的行动原因和后续路线
- 功能模块：A06(沉浸媒体)
- 工具参数：{"media":{"type":"image","url":"assets/tasks/limited-message.svg","title":"课程推演局部命令卡｜只使用卡片当前可见信息","requireCompletion":true,"prompt":"先独立阅读，不向其他角色索取全局答案；下一步再拆出执行字段。"}}
- 知识引用：K-19
- 引导引用：guidance/signaler.md#任务2
- 限制引用：restrictions.md#跨角色隔离
- 评估引用：evaluation.md#S4, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务2
- 常见误区：看到命令卡后立即用后来掌握的全局路线解释每句话
- 最大尝试：2
- 失败处理：重新显示命令卡，并提醒学生先圈出卡片原有字段
- 教师介入：命令卡素材无法加载，或课程卡片与教师资料不一致
- 通过后：step:signal-extract-command

#### Step 2：拆出执行字段

- id：signal-extract-command
- 小步目标：从局部命令中提取能够执行、需要确认和必须上报的信息
- 学生行动：填写要做什么、何时何地、向谁确认、缺什么信息和何时呼叫上级五项
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：五项均完成；命令卡没有写明的字段标“缺失/需确认”；至少1项明确不能自行猜测
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"action","label":"要做什么","type":"long_text","required":true,"placeholder":"只转述命令卡明确动作"},{"id":"when-where","label":"何时、何地","type":"short_text","required":true,"placeholder":"缺失时写“需确认”"},{"id":"confirm-with","label":"向谁确认","type":"short_text","required":true},{"id":"missing","label":"缺什么信息，不能自行猜测","type":"long_text","required":true},{"id":"escalate","label":"何时呼叫上级或老师","type":"long_text","required":true}]}}
- 知识引用：K-19
- 引导引用：guidance/signaler.md#任务2
- 限制引用：restrictions.md#教学限制, restrictions.md#安全限制
- 评估引用：evaluation.md#S4, evaluation.md#C4, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务2
- 常见误区：关键信息缺失时自行猜测时间、地点或对象，并继续行动
- 最大尝试：3
- 失败处理：指出时间、地点、对象、缺失信息或上报条件中的一个缺口，请学生补齐
- 教师介入：连续3次仍无法识别关键信息缺失，或学生提出现场安全问题
- 通过后：step:signal-retell-command

#### Step 3：口头复述命令

- id：signal-retell-command
- 小步目标：检验局部命令经过一次口头传递后是否仍保留关键执行信息
- 学生行动：用20至45秒向同伴复述命令，必须包含动作、时间地点、确认对象和一项未知
- 位置：none
- 完成方式：tool_result
- 证据要求：录音不少于20秒、不超过45秒；包含四类信息；不得添加命令卡中没有的历史人物原话
- 功能模块：A01(语音记录)
- 工具参数：{"audio":{"minSeconds":20,"maxSeconds":45,"language":"zh-CN","transcribe":true,"prompt":"像向同伴传达任务一样复述：动作、时间地点、确认对象，以及一项仍未知的信息。"}}
- 知识引用：K-19
- 引导引用：guidance/signaler.md#任务2
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S6, evaluation.md#C4, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务2
- 常见误区：为了让命令完整而自行添加行动原因、后续路线或人物直接引语
- 最大尝试：3
- 失败处理：根据转写只提示缺少的一个关键信息，请学生重新录制
- 教师介入：麦克风持续不可用，或学生无法进行口头表达需要替代方式
- 通过后：step:signal-compare-retelling

#### Step 4：核对传递差异

- id：signal-compare-retelling
- 小步目标：发现命令在复述中可能出现的遗漏、改变和需要再次确认之处
- 学生行动：让同伴复述刚才听到的内容，并至少记录两条核对结果：一条一致信息和一条差异或待确认信息
- 位置：none
- 完成方式：tool_result
- 证据要求：至少2条组内记录；包含1条一致项和1条差异或待确认项；关键地点、时间或对象有差异时标记“暂停并确认”
- 功能模块：A05(团队核对)
- 工具参数：{"team":{"mode":"discussion","prompt":"记录同伴复述后的核对结果：先写一条一致信息，再写一条遗漏、改变或待确认信息。","minimumEntries":2,"roles":["原始复述者","同伴复述者","核对记录者"],"recordTypes":["一致信息","遗漏或改变","待确认信息"],"requiredRecordTypes":["一致信息","遗漏或改变"]}}
- 知识引用：K-19
- 引导引用：guidance/signaler.md#任务2
- 限制引用：restrictions.md#教学限制, restrictions.md#安全限制
- 评估引用：evaluation.md#C4, evaluation.md#C5, evaluation.md#协作维度
- 脚手架引用：scaffolds/signaler.md#任务2
- 常见误区：只记录两次复述相同，不主动寻找遗漏和需要再次确认的信息
- 最大尝试：3
- 失败处理：提示同伴对照动作、时间地点和确认对象三类信息，只补一条差异记录
- 教师介入：关键信息差异无法解决、组内沟通冲突，或需要现实现场确认
- 通过后：role-stage:task-3

### 任务3：写边界
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
- 功能模块：A01(文字/语音), A02(证据标注)
- 任务图：assets/tasks/limited-message.svg
- 配置：以基层视角写一段80—150字行动记录，只写角色当时可能知道、看到或被告知的内容；每句话标记史料依据、合理推断或未知
- 通过条件：达到字数 + 至少引用2条证据 + 三类边界标记完整 + 无虚构直接引语
- 目标关联：S3(史料实证), S6(因果表达), C3(证据边界), C5(多视角同理)
- AI引导方向：逐句检查信息边界；允许表达犹豫和未知，不补写无法证实的情节

#### Step 1：完成基层记录初稿

- id：signal-write-draft
- 小步目标：从基层有限视角形成有明确字数和证据边界的行动记录
- 学生行动：写一段80至150字的行动记录，只写角色当时可能知道、看到或被告知的内容
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：80至150字；至少引用任务1展项证据和任务2命令卡各1条；不生成真实历史人物直接引语、姓名或心理活动
- 功能模块：A01(文字表单)
- 工具参数：{"text":{"fields":[{"id":"draft","label":"基层行动记录（80—150字）","type":"long_text","required":true,"minLength":80,"maxLength":150,"placeholder":"可以写“命令只说明……”“我无法确认……”；不要冒充真实人物口述。"},{"id":"source-one","label":"证据1：展项或照片编号","type":"short_text","required":true},{"id":"source-two","label":"证据2：局部命令卡字段","type":"short_text","required":true}]}}
- 知识引用：K-19, K-21
- 引导引用：guidance/signaler.md#任务3
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#S6, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务3
- 常见误区：用第一人称写作时自动冒充真实历史人物，并添加未经记录的原话和心理
- 最大尝试：3
- 失败处理：指出字数、证据或越界信息中的一个问题，保留原稿后局部修改
- 教师介入：连续3次仍包含无法核验的真实人物直接引语或敏感战场细节
- 通过后：step:signal-label-sentences

#### Step 2：逐句标记来源

- id：signal-label-sentences
- 小步目标：把初稿中的句子区分为史料依据、合理推断和未知
- 学生行动：将6张句子序号卡放入三种来源区域；不足6句时把多余卡放入“未使用”
- 位置：none
- 完成方式：tool_result
- 证据要求：6张卡全部放置；史料依据、合理推断和未知三个区域均至少使用一次；未使用卡明确归档
- 功能模块：A03(分类搭建)
- 工具参数：{"builder":{"mode":"evidence-wall","prompt":"按初稿句子顺序分类；每句话只选一个当前最合适的来源标签。","items":[{"id":"sentence-1","label":"第1句"},{"id":"sentence-2","label":"第2句"},{"id":"sentence-3","label":"第3句"},{"id":"sentence-4","label":"第4句"},{"id":"sentence-5","label":"第5句"},{"id":"sentence-6","label":"第6句或未使用"}],"zones":[{"id":"evidence","label":"史料依据"},{"id":"inference","label":"合理推断"},{"id":"unknown","label":"未知"},{"id":"unused","label":"未使用"}],"bindings":{"sentence-1":{"taskId":"task-3","stepId":"signal-write-draft","toolId":"text","fieldId":"draft","split":"sentences","index":0,"prefix":"第1句："},"sentence-2":{"taskId":"task-3","stepId":"signal-write-draft","toolId":"text","fieldId":"draft","split":"sentences","index":1,"prefix":"第2句："},"sentence-3":{"taskId":"task-3","stepId":"signal-write-draft","toolId":"text","fieldId":"draft","split":"sentences","index":2,"prefix":"第3句："},"sentence-4":{"taskId":"task-3","stepId":"signal-write-draft","toolId":"text","fieldId":"draft","split":"sentences","index":3,"prefix":"第4句："},"sentence-5":{"taskId":"task-3","stepId":"signal-write-draft","toolId":"text","fieldId":"draft","split":"sentences","index":4,"prefix":"第5句："},"sentence-6":{"taskId":"task-3","stepId":"signal-write-draft","toolId":"text","fieldId":"draft","split":"sentences","index":5,"prefix":"第6句："}},"zoneMinimums":{"evidence":1,"inference":1,"unknown":1}}}
- 知识引用：K-19, K-21
- 引导引用：guidance/signaler.md#任务3
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#C3, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务3
- 常见误区：把所有第一人称句子都当成史实，或完全删除表达未知的句子
- 最大尝试：3
- 失败处理：选取一条没有来源的句子，追问“材料明确写了、你合理推断，还是仍不知道”
- 教师介入：学生无法理解三种来源标签，或对史料真实性提出需要核验的问题
- 通过后：step:signal-check-boundary

#### Step 3：完成边界检查

- id：signal-check-boundary
- 小步目标：在提交前排除虚构直接引语和越过基层视角的信息
- 学生行动：选择初稿提交前必须执行的全部检查项
- 位置：none
- 完成方式：tool_result
- 证据要求：正确选择来源标记、信息范围、直接引语和未知保留四项检查
- 功能模块：A02(多选答题)
- 工具参数：{"quiz":{"type":"multiple_choice","question":"基层行动记录提交前，需要完成哪些检查？","options":["每句话标明史料依据、合理推断或未知","删除角色当时不可能知道的全局路线","没有可靠来源的历史人物直接引语改为转述或删除","允许保留“我无法确认”的信息边界","加入更多战场细节，让文本更像真实回忆"],"answer":["每句话标明史料依据、合理推断或未知","删除角色当时不可能知道的全局路线","没有可靠来源的历史人物直接引语改为转述或删除","允许保留“我无法确认”的信息边界"],"explanation":"边界清楚的记录可以保留未知和课程推断，不通过虚构细节制造真实感。","retryMessage":"再检查来源、角色能知道什么、直接引语和未知四个方面。"}}
- 知识引用：K-19, K-21
- 引导引用：guidance/signaler.md#任务3
- 限制引用：restrictions.md#史料与表达限制
- 评估引用：evaluation.md#S3, evaluation.md#C3, evaluation.md#C5
- 脚手架引用：scaffolds/signaler.md#任务3
- 常见误区：认为文字越生动越好，因此加入史料没有记录的原话、心理和战场细节
- 最大尝试：3
- 失败处理：提示学生重新检查“角色当时能知道什么”和“哪些话有可靠来源”
- 教师介入：连续3次仍选择加入虚构细节，或学生需要讨论情境材料的史料边界
- 通过后：role-stage:complete

## Phase 3 行为
- 向小组贡献：局部命令卡、信息缺口和基层执行边界
- 拼合贡献：五层战图中的“视角层”
- 需要其他角色：决策参谋解释决策如何转为命令，示形参谋解释行动先后

## Phase 4 璇玑参数
- 负责主持：全局指挥视角与基层有限视角的双栏对照
