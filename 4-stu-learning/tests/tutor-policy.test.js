import test from 'node:test';
import assert from 'node:assert/strict';
import { decideTutorAction, TUTOR_ACTIONS } from '../server/agent/tutor-policy.js';

function understanding(overrides = {}) {
  return {
    intent: 'unknown',
    emotion: 'neutral',
    answersPendingQuestion: false,
    want: '',
    confidence: 0.9,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    scaffoldLevel: 0,
    pendingQuestion: null,
    currentStep: { objective: '判断水流方向', studentAction: '拍两张照片并写下依据' },
    recentActions: [],
    idleSeconds: 0,
    ...overrides,
  };
}

test('寒暄走自然回应', () => {
  const decision = decideTutorAction(understanding({ intent: 'greeting' }), context());

  assert.equal(decision.action, 'reply_natural');
  assert.ok(TUTOR_ACTIONS.includes(decision.action));
  assert.ok(decision.reason.length > 0);
});

test('第一次求助给脚手架且不升档', () => {
  const decision = decideTutorAction(understanding({ intent: 'help_start' }), context());

  assert.equal(decision.action, 'give_scaffold');
  assert.deepEqual(decision.params, {});
});

test('同类求助第二次升一档', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck' }),
    context({
      scaffoldLevel: 1,
      recentActions: [{ intent: 'help_start', action: 'give_scaffold' }],
    }),
  );

  assert.equal(decision.action, 'give_scaffold');
  assert.equal(decision.params.scaffoldLevelDelta, 1);
  assert.match(decision.reason, /升档/);
});

test('脚手架已到最高级时升档不越界', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'request_answer' }),
    context({
      scaffoldLevel: 4,
      recentActions: [{ intent: 'help_stuck', action: 'give_scaffold' }],
    }),
  );

  assert.equal(decision.action, 'give_scaffold');
  assert.equal(decision.params.scaffoldLevelDelta, 0);
});

test('直接要答案不给答案，仍走脚手架', () => {
  const decision = decideTutorAction(understanding({ intent: 'request_answer' }), context());

  assert.equal(decision.action, 'give_scaffold');
  assert.deepEqual(decision.params, {});
});

test('情绪优先于任务推进', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck', emotion: 'frustrated' }),
    context(),
  );

  assert.equal(decision.action, 'comfort');
});

test('明确情绪低落意图也走安抚', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'emotional_low', emotion: 'tired' }),
    context(),
  );

  assert.equal(decision.action, 'comfort');
});

test('在回答待答问题时交给流程流转', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'answering_question', answersPendingQuestion: true }),
    context({ pendingQuestion: { prompt: '你到了吗？' } }),
  );

  assert.equal(decision.action, 'advance_pending_question');
});

test('口头声称完成指回工具提交', () => {
  const decision = decideTutorAction(understanding({ intent: 'claim_done' }), context());

  assert.equal(decision.action, 'redirect_task');
});

test('置信度过低时温和澄清', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'asking_knowledge', confidence: 0.2 }),
    context(),
  );

  assert.equal(decision.action, 'reply_natural');
});

test('连续两次自然回应后第三次被强制换成指回任务', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'greeting' }),
    context({
      recentActions: [
        { intent: 'greeting', action: 'reply_natural' },
        { intent: 'chat_offtopic', action: 'reply_natural' },
      ],
    }),
  );

  assert.equal(decision.action, 'redirect_task');
  assert.match(decision.reason, /防复读强制换/);
});

// 任务书 §4 规则 7 的两条子规则在此场景同时命中（升档 vs 强制换档）。
// 当前实现：强制换档优先，升档让位。待确认项已记入 1-docs/R1原型-执行记录.md。
test('连续两次脚手架后第三次同类求助：强制换档优先于升档', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck' }),
    context({
      scaffoldLevel: 1,
      recentActions: [
        { intent: 'help_start', action: 'give_scaffold' },
        { intent: 'help_stuck', action: 'give_scaffold' },
      ],
    }),
  );

  assert.equal(decision.action, 'redirect_task');
  assert.equal(decision.params.scaffoldLevelDelta, undefined);
  assert.match(decision.reason, /防复读强制换/);
});

test('缺省与异常入参不抛异常，落在合法动作枚举内', () => {
  for (const decision of [
    decideTutorAction(undefined, undefined),
    decideTutorAction({}, {}),
    decideTutorAction({ intent: 42, confidence: 'x' }, { scaffoldLevel: '9', recentActions: null }),
  ]) {
    assert.ok(TUTOR_ACTIONS.includes(decision.action));
    assert.equal(typeof decision.reason, 'string');
    assert.equal(typeof decision.params, 'object');
  }
});
