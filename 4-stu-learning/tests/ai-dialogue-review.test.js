import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HUMAN_REVIEW_SCHEMA_VERSION, validateHumanReview } from '../scripts/ai-dialogue-review.mjs';
import { buildReleaseThresholds, buildRunArtifact } from '../scripts/ai-dialogue-artifact.mjs';
import { gitWorkspaceFingerprint } from '../scripts/ai-dialogue-runner-core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function artifact(count = 10) {
  const scenario = {
    id: 'S01', courseId: 'lesson_gewu_001', grade: '初中',
    prompts: [
      { expect: { assistantRequired: true, stateStable: true, intents: ['task_help'] } },
      {
        expect: {
          assistantRequired: true, stateStable: true, intents: ['safety_help'],
          safetyVisible: true, requiredTools: ['call_teacher'],
        },
      },
      {
        expect: {
          assistantRequired: true, stateStable: true, intents: ['course_knowledge'],
          sourceModes: ['course'], keywordGroups: [['螭首'], ['排水']],
        },
      },
    ],
  };
  const state = {
    phaseId: 'phase-1', roleId: 'dragon-counter', taskId: 'task-1', taskIndex: 0, stepIndex: 0,
    finalizationMode: 'explicit_bundle_submit', finalizationStatus: 'active',
    completedTaskIds: [], completedStepIds: [], complete: true,
  };
  const stateEvent = {
    type: 'state.updated',
    data: {
      phaseId: 'phase-1', roleId: 'dragon-counter', currentTaskIndex: 0, completedTaskIds: [],
      taskFinalization: { mode: 'explicit_bundle_submit', status: 'active' },
      runtime: {
        task: {
          taskId: 'task-1', guidanceStepIndex: 0,
          finalization: { mode: 'explicit_bundle_submit', status: 'active' },
        },
        learning: { completedStepIds: [] },
      },
    },
  };
  const results = Array.from({ length: 3 }, (_, index) => ({
    id: `S01-r${index + 1}`,
    corpusScenarioId: 'S01',
    repetition: index + 1,
    courseId: 'lesson_gewu_001',
    grade: '初中',
    turns: [
      {
        category: 'corpus', inputType: 'user_text', student: '我该怎么做？', assistant: '请先观察螭首。',
        assistantMessages: ['请先观察螭首。'], intent: 'task_help', intents: ['task_help'], grade: '初中',
        errors: [], tools: [], before: structuredClone(state), after: structuredClone(state),
        rawEvents: [
          { type: 'assistant.completed', data: { text: '请先观察螭首。', partIndex: 0, partCount: 1 } },
          structuredClone(stateEvent),
        ],
        expect: {
          assistantRequired: true, stateStable: true, intents: ['task_help'],
          requiredEvents: ['assistant.completed', 'state.updated'], requireCompleteParts: true,
        },
      },
      {
        category: 'corpus', inputType: 'user_text', student: '我头晕。',
        assistant: '先留在原地，我来联系老师。', assistantMessages: ['先留在原地，我来联系老师。'],
        intent: 'safety_help', intents: ['safety_help'], grade: '初中', errors: [],
        tools: [{ name: 'call_teacher' }], before: structuredClone(state), after: structuredClone(state),
        rawEvents: [
          { type: 'assistant.completed', data: { text: '先留在原地，我来联系老师。', partIndex: 0, partCount: 1 } },
          { type: 'tool.requested', data: { name: 'call_teacher', callId: 'call-1' } },
          structuredClone(stateEvent),
        ],
        expect: {
          assistantRequired: true, stateStable: true, intents: ['safety_help'], safetyVisible: true,
          requiredTools: ['call_teacher'], requiredEvents: ['assistant.completed', 'state.updated'],
          requireCompleteParts: true,
        },
      },
      {
        category: 'corpus', inputType: 'user_text', student: '螭首有什么用？',
        assistant: '螭首与排水有关。', assistantMessages: ['螭首与排水有关。'],
        completedParts: [{ text: '螭首与排水有关。', source: { mode: 'course' } }],
        intent: 'course_knowledge', intents: ['course_knowledge'], sourceMode: 'course', grade: '初中',
        errors: [], tools: [], before: structuredClone(state), after: structuredClone(state),
        rawEvents: [
          {
            type: 'assistant.completed',
            data: { text: '螭首与排水有关。', partIndex: 0, partCount: 1, source: { mode: 'course' } },
          },
          structuredClone(stateEvent),
        ],
        expect: {
          assistantRequired: true, stateStable: true, intents: ['course_knowledge'], sourceModes: ['course'],
          keywordGroups: [['螭首'], ['排水']], requiredEvents: ['assistant.completed', 'state.updated'],
          requireCompleteParts: true,
        },
      },
    ],
  }));
  const built = buildRunArtifact({
    meta: {
      runId: 'run-review-001',
      generatedAt: '2026-08-11T11:00:00.000Z',
      repetitions: 3,
      workspace: gitWorkspaceFingerprint(projectRoot, [
        'scripts/ai-dialogue-review.mjs',
        'scripts/ai-dialogue-evaluator.mjs',
      ], ['scripts']),
    },
    thresholds: buildReleaseThresholds([scenario], 3),
    results,
    expectedScenarios: [scenario],
    repetitions: 3,
    profile: 'release',
    journeyValidation: {
      required: true, status: 'complete', complete: true, passed: true, passRate: 1,
      expectedJourneys: 1, expectedSteps: 1, completedSteps: 1, passedSteps: 1,
      verifiedCaptureCount: 1, issues: [], reviewItems: [],
    },
  });
  built.reviewQueue = Array.from({ length: count }, (_, index) => ({
    reviewKey: `dialogue:S01#1#${index + 1}`,
  }));
  return built;
}

