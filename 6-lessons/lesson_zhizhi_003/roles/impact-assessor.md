# 影响评估员

> 核心问题：不同措施组合会带来怎样的风险变化、成本、执行负担与公平影响？

## 基本信息
- 排序：5
- 地点：调查点位与教育空间
- 地理围栏：教师批准路线和资料范围
- 类型：核心角色
- 选择说明：建立风险基线，公开成本效果假设，模拟措施组合与例外条件。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：评估章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：定义评估框架
- id：impact-define-framework
- 阶段：Phase 1 问题界定
- 地点：教育空间
- 位置模式：none
- 建议时长：1课时
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：明确基线、措施单位、成本、效果、公平和不确定性字段
- 通过条件：形成评估问题、参数表和不确定性记录规则

#### Step 1：定义结果与基线
- id：impact-set-baseline
- 小步目标：说明措施希望改变什么，当前状态怎样记录
- 学生行动：分别定义鸟类风险、建筑使用、成本和执行四类结果及基线需求
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：四类结果均有指标、单位、时间范围和所需来源
- 功能模块：A03(评估框架)
- 工具参数：{"builder":{"mode":"evaluation_framework","prompt":"为风险、建筑使用、成本、执行定义指标、单位、时间和来源。","minimumItems":4,"categories":["鸟类风险","建筑使用","成本维护","执行管理"]}}
- 知识引用：K-02, K-19
- 引导引用：guidance/impact-assessor.md#任务1
- 限制引用：restrictions.md#风险点位
- 评估引用：evaluation.md#S1
- 脚手架引用：scaffolds/impact-assessor.md#任务1
- 常见误区：用“更环保”作为不可测结果
- 最大尝试：3
- 失败处理：补单位、期限和观察办法
- 教师介入：需要机构未授权的成本数据
- 通过后：step:impact-record-assumptions

#### Step 2：建立假设账本
- id：impact-record-assumptions
- 小步目标：区分实测参数、资料参数、专家判断和课程假设
- 学生行动：为候选参数标来源类型、数值/区间、适用范围和敏感性
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少6个参数；每个有来源类型和不确定性
- 功能模块：A01(参数账本)
- 工具参数：{"text":{"fields":[{"id":"assumptions","label":"成本效果参数与假设账本","type":"long_text","required":true,"minLength":180}]}}
- 知识引用：K-19, K-22
- 引导引用：guidance/impact-assessor.md#任务1
- 限制引用：restrictions.md#AI代替研究
- 评估引用：evaluation.md#E5
- 脚手架引用：scaffolds/impact-assessor.md#任务1
- 常见误区：把网络估价当本校实际成本
- 最大尝试：3
- 失败处理：将无可靠来源数值改为区间或待核
- 教师介入：敏感财务数据进入课程
- 通过后：role-stage:impact-model-options

### 任务2：模拟措施组合
- id：impact-model-options
- 阶段：Phase 5 起草听证与修订
- 地点：教育空间
- 位置模式：none
- 建议时长：2课时
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：比较玻璃、照明、监测与管理组合，并测试预算和建筑例外
- 通过条件：至少3种组合、2种情境和敏感性分析完成

#### Step 1：构建三种措施组合
- id：impact-build-scenarios
- 小步目标：让措施强度、覆盖与成本可以比较
- 学生行动：设计基础、重点和强化三种组合，填写覆盖、预期效果、成本、维护和执行主体
- 位置：none
- 完成方式：tool_result
- 证据要求：3种组合字段完整；所有数值能回到假设账本
- 功能模块：A04(成本效果模拟)
- 工具参数：{"simulation":{"mode":"cost_effectiveness","prompt":"比较基础、重点、强化三种组合；所有参数标来源或课程假设。","minimumItems":3,"dimensions":["覆盖","风险变化","初始成本","维护成本","执行负担"]}}
- 知识引用：K-19, K-20
- 引导引用：guidance/impact-assessor.md#任务2
- 限制引用：restrictions.md#规则模板
- 评估引用：evaluation.md#E5
- 脚手架引用：scaffolds/impact-assessor.md#任务2
- 常见误区：使用伪精确数字掩盖假设
- 最大尝试：3
- 失败处理：改用范围并显示参数来源
- 教师介入：措施涉及结构安全或真实施工
- 通过后：step:impact-test-sensitivity

