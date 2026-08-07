import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { toAgentContext } from '../server/course/agent-context.js';
import { buildAgentPrompt } from '../server/agent/prompt.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const lessonsRoot = resolve(import.meta.dirname, '../../6-lessons');

function sessionFor(courseId, roleId, overrides = {}) {
  const session = createSessionRecord({ courseId, roleId, grade: '初中', phaseId: 'phase-2' });
  return Object.assign(session, overrides);
}

test('切片带齐 Prompt 需要的全部材料', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const session = sessionFor('lesson_gewu_001', role.id);

  const context = toAgentContext({ course, session, role, guidanceStepIndex: 0 });

  assert.equal(context.courseTitle, course.lesson.title);
  assert.equal(context.task.id, role.tasks[0].id);
  assert.equal(context.phase?.id, 'phase-2');
  assert.equal(context.stepCount, role.tasks[0].steps.length);
  assert.ok(context.companion?.name, '人设必须在切片里');
  assert.ok(context.guidance.length > 0, '就地引导必须在切片里');
  assert.ok(Array.isArray(context.stepRestrictions));
  assert.ok(Array.isArray(context.lockedRestrictionNames));
});

test('Step 级引导优先于任务级，两者不叠加', () => {
  const course = {
    lesson: { title: '测试课', phases: [] },
    phasePrompts: {},
    restrictions: [],
    restrictionMarkdown: '',
    platformDefaults: {},
  };
  const role = {
    id: 'r1',
    tools: [],
    tasks: [{
      id: 't1',
      guidance: '任务级引导',
      steps: [
        { id: 's1', studentAction: '第一步', guidance: '小步级引导' },
        { id: 's2', studentAction: '第二步' },
      ],
    }],
  };

  const first = toAgentContext({ course, session: { currentTaskIndex: 0 }, role, guidanceStepIndex: 0 });
  assert.equal(first.guidance, '小步级引导', '有小步引导时不该用任务级');

  const second = toAgentContext({ course, session: { currentTaskIndex: 0 }, role, guidanceStepIndex: 1 });
  assert.equal(second.guidance, '任务级引导', '小步没写引导时回落任务级');
});

test('小步序号越界时收敛到最后一步，不返回 undefined', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles[0];
  const session = sessionFor('lesson_gewu_001', role.id, { currentTaskIndex: 999 });

  const context = toAgentContext({ course, session, role, guidanceStepIndex: 999 });

  assert.equal(context.task.id, role.tasks.at(-1).id, '任务索引越界应收敛到最后一个任务');
  assert.equal(context.stepIndex, context.stepCount - 1);
  assert.ok(context.stepLabel, '小步文案不能是 undefined');
});

test('未解锁的限制只给名字，已解锁的不列入', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles[0];

  const early = toAgentContext({ course, session: sessionFor('lesson_gewu_001', role.id), role });
  const late = toAgentContext({
    course,
    session: sessionFor('lesson_gewu_001', role.id, { phaseNumber: 9 }),
    role,
  });

  assert.ok(early.lockedRestrictionNames.length > 0, '开局应有未解锁的限制');
  assert.ok(
    late.lockedRestrictionNames.length <= early.lockedRestrictionNames.length,
    '推进后未解锁的限制不该变多',
  );
});

test('buildAgentPrompt 消费切片后行为不变：Prompt 仍含任务与小步事实', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const session = sessionFor('lesson_gewu_001', role.id);
  const task = role.tasks[0];

  const { instructions } = buildAgentPrompt({
    course,
    session,
    role,
    knowledge: [],
    input: { type: 'user_text', text: '我该做什么' },
    decision: { intent: 'task_progress', includeTaskContext: true, includeRestrictions: true },
  });

  assert.match(instructions, new RegExp(task.name));
  assert.match(instructions, new RegExp(`1/${task.steps.length}`));
  assert.match(instructions, /课程：/);
});
