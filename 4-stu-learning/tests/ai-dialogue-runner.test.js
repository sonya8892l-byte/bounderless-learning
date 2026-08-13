import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  collectAssistantOutput,
  courseProtectionCoverageIssues,
  evaluationExitCode,
  eventPresentation,
  fatalRunReasons,
  parseSse,
  protectScenarioPrompts,
  resolveDynamicInput,
  resolveEvalRepetitions,
  runtimeConfigurationFingerprint,
  safeModelParameters,
  selectScenarios,
  sourceTreeFingerprint,
  stateSnapshot,
} from '../scripts/ai-dialogue-runner-core.mjs';

test('parseSse 保留原始顺序并支持多行 data', () => {
  const events = parseSse([
    'event: assistant.completed',
    'data: {"text":"第一条","partIndex":0,"partCount":1}',
    '',
    'event: state.updated',
    'data: {"taskIndex":0}',
    '',
  ].join('\n'));
  assert.deepEqual(events.map((event) => event.type), ['assistant.completed', 'state.updated']);
  assert.equal(events[0].data.text, '第一条');
});

test('collectAssistantOutput 不会把两条都从 partIndex=0 开始的消息全局交错', () => {
  const output = collectAssistantOutput([
    { type: 'assistant.completed', data: { text: '第一句，', partIndex: 0, partCount: 2 } },
    { type: 'assistant.completed', data: { text: '继续。', partIndex: 1, partCount: 2 } },
    { type: 'assistant.completed', data: { text: '第二条。', partIndex: 0, partCount: 1 } },
  ]);
  assert.deepEqual(output.messages, ['第一句，继续。', '第二条。']);
  assert.equal(output.text, '第一句，继续。\n第二条。');
  assert.ok(output.groups.every((group) => group.valid));
});

test('collectAssistantOutput 标记缺片、乱序与 partCount 不一致', () => {
  const output = collectAssistantOutput([
    { type: 'assistant.completed', data: { text: '后半句', partIndex: 1, partCount: 2 } },
  ]);
  assert.equal(output.groups.length, 1);
  assert.equal(output.groups[0].valid, false);
});

test('eventPresentation 保存阶段、消息、工具的服务端呈现计划', () => {
  const result = eventPresentation([
    { type: 'stage.started', data: { presentation: { sequence: 0, kind: 'stage', delayMs: 0 } } },
    { type: 'assistant.completed', data: { presentation: { sequence: 1, kind: 'message', delayMs: 900 } } },
    { type: 'tool.requested', data: { presentation: { sequence: 2, kind: 'tool', delayMs: 2000 } } },
  ]);
  assert.deepEqual(result.map((item) => item.kind), ['stage', 'message', 'tool']);
  assert.equal(result.at(-1).delayMs, 2000);
});

test('resolveDynamicInput 解析动态 toolCallId，browser_event 明确拒绝发给 Agent', () => {
  const resolved = resolveDynamicInput({
    type: 'tool_result',
    toolCallRef: 'last:open_task_tool',
    result: { status: 'completed' },
  }, {
    toolCalls: [
      { callId: 'call-a', name: 'show_navigation' },
      { callId: 'call-b', name: 'open_task_tool' },
    ],
  });
  assert.equal(resolved.toolCallId, 'call-b');
  assert.equal('toolCallRef' in resolved, false);
  assert.throws(() => resolveDynamicInput({ type: 'browser_event', event: 'photo_removed' }), /浏览器旅程/);
});

test('safeModelParameters 只读取白名单参数，不包含 key、URL 或学生内容', () => {
  assert.deepEqual(safeModelParameters({
    OPENAI_MODEL: 'model-a',
    OPENAI_API_KEY: 'secret',
    OPENAI_BASE_URL: 'https://secret.example',
    AI_MAX_OUTPUT_TOKENS: '384',
  }), {
    OPENAI_MODEL: 'model-a',
    AI_MAX_OUTPUT_TOKENS: '384',
  });
});

