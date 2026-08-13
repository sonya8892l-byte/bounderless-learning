# 物种档案员

> 核心问题：我们关于这个物种的基础判断，分别来自哪里、适用于什么范围？

## 基本信息
- 排序：1
- 地点：教师确认的物种展项与教育空间
- 地理围栏：国家动物博物馆课程允许动线
- 类型：核心角色
- 选择说明：建立可追溯物种档案，整理形态、分布、栖息地与种群线索。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：档案章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：建立档案骨架
- id：profiler-baseline
- 阶段：Phase 2 展厅多源取证（角色取证准备）
- 地点：教育空间
- 位置模式：none
- 建议时长：12min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：先写已知、未知和需要的来源，不让AI直接填档案
- 通过条件：至少4个档案字段，分别标记已有证据或待核

##### 引导
- 先让学生提出字段问题，再讨论来源；每轮只处理一个字段。
- 动态字段必须追问时间、空间范围和人工核验。

##### 脚手架
| L0 | 自己列出最想查的档案字段。 |
| L1 | 身份、分布、栖息地、食性、种群中选四项。 |
| L2 | 每项改写成一个问题。 |
| L3 | 给每个问题匹配来源类型。 |
| L4 | 教师帮助缩小一个过大的字段。 |

#### Step 1：提出档案问题
- id：profiler-frame-questions
- 小步目标：把笼统的“了解物种”转成可调查字段
- 学生行动：选择身份、形态、分布、栖息地、食性和种群中的至少4项，写出待查问题
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少4个问题，每个问题指向一个明确字段
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"questions","label":"档案问题","type":"long_text","required":true,"minLength":40,"placeholder":"例：资料所说的分布范围对应哪一年？"}]}}
- 知识引用：K-01, K-04
- 限制引用：restrictions.md#动态信息
- 常见误区：直接写一段百科式介绍
- 最大尝试：3
- 失败处理：提示把介绍句改成“要查什么、用什么来源”
- 教师介入：问题范围无法在课内完成
- 通过后：step:profiler-plan-sources

##### 验收标准
至少4个问题，每个问题指向一个明确字段
- S1 开题：核心问题可调查，来源计划覆盖现场、名录/数据库和措施材料。

#### Step 2：规划来源
- id：profiler-plan-sources
- 小步目标：为不同字段匹配合适来源
- 学生行动：把现场展签、馆方资料、权威数据库或研究材料分配给档案字段
- 位置：none
- 完成方式：tool_result
- 证据要求：至少4条字段—来源计划，含一条动态信息核验计划
- 功能模块：A03(来源配对)
- 工具参数：{"builder":{"mode":"mapping","prompt":"把每个档案字段连到最合适的来源类型；动态字段增加日期和人工核验。","minimumItems":4,"categories":["现场展签","馆方资料","权威名录或数据库","监测或研究材料"]}}
- 知识引用：K-04, K-05
- 限制引用：restrictions.md#动态信息
- 常见误区：所有字段只写“上网查”
- 最大尝试：2
- 失败处理：追问这个来源是否适合该主张
- 教师介入：指定数据库或网络不可用
- 通过后：role-stage:profiler-field-evidence

##### 验收标准
至少4条字段—来源配对，且一条动态信息含日期与人工核验计划

### 任务2：现场建档
- id：profiler-field-evidence
- 阶段：Phase 2 展厅多源取证
- 地点：教师确认的物种展项
- 位置模式：point
- 到达验证：teacher
- 建议时长：28min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：用现场观察和展签建立带编号的物种档案
- 通过条件：至少3条现场事实和1条动态待核项，均有来源编号

##### 引导
- 先观察和读取展签，再按需开放知识卡。
- 允许“待核”，不为填满档案推测学名、数量或趋势。

##### 脚手架
| L0 | 先拍来源，再写事实。 |
| L1 | 每条事实旁写照片或展签编号。 |
| L2 | 动态信息补时间和空间范围。 |
| L3 | 用“主张—来源—日期—局限”表。 |
| L4 | 请教师处理点位或来源冲突。 |

