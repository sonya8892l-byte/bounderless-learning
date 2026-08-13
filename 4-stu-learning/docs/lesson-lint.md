# 课程 lint 与语义质量审计

`npm run lint:lesson` 只读检查 `6-lessons/lesson_*`，不会改写课程 Markdown。

检查分两层：

1. `scripts/lint-lesson.mjs` 校验结构契约，如死引用、缺素材、任务作用域、教师确认配对和阶段任务执行单位。
2. `server/course/course-quality-audit.js` 校验结构合法但可能导致教学偏差的内容，并把结果并入同一份 lint 报告。

有 `error` 时进程退出码为 1；仅有 `warning` 时退出码为 0；`--strict` 会把 warning 也作为失败。

## 编译 warning 也属于发布门禁

`course.platformDefaults.warnings` 中的所有编译 warning 都会进入 lint，不再只转发 `phase_prompt_*`。每条必须保留：

- `code`：稳定的机器可读类型；
- `source`：作者需要修改的课程源文件；
- `field`：发生问题的字段；
- `line`：若编译器没直接给出，lint 会用 key、target、Step/Task id 或字段名反查。

当前纳入的典型 code 包括 `unknown_voice_key`、`platform_locked_override`、`platform_immutable_override`、`unknown_next`、`unknown_prerequisite`、`unparsable_next`、`duplicate_task` 和 `phase_prompt_*`。这些通常是 warning：普通 lint 可用来迁移，`--strict` 会硬失败，避免“编译时已忽略，发布却全绿”。

## 语义质量 code

| code | level | 含义 |
|---|---|---|
| `unknown_course_section` | error | `course.md` 的二级标题既不是运行时配置，也不是已登记的教研说明章节 |
| `protected_scaffold_leak` | error | 任务、Step 或 Phase 提示的学生可见目标、行动、证据要求、工具提示或脚手架泄露其受保护内容；精确值、中文数字改写和已编译的高置信等价结论都会命中，隐私删除指令与“不要直接告诉学生”这类作者边界不误报 |
| `unsafe_student_action` | warning | 学生可见文案正向号召触摸文物、倒水、投物或近水操作手机；明确的否定安全边界不报 |
| `phase_prompt_over_budget` | warning | Phase 提示超过 2000 字作者审阅阈值；这是可维护性提示，运行时仍装配完整内容 |
| `stale_phase_capability` | warning | prompts、`phases.md` 或 `course.md` 承诺扫码选角色、自动聚合等当前运行时没有的行为；“不会/不支持自动聚合”这类否定说明不报 |
| `timing_conflict` | warning | Phase 叙述的无操作时间与任务结构化 `无操作提醒` 字段不一致 |

结构层另有 `bad_executor` error。该规则直接扫描 `phases.md` 中阶段任务的原始 `执行单位`，允许值仅为 `全班`、`小组`、`个人`。直接读源码是必要的：parser 会把未知值回落成 `全班`，只检查编译结果会丢失作者原值。

`missing_media_source` 检查 `media` 工具的真实来源。`video` / `audio` 没有非空 `url` 时，若 `requireCompletion` 开启则报 error，防止学生点击预览图伪造播放完成。课程确实只需要静态情境图时，可给视频工具同时配置非空 `poster` 与 `posterOnly: true`；学生端会明确标注“不含视频播放”，并把按钮和验收语义改为“确认已查看情境图”。`posterOnly` 仅对 `video + 无 url + 有 poster` 生效，拼错字段、漏配 poster 以及无来源的其他媒体类型仍会被门禁拦截。可选媒体仍报 warning，提醒作者补齐正式素材。

角色任务的 `阶段` 字段当前只是设计标签，lint 不把它当成运行时门禁，也不背书任务会随 Phase 自动出现或解锁。当前 Phase 由教师或明确的客户端阶段指令组织；内容若承诺自动解锁，应由 `stale_phase_capability` 拦截。

每条 issue 均包含 `courseId`、`file`、`line`、`code`、`level` 和带“修复：”的建议。code 是测试、报告和发布门禁之间的稳定接口；调整措辞时不要更名。

## `course.md` 当前受支持的二级标题

`基本信息`、`核心问题`、`学生端角色体系`、`学习视图`、`学生端视觉素材`、`人设侧重`、`话术覆盖`、`脚手架`、`组织信息`、`学段规范`、`工具默认`/`工具缺省`、`数值默认`/`数值缺省`。

教研说明章节允许保留在课程总览中，当前登记：`叙事框架`、`密符机制`、`默认物种池`、`信息边界`、`调查边界`、`默认议题与成果`、`研究与效力边界`、`五层战图机制`、`史料边界`。这些章节参与课程内容指纹，供作者与审核者阅读，但不会被解释为自动转场、自动聚合、自动解锁或其他运行时配置；需要生效的边界仍须写入 `restrictions.md`、Phase Prompt 或 Step 引用。

新增运行时小节需要先为 parser/compiler 增加明确消费者，再更新 `KNOWN_COURSE_SECTIONS`；新增教研说明标题需要登记到 `AUTHORING_ONLY_COURSE_SECTIONS`，不能靠未知标题静默通过。

## 运行

```bash
npm run lint:lesson
npm run lint:lesson -- --strict
node --test tests/course-quality-audit.test.js tests/lint-lesson.test.js tests/lint-failure-fields.test.js tests/compiler-warning-lint.test.js tests/spec-appendix-status.test.js tests/phase-tasks.test.js
```
