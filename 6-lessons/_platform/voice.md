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
