# 展签记录员

> 核心问题：怎样把展签信息变成别人能够复核的事实？

## 基本信息
- 排序：2
- 地点：教师分配的动物标本点
- 地理围栏：国家动物博物馆课程允许动线
- 类型：核心角色
- 选择说明：负责展签、来源编号和事实类型，让每条关键信息都能回到出处。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：来源章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：采集展签
- id：label-capture-label
- 阶段：Phase 2 身份与生活取证
- 地点：动物标本点
- 位置模式：point
- 到达验证：teacher
- 建议时长：8min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：拍摄或抄录展签，建立来源编号
- 通过条件：1份可读展签证据 + 1个唯一来源编号

##### 引导
- 优先保留标题、正文和点位上下文。
- 禁止拍摄时立即切换文字记录，不催促学生违规拍摄。

##### 脚手架
| L0 | 先观察展签的标题和正文。 |
| L1 | 你记录的句子属于哪块展签？ |
| L2 | 补上展厅或点位名称。 |
| L3 | 使用“标题—点位—日期—编号”模板。 |
| L4 | 禁拍时请教师协助核对抄录。 |

#### Step 1：记录展签全貌
- id：label-capture-sign
- 小步目标：保留展签标题和正文的上下文
- 学生行动：在允许拍摄时拍下展签全貌；禁止拍摄时完整抄录标题
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：照片可读或文字记录含展签标题和点位
- 功能模块：A01(拍照), A01(文字)
- 工具参数：{"photo":{"prompt":"拍下展签全貌，避免只拍一句话。","minCount":0,"maxCount":2},"text":{"fields":[{"id":"title","label":"展签标题","type":"short_text","required":true},{"id":"location","label":"展厅/点位","type":"short_text","required":true}]}}
- 知识引用：K-02, K-24
- 限制引用：course.md#课程限制规则/场馆与隐私
- 常见误区：只拍一句局部文字，失去来源上下文
- 最大尝试：2
- 失败处理：改为抄录标题和点位
- 教师介入：馆方禁止拍摄或展签无法阅读
- 通过后：step:label-assign-source-id

##### 验收标准
展签标题与点位都已填写；照片可读或已改为完整抄录
- S1 主动区分来源并处理冲突


#### Step 2：建立来源编号
- id：label-assign-source-id
- 小步目标：让后续事实可以引用同一来源
- 学生行动：为展签建立编号，并写下访问日期
- 位置：none
- 完成方式：tool_result
- 证据要求：编号、来源类型和日期完整
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"source-id","label":"来源编号","type":"short_text","required":true,"placeholder":"例：展签01"},{"id":"source-type","label":"来源类型","type":"select","options":["标本观察","展签","馆方资料","补充知识卡"],"required":true},{"id":"date","label":"访问日期","type":"short_text","required":true}]}}
- 知识引用：K-02
- 限制引用：course.md#课程限制规则/物种动态信息
- 常见误区：同一编号用于不同来源
- 最大尝试：2
- 失败处理：提示每个来源只使用一个编号
- 教师介入：无
- 通过后：role-stage:label-extract-facts

##### 验收标准
编号、来源类型和日期完整
- S1 主动区分来源并处理冲突

### 任务2：提取事实
- id：label-extract-facts
- 阶段：Phase 2 身份与生活取证
- 地点：动物标本点附近
- 位置模式：inherit_role
- 建议时长：10min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：从展签提取三条事实，不加入个人解释
- 通过条件：3条事实逐条绑定来源编号

##### 引导
- 追问句子在展签哪一处能够找到。
- 只指出信息类型错误，不代替学生改写三条事实。

##### 脚手架
| L0 | 用自己的话准确转述。 |
| L1 | 这句话能在展签中找到吗？ |
| L2 | 删除“我觉得、一定、很可怜”等词再检查。 |
| L3 | 每条写成“展签显示……（来源）”。 |
| L4 | 与同伴逐句对照原文。 |

#### Step 1：填写三条事实
- id：label-extract-facts
- 小步目标：准确转述展签信息
- 学生行动：用自己的话写三条展签事实，每条附来源编号
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：3条内容均能在展签找到依据，不添加情绪和想象
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"fact-1","label":"事实1+来源","type":"long_text","required":true},{"id":"fact-2","label":"事实2+来源","type":"long_text","required":true},{"id":"fact-3","label":"事实3+来源","type":"long_text","required":true}]}}
- 知识引用：K-02
- 限制引用：course.md#课程限制规则/事实与角色表达
- 常见误区：把“我觉得它很孤独”写成展签事实
- 最大尝试：3
- 失败处理：指出哪一条含推断，要求改写或改标签
- 教师介入：展签内容与知识卡明显冲突
- 通过后：step:label-sort-information