test('完整源码树指纹覆盖未跟踪文件并排除环境变量与运行产物', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogue-source-tree-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'src', '.runtime'));
  fs.writeFileSync(path.join(root, 'src', 'new-untracked.js'), 'export const value = 1;');
  fs.writeFileSync(path.join(root, 'src', '.env.local'), 'SECRET=do-not-hash');
  fs.writeFileSync(path.join(root, 'src', '.runtime', 'session.json'), '{"student":"private"}');

  const before = sourceTreeFingerprint(root, ['src'])[0];
  assert.equal(before.fileCount, 1);
  fs.writeFileSync(path.join(root, 'src', 'new-untracked.js'), 'export const value = 2;');
  const after = sourceTreeFingerprint(root, ['src'])[0];
  assert.notEqual(after.digest, before.digest);

  fs.writeFileSync(path.join(root, 'src', '.env.local'), 'SECRET=changed');
  fs.writeFileSync(path.join(root, 'src', '.runtime', 'session.json'), '{"student":"changed"}');
  assert.equal(sourceTreeFingerprint(root, ['src'])[0].digest, after.digest);
});

test('状态快照保存完整权威投影，缺服务端核心字段时标记不完整', () => {
  const complete = stateSnapshot({
    phaseId: 'phase-1',
    roleId: 'dragon-counter',
    currentTaskIndex: 2,
    completedTaskIds: ['task-1'],
    runtime: {
      task: {
        taskId: 'task-2',
        guidanceStepIndex: 1,
        finalization: { mode: 'explicit_bundle_submit', status: 'active' },
      },
      learning: { completedStepIds: ['step-1'] },
    },
  });
  assert.equal(complete.complete, true);
  assert.equal(complete.roleId, 'dragon-counter');
  assert.equal(complete.taskId, 'task-2');
  assert.deepEqual(complete.completedTaskIds, ['task-1']);
  assert.deepEqual(complete.completedStepIds, ['step-1']);

  const flatRuntime = stateSnapshot({
    phaseId: 'phase-1', roleId: 'dragon-counter', currentTaskIndex: 2, completedTaskIds: ['task-1'],
    runtime: {
      taskId: 'task-2', guidanceStepIndex: 1,
      taskFinalization: { mode: 'explicit_bundle_submit', status: 'active' },
      learning: { completedStepIds: ['step-1'] },
    },
  });
  assert.equal(flatRuntime.complete, true);
  assert.equal(flatRuntime.taskId, 'task-2');

  const incomplete = stateSnapshot({});
  assert.equal(incomplete.complete, false);

  const partial = stateSnapshot({
    phaseId: 'phase-1', roleId: 'dragon-counter', currentTaskIndex: 2, completedTaskIds: [],
  });
  assert.equal(partial.complete, false);
  assert.equal(partial.taskId, '');

  const emptyTask = stateSnapshot({
    phaseId: 'phase-1', roleId: '', currentTaskIndex: 0, completedTaskIds: [],
    runtime: {
      taskId: '', guidanceStepIndex: 0,
      taskFinalization: { mode: 'explicit_bundle_submit', status: 'active' },
      learning: { completedStepIds: [] },
    },
  });
  assert.equal(emptyTask.complete, false);
});

test('正式语料与 bootstrap 使用同一课程保护，无固定 matcher 时必须有专门攻击样本', () => {
  const scenario = protectScenarioPrompts(
    { id: 'S01', prompts: [{ expect: { assistantRequired: true } }] },
    { terms: ['1142'], matchers: [{ kind: 'normalized_contains', value: '1142' }] },
    [{ input: { type: 'user_text', text: '我到了' }, expect: { score: false } }],
  );
  assert.deepEqual(scenario.prompts[0].expect.protectedTerms, ['1142']);
  assert.deepEqual(scenario.bootstrapPrompts[0].expect.protectedTerms, ['1142']);

  const protections = new Map([
    ['lesson-empty', { restrictionCount: 4, terms: [], matchers: [] }],
  ]);
  assert.deepEqual(courseProtectionCoverageIssues(protections, ['lesson-empty']), [
    'course_protection_attack_coverage_missing:lesson-empty',
  ]);
  assert.deepEqual(courseProtectionCoverageIssues(protections, ['lesson-empty'], [{
    courseId: 'lesson-empty',
    prompts: [{ expect: { noProtected: true, protectedTerms: ['完整档案如下'] } }],
  }]), []);
  assert.deepEqual(courseProtectionCoverageIssues(new Map(), ['lesson-missing']), [
    'course_protection_missing:lesson-missing',
  ]);
});

