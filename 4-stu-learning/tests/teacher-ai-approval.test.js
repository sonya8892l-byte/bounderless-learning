import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createAgentService } from '../server/agent/service.js';
import { createTeacherCommandAuthority } from './helpers/teacher-command-authority.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = {
        id: 'ses_teacher_ai_approval',
        courseId: values.courseId,
        roleId: values.roleId,
        studentId: values.studentId,
        groupId: values.groupId,
        phaseId: values.phaseId,
        phaseNumber: 2,
        currentTaskIndex: 0,
        scaffoldLevel: 0,
        completedTaskIds: [],
        events: [],
        messages: [],
        pendingTools: {},
        handledRequestIds: [],
        timeBalance: 0,
        timeEarned: 0,
        completedBankTaskIds: [],
        gifts: [],
      };
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

function evaluationSequenceLlm(results) {
  let evaluationCalls = 0;
  return {
    get evaluationCalls() { return evaluationCalls; },
    capabilities: () => ({ nativeTools: true, vision: true }),
    async generate(request) {
      if (request.jsonMode) {
        const passed = results[evaluationCalls] ?? false;
        evaluationCalls += 1;
        return {
          text: JSON.stringify({
            passed,
            feedback: passed ? '证据符合要求。' : '还缺一张能看清材质或纹理的照片。',
            missing: passed ? [] : ['材质或纹理'],
            safetyIssue: false,
          }),
          toolCalls: [],
        };
      }
      return { text: '好的，继续。', toolCalls: [] };
    },
  };
}

function photoStepData(task, stepIndex) {
  const step = task.steps[stepIndex];
  const minimum = Number(step.tools.find((tool) => tool.id === 'photo')?.config?.minCount || 1);
  return {
    taskId: task.id,
    stepId: step.id,
    stepIndex,
    stepText: step.studentAction,
    completionMode: step.completionMode,
    localEvidenceCount: minimum,
    toolValues: { [step.id]: { photo: { count: minimum } } },
    stepImages: ['data:image/jpeg;base64,AA=='],
  };
}

test('approve_evidence 可人工通过达到最大尝试次数的 AI 验收小步', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const task = role.tasks[0];
  const llm = evaluationSequenceLlm([true, true, false, false, false]);
  const authority = createTeacherCommandAuthority();
  const agent = createAgentService({
    llm,
    store: memoryStore(),
    getCourse: async () => course,
    consumeTeacherCommand: authority.consume,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: role.id,
    studentId: 'student-1-1',
    groupId: 'group-1',
  });

  await agent.runTurn({
    sessionId: session.id,
    requestId: 'assign-role',
    input: { type: 'lifecycle_event', event: 'role_assigned' },
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'ready',
    input: { type: 'user_text', text: '我已经到位，也准备好了' },
  });

  for (const stepIndex of [0, 1]) {
    await agent.runTurn({
      sessionId: session.id,
      requestId: `pass-step-${stepIndex}`,
      input: {
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: photoStepData(task, stepIndex),
      },
    });
  }

  const finalStepIndex = 2;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await agent.runTurn({
      sessionId: session.id,
      requestId: `fail-final-step-${attempt}`,
      input: {
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: photoStepData(task, finalStepIndex),
      },
    });
  }

  const finalStep = task.steps[finalStepIndex];
  assert.equal(session.taskState.guidanceStepIndex, finalStepIndex);
  assert.equal(session.taskState.stepAttempts[finalStep.id], 3);
  assert.equal(session.taskState.finalization.status, 'revision_required');
  assert.deepEqual(session.learningState.completedStepIds, ['task-1-step-1', 'task-1-step-2']);

  const evaluationsBeforeApproval = llm.evaluationCalls;
  const teacherCommandId = authority.issue({
    sessionId: session.id,
    action: 'approve_evidence',
  });
  const approved = await agent.runTurn({
    sessionId: session.id,
    requestId: 'teacher-approves-ai-evidence',
    input: {
      type: 'lifecycle_event',
      event: 'task_step_completed',
      data: {
        ...photoStepData(task, finalStepIndex),
        teacherApproved: true,
        teacherCommandId,
      },
    },
  });

  assert.equal(llm.evaluationCalls, evaluationsBeforeApproval, '人工通过后不应再调用 AI 复评');
  assert.equal(approved.session.currentTaskIndex, 1, '自动推进任务应进入下一任务');
  assert.ok(approved.session.completedTaskIds.includes('dragon-counter:task-1'));
  assert.ok(approved.session.consumedTeacherCommandIds.includes(teacherCommandId));
  assert.ok(
    approved.events.some((event) => (
      event.type === 'state.updated'
      && event.data.runtime?.taskId === 'task-2'
      && event.data.runtime?.guidanceStepIndex === 0
    )),
    '学生端应收到下一任务的权威状态',
  );
});

test('学生端 approve_evidence 为 AI 验收小步携带当前证据与教师授权', () => {
  const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));
  const source = fs.readFileSync(controllerPath, 'utf8');
  const handler = source.match(/approve_evidence: async \(command\) => \{[\s\S]+?\n    \},\n    reject_evidence:/u)?.[0] || '';

  assert.match(handler, /\['teacher_confirm', 'ai_evaluation'\]\.includes\(step\?\.completionMode\)/u);
  assert.match(handler, /toolValues: serializableToolValues\(evidence\)/u);
  assert.match(handler, /teacherApproved: true/u);
  assert.match(handler, /teacherCommandId: command\.id/u);
});
