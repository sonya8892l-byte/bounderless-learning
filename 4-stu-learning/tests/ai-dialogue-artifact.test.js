import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildReleaseThresholds,
  buildReviewQueue,
  buildRunArtifact,
  buildSummaryArtifact,
  JOURNEY_RESULT_SCHEMA_VERSION,
  journeyAssertionsSha256,
  validateDialogueManifest,
  validateJourneyResults,
} from '../scripts/ai-dialogue-artifact.mjs';
import {
  journeyFixtureVersion,
  journeyScenarios,
} from '../scripts/ai-dialogue-journey-corpus.mjs';

const state = (extra = {}) => ({
  phaseId: 'phase-1',
  roleId: 'dragon-counter',
  taskId: 'task-1',
  taskIndex: 0,
  stepIndex: 0,
  finalizationMode: 'explicit_bundle_submit',
  finalizationStatus: 'active',
  completedTaskIds: [],
  completedStepIds: [],
  complete: true,
  ...extra,
});

function validTurn(overrides = {}) {
  const assistant = overrides.assistant || '请先观察螭首。';
  return {
    category: 'corpus',
    inputType: 'user_text',
    input: { type: 'user_text', text: '我该怎么做？' },
    student: '我该怎么做？',
    assistant,
    assistantMessages: [assistant],
    intent: 'task_help',
    intents: ['task_help'],
    sourceMode: 'course',
    grade: '初中',
    errors: [],
    tools: [],
    before: state(),
    after: state(),
    rawEvents: [
      { type: 'assistant.completed', data: { text: assistant, partIndex: 0, partCount: 1, intent: 'task_help' } },
      {
        type: 'state.updated',
        data: {
          phaseId: 'phase-1',
          roleId: 'dragon-counter',
          currentTaskIndex: 0,
          completedTaskIds: [],
          taskFinalization: { mode: 'explicit_bundle_submit', status: 'active' },
          runtime: {
            task: {
              taskId: 'task-1',
              guidanceStepIndex: 0,
              finalization: { mode: 'explicit_bundle_submit', status: 'active' },
            },
            learning: { completedStepIds: [] },
          },
        },
      },
    ],
    rawSse: [
      `event: assistant.completed\ndata: ${JSON.stringify({ text: assistant, partIndex: 0, partCount: 1 })}`,
      `event: state.updated\ndata: ${JSON.stringify({
        phaseId: 'phase-1', roleId: 'dragon-counter', currentTaskIndex: 0, completedTaskIds: [],
        taskFinalization: { mode: 'explicit_bundle_submit', status: 'active' },
        runtime: {
          task: {
            taskId: 'task-1', guidanceStepIndex: 0,
            finalization: { mode: 'explicit_bundle_submit', status: 'active' },
          },
          learning: { completedStepIds: [] },
        },
      })}`,
    ].join('\n\n'),
    elapsedMs: 50,
    expect: {
      assistantRequired: true,
      stateStable: true,
      requiredEvents: ['assistant.completed', 'state.updated'],
      requireCompleteParts: true,
      intents: ['task_help'],
    },
    ...overrides,
  };
}

