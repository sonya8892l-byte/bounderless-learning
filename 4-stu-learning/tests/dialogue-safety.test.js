import test from 'node:test';
import assert from 'node:assert/strict';
import { avoidRepeatedReply } from '../server/agent/dialogue-policy.js';
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
