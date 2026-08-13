/**
 * 智能体投影：按 角色 × 任务 × 小步 × 模式 从 IR 上切一片。
 *
 * 图二第三段的设计意图是「Prompt 装配器从"到处凑材料"变成"消费一个切片"」。
 * 改造前 buildAgentPrompt 自己去 course.lesson.phases.find、role.tools.find、
 * course.phasePrompts、course.restrictions 各处取料，取料与拼字符串混在一个函数里。
 *
 * 本模块只负责**取料**，不负责措辞：返回结构化字段，拼装仍在 prompt.js。
 * 这样两件事可以各自演进——换 Prompt 措辞不动取料，换课程结构不动措辞。
 *
 * 纯函数，不碰 session（只读），不调模型。
 */

import { restrictionUnlocked } from './retrieval.js';
import { resolveStepRestrictions } from './restriction-sections.js';

/**
 * 按**下标**取任务：越界时收敛到最后一个，与改造前的 currentTask 行为一致。
 *
 * ⚠️ 名字里带 `AtIndex` 不是啰嗦。这个函数原来也叫 `currentTaskOf`，与
 * `server/agent/task-advance.js` 导出的同名函数**签名不兼容**——那个收 `session`，
 * 这个收 `taskIndex`。两者搞混不会抛错，会静默返回 `tasks[0]`：
 *
 * ```js
 * currentTaskOf(role, session)   // 期望 task-3，实得 task-1（Number({}) → NaN → 0）
 * ```
 *
 * 也就是**把学生悄悄退回第一个任务**，没有任何报错。R3-1 收敛取值表达式时正好
 * 要把 `task-advance.js` 那个 import 到十几处，同名不同参就成了地雷，故改名。
 */
export function taskAtIndex(role, taskIndex = 0) {
  const tasks = role?.tasks || [];
  return tasks[Math.min(Number(taskIndex) || 0, tasks.length - 1)];
}

/**
 * 小步序列。任务有 steps 用 steps，否则回落 guidanceSteps，再否则用任务要求本身。
 * 这三级回落是旧格式课程的兼容路径，不能省。
 */
function stepLabels(task) {
  if (task?.steps?.length) return task.steps.map((step) => step.studentAction || step.objective);
  if (task?.guidanceSteps?.length) return task.guidanceSteps;
  return [task?.requirement];
}

/**
 * 活动组织信息切片：answer_logistics 唯一的取料来源。
 *
 * 刻意与课程知识分开：组织信息不走 knowledge/ 检索（它不在知识库里），
 * 也不走 restrictions 屏蔽（它不是待学生探索的答案）。它就是现场安排的事实。
 *
 * 只收课程包里确实写了的字段。**不在这里的东西 Prompt 必须承认不知道**——
 * 场馆平面图、厕所方位、绝对结束时刻都不在课程 md 里，编一个比不答更危险。
 */
export function toLogisticsContext({ course, session, role, teacherName = '' }) {
  const lesson = course?.lesson || {};
  const phase = lesson.phases?.find((item) => item.id === session?.phaseId);
  const task = taskAtIndex(role, session?.currentTaskIndex);
  const timeBank = lesson.timeBank || {};
  return {
    venue: String(lesson.venue || ''),
    duration: String(lesson.duration || ''),
    grades: String(lesson.grades || ''),
    groupRule: String(lesson.groupRule || ''),
    phaseName: phase?.name || '',
    phaseDuration: String(phase?.duration || ''),
    phaseMode: String(phase?.mode || ''),
    phaseLocation: String(phase?.location || ''),
    taskLocationName: task?.location?.name || '',
    timeBankEnabled: timeBank.enabled === true,
    timeBankMaxEarn: String(timeBank.maxEarnTotal ?? timeBank.max_earn_total ?? ''),
    timeBankGiftRule: String(timeBank.giftTarget ?? timeBank.gift_target ?? ''),
    teacherName: String(teacherName || '带队老师'),
    phrases: course?.platformDefaults?.logistics?.phrases || {},
    constraints: String(course?.platformDefaults?.logistics?.constraints || ''),
  };
}

/**
 * @param {object} params
 * @param {object} params.course 编译产物（IR）
 * @param {object} params.session 会话（只读）
 * @param {object} params.role 当前角色
 * @param {number} params.guidanceStepIndex 当前小步序号
 * @returns 智能体切片：人设、学段、任务、小步、脚手架、限制、阶段提示
 */
export function toAgentContext({ course, session, role, guidanceStepIndex = 0 }) {
  const task = taskAtIndex(role, session?.currentTaskIndex);
  const labels = stepLabels(task);
  const stepIndex = Math.min(Number(guidanceStepIndex) || 0, Math.max(0, labels.length - 1));
  const step = task?.steps?.[stepIndex];

  const phase = course.lesson.phases.find((item) => item.id === session?.phaseId);
  const tool = role.tools?.find((item) => item.taskIndex === session?.currentTaskIndex);

  // 未解锁的限制只给名字（模型需要知道"这个不能说"），已解锁的不必列。
  const lockedRestrictionNames = course.restrictions
    .filter((rule) => !restrictionUnlocked(rule, session, course))
    .map((rule) => rule.name);

  return {
    courseTitle: course.lesson.title,
    companion: course.platformDefaults?.companion,
    languageLevels: course.platformDefaults?.languageLevels,
    scaffolding: course.platformDefaults?.scaffolding,

    phase,
    phasePrompt: String(course.phasePrompts?.[session?.phaseId] || ''),
    phasePolicy: course.phasePolicies?.[session?.phaseId] || null,

    role,
    task,
    tool,

    step,
    stepIndex,
    stepCount: labels.length,
    stepLabel: labels[stepIndex],
    // 就地引导：Step 级优先于任务级，两者不叠加。
    guidance: String(step?.guidance || task?.guidance || ''),

    lockedRestrictionNames,
    stepRestrictions: resolveStepRestrictions(course, step),
  };
}
