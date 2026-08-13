import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  learnerRequestDigest,
  rememberRequestResult,
  replayRequestResult,
  resolveReplayEnvelope,
  REQUEST_REPLAY_ENVELOPE_KIND,
  REQUEST_REPLAY_ENVELOPE_VERSION,
  REQUEST_REPLAY_LIMIT,
} from '../server/agent/request-replay.js';
import { createAgentService } from '../server/agent/service.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createSessionRecord } from '../server/services/session-factory.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = createSessionRecord({ ...values, id: `ses_replay_${sessions.size + 1}` });
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

function storedEnvelope(events = []) {
  return {
    kind: REQUEST_REPLAY_ENVELOPE_KIND,
    schemaVersion: REQUEST_REPLAY_ENVELOPE_VERSION,
    events: structuredClone(events),
  };
}

async function localAgentSubject() {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const store = memoryStore();
  const agent = createAgentService({
    llm: {
      capabilities: () => ({ nativeTools: true, vision: false, streaming: false }),
      async generate() {
        throw new Error('生命周期快速路径不应调用模型。');
      },
    },
    store,
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id,
    roleId: 'dragon-counter',
    studentId: 'replay-student',
    groupId: 'replay-group',
  });
  const requestId = 'req-local-service';
  const input = { type: 'lifecycle_event', event: 'role_assigned' };
  const first = await agent.runTurn({ sessionId: session.id, requestId, input });
  return { agent, course, first, input, requestId, session, store };
}

test('本地会话保存最近请求 envelope，读取时返回隔离副本', () => {
  const session = { handledRequestResults: [] };
  const events = [
    { type: 'assistant.completed', data: { text: '已记录' } },
    { type: 'tool.requested', data: { callId: 'call-next', payload: { taskId: 'task-2' } } },
    { type: 'state.updated', data: { currentTaskIndex: 1 } },
  ];
  rememberRequestResult(session, 'req-1', storedEnvelope(events));
  const replay = replayRequestResult(session, 'req-1');
  assert.deepEqual(replay.events, events);
  replay.events[0].data.text = '被篡改';
  assert.equal(replayRequestResult(session, 'req-1').events[0].data.text, '已记录');
});

test('请求重放有上限，同 ID 更新不会重复占位', () => {
  const session = { handledRequestResults: [] };
  rememberRequestResult(session, 'req-1', storedEnvelope([{ type: 'state.updated', data: { revision: 1 } }]), { limit: 2 });
  rememberRequestResult(session, 'req-1', storedEnvelope([{ type: 'state.updated', data: { revision: 2 } }]), { limit: 2 });
  rememberRequestResult(session, 'req-2', storedEnvelope(), { limit: 2 });
  rememberRequestResult(session, 'req-3', storedEnvelope(), { limit: 2 });
  assert.equal(replayRequestResult(session, 'req-1'), null);
  assert.deepEqual(session.handledRequestResults.map((item) => item.requestId), ['req-2', 'req-3']);
  assert.deepEqual(session.handledRequestIds, ['req-2', 'req-3']);
});

test('精确重放结果与 handled ID 统一保留 100 条', () => {
  const session = { handledRequestIds: [], handledRequestResults: [] };
  for (let number = 1; number <= REQUEST_REPLAY_LIMIT; number += 1) {
    rememberRequestResult(
      session,
      `req-${number}`,
      storedEnvelope([{ type: 'state.updated', data: { number } }]),
      { requestDigest: `sha256:${number}` },
    );
  }

  assert.equal(session.handledRequestIds.length, REQUEST_REPLAY_LIMIT);
  assert.equal(session.handledRequestResults.length, REQUEST_REPLAY_LIMIT);
  for (const number of [1, 21, 100]) {
    assert.deepEqual(
      replayRequestResult(session, `req-${number}`, { requestDigest: `sha256:${number}` }).events,
      [{ type: 'state.updated', data: { number } }],
    );
  }

  rememberRequestResult(
    session,
    'req-101',
    storedEnvelope([{ type: 'state.updated', data: { number: 101 } }]),
    { requestDigest: 'sha256:101' },
  );
  assert.equal(replayRequestResult(session, 'req-1'), null);
  assert.equal(session.handledRequestIds[0], 'req-2');
  assert.equal(session.handledRequestResults[0].requestId, 'req-2');
});

