# 行动方案设计员

> 核心问题：在证据、资源和相关者约束下，怎样形成能执行、监测和修订的守护行动？

## 基本信息
- 排序：6
- 地点：教育空间
- 地理围栏：国家动物博物馆课程允许区域
- 类型：核心角色
- 选择说明：整合六线证据，主持资源分配，完成行动书三轮修订与发布。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：行动章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：定义方案成功
- id：designer-define-success
- 阶段：Phase 2 展厅多源取证（角色取证准备）
- 地点：教育空间
- 位置模式：none
- 建议时长：12min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：先定义可观察的成功，再等待证据决定行动
- 通过条件：形成一个目标草案、两个可监测指标和证据需求

##### 引导
- 用对象、变化、期限、指标四问收窄目标。
- 先登记可能改变方案的证据，避免先定答案。

##### 脚手架
| L0 | 先写希望谁发生什么变化。 |
| L1 | 补期限和判断方法。 |
| L2 | 将证据需求分为四类。 |
| L3 | 标出可能改变方案的证据。 |
| L4 | 教师帮助收窄目标边界。 |

#### Step 1：写目标草案
- id：designer-draft-goal
- 小步目标：把“保护它”改成有对象、变化和期限的目标
- 学生行动：填写目标对象、希望变化、期限和判断成功的方法
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：目标包含对象、变化、期限和指标方向
- 功能模块：A01(目标表单)
- 工具参数：{"text":{"fields":[{"id":"target","label":"目标对象","type":"short_text","required":true},{"id":"change","label":"希望出现的变化","type":"long_text","required":true},{"id":"time","label":"期限","type":"short_text","required":true},{"id":"measure","label":"怎样判断","type":"long_text","required":true}]}}
- 知识引用：K-13, K-17
- 限制引用：course.md#课程限制规则/方案效力
- 常见误区：写“提高大家意识”但无法观察
- 最大尝试：3
- 失败处理：追问谁、改变什么、何时看、用什么看
- 教师介入：目标超出课程建议能力边界
- 通过后：step:designer-list-evidence-needs

##### 验收标准
目标包含对象、变化、期限和指标方向
- S1 开题：核心问题可调查，来源计划覆盖现场、名录/数据库和措施材料。

#### Step 2：登记证据需求
- id：designer-list-evidence-needs
- 小步目标：让方案设计等待调查证据
- 学生行动：为目标列出风险、措施、相关者和资源四类所需证据
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：四类各至少1项，并指定负责角色
- 功能模块：A03(证据需求板)
- 工具参数：{"builder":{"mode":"board","prompt":"列出目标成立前需要的四类证据，并分配给角色。","minimumItems":4,"categories":["风险证据","措施证据","相关者证据","资源证据"]}}
- 知识引用：K-17
- 限制引用：course.md#课程限制规则/AI代写
- 常见误区：提前锁定行动，再选择性找证据
- 最大尝试：2
- 失败处理：要求至少写一项可能改变方案的证据
- 教师介入：无
- 通过后：role-stage:designer-allocate-resources

##### 验收标准
风险、措施、相关者和资源四类证据各有一项，并已分配负责角色

### 任务2：模拟资源配置
- id：designer-allocate-resources
- 阶段：Phase 4 保护措施审计
- 地点：教育空间
- 位置模式：none
- 建议时长：25min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：在有限筹码下选择行动并公开取舍
- 通过条件：完成一轮配置、一轮冲击调整和取舍说明

##### 引导
- 只追问取舍依据，不宣布最佳分配。
- 约束变化后检查依赖关系和恢复条件。

##### 脚手架
| L0 | 先确定一个优先目标。 |
| L1 | 每项资源绑定风险或缺口。 |
| L2 | 写出暂缓什么。 |
| L3 | 约束变化后找受影响的依赖。 |
| L4 | 教师澄清模拟规则。 |

#### Step 1：配置首轮资源
- id：designer-first-allocation
- 小步目标：依据风险和缺口分配有限资源
- 学生行动：将100点资源分给候选行动，说明优先目标和暂缓项目
- 位置：none
- 完成方式：tool_result
- 证据要求：总计100点；至少3项行动；每项引用风险或缺口
- 功能模块：A04(资源模拟)
- 工具参数：{"simulation":{"mode":"budget","prompt":"在100点预算内配置至少3项行动，每项绑定风险链或保护缺口。","budget":100,"minimumItems":3}}
- 知识引用：K-12, K-16
- 限制引用：course.md#课程限制规则/风险排序
- 常见误区：平均分配以回避优先级
- 最大尝试：3
- 失败处理：要求说明哪一项先做会带来最大可验证变化
- 教师介入：总额或行动边界不清
- 通过后：step:designer-shock-revision

