import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: `ses_photo_revision_${sessions.size + 1}` });
      sessions.set(session.id, structuredClone(session));
      return session;
    },
    async get(id) {
      const session = sessions.get(id);
      return session ? structuredClone(session) : null;
    },
    async save(session) {
      sessions.set(session.id, structuredClone(session));
      return session;
    },
  };
}

function photoStep(taskId, suffix) {
  return {
    id: `${taskId}-photo-${suffix}`,
    objective: `拍摄证据 ${suffix}`,
    studentAction: `拍摄位置 ${suffix}`,
    completionMode: 'ai_evaluation',
    evidenceRequirement: '提交一张可核对的现场照片',
    acceptance: '照片能支持本步观察。',
    tools: [{
      id: 'photo',
      name: '拍照采集',
      module: 'A01',
      config: { minCount: 1, maxCount: 2 },
    }],
  };
}

async function harness({ evaluationOutcomes = [] } = {}) {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const task = role.tasks[0];
  const steps = [photoStep(task.id, 'a'), photoStep(task.id, 'b')];
  Object.assign(task, {
    completionMode: 'user_confirm',
    finalizationMode: 'explicit_bundle_submit',
    advanceMode: 'auto_after_validation',
    guidanceSteps: steps.map((step) => step.studentAction),
    steps,
    tools: [],
    location: { mode: 'none', verification: 'none', name: '' },
  });
  role.tasks[1].location = { mode: 'none', verification: 'none', name: '' };
  course.taskGraph = null;

  const evaluationCalls = [];
  const llm = {
    capabilities: () => ({ nativeTools: true, vision: true, streaming: false }),
    async generate(request) {
      evaluationCalls.push(request);
      const passed = request.instructions?.includes('[小步验收器职责]')
        ? (evaluationOutcomes.shift() ?? true)
        : true;
      return {
        text: JSON.stringify({
          passed,
          feedback: passed ? '照片能够支持本步观察。' : '照片没有同时保留目标与位置关系。',
          missing: passed ? [] : ['补一张包含目标与位置关系的全景'],
          safetyIssue: false,
        }),
        toolCalls: [],
      };
    },
  };
  const store = memoryStore();
  const agent = createAgentService({ llm, evaluationLlm: llm, store, getCourse: async () => course });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: role.id,
    studentId: 'photo-revision-student',
    groupId: 'photo-revision-group',
  });
  const started = await agent.runTurn({
    sessionId: session.id,
    requestId: 'photo-revision-start',
    input: { type: 'lifecycle_event', event: 'phase_started', data: {} },
  });
  const taskCall = started.events.find((event) => (
    event.type === 'tool.requested' && event.data.name === 'open_task_tool'
  ));
  assert.ok(taskCall, '测试前提：任务卡应打开');
  return { agent, evaluationCalls, role, task, session, taskCall };
}

async function completePhotoStep(agent, session, task, stepIndex, revision = 1, assetId = '') {
  const step = task.steps[stepIndex];
  return agent.runTurn({
    sessionId: session.id,
    requestId: `photo-step-${stepIndex}-${revision}`,
    input: {
      type: 'lifecycle_event',
      event: 'task_step_completed',
      data: {
        taskId: task.id,
        stepId: step.id,
        stepIndex,
        toolValues: {
          [step.id]: { photo: { count: 1, revision, assetIds: [assetId || `${step.id}-${revision}`] } },
        },
        stepImages: ['data:image/jpeg;base64,AA=='],
      },
    },
  });
}

function bundleInput(taskCall, values) {
  return {
    type: 'tool_result',
    toolCallId: taskCall.data.callId,
    result: {
      status: 'completed',
      values: { toolValues: values, photoEvidenceCount: 99, text: '' },
      evidence: [],
    },
  };
}

