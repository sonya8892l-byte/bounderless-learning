import test from 'node:test';
import assert from 'node:assert/strict';
import {
  corpusTurnCount,
  dialogueCorpusVersion,
  dialogueScenarios,
} from '../scripts/ai-dialogue-corpus.mjs';
import {
  journeyFixtureVersion,
  journeyScenarios,
  journeyStepCount,
} from '../scripts/ai-dialogue-journey-corpus.mjs';

test('AI 对话回归集覆盖至少 80 轮、五门课程和三个学段', () => {
  assert.ok(corpusTurnCount >= 80, `当前只有 ${corpusTurnCount} 轮`);
  assert.equal(new Set(dialogueScenarios.map((item) => item.courseId || 'lesson_gewu_001')).size, 5);
  assert.ok(new Set(dialogueScenarios.map((item) => item.grade || '初中')).size >= 3);
  for (const scenario of dialogueScenarios) {
    for (const prompt of scenario.prompts) {
      assert.ok(prompt.text);
      assert.deepEqual(prompt.input, { type: 'user_text', text: prompt.text });
      assert.ok(prompt.expect.intents.length, `${scenario.id} 缺少路由预期`);
      assert.equal(prompt.expect.stateStable, true, `${scenario.id} 必须声明聊天不推进任务`);
      assert.equal(prompt.expect.assistantRequired, true);
      assert.ok(prompt.expect.requiredEvents.includes('state.updated'));
    }
  }
});

test('安全与知识样本数量足以形成独立指标', () => {
  const turns = dialogueScenarios.flatMap((scenario) => scenario.prompts);
  assert.ok(turns.filter((item) => item.expect.safetyVisible).length >= 15);
  assert.ok(turns.filter((item) => item.expect.sourceModes?.length).length >= 15);
  assert.ok(turns.filter((item) => item.expect.noProtected).length >= 7);
  const protectedCourses = new Set(dialogueScenarios
    .filter((scenario) => scenario.prompts.some((prompt) => prompt.expect.noProtected))
    .map((scenario) => scenario.courseId || 'lesson_gewu_001'));
  assert.equal(protectedCourses.size, 5, '五门课程都要有提示注入或保护答案攻击样本');
});

test('固定语料与旅程 fixture 都有稳定版本号', () => {
  assert.match(dialogueCorpusVersion, /^\d{4}-\d{2}-\d{2}\./);
  assert.match(journeyFixtureVersion, /^\d{4}-\d{2}-\d{2}\./);
});

test('关键旅程分别表达 Agent 与浏览器事件，browser_event 不混入对话 API 语料', () => {
  assert.ok(journeyScenarios.length >= 5);
  assert.ok(journeyStepCount >= 10);
  const steps = journeyScenarios.flatMap((scenario) => scenario.steps);
  assert.ok(steps.some((step) => step.transport === 'agent' && step.input.type === 'lifecycle_event'));
  assert.ok(steps.some((step) => step.transport === 'browser' && step.input.type === 'browser_event'));
  assert.ok(steps.some((step) => step.input.event === 'photo_removed'));
  assert.ok(steps.some((step) => step.expect.minimumToolDelayMs === 2_000));
  assert.ok(dialogueScenarios
    .flatMap((scenario) => scenario.prompts)
    .every((prompt) => prompt.input.type === 'user_text'));
});

test('旅程覆盖视频、角色、照片重拍、两种收口、安全与逐条呈现', () => {
  const names = journeyScenarios.map((scenario) => scenario.name).join('\n');
  for (const keyword of ['短片', '选择角色', '删除', '自动收口', '显式收口', '危险', '延迟']) {
    assert.match(names, new RegExp(keyword));
  }
});
