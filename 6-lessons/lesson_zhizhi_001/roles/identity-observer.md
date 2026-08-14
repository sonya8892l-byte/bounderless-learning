# 身份观察员

## 基本信息
- 排序：1
- 地点：教师分配的动物标本主点或替代点
- 地理围栏：国家动物博物馆课程允许动线
- 选择说明：负责确认标本身份、观察身体特征，并把“看到的”和“资料说的”分开。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：身份章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：确认居民
- id：identity-confirm-resident
- 地点：教师分配的动物标本点
- 位置模式：point
- 到达验证：teacher
- 建议时长：8分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：确认标本、展签和小组物种一致，留下可复核的现场证据
- 通过条件：完成实物识别并提交1张同时保留标本与来源区域的照片

##### 引导
- 先确认标本和展签同时可见，再处理身份问题。
- 只问学生画面还缺主体、标题或来源中的哪一项。

##### 脚手架
| L0 | 先自己找出标本主体和展签标题。 |
| L1 | 画面里能同时看见“动物”和“它叫什么”吗？ |
| L2 | 后退一步拍全景，再靠近拍标题。 |
| L3 | 使用“标本全景＋展签标题＋来源编号”三项清单。 |
| L4 | 请教师确认点位，学生继续负责记录。 |

#### Step 1：识别标本
- id：identity-scan-specimen
- 小步目标：确认眼前标本属于小组分配物种
- 学生行动：把标本主体和展签标题同时放入识别画面
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：画面包含标本主体与可定位来源的展签区域；不得拍入他人正脸
- 功能模块：A07(实物识别)
- 工具参数：{"scanner":{"mode":"object","prompt":"请同时拍入标本主体和展签标题区域；识别失败时保留人工记录。","allowManualEntry":true}}
- 知识引用：K-01, K-23, K-24
- 限制引用：course.md#课程限制规则/观察优先
- 常见误区：只拍动物局部，无法确认展项来源
- 最大尝试：3
- 失败处理：提示补入标本全景或展签标题；仍失败时由教师确认点位
- 教师介入：展品调整、闭展或连续3次无法识别
- 通过后：step:identity-photo-context

##### 验收标准
画面同时含标本主体与展签标题；识别失败时有人工记录的物种名
- S1 主动区分来源并处理冲突


#### Step 2：保存身份全景
- id：identity-photo-context
- 小步目标：获得可以复核标本身份和观察环境的图像
- 学生行动：拍摄1—2张标本全景，并给照片写来源编号
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少1张清楚照片和1个来源编号
- 功能模块：A01(拍照), A01(文字)
- 工具参数：{"photo":{"prompt":"拍下标本全景和展签相对位置，不拍其他参观者正脸。","minCount":1,"maxCount":2},"text":{"fields":[{"id":"source-id","label":"来源编号","type":"short_text","required":true,"placeholder":"例：展签01"}]}}
- 知识引用：K-01, K-24
- 限制引用：course.md#课程限制规则/场馆与隐私
- 常见误区：照片有标本但没有来源编号
- 最大尝试：2
- 失败处理：只补拍或补填缺失项
- 教师介入：馆方禁止拍摄时改用文字记录并教师确认
- 通过后：role-stage:identity-observe-features

##### 验收标准
至少1张能看清标本全景的照片，且填了来源编号
- K1 能指出一处资料边界或待核信息


### 任务2：观察特征
- id：identity-observe-features
- 地点：动物标本点
- 位置模式：inherit_role
- 建议时长：10分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：记录两个能直接观察的身体特征，并说明其可能与生活方式有什么关系
- 通过条件：2个观察事实 + 1条明确标为推断的结构功能关系

##### 引导
- 引导学生用颜色、形状、位置和结构描述，避免评价词。
- 对结构功能关系持续使用“推测”和“怎样核验”。

##### 脚手架
| L0 | 先说你看到了什么。 |
| L1 | 可以从颜色、形状、大小和位置观察。 |
| L2 | 选一个特征写“我看到……”。 |
| L3 | 再补“我推测……需要……核验”。 |
| L4 | 用三栏模板填写观察、推断、核验。 |

