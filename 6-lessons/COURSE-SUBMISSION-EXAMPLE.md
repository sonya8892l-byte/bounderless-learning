# 课程提交参考：`lesson_gewu_001`

> 唯一字段规范：[`COURSE-SUBMISSION-SPEC.md`](./COURSE-SUBMISSION-SPEC.md)
> 可运行参考包：[`lesson_gewu_001/`](./lesson_gewu_001/)

本文件只提供真实课程的查找入口，不复制课程正文。编写新课时，先按提交规范确定四层结构，再到`lesson_gewu_001`查看对应字段的完整可运行写法。

## 1. 四层实例

| 层级 | 格物课实例 | 查看位置 |
|---|---|---|
| Phase | Phase 1“沉浸叙事”到 Phase 6“尾声” | [`course.md / 阶段编排`](./lesson_gewu_001/course.md) |
| Role | 数龙官、测坡官、寻沟官、引河官、护城官、真相官 | [`roles/`](./lesson_gewu_001/roles/) |
| Task | 数龙官的“观其形”“数其量”“究其理” | [`roles/dragon-counter.md`](./lesson_gewu_001/roles/dragon-counter.md) |
| Step | “拍摄螭首正面全景”“记录连接方式”“补齐形态细节” | 同一角色文件的 Task 内 |

## 2. `course.md` 实例

| 想看什么 | 位置 |
|---|---|
| 课程名称、场地、时长、年级、分组 | [`course.md / 基本信息`](./lesson_gewu_001/course.md) |
| 课程核心问题 | [`course.md / 核心问题`](./lesson_gewu_001/course.md) |
| 角色选择页文案与收集物体系 | [`course.md / 学生端角色体系`](./lesson_gewu_001/course.md) |
| 对话与闯关视图配置 | [`course.md / 学习视图`](./lesson_gewu_001/course.md) |
| 封面、导航图和导入预览图 | [`course.md / 学生端视觉素材`](./lesson_gewu_001/course.md) |
| DK、DS、DC 课程目标 | [`course.md / 课程目标体系`](./lesson_gewu_001/course.md) |
| 六个 Phase 与入口阶段任务 | [`course.md / 阶段编排`](./lesson_gewu_001/course.md) |
| 防剧透和解锁条件 | [`course.md / 课程限制规则`](./lesson_gewu_001/course.md) |

## 3. 角色与任务实例

以[`roles/dragon-counter.md`](./lesson_gewu_001/roles/dragon-counter.md)为主参考：

- `## 基本信息`展示角色排序、地点、围栏、选择说明、角色图片与收集物。
- `### 任务N`展示角色 Task 的 id、位置继承、提醒节奏、推进方式、任务图、配置、通过条件和目标关联。
- Task 下的`##### 引导`保存该任务的引导目标与提问边界。
- Task 下的`##### 脚手架`保存 L0—L4 的具体提示。
- `#### Step N`保存小步目标、学生行动、位置、完成方式、证据、工具、知识、限制、失败处理和通过后目标。
- Step 下的`##### 验收标准`是当前步 AI 判定的直接依据。

其他角色文件采用相同结构：

- [`roles/slope-surveyor.md`](./lesson_gewu_001/roles/slope-surveyor.md)
- [`roles/ditch-finder.md`](./lesson_gewu_001/roles/ditch-finder.md)
- [`roles/river-guide.md`](./lesson_gewu_001/roles/river-guide.md)
- [`roles/moat-guard.md`](./lesson_gewu_001/roles/moat-guard.md)
- [`roles/truth-seeker.md`](./lesson_gewu_001/roles/truth-seeker.md)

## 4. Phase Prompt 实例

六份文件都只包含五个标准二级标题：阶段目标、絮絮行为、开场白模板、禁止行为、转场条件。

- [`prompts/phase1-immersive.md`](./lesson_gewu_001/prompts/phase1-immersive.md)
- [`prompts/phase2-field.md`](./lesson_gewu_001/prompts/phase2-field.md)
- [`prompts/phase3-deduction.md`](./lesson_gewu_001/prompts/phase3-deduction.md)
- [`prompts/phase4-xuanji.md`](./lesson_gewu_001/prompts/phase4-xuanji.md)
- [`prompts/phase5-summary.md`](./lesson_gewu_001/prompts/phase5-summary.md)
- [`prompts/phase6-ending.md`](./lesson_gewu_001/prompts/phase6-ending.md)

Phase 首次进入时显示`开场白模板`一次；其余四段约束该阶段的 AI 对话。

## 5. 知识、限制、验收与时间银行实例

| 内容 | 真实文件 |
|---|---|
| 可检索课程知识 | [`knowledge/`](./lesson_gewu_001/knowledge/) |
| 防剧透与解锁规则 | [`course.md / 课程限制规则`](./lesson_gewu_001/course.md) |
| 全课验收兜底 | [`evaluation.md`](./lesson_gewu_001/evaluation.md) |
| 时间银行 | [`time-bank.md`](./lesson_gewu_001/time-bank.md) |
| 素材 | [`assets/`](./lesson_gewu_001/assets/) |

## 6. 验证

在仓库根目录运行：

```bash
npm run lint:lesson --workspace 4-stu-learning -- --strict
npm test
npm run build
```

验证通过后，检查学生端课程入口、角色选择、Phase 开场、任务卡、Step 工具和 AI 验收。
