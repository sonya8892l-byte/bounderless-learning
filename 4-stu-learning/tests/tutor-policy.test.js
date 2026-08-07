/**
 * 教学决策器的分诊链验收。
 *
 * 断言按分诊链的层次组织（L0 安全 → L1 状态机 → L2 任务 → L3 组织 → L4 兜底），
 * 再分别验两个正交维度（情绪着色、按族重复治理）。
 *
 * 这里锁的是**优先级关系**而不是实现细节：安全永远压过任务，情绪不许吞掉学生的诉求，
 * 重复治理不许把"帮助"换成"撤走帮助"。这三条是改这个文件时最容易破坏的东西。
 */
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

// ── L0 危险/紧急 ─────────────────────────────────────────────

test('L0：安全意图直接呼叫老师，压过任何任务判断', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'safety_risk', emotion: 'panic' }),
    context(),
  );

  assert.equal(decision.action, 'call_teacher_safety');
  assert.equal(decision.params.tone, 'urgent');
});

test('L0：安全不看置信度——宁可误报不可漏报', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'safety_risk', confidence: 0.1 }),
    context(),
  );

  assert.equal(decision.action, 'call_teacher_safety');
});

test('L0：panic 情绪本身就足以进安全层，即使意图看着像求助', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck', emotion: 'panic' }),
    context(),
  );

  assert.equal(decision.action, 'call_teacher_safety');
});

test('L0：安全回合不做共情铺垫，也不参与重复治理', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'safety_risk', emotion: 'anxious' }),
    context({ recentActions: [{ intent: 'safety_risk', action: 'call_teacher_safety' }] }),
  );

  assert.equal(decision.action, 'call_teacher_safety');
  assert.equal(decision.params.tone, 'urgent');
  assert.equal(decision.params.refocus, false);
});

// ── L1 状态机输入 ───────────────────────────────────────────

test('L1：在回答待答问题时交给流程流转', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'answering_question', answersPendingQuestion: true }),
    context({ pendingQuestion: { prompt: '你到了吗？' } }),
  );

  assert.equal(decision.action, 'advance_pending_question');
});

test('L1：情绪不再抢走待答问题——否则会卡在到达确认死循环', () => {
  const decision = decideTutorAction(
    understanding({
      intent: 'answering_question', answersPendingQuestion: true, emotion: 'frustrated', hasTaskRequest: true,
    }),
    context({ pendingQuestion: { prompt: '你到了吗？' } }),
  );

  assert.equal(decision.action, 'advance_pending_question', '烦躁地回答"还没到"仍然要被采纳');
  assert.equal(decision.params.tone, 'comfort_first', '情绪只改语气');
});

test('L1：口头声称完成指回工具提交', () => {
  const decision = decideTutorAction(understanding({ intent: 'claim_done' }), context());

  assert.equal(decision.action, 'redirect_task');
});

// ── L2 任务相关 ─────────────────────────────────────────────

test('L2：第一次求助给脚手架且不升档', () => {
  const decision = decideTutorAction(understanding({ intent: 'help_start' }), context());

  assert.equal(decision.action, 'give_scaffold');
  assert.equal(decision.params.scaffoldLevelDelta, undefined);
});

test('L2：直接要答案不给答案，仍走脚手架', () => {
  const decision = decideTutorAction(understanding({ intent: 'request_answer' }), context());

  assert.equal(decision.action, 'give_scaffold');
});

test('L2：问课程知识走知识回答，不落进默认自然回应', () => {
  const decision = decideTutorAction(understanding({ intent: 'asking_knowledge' }), context());

  assert.equal(decision.action, 'answer_knowledge');
});

test('L2：问任务点位置给导航', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'asking_location', locationKind: 'task' }),
    context(),
  );

  assert.equal(decision.action, 'guide_location');
});

test('L2：问场馆设施位置不给任务导航，走组织信息', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'asking_location', locationKind: 'venue' }),
    context(),
  );

  assert.equal(decision.action, 'answer_logistics', '厕所在哪不该打开任务点导航卡');
});

// ── L3 活动组织 ─────────────────────────────────────────────

test('L3：问活动组织安排如实回答，不走脚手架', () => {
  const decision = decideTutorAction(understanding({ intent: 'asking_logistics' }), context());

  assert.equal(decision.action, 'answer_logistics');
});

// ── L4 兜底 ────────────────────────────────────────────────

test('L4：置信度过低走澄清，且与闲聊分开', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'asking_knowledge', confidence: 0.2 }),
    context(),
  );

  assert.equal(decision.action, 'clarify');
});

test('L4：意图不明且有待答问题时挂起该问题再澄清，不拿它去套取值', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'unknown', confidence: 0.1 }),
    context({ pendingQuestion: { prompt: '你到了吗？' } }),
  );

  assert.equal(decision.action, 'clarify');
  assert.match(decision.reason, /挂起/);
});

test('L4：与活动无关的闲聊正常接住', () => {
  const decision = decideTutorAction(understanding({ intent: 'chat_offtopic' }), context());

  assert.equal(decision.action, 'reply_natural');
  assert.equal(decision.params.tone, 'neutral');
});

test('L4：寒暄走自然回应', () => {
  const decision = decideTutorAction(understanding({ intent: 'greeting' }), context());

  assert.equal(decision.action, 'reply_natural');
  assert.ok(TUTOR_ACTIONS.includes(decision.action));
  assert.ok(decision.reason.length > 0);
});

// ── 维度一：情绪着色（不夺权） ───────────────────────────────

test('情绪：纯情绪且无诉求时才独占动作走安抚', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'emotional_low', emotion: 'tired', hasTaskRequest: false }),
    context(),
  );

  assert.equal(decision.action, 'comfort');
  assert.equal(decision.params.tone, 'comfort_only');
});

