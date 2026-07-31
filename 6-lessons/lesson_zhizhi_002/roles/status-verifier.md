# 名录核验员

> 核心问题：不同保护标签各自回答什么问题，当前版本与适用范围是什么？

## 基本信息
- 排序：2
- 地点：教育空间与指定资料终端
- 地理围栏：国家动物博物馆课程允许区域
- 类型：核心角色
- 选择说明：核对国内法律保护身份、IUCN评估和种群趋势，维护版本与日期记录。
- 角色卡图：assets/placeholders/role-card.svg
- 角色徽章图：assets/placeholders/badge.svg
- 收集物：核验章
- 收集物图：assets/placeholders/token.svg

## 任务列表

### 任务1：拆分保护标签
- id：verifier-separate-labels
- 阶段：Phase 1 调查开题
- 地点：教育空间
- 位置模式：none
- 建议时长：12min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：把简报中的保护说法分成法律身份、IUCN等级、趋势和措施成效
- 通过条件：完成至少4条主张分类并指出一处不可互推

#### Step 1：分类主张
- id：verifier-sort-claims
- 小步目标：识别同一句话中混在一起的不同判断
- 学生行动：把简报主张拖入四类证据槽，并标出不能判断的条目
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：至少4条分类，允许保留“信息不足”
- 功能模块：A03(证据分类)
- 工具参数：{"builder":{"mode":"categorize","prompt":"按主张实际回答的问题分类；信息不足可进入待核。","minimumItems":4,"categories":["国内法律保护身份","IUCN受威胁等级","种群趋势","措施成效","待核"]}}
- 知识引用：K-01
- 引导引用：guidance/status-verifier.md#任务1
- 限制引用：restrictions.md#动态信息
- 评估引用：evaluation.md#E2
- 脚手架引用：scaffolds/status-verifier.md#任务1
- 常见误区：把“国家保护动物”直接等同“全球极危”
- 最大尝试：3
- 失败处理：逐条问“这句话究竟回答哪个问题”
- 教师介入：无
- 通过后：step:verifier-write-boundary

#### Step 2：写出推理边界
- id：verifier-write-boundary
- 小步目标：说明四类证据之间不能直接推出什么
- 学生行动：写两条“知道A仍不能直接知道B”的边界句
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：两条边界句涉及不同概念
- 功能模块：A01(文字)
- 工具参数：{"text":{"fields":[{"id":"boundaries","label":"两条推理边界","type":"long_text","required":true,"minLength":40}]}}
- 知识引用：K-01, K-02, K-03
- 引导引用：guidance/status-verifier.md#任务1
- 限制引用：restrictions.md#事实边界
- 评估引用：evaluation.md#E2
- 脚手架引用：scaffolds/status-verifier.md#任务1
- 常见误区：只换词复述，没有说明不能推出什么
- 最大尝试：3
- 失败处理：给出句式“知道……仍需另查……”
- 教师介入：连续3次仍混淆法律与科学评估
- 通过后：role-stage:verifier-check-sources

### 任务2：核验版本与范围
- id：verifier-check-sources
- 阶段：Phase 2 展厅多源取证
- 地点：教育空间或指定资料终端
- 位置模式：none
- 建议时长：28min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：分别登记国内保护身份、IUCN条目和趋势材料
- 通过条件：三类记录独立成行，含来源、版本/日期、范围、访问日期与核验人

#### Step 1：登记国内与IUCN条目
- id：verifier-register-status
- 小步目标：形成两条互不替代的保护状态记录
- 学生行动：填写国内法律/名录条目与IUCN条目，缺失内容写待核
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：两条记录均含来源名称、发布机构、版本/评估年、访问日期
- 功能模块：A01(核验表单)
- 工具参数：{"text":{"fields":[{"id":"domestic","label":"国内法律或名录记录","type":"long_text","required":true,"minLength":50},{"id":"iucn","label":"IUCN评估记录","type":"long_text","required":true,"minLength":50},{"id":"access","label":"访问日期与人工核验人","type":"short_text","required":true}]}}
- 知识引用：K-02, K-03, K-04
- 引导引用：guidance/status-verifier.md#任务2
- 限制引用：restrictions.md#动态信息
- 评估引用：evaluation.md#E1, evaluation.md#E2
- 脚手架引用：scaffolds/status-verifier.md#任务2
- 常见误区：只抄等级，不记评估年与范围
- 最大尝试：3
- 失败处理：指出缺少来源、版本、范围或日期的哪一项
- 教师介入：网页版本或法规效力需要确认
- 通过后：step:verifier-trend-record