async function completeJourneyFixture(t, status = 'passed') {
  const evidenceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'journey-evidence-'));
  t.after(() => fs.rm(evidenceRoot, { recursive: true, force: true }));
  await fs.mkdir(path.join(evidenceRoot, 'captures'));
  let captureIndex = 0;
  const payload = {
    schemaVersion: JOURNEY_RESULT_SCHEMA_VERSION,
    fixtureVersion: journeyFixtureVersion,
    runId: 'browser-run-001',
    generatedAt: '2026-08-11T13:00:00.000Z',
    tester: 'browser-control',
    environment: {
      appVersion: 'test-build-001',
      browser: 'Codex in-app browser',
      viewport: { width: 402, height: 867 },
      courseVersions: { lesson_gewu_001: 'course-test-001' },
    },
    journeys: [],
  };
  for (const journey of journeyScenarios) {
    const journeyResult = { id: journey.id, steps: [] };
    for (let index = 0; index < journey.steps.length; index += 1) {
      const step = journey.steps[index];
      captureIndex += 1;
      const kind = step.transport === 'agent' ? 'event-log' : 'screenshot';
      const extension = kind === 'event-log' ? 'json' : 'png';
      const relativePath = `captures/${journey.id}-${index + 1}.${extension}`;
      const captureBytes = kind === 'event-log'
        ? Buffer.from(JSON.stringify({ event: step.input?.event || step.input?.type, captureIndex }))
        : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
      await fs.writeFile(path.join(evidenceRoot, relativePath), captureBytes);
      const observedAt = `2026-08-11T12:${String(captureIndex).padStart(2, '0')}:00.000Z`;
      const assertions = Object.fromEntries(Object.entries(step.expect || {}).map(([key, value]) => [key, {
        expected: structuredClone(value),
        actual: structuredClone(value),
        passed: true,
      }]));
      journeyResult.steps.push({
        transport: step.transport,
        inputType: step.input?.type || '',
        event: step.input?.event || '',
        status: journey.id === 'J01' && index === 0 ? status : 'passed',
        evidence: {
          observedAt,
          observations: [`已核对 ${journey.id} 第 ${index + 1} 步。`],
          studentVisibleTexts: [`${journey.id} 第 ${index + 1} 步界面已完整呈现。`],
          capture: {
            kind,
            path: relativePath,
            sha256: crypto.createHash('sha256').update(captureBytes).digest('hex'),
            bytes: captureBytes.length,
            fixtureVersion: journeyFixtureVersion,
            appVersion: payload.environment.appVersion,
            courseVersion: payload.environment.courseVersions[journey.courseId],
            capturedAt: observedAt,
            journeyId: journey.id,
            step: index + 1,
            assertionsSha256: journeyAssertionsSha256(assertions),
          },
          assertions,
        },
      });
    }
    payload.journeys.push(journeyResult);
  }
  return { payload, evidenceRoots: [evidenceRoot] };
}

const permissiveThresholds = {
  useDefaults: false,
  hardGates: { maxFatalIssues: 0, maxHardFailedTurns: 0, maxExperienceFailedTurns: 0 },
  coverage: { minScenarioCount: 1, minTurnCount: 1 },
  softQuality: { passedTurnRate: 1 },
};

test('release thresholds 从完整 manifest 计算，不用 min=1 伪装覆盖', () => {
  const scenarios = [
    {
      id: 'A', courseId: 'course-a', grade: '初中',
      prompts: [
        { expect: { assistantRequired: true, intents: ['task_help'], safetyVisible: true } },
        { expect: { assistantRequired: true, intents: ['course_knowledge'], sourceModes: ['course'], noProtected: true } },
      ],
    },
    { id: 'B', courseId: 'course-b', grade: '高中', prompts: [{ expect: { assistantRequired: true, intents: ['social'] } }] },
  ];
  const thresholds = buildReleaseThresholds(scenarios, 3);
  assert.equal(thresholds.coverage.minScenarioCount, 6);
  assert.equal(thresholds.coverage.minTurnCount, 9);
  assert.equal(thresholds.coverage.minSafetyTurns, 3);
  assert.equal(thresholds.coverage.minProtectedTurns, 9);
  assert.equal(thresholds.coverage.minKnowledgeTurns, 3);
  assert.equal(thresholds.coverage.minCourseCount, 2);
  assert.equal(thresholds.coverage.minGradeCount, 2);
  assert.equal(thresholds.coverage.minExpectedIntentCount, 3);
});

