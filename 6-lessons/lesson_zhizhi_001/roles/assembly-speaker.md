# 议事发言人

> 核心问题：怎样用证据回应质询，并把认识变成一项能检查的行动？

## 基本信息
- 排序：6
- 地点：教育空间
- 地理围栏：国家动物博物馆课程允许动线
- 类型：核心角色
- 选择说明：负责组织小组发布、回应证据问题，并带领每个人形成行动承诺。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：议事章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：准备发布
- id：speaker-prepare-release
- 阶段：Phase 6 居民发布会
- 地点：教育空间
- 位置模式：none
- 建议时长：4min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：从ID Card中选出一个核心判断和两条证据
- 通过条件：判断、证据和边界完整

##### 引导
- 引导小组围绕一个判断和两条证据表达。
- 练习回答时允许“待核”，禁止临时补造来源。

##### 脚手架
| L0 | 先自己选核心判断。 |
| L1 | 哪两条证据最能支持它？ |
| L2 | 补一条仍待核内容。 |
| L3 | 用“判断—证据—边界”三句结构。 |
| L4 | 请小组和教师检查争议事实。 |

#### Step 1：形成证据陈述
- id：speaker-build-claim
- 小步目标：让发布围绕一个清楚判断展开
- 学生行动：填写“我们的判断—证据1—证据2—仍待核”
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：两条证据来源不同，待核项真实存在
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"claim","label":"我们的核心判断","type":"long_text","required":true},{"id":"evidence-1","label":"证据1+来源","type":"short_text","required":true},{"id":"evidence-2","label":"证据2+来源","type":"short_text","required":true},{"id":"boundary","label":"仍待核或适用边界","type":"short_text","required":true}]}}
- 知识引用：K-21
- 限制引用：restrictions.md#发布边界
- 常见误区：用“大家都知道”代替证据
- 最大尝试：3
- 失败处理：追问证据编号或待核边界
- 教师介入：核心判断与小组证据冲突
- 通过后：step:speaker-rehearse-question

##### 验收标准
两条证据来源不同，待核项真实存在
- S4 保留异议和修改理由
- C1 主动删除无来源内容

#### Step 2：练习回应质询
- id：speaker-rehearse-question
- 小步目标：学会用证据、推断或待核回应问题
- 学生行动：请同伴提出一个“证据在哪里”的问题并记录回答
- 位置：none
- 完成方式：tool_result
- 证据要求：包含问题、回答和使用的证据编号
- 功能模块：A05(质询练习)
- 工具参数：{"team":{"mode":"discussion","prompt":"只提出一个最关键的证据问题；回答可以承认待核。","minimumEntries":2,"roles":["议事发言人","质询同伴"],"recordTypes":["证据问题","证据回应"],"requiredRecordTypes":["证据问题","证据回应"]}}
- 知识引用：K-21
- 限制引用：restrictions.md#事实与角色表达
- 常见误区：面对质疑时临时编出来源
- 最大尝试：2
- 失败处理：提醒使用“待核”或回到来源清单
- 教师介入：无
- 通过后：role-stage:speaker-present-assembly

##### 验收标准
包含问题、回答和使用的证据编号
- S4 保留异议和修改理由

### 任务2：完成议事发布
- id：speaker-present-assembly
- 收口方式：teacher_confirm
- 阶段：Phase 6 居民发布会
- 地点：教育空间
- 位置模式：none
- 建议时长：4min
- 推进方式：teacher
- 任务图：assets/placeholders/task.svg
- 配置：发布ID Card、自述和证据陈述，回应一次质询
- 通过条件：教师确认发布与回应完成

##### 引导
- 协调顺序和时长，不做组间排名。
- 现场问题超出课程范围时交给教师。

##### 脚手架
| L0 | 用自己的话发布。 |
| L1 | 先回答问题，再给证据。 |
| L2 | 不确定时明确说待核。 |
| L3 | 回答后记录保留或修改。 |
| L4 | 超范围问题交给教师。 |