#### Step 1：圈出特征
- id：identity-mark-features
- 小步目标：把注意力放在可直接观察的身体结构
- 学生行动：在示意画板上圈出两个显著特征，并写照片编号
- 位置：inherit
- 完成方式：ai_evaluation
- 证据要求：至少2个特征标注，均能对应现场照片
- 功能模块：A01(画板标注)
- 工具参数：{"sketch":{"prompt":"圈出两个你能直接看见的身体特征，并在旁边写照片编号。","width":720,"height":520,"backgroundImage":"assets/placeholders/task.svg","brushColors":["#2f6f5e","#c65f3d","#1f2937"]}}
- 知识引用：K-01
- 限制引用：course.md#课程限制规则/事实与角色表达
- 常见误区：把“很可爱”“很勇敢”当作身体特征
- 最大尝试：3
- 失败处理：请学生改写为颜色、形状、位置或结构
- 教师介入：无
- 通过后：step:identity-feature-inference

##### 验收标准
至少2个特征标注，均能对应现场照片
- S1 主动区分来源并处理冲突

#### Step 2：提出有边界的推断
- id：identity-feature-inference
- 小步目标：尝试解释结构与生活方式的关系
- 学生行动：选择一个特征，写出“我看到……所以我推测……还需用……核验”
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：同时包含观察、推断和核验办法
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"observation","label":"我看到","type":"long_text","required":true,"minLength":10},{"id":"inference","label":"我推测","type":"long_text","required":true,"minLength":10},{"id":"verify","label":"还需怎样核验","type":"long_text","required":true,"minLength":10}]}}
- 知识引用：K-03
- 限制引用：course.md#课程限制规则/事实与角色表达
- 常见误区：把推断写成确定事实
- 最大尝试：3
- 失败处理：只指出缺少观察、推断或核验中的哪一项
- 教师介入：连续3次仍无法区分观察与推断
- 通过后：role-stage:identity-organize-facts

##### 验收标准
同时包含观察、推断和核验办法
- K1 能指出一处资料边界或待核信息
- C1 主动删除无来源内容

### 任务3：整理身份事实
- id：identity-organize-facts
- 地点：教育空间
- 位置模式：none
- 建议时长：8分钟
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：向小组提交身份、显著特征和一条带边界的结构功能判断
- 通过条件：三项内容完整且关键事实有来源

##### 引导
- 学名看不清时允许写待核。
- 小组复核时要求说明依据，不接受空泛的“没问题”。

##### 脚手架
| L0 | 自己检查五个字段。 |
| L1 | 学名看不清可以怎样诚实记录？ |
| L2 | 用“待核”保留空缺。 |
| L3 | 邀请展签记录员逐项对照。 |
| L4 | 请教师处理名称冲突。 |

#### Step 1：填写身份条目
- id：identity-submit-profile
- 小步目标：形成可直接进入ID Card的身份资料
- 学生行动：填写物种名、学名、两个显著特征及来源
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：五个字段完整；看不清的学名可以写“待核”
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"name","label":"物种名","type":"short_text","required":true},{"id":"scientific-name","label":"学名或待核","type":"short_text","required":true},{"id":"feature-1","label":"特征1","type":"short_text","required":true},{"id":"feature-2","label":"特征2","type":"short_text","required":true},{"id":"source","label":"来源编号","type":"short_text","required":true}]}}
- 知识引用：K-20
- 限制引用：course.md#课程限制规则/物种动态信息
- 常见误区：为填满字段而猜学名
- 最大尝试：2
- 失败处理：允许保留“待核”，但必须提供现场来源
- 教师介入：物种名或学名与展签冲突
- 通过后：step:identity-share-team

##### 验收标准
五个字段完整；看不清的学名可以写“待核”
- K1 能指出一处资料边界或待核信息
- S1 主动区分来源并处理冲突

#### Step 2：交给小组复核
- id：identity-share-team
- 小步目标：让身份资料接受同伴检查
- 学生行动：向小组提交身份条目，并记录一条同伴确认或待核意见
- 位置：none
- 完成方式：tool_result
- 证据要求：至少1条身份资料和1条复核记录
- 功能模块：A05(团队核验)
- 工具参数：{"team":{"mode":"discussion","prompt":"核对物种名、显著特征和来源；无法确认时记录待核。","minimumEntries":2,"roles":["身份观察员","展签记录员"],"recordTypes":["身份资料","确认或待核意见"],"requiredRecordTypes":["身份资料","确认或待核意见"]}}
- 知识引用：K-21
- 限制引用：course.md#课程限制规则/发布边界
- 常见误区：只口头说“没问题”而不留下记录
- 最大尝试：2
- 失败处理：提醒补记确认依据
- 教师介入：小组对物种身份仍有冲突
- 通过后：role:complete

##### 验收标准
至少1条身份资料和1条复核记录
- S4 保留异议和修改理由