test('整包按 Step 校验；同数换图需 revision 重验，通过后才可收口', async () => {
  const { agent, evaluationCalls, role, task, session, taskCall } = await harness();
  const first = await completePhotoStep(agent, session, task, 0, 1, 'asset-a1');
  const completed = await completePhotoStep(agent, session, task, 1, 1, 'asset-b1');
  assert.equal(completed.session.taskState.guidanceStepIndex, 2);
  assert.equal(completed.session.taskState.finalization.status, 'awaiting_bundle_submit');
  assert.match(completed.session.taskState.stepEvidenceFingerprints[task.steps[0].id].fingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(
    first.session.taskState.stepEvidenceFingerprints[task.steps[0].id].fingerprint,
    completed.session.taskState.stepEvidenceFingerprints[task.steps[1].id].fingerprint,
  );

  const redistributed = {
    [task.steps[0].id]: { photo: { count: 0, revision: 2, assetIds: [] } },
    [task.steps[1].id]: { photo: { count: 2, revision: 2, assetIds: ['asset-b1', 'asset-b2'] } },
  };
  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'bundle-redistributed',
    input: bundleInput(taskCall, redistributed),
  }), (error) => {
    assert.equal(error.code, 'STEP_PHOTO_REQUIRED');
    assert.equal(error.details.stepId, task.steps[0].id);
    return true;
  });

  const replaced = {
    [task.steps[0].id]: { photo: { count: 1, revision: 2, assetIds: ['asset-a2'] } },
    [task.steps[1].id]: { photo: { count: 1, revision: 1, assetIds: ['asset-b1'] } },
  };
  await assert.rejects(agent.runTurn({
    sessionId: session.id,
    requestId: 'bundle-replaced-without-review',
    input: bundleInput(taskCall, replaced),
  }), (error) => {
    assert.equal(error.code, 'STEP_REVISION_REQUIRES_REEVALUATION');
    assert.equal(error.details.stepId, task.steps[0].id);
    return true;
  });

  const revisionId = 'revision-a2';
  const revised = await agent.runTurn({
    sessionId: session.id,
    requestId: 'step-a-revision',
    input: {
      type: 'lifecycle_event',
      event: 'task_step_revised',
      data: {
        revisionId,
        taskId: task.id,
        stepId: task.steps[0].id,
        stepIndex: 0,
        toolValues: replaced,
        stepImages: ['data:image/jpeg;base64,BB=='],
      },
    },
  });
  assert.equal(revised.session.taskState.guidanceStepIndex, 2, '重验不得重复推进 Step');
  assert.equal(revised.session.taskState.finalization.status, 'awaiting_bundle_submit');
  assert.equal(revised.session.taskState.lastStepRevision.revisionId, revisionId);
  assert.equal(revised.session.taskState.lastStepRevision.passed, true);
  assert.equal(revised.session.taskState.lastStepRevision.changed, true);
  assert.equal(revised.session.taskState.stepRevisionHistory.length, 1);
  assert.equal(revised.events.at(-1).data.runtime.lastStepRevision.revisionId, revisionId);

  const submitted = await agent.runTurn({
    sessionId: session.id,
    requestId: 'bundle-after-revision',
    input: bundleInput(taskCall, replaced),
  });
  assert.equal(submitted.session.currentTaskIndex, 1);
  assert.deepEqual(submitted.session.completedTaskIds, [`${role.id}:${task.id}`]);
  assert.equal(
    evaluationCalls.filter((request) => request.instructions?.includes('[小步验收器职责]')).length,
    3,
    '两个首次验收加一次修改重验',
  );
});

test('修改后的 AI 重验失败会留痕但不覆盖原通过指纹，重复 requestId 不重复验收', async () => {
  const { agent, task, session } = await harness({ evaluationOutcomes: [true, true, false] });
  await completePhotoStep(agent, session, task, 0, 1, 'asset-a1');
  const completed = await completePhotoStep(agent, session, task, 1, 1, 'asset-b1');
  const originalFingerprint = completed.session.taskState
    .stepEvidenceFingerprints[task.steps[0].id].fingerprint;
  const revisedValues = {
    [task.steps[0].id]: { photo: { count: 1, revision: 2, assetIds: ['asset-a2'] } },
    [task.steps[1].id]: { photo: { count: 1, revision: 1, assetIds: ['asset-b1'] } },
  };
  const revisionInput = {
    type: 'lifecycle_event',
    event: 'task_step_revised',
    data: {
      revisionId: 'revision-failed',
      taskId: task.id,
      stepId: task.steps[0].id,
      stepIndex: 0,
      toolValues: revisedValues,
      stepImages: ['data:image/jpeg;base64,CC=='],
    },
  };
  const failed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'failed-revision-request',
    input: revisionInput,
  });
  assert.equal(failed.session.taskState.guidanceStepIndex, 2);
  assert.equal(failed.session.taskState.lastStepRevision.passed, false);
  assert.equal(failed.session.learningState.stageValidation, 'revision_required');
  assert.equal(
    failed.session.taskState.stepEvidenceFingerprints[task.steps[0].id].fingerprint,
    originalFingerprint,
  );
  assert.match(
    failed.events.find((event) => event.type === 'assistant.completed')?.data.text || '',
    /位置关系/,
  );

  const replay = await agent.runTurn({
    sessionId: session.id,
    requestId: 'failed-revision-request',
    input: revisionInput,
  });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.session.taskState.stepRevisionHistory.length, 1);
});