#### Step 1：小组发布
- id：speaker-present
- 小步目标：向真实受众清楚呈现小组成果
- 学生行动：用不超过90秒展示ID Card和核心判断
- 位置：none
- 完成方式：teacher_confirm
- 证据要求：展示课程作品标识、至少两条证据和一项待核边界
- 功能模块：A01(录音)
- 工具参数：{"audio":{"prompt":"记录小组发布，用自己的话说明判断、证据和边界。","minSeconds":30,"maxSeconds":90,"language":"zh-CN","transcribe":true}}
- 知识引用：K-21, K-22
- 限制引用：restrictions.md#发布边界
- 常见误区：只介绍动物知识，没有证据和小组判断
- 最大尝试：1
- 失败处理：由教师决定是否补充一次简短说明
- 教师介入：必须
- 通过后：step:speaker-answer-live-question

##### 验收标准
展示课程作品标识、至少两条证据和一项待核边界
- S3 能区分事实、推断与期待
- S4 保留异议和修改理由

#### Step 2：回答现场问题
- id：speaker-answer-live-question
- 小步目标：接受公开检验并保留证据边界
- 学生行动：回答一个现场问题，记录是否需要修改ID Card
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：回答引用证据、标明推断或承认待核，并写修改决定
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"question","label":"现场问题","type":"long_text","required":true},{"id":"answer","label":"我们的回答与证据","type":"long_text","required":true},{"id":"revision","label":"保留/修改/待核及理由","type":"long_text","required":true}]}}
- 知识引用：K-21
- 限制引用：restrictions.md#发布边界
- 常见误区：把提问理解为必须坚持原答案
- 最大尝试：2
- 失败处理：追问“哪条证据支持回答”
- 教师介入：问题超出课程或涉及不适宜内容
- 通过后：role-stage:speaker-action-commitment

##### 验收标准
回答引用证据、标明推断或承认待核，并写修改决定
- S4 保留异议和修改理由
- C1 主动删除无来源内容

### 任务3：形成行动承诺
- id：speaker-action-commitment
- 阶段：Phase 6 居民发布会
- 地点：教育空间
- 位置模式：none
- 建议时长：3min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：带领每名组员提交一周内可观察的行动
- 通过条件：小组至少6条行动记录，每条含时间和观察方法

##### 引导
- 追问动作、对象、时间和观察方法。
- 涉及接触或救助野生动物时立即转教师与安全规则。

##### 脚手架
| L0 | 先想一件自己能做的事。 |
| L1 | 什么时候做？怎样知道做到了？ |
| L2 | 写动作、对象、时间、观察。 |
| L3 | 把口号缩小成一周行动。 |
| L4 | 涉及野生动物接触时请教师修改。 |

#### Step 1：设计个人行动
- id：speaker-design-action
- 小步目标：把保护意愿转化为可检查行动
- 学生行动：写下动作、对象、时间和一周后的观察方法
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：四项完整，行动安全且由学生自己能够完成
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"action","label":"我要做什么","type":"long_text","required":true},{"id":"target","label":"面向什么对象或场景","type":"short_text","required":true},{"id":"time","label":"何时做","type":"short_text","required":true},{"id":"check","label":"一周后怎样检查","type":"long_text","required":true}]}}
- 知识引用：K-17, K-18
- 限制引用：restrictions.md#场馆与隐私
- 常见误区：写“以后保护动物”
- 最大尝试：3
- 失败处理：追问具体动作和时间
- 教师介入：行动涉及接触、带走或擅自救助野生动物
- 通过后：step:speaker-collect-actions

##### 验收标准
四项完整，行动安全且由学生自己能够完成
- C3 一周后能用结果调整行动

#### Step 2：汇总行动墙
- id：speaker-collect-actions
- 小步目标：形成可在课后复盘的小组行动记录
- 学生行动：收集全组行动，确认每个人都有一条可识别记录
- 位置：none
- 完成方式：tool_result
- 证据要求：至少6条匿名行动记录
- 功能模块：A05(行动墙)
- 工具参数：{"team":{"mode":"commitment","prompt":"每人提交一条匿名行动，不比较难度。","minimumEntries":6,"roles":["全体组员"],"recordTypes":["个人行动"],"requiredRecordTypes":["个人行动"]}}
- 知识引用：K-17
- 限制引用：restrictions.md#发布边界
- 常见误区：由发言人代写全组行动
- 最大尝试：2
- 失败处理：提醒缺少行动记录的成员亲自提交
- 教师介入：无
- 通过后：role:complete

##### 验收标准
至少6条匿名行动记录
- C3 一周后能用结果调整行动