test('本地重放用请求摘要拒绝同 requestId 的不同 payload', () => {
  const session = { handledRequestIds: [], handledRequestResults: [] };
  const firstDigest = learnerRequestDigest({
    sessionId: 'ses-local',
    input: { type: 'user_text', text: '第一条' },
  });
  const conflictingDigest = learnerRequestDigest({
    sessionId: 'ses-local',
    input: { type: 'user_text', text: '被替换的第二条' },
  });
  rememberRequestResult(
    session,
    'req-same',
    storedEnvelope([{ type: 'assistant.completed', data: { text: '已处理' } }]),
    { requestDigest: firstDigest },
  );

  assert.deepEqual(
    replayRequestResult(session, 'req-same', { requestDigest: firstDigest }).events,
    [{ type: 'assistant.completed', data: { text: '已处理' } }],
  );
  assert.throws(
    () => replayRequestResult(session, 'req-same', { requestDigest: conflictingDigest }),
    (error) => {
      assert.equal(error.code, 'LEARNER_REQUEST_HASH_CONFLICT');
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test('本地 Agent 对相同 requestId 无损重放，并拒绝更换输入', async () => {
  const { agent, first, input: originalInput, requestId, session } = await localAgentSubject();
  const duplicate = await agent.runTurn({
    sessionId: session.id,
    requestId,
    input: originalInput,
  });

  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.replayed, true);
  assert.deepEqual(duplicate.events, first.events);

  await assert.rejects(
    agent.runTurn({
      sessionId: session.id,
      requestId,
      input: { type: 'lifecycle_event', event: 'phase_started' },
    }),
    (error) => {
      assert.equal(error.code, 'LEARNER_REQUEST_HASH_CONFLICT');
      return true;
    },
  );
});

test('重放 envelope 同时校验 trace、策略、课程、分片、展示连续性和末尾状态', async () => {
  const { course, first, input, session } = await localAgentSubject();
  const requestDigest = learnerRequestDigest({ sessionId: session.id, input });
  const context = {
    requestId: 'req-local-service',
    requestDigest,
    courseContentVersion: course.contentVersion,
    session: first.session,
  };
  assert.equal(resolveReplayEnvelope(first.replayEnvelope, context).compatible, true);

  const cases = [
    ['trace_schema_mismatch', (value) => { value.versions.traceSchemaVersion = -1; }],
    ['student_facing_policy_mismatch', (value) => { value.versions.studentFacingPolicyVersion = 'old-policy'; }],
    ['course_content_version_mismatch', (value) => { value.versions.courseContentVersion = 'sha256:old-course'; }],
    ['turn_plan_version_mismatch', (value) => { value.versions.turnPlanVersion = 'old-plan'; }],
    ['trace_version_mismatch', (value) => { value.trace.versions.studentFacingPolicyVersion = 'old-policy'; }],
    ['trace_identity_mismatch', (value) => { value.trace.requestIdDigest = 'sha256:wrong-request'; }],
    ['event_schema_invalid', (value) => {
      value.events.splice(-1, 0, { type: 'agent.error', data: { message: '旧内部错误' } });
    }],
    ['assistant_parts_invalid', (value) => {
      delete value.events.find((event) => event.type === 'assistant.completed').data.partCount;
    }],
    ['presentation_invalid', (value) => {
      value.events.find((event) => event.data?.presentation).data.presentation.sequence = 7;
    }],
    ['presentation_invalid', (value) => {
      value.events.find((event) => event.data?.presentation).data.presentation.delayMs += 1;
    }],
    ['presentation_invalid', (value) => {
      value.events.at(-1).data.turnPlan.primaryAction = {
        kind: 'tool', name: 'open_task_tool', id: 'forged-tool',
      };
    }],
    ['terminal_state_missing', (value) => { value.events.pop(); }],
    ['trace_event_projection_mismatch', (value) => {
      value.trace.output.eventTypeCounts['assistant.completed'] = 99;
    }],
    ['trace_terminal_state_mismatch', (value) => { value.trace.stateAfter.taskIndex = 99; }],
  ];
  for (const [reason, mutate] of cases) {
    const envelope = structuredClone(first.replayEnvelope);
    mutate(envelope);
    const result = resolveReplayEnvelope(envelope, context);
    assert.equal(result.compatible, false, reason);
    assert.equal(result.reason, reason);
    assert.deepEqual(result.events, []);
  }

  const advancedSession = structuredClone(first.session);
  advancedSession.currentTaskIndex += 1;
  const stale = resolveReplayEnvelope(first.replayEnvelope, { ...context, session: advancedSession });
  assert.equal(stale.compatible, false);
  assert.equal(stale.reason, 'authoritative_state_changed');
});

test('本地旧缓存或不兼容 envelope 不重放旧文本，只恢复当前权威 state/tool', async () => {
  const { agent, input, requestId, session, store } = await localAgentSubject();
  const saved = await store.get(session.id);
  const item = saved.handledRequestResults.find((candidate) => candidate.requestId === requestId);
  item.replayEnvelope.versions.studentFacingPolicyVersion = 'old-policy';
  item.replayEnvelope.events.find((event) => event.type === 'assistant.completed').data.text = '这是不应展示的旧文本';
  saved.learningState.activeToolCallId = 'call-current-tool';
  saved.pendingTools['call-current-tool'] = {
    name: 'open_task_tool',
    arguments: {},
    payload: { taskId: saved.taskState.taskId, title: '当前权威工具' },
  };
  await store.save(saved);

  const replay = await agent.runTurn({ sessionId: session.id, requestId, input });
  assert.equal(replay.events.some((event) => event.type === 'assistant.completed'), false);
  assert.equal(JSON.stringify(replay.events).includes('这是不应展示的旧文本'), false);
  assert.deepEqual(replay.events.map((event) => event.type), ['tool.requested', 'state.updated']);
  assert.equal(replay.events[0].data.callId, 'call-current-tool');
  assert.equal(replay.events[0].data.presentation.sequence, 0);
  assert.equal(replay.events.at(-1).data.replayMode, 'authoritative_recovery');
  assert.equal(replay.events.at(-1).data.replayReason, 'student_facing_policy_mismatch');
  assert.equal(replay.events.at(-1).data.turnPlan.visibleCount, 1);

  const legacy = await store.get(session.id);
  const legacyItem = legacy.handledRequestResults.find((candidate) => candidate.requestId === requestId);
  delete legacyItem.replayEnvelope;
  legacyItem.events = [{ type: 'assistant.completed', data: { text: '存量旧气泡' } }];
  await store.save(legacy);
  const legacyReplay = await agent.runTurn({ sessionId: session.id, requestId, input });
  assert.equal(JSON.stringify(legacyReplay.events).includes('存量旧气泡'), false);
  assert.equal(legacyReplay.events.at(-1).type, 'state.updated');
  assert.equal(legacyReplay.events.at(-1).data.replayReason, 'missing_or_legacy_envelope');
});