test('dialogue manifest 拒绝缺场景、缺轮次和重复运行', () => {
  const expected = [
    { id: 'A', prompts: [{}, {}] },
    { id: 'B', prompts: [{}] },
  ];
  const complete = validateDialogueManifest({
    expectedScenarios: expected,
    results: [
      { id: 'A', corpusScenarioId: 'A', repetition: 1, turns: [validTurn(), validTurn()] },
      { id: 'B', corpusScenarioId: 'B', repetition: 1, turns: [validTurn()] },
    ],
  });
  assert.equal(complete.complete, true);

  const incomplete = validateDialogueManifest({
    expectedScenarios: expected,
    results: [
      { id: 'A', corpusScenarioId: 'A', repetition: 1, turns: [validTurn()] },
      { id: 'A-copy', corpusScenarioId: 'A', repetition: 1, turns: [validTurn(), validTurn()] },
    ],
  });
  assert.equal(incomplete.complete, false);
  assert.ok(incomplete.issues.some((issue) => issue.code === 'dialogue_turn_count_mismatch'));
  assert.ok(incomplete.issues.some((issue) => issue.code === 'duplicate_dialogue_scenario'));
  assert.ok(incomplete.issues.some((issue) => issue.code === 'missing_dialogue_scenario' && issue.id === 'B'));
});

test('浏览器旅程缺证据为 incomplete，完整失败证据为 threshold miss', async (t) => {
  const missing = await validateJourneyResults(null, journeyScenarios, journeyFixtureVersion, { required: true });
  assert.equal(missing.complete, false);
  assert.equal(missing.issues[0].code, 'missing_journey_results');

  const completeFixture = await completeJourneyFixture(t);
  const complete = await validateJourneyResults(
    completeFixture.payload, journeyScenarios, journeyFixtureVersion,
    { required: true, evidenceRoots: completeFixture.evidenceRoots },
  );
  assert.equal(complete.complete, true);
  assert.equal(complete.passed, true);
  assert.equal(complete.passRate, 1);
  assert.equal(complete.verifiedCaptureCount, complete.expectedSteps);

  const failedFixture = await completeJourneyFixture(t, 'failed');
  const failed = await validateJourneyResults(
    failedFixture.payload, journeyScenarios, journeyFixtureVersion,
    { required: true, evidenceRoots: failedFixture.evidenceRoots },
  );
  assert.equal(failed.complete, true);
  assert.equal(failed.passed, false);
  assert.ok(failed.passRate < 1);

  const selfReportedFixture = await completeJourneyFixture(t);
  const selfReported = selfReportedFixture.payload;
  selfReported.journeys[0].steps[0].evidence = {
    observedAt: '2026-08-11T12:00:00.000Z',
    observations: ['ok'],
  };
  const rejected = await validateJourneyResults(
    selfReported, journeyScenarios, journeyFixtureVersion,
    { required: true, evidenceRoots: selfReportedFixture.evidenceRoots },
  );
  assert.equal(rejected.complete, false);
  assert.ok(rejected.issues.some((issue) => issue.code === 'journey_step_capture_invalid'));
  assert.ok(rejected.issues.some((issue) => issue.code === 'journey_step_assertions_missing'));
});

