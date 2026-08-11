# 数值默认

> overridable: true
> merge: by-key
> course-field: 数值默认

任务块没有写这些字段时使用下面的值。优先级：任务块字段 > 课程 `course.md` 的 `## 数值默认` > 本文件。

时长类字段支持「15分钟」「900」「1小时」三种写法，纯数字按秒计。

## 任务节奏

- 建议时长：15分钟
- 无操作提醒：3分钟
- 提醒冷却：2分钟
- 最大主动提醒：2

## 任务推进

- 最大尝试：3
- 推进方式：auto_after_validation

`推进方式` 取值：`auto_after_validation` 验收通过即推进 ｜ `ai_suggest` 由同伴建议、学生确认 ｜ `teacher` 教师确认。
