# 生态关系员

## 基本信息
- 排序：3
- 地点：动物标本点与教育空间
- 地理围栏：国家动物博物馆课程允许动线
- 选择说明：负责寻找关系节点、画生态关系图，并解释一条人类影响链。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：关系章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：收集关系节点
- id：ecology-collect-nodes
- 地点：动物标本点附近
- 位置模式：point
- 到达验证：teacher
- 建议时长：8分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：找到食物、栖息地、其他动物和人类活动四类节点
- 通过条件：四类节点各至少1项并标来源或待核

##### 引导
- 一次只追问一种节点及来源。
- 对人类活动先问条件，再讨论帮助或威胁。

##### 脚手架
| L0 | 先自己找四类节点。 |
| L1 | 它吃什么、住哪里、与谁相连？ |
| L2 | 再找一种人类活动。 |
| L3 | 每项补来源或待核。 |
| L4 | 使用食物、家园、动物、人类四栏模板。 |

#### Step 1：填写四类节点
- id：ecology-collect-nodes
- 小步目标：为关系图准备可追溯节点
- 学生行动：分别填写食物、栖息地条件、相关动物和人类活动
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：四个字段完整；每项附来源编号或“待核”
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"food","label":"食物+来源","type":"short_text","required":true},{"id":"habitat","label":"栖息地条件+来源","type":"short_text","required":true},{"id":"animal","label":"相关动物+来源/待核","type":"short_text","required":true},{"id":"human","label":"人类活动+来源/待核","type":"short_text","required":true}]}}
- 知识引用：K-11, K-12, K-15
- 限制引用：course.md#课程限制规则/观察优先
- 常见误区：随意添加常识中的动物却不标来源
- 最大尝试：3
- 失败处理：允许节点进入待核区
- 教师介入：无
- 通过后：step:ecology-sort-human-impact

##### 验收标准
四个字段完整；每项附来源编号或“待核”
- K2 能解释一个节点改变的连锁影响
- S1 主动区分来源并处理冲突

#### Step 2：判断人类影响
- id：ecology-sort-human-impact
- 小步目标：认识同一活动的影响需要条件
- 学生行动：把人类活动卡放到帮助、威胁或待判断区，并为一张卡写理由
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：全部卡片完成分类，至少1条带条件理由
- 功能模块：A03(分类搭建), A01(文字)
- 工具参数：{"builder":{"mode":"evidence-wall","prompt":"先分类，再允许保留待判断。","items":[{"id":"reserve","label":"建设和管理保护地"},{"id":"feeding","label":"游客投喂"},{"id":"monitor","label":"科学监测"},{"id":"road","label":"道路穿过栖息地"},{"id":"rescue","label":"专业救助"}],"zones":[{"id":"help","label":"可能帮助"},{"id":"threat","label":"可能威胁"},{"id":"depends","label":"要看条件"}],"zoneMinimums":{"help":1,"threat":1,"depends":1}},"text":{"fields":[{"id":"reason","label":"选择一张卡说明条件","type":"long_text","required":true,"minLength":20}]}}
- 知识引用：K-15, K-16
- 限制引用：course.md#课程限制规则/事实与角色表达
- 常见误区：把所有看起来友善的行为都判为帮助
- 最大尝试：3
- 失败处理：追问地点、执行者和方式
- 教师介入：无
- 通过后：role-stage:ecology-draw-network

##### 验收标准
全部卡片完成分类，至少1条带条件理由
- K2 能解释一个节点改变的连锁影响
- C2 能承认行动的限制和代价

### 任务2：绘制关系网
- id：ecology-draw-network
- 地点：教育空间
- 位置模式：none
- 建议时长：12分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：把节点连成食物、栖息地和人类影响关系网
- 通过条件：至少5个节点、4条有说明的关系和1个待核节点

##### 引导
- 不自行添加物种和关系。
- 箭头缺少含义时追问“谁影响谁、怎样影响”。

##### 脚手架
| L0 | 先把研究动物放在中心。 |
| L1 | 每条线在说什么关系？ |
| L2 | 给箭头写“吃、依赖、帮助、威胁”。 |
| L3 | 加入一个待核节点和三段影响链。 |
| L4 | 与教师逐条核验争议关系。 |

