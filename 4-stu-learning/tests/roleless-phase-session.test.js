import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { renderPhaseOpening } from '../server/course/phase-policy.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

function memoryStore() {
  const sessions = new Map();
  return {
    sessions,
    async create(values) {
      const session = createSessionRecord({ ...values, id: `ses_phase_${sessions.size + 1}` });
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

function mainLlm(record = []) {
  return {
    capabilities: () => ({ nativeTools: true, vision: false, streaming: true }),
    async generate(input) {
      record.push(input);
      if (input.instructions.includes('[小步验收器职责]')) {
        return {
          text: JSON.stringify({ passed: true, feedback: '判断和理由都已写清楚。', missing: [] }),
          toolCalls: [],
        };
      }
      return { text: '你好，我是絮絮。我们可以先聊聊你对这次课程的疑问。', toolCalls: [] };
    },
  };
}

function greetingUnderstandingLlm() {
  return {
    capabilities: () => ({ nativeTools: false, vision: false }),
    async generate() {
      return {
        text: JSON.stringify({
          intent: 'greeting',
          emotion: 'neutral',
          answersPendingQuestion: false,
          pendingAnswer: 'unknown',
          hasTaskRequest: false,
          locationKind: 'none',
          want: '打招呼',
          confidence: 0.98,
        }),
        toolCalls: [],
      };
    },
  };
}

async function harness({ evaluationLlm = null } = {}) {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const store = memoryStore();
  const modelCalls = [];
  const agent = createAgentService({
    llm: mainLlm(modelCalls),
    ...(evaluationLlm ? { evaluationLlm } : {}),
    understandingLlm: greetingUnderstandingLlm(),
    store,
    getCourse: async () => course,
  });
  return { course, store, modelCalls, agent };
}

function assistantText(result) {
  return result.events
    .filter((event) => event.type === 'assistant.completed')
    .map((event) => event.data.text)
    .join('');
}

function occurrences(text, expected) {
  if (!expected) return 0;
  return String(text).split(expected).length - 1;
}

function renderedPhaseOpening(course, phaseId, replacements = {}) {
  return renderPhaseOpening(course.phasePolicies?.[phaseId], {
    roleName: replacements['角色名'],
    firstLocation: replacements['首个地点'],
    studentName: replacements['学生名字'],
  });
}

test('Phase 1 开场只在首次 phase_started 中出现，先于阶段卡和工具且不调用模型', async () => {
  const { agent, course, modelCalls } = await harness();
  const { session } = await agent.createSession({
    courseId: course.id,
    studentId: 'phase-opening-student',
    groupId: 'phase-opening-group',
  });
  const opening = renderedPhaseOpening(course, 'phase-1');
  assert.ok(opening, 'Phase 1 必须提供开场白模板');

  const first = await agent.runTurn({
    sessionId: session.id,
    requestId: 'phase-opening-first',
    input: { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
  });
  const firstText = assistantText(first);
  const visible = first.events.filter((event) => (
    ['assistant.completed', 'stage.started', 'tool.requested'].includes(event.type)
  ));
  const stageIndex = visible.findIndex((event) => event.type === 'stage.started');
  const toolIndex = visible.findIndex((event) => event.type === 'tool.requested');

  assert.equal(occurrences(firstText, opening), 1, '首次进入 Phase 1 应完整展示一次阶段开场');
  assert.equal(visible[0]?.type, 'assistant.completed', '阶段开场应先于阶段卡展示');
  assert.ok(stageIndex > 0, '阶段卡应排在阶段开场之后');
  assert.ok(toolIndex > stageIndex, '任务工具应排在阶段开场和阶段卡之后');
  assert.equal(modelCalls.length, 0, '确定性阶段开场不得调用主模型');

  const repeated = await agent.runTurn({
    sessionId: session.id,
    requestId: 'phase-opening-repeated',
    input: { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
  });
  const persistedAssistantText = repeated.session.messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content)
    .join('\n');

  assert.equal(occurrences(assistantText(repeated), opening), 0, '重复阶段事件不能重播开场');
  assert.equal(occurrences(persistedAssistantText, opening), 1, '会话历史只持久化一份阶段开场');
  assert.equal(modelCalls.length, 0, '重复阶段事件也不得调用模型');
});

test('roleId 为空时从第一段阶段任务建会话，并能直接打开阶段工具', async () => {
  const { agent } = await harness();
  const { session, role } = await agent.createSession({
    courseId: 'lesson_gewu_001',
    studentId: 'phase-student',
    groupId: 'phase-group',
  });

  assert.equal(session.roleId, '');
  assert.equal(session.phaseId, 'phase-1');
  assert.equal(session.taskState.taskId, 'phase-1-task-1');
  assert.equal(role.scope, 'phase');
  assert.equal(role.tasks.length, 1);

  const started = await agent.runTurn({
    sessionId: session.id,
    requestId: 'phase-started',
    input: { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
  });
  const tool = started.events.find((event) => event.type === 'tool.requested');
  const state = started.events.find((event) => event.type === 'state.updated');
  assert.equal(tool.data.payload.taskId, 'phase-1-task-1');
  assert.equal(tool.data.payload.renderer, 'activity');
  assert.equal(state.data.taskScope, 'phase');
  assert.equal(state.data.roleId, '');
});

test('短片播放完成即自动完成当前唯一阶段任务，不出现整包提交层', async () => {
  const { agent, course } = await harness();
  const mediaTask = course.phaseTracks['phase-1'].tasks[0];
  mediaTask.tools[0].config.url = 'https://example.test/course-intro.mp4';
  mediaTask.steps[0].tools[0].config.url = 'https://example.test/course-intro.mp4';
  const { session } = await agent.createSession({
    courseId: 'lesson_gewu_001',
    studentId: 'media-student',
    groupId: 'media-group',
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'media-phase-started',
    input: { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
  });

  const completed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'media-playback-completed',
    input: {
      type: 'lifecycle_event',
      event: 'task_step_completed',
      data: {
        taskId: 'phase-1-task-1',
        stepId: 'phase-1-task-1-step-1',
        stepIndex: 0,
        completionMode: 'tool_result',
        toolValues: {
          'phase-1-task-1-step-1': { media: { completed: true } },
        },
      },
    },
  });

  assert.ok(completed.session.completedTaskIds.includes('phase-1:phase-1-task-1'));
  assert.equal(completed.session.currentTaskIndex, 0);
  assert.equal(completed.session.taskState.taskId, 'phase-1-task-1');
  assert.equal(completed.session.taskState.finalization.status, 'completed');
  const taskTools = completed.events
    .filter((event) => event.type === 'tool.requested')
    .map((event) => event.data.payload.taskId);
  assert.deepEqual(taskTools, []);
  const replies = completed.events
    .filter((event) => event.type === 'assistant.completed')
    .map((event) => event.data.text)
    .join(' ');
  assert.doesNotMatch(replies, /整理|再次提交/);
});

test('显式 posterOnly 情境图确认后可完成任务，无需伪造视频播放', async () => {
  const { agent, course } = await harness();
  const mediaTask = course.phaseTracks['phase-1'].tasks[0];
  assert.equal(mediaTask.steps[0].tools[0].config.url, '');
  assert.equal(mediaTask.steps[0].tools[0].config.posterOnly, true);

  const { session } = await agent.createSession({
    courseId: 'lesson_gewu_001',
    studentId: 'poster-only-student',
    groupId: 'poster-only-group',
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'poster-only-phase-started',
    input: { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
  });

  const completed = await agent.runTurn({
    sessionId: session.id,
    requestId: 'poster-only-view-confirmed',
    input: {
      type: 'lifecycle_event',
      event: 'task_step_completed',
      data: {
        taskId: 'phase-1-task-1',
        stepId: 'phase-1-task-1-step-1',
        stepIndex: 0,
        completionMode: 'tool_result',
        toolValues: {
          'phase-1-task-1-step-1': { media: { completed: true } },
        },
      },
    },
  });

  assert.ok(completed.session.completedTaskIds.includes('phase-1:phase-1-task-1'));
  assert.equal(completed.session.taskState.taskId, 'phase-1-task-1');
  assert.equal(completed.session.taskState.finalization.status, 'completed');
});

test('正式媒体没有播放源时，客户端 completed 标记不能绕过服务端', async () => {
  const { agent, store, course } = await harness();
  const mediaTask = course.phaseTracks['phase-1'].tasks[0];
  delete mediaTask.tools[0].config.posterOnly;
  delete mediaTask.steps[0].tools[0].config.posterOnly;
  const { session } = await agent.createSession({
    courseId: 'lesson_gewu_001',
    studentId: 'missing-media-student',
    groupId: 'missing-media-group',
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'missing-media-started',
    input: { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
  });

  await assert.rejects(
    agent.runTurn({
      sessionId: session.id,
      requestId: 'missing-media-forged-completed',
      input: {
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: {
          taskId: 'phase-1-task-1',
          stepId: 'phase-1-task-1-step-1',
          stepIndex: 0,
          completionMode: 'tool_result',
          toolValues: {
            'phase-1-task-1-step-1': { media: { completed: true } },
          },
        },
      },
    }),
    (error) => error?.code === 'STEP_MEDIA_SOURCE_MISSING',
  );
  const saved = await store.get(session.id);
  assert.equal(saved.currentTaskIndex, 0);
  assert.deepEqual(saved.completedTaskIds, []);
});

test('无角色会话可使用平台絮絮对话，且不会偷偷补绑某个课程角色', async () => {
  const { agent, modelCalls } = await harness();
  const { session } = await agent.createSession({
    courseId: 'lesson_gewu_001',
    studentId: 'dialogue-student',
    groupId: 'dialogue-group',
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'phase-dialogue-start',
    input: { type: 'lifecycle_event', event: 'phase_started', data: {} },
  });

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'phase-dialogue-hello',
    input: { type: 'user_text', text: '你好呀' },
  });

  assert.equal(result.session.roleId, '');
  assert.ok(result.events.some((event) => event.type === 'assistant.completed'));
  assert.match(modelCalls.at(-1).instructions, /AI学习同伴「絮絮」/);
  assert.doesNotMatch(modelCalls.at(-1).instructions, /你是.*数龙官/);
});

test('阶段任务未完成不能领角色；完成后在同一 session 上补绑并保留阶段快照', async () => {
  const { agent, course, store, modelCalls } = await harness();
  const { session } = await agent.createSession({
    courseId: course.id,
    studentId: 'binding-student',
    groupId: 'binding-group',
  });

  await assert.rejects(
    agent.runTurn({
      sessionId: session.id,
      requestId: 'bind-too-early',
      input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId: 'dragon-counter' } },
    }),
    (error) => error.code === 'PHASE_TASKS_INCOMPLETE',
  );

  const stored = await store.get(session.id);
  stored.learningState.evidenceIds = ['ev_phase_1'];
  stored.dialogueState.pendingQuestion = {
    id: 'phase-question',
    kind: 'readiness',
    prompt: '准备好提交猜想了吗？',
    attemptCount: 1,
  };
  stored.currentTaskIndex = course.phaseTracks['phase-1'].tasks.length - 1;
  stored.completedTaskIds = course.phaseTracks['phase-1'].tasks
    .map((task) => `phase-1:${task.id}`);
  await store.save(stored);

  const bound = await agent.runTurn({
    sessionId: session.id,
    requestId: 'bind-after-phase',
    input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId: 'dragon-counter' } },
  });

  assert.equal(bound.session.id, session.id);
  assert.equal(bound.session.roleId, 'dragon-counter');
  assert.equal(bound.session.phaseId, course.lesson.roleSystem.phaseId);
  assert.equal(bound.session.currentTaskIndex, 0);
  assert.deepEqual(bound.session.completedTaskIds, []);
  assert.equal(bound.session.phaseTaskState.phaseId, 'phase-1');
  assert.equal(bound.session.phaseTaskState.completedTaskIds.length, 1);
  assert.deepEqual(bound.session.phaseTaskState.learningState.evidenceIds, ['ev_phase_1']);
  assert.equal(bound.session.phaseTaskState.dialogueState.pendingQuestion.id, 'phase-question');
  assert.deepEqual(bound.session.learningState.evidenceIds, ['ev_phase_1']);
  assert.ok(bound.session.events.includes('dragon-counter:role-assigned'));

  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const opening = renderedPhaseOpening(course, 'phase-2', {
    角色名: role.name,
    首个地点: role.tasks[0].location?.name || role.location,
  });
  const boundText = assistantText(bound);
  assert.equal(occurrences(boundText, opening), 1, '角色补绑时应完整展示一次 Phase 2 开场');
  assert.doesNotMatch(boundText, /\{[^}]+\}/u, 'Phase 2 开场不能残留模板占位符');
  assert.equal(modelCalls.length, 0, '角色分配与阶段开场均走确定性流程');

  const rebound = await agent.runTurn({
    sessionId: session.id,
    requestId: 'bind-after-phase-repeated',
    input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId: 'dragon-counter' } },
  });
  const persistedAssistantText = rebound.session.messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content)
    .join('\n');
  assert.equal(occurrences(assistantText(rebound), opening), 0, '重复角色事件不能重播 Phase 2 开场');
  assert.equal(occurrences(persistedAssistantText, opening), 1, '会话历史只保留一份 Phase 2 开场');
  assert.equal(modelCalls.length, 0, '重复角色事件也不得调用模型');
});

