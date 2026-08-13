import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord, normalizeSessionRecord } from '../server/services/session-factory.js';
import {
  TURN_TRACE_LIMIT,
  appendTurnTrace,
  buildTurnTrace,
  promptFingerprint,
  traceStateSnapshot,
} from '../server/agent/turn-trace.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: 'ses_trace_test' });
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

function inertLlm() {
  return {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => ({ text: '收到。', toolCalls: [] }),
  };
}

test('trace 只保存最小投影与静态规则指纹，请求标识仅留摘要', () => {
  const secretInput = '这是学生的原话，含有私密细节';
  const secretPrompt = '这是完整系统提示，不能进入 trace';
  const secretOutput = '这是给学生的完整回答';
  const privateRequestId = 'request-林同学-13800138000';
  const trace = buildTurnTrace({
    requestId: privateRequestId,
    startedAt: 1_000,
    completedAt: 1_120,
    course: {
      id: 'course-1',
      courseVersion: 'sha256:course',
      contentVersion: 'sha256:content',
      platformRules: { version: 'sha256:rules' },
      platformDefaults: { version: 'sha256:defaults' },
    },
    input: { type: 'user_text', text: secretInput },
    stateBefore: {},
    stateAfter: {},
    decision: { intent: 'social', decisionSource: 'semantic_tutor_policy' },
    prompt: { instructions: secretPrompt, messages: [{ role: 'user', content: secretInput }] },
    outputPath: 'model',
    outputText: secretOutput,
    events: [{ type: 'assistant.completed', data: { text: secretOutput } }],
    policyVersion: 'student-facing/test',
  });
  const serialized = JSON.stringify(trace);
  assert.equal(serialized.includes(secretInput), false);
  assert.equal(serialized.includes(secretPrompt), false);
  assert.equal(serialized.includes(secretOutput), false);
  assert.equal(serialized.includes(privateRequestId), false);
  assert.equal(Object.hasOwn(trace, 'requestId'), false);
  assert.match(trace.requestIdDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(trace.versions.promptHash, /^sha256:[0-9a-f]{64}$/);
  assert.match(trace.versions.promptBuilderVersion, /^\d{4}-\d{2}-\d{2}\./);
  assert.equal(trace.output.hash, undefined);
  assert.equal(trace.output.fingerprintMode, 'omitted_low_entropy_text');
  assert.equal(trace.input.chars, secretInput.length);
});

test('trace 保留服务端验证过的教师指令关联，不将客户请求号原文写入', () => {
  const trace = buildTurnTrace({
    requestId: 'teacher-request-学生姓名',
    startedAt: 3_000,
    completedAt: 3_020,
    course: { id: 'course-1' },
    input: { type: 'lifecycle_event', event: 'teacher_directive' },
    stateBefore: {},
    stateAfter: {},
    decision: { decisionSource: 'non_language_state' },
    outputPath: 'fast_workflow',
    teacherCommand: { teacherCommandId: 'cmd_audit_001', action: 'set_scaffold' },
  });

  assert.deepEqual(trace.teacherCommand, {
    teacherCommandId: 'cmd_audit_001',
    action: 'set_scaffold',
  });
  assert.doesNotMatch(JSON.stringify(trace), /学生姓名/u);
});

test('失败回合使用同一最小 trace schema，只记错误码不记错误原文', () => {
  const privateError = '内部数据库地址与学生私密输入';
  const trace = buildTurnTrace({
    requestId: 'request-failed',
    startedAt: 2_000,
    completedAt: 2_050,
    course: { id: 'course-1' },
    input: { type: 'user_text', text: privateError },
    stateBefore: { taskId: 'task-1' },
    stateAfter: { taskId: 'task-1' },
    decision: { decisionSource: 'request_error', intent: 'connection_error' },
    outputPath: 'error:connection',
    outputText: privateError,
    events: [{ type: 'agent.error', data: {} }],
    status: 'failed',
    errorCode: 'AGENT_TURN_FAILED',
  });

  assert.equal(trace.status, 'failed');
  assert.equal(trace.output.errorCode, 'AGENT_TURN_FAILED');
  assert.equal(trace.output.eventTypeCounts['agent.error'], 1);
  assert.equal(JSON.stringify(trace).includes(privateError), false);
});

test('trace retention 只保留最近 100 回合，旧会话 normalize 会补空数组', () => {
  const legacy = createSessionRecord({ id: 'ses_legacy_trace', courseId: 'c' });
  delete legacy.turnTraces;
  assert.deepEqual(normalizeSessionRecord(legacy).turnTraces, []);
  for (let index = 0; index < TURN_TRACE_LIMIT + 3; index += 1) {
    appendTurnTrace(legacy, { traceId: `tr_${index}` });
  }
  assert.equal(legacy.turnTraces.length, TURN_TRACE_LIMIT);
  assert.equal(legacy.turnTraces[0].traceId, 'tr_3');
});

test('成功回合把决策来源、输出路径、版本与状态变化原子写入 session', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const store = memoryStore();
  const agent = createAgentService({
    llm: inertLlm(),
    understandingLlm: inertLlm(),
    store,
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    studentId: 'student-trace',
    groupId: 'group-trace',
    grade: '初中',
  });
  const before = traceStateSnapshot(session);
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: 'trace-phase-started',
    input: { type: 'lifecycle_event', event: 'phase_started' },
  });

  assert.equal(result.trace.decision.source, 'non_language_state');
  assert.equal(result.trace.output.path, 'fast_workflow');
  assert.equal(result.trace.versions.contentVersion, course.contentVersion);
  assert.equal(result.trace.versions.promptHash, '', '确定性快速路径不应伪装成调用过主 Prompt');
  assert.deepEqual(result.session.turnTraces.at(-1), result.trace);
  assert.equal(result.trace.stateBefore.roleId, before.roleId);
  assert.notEqual(result.trace.stateAfter.lifecycle, '');
  assert.ok(result.trace.output.eventTypeCounts['state.updated'] >= 1);
  const terminal = result.events.at(-1);
  assert.equal(terminal.type, 'state.updated');
  assert.equal(terminal.data.turnPlan.source.mode, 'course-config');
  assert.ok(terminal.data.turnPlan.stateChanges.some((change) => change.field === 'lifecycle'));
  assert.equal(result.trace.output.turnPlan.sourceMode, 'course-config');
  assert.deepEqual(
    result.trace.output.turnPlan.stateChanges,
    terminal.data.turnPlan.stateChanges,
  );
  assert.deepEqual(result.trace.output.turnPlan.rhythm, terminal.data.turnPlan.rhythm);
});

test('Prompt 指纹对静态指令和消息形状稳定，不可由短学生原话反查', () => {
  const first = { instructions: '规则', messages: [{ role: 'user', content: '问题A' }] };
  const second = { instructions: '规则', messages: [{ role: 'user', content: '问题B' }] };
  assert.equal(promptFingerprint(first), promptFingerprint(structuredClone(first)));
  assert.equal(promptFingerprint(first), promptFingerprint(second));
  second.messages[0].content = '一个长度明显不同的问题';
  assert.notEqual(promptFingerprint(first), promptFingerprint(second));
});
