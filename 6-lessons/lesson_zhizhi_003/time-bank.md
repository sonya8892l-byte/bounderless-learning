# 时间银行配置

> 独立支线机制 · 奖励规范调查、反证意识和版本修订 · 不替代研究伦理与程序门槛

## 基本设置

enabled: true
initial_balance: 0min
currency_unit: 分钟

## 赚取规则

max_earn_total: 18min
max_earn_per_task: 3min
tasks_visible_at_once: 3

## 分配规则

allow_gift_to_self: false
max_gift_per_action: 5min
min_gift_amount: 1min
gift_target: same_group_only

## 任务池

### 研究方法快问快答

- id: tb-01
  type: quiz
  question: "一次巡查没有发现鸟撞痕迹时，最合适的记录方式是什么？"
  options: [照实记录零发现及巡查条件, 删除这次记录, 宣布建筑绝对安全]
  answer: 照实记录零发现及巡查条件
  reward: 3min
  unlock_after: phase2-start

- id: tb-02
  type: quiz
  question: "发现玻璃反射树木后，可以直接得出什么结论？"
  options: [这是一个需要继续核验的风险变量, 这里一定发生过鸟撞, 必须立刻拆除整栋建筑]
  answer: 这是一个需要继续核验的风险变量
  reward: 3min
  unlock_after: phase2-start

- id: tb-03
  type: quiz
  question: "比较多伦多、纽约和旧金山材料时，哪种做法更合适？"
  options: [先比较适用对象和措施再讨论借鉴, 直接复制最严格条文, 只看文件标题]
  answer: 先比较适用对象和措施再讨论借鉴
  reward: 3min
  unlock_after: phase3-start

### 风险调查

- id: tb-04
  type: photo_checkpoint
  description: "拍下一处可能产生反射或透明通道的玻璃局部，并避开可识别的人脸、门牌和个人信息"
  hint: "仅在获准区域、确保人身安全的前提下拍摄；不可拍摄时改画风险草图并由教师确认"
  verify: image_recognition
  reward: 3min
  unlock_after: phase2-start

### 反证与规则修订

- id: tb-05
  type: quiz
  question: "写出一个可能影响巡查结果的变量，并说明下一轮怎样控制或记录它。"
  answer_type: open_ended
  min_length: 35
  reward: 3min
  unlock_after: phase2-start

- id: tb-06
  type: quiz
  question: "选择建议稿中的一条措施，补写责任主体、执行成本和复核周期。"
  answer_type: open_ended
  min_length: 40
  reward: 3min
  unlock_after: phase5-start

## 使用边界

- 时间余额用于组内赠送和协作调配，不抵消知情同意、调查安全、人工核验、听证或教师审批。
- 需要压缩进度时可缩小建筑范围、样本量或条款数量；不得补造数据、跳过知情同意或省略人工核验。
