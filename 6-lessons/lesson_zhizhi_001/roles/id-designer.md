# ID设计员

## 基本信息
- 排序：5
- 地点：教育空间
- 地理围栏：国家动物博物馆课程允许动线
- 选择说明：负责汇总事实、关系、需要与来源，制作并审查居民ID Card。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：档案章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：接收证据
- id：designer-receive-evidence
- 地点：教育空间
- 位置模式：none
- 建议时长：6分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：接收身份、来源、关系和声音四类成果
- 通过条件：四类成果和至少1条待核项进入档案区

##### 引导
- 允许证据暂缺，清楚显示待补项。
- 帮助匹配字段，不替学生选择核心事实。

##### 脚手架
| L0 | 自己检查四类成果。 |
| L1 | 哪一类已经有证据，哪一类还待补？ |
| L2 | 先完成已到齐部分。 |
| L3 | 用“已到齐/待补”两区整理。 |
| L4 | 少于三类核心成果时请教师调整。 |

#### Step 1：检查证据到齐
- id：id-check-evidence
- 小步目标：确认ID Card有足够证据基础
- 学生行动：把四类成果卡放入已到齐或待补区
- 位置：none
- 完成方式：tool_result
- 证据要求：四张成果卡全部归位，待补内容保留
- 功能模块：A03(证据墙)
- 工具参数：{"builder":{"mode":"evidence-wall","prompt":"按当前实际完成状态归位；缺失不要假装到齐。","items":[{"id":"identity","label":"身份与特征"},{"id":"sources","label":"事实与来源"},{"id":"ecology","label":"生态关系图"},{"id":"voice","label":"角色脚本与录音"}],"zones":[{"id":"ready","label":"已到齐"},{"id":"pending","label":"待补或待核"}],"zoneMinimums":{"ready":3,"pending":1}}}
- 知识引用：K-20, K-21
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：为了进入下一步把缺失成果标为完成
- 最大尝试：2
- 失败处理：允许明确保留一项待补
- 教师介入：少于3类核心成果
- 通过后：step:id-select-fields

##### 验收标准
四张成果卡全部归位，待补内容保留
- S4 保留异议和修改理由

#### Step 2：匹配ID字段
- id：id-select-fields
- 小步目标：把证据放到正确的成果字段
- 学生行动：将身份、家园、生态角色、风险、需要、措施和来源放入ID正反面
- 位置：none
- 完成方式：tool_result
- 证据要求：七类字段全部放置
- 功能模块：A03(档案搭建)
- 工具参数：{"builder":{"mode":"card-layout","prompt":"正面回答它是谁，背面回答怎样生活、面临什么和需要什么。","items":[{"id":"identity","label":"物种名与学名"},{"id":"home","label":"家园"},{"id":"role","label":"生态角色"},{"id":"risk","label":"主要风险"},{"id":"need","label":"基本需要"},{"id":"measure","label":"保障措施"},{"id":"sources","label":"证据编号"}],"zones":[{"id":"front","label":"ID正面"},{"id":"back","label":"ID背面"}],"correctMapping":{"identity":"front","home":"front","role":"front","risk":"back","need":"back","measure":"back","sources":"back"},"retryMessage":"正面先回答身份，背面再放风险、需要、措施和来源。"}}
- 知识引用：K-20
- 限制引用：course.md#课程限制规则/事实与角色表达
- 常见误区：把角色期待放进物种事实区
- 最大尝试：3
- 失败处理：提示先区分“它是谁”和“我们建议什么”
- 教师介入：无
- 通过后：role-stage:designer-make-id

##### 验收标准
七类字段全部放置
- K1 能指出一处资料边界或待核信息
- K2 能解释一个节点改变的连锁影响

### 任务2：制作居民证
- id：designer-make-id
- 地点：教育空间
- 位置模式：none
- 建议时长：12分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：填写ID Card全部核心字段
- 通过条件：核心字段完整，事实有编号，期待和措施标签清楚

##### 引导
- 逐栏检查来源、标签和措施具体性。
- 排版建议不能新增事实。

##### 脚手架
| L0 | 按证据填写，不追求华丽。 |
| L1 | 哪些字段是事实，哪些是建议？ |
| L2 | 给事实补编号，给期待补标签。 |
| L3 | 用正面身份、背面关系与建议结构。 |
| L4 | 教师协助核验动态信息。 |

