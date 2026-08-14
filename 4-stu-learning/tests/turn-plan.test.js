import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TURN_PLAN_VERSION,
  planTurnPresentation,
  selectTurnPrimaryAction,
  summarizeTurnStateChanges,
} from '../src/engine/turn-plan.js';

test('一个回合只保留一个主要工具，安全工具优先且快捷回复让位', () => {
  const selection = selectTurnPrimaryAction({
    toolCalls: [
      { id: 'task', name: 'open_task_tool' },
      { id: 'navigation', name: 'show_navigation' },
      { id: 'teacher', name: 'call_teacher' },
    ],
    quickReplies: [{ label: '继续' }],
  });

  assert.deepEqual(selection.toolCalls.map((call) => call.name), ['call_teacher']);
  assert.deepEqual(selection.quickReplies, []);
  assert.equal(selection.primaryAction.kind, 'tool');
  assert.equal(selection.primaryAction.name, 'call_teacher');
  assert.deepEqual(selection.issues, [
    'multiple_tools_reduced_to_one',
    'quick_replies_suppressed_by_tool',
  ]);
});

test('TurnPlan 保留消息语义顺序，把工具稳定放到最后并标注逐条节奏', () => {
  const input = [
    { type: 'assistant.completed', data: { text: '上一项已经完成。' } },
    { type: 'stage.started', data: { stageName: '下一项' } },
    { type: 'tool.requested', data: { name: 'open_task_tool' } },
    { type: 'assistant.completed', data: { text: '现在看第一条提示。' } },
  ];
  const planned = planTurnPresentation(input, {
    primaryAction: { kind: 'tool', name: 'open_task_tool', id: 'tool-1' },
    stateChanges: [{ field: 'stepId', from: 'step-1', to: 'step-2' }],
    source: {
      mode: 'course',
      label: '[课程知识库]',
      citations: [{ id: 'K-01' }],
    },
  });

  assert.deepEqual(planned.events.map((event) => event.type), [
    'assistant.completed',
    'stage.started',
    'assistant.completed',
    'tool.requested',
  ]);
  assert.deepEqual(
    planned.events.map((event) => event.data.presentation.delayMs),
    [0, 3_000, 3_000, 3_000],
  );
  assert.deepEqual(
    planned.events.map((event) => event.data.presentation.sequence),
    [0, 1, 2, 3],
  );
  assert.equal(planned.summary.version, TURN_PLAN_VERSION);
  assert.equal(planned.summary.visibleCount, 4);
  assert.deepEqual(planned.summary.nextAction, {
    kind: 'tool', name: 'open_task_tool', id: 'tool-1',
  });
  assert.deepEqual(planned.summary.tool, { name: 'open_task_tool', callId: '' });
  assert.deepEqual(planned.summary.quickReplies, { questionId: '', count: 0 });
  assert.deepEqual(planned.summary.safetyAction, { kind: 'none', required: false });
  assert.deepEqual(planned.summary.stateChanges, [
    { field: 'stepId', from: 'step-1', to: 'step-2' },
  ]);
  assert.deepEqual(planned.summary.source, {
    mode: 'course', label: '[课程知识库]', citationCount: 1,
  });
  assert.deepEqual(planned.summary.rhythm, [
    { sequence: 0, kind: 'message', delayMs: 0 },
    { sequence: 1, kind: 'stage', delayMs: 3_000 },
    { sequence: 2, kind: 'message', delayMs: 3_000 },
    { sequence: 3, kind: 'tool', delayMs: 3_000 },
  ]);
});

test('没有工具时最多展示三个快捷回复，并把它登记为唯一主要操作', () => {
  const selection = selectTurnPrimaryAction({
    quickReplies: [1, 2, 3, 4].map((value) => ({ label: String(value) })),
  });
  assert.equal(selection.toolCalls.length, 0);
  assert.equal(selection.quickReplies.length, 3);
  assert.equal(selection.primaryAction.kind, 'quick_replies');

  const planned = planTurnPresentation([{
    type: 'ui.quick_replies',
    data: { questionId: 'question-1', options: selection.quickReplies },
  }], { primaryAction: selection.primaryAction });
  assert.equal(planned.summary.tool, null);
  assert.deepEqual(planned.summary.quickReplies, { questionId: 'question-1', count: 3 });
});

test('TurnPlan 把教师求助标成唯一安全动作', () => {
  const planned = planTurnPresentation([{
    type: 'tool.requested',
    data: { callId: 'teacher-1', name: 'call_teacher', payload: {} },
  }], {
    primaryAction: { kind: 'tool', name: 'call_teacher', id: 'teacher-1' },
  });
  assert.deepEqual(planned.summary.safetyAction, { kind: 'call_teacher', required: true });
  assert.equal(planned.summary.nextAction.name, 'call_teacher');
});

test('TurnPlan 只记录实际变化的权威学习状态', () => {
  assert.deepEqual(summarizeTurnStateChanges(
    { taskId: 'task-1', stepId: 'step-1', scaffoldLevel: 0 },
    { taskId: 'task-1', stepId: 'step-2', scaffoldLevel: 1 },
  ), [
    { field: 'stepId', from: 'step-1', to: 'step-2' },
    { field: 'scaffoldLevel', from: 0, to: 1 },
  ]);
});