#### Step 1：搭建生态关系
- id：ecology-build-network
- 小步目标：建立多节点关系而非单条知识链
- 学生行动：把动物放在中心，连接食物、环境、其他动物和人类活动
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少5个节点、4条箭头，每条关系有来源或待核标签
- 功能模块：A03(关系搭建)
- 工具参数：{"builder":{"mode":"network","prompt":"把研究动物放在中心，用箭头连接四类节点；未知关系保留待核。","items":[{"id":"animal","label":"研究动物"},{"id":"food","label":"食物"},{"id":"habitat","label":"栖息地条件"},{"id":"other","label":"其他动物"},{"id":"human-help","label":"人类帮助"},{"id":"human-threat","label":"人类威胁"},{"id":"unknown","label":"待核关系"}],"zones":[{"id":"network","label":"生态关系网"},{"id":"pending","label":"待核区"}],"zoneMinimums":{"network":5,"pending":1}}}
- 知识引用：K-11, K-12, K-13
- 限制引用：course.md#课程限制规则/事实与角色表达
- 常见误区：箭头没有方向说明
- 最大尝试：3
- 失败处理：指出缺少节点、箭头或来源中的一类
- 教师介入：无
- 通过后：step:ecology-explain-chain

##### 验收标准
至少5个节点、4条箭头，每条关系有来源或待核标签
- K2 能解释一个节点改变的连锁影响
- S2 能解释为什么关系成立

#### Step 2：解释连锁影响
- id：ecology-explain-chain
- 小步目标：说明一个节点变化怎样继续影响系统
- 学生行动：选择一个威胁节点，写“变化—直接影响—下一步影响”
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：三段因果完整，并说明证据和不确定性
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"change","label":"发生什么变化","type":"short_text","required":true},{"id":"direct","label":"直接影响","type":"long_text","required":true},{"id":"next","label":"下一步影响","type":"long_text","required":true},{"id":"boundary","label":"证据或待核点","type":"short_text","required":true}]}}
- 知识引用：K-14
- 限制引用：course.md#课程限制规则/物种动态信息
- 常见误区：用“所以它会灭绝”跳过中间过程
- 最大尝试：3
- 失败处理：只追问缺失的中间环节
- 教师介入：无
- 通过后：role-stage:ecology-propose-needs

##### 验收标准
三段因果完整，并说明证据和不确定性
- K2 能解释一个节点改变的连锁影响
- S2 能解释为什么关系成立

### 任务3：提出基本需要
- id：ecology-propose-needs
- 地点：教育空间
- 位置模式：none
- 建议时长：8分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：从关系网推导一项基本需要和一项保障建议
- 通过条件：需要、证据、威胁和措施形成对应链

##### 引导
- 追问措施改变威胁链的哪一环。
- 避免把愿望自动写成法律权利。

##### 脚手架
| L0 | 从关系图自己找关键条件。 |
| L1 | 少了哪项条件会影响最大？ |
| L2 | 写需要、威胁和措施。 |
| L3 | 说明措施改变威胁链哪一环。 |
| L4 | 用“因为—所以—建议”模板。 |

#### Step 1：形成需要—措施链
- id：ecology-need-measure-chain
- 小步目标：把生态理解转化为有依据的建议
- 学生行动：填写基本需要、对应证据、主要威胁和一项措施
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：四个字段相互对应，措施具体
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"need","label":"基本需要","type":"short_text","required":true},{"id":"evidence","label":"证据编号","type":"short_text","required":true},{"id":"threat","label":"主要威胁","type":"short_text","required":true},{"id":"measure","label":"对应措施","type":"long_text","required":true,"minLength":20}]}}
- 知识引用：K-12, K-16
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：措施与威胁无关
- 最大尝试：3
- 失败处理：追问“这项措施改变威胁链的哪一环”
- 教师介入：无
- 通过后：step:ecology-share-map

##### 验收标准
四个字段相互对应，措施具体
- C2 能承认行动的限制和代价

#### Step 2：共享关系图
- id：ecology-share-map
- 小步目标：让ID和自述使用同一套生态关系
- 学生行动：向小组提交关系图、连锁影响和需要—措施链
- 位置：none
- 完成方式：tool_result
- 证据要求：团队记录包含关系图结论、待核点和措施
- 功能模块：A05(证据汇总)
- 工具参数：{"team":{"mode":"evidence-merge","prompt":"共享关系图结论，同时保留待核节点。","minimumEntries":3,"roles":["生态关系员","ID设计员","议事发言人"],"recordTypes":["关系结论","待核点","需要与措施"],"requiredRecordTypes":["关系结论","待核点","需要与措施"]}}
- 知识引用：K-21
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：发布时删除待核节点
- 最大尝试：2
- 失败处理：补充一条待核说明
- 教师介入：关系图出现明显事实错误
- 通过后：role:complete

##### 验收标准
团队记录包含关系图结论、待核点和措施
- S4 保留异议和修改理由
