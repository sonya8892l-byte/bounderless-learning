import test from 'node:test';
import assert from 'node:assert/strict';
import { avoidRepeatedReply, safetyHelpReply } from '../server/agent/dialogue-policy.js';
import { deterministicLanguageDecision, safetyOverride } from '../server/agent/turn-router.js';
import { recordDialogueMove } from '../server/agent/session-state.js';
import { createSessionRecord } from '../server/services/session-factory.js';

test('常见安全表达在模型不可用时仍由确定性规则拦截', () => {
  const samples = [
    '我和小组走散了',
    '我有点头晕恶心',
    '我想翻过护栏看看',
    '这里好像有危险',
    '帮我联系老师',
    '我落单了，找不到队伍',
    '我的脚崴了，走不了',
    '有个陌生人一直跟着我',
    '前面有烟味，好像起火了',
  ];

  for (const text of samples) {
    assert.equal(safetyOverride(text), true, text);
    const decision = deterministicLanguageDecision({ text, session: {} });
    assert.equal(decision.intent, 'safety_help', text);
    assert.deepEqual(decision.allowedTools, ['call_teacher'], text);
  }
});

test('普通护栏知识问题不会误触发安全呼叫', () => {
  assert.equal(safetyOverride('故宫的护栏为什么是这种形状？'), false);
});

test('安全回合按明确风险给出一条对应行动，不用同一模板处理所有情形', () => {
  const lost = safetyHelpReply('我和小组走散了');
  const breathing = safetyHelpReply('我喘不上气');
  const stranger = safetyHelpReply('有个陌生人一直跟着我');
  const fire = safetyHelpReply('前面有烟味，好像起火了');

  assert.equal(new Set([lost, breathing, stranger, fire]).size, 4);
  for (const reply of [lost, breathing, stranger, fire]) {
    assert.match(reply, /呼叫老师/);
    assert.doesNotMatch(reply, /任务|小步/);
  }
  assert.match(lost, /显眼的位置/);
  assert.match(breathing, /马上告诉身边的成年人/);
  assert.match(stranger, /不要跟陌生人离开/);
  assert.match(fire, /跟随现场工作人员疏散/);
});

test('重复安全求助仍明确告知老师已收到并给出安全指令', () => {
  const session = createSessionRecord({ courseId: 'lesson_gewu_001', roleId: 'role-shuilong' });
  const first = '收到，我现在帮你呼叫老师。先停在安全的位置，不要独自继续移动。';
  recordDialogueMove(session, { move: 'escalate_safety', text: first });

  const repeated = avoidRepeatedReply(session, first, {
    intent: 'safety_help',
    dialogueMove: 'escalate_safety',
  });

  assert.match(repeated, /老师已经收到求助/);
  assert.match(repeated, /安全、显眼的位置/);
  assert.doesNotMatch(repeated, /赶任务/);
});

test('重复的教学内容保留实际帮助，不改写成责怪学生的元话术', () => {
  const session = createSessionRecord({ courseId: 'lesson_gewu_001', roleId: 'role-shuilong' });
  const guidance = '先把台基边缘和出水口同时拍进画面。';
  recordDialogueMove(session, { move: 'guide_current_step', text: guidance });

  const repeated = avoidRepeatedReply(session, guidance, {
    intent: 'task_help',
    dialogueMove: 'guide_current_step',
  });

  assert.equal(repeated, guidance);
  assert.doesNotMatch(repeated, /我刚才说过|我已经问过/);
});