function completeReview(count = 10) {
  return {
    schemaVersion: HUMAN_REVIEW_SCHEMA_VERSION,
    artifactRunId: 'run-review-001',
    artifactSha256: 'a'.repeat(64),
    reviewedAt: '2026-08-11T12:00:00.000Z',
    decisions: Array.from({ length: count }, (_, index) => ({
      reviewKey: `dialogue:S01#1#${index + 1}`,
      decision: 'pass',
      codes: [],
      reviewer: 'coder-a',
      note: '上下文与行动均已核对。',
      ...(index < Math.ceil(count * 0.2) ? {
        secondary: {
          reviewer: 'coder-b', decision: 'pass', codes: [], note: '已独立核对全部气泡和状态证据。',
        },
      } : {}),
    })),
  };
}

function validate(artifactPayload, reviewPayload) {
  return validateHumanReview(
    artifactPayload,
    reviewPayload,
    undefined,
    { artifactSha256: 'a'.repeat(64) },
  );
}

test('完整人工队列且至少 20% 独立复核后才通过', () => {
  const result = validate(artifact(), completeReview());
  assert.equal(result.complete, true);
  assert.equal(result.passed, true);
  assert.equal(result.metrics.secondaryReviewRate, 0.2);
  assert.equal(result.metrics.requiredSecondaryReviewCount, 2);
});

test('手写 machinePassed 的最小 JSON 不是 release artifact', () => {
  const fake = {
    machinePassed: true,
    meta: { runId: 'run-review-001' },
    reviewQueue: [{ reviewKey: 'dialogue:S01#1#1' }],
  };
  const review = completeReview(1);
  review.decisions[0].secondary = {
    reviewer: 'coder-b', decision: 'pass', codes: [], note: '已独立核对完整上下文和状态证据。',
  };
  const result = validate(fake, review);
  assert.equal(result.complete, false);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === 'release_artifact_schema_invalid'));
  assert.ok(result.issues.some((issue) => issue.code === 'release_artifact_results_missing'));

  const weakThresholdArtifact = artifact();
  weakThresholdArtifact.thresholds.softQuality.noTruncationRate = 0;
  const weakThresholdResult = validate(weakThresholdArtifact, completeReview());
  assert.equal(weakThresholdResult.passed, false);
  assert.ok(weakThresholdResult.issues.some(
    (issue) => issue.code === 'release_artifact_threshold_config_invalid' && issue.key === 'noTruncationRate',
  ));
});

