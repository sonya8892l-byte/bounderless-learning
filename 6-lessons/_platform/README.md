# 平台包 _platform/

> 版本：**v2**（2026-08-07）｜依据 [目标架构 D4 覆盖白名单](../1-docs/目标架构讨论稿-两包md与课程渲染管线.md)

平台包是所有课程共享的**缺省层**——可以理解为"一门缺省课程"：课程包没写的一切都有平台缺省，课程包写了的按白名单覆盖。它同时承载不可覆盖的三条底线规则。

## 文件清单

| 文件 | 内容 | 覆盖属性 | 状态 |
|---|---|---|---|
| `safety-rules.md` | 安全边界 + 话题回避 | **immutable** | 已接入 |
| `pedagogy-rules.md` | 苏格拉底底线 + 角色边界 + 来源标注 | **immutable** | 已接入 |
| `privacy-rules.md` | 数据隐私规则 | **immutable** | 已接入 |
| `competency-framework.md` | CC 核心能力 / CQ 综合素质标签树 | immutable（课程只引用节点） | draft，无运行行为 |
| `companion.md` | 絮絮人设：名字与素材锁定，语气侧面可覆盖 | 混合（见下） | **已接入**（素材路径仍在 `platform-config.js`，浏览器构建期要用） |
| `voice.md` | 流程话术模板（入场/导航/到达/验收/求助/完成/修复），带占位符 | overridable | **已接入**（`service.js` + `dialogue-policy.js`；分支控制流仍在代码） |
| `language-levels.md` | 学段表达规范（字数/硬上限/句式） | overridable | **已接入** |
| `scaffolding.md` | L0–L4 语义定义 + 升档参数（本阶段只升不降） | overridable | **已接入** |
| `tool-defaults.md` | 十种活动工具显示名 + 缺省字段 label | overridable | **已接入**（中文正则匹配器仍在 `tool-registry.js`） |
| `defaults.md` | 时长/提醒/冷却/推进方式等数值缺省 | overridable | **已接入** |

前三份规则文件为必需。缺失或内容为空时服务端课程编译失败，避免线上静默跳过平台底线。

**六份缺省层 md（`companion` / `voice` / `language-levels` / `scaffolding` / `tool-defaults` / `defaults`）删掉任意一份，行为与建立之前完全一致**——代码里的常量作为回落保留（如 `voice.js` 的 `VOICE_DEFAULTS`）。这是双轨期的安全网：任何一份 md 写坏或被误删，学生端不会开天窗。等线上跑稳再单独提一次删除 JS 常量的收尾提交。

## 覆盖白名单（D4）

**不可覆盖**（课程写了也不生效，且应由 lint 拦截）：

- 三条底线规则的任何内容；
- 絮絮的名字、基础形象、人设底色；
- CC/CQ 标签树的编号语义。

**可覆盖**（课程声明后真正生效）：

| 课程侧写在哪 | 覆盖什么 | 平台缺省 |
|---|---|---|
| `course.md / ## 人设侧重` | `character`、`tone`、`口头禅`、`侧重` | `companion.md` |
| `course.md / ## 话术覆盖` | 61 个话术模板，按 key 逐条 | `voice.md` |
| `course.md / ## 学段规范` | 各学段字数、硬上限、句式 | `language-levels.md` |
| `course.md / ## 脚手架` | L0–L4 语义与升档参数 | `scaffolding.md` |
| `course.md / ## 工具缺省` | 十种工具显示名与缺省 label | `tool-defaults.md` |
| `course.md / ## 数值缺省`、任务块字段 | 时长、提醒、冷却、推进方式 | `defaults.md` |

判断标准：教研或内容团队可能想调的 → 进 md；纯工程参数（超时、重试、连接池）→ 留代码。

**注意 `人设侧重` 是课程私有的**：它只进服务端 Prompt，不下发到浏览器公开包（编译时刻意绕开 `parseLesson`，见 `compiler.js`）。同理，话术模板会在编译期过一遍防剧透——课程覆盖的话术命中本课保护词时**编译直接失败**，不会等到学生面前才发现。

### 声明格式

每份可覆盖的平台文件在头部用引用块声明自己的覆盖属性与合并粒度：

```md
> overridable: true
> merge: by-key          # by-key 逐键覆盖 ｜ replace 整体替换 ｜ append 追加
> course-field: 人设侧重  # 课程侧对应的字段或文件
> locked: name、posterAsset  # 可选：本文件内不许课程覆盖的键
```

`immutable` 文件同样声明，值为 `overridable: false`。声明块必须写在第一个 `## 小节` 之前，`overridable` 与 `merge` 取值非法时课程编译直接报错，不会静默按缺省处理。

正文格式：`## 小节` 下的 `- 键：值` 是可覆盖的键值；小节里的其余正文行作为该小节的模板文本（`voice.md` 这类用它）。课程覆盖被 `locked` 或 `overridable: false` 拦下时不会静默丢弃，会产出一条 warning 挂在编译结果的 `course.platformDefaults.warnings` 上。

## 编译行为

引擎按以下顺序拼装 System Prompt：

1. `_platform` 底线规则 → 不可覆盖的前缀（最高优先级）
2. 平台缺省层（人设/话术/学段/脚手架策略）← 课程按白名单覆盖
3. `lesson_xxx/course.md` → 人设侧重与课程元数据
4. `lesson_xxx/prompts/phaseN.md` → 当前阶段提示词（阶段氛围与全班节奏）
5. 当前任务单元的**就地引导与脚手架**（v2 起写在 `roles/<role>.md` 内）
6. `lesson_xxx/restrictions.md` → 命中的最小限制片段

## 运行边界

- `_platform` 不会成为学生可选择的课程，也不会进入浏览器公开课程包；
- 服务端把三份规则按"安全 → 教学 → 隐私"顺序编译为私有 `platformRules`；
- 规则包具有 SHA-256 内容版本，版本变化会使已有课程缓存失效；
- 平台规则同时注入学生主对话和结构化 Step 的 AI 验收 Prompt；
- 课程人设、阶段 Prompt、任务引导、知识和学生输入与平台规则冲突时，以平台规则为准；
- 代码中的确定性安全检查继续保留，作为模型规则之外的执行层保护。
