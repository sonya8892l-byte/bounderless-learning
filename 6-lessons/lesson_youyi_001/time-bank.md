## 基本设置

enabled: true
initial_balance: 0min
currency_unit: 分钟

## 赚取规则

max_earn_total: 10min
max_earn_per_task: 3min
tasks_visible_at_once: 3

## 分配规则

allow_gift_to_self: false
max_gift_per_action: 5min
min_gift_amount: 1min

## 任务池

- id: tb-01
  type: quiz
  question: "（答案：投壶）古人宴饮时把箭投入壶中的游戏叫什么？"
  options: [投壶, 围棋]
  answer: 投壶
  reward: 3min
  unlock_after: phase1-start
  hint: "和箭与壶有关。"
- id: tb-02
  type: quiz
  question: "（答案：冰嬉）清代宫廷冬季在冰上举行的游戏叫什么？"
  options: [冰嬉, 龙舟]
  answer: 冰嬉
  reward: 2min
  unlock_after: phase1-start
  hint: "故宫藏有一幅描绘它的长卷。"