##### 验收标准
资源总计100点，至少3项行动均关联风险或缺口，并说明暂缓项目

#### Step 2：应对约束变化
- id：designer-shock-revision
- 小步目标：检验方案在资源减少或新证据出现时能否调整
- 学生行动：抽取一张约束卡，重新配置并记录变化理由
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：新旧配置差异、调整依据、被延后行动和触发恢复条件
- 功能模块：A04(情境推演), A01(文字)
- 工具参数：{"simulation":{"mode":"scenario","prompt":"从预算减少、关键证据降级、相关者成本上升中抽取一项约束。","scenarios":["预算减少30%","一条关键证据降为待核","一类相关者成本显著上升"]},"text":{"fields":[{"id":"revision","label":"调整与理由","type":"long_text","required":true,"minLength":80}]}}
- 知识引用：K-15, K-16
- 限制引用：course.md#课程限制规则/方案效力
- 常见误区：只减少数字，行动逻辑不变
- 最大尝试：3
- 失败处理：追问哪些行动依赖被改变的条件
- 教师介入：无
- 通过后：role-stage:designer-publish-plan

##### 验收标准
记录新旧配置差异、调整依据、延后行动及恢复条件

### 任务3：发布守护行动书
- id：designer-publish-plan
- 收口方式：teacher_confirm
- 阶段：Phase 6 行动书发布
- 地点：教育空间
- 位置模式：none
- 建议时长：16min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：整合调查、听证和资源模拟，形成可复盘的课程建议
- 通过条件：七要素完整，引用六线证据，含版本修订和AI披露

##### 引导
- 每轮只检查七要素中的一个缺项。
- 提醒声明课程建议稿、AI使用、人工核验和待核问题。

##### 脚手架
| L0 | 自查七要素。 |
| L1 | 每项行动追溯风险和缺口。 |
| L2 | 补听证处置与版本变化。 |
| L3 | 补AI披露、人工核验和待核。 |
| L4 | 教师确认发布边界。 |

#### Step 1：完成行动书二稿
- id：designer-compose-action-book
- 小步目标：让每项行动连接风险、缺口、主体、资源和指标
- 学生行动：填写七要素，并标注证据编号、未知项和复盘日期
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：目标、行动、主体、资源、时间、指标、复盘完整；至少6个证据编号
- 功能模块：A01(结构化文档)
- 工具参数：{"text":{"fields":[{"id":"action-book","label":"物种守护行动书二稿","type":"long_text","required":true,"minLength":350},{"id":"ai-disclosure","label":"AI使用与人工核验","type":"long_text","required":true,"minLength":30}]}}
- 知识引用：K-13, K-17, K-19
- 限制引用：course.md#课程限制规则/表达与决策
- 常见误区：每个行动都合理，但没有责任主体或指标
- 最大尝试：3
- 失败处理：一次只提示一个缺失要素
- 教师介入：方案包含现实执行承诺或安全风险
- 通过后：step:designer-final-revision

##### 验收标准
七要素完整，至少标注6个证据编号，并列出未知项和复盘日期

#### Step 2：完成听证修订并发布
- id：designer-final-revision
- 小步目标：留下可解释的版本变化和发布边界
- 学生行动：逐条处理听证意见，生成终稿并声明“课程建议稿”
- 位置：none
- 完成方式：teacher_confirm
- 证据要求：至少3条意见处置、版本差异、待核清单和人工终审
- 功能模块：A05(版本对照)
- 工具参数：{"team":{"mode":"revision","prompt":"登记意见、采纳状态、修改位置与理由；完成后交由教师核对来源、效力表述、安全边界和AI披露。","minimumEntries":3}}
- 知识引用：K-15, K-17, K-19
- 限制引用：course.md#课程限制规则/方案效力
- 常见误区：把课堂通过写成机构采纳
- 最大尝试：1
- 失败处理：退回具体问题位置修改，未核项保留待核
- 教师介入：必须
- 通过后：role:complete

##### 验收标准
至少3条意见处置、版本差异、待核清单和人工终审
- S5 听证：至少回应三类利益相关者并保留修订记录。
