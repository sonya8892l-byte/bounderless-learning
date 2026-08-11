import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  clearCourseCache,
  compileCourse,
  parseRestrictionDocument,
  resolveRestrictionReferences,
  resolveStepRestrictions,
} from '../server/course/compiler.js';
import { buildAgentPrompt } from '../server/agent/prompt.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function sessionAt(taskIndex, stepIndex) {
  return {
    phaseId: 'phase-2',
    phaseNumber: 2,
    roleId: 'signaler',
    currentTaskIndex: taskIndex,
    scaffoldLevel: 0,
    completedTaskIds: [],
    events: [],
    messages: [],
    taskState: {
      taskId: `task-${taskIndex + 1}`,
      guidanceStepIndex: stepIndex,
      startedAt: new Date().toISOString(),
      lastMeaningfulActionAt: new Date().toISOString(),
    },
  };
}

function promptFor(course, role, session, includeRestrictions = true) {
  return buildAgentPrompt({
    course,
    role,
    session,
    knowledge: [],
    input: { type: 'user_text', text: '我该怎么记录？' },
    decision: {
      intent: 'course_question',
      includeTaskContext: true,
      includeRestrictions,
      allowedTools: [],
    },
  }).instructions;
}

test('restrictionRef 精确解析当前 Step 的列表章节', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const role = course.roles.find((item) => item.id === 'signaler');
  const step = role.tasks[0].steps[0];
  const resolved = resolveStepRestrictions(course, step);

  assert.deepEqual(resolved.map((item) => item.title), ['史料与表达限制']);
  assert.match(resolved[0].text, /不生成毛泽东、周恩来/);
  assert.doesNotMatch(resolved[0].text, /不提供适用于现实冲突/);
  assert.ok(course.restrictionDocument.sections.some((item) => item.title === '安全限制'));
});

test('三级限制章节在下一个同级标题前结束', () => {
  const document = parseRestrictionDocument(`## 表达边界
总说明

### 史料表达
- 不虚构直接引语
- 推断要明确标记

### 安全边界
- 遇到危险呼叫老师

## 其他限制
- 不提前给答案`);
  const resolved = resolveRestrictionReferences(document, 'restrictions.md#史料表达');

  assert.deepEqual(resolved.map((item) => item.title), ['史料表达']);
  assert.match(resolved[0].text, /不虚构直接引语/);
  assert.doesNotMatch(resolved[0].text, /遇到危险/);
  assert.doesNotMatch(resolved[0].text, /不提前给答案/);
});

test('Prompt 同时包含未解锁表格名称和当前 Step 引用限制', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const role = course.roles.find((item) => item.id === 'signaler');
  const instructions = promptFor(course, role, sessionAt(0, 0));

  assert.match(instructions, /未解锁表格限制名称/);
  assert.match(instructions, /一渡完整方案/);
  assert.match(instructions, /当前小步引用限制/);
  assert.match(instructions, /不生成毛泽东、周恩来/);
  assert.doesNotMatch(instructions, /Phase 3前不向任何单一角色提供五层战图全貌/);
  assert.doesNotMatch(instructions, /不提供适用于现实冲突/);
});

test('平台规则始终位于课程身份和任务上下文之前', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const role = course.roles.find((item) => item.id === 'signaler');
  const instructions = promptFor(course, role, sessionAt(0, 0), false);

  assert.match(instructions, /\[平台规则｜最高优先级\]/);
  assert.match(instructions, /禁止建议学生攀爬、跳跃、靠近水域边缘/);
  assert.match(instructions, /不主动询问学生的家庭信息、联系方式、健康状况/);
  assert.ok(instructions.indexOf('[平台规则｜最高优先级]') < instructions.indexOf('[身份]'));
  assert.ok(instructions.indexOf('[平台规则｜最高优先级]') < instructions.indexOf('[任务]'));
});

test('多个 restrictionRef 只注入教学限制与安全限制', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const role = course.roles.find((item) => item.id === 'signaler');
  const instructions = promptFor(course, role, sessionAt(1, 1));

  assert.match(instructions, /不进行组间排名/);
  assert.match(instructions, /不提供适用于现实冲突/);
  assert.doesNotMatch(instructions, /不生成毛泽东、周恩来/);

  const withoutRestrictions = promptFor(course, role, sessionAt(1, 1), false);
  assert.doesNotMatch(withoutRestrictions, /不进行组间排名/);
  assert.doesNotMatch(withoutRestrictions, /不提供适用于现实冲突/);
  assert.match(withoutRestrictions, /禁止建议学生攀爬、跳跃、靠近水域边缘/);
});

test('表格行引用仅解析对应限制项', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  const resolved = resolveStepRestrictions(course, {
    restrictionRef: 'restrictions.md#一渡完整方案',
  });

  assert.deepEqual(resolved.map((item) => item.title), ['一渡完整方案']);
  assert.match(resolved[0].text, /1935年1月29日/);
  assert.doesNotMatch(resolved[0].text, /1935年2月18日至21日/);
});