test('运行配置指纹只保留非敏感参数和 provider host', () => {
  const result = runtimeConfigurationFingerprint({
    OPENAI_MODEL: 'model-a',
    OPENAI_BASE_URL: 'https://api.example.test/v1?token=secret',
    OPENAI_API_KEY: 'sk-secret',
    AI_MAX_OUTPUT_TOKENS: '192',
  }, 'http://127.0.0.1:3000', {
    source: 'managed_in_process_server',
    serverVerified: true,
  });
  assert.equal(result.source, 'managed_in_process_server');
  assert.equal(result.serverVerified, true);
  assert.equal(result.complete, true);
  assert.equal(result.providers.main, 'api.example.test');
  assert.equal(result.parameters.OPENAI_MODEL, 'model-a');
  assert.doesNotMatch(JSON.stringify(result), /sk-secret|token=secret/u);
  assert.match(result.digest, /^sha256:[a-f0-9]{64}$/u);

  const external = runtimeConfigurationFingerprint({
    OPENAI_MODEL: 'model-a',
    OPENAI_BASE_URL: 'https://api.example.test/v1',
  }, 'http://127.0.0.1:3000');
  assert.equal(external.configurationComplete, true);
  assert.equal(external.serverVerified, false);
  assert.equal(external.complete, false);
});

test('selectScenarios 和 fatalRunReasons 让空样本、场景错误、缺终态真正失败', () => {
  assert.deepEqual(selectScenarios([{ id: 'S01' }, { id: 'S02' }], 'S02'), [{ id: 'S02' }]);
  assert.deepEqual(fatalRunReasons([]), ['no_scenarios_selected']);
  const reasons = fatalRunReasons([
    { id: 'S01', error: 'boom', turns: [] },
    {
      id: 'S02',
      turns: [{ expect: {}, after: null, rawEvents: [{ type: 'assistant.completed', data: {} }] }],
    },
  ]);
  assert.ok(reasons.includes('S01:scenario_error'));
  assert.ok(reasons.includes('S01:empty_scenario'));
  assert.ok(reasons.includes('S02:1:missing_final_state'));
  assert.ok(reasons.includes('S02:1:missing_state_event'));
});

test('评测退出码区分通过、阈值失败和 fatal／复现信息缺失', () => {
  assert.equal(evaluationExitCode({ allPassed: true }), 0);
  assert.equal(evaluationExitCode({ allPassed: false }), 1);
  assert.equal(evaluationExitCode({ allPassed: true, fatalIssueCount: 1 }), 2);
  assert.equal(evaluationExitCode({ allPassed: true, reproducibilityIssues: ['missing_model_tag'] }), 2);
});

test('release 默认连续运行 3 次，显式降到 1 次会形成复现 fatal', () => {
  assert.deepEqual(resolveEvalRepetitions({ profile: 'release' }), {
    repetitions: 3,
    issues: [],
    explicit: false,
  });
  assert.deepEqual(resolveEvalRepetitions({ profile: 'diagnostic' }), {
    repetitions: 1,
    issues: [],
    explicit: false,
  });
  assert.ok(resolveEvalRepetitions({ profile: 'release', configured: '1' })
    .issues.includes('release_repetitions_below_required'));
  assert.ok(resolveEvalRepetitions({ profile: 'release', configured: 'abc' })
    .issues.includes('invalid_eval_repetitions'));
});
