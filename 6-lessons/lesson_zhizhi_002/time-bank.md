# 时间银行配置

> 独立支线机制 · 奖励多源核验、风险诊断和方案修订 · 不以结论一致或作答速度计分

## 基本设置

enabled: true
initial_balance: 0min
currency_unit: 分钟

## 赚取规则

max_earn_total: 15min
max_earn_per_task: 3min
tasks_visible_at_once: 3

## 分配规则

allow_gift_to_self: false
max_gift_per_action: 5min
min_gift_amount: 1min
gift_target: same_group_only

## 任务池

### 核验快问快答

- id: tb-01
  type: quiz
  question: "国家重点保护身份与IUCN受威胁等级之间是什么关系？"
  options: [来自不同体系需分别核验, 两者永远完全相同, 只记录更严重的一项]
  answer: 来自不同体系需分别核验
  reward: 2min
  unlock_after: phase-2-start
  hint: "先看发布机构、适用范围和更新时间"

- id: tb-02
  type: quiz
  question: "引用可能变化的保护信息时，哪组记录最完整？"
  options: [来源加发布日期加访问日期, 只写网页标题, 只截一张图]
  answer: 来源加发布日期加访问日期
  reward: 2min
  unlock_after: phase-2-start

- id: tb-03
  type: quiz
  question: "看到种群数量下降后，哪一步最适合作为下一步？"
  options: [继续核验时间范围和原因证据, 立刻认定唯一威胁, 删除不一致资料]
  answer: 继续核验时间范围和原因证据
  reward: 2min
  unlock_after: phase-2-start

### 现场证据

- id: tb-04
  type: photo_checkpoint
  description: "拍下一处含来源、日期或数据单位的公开展项局部，不拍其他参观者正脸"
  hint: "遵守展馆当日拍摄规定；无法拍摄时请教师人工确认观察记录"
  verify: image_recognition
  reward: 3min
  unlock_after: phase-2-start

### 分析与修订

- id: tb-05
  type: quiz
  question: "用“压力因素—直接影响—种群后果”的顺序写出一条待核验威胁链。"
  answer_type: open_ended
  min_length: 30
  reward: 3min
  unlock_after: phase-3-start

- id: tb-06
  type: quiz
  question: "写出一项现有保护措施、一个成效证据和一个仍需核验的缺口。"
  answer_type: open_ended
  min_length: 35
  reward: 3min
  unlock_after: phase-4-start

## 使用边界

- 超时处理仍由教师缩小调查范围、减少次要材料或将待核项转为课后任务，不替学生补结论。
- 时间余额用于组内互助与协作调配，不抵消证据闸门、教师验收或来源核验。
