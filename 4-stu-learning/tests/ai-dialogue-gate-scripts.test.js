import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = packageJson.scripts || {};
const evalGuide = fs.readFileSync(new URL('../docs/ai-dialogue-eval.md', import.meta.url), 'utf8');

test('普通质量门禁与当前发布门禁不会运行付费或人工 AI 验收', () => {
  assert.equal(scripts['quality:gate:release'], 'npm run quality:gate');

  for (const name of ['quality:gate', 'quality:gate:release']) {
    const command = String(scripts[name] || '');
    assert.doesNotMatch(command, /eval:ai:(?:live|review)/);
    assert.doesNotMatch(command, /quality:gate:formal/);
  }
});

test('正式研究级门禁保留三次 live 与人工 review 的显式入口', () => {
  assert.match(scripts['eval:ai:live'], /AI_DIALOGUE_PROFILE=diagnostic/);
  assert.match(scripts['eval:ai:live'], /AI_DIALOGUE_REPETITIONS=1/);
  assert.equal(scripts['eval:ai:diagnostic'], 'npm run eval:ai:live');
  assert.match(scripts['eval:ai:formal'], /AI_DIALOGUE_PROFILE=release/);
  assert.match(scripts['eval:ai:formal'], /AI_DIALOGUE_REPETITIONS=3/);
  assert.match(scripts['quality:gate:formal:live'], /quality:gate/);
  assert.match(scripts['quality:gate:formal:live'], /eval:ai:formal/);
  assert.match(scripts['quality:gate:formal'], /quality:gate/);
  assert.match(scripts['quality:gate:formal'], /eval:ai:review/);
});

test('文档区分本地发布检查与正式质量验收结论', () => {
  assert.match(evalGuide, /只能写“本地发布检查通过”/);
  assert.match(evalGuide, /不能被误写为已经正式验收/);
  assert.match(evalGuide, /正式对外／研究级质量验收/);
  assert.doesNotMatch(evalGuide, /quality:gate:live|quality:gate:release:verify/);
});
