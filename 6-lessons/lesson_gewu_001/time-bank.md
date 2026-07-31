# 时间银行配置

> 独立课程机制 · 不走AI对话流 · 学生自主完成

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

### 快问快答类

- id: tb-01
  type: quiz
  question: "开国大典礼炮几响？"
  options: [21, 28, 54]
  answer: 54
  reward: 2min
  unlock_after: phase2-start
  hint: "和一个历史事件的年份有关"

- id: tb-02
  type: quiz
  question: "故宫一共有多少间房屋？（传说数字）"
  options: [8888, 9999, 9999.5]
  answer: 9999.5
  reward: 2min
  unlock_after: phase2-start
  hint: "比天帝的万间少半间"

- id: tb-03
  type: quiz
  question: "午门有几个门洞？"
  options: [3, 5, 7]
  answer: 5
  reward: 1min
  unlock_after: phase2-start

- id: tb-04
  type: quiz
  question: "太和殿屋脊上有几只走兽？（是所有古建筑中最多的）"
  options: [9, 10, 11]
  answer: 10
  reward: 2min
  unlock_after: phase2-start
  hint: "一般最多9只，太和殿破例多加了1只"

### 拍照打卡类

- id: tb-05
  type: photo_checkpoint
  description: "找到一口铜缸并拍照"
  hint: "太和殿前广场两侧找找看"
  verify: image_recognition
  reward: 3min
  unlock_after: phase2-start

- id: tb-06
  type: photo_checkpoint
  description: "找到日晷（古代计时器）并拍照"
  hint: "太和殿前月台上"
  verify: image_recognition
  reward: 2min
  unlock_after: phase2-start

- id: tb-07
  type: photo_checkpoint
  description: "拍一张内金水河上的石桥"
  hint: "太和门前有5座"
  verify: image_recognition
  reward: 2min
  unlock_after: phase2-start

### 定位签到类

- id: tb-08
  type: location_checkin
  description: "到达九龙壁前签到"
  location: [116.4003, 39.9203]
  radius: 20m
  reward: 2min
  unlock_after: phase2-start

- id: tb-09
  type: location_checkin
  description: "到达御花园入口签到"
  location: [116.3970, 39.9215]
  radius: 15m
  reward: 2min
  unlock_after: phase2-start

### 解锁条件

- id: tb-10
  type: quiz
  question: "你觉得故宫排水最关键的一个设计是什么？（开放题，任何合理回答均可）"
  answer_type: open_ended
  min_length: 20
  reward: 3min
  unlock_after: phase3-start