test('旅程证据必须读取允许根目录内真实字节并绑定版本、时间与断言', async (t) => {
  const tamperedFixture = await completeJourneyFixture(t);
  const firstCapture = tamperedFixture.payload.journeys[0].steps[0].evidence.capture;
  await fs.writeFile(path.join(tamperedFixture.evidenceRoots[0], firstCapture.path), '{"event":"tampered"}');
  const tampered = await validateJourneyResults(
    tamperedFixture.payload, journeyScenarios, journeyFixtureVersion,
    { required: true, evidenceRoots: tamperedFixture.evidenceRoots },
  );
  assert.equal(tampered.complete, false);
  assert.ok(tampered.issues.some((issue) => issue.code === 'journey_step_capture_sha256_mismatch'));

  const traversalFixture = await completeJourneyFixture(t);
  traversalFixture.payload.journeys[0].steps[0].evidence.capture.path = '../outside.png';
  const traversal = await validateJourneyResults(
    traversalFixture.payload, journeyScenarios, journeyFixtureVersion,
    { required: true, evidenceRoots: traversalFixture.evidenceRoots },
  );
  assert.ok(traversal.issues.some((issue) => issue.code === 'journey_step_capture_path_invalid'));

  const unboundFixture = await completeJourneyFixture(t);
  const evidence = unboundFixture.payload.journeys[0].steps[0].evidence;
  evidence.capture.fixtureVersion = 'stale-fixture';
  evidence.capture.courseVersion = 'stale-course';
  evidence.capture.capturedAt = '2026-08-10T12:00:00.000Z';
  evidence.capture.assertionsSha256 = 'f'.repeat(64);
  const unbound = await validateJourneyResults(
    unboundFixture.payload, journeyScenarios, journeyFixtureVersion,
    { required: true, evidenceRoots: unboundFixture.evidenceRoots },
  );
  for (const code of [
    'journey_step_capture_fixture_version_mismatch',
    'journey_step_capture_course_version_mismatch',
    'journey_step_capture_time_mismatch',
    'journey_step_capture_assertions_sha256_mismatch',
  ]) {
    assert.ok(unbound.issues.some((issue) => issue.code === code), code);
  }

  const staleCourseFixture = await completeJourneyFixture(t);
  const staleCourse = await validateJourneyResults(
    staleCourseFixture.payload, journeyScenarios, journeyFixtureVersion,
    {
      required: true,
      evidenceRoots: staleCourseFixture.evidenceRoots,
      expectedCourseVersions: { lesson_gewu_001: 'current-compiled-content-version' },
    },
  );
  assert.ok(staleCourse.issues.some((issue) => issue.code === 'journey_course_version_mismatch'));
});

test('release 旅程缺课程保护上下文或学生可见文本泄题时 fail closed', async (t) => {
  const fixture = await completeJourneyFixture(t);
  const missing = await validateJourneyResults(
    fixture.payload, journeyScenarios, journeyFixtureVersion,
    {
      required: true,
      evidenceRoots: fixture.evidenceRoots,
      requireCourseProtection: true,
      courseProtectionByCourse: new Map(),
    },
  );
  assert.ok(missing.issues.some((issue) => issue.code === 'journey_course_protection_missing'));

  const protection = new Map([['lesson_gewu_001', {
    terms: ['1142'], matchers: [{ kind: 'normalized_contains', value: '1142' }],
  }]]);
  fixture.payload.journeys[0].steps[0].evidence.studentVisibleTexts = ['故宫共有 1142 个螭首。'];
  const leaked = await validateJourneyResults(
    fixture.payload, journeyScenarios, journeyFixtureVersion,
    {
      required: true,
      evidenceRoots: fixture.evidenceRoots,
      requireCourseProtection: true,
      courseProtectionByCourse: protection,
    },
  );
  assert.equal(leaked.complete, false);
  assert.ok(leaked.issues.some((issue) => issue.code === 'journey_step_protection_leak'));

  delete fixture.payload.journeys[0].steps[0].evidence.studentVisibleTexts;
  const unobservable = await validateJourneyResults(
    fixture.payload, journeyScenarios, journeyFixtureVersion,
    {
      required: true,
      evidenceRoots: fixture.evidenceRoots,
      requireCourseProtection: true,
      courseProtectionByCourse: protection,
    },
  );
  assert.ok(unobservable.issues.some((issue) => issue.code === 'journey_step_student_visible_text_missing'));
});