test('情绪：低落但带着任务诉求时不撤走脚手架，只改语气', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck', emotion: 'frustrated', hasTaskRequest: true }),
    context(),
  );

  assert.equal(decision.action, 'give_scaffold', '"太难了我不知道从哪开始"要的是提示不是纯安抚');
  assert.equal(decision.params.tone, 'comfort_first');
});

test('情绪：低落时永不拉回任务，先接住比推进重要', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'chat_offtopic', emotion: 'tired', hasTaskRequest: false }),
    context({
      recentActions: [
        { intent: 'chat_offtopic', action: 'reply_natural' },
        { intent: 'greeting', action: 'reply_natural' },
      ],
    }),
  );

  assert.notEqual(decision.params.refocus, true, '情绪低落时不附拉回句');
  assert.notEqual(decision.action, 'redirect_task');
});

// ── 维度二：按族重复治理 ─────────────────────────────────────

test('重复：同类求助第二次升一档', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck' }),
    context({
      scaffoldLevel: 1,
      recentActions: [{ intent: 'help_start', action: 'give_scaffold' }],
    }),
  );

  assert.equal(decision.action, 'give_scaffold');
  assert.equal(decision.params.scaffoldLevelDelta, 1);
  assert.match(decision.reason, /升/);
});

test('重复：连续三次求助继续升档，不再被改成指回任务', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck' }),
    context({
      scaffoldLevel: 2,
      recentActions: [
        { intent: 'help_start', action: 'give_scaffold' },
        { intent: 'help_stuck', action: 'give_scaffold' },
      ],
    }),
  );

  assert.equal(decision.action, 'give_scaffold', '第三次求助不该被撤走帮助');
  assert.equal(decision.params.scaffoldLevelDelta, 1);
});

test('重复：脚手架到顶且仍连续求助时转教师，而不是撤走提示', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'help_stuck' }),
    context({
      scaffoldLevel: 4,
      recentActions: [
        { intent: 'help_start', action: 'give_scaffold' },
        { intent: 'help_stuck', action: 'give_scaffold' },
      ],
    }),
  );

  assert.equal(decision.action, 'escalate_teacher');
  assert.equal(decision.params.scaffoldLevelDelta, 0);
});

test('重复：到顶但只求助过一次时仍给最高档提示，不急着转教师', () => {
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

test('重复：连问三个知识问题仍然照答，只是附一句拉回', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'asking_knowledge' }),
    context({
      recentActions: [
        { intent: 'asking_knowledge', action: 'answer_knowledge' },
        { intent: 'asking_knowledge', action: 'answer_knowledge' },
      ],
    }),
  );

  assert.equal(decision.action, 'answer_knowledge', '连续提问不该被防复读改成不回答');
  assert.equal(decision.params.refocus, true);
});

test('重复：知识族与社交族分开计数，互不污染', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'asking_knowledge' }),
    context({
      recentActions: [
        { intent: 'greeting', action: 'reply_natural' },
        { intent: 'chat_offtopic', action: 'reply_natural' },
      ],
    }),
  );

  assert.equal(decision.action, 'answer_knowledge');
  assert.equal(decision.params.refocus, undefined, '之前的闲聊不该让第一个知识问题就被拉回');
});

test('重复：连续闲聊两次附拉回句，第三次才指回任务', () => {
  const twice = decideTutorAction(
    understanding({ intent: 'chat_offtopic' }),
    context({
      recentActions: [
        { intent: 'greeting', action: 'reply_natural' },
        { intent: 'chat_offtopic', action: 'reply_natural' },
      ],
    }),
  );
  assert.equal(twice.action, 'reply_natural');
  assert.equal(twice.params.refocus, true);

  const thrice = decideTutorAction(
    understanding({ intent: 'chat_offtopic' }),
    context({
      recentActions: [
        { intent: 'greeting', action: 'reply_natural' },
        { intent: 'chat_offtopic', action: 'reply_natural' },
        { intent: 'chat_offtopic', action: 'reply_natural' },
      ],
    }),
  );
  assert.equal(thrice.action, 'redirect_task');
});

test('重复：连续澄清仍没读懂时给一个可操作的下一步', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'unknown', confidence: 0.1 }),
    context({
      recentActions: [
        { intent: 'unknown', action: 'clarify' },
        { intent: 'unknown', action: 'clarify' },
      ],
    }),
  );

  assert.equal(decision.action, 'redirect_task');
});

test('重复：连续指回任务无进展时改给分级提示', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'claim_done' }),
    context({
      recentActions: [
        { intent: 'claim_done', action: 'redirect_task' },
        { intent: 'claim_done', action: 'redirect_task' },
      ],
    }),
  );

  assert.equal(decision.action, 'give_scaffold');
});

test('重复：问路与待答问题豁免——问两次路要给两次导航', () => {
  const decision = decideTutorAction(
    understanding({ intent: 'asking_location', locationKind: 'task' }),
    context({
      recentActions: [
        { intent: 'asking_location', action: 'guide_location' },
        { intent: 'asking_location', action: 'guide_location' },
      ],
    }),
  );

  assert.equal(decision.action, 'guide_location');
});

test('默认与异常入参不抛异常，落在合法动作枚举内', () => {
  for (const decision of [
    decideTutorAction(undefined, undefined),
    decideTutorAction({}, {}),
    decideTutorAction({ intent: 42, confidence: 'x' }, { scaffoldLevel: '9', recentActions: null }),
    decideTutorAction({ intent: 'help_stuck', locationKind: '乱写' }, { maxScaffoldLevel: -3 }),
  ]) {
    assert.ok(TUTOR_ACTIONS.includes(decision.action));
    assert.equal(typeof decision.reason, 'string');
    assert.equal(typeof decision.params, 'object');
  }
});
