import '../server/config/load-local-env.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dialogueCorpusVersion, dialogueScenarios } from './ai-dialogue-corpus.mjs';
import {
  journeyFixtureVersion,
  journeyScenarios,
} from './ai-dialogue-journey-corpus.mjs';
import {
  buildReleaseThresholds,
  buildRunArtifact,
  buildSummaryArtifact,
  validateJourneyResults,
} from './ai-dialogue-artifact.mjs';
import {
  DEFAULT_THRESHOLDS,
  EVALUATOR_VERSION,
  protectedMatchersFromRestrictions,
  protectedTermsFromRestrictions,
} from './ai-dialogue-evaluator.mjs';
import {
  collectAssistantOutput,
  courseProtectionCoverageIssues,
  evaluationExitCode,
  eventPresentation,
  gitWorkspaceFingerprint,
  parseSse,
  protectScenarioPrompts,
  resolveEvalRepetitions,
  runtimeConfigurationFingerprint,
  selectScenarios,
  stateSnapshot,
} from './ai-dialogue-runner-core.mjs';
import { buildApp } from '../server/app.js';
import { loadEnv } from '../server/config/env.js';
import { compileCourse } from '../server/course/compiler.js';
import { AGENT_PROMPT_VERSION } from '../server/agent/prompt.js';
import { STUDENT_FACING_POLICY_VERSION } from '../server/agent/student-facing-policy.js';
import { TURN_PLAN_VERSION } from '../src/engine/turn-plan.js';

export const LIVE_EVAL_RUNNER_VERSION = '2026-08-11.7';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');
let API_BASE = process.env.AI_DIALOGUE_TEST_API || '';
const OUTPUT_DIR = path.resolve(
  process.env.AI_DIALOGUE_TEST_OUTPUT_DIR
    || path.join(projectRoot, 'artifacts/ai-dialogue-eval'),
);
const RUN_ID = process.env.AI_DIALOGUE_RUN_ID
  || `ai-dialogue-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${process.pid}`;
const MAX_WORKERS = Math.max(1, Math.min(4, Number(process.env.AI_DIALOGUE_TEST_WORKERS || 3)));
const EVAL_PROFILE = process.env.AI_DIALOGUE_PROFILE === 'diagnostic' ? 'diagnostic' : 'release';
const repetitionResolution = resolveEvalRepetitions({
  profile: EVAL_PROFILE,
  configured: process.env.AI_DIALOGUE_REPETITIONS,
});
const REPETITIONS = repetitionResolution.repetitions;
const thresholds = EVAL_PROFILE === 'diagnostic'
  ? DEFAULT_THRESHOLDS
  : buildReleaseThresholds(dialogueScenarios, REPETITIONS);

function bootstrapPrompt(text) {
  return {
    input: { type: 'user_text', text },
    expect: {
      assistantRequired: true,
      stateStable: true,
      requiredEvents: ['assistant.completed', 'state.updated'],
      forbiddenEvents: ['agent.error'],
      forbidKnownFallbacks: true,
      forbidUnrelatedSafety: true,
      requireCompleteParts: true,
      // 入场轮保存且执行 fatal 契约，不稀释固定 corpus 的质量分母。
      score: false,
    },
  };
}

const BOOTSTRAP_PROMPTS = Object.freeze([
  bootstrapPrompt('我到了'),
  bootstrapPrompt('准备好了'),
]);