test('人工队列排除 bootstrap，并确保 30 轮分层样本', () => {
  const turns = [
    validTurn({ category: 'bootstrap', expect: { assistantRequired: true, stateStable: true, score: false } }),
    ...Array.from({ length: 50 }, (_, index) => validTurn({
      grade: index % 2 ? '初中' : '高中',
      expect: {
        assistantRequired: true,
        stateStable: true,
        intents: [index % 3 ? 'task_help' : 'social'],
        ...(index === 0 ? { safetyVisible: true } : {}),
      },
      checks: {
        passed: true,
        hard: { failedChecks: [] },
        expression: { failedChecks: [] },
        experience: { failedChecks: [] },
      },
    })),
  ];
  const review = buildReviewQueue([{
    id: 'sample', corpusScenarioId: 'sample', courseId: 'course-a', grade: '初中', turns,
  }]);
  assert.equal(review.stats.corpusTurnCount, 50);
  assert.equal(review.stats.mandatoryTurnCount, 1);
  assert.equal(review.stats.stratifiedSelected, 30);
  assert.equal(review.items.some((item) => item.category === 'bootstrap'), false);
  assert.equal(review.items.filter((item) => item.priority === 'stratified-sample').length, 30);
  assert.ok(new Set(review.items.map((item) => `${item.grade}|${item.expectedIntents.join('+')}`)).size >= 3);
});

test('artifact builder 保存完整事件，release 缺 journey 时失败，summary 不泄露绝对路径', async () => {
  const scenario = { id: 'A', courseId: 'course-a', grade: '初中', prompts: [{}] };
  const results = [{
    id: 'A', corpusScenarioId: 'A', repetition: 1, courseId: 'course-a', grade: '初中',
    turns: [validTurn()], error: null,
  }];
  const missingJourney = await validateJourneyResults(null, journeyScenarios, journeyFixtureVersion, { required: true });
  const output = buildRunArtifact({
    meta: { runId: 'run-a', reproducibilityIssues: [] },
    thresholds: permissiveThresholds,
    results,
    expectedScenarios: [scenario],
    profile: 'release',
    journeyValidation: missingJourney,
  });
  assert.equal(output.machinePassed, false);
  assert.ok(output.meta.reproducibilityIssues.includes('release_journey_evidence_incomplete'));
  assert.equal(output.results[0].turns[0].rawEvents.length, 2);
  assert.match(output.results[0].turns[0].rawSse, /assistant\.completed/u);

  const summary = buildSummaryArtifact(output, '/Users/private-person/secret/run-a.json');
  assert.equal(summary.rawRunFile, 'run-a.json');
  assert.doesNotMatch(JSON.stringify(summary), /private-person/u);
});

test('partial turn 与 runner error 保留在 artifact 并形成 fatal', async () => {
  const partial = validTurn({
    rawSse: 'event: assistant.completed\ndata: {"text":"只收到这一泡。","partIndex":0,"partCount":1}',
    rawEvents: [{ type: 'assistant.completed', data: { text: '只收到这一泡。', partIndex: 0, partCount: 1 } }],
    after: null,
    errors: [{ code: 'EVAL_RUNNER_TURN_FAILED', stage: 'after_state' }],
    fatal: true,
  });
  const output = buildRunArtifact({
    meta: { runId: 'partial' },
    thresholds: permissiveThresholds,
    results: [{
      id: 'A', corpusScenarioId: 'A', repetition: 1, courseId: 'course-a', grade: '初中',
      turns: [partial], error: 'AFTER_STATE_FAILED',
    }],
    expectedScenarios: [{ id: 'A', prompts: [{}] }],
    profile: 'diagnostic',
    journeyValidation: await validateJourneyResults(null, journeyScenarios, journeyFixtureVersion, { required: false }),
    runnerErrors: [{ type: 'outer_failure', message: 'boom' }],
  });
  assert.equal(output.machinePassed, false);
  assert.match(output.results[0].turns[0].rawSse, /只收到这一泡/u);
  assert.ok(output.metrics.fatalIssues.some((issue) => issue.type === 'turn_error'));
  assert.equal(output.metrics.runFatalIssueCount, 1);
});
