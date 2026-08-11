import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/app.js';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
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
  assert.equal(role.tasks.length, 2);

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

test('任务级 ai_evaluation 会在阶段任务最终提交时真实调用验收模型', async () => {
  const evaluationCalls = [];
  const { agent, store, modelCalls } = await harness({
    evaluationLlm: mainLlm(evaluationCalls),
  });
  const { session } = await agent.createSession({
    courseId: 'lesson_gewu_001',
    studentId: 'evaluation-student',
    groupId: 'evaluation-group',
  });
  const stored = await store.get(session.id);
  stored.currentTaskIndex = 1;
  stored.completedTaskIds = ['phase-1:phase-1-task-1'];
  stored.taskState = {
    taskId: 'phase-1-task-2',
    guidanceStepIndex: 2,
    stageAnnounced: true,
  };
  stored.pendingTools = {
    tool_guess: {
      name: 'open_task_tool',
      payload: {
        taskId: 'phase-1-task-2',
        config: { minEvidenceCount: 0 },
      },
    },
  };
  await store.save(stored);

  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'submit-initial-guess',
    input: {
      type: 'tool_result',
      toolCallId: 'tool_guess',
      result: {
        status: 'completed',
        values: {
          toolValues: {
            'phase-1-task-2-step-1': {
              text: { fields: { response: '我猜不会积水，因为排水口可能很多。' } },
            },
          },
          photoEvidenceCount: 0,
        },
        evidence: [],
      },
    },
  });

  assert.ok(evaluationCalls.some((call) => call.instructions.includes('[小步验收器职责]')));
  assert.equal(evaluationCalls[0].maxRetries, 1);
  assert.equal(modelCalls.length, 0, '验收通过后应复用结构化反馈，不再调用一次主对话模型');
  assert.ok(result.session.completedTaskIds.includes('phase-1:phase-1-task-2'));
  assert.equal(result.session.currentTaskIndex, 1, '最终阶段任务完成后停在末项，等待角色选择');
  assert.equal(result.session.completedTaskIds.length, 2);
  assert.equal(result.events.some((event) => event.type === 'tool.requested'), false);
  assert.match(result.events.find((event) => event.type === 'assistant.completed').data.text, /判断和理由/);
});

test('验收超时后返回可重试错误，任务进度保持不动', async () => {
  const evaluationCalls = [];
  const timeoutLlm = {
    capabilities: () => ({ nativeTools: false, vision: false, streaming: false }),
    async generate(input) {
      evaluationCalls.push(input);
      const error = new Error('模型响应超时。');
      error.name = 'LLMTimeoutError';
      error.code = 'LLM_TIMEOUT';
      throw error;
    },
  };
  const { agent, store } = await harness({ evaluationLlm: timeoutLlm });
  const { session } = await agent.createSession({
    courseId: 'lesson_gewu_001',
    studentId: 'timeout-student',
    groupId: 'timeout-group',
  });
  const stored = await store.get(session.id);
  stored.currentTaskIndex = 1;
  stored.completedTaskIds = ['phase-1:phase-1-task-1'];
  stored.taskState = {
    taskId: 'phase-1-task-2',
    guidanceStepIndex: 2,
    stageAnnounced: true,
  };
  stored.pendingTools = {
    tool_guess_timeout: {
      name: 'open_task_tool',
      payload: { taskId: 'phase-1-task-2', config: { minEvidenceCount: 0 } },
    },
  };
  await store.save(stored);

  await assert.rejects(
    agent.runTurn({
      sessionId: session.id,
      requestId: 'submit-timeout-guess',
      input: {
        type: 'tool_result',
        toolCallId: 'tool_guess_timeout',
        result: {
          status: 'completed',
          values: {
            toolValues: {
              'phase-1-task-2-step-1': {
                text: { fields: { response: '我猜不会积水，因为排水口可能很多。' } },
              },
            },
            photoEvidenceCount: 0,
          },
          evidence: [],
        },
      },
    }),
    (error) => error.code === 'STEP_AI_TIMEOUT' && error.details.retryable === true,
  );

  assert.equal(evaluationCalls[0].maxRetries, 1);
  assert.equal(stored.currentTaskIndex, 1);
  assert.deepEqual(stored.completedTaskIds, ['phase-1:phase-1-task-1']);
  assert.ok(stored.pendingTools.tool_guess_timeout, '超时后保留原工具调用，允许用同一份草稿重试');
});

test('阶段任务未完成不能领角色；完成后在同一 session 上补绑并保留阶段快照', async () => {
  const { agent, course, store } = await harness();
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
  assert.equal(bound.session.phaseTaskState.completedTaskIds.length, 2);
  assert.ok(bound.session.events.includes('dragon-counter:role-assigned'));
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
