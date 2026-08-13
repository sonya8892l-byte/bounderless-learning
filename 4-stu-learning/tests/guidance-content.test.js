import assert from 'node:assert/strict';
import test from 'node:test';
import { stepEntryDirection, taskOpeningGuidance } from '../server/agent/guidance-content.js';

test('任务开场只读取显式开场引导小节的第一条直接话术', () => {
  const task = {
    guidance: [
      '**引导目标**',
      '让学生先观察。',
      '**开场引导：**',
      '- “第一句开场。”',
      '- 如果学生抢答：“条件话术。”',
      '**当学生不知道看什么时：**',
      '- “后续提示。”',
    ].join('\n'),
  };

  assert.equal(taskOpeningGuidance(task), '第一句开场。');
});

test('没有显式开场引导时不从条件话术或禁止项猜测开场', () => {
  const task = {
    guidance: [
      '**当学生不知道看什么时：**',
      '- “看一看周围。”',
      '**绝对禁止**',
      '- 不说“答案”。',
    ].join('\n'),
  };

  assert.equal(taskOpeningGuidance(task), '');
  assert.equal(stepEntryDirection(task, { scaffold: '| L0 | “先观察轮廓。” |' }), '');
});

test('开场小节遇到普通 Markdown 标题也立即结束，不跨段抓取话术', () => {
  const task = {
    guidance: [
      '**开场引导：**',
      '这里没有直接话术。',
      '### 当学生卡住时',
      '- “这不应成为开场。”',
    ].join('\n'),
  };

  assert.equal(taskOpeningGuidance(task), '');
});

test('启用任务的 Step 进入方向只取 L0，不提前使用 L1', () => {
  const task = { guidance: '**开场引导：**\n- “先看一看。”' };
  const step = {
    scaffold: [
      '| L0 | “先确认主体与台基的位置关系。” |',
      '| L1 | “再找一个周围参照。” |',
    ].join('\n'),
  };

  assert.equal(stepEntryDirection(task, step), '先确认主体与台基的位置关系。');
});
