# 流程话术

> overridable: true
> merge: by-key
> course-field: 话术覆盖

键与 `decision.intent` 一一对齐，点号后是该 intent 内部的分支名。课程在 `course.md / ## 话术覆盖` 里写同名键即可整条替换，不写的沿用本文件。

占位符用 `{名字}`。拿不到值时输出的是 `{名字}` 字面量本身，不会变成空串——看到它说明这条模板用了当前分支没有的变量。

本文件只管**说什么**。什么时候说、要不要同时开工具、推进到第几小步，全部由 `service.js` 的流程决定，改这里不会改流程。

## 入场

- role_assigned.欢迎：欢迎你，{roleName}！我是{companionName}。{next}
- quick_reply_stale.有下一问：刚才的选项已经失效了。{next}
- quick_reply_stale.无下一问：刚才的选项已经失效了，我们按当前进度继续。
- onboarding_not_arrived.无需前往：这个任务没有指定地点。{next}
- onboarding_not_arrived.导航：好，先跟紧小组和老师。我把前往“{location}”的高德地图打开，到了再告诉我。
- onboarding_not_ready.等待：好，我等你。先检查队伍、物品和周围安全，准备好时告诉我。

## 待答问题

- pending_answer.未到达导航：知道了。我把去“{location}”的高德地图打开，你跟着老师和小组移动。
- pending_answer.等待准备：好，我等你。准备好时告诉我就行。
- pending_answer.到达确认：到达确认了。{next}

## 导航与到达

- navigation_completed.已到位：已经到位了。{next}
- navigation_completed.继续小步：到位验证通过。现在做第{stepNumber}小步：{stepText}。
- navigation_completed.小步已完成：到位验证通过，这个阶段的小步已经完成，可以整理结果提交。
- navigation_completed.回到任务：已经回到“{taskName}”，我们接着当前小步继续。
- navigation.无需前往：当前“{taskName}”不需要前往指定地点，可以直接继续。
- navigation.已打开：我把前往“{location}”的高德地图打开了。请跟随老师统一移动，现场路线变化以老师引导为准。

## 任务推进与验收

- task_progress.小步记下：好，第{doneNumber}小步记下了。现在做第{nextNumber}小步：{stepText}。
- task_progress.小步全记下：好，这个阶段的{stepCount}个小步都记下了。现在整理任务卡里的照片或记录，提交给我检查。
- task_progress.请提交：收到。请在“{taskName}”任务卡中提交记录或照片，我会根据提交内容帮你检查。
- task_progress.继续任务：好，我们继续“{taskName}”。我把任务工具打开了，有发现随时告诉我。
- task_progress.先去地点：好，我们先去“{location}”。我把高德地图打开了。
- task_step_completed.补充缺省语：这一步还需要补充。
- task_step_completed.还需要：还需要：{items}。
- task_step_completed.可呼叫老师：已达到本步最大尝试次数，可以呼叫老师一起看。
- task_step_completed.继续小步：第{doneNumber}小步完成了。现在做第{nextNumber}小步：{stepText}。
- task_step_completed.全部完成：很好，这个阶段的{stepCount}个小步都完成了。现在整理好照片或记录，在任务卡里提交给我检查。

验收反馈是拼出来的：模型给的评语（没有时用 `补充缺省语`）、`还需要`、`可呼叫老师` 三段，条件不满足的段落为空，剩下的用一个空格连起来。`继续小步` 同理，前面可能挂一段模型评语。分段之间的空格由代码补，模板里不要写前导空格——md 解析会把它吃掉。

## 求助与主动提醒

- safety_help.呼叫老师：收到，我现在帮你呼叫老师。先停在安全的位置，不要独自继续移动。
- proactive_nudge.找不到地点：还顺利吗？如果没找到“{location}”，我把高德地图再放到这里。
- proactive_nudge.试一小步：还顺利吗？可以先试这一小步：{hint}

## 抢答与降级

学生发出请求后、模型回来之前先说的一句叫抢答（prelude）；模型不可用时兜底的一句叫降级（degraded）。

- prelude.求助：我在。先试一个小步骤：{hint}
- prelude.情绪：我在听，你慢慢说。
- prelude.收到提交：我收到你的提交了，正在看这条证据。
- prelude.核对材料：我先按课程材料帮你核对。
- prelude.寒暄：嗯嗯，我在听～
- degraded.情绪：我在听。你可以慢一点说，我会陪你一起理清。
- degraded.任务线索：我收到啦。先从“{taskName}”里最确定的一条现场线索开始，把它告诉我，我继续陪你分析。
- degraded.没接住：我听见了，不过这句话我还没完全接住。你愿意再多说一点吗？

## 工具旁白与知识摘录

- tool.show_navigation：我把前往“{location}”的高德地图打开了。
- tool.open_task_tool：我把“{taskName}”任务工具打开了，我们继续。
- tool.call_teacher：我现在帮你呼叫老师，请先停在安全的位置。
- tool.默认：我已经打开接下来需要的工具。
- knowledge.摘录：根据课程材料，{excerpt}
