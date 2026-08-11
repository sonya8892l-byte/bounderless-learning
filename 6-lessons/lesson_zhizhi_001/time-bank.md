# 时间银行配置

> 独立支线机制 · 用于奖励细致观察、证据表达和组内互助 · 不以抢答速度计分

## 基本设置

enabled: true
initial_balance: 0min
currency_unit: 分钟

## 赚取规则

max_earn_total: 12min
max_earn_per_task: 2min
tasks_visible_at_once: 3

## 分配规则

allow_gift_to_self: false
max_gift_per_action: 3min
min_gift_amount: 1min
gift_target: same_group_only

## 任务池

### 证据快问快答

- id: tb-01
  type: quiz
  question: "哪一句最适合写进“亲眼观察”一栏？"
  options: [我看见它的前肢有长爪, 它一定很孤独, 它希望人类保护森林]
  answer: 我看见它的前肢有长爪
  reward: 2min
  unlock_after: phase2-start
  hint: "只选择眼睛或耳朵能够直接确认的内容"

- id: tb-02
  type: quiz
  question: "展签和已开放信息卡都没有提到某个结论时，应该怎样记录？"
  options: [先标为待核实, 凭感觉补完整, 写成动物亲口告诉我]
  answer: 先标为待核实
  reward: 2min
  unlock_after: phase2-start

- id: tb-03
  type: quiz
  question: "下面哪一种做法更能保护证据的可追溯性？"
  options: [事实旁写来源, 只记最有趣的结论, 把观察和猜测混在一起]
  answer: 事实旁写来源
  reward: 2min
  unlock_after: phase2-start

### 现场观察

- id: tb-04
  type: photo_checkpoint
  description: "拍下一处能支持动物外形特征判断的展项局部，不拍其他参观者正脸"
  hint: "遵守展馆当日拍摄规定；不允许拍摄时请教师改为人工确认"
  verify: image_recognition
  reward: 2min
  unlock_after: phase2-start

### 开放表达

- id: tb-05
  type: quiz
  question: "写下一条亲眼观察到的事实，并说明你观察的是展品、模型、图片还是展签。"
  answer_type: open_ended
  min_length: 20
  reward: 2min
  unlock_after: phase2-start

- id: tb-06
  type: quiz
  question: "写出一项你愿意做到的动物友好行动，并说明它可能帮助谁。"
  answer_type: open_ended
  min_length: 20
  reward: 2min
  unlock_after: phase5-start
