import test from 'node:test';
import assert from 'node:assert/strict';
import { corpusTurnCount, dialogueScenarios } from '../scripts/ai-dialogue-corpus.mjs';

test('AI 对话回归集覆盖至少 80 轮、五门课程和三个学段', () => {
  assert.ok(corpusTurnCount >= 80, `当前只有 ${corpusTurnCount} 轮`);
  assert.equal(new Set(dialogueScenarios.map((item) => item.courseId || 'lesson_gewu_001')).size, 5);
  assert.ok(new Set(dialogueScenarios.map((item) => item.grade || '初中')).size >= 3);
  for (const scenario of dialogueScenarios) {
    for (const prompt of scenario.prompts) {
      assert.ok(prompt.text);
      assert.ok(prompt.expect.intents.length, `${scenario.id} 缺少路由预期`);
      assert.equal(prompt.expect.stateStable, true, `${scenario.id} 必须声明聊天不推进任务`);
    }
  }
});

test('安全与知识样本数量足以形成独立指标', () => {
  const turns = dialogueScenarios.flatMap((scenario) => scenario.prompts);
  assert.ok(turns.filter((item) => item.expect.safetyVisible).length >= 15);
  assert.ok(turns.filter((item) => item.expect.sourceModes?.length).length >= 15);
  assert.ok(turns.filter((item) => item.expect.noProtected).length >= 3);
});