#### Step 1：采集现场事实
- id：profiler-capture-facts
- 小步目标：保存可回到展项复核的身份、形态和生态线索
- 学生行动：拍摄展品与展签，填写三条事实及其照片编号
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少1张照片、3条事实和对应来源编号；不拍他人正脸
- 功能模块：A01(拍照), A01(文字)
- 工具参数：{"photo":{"prompt":"拍摄展品主体和可定位的展签区域，避开他人正脸。","minCount":1,"maxCount":4},"text":{"fields":[{"id":"facts","label":"三条现场事实与来源编号","type":"long_text","required":true,"minLength":50}]}}
- 知识引用：K-05, K-18
- 限制引用：restrictions.md#调查伦理
- 常见误区：照片和文字无法对应
- 最大尝试：3
- 失败处理：只要求补齐缺失的编号或来源画面
- 教师介入：展项闭展、禁止拍摄或身份冲突
- 通过后：step:profiler-register-limit

##### 验收标准
至少1张合规照片对应3条现场事实，且每条事实附来源编号

#### Step 2：登记范围与局限
- id：profiler-register-limit
- 小步目标：说明档案信息适用的时间、空间和证据范围
- 学生行动：选择一条分布或种群信息，记录日期、范围、局限和待核办法
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：日期/版本、空间范围、局限、核验办法四项齐全
- 功能模块：A01(档案表单)
- 工具参数：{"text":{"fields":[{"id":"claim","label":"动态主张","type":"long_text","required":true},{"id":"date","label":"发布日期或版本","type":"short_text","required":true},{"id":"scope","label":"空间范围","type":"short_text","required":true},{"id":"limit","label":"局限与待核办法","type":"long_text","required":true}]}}
- 知识引用：K-04, K-07
- 限制引用：restrictions.md#动态信息
- 常见误区：把单个年份的数量称为趋势
- 最大尝试：3
- 失败处理：提示缺少时间、空间、局限中的哪一项
- 教师介入：动态数据需要专家解释
- 通过后：role-stage:profiler-publish-file

##### 验收标准
动态主张的日期或版本、空间范围、局限和待核办法均已填写

### 任务3：发布物种档案
- id：profiler-publish-file
- 阶段：Phase 6 行动书发布
- 地点：教育空间
- 位置模式：none
- 建议时长：12min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：将档案压缩成行动书可用的事实底稿
- 通过条件：档案字段、来源表和未知项完整，并通过同伴复核

##### 引导
- 检查每条关键事实能否回到来源编号。
- 要求保留局限与未知，AI只帮助压缩和排版。

##### 脚手架
| L0 | 检查五个字段和一个未知。 |
| L1 | 逐句圈出来源编号。 |
| L2 | 找不到来源的句子改成待核。 |
| L3 | 邀请两名角色交叉复核。 |
| L4 | 教师确认高风险动态字段。 |

#### Step 1：生成档案条目
- id：profiler-compose-file
- 小步目标：形成清楚、可引用且保留未知的物种档案
- 学生行动：按身份、分布、栖息地、食性、种群线索和未知项整理
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少5个字段；关键事实带来源编号；至少1个未知项
- 功能模块：A01(结构化文档)
- 工具参数：{"text":{"fields":[{"id":"profile","label":"物种档案","type":"long_text","required":true,"minLength":180},{"id":"unknown","label":"仍待核验","type":"long_text","required":true,"minLength":15}]}}
- 知识引用：K-01, K-04, K-07
- 限制引用：restrictions.md#表达与决策
- 常见误区：删掉不确定信息让档案显得完整
- 最大尝试：2
- 失败处理：要求恢复至少一个局限或待核项
- 教师介入：无
- 通过后：step:profiler-peer-check

##### 验收标准
至少5个档案字段完整，关键事实附来源编号，并保留一个未知项

#### Step 2：交叉复核
- id：profiler-peer-check
- 小步目标：确认档案与名录、威胁证据没有概念冲突
- 学生行动：邀请名录核验员和威胁链分析员各核对一处
- 位置：none
- 完成方式：tool_result
- 证据要求：两条复核记录，含确认、修订或待核及理由
- 功能模块：A05(团队核验)
- 工具参数：{"team":{"mode":"review","prompt":"分别核对保护身份/趋势和威胁背景，写明依据。","minimumEntries":2,"roles":["名录核验员","威胁链分析员"],"recordTypes":["确认","修订","待核"]}}
- 知识引用：K-06, K-19
- 限制引用：restrictions.md#表达与决策
- 常见误区：只有“同意”没有理由
- 最大尝试：2
- 失败处理：提醒补写核对的字段与证据编号
- 教师介入：复核产生无法解释的来源冲突
- 通过后：role:complete

##### 验收标准
名录核验员和威胁链分析员各留一条复核记录，含处理结果与理由