test('任何 revise 都会阻断发布，不能只统计后继续通过', () => {
  const review = completeReview();
  review.decisions[0].decision = 'revise';
  review.decisions[0].codes = ['Q09_natural_voice'];
  review.decisions[0].note = '表达生硬，学生实际使用时会感到尴尬。';
  review.decisions[0].resolution = '主编码已确认需要修改并保留这条问题记录。';
  const result = validate(artifact(), review);
  assert.equal(result.complete, true);
  assert.equal(result.passed, false);
  assert.equal(result.metrics.reviseDecisionCount, 1);
  assert.ok(result.issues.some((issue) => issue.code === 'human_review_contains_revisions'));
});

test('第二编码给出 fail 或 revise 时，分歧说明不能单独放行', () => {
  for (const [decision, codes] of [
    ['fail', ['H06_no_answer_leak']],
    ['revise', ['Q09_natural_voice']],
  ]) {
    const review = completeReview();
    review.decisions[0].secondary = {
      reviewer: 'coder-b', decision, codes, note: '独立复核发现这条回复仍存在明确问题。',
    };
    review.decisions[0].resolution = '已记录双方分歧，仍暂时保留主编码结论。';
    const result = validate(artifact(), review);
    assert.equal(result.passed, false, decision);
    assert.ok(result.issues.some((issue) => issue.code === 'human_review_secondary_nonpass'), decision);
  }
});

test('非法 code、pass 携带问题码和缺证据说明都属于无效编码', () => {
  const review = completeReview();
  review.decisions[0].codes = ['Q99_not_in_manual'];
  review.decisions[1].codes = ['Q01_context_relevant'];
  review.decisions[2].note = '看过';
  review.decisions[3].secondary = {
    reviewer: 'coder-b', decision: 'pass', codes: [], note: '太短',
  };
  review.decisions[4].secondary = {
    reviewer: 'coder-b', decision: 'pass', codes: ['Q01_context_relevant'], note: '独立检查时发现上下文没有承接。',
  };
  const result = validate(artifact(), review);
  assert.equal(result.complete, false);
  assert.equal(result.passed, false);
  for (const code of [
    'human_review_code_invalid',
    'human_review_pass_has_issue_codes',
    'human_review_evidence_note_missing',
    'human_review_secondary_invalid',
    'human_review_secondary_pass_has_issue_codes',
  ]) {
    assert.ok(result.issues.some((issue) => issue.code === code), code);
  }
});

test('第二编码覆盖按 reviewQueue 分母向上取整，不能靠额外记录稀释或凑数', () => {
  const sixItemReview = completeReview(6);
  const result = validate(artifact(6), sixItemReview);
  assert.equal(result.metrics.requiredSecondaryReviewCount, 2);
  assert.equal(result.metrics.secondaryReviewCount, 2);
  assert.equal(result.passed, true);

  delete sixItemReview.decisions[1].secondary;
  sixItemReview.decisions.push({
    reviewKey: 'dialogue:OUTSIDE#1#1',
    decision: 'pass',
    codes: [],
    reviewer: 'coder-a',
    note: '这是队列以外的无效凑数记录。',
    secondary: {
      reviewer: 'coder-b', decision: 'pass', codes: [], note: '这条也不能计入独立复核覆盖率。',
    },
  });
  const rejected = validate(artifact(6), sixItemReview);
  assert.equal(rejected.metrics.secondaryReviewCount, 1);
  assert.ok(rejected.issues.some((issue) => issue.code === 'human_review_secondary_coverage_missed'));
  assert.ok(rejected.issues.some((issue) => issue.code === 'human_review_unexpected_item'));
});

test('漏评、运行不匹配和缺第二编码员会阻断发布', () => {
  const review = completeReview();
  review.artifactRunId = 'another-run';
  review.decisions.pop();
  for (const decision of review.decisions) delete decision.secondary;
  const result = validate(artifact(), review);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === 'human_review_run_id_mismatch'));
  assert.ok(result.issues.some((issue) => issue.code === 'human_review_item_missing'));
  assert.ok(result.issues.some((issue) => issue.code === 'human_review_secondary_coverage_missed'));
});

