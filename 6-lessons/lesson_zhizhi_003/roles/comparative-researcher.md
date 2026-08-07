# 域外制度研究员

> 核心问题：多伦多、纽约和旧金山怎样界定问题与规则，哪些经验具备本地借鉴条件？

## 基本信息
- 排序：3
- 地点：资料空间
- 地理围栏：指定三城官方来源
- 类型：核心角色
- 选择说明：核验三城官方原文，建立七项比较矩阵并评估可借鉴条件。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：比较章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：制定三城原文协议
- id：comparative-set-protocol
- 阶段：Phase 1 问题界定
- 地点：教育空间
- 位置模式：none
- 建议时长：1课时
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：限定官方来源，定义统一比较字段和翻译核验方式
- 通过条件：三城来源、七项字段、版本记录和翻译核验规则完整

##### 引导
- 只接受三城指定官方来源，媒体材料只能作线索。
- 先统一七项字段和翻译复核，再开始摘录。

##### 脚手架
| L0 | 找到三城官方机构页面。 |
| L1 | 记录标题、URL和访问日。 |
| L2 | 使用统一七项字段。 |
| L3 | 设计原文—译文—复核三栏。 |
| L4 | 教师处理页面或版本问题。 |

#### Step 1：锁定官方来源
- id：comparative-register-sources
- 小步目标：避免使用二手摘要代替制度原文
- 学生行动：分别登记多伦多市、纽约市议会和旧金山规划部门官方页面
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：三条来源含机构、标题、URL、访问日期和原文状态
- 功能模块：A01(来源登记)
- 工具参数：{"text":{"fields":[{"id":"toronto","label":"多伦多官方来源","type":"long_text","required":true},{"id":"new-york","label":"纽约官方来源","type":"long_text","required":true},{"id":"san-francisco","label":"旧金山官方来源","type":"long_text","required":true},{"id":"access","label":"访问日期","type":"short_text","required":true}]}}
- 知识引用：K-12, K-13, K-14
- 限制引用：restrictions.md#域外结论
- 常见误区：搜索摘要或媒体报道作为唯一来源
- 最大尝试：3
- 失败处理：要求回到制定或执行机构页面
- 教师介入：官方页面不可访问或版本不明
- 通过后：step:comparative-define-fields

##### 验收标准
三条来源含机构、标题、URL、访问日期和原文状态
- S1 开题：范围、问题、方法、安全、伦理、AI计划由教师确认。

#### Step 2：统一比较与翻译规则
- id：comparative-define-fields
- 小步目标：让三城材料在同一问题框架下可比较
- 学生行动：确认七项比较字段，规定原文摘录、学生译文、关键词保留和双人复核
- 位置：none
- 完成方式：tool_result
- 证据要求：七项字段和翻译复核流程齐全
- 功能模块：A03(比较框架)
- 工具参数：{"builder":{"mode":"comparison_schema","prompt":"设置规范层级、适用对象、风险触发、玻璃措施、照明措施、例外替代、审查执行七列。","minimumItems":7},"text":{"fields":[{"id":"translation","label":"翻译与双人复核规则","type":"long_text","required":true,"minLength":60}]}}
- 知识引用：K-15, K-22
- 限制引用：restrictions.md#域外结论
- 常见误区：三座城市各摘自己觉得有趣的内容
- 最大尝试：2
- 失败处理：要求所有城市回答同一组问题
- 教师介入：指定第二翻译核验人
- 通过后：role-stage:comparative-build-matrix


### 任务2：完成三城比较
- id：comparative-build-matrix
- 阶段：Phase 3 中国规范与域外比较
- 地点：资料空间
- 位置模式：none
- 建议时长：2周
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：从官方原文提取范围、措施、例外与程序，记录不可比项
- 通过条件：三城七项矩阵、原文编号、双人译文复核和不可比说明完整

##### 引导
- 每条摘录保留适用对象、例外和原文位置。
- 帮助发现不可比项，不生成城市优劣排名。

##### 脚手架
| L0 | 每城先提取三段短原文。 |
| L1 | 补适用对象和例外。 |
| L2 | 空格写未找到、不适用或待核。 |
| L3 | 标两项不可直接比较。 |
| L4 | 第二复核人确认译文。 |