#### Step 2：核验趋势材料
- id：verifier-trend-record
- 小步目标：判断资料是否真的支持趋势
- 学生行动：记录趋势判断、时间范围、空间范围、方法线索和局限
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：趋势不是单一数量；若只能找到单点数据则明确写“无法判断趋势”
- 功能模块：A01(趋势记录)
- 工具参数：{"text":{"fields":[{"id":"trend","label":"趋势或无法判断","type":"long_text","required":true},{"id":"time","label":"时间范围","type":"short_text","required":true},{"id":"space","label":"空间范围","type":"short_text","required":true},{"id":"limit","label":"方法线索与局限","type":"long_text","required":true}]}}
- 知识引用：K-07
- 引导引用：guidance/status-verifier.md#任务2
- 限制引用：restrictions.md#动态信息
- 评估引用：evaluation.md#E1
- 脚手架引用：scaffolds/status-verifier.md#任务2
- 常见误区：用“数量很少”替代变化趋势
- 最大尝试：3
- 失败处理：追问至少两个可比较时点或来源的趋势判断在哪里
- 教师介入：数据口径无法由学生判断
- 通过后：role-stage:verifier-issue-note

### 任务3：出具核验说明
- id：verifier-issue-note
- 阶段：Phase 6 行动书发布
- 地点：教育空间
- 位置模式：none
- 建议时长：12min
- 推进方式：auto_after_validation
- 任务图：assets/placeholders/task.svg
- 配置：向行动书提供四维状态表和效力日期说明
- 通过条件：四维状态表清楚，动态项有复核提示，冲突项未被隐藏

#### Step 1：制作四维状态表
- id：verifier-compose-matrix
- 小步目标：让读者一眼看出四类结论、来源和边界
- 学生行动：分别填写国内身份、IUCN等级、趋势、措施成效及待核项
- 位置：none
- 完成方式：ai_evaluation
- 证据要求：四行独立；每行有来源编号、日期/版本和适用范围
- 功能模块：A03(状态矩阵)
- 工具参数：{"builder":{"mode":"matrix","prompt":"四类状态独立成行，填写结论、来源、日期或版本、范围和待核项。","minimumItems":4,"categories":["国内法律身份","IUCN评估","种群趋势","措施成效"]}}
- 知识引用：K-01, K-04, K-06
- 引导引用：guidance/status-verifier.md#任务3
- 限制引用：restrictions.md#表达与决策
- 评估引用：evaluation.md#E1, evaluation.md#E2
- 脚手架引用：scaffolds/status-verifier.md#任务3
- 常见误区：为消除冲突而选择性删除来源
- 最大尝试：2
- 失败处理：要求恢复冲突或未知，并说明核验计划
- 教师介入：法律效力或条目对象存在争议
- 通过后：step:verifier-human-signoff

#### Step 2：完成人工核验签注
- id：verifier-human-signoff
- 小步目标：对动态和高风险信息留下人工责任链
- 学生行动：提交需要教师或专家核验的条目清单，记录核验人、日期和处理结果
- 位置：none
- 完成方式：teacher_confirm
- 证据要求：至少核验国内身份与IUCN条目；未完成项保留待核
- 功能模块：A08(教师确认)
- 工具参数：{"teacher_confirm":{"prompt":"核对来源对象、版本/效力日期、适用范围；不能确认的条目标记待核。","required":true}}
- 知识引用：K-02, K-03, K-04
- 引导引用：guidance/status-verifier.md#任务3
- 限制引用：restrictions.md#动态信息
- 评估引用：evaluation.md#S5
- 脚手架引用：scaffolds/status-verifier.md#任务3
- 常见误区：把AI回答写入“人工核验人”
- 最大尝试：1
- 失败处理：保留待核，不阻止其他已核内容发布
- 教师介入：必须
- 通过后：role:complete