test('会话阶段后来变化时，领取仍只验收最早的选择前任务轨道', async () => {
  const { agent, course, store } = await harness();
  const { session } = await agent.createSession({
    courseId: course.id,
    studentId: 'entry-track-student',
    groupId: 'entry-track-group',
  });
  const entryTrack = course.phaseTracks['phase-1'];
  const rolePhaseId = course.lesson.roleSystem.phaseId;
  course.phaseTracks[rolePhaseId] = {
    id: rolePhaseId,
    phaseId: rolePhaseId,
    scope: 'phase',
    name: '角色阶段共享记录',
    tasks: [{ id: 'later-shared-task', name: '后续共享任务' }],
  };
  const stored = await store.get(session.id);
  const completedEntryTaskIds = entryTrack.tasks.map((task) => `${entryTrack.id}:${task.id}`);
  stored.completedTaskIds = completedEntryTaskIds;
  stored.currentTaskIndex = entryTrack.tasks.length - 1;
  stored.phaseId = rolePhaseId;
  await store.save(stored);

  const bound = await agent.runTurn({
    sessionId: session.id,
    requestId: 'bind-using-first-entry-track',
    input: { type: 'lifecycle_event', event: 'role_assigned', data: { roleId: 'dragon-counter' } },
  });
  assert.equal(bound.session.roleId, 'dragon-counter');
  assert.equal(bound.session.phaseTaskState.phaseId, entryTrack.id);
  assert.deepEqual(bound.session.phaseTaskState.completedTaskIds, completedEntryTaskIds);
});