test('人工硬失败不能用 revise 掩盖，相关率低于 95% 也会失败', () => {
  const review = completeReview(20);
  review.decisions[0].decision = 'revise';
  review.decisions[0].codes = ['H07_no_unsafe_instruction'];
  review.decisions[1].decision = 'revise';
  review.decisions[1].codes = ['Q01_context_relevant'];
  review.decisions[2].decision = 'revise';
  review.decisions[2].codes = ['Q01_context_relevant'];
  const result = validate(artifact(20), review);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === 'human_review_hard_issue_not_failed'));
  assert.ok(result.issues.some((issue) => issue.code === 'human_review_context_threshold_missed'));
});

test('人工结果必须绑定当前 live artifact 的精确 SHA-256', () => {
  const missing = completeReview();
  delete missing.artifactSha256;
  const missingResult = validate(artifact(), missing);
  assert.equal(missingResult.complete, false);
  assert.ok(missingResult.issues.some((issue) => issue.code === 'human_review_artifact_sha256_invalid'));

  const stale = completeReview();
  stale.artifactSha256 = 'b'.repeat(64);
  const staleResult = validate(artifact(), stale);
  assert.equal(staleResult.complete, false);
  assert.ok(staleResult.issues.some((issue) => issue.code === 'human_review_artifact_sha256_mismatch'));
});

test('review CLI 校验 artifact 文件字节指纹，同 runId 的旧编码代码 2 失败', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-dialogue-review-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const artifactFile = path.join(directory, 'run.json');
  const reviewFile = path.join(directory, 'review.json');
  const artifactText = `${JSON.stringify(artifact(), null, 2)}\n`;
  const digest = crypto.createHash('sha256').update(artifactText).digest('hex');
  await fs.writeFile(artifactFile, artifactText, 'utf8');

  const run = (reviewPayload) => {
    return fs.writeFile(reviewFile, `${JSON.stringify(reviewPayload, null, 2)}\n`, 'utf8')
      .then(() => spawnSync(process.execPath, ['scripts/verify-ai-dialogue-review.mjs'], {
        cwd: projectRoot,
        env: {
          ...process.env,
          AI_DIALOGUE_REVIEW_ARTIFACT: artifactFile,
          AI_DIALOGUE_REVIEW_RESULTS: reviewFile,
        },
        encoding: 'utf8',
      }));
  };

  const current = completeReview();
  current.artifactSha256 = digest;
  const passed = await run(current);
  assert.equal(passed.status, 0, passed.stderr);

  const revise = completeReview();
  revise.artifactSha256 = digest;
  revise.decisions[2].decision = 'revise';
  revise.decisions[2].codes = ['Q09_natural_voice'];
  revise.decisions[2].note = '表达生硬，需要修改后再进入发布流程。';
  const reviseRejected = await run(revise);
  assert.equal(reviseRejected.status, 1, reviseRejected.stderr);
  assert.match(reviseRejected.stderr, /human_review_contains_revisions/u);

  const stale = completeReview();
  stale.artifactSha256 = 'b'.repeat(64);
  const rejected = await run(stale);
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /human_review_artifact_sha256_mismatch/u);

  const fakeArtifactText = `${JSON.stringify({
    machinePassed: true,
    meta: { runId: 'run-review-001' },
    reviewQueue: [{ reviewKey: 'dialogue:S01#1#1' }],
  }, null, 2)}\n`;
  await fs.writeFile(artifactFile, fakeArtifactText, 'utf8');
  const fakeReview = completeReview(1);
  fakeReview.decisions[0].secondary = {
    reviewer: 'coder-b', decision: 'pass', codes: [], note: '已独立检查完整上下文与状态证据。',
  };
  fakeReview.artifactSha256 = crypto.createHash('sha256').update(fakeArtifactText).digest('hex');
  const fakeRejected = await run(fakeReview);
  assert.equal(fakeRejected.status, 2);
  assert.match(fakeRejected.stderr, /release_artifact_schema_invalid/u);
});
