import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import {
  compilePhasePolicy,
  phasePolicyInstructions,
  renderPhaseOpening,
} from '../server/course/phase-policy.js';
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

test('Phase 开场渲染去掉代码围栏和 H3 标记，保留分段标题并替换占位符', () => {
  const policy = compilePhasePolicy([
    '# Phase 3',
    '## 阶段目标',
    '整理个人发现并进入小组汇合。',
    '## 开场白模板',
    '### 前半段（个人整理）',
    '```',
    '嘿，{学生名字}。先整理自己的发现。',
    '```',
    '### 后半段（小组汇合）',
    '```',
    '{角色名}，请带着大家去{首个地点}汇合。',
    '```',
    '## 禁止行为',
    '禁止替学生总结答案。',
    '## 转场条件',
    '教师确认后转场。',
  ].join('\n'));

  const opening = renderPhaseOpening(policy, {
    roleName: '数龙官',
    firstLocation: '三大殿三台',
  });

  assert.match(opening, /前半段（个人整理）/u);
  assert.match(opening, /后半段（小组汇合）/u);
  assert.match(opening, /嘿，同学。/u);
  assert.match(opening, /数龙官，请带着大家去三大殿三台汇合。/u);
  assert.doesNotMatch(opening, /```|^###\s/mu);
  assert.doesNotMatch(opening, /\{[^}]+\}/u);
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

test('五门真课程的 Phase 提示统一为五个运行章节，并提供一次性开场', async () => {
  const expectedHeadings = ['阶段目标', '絮絮行为', '开场白模板', '禁止行为', '转场条件'];
  const courseIds = [
    'lesson_gewu_001',
    'lesson_zhizhi_001',
    'lesson_zhizhi_002',
    'lesson_zhizhi_003',
    'lesson_zhuhun_001',
  ];

  for (const courseId of courseIds) {
    clearCourseCache();
    const course = await compileCourse({ lessonsRoot, courseId });
    const promptEntries = Object.entries(course.files)
      .filter(([filename]) => /^prompts\/phase\d+-.+\.md$/.test(filename));
    assert.equal(promptEntries.length, 6, `${courseId} 应提供六份 Phase 提示`);

    for (const [filename, markdown] of promptEntries) {
      const phaseId = `phase-${filename.match(/phase(\d+)/)?.[1]}`;
      const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
      const policy = course.phasePolicies[phaseId];

      assert.deepEqual(headings, expectedHeadings, `${courseId}/${filename} 只保留五个明确运行章节`);
      assert.equal(policy.mode, 'structured');
      assert.ok(policy.opening.trim(), `${courseId}/${filename} 必须提供非空开场`);
      assert.equal(policy.roleGuidance, '', `${courseId}/${filename} 不再重复保存角色任务信息`);
      assert.equal(policy.phrases, '', `${courseId}/${filename} 不再保存无消费点的关键提示词`);
      assert.equal(policy.unknownSections.length, 0);
      assert.equal(policy.warnings.length, 0);
      assert.doesNotMatch(phasePolicyInstructions(policy), /\[角色差异\]/u);
    }
  }
});