#### Step 1：提取原文证据
- id：comparative-extract-text
- 小步目标：让比较结论回到具体官方文本
- 学生行动：每城至少提取3段短原文，记录页面/条款位置、学生译文和字段
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少9条摘录；每条含原文位置、译文、字段和复核人
- 功能模块：A01(原文摘录卡)
- 工具参数：{"text":{"fields":[{"id":"extracts","label":"三城原文摘录、位置与译文","type":"long_text","required":true,"minLength":450},{"id":"reviewer","label":"第二复核人","type":"short_text","required":true}]}}
- 知识引用：K-12, K-13, K-14
- 限制引用：restrictions.md#域外结论
- 常见误区：摘录脱离适用条件
- 最大尝试：3
- 失败处理：要求把前后适用对象或例外一并记录
- 教师介入：关键术语翻译有争议
- 通过后：step:comparative-fill-matrix


#### Step 2：解释异同与不可比
- id：comparative-fill-matrix
- 小步目标：比较制度选择，同时尊重情境差异
- 学生行动：完成七项矩阵，为三项异同写原因假设和不可直接比较之处
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：七项×三城有记录或“不适用/未找到”；至少3条异同与2条不可比说明
- 功能模块：A03(比较法矩阵)
- 工具参数：{"builder":{"mode":"comparison_matrix","prompt":"三城按七项同列比较，空白须写未找到、不适用或待核。","minimumItems":21},"text":{"fields":[{"id":"analysis","label":"异同、原因假设与不可比说明","type":"long_text","required":true,"minLength":180}]}}
- 知识引用：K-15
- 限制引用：restrictions.md#域外结论
- 常见误区：用措施数量评价城市优劣
- 最大尝试：3
- 失败处理：把价值判断改为字段差异与制度情境
- 教师介入：无
- 通过后：role-stage:comparative-localize


### 任务3：形成可借鉴性报告
- id：comparative-localize
- 阶段：Phase 5 起草听证与修订
- 地点：教育空间
- 位置模式：none
- 建议时长：1课时
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：筛选可借鉴做法，并说明本地权限、条件、调整与试点需求
- 通过条件：至少3项候选做法通过四问，含1项不建议直接移植

##### 引导
- 每项借鉴依次检查本地问题、主体权限、实施条件和试点例外。
- 制度事实与课程选择分别标注。

##### 脚手架
| L0 | 选择三项候选做法。 |
| L1 | 问本地问题是否相似。 |
| L2 | 补主体权限和成本条件。 |
| L3 | 写试点、例外与不移植项。 |
| L4 | 规范核验人处理权限问题。 |

#### Step 1：完成本地化四问
- id：comparative-assess-transfer
- 小步目标：把“国外这样做”转成条件化建议
- 学生行动：为3项候选做法回答问题相似性、主体权限、技术成本条件和试点/例外
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：3项×4问完整，每项引用原文与本地证据编号
- 功能模块：A03(可借鉴性矩阵)
- 工具参数：{"builder":{"mode":"transfer_matrix","prompt":"对3项做法回答本地问题、主体权限、实施条件、试点例外。","minimumItems":12}}
- 知识引用：K-16, K-19
- 限制引用：restrictions.md#法律效力
- 常见误区：只写“值得借鉴”
- 最大尝试：3
- 失败处理：提示补本地责任主体和资源条件
- 教师介入：涉及本地正式权限判断
- 通过后：step:comparative-deliver-report


#### Step 2：发布比较报告
- id：comparative-deliver-report
- 小步目标：向起草组交付可追溯、不过度移植的结论
- 学生行动：提交三城比较、候选做法、不可直接移植项和待核清单
- 位置：none
- 完成方式：tool_result
- 证据要求：至少3项可借鉴建议、1项不建议直接移植、1项待核
- 功能模块：A01(比较报告), A05(团队复核)
- 工具参数：{"text":{"fields":[{"id":"report","label":"三城比较与可借鉴性报告","type":"long_text","required":true,"minLength":350}]},"team":{"mode":"review","prompt":"中国规范研究员与影响评估员核对权限和实施条件。","minimumEntries":2,"roles":["中国规范研究员","影响评估员"]}}
- 知识引用：K-15, K-16, K-22
- 限制引用：restrictions.md#法律与公共表达
- 常见误区：把比较报告写成城市排名
- 最大尝试：2
- 失败处理：删去无依据排名，恢复制度情境
- 教师介入：无
- 通过后：role:complete