#### Step 2：测试敏感性与公平性
- id：impact-test-sensitivity
- 小步目标：识别哪些假设变化会改变推荐
- 学生行动：改变预算、效果或维护参数，记录推荐变化及受影响群体
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少2种参数变化、1个推荐反转/不变理由、2类相关者影响和例外建议
- 功能模块：A04(敏感性模拟), A01(影响记录)
- 工具参数：{"simulation":{"mode":"sensitivity","prompt":"分别改变预算、预期效果或维护负担，观察排序是否改变。","variables":["预算","风险变化","维护负担"]},"text":{"fields":[{"id":"equity","label":"相关者影响、例外与调整","type":"long_text","required":true,"minLength":100}]}}
- 知识引用：K-16, K-19
- 引导引用：guidance/impact-assessor.md#任务2
- 限制引用：restrictions.md#规则模板
- 评估引用：evaluation.md#E5
- 脚手架引用：scaffolds/impact-assessor.md#任务2
- 常见误区：只变数字，不重新解释选择
- 最大尝试：3
- 失败处理：追问哪条规则依赖被改变的参数
- 教师介入：无
- 通过后：role-stage:impact-deliver-assessment

### 任务3：交付影响评估
- id：impact-deliver-assessment
- 阶段：Phase 5 起草听证与修订
- 地点：教育空间
- 位置模式：none
- 建议时长：1课时
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：向听证会公开推荐、假设、成本承担、例外与复核触发
- 通过条件：报告能追溯到参数并回应一次预算/公平质询

#### Step 1：撰写影响评估报告
- id：impact-compose-report
- 小步目标：用透明假设支持条款选择
- 学生行动：报告基线、组合、结果区间、敏感参数、公平影响、例外和复核建议
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少6个参数编号、3种组合、2个局限和1个复核触发条件
- 功能模块：A01(影响评估报告)
- 工具参数：{"text":{"fields":[{"id":"impact-report","label":"影响评估报告","type":"long_text","required":true,"minLength":350},{"id":"uncertainty","label":"不确定性与复核触发","type":"long_text","required":true,"minLength":80}]}}
- 知识引用：K-19, K-20
- 引导引用：guidance/impact-assessor.md#任务3
- 限制引用：restrictions.md#AI代替研究
- 评估引用：evaluation.md#E5
- 脚手架引用：scaffolds/impact-assessor.md#任务3
- 常见误区：把模拟结果写成实际成效
- 最大尝试：3
- 失败处理：将“将减少”改为带条件的“模型估计/课程假设”
- 教师介入：报告包含真实采购承诺
- 通过后：step:impact-answer-hearing

#### Step 2：回应预算与公平质询
- id：impact-answer-hearing
- 小步目标：让成本与分配选择接受公开挑战
- 学生行动：回应至少一条预算质询和一条公平性质询，记录条款影响
- 位置：none
- 完成方式：tool_result
- 证据要求：两条质询均有参数化回应、处置状态和条款位置
- 功能模块：A05(听证)
- 工具参数：{"team":{"mode":"hearing","prompt":"分别从预算可行性和成本公平性提出质询。","minimumEntries":2,"recordTypes":["预算质询","公平性质询"],"requiredRecordTypes":["预算质询","公平性质询"]}}
- 知识引用：K-19, K-21
- 引导引用：guidance/impact-assessor.md#任务3
- 限制引用：restrictions.md#规则效力
- 评估引用：evaluation.md#E6
- 脚手架引用：scaffolds/impact-assessor.md#任务3
- 常见误区：用“保护最重要”回避实施条件
- 最大尝试：2
- 失败处理：回到参数、受影响群体和替代方案
- 教师介入：讨论涉及真实个人责任归属
- 通过后：role:complete
