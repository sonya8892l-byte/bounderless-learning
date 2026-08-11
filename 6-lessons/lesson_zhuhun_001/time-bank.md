# 时间银行配置

> 独立课程机制 · 题目和答案由课程配置 · 核心推演不依赖时间银行

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

### 快问快答

- id: tb-01
  type: quiz
  question: "遵义会议召开于哪一年？"
  options: [1934, 1935, 1936]
  answer: 1935
  reward: 1min
  unlock_after: phase2-start

- id: tb-02
  type: quiz
  question: "四渡赤水主要发生在哪三省交界区域？"
  options: [川黔滇, 湘鄂赣, 陕甘宁]
  answer: 川黔滇
  reward: 2min
  unlock_after: phase2-start

- id: tb-03
  type: quiz
  question: "哪一种表达更符合课程的数据边界？"
  options: [红军始终正好3万人, 红军约3万人且兵力随时点变化, 红军人数不重要]
  answer: 红军约3万人且兵力随时点变化
  reward: 2min
  unlock_after: phase2-start

- id: tb-04
  type: quiz
  question: "分析历史决策时，应该优先使用哪类信息？"
  options: [当时可获得的证据, 已知的最终结果, 网络上最短的答案]
  answer: 当时可获得的证据
  reward: 2min
  unlock_after: phase2-start

### 展项观察

- id: tb-05
  type: photo_checkpoint
  description: "找到一处长征路线地图或地形模型，并拍摄不含其他参观者正脸的局部照片"
  hint: "遵守展馆当日拍摄规定，不使用闪光灯"
  verify: image_recognition
  reward: 3min
  unlock_after: phase2-start

- id: tb-06
  type: photo_checkpoint
  description: "找到一项带有明确日期的长征展项，记录日期和展项标题"
  hint: "照片之外再写一句文字，说明日期对应的事件"
  verify: image_and_text
  reward: 2min
  unlock_after: phase2-start

- id: tb-07
  type: photo_checkpoint
  description: "找到一项通信、情报或电文相关展项，拍摄展项说明"
  hint: "只拍允许拍摄的公开展项"
  verify: image_recognition
  reward: 2min
  unlock_after: phase2-start

### 定位签到

- id: tb-08
  type: location_checkin
  description: "到达中国共产党历史展览馆课程集合区域"
  location: [116.3953, 40.0071]
  radius: 300m
  reward: 1min
  unlock_after: phase2-start

### 开放反思

- id: tb-09
  type: quiz
  question: "写出一条你在展陈中看到的证据，并说明它属于史实、课程材料还是你的推断。"
  answer_type: open_ended
  min_length: 25
  reward: 3min
  unlock_after: phase2-start

- id: tb-10
  type: quiz
  question: "新证据出现后，你的小组改变过哪一个判断？为什么？"
  answer_type: open_ended
  min_length: 30
  reward: 3min
  unlock_after: phase3-start