test('POST /api/sessions 省略 roleId 时公开会话带阶段任务上下文', async (t) => {
  const store = memoryStore();
  const runtimeState = {
    schemaVersion: 1,
    sequence: 0,
    runs: [],
    alerts: [],
    commands: [],
    receipts: [],
    interventions: [],
    auditEvents: [],
    events: [],
  };
  const app = await buildApp({
    env: {
      APP_ENV: 'test',
      AI_ENABLED: true,
      EVIDENCE_UPLOAD_MODE: 'proxy',
      ENABLE_DEMO: false,
      OPENAI_BASE_URL: 'https://example.invalid/v1',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'test-model',
      OPENAI_WIRE_API: 'responses',
      AI_TOOL_MODE: 'auto',
      AI_VISION_MODE: 'disabled',
      AI_REASONING_EFFORT: 'minimal',
      AI_MAX_OUTPUT_TOKENS: 192,
      AI_TIMEOUT_MS: 18_000,
      VITE_AMAP_KEY: '',
      VITE_AMAP_SECURITY_CODE: '',
      VITE_AMAP_STYLE: 'amap://styles/normal',
      SESSION_STORE_DIR: '.runtime-must-not-be-used',
      S3_REGION: 'auto',
      S3_PREFIX: 'evidence',
      LOG_LEVEL: 'silent',
      projectRoot: path.join(os.tmpdir(), 'roleless-phase-session-test'),
      lessonsRoot,
    },
    llm: mainLlm(),
    sessionStore: store,
    courseRunStore: {
      async read() { return structuredClone(runtimeState); },
      async transaction(mutator) { return mutator(runtimeState); },
    },
    evidenceStore: { kind: 'memory', async put() {}, async get() { return null; }, async findById() { return null; } },
    serveStatic: false,
    realtimeMode: 'polling',
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: {
      courseId: 'lesson_gewu_001',
      studentId: 'api-phase-student',
      groupId: 'api-phase-group',
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.roleId, '');
  assert.equal(body.phaseId, 'phase-1');
  assert.equal(body.phaseTaskContext.taskId, 'phase-1-task-1');
  assert.equal(body.phaseTaskContext.currentTaskIndex, 0);
});
