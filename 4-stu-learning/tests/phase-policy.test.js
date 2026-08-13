import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { compilePhasePolicy, phasePolicyInstructions } from '../server/course/phase-policy.js';
import { phasePromptForDecision } from '../server/agent/prompt.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

test('结构化 Phase 提示按语义字段装配，晚于 500 字的禁止与转场不会丢失', () => {
  const filler = '观察现场证据。'.repeat(90);
  const policy = compilePhasePolicy([
    '# 测试阶段',
    '## 阶段目标',
    filler,
    '## 开场白模板',
    '这段长篇开场不应每轮重复。',
    '## 禁止行为',
    '禁止替学生公布最终答案。',
    '## 转场条件',
    '只有当前任务通过后才能转场。',
  ].join('\n'), { file: 'prompts/phase1-test.md' });

  const instructions = phasePolicyInstructions(policy);
  assert.equal(policy.mode, 'structured');
  assert.match(instructions, /禁止替学生公布最终答案/);
  assert.match(instructions, /只有当前任务通过后才能转场/);
  assert.doesNotMatch(instructions, /长篇开场不应每轮重复/);
  assert.equal(policy.opening, '这段长篇开场不应每轮重复。');
});

test('旧式无二级标题提示保留全文兼容并产生可定位 warning', () => {
  const source = '# Phase 2\n先看证据，再讨论关系。\n最后由老师组织汇总。';
  const policy = compilePhasePolicy(source, { file: 'prompts/phase2-legacy.md' });
  assert.equal(policy.mode, 'compat');
  assert.equal(phasePolicyInstructions(policy), source);
  assert.equal(policy.warnings[0].code, 'phase_prompt_unstructured');
  assert.equal(policy.warnings[0].file, 'prompts/phase2-legacy.md');
});

test('只有开场或未知章节的结构化 Phase 不会回落注入整份原文', () => {
  const policy = compilePhasePolicy([
    '# Phase 1',
    '## 开场白模板',
    '只应在阶段开场出现。',
    '## 未登记章节',
    '这段没有运行时语义。',
  ].join('\n'));

  assert.equal(policy.mode, 'structured');
  assert.equal(phasePromptForDecision(policy, true), '');
  assert.equal(phasePromptForDecision(policy, false), '');
  assert.equal(policy.opening, '只应在阶段开场出现。');
  assert.equal(policy.unknownSections.length, 1);
});

test('真课程六份 Phase policy 全部结构化且无兼容告警', async () => {
  clearCourseCache();
  const gewu = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  assert.equal(Object.keys(gewu.phasePolicies).length, 6);
  assert.equal(gewu.phasePolicies['phase-2'].mode, 'structured');
  assert.match(phasePolicyInstructions(gewu.phasePolicies['phase-2']), /本阶段禁止与边界/);

  const zhizhi = await compileCourse({ lessonsRoot, courseId: 'lesson_zhizhi_001' });
  assert.equal(zhizhi.phasePolicies['phase-1'].mode, 'structured');
  assert.equal(
    zhizhi.platformDefaults.warnings.some((warning) => warning.code.startsWith('phase_prompt_')),
    false,
  );
});