##### 验收标准
3条内容均能在展签找到依据，不添加情绪和想象
- K1 能指出一处资料边界或待核信息
- S1 主动区分来源并处理冲突

#### Step 2：分类信息
- id：label-sort-information
- 小步目标：区分观察、资料、推断与期待
- 学生行动：把六张示例卡放入四类信息区
- 位置：none
- 完成方式：tool_result
- 证据要求：六张卡全部分类
- 功能模块：A03(分类搭建)
- 工具参数：{"builder":{"mode":"evidence-wall","prompt":"按信息从哪里来分类。","items":[{"id":"fur-color","label":"照片显示毛色"},{"id":"label-habitat","label":"展签写明栖息地"},{"id":"guess-mood","label":"它看起来很难过"},{"id":"hope-home","label":"我希望家园保持连通"},{"id":"source-food","label":"知识卡说明食物"},{"id":"guess-number","label":"馆里只有一件所以野外很少"}],"zones":[{"id":"observation","label":"亲眼观察"},{"id":"source","label":"资料事实"},{"id":"inference","label":"合理推断"},{"id":"expectation","label":"角色期待"}],"correctMapping":{"fur-color":"observation","label-habitat":"source","guess-mood":"inference","hope-home":"expectation","source-food":"source","guess-number":"inference"},"retryMessage":"先看每张卡的信息来源，再决定类别。"}}
- 知识引用：K-01, K-02, K-03, K-04
- 限制引用：course.md#课程限制规则/事实与角色表达
- 常见误区：把有道理的推断直接当成资料事实
- 最大尝试：3
- 失败处理：只反馈分类依据，不直接公布整张映射
- 教师介入：无
- 通过后：role-stage:label-build-fact-pack

##### 验收标准
六张卡全部分类
- C1 主动删除无来源内容

### 任务3：制作事实包
- id：label-build-fact-pack
- 阶段：Phase 5 居民证制作
- 地点：教育空间
- 位置模式：none
- 建议时长：8min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：向小组提交三条事实、来源清单和待核项
- 通过条件：事实包完整且无未标注推断

##### 引导
- 要求来源具体到编号和日期。
- 鼓励保留待核信息，不用完整度压过准确性。

##### 脚手架
| L0 | 检查来源清单。 |
| L1 | “网络”能让别人找到同一资料吗？ |
| L2 | 写具体知识卡或展签编号。 |
| L3 | 至少保留一条待核边界。 |
| L4 | 交教师复核动态信息。 |

#### Step 1：汇总来源清单
- id：label-build-source-list
- 小步目标：形成ID Card可引用的最小来源清单
- 学生行动：填写展签、观察和知识卡三个来源条目；没有的写“未使用”
- 位置：none
- 完成方式：tool_result
- 证据要求：三个来源字段和访问日期完整
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"observation","label":"观察来源","type":"short_text","required":true},{"id":"label","label":"展签来源","type":"short_text","required":true},{"id":"card","label":"知识卡来源","type":"short_text","required":true},{"id":"date","label":"访问日期","type":"short_text","required":true}]}}
- 知识引用：K-02, K-22
- 限制引用：course.md#课程限制规则/物种动态信息
- 常见误区：只写“百度”“AI说”
- 最大尝试：2
- 失败处理：要求写清具体展签或知识卡编号
- 教师介入：来源无法追溯
- 通过后：step:label-submit-fact-pack

##### 验收标准
三个来源字段和访问日期完整
- S1 主动区分来源并处理冲突
- C4 能指出AI建议中被删除或修改的内容

#### Step 2：提交事实包
- id：label-submit-fact-pack
- 小步目标：让全组使用同一套可追溯事实
- 学生行动：向小组提交三条事实、来源清单和一条待核项
- 位置：none
- 完成方式：tool_result
- 证据要求：至少5条团队记录，含事实、来源和待核
- 功能模块：A05(证据汇总)
- 工具参数：{"team":{"mode":"evidence-merge","prompt":"逐条提交事实与来源，并保留至少一条待核或证据边界。","minimumEntries":5,"roles":["展签记录员","身份观察员","ID设计员"],"recordTypes":["事实","来源","待核项"],"requiredRecordTypes":["事实","来源","待核项"]}}
- 知识引用：K-21
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：为了显得完整而删除待核信息
- 最大尝试：2
- 失败处理：提醒保留不确定性
- 教师介入：公开事实存在争议
- 通过后：role:complete

##### 验收标准
至少5条团队记录，含事实、来源和待核
- S4 保留异议和修改理由