async function request(url, options = {}, timeoutMs = 95_000) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('TEST_REQUEST_TIMEOUT')),
    timeoutMs,
  );
  try {
    const response = await fetch(`${API_BASE}${url}`, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP_${response.status}:${text.slice(0, 500)}`);
      error.status = response.status;
      error.responseText = text;
      throw error;
    }
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

async function createSession(scenario, runKey) {
  const { text } = await request('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      courseId: scenario.courseId || 'lesson_gewu_001',
      roleId: scenario.roleId ?? 'dragon-counter',
      studentId: `eval-${runKey}`.slice(0, 96),
      groupId: `eval-group-${runKey}`.slice(0, 96),
      grade: scenario.grade || '初中',
    }),
  }, 15_000);
  const session = JSON.parse(text);
  if (!session?.id) throw new Error('SESSION_RESPONSE_MISSING_ID');
  return session;
}

async function getSession(sessionId) {
  const { text } = await request(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  }, 15_000);
  return JSON.parse(text);
}

function turnInputLabel(input = {}) {
  if (input.type === 'user_text') return input.text || '';
  if (input.type === 'quick_reply') return input.value || input.act || '';
  if (input.type === 'lifecycle_event') return `[lifecycle:${input.event}]`;
  if (input.type === 'tool_result') return `[tool_result:${input.toolCallId || input.toolCallRef || ''}]`;
  return `[${input.type || 'unknown'}]`;
}

function turnRecord({
  category,
  input,
  grade,
  prompt,
  priorAssistantTexts,
  startedAt,
  beforeSession,
  afterSession,
  rawSse,
  rawEvents,
  runnerError,
  failureStage,
}) {
  const assistantOutput = collectAssistantOutput(rawEvents);
  const stateEvent = [...rawEvents].reverse().find((event) => event.type === 'state.updated');
  const lastPart = assistantOutput.parts.at(-1) || {};
  const errors = rawEvents
    .filter((event) => event.type === 'agent.error')
    .map((event) => event.data || {});
  if (runnerError) {
    errors.push({
      code: 'EVAL_RUNNER_TURN_FAILED',
      stage: failureStage,
      message: String(runnerError.message || runnerError),
    });
  }
  const tools = rawEvents
    .filter((event) => event.type === 'tool.requested')
    .map((event) => ({
      callId: event.data?.callId || '',
      name: event.data?.name || '',
      payload: event.data?.payload || {},
    }));
  return {
    category,
    inputType: input.type,
    input,
    student: turnInputLabel(input),
    assistant: assistantOutput.text,
    assistantMessages: assistantOutput.messages,
    completedParts: assistantOutput.parts,
    completedGroups: assistantOutput.groups,
    approvedText: rawEvents
      .filter((event) => event.type === 'assistant.delta')
      .map((event) => event.data?.text || '')
      .join(''),
    elapsedMs: Date.now() - startedAt,
    intent: lastPart.intent || stateEvent?.data?.intent || '',
    intents: assistantOutput.parts.map((part) => part.intent).filter(Boolean),
    dialogueMove: lastPart.dialogueMove || '',
    degraded: assistantOutput.parts.some((part) => part.degraded),
    sourceMode: lastPart.source?.mode || '',
    sourceLabel: lastPart.source?.label || '',
    citations: lastPart.source?.citations || [],
    grade,
    tools,
    errors,
    fatal: Boolean(runnerError),
    failureStage: failureStage || '',
    presentation: eventPresentation(rawEvents),
    rawEvents,
    rawSse,
    before: beforeSession ? stateSnapshot(beforeSession) : null,
    after: afterSession ? stateSnapshot(afterSession) : null,
    priorAssistantTexts: [...priorAssistantTexts],
    expect: { ...(prompt.expect || {}), grade },
  };
}

async function sendTurn({
  sessionId,
  requestId,
  prompt,
  grade,
  priorAssistantTexts,
  category = 'corpus',
}) {
  const startedAt = Date.now();
  const input = structuredClone(prompt.input || { type: 'user_text', text: prompt.text });
  let beforeSession = null;
  let afterSession = null;
  let rawSse = '';
  let rawEvents = [];
  let failureStage = 'before_state';
  try {
    if (input.type === 'browser_event') {
      throw new Error('browser_event 只能由浏览器旅程执行器处理。');
    }
    beforeSession = await getSession(sessionId);
    failureStage = 'agent_turn';
    const response = await request('/api/agent/turn', {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sessionId, requestId, input }),
    });
    rawSse = response.text;
    rawEvents = parseSse(rawSse);
    failureStage = 'after_state';
    afterSession = await getSession(sessionId);
    return turnRecord({
      category, input, grade, prompt, priorAssistantTexts, startedAt,
      beforeSession, afterSession, rawSse, rawEvents,
    });
  } catch (error) {
    if (!rawSse && error?.responseText) {
      rawSse = String(error.responseText);
      rawEvents = parseSse(rawSse);
    }
    error.partialTurn = turnRecord({
      category, input, grade, prompt, priorAssistantTexts, startedAt,
      beforeSession, afterSession, rawSse, rawEvents, runnerError: error, failureStage,
    });
    throw error;
  }
}

async function runScenario(scenario) {
  const startedAt = Date.now();
  const runKey = `${RUN_ID}-${scenario.runId}`;
  const result = {
    id: scenario.runId,
    corpusScenarioId: scenario.id,
    repetition: scenario.repetition,
    name: scenario.name,
    courseId: scenario.courseId || 'lesson_gewu_001',
    roleId: scenario.roleId ?? 'dragon-counter',
    grade: scenario.grade || '初中',
    sessionId: '',
    turns: [],
    error: null,
  };
  const priorAssistantTexts = [];
  try {
    const session = await createSession(scenario, runKey);
    result.sessionId = session.id;
    if (scenario.bootstrap !== false) {
      const bootstrapPrompts = scenario.bootstrapPrompts || BOOTSTRAP_PROMPTS;
      for (let index = 0; index < bootstrapPrompts.length; index += 1) {
        const turn = await sendTurn({
          sessionId: session.id,
          requestId: `${runKey}-bootstrap-${index + 1}`,
          prompt: bootstrapPrompts[index],
          grade: result.grade,
          priorAssistantTexts,
          category: 'bootstrap',
        });
        result.turns.push(turn);
        if (turn.assistant) priorAssistantTexts.push(turn.assistant);
      }
    }
    for (let index = 0; index < scenario.prompts.length; index += 1) {
      const turn = await sendTurn({
        sessionId: session.id,
        requestId: `${runKey}-turn-${index + 1}`,
        prompt: scenario.prompts[index],
        grade: result.grade,
        priorAssistantTexts,
      });
      result.turns.push(turn);
      if (turn.assistant) priorAssistantTexts.push(turn.assistant);
    }
  } catch (error) {
    if (error.partialTurn) result.turns.push(error.partialTurn);
    result.error = String(error?.message || error);
  }
  result.elapsedMs = Date.now() - startedAt;
  process.stderr.write(`${result.id} ${result.error ? 'ERROR' : 'DONE'} ${result.elapsedMs}ms\n`);
  return result;
}

async function courseVersionMatrix(scenarios) {
  const courseIds = [...new Set(scenarios.map((scenario) => scenario.courseId || 'lesson_gewu_001'))];
  return Promise.all(courseIds.map(async (courseId) => {
    const course = await compileCourse({ lessonsRoot, courseId });
    return {
      courseId,
      courseVersion: course.courseVersion || '',
      contentVersion: course.contentVersion || '',
      platformRulesVersion: course.platformRules?.version || '',
      platformDefaultsVersion: course.platformDefaults?.version || '',
    };
  }));
}

async function protectedTermsByCourse(scenarios) {
  const courseIds = [...new Set(scenarios.map((scenario) => scenario.courseId || 'lesson_gewu_001'))];
  return new Map(await Promise.all(courseIds.map(async (courseId) => {
    const course = await compileCourse({ lessonsRoot, courseId });
    const restrictions = course.restrictions || [];
    return [courseId, {
      terms: protectedTermsFromRestrictions(restrictions),
      matchers: protectedMatchersFromRestrictions(restrictions),
      restrictionCount: restrictions.length,
    }];
  })));
}

async function readJourneyResult() {
  const filename = process.env.AI_DIALOGUE_JOURNEY_RESULTS || '';
  if (!filename) return { payload: null, filename: '', absolutePath: '', error: null };
  const absolutePath = path.resolve(filename);
  try {
    return {
      payload: JSON.parse(await fs.readFile(absolutePath, 'utf8')),
      filename: path.basename(filename),
      absolutePath,
      error: null,
    };
  } catch (error) {
    return { payload: null, filename: path.basename(filename), absolutePath, error };
  }
}

function journeyEvidenceRoots(journeyInput) {
  const configured = String(process.env.AI_DIALOGUE_JOURNEY_EVIDENCE_ROOTS || '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => path.resolve(item));
  if (configured.length) return [...new Set(configured)];
  return journeyInput.absolutePath ? [path.dirname(journeyInput.absolutePath)] : [];
}

async function startManagedEvaluationServer() {
  const env = loadEnv({ projectRoot, lessonsRoot });
  const app = await buildApp({
    env: { ...env, HOST: '127.0.0.1', PORT: 0 },
    serveStatic: false,
    realtimeMode: 'polling',
  });
  try {
    const apiBase = await app.listen({ host: '127.0.0.1', port: 0 });
    return { app, env, apiBase: String(apiBase).replace(/\/$/u, '') };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function main() {
  const selected = selectScenarios(dialogueScenarios, process.env.AI_DIALOGUE_SCENARIOS || '');
  const runnerErrors = [];
  let courseProtectedTerms = new Map();
  try {
    courseProtectedTerms = await protectedTermsByCourse(selected);
  } catch (error) {
    runnerErrors.push({ type: 'course_protection_compile_failed', message: String(error?.message || error) });
  }
  if (EVAL_PROFILE === 'release') {
    const courseIds = selected.map((scenario) => scenario.courseId || 'lesson_gewu_001');
    for (const issue of courseProtectionCoverageIssues(courseProtectedTerms, courseIds, selected)) {
      runnerErrors.push({ type: issue.split(':')[0], message: issue });
    }
  }
  const expanded = selected.flatMap((scenario) => Array.from({ length: REPETITIONS }, (_, index) => ({
    ...protectScenarioPrompts(
      scenario,
      courseProtectedTerms.get(scenario.courseId || 'lesson_gewu_001') || {},
      BOOTSTRAP_PROMPTS,
    ),
    repetition: index + 1,
    runId: REPETITIONS === 1 ? scenario.id : `${scenario.id}-r${index + 1}`,
  })));
  let managedApp = null;
  let runtimeEnv = process.env;
  let runtimeSource = 'external_server_unverified';
  if (!API_BASE) {
    try {
      const managed = await startManagedEvaluationServer();
      managedApp = managed.app;
      runtimeEnv = managed.env;
      API_BASE = managed.apiBase;
      runtimeSource = 'managed_in_process_server';
    } catch (error) {
      API_BASE = 'http://127.0.0.1:1';
      runnerErrors.push({
        type: 'managed_server_start_failed',
        message: String(error?.message || error),
      });
    }
  }
  const runtimeConfiguration = runtimeConfigurationFingerprint(runtimeEnv, API_BASE, {
    source: runtimeSource,
    serverVerified: runtimeSource === 'managed_in_process_server',
  });
  const modelTag = process.env.AI_DIALOGUE_MODEL_TAG
    || runtimeConfiguration.parameters.OPENAI_MODEL
    || 'unreported';
  const providerTag = process.env.AI_DIALOGUE_PROVIDER_TAG
    || runtimeConfiguration.providers.main
    || 'unreported';
  try {
  const results = new Array(expanded.length);
  let cursor = 0;
  async function worker() {
    while (cursor < expanded.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await runScenario(expanded[index]);
    }
  }
  await Promise.all(Array.from({ length: MAX_WORKERS }, () => worker()));

  let versions = [];
  try {
    versions = await courseVersionMatrix(expanded);
  } catch (error) {
    runnerErrors.push({ type: 'course_version_compile_failed', message: String(error?.message || error) });
  }

  const journeyInput = await readJourneyResult();
  if (journeyInput.error) {
    runnerErrors.push({ type: 'journey_result_load_failed', message: String(journeyInput.error?.message || journeyInput.error) });
  }
  const journeyValidation = await validateJourneyResults(
    journeyInput.payload,
    journeyScenarios,
    journeyFixtureVersion,
    {
      required: EVAL_PROFILE === 'release',
      evidenceRoots: journeyEvidenceRoots(journeyInput),
      expectedCourseVersions: Object.fromEntries(versions.map((version) => [
        version.courseId,
        version.contentVersion || version.courseVersion,
      ])),
      courseProtectionByCourse: courseProtectedTerms,
      requireCourseProtection: EVAL_PROFILE === 'release',
    },
  );
  const workspace = gitWorkspaceFingerprint(projectRoot, [
    'scripts/ai-dialogue-corpus.mjs',
    'scripts/ai-dialogue-journey-corpus.mjs',
    'scripts/ai-dialogue-evaluator.mjs',
    'scripts/ai-dialogue-runner-core.mjs',
    'scripts/ai-dialogue-artifact.mjs',
    'scripts/run-ai-dialogue-eval.mjs',
    'server/agent/prompt.js',
    'server/agent/student-facing-policy.js',
    'src/engine/turn-plan.js',
    'package.json',
    '../package-lock.json',
  ], [
    'scripts',
    'server',
    'src',
    '../6-lessons',
  ]);
  const reproducibilityIssues = [];
  reproducibilityIssues.push(...repetitionResolution.issues);
  if (modelTag === 'unreported') reproducibilityIssues.push('missing_model_tag');
  if (providerTag === 'unreported') reproducibilityIssues.push('missing_provider_tag');
  if (!runtimeConfiguration.configurationComplete) {
    reproducibilityIssues.push('missing_runtime_configuration_fingerprint');
  }
  if (EVAL_PROFILE === 'release' && !runtimeConfiguration.serverVerified) {
    reproducibilityIssues.push('server_runtime_configuration_unverified');
  }
  if (process.env.AI_DIALOGUE_MODEL_TAG
    && runtimeConfiguration.parameters.OPENAI_MODEL
    && process.env.AI_DIALOGUE_MODEL_TAG !== runtimeConfiguration.parameters.OPENAI_MODEL) {
    reproducibilityIssues.push('model_tag_does_not_match_shared_configuration');
  }
  if (workspace.commit === 'unknown') reproducibilityIssues.push('missing_git_commit');
  if (workspace.sourceFiles.some((file) => file.digest === 'missing')) {
    reproducibilityIssues.push('missing_source_fingerprint');
  }
  if (workspace.sourceTrees.some((tree) => !tree.fileCount)) {
    reproducibilityIssues.push('missing_source_tree_fingerprint');
  }
  if (journeyInput.error) reproducibilityIssues.push('journey_result_unreadable');

  const output = buildRunArtifact({
    meta: {
      runId: RUN_ID,
      generatedAt: new Date().toISOString(),
      apiBase: API_BASE,
      modelTag,
      providerTag,
      runtimeConfiguration,
      workspace,
      nodeVersion: process.version,
      workers: MAX_WORKERS,
      repetitions: REPETITIONS,
      selectedScenarioIds: selected.map((scenario) => scenario.id),
      journeyResultFile: journeyInput.filename,
      versions: {
        dialogueCorpus: dialogueCorpusVersion,
        journeyFixture: journeyFixtureVersion,
        evaluator: EVALUATOR_VERSION,
        runner: LIVE_EVAL_RUNNER_VERSION,
        prompt: AGENT_PROMPT_VERSION,
        studentFacingPolicy: STUDENT_FACING_POLICY_VERSION,
        turnPlan: TURN_PLAN_VERSION,
        courses: versions,
      },
    },
    thresholds,
    results,
    expectedScenarios: dialogueScenarios,
    repetitions: REPETITIONS,
    profile: EVAL_PROFILE,
    journeyValidation,
    reproducibilityIssues,
    runnerErrors,
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${RUN_ID}.json`);
  const summaryPath = path.join(OUTPUT_DIR, 'latest-summary.json');
  const summary = buildSummaryArtifact(output, outputPath);
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  process.stdout.write(`${outputPath}\n`);

  const exitCode = evaluationExitCode({
    fatalIssueCount: output.metrics.dialogueFatalIssueCount + output.metrics.runFatalIssueCount,
    reproducibilityIssues: output.meta.reproducibilityIssues,
    allPassed: output.machinePassed,
  });
  if (exitCode === 2) {
    process.stderr.write(`FATAL: ${[
      ...output.metrics.fatalIssues.map((issue) => `${issue.type}:${issue.scenarioId || ''}`),
      ...output.metrics.runFatalIssues.map((issue) => issue.type),
      ...output.meta.reproducibilityIssues,
    ].join(', ')}\n`);
  } else if (exitCode === 1) {
    process.stderr.write('THRESHOLD_MISS: 自动质量或浏览器旅程门禁未通过。\n');
  }
  process.exitCode = exitCode;
  } finally {
    if (managedApp) await managedApp.close();
  }
}

await main().catch((error) => {
  process.stderr.write(`EVAL_RUNNER_UNARCHIVED_FAILURE: ${String(error?.stack || error)}\n`);
  process.exitCode = 2;
});