#### Step 1：填写ID Card
- id：id-fill-card
- 小步目标：形成可发布的居民证初稿
- 学生行动：根据小组成果填写九个字段
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：全部字段完整；事实字段附来源，待核内容有标签
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"name","label":"物种名/学名","type":"short_text","required":true},{"id":"feature","label":"代表特征+来源","type":"short_text","required":true},{"id":"home","label":"家园+来源","type":"short_text","required":true},{"id":"ecology-role","label":"生态角色+来源/待核","type":"short_text","required":true},{"id":"life","label":"生活方式+来源","type":"long_text","required":true},{"id":"risk","label":"主要风险+来源/待核","type":"long_text","required":true},{"id":"need","label":"基本需要","type":"short_text","required":true},{"id":"expectation","label":"角色期待","type":"long_text","required":true},{"id":"measure","label":"人类保障措施","type":"long_text","required":true}]}}
- 知识引用：K-20, K-16
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：措施写成“大家一起保护”
- 最大尝试：3
- 失败处理：只指出缺失或过于笼统的字段
- 教师介入：ID包含未经核验的动态等级
- 通过后：step:id-add-ai-disclosure

##### 验收标准
全部字段完整；事实字段附来源，待核内容有标签
- K1 能指出一处资料边界或待核信息
- K2 能解释一个节点改变的连锁影响
- C2 能承认行动的限制和代价

#### Step 2：添加来源与AI披露
- id：id-add-ai-disclosure
- 小步目标：让作品来源和制作方法透明
- 学生行动：填写来源清单、访问日期和AI使用说明
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少3个来源编号、日期和人工复核人
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"sources","label":"来源编号（至少3个）","type":"long_text","required":true,"minLength":15},{"id":"date","label":"访问日期","type":"short_text","required":true},{"id":"ai","label":"AI参与和人工修改","type":"long_text","required":true,"minLength":15},{"id":"reviewer","label":"事实复核人","type":"short_text","required":true}]}}
- 知识引用：K-22
- 限制引用：course.md#课程限制规则/物种动态信息
- 常见误区：来源只写“网络”
- 最大尝试：2
- 失败处理：要求补充具体来源编号
- 教师介入：事实复核人未确认
- 通过后：role-stage:designer-preflight-review

##### 验收标准
至少3个来源编号、日期和人工复核人
- C4 能指出AI建议中被删除或修改的内容

### 任务3：发布前审查
- id：designer-preflight-review
- 收口方式：teacher_confirm
- 地点：教育空间
- 位置模式：none
- 建议时长：6分钟
- 推进方式：teacher
- 任务图：assets/placeholders/task.svg
- 配置：完成事实、边界、隐私和授权四项检查
- 通过条件：小组自检完成且教师确认可发布

##### 引导
- 按事实、边界、隐私、AI披露四项检查。
- 教师终审前不宣布公开发布完成。

##### 脚手架
| L0 | 自己完成四项检查。 |
| L1 | 除了错别字，还要检查什么？ |
| L2 | 依次查事实、边界、隐私、AI。 |
| L3 | 记录一项具体修改。 |
| L4 | 提交教师终审。 |

#### Step 1：完成四项自检
- id：id-four-checks
- 小步目标：发现发布前仍需处理的问题
- 学生行动：分别检查事实、标签、隐私和AI披露，记录一项修改
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：四项检查均有结论，至少记录1项修改或无需修改的理由
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"facts","label":"事实与来源检查","type":"short_text","required":true},{"id":"labels","label":"推断/期待标签检查","type":"short_text","required":true},{"id":"privacy","label":"隐私与授权检查","type":"short_text","required":true},{"id":"ai","label":"AI披露检查","type":"short_text","required":true},{"id":"change","label":"本轮修改及理由","type":"long_text","required":true}]}}
- 知识引用：K-20, K-22
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：只检查错别字
- 最大尝试：2
- 失败处理：提示遗漏的检查类别
- 教师介入：无
- 通过后：step:id-teacher-review

##### 验收标准
四项检查均有结论，至少记录1项修改或无需修改的理由
- C4 能指出AI建议中被删除或修改的内容

#### Step 2：教师终审
- id：id-teacher-review
- 小步目标：确认公开事实和授权范围
- 学生行动：把ID Card和来源清单交给教师或引导员终审
- 位置：none
- 完成方式：teacher_confirm
- 证据要求：教师确认事实、隐私、授权和课程作品标识
- 功能模块：A05(提交审核)
- 工具参数：{"team":{"mode":"review","prompt":"提交ID Card、来源清单和发布范围。","minimumEntries":3,"roles":["ID设计员","教师"],"recordTypes":["ID Card","来源清单","发布范围"],"requiredRecordTypes":["ID Card","来源清单","发布范围"]}}
- 知识引用：K-21
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：学生自行宣布已获馆方认可
- 最大尝试：1
- 失败处理：停留当前步骤，按教师意见修改
- 教师介入：必须
- 通过后：role:complete

##### 验收标准
ID Card、来源清单、发布范围三项齐全，且经教师确认
- C2 能承认行动的限制和代价
