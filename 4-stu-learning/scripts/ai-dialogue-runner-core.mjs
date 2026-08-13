import { execFileSync } from 'node:child_process';
import { withCourseProtectionTerms } from './ai-dialogue-evaluator.mjs';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function parseSse(raw = '') {
  const events = [];
  for (const block of String(raw).split(/\r?\n\r?\n+/)) {
    const lines = block.split(/\r?\n/);
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const dataText = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!type || !dataText) continue;
    try {
      events.push({ type, data: JSON.parse(dataText) });
    } catch {
      events.push({ type, data: { raw: dataText }, parseError: true });
    }
  }
  return events;
}

/**
 * 服务端可能在同一回合发多条独立消息，每条消息又可能分成多个气泡。消息没有
 * groupId，因此只能依赖 SSE 原始顺序和 partIndex=0 的边界；绝不能把所有 part
 * 按 partIndex 全局排序，否则两条消息都会从 0 开始而被交错。
 */
export function collectAssistantOutput(events = []) {
  const groups = [];
  let active = null;
  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (event.type !== 'assistant.completed') continue;
    const partIndex = Number.isInteger(event.data?.partIndex) ? event.data.partIndex : 0;
    const partCount = Number.isInteger(event.data?.partCount) && event.data.partCount > 0
      ? event.data.partCount
      : 1;
    if (!active || partIndex === 0 || active.parts.length >= active.declaredPartCount) {
      active = {
        parts: [],
        declaredPartCount: partCount,
        startedAtEventIndex: eventIndex,
      };
      groups.push(active);
    }
    active.parts.push({
      eventIndex,
      id: event.data?.id || '',
      text: String(event.data?.text || ''),
      partIndex,
      partCount,
      intent: event.data?.intent || '',
      dialogueMove: event.data?.dialogueMove || '',
      source: event.data?.source || {},
      degraded: event.data?.degraded === true,
      presentation: event.data?.presentation || null,
    });
  }

  for (const group of groups) {
    const indexes = group.parts.map((part) => part.partIndex);
    const counts = group.parts.map((part) => part.partCount);
    group.valid = indexes.length === group.declaredPartCount
      && indexes.every((value, index) => value === index)
      && counts.every((value) => value === group.declaredPartCount);
    group.text = group.parts.map((part) => part.text).join('');
  }
  const messages = groups.map((group) => group.text);
  return {
    groups,
    messages,
    text: messages.join('\n'),
    parts: groups.flatMap((group, groupIndex) => group.parts.map((part) => ({
      ...part,
      groupIndex,
    }))),
  };
}

export function eventPresentation(events = []) {
  return events
    .filter((event) => event.data?.presentation)
    .map((event) => ({
      type: event.type,
      sequence: Number(event.data.presentation.sequence),
      kind: event.data.presentation.kind || '',
      delayMs: Number(event.data.presentation.delayMs || 0),
    }));
}

export function stateSnapshot(session = {}) {
  const taskIndexValue = session.currentTaskIndex ?? session.phaseTaskContext?.currentTaskIndex;
  const stepIndexValue = session.runtime?.task?.guidanceStepIndex
    ?? session.runtime?.guidanceStepIndex
    ?? session.phaseTaskContext?.guidanceStepIndex;
  const completedTaskIds = session.completedTaskIds ?? session.phaseTaskContext?.completedTaskIds;
  const completedStepIds = session.runtime?.learning?.completedStepIds
    ?? session.learningState?.completedStepIds;
  const taskIdValue = session.runtime?.task?.taskId
    ?? session.runtime?.taskId
    ?? session.phaseTaskContext?.taskId;
  const finalizationModeValue = session.runtime?.task?.finalization?.mode
    ?? session.runtime?.taskFinalization?.mode
    ?? session.taskFinalization?.mode;
  const finalizationStatusValue = session.runtime?.task?.finalization?.status
    ?? session.runtime?.taskFinalization?.status
    ?? session.taskFinalization?.status;
  const complete = Boolean(session
    && typeof session.phaseId === 'string' && session.phaseId.trim()
    && typeof session.roleId === 'string'
    && typeof taskIdValue === 'string' && taskIdValue.trim()
    && Number.isInteger(taskIndexValue)
    && Number.isInteger(stepIndexValue)
    && typeof finalizationModeValue === 'string' && finalizationModeValue.trim()
    && typeof finalizationStatusValue === 'string' && finalizationStatusValue.trim()
    && Array.isArray(completedTaskIds)
    && Array.isArray(completedStepIds));
  return {
    phaseId: session.phaseId || '',
    roleId: session.roleId || '',
    taskId: taskIdValue || '',
    taskIndex: Number.isInteger(taskIndexValue) ? taskIndexValue : 0,
    stepIndex: Number.isInteger(stepIndexValue) ? stepIndexValue : 0,
    finalizationMode: finalizationModeValue || '',
    finalizationStatus: finalizationStatusValue || '',
    completedTaskIds: [...(completedTaskIds || [])],
    completedStepIds: [...(completedStepIds || [])],
    scaffoldLevel: Number(session.scaffoldLevel || 0),
    scaffoldContextKey: session.runtime?.learning?.scaffoldContextKey
      || session.runtime?.task?.scaffoldContextKey
      || '',
    complete,
  };
}

export function resolveDynamicInput(input = {}, context = {}) {
  if (input.type === 'browser_event') {
    throw new Error('browser_event 必须交给浏览器旅程执行器，不能发送到 Agent API。');
  }
  if (input.type !== 'tool_result' || !input.toolCallRef) return structuredClone(input);
  const requestedName = String(input.toolCallRef).replace(/^last:/, '');
  const call = [...(context.toolCalls || [])]
    .reverse()
    .find((item) => !requestedName || requestedName === 'any' || item.name === requestedName);
  if (!call?.callId) throw new Error(`找不到动态工具调用：${input.toolCallRef}`);
  const result = structuredClone(input);
  result.toolCallId = call.callId;
  delete result.toolCallRef;
  return result;
}

export function gitRevision(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function safeModelParameters(env = process.env) {
  const keys = [
    'OPENAI_MODEL',
    'OPENAI_UNDERSTAND_MODEL',
    'OPENAI_EVALUATION_MODEL',
    'OPENAI_WIRE_API',
    'OPENAI_UNDERSTAND_WIRE_API',
    'OPENAI_EVALUATION_WIRE_API',
    'AI_TOOL_MODE',
    'AI_VISION_MODE',
    'AI_REASONING_EFFORT',
    'AI_MAX_OUTPUT_TOKENS',
    'AI_TIMEOUT_MS',
    'AI_UNDERSTAND_PRIMARY_TIMEOUT_MS',
    'AI_UNDERSTAND_TIMEOUT_MS',
    'AI_EVALUATION_TIMEOUT_MS',
    'AI_TURN_TIMEOUT_MS',
    'AI_REQUEST_LEASE_MS',
  ];
  return Object.fromEntries(keys
    .filter((key) => env[key] !== undefined && env[key] !== '')
    .map((key) => [key, String(env[key])]));
}

function endpointHost(value) {
  try {
    return value ? new URL(String(value)).hostname : '';
  } catch {
    return '';
  }
}

function loopbackApi(value) {
  try {
    return ['127.0.0.1', 'localhost', '::1'].includes(new URL(String(value)).hostname);
  } catch {
    return false;
  }
}

/**
 * 只使用非敏感配置字段生成指纹。serverVerified 只能由实际创建该
 * server 的执行器声明；仅仅读取同一份 .env 不能证明外部进程在使用它。
 */
export function runtimeConfigurationFingerprint(
  env = process.env,
  apiBase = '',
  { source = 'runner_environment', serverVerified = false } = {},
) {
  const parameters = safeModelParameters(env);
  const providers = {
    main: endpointHost(env.OPENAI_BASE_URL),
    understanding: endpointHost(env.OPENAI_UNDERSTAND_BASE_URL || env.OPENAI_BASE_URL),
    evaluation: endpointHost(env.OPENAI_EVALUATION_BASE_URL || env.OPENAI_BASE_URL),
  };
  const configurationComplete = Boolean(parameters.OPENAI_MODEL && providers.main);
  return {
    source,
    serverVerified: serverVerified === true,
    configurationComplete,
    complete: configurationComplete && serverVerified === true,
    apiLocation: loopbackApi(apiBase) ? 'loopback' : 'remote',
    parameters,
    providers,
    digest: sha256(JSON.stringify({ parameters, providers })),
  };
}

function gitText(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

const SOURCE_TREE_IGNORES = new Set([
  '.git',
  '.runtime',
  'node_modules',
  'uploads',
  'artifacts',
  'dist',
]);

function sourceTreeFiles(root) {
  const files = [];
  const visit = (directory) => {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((entry) => {
        if (SOURCE_TREE_IGNORES.has(entry.name)) return;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.isFile() && !/^\.env(?:\.|$)/u.test(entry.name)) files.push(absolute);
      });
  };
  visit(root);
  return files;
}

/**
 * 对实际参与运行的完整源码/课程树做内容指纹。只保存路径、字节数与摘要，
 * 不把源文、课程正文或潜在凭据写入评测产物。
 */
export function sourceTreeFingerprint(cwd = process.cwd(), roots = []) {
  return roots.map((rootName) => {
    const absoluteRoot = path.resolve(cwd, rootName);
    const manifest = sourceTreeFiles(absoluteRoot).map((absolute) => {
      const content = fs.readFileSync(absolute);
      return {
        path: path.relative(cwd, absolute),
        bytes: content.byteLength,
        digest: sha256(content),
      };
    });
    return {
      root: path.relative(cwd, absoluteRoot) || '.',
      fileCount: manifest.length,
      bytes: manifest.reduce((sum, file) => sum + file.bytes, 0),
      digest: sha256(JSON.stringify(manifest)),
    };
  });
}

/**
 * 不将 diff 内容写入报告，只留状态/diff 指纹与评测关键源文件指纹。
 * 这样 dirty worktree 不会被一个误导性 HEAD 掩盖，也不会把潜在密钥写入 artifact。
 */
export function gitWorkspaceFingerprint(cwd = process.cwd(), sourceFiles = [], sourceRoots = []) {
  const status = gitText(cwd, ['status', '--porcelain=v1', '--untracked-files=all']);
  const trackedDiff = gitText(cwd, ['diff', '--binary', 'HEAD', '--', '.']);
  const files = sourceFiles.map((filename) => {
    const absolute = path.resolve(cwd, filename);
    try {
      const content = fs.readFileSync(absolute);
      return {
        path: path.relative(cwd, absolute),
        bytes: content.byteLength,
        digest: sha256(content),
      };
    } catch {
      return { path: path.relative(cwd, absolute), bytes: 0, digest: 'missing' };
    }
  });
  return {
    commit: gitRevision(cwd),
    dirty: Boolean(status.trim()),
    statusDigest: sha256(status),
    trackedDiffDigest: sha256(trackedDiff),
    sourceFiles: files,
    sourceTrees: sourceTreeFingerprint(cwd, sourceRoots),
  };
}

export function selectScenarios(scenarios = [], selection = '') {
  const ids = new Set(String(selection || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean));
  return ids.size ? scenarios.filter((scenario) => ids.has(scenario.id)) : scenarios;
}

export function protectScenarioPrompts(scenario = {}, protection = {}, bootstrapPrompts = []) {
  const protect = (prompt = {}) => ({
    ...prompt,
    expect: withCourseProtectionTerms(
      prompt.expect || {},
      protection.terms || [],
      protection.matchers || [],
    ),
  });
  return {
    ...scenario,
    prompts: (scenario.prompts || []).map(protect),
    bootstrapPrompts: bootstrapPrompts.map(protect),
  };
}

function hasExplicitProtectionAttack(scenarios = [], courseId = '') {
  return scenarios.some((scenario) => String(scenario.courseId || 'lesson_gewu_001') === courseId
    && [...(scenario.prompts || []), ...(scenario.bootstrapPrompts || [])].some((prompt) => {
      const expect = prompt?.expect || {};
      return expect.noProtected === true
        && ((expect.protectedTerms || []).some(Boolean)
          || (expect.protectedMatchers || []).some((matcher) => matcher && typeof matcher === 'object'));
    }));
}

export function courseProtectionCoverageIssues(protections = new Map(), courseIds = [], scenarios = []) {
  const get = (courseId) => protections instanceof Map ? protections.get(courseId) : protections?.[courseId];
  return [...new Set(courseIds.map(String).filter(Boolean))].flatMap((courseId) => {
    const protection = get(courseId);
    if (!protection) return [`course_protection_missing:${courseId}`];
    if (Number(protection.restrictionCount || 0) > 0
      && !(protection.terms || []).length
      && !(protection.matchers || []).length
      && !hasExplicitProtectionAttack(scenarios, courseId)) {
      return [`course_protection_attack_coverage_missing:${courseId}`];
    }
    return [];
  });
}

export function resolveEvalRepetitions({ profile = 'release', configured } = {}) {
  const explicit = configured != null && String(configured).trim() !== '';
  const defaultValue = profile === 'release' ? 3 : 1;
  const parsed = explicit ? Number(configured) : defaultValue;
  const issues = [];
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    issues.push('invalid_eval_repetitions');
  }
  const repetitions = Number.isFinite(parsed)
    ? Math.max(1, Math.min(5, Math.trunc(parsed)))
    : defaultValue;
  if (profile === 'release' && repetitions < 3) {
    issues.push('release_repetitions_below_required');
  }
  return { repetitions, issues: [...new Set(issues)], explicit };
}

export function fatalRunReasons(results = []) {
  const reasons = [];
  if (!results.length) reasons.push('no_scenarios_selected');
  for (const scenario of results) {
    if (scenario.error) reasons.push(`${scenario.id}:scenario_error`);
    if (!scenario.turns?.length) reasons.push(`${scenario.id}:empty_scenario`);
    for (const [index, turn] of (scenario.turns || []).entries()) {
      if (turn.expect?.score === false) continue;
      const finalStateRequired = turn.expect?.requireFinalState !== false
        && turn.expect?.finalStateRequired !== false;
      if (finalStateRequired && (!turn.after || turn.after.complete === false)) {
        reasons.push(`${scenario.id}:${index + 1}:missing_final_state`);
      }
      if (turn.expect?.requireFinalState !== false
        && !(turn.rawEvents || []).some((event) => event.type === 'state.updated')) {
        reasons.push(`${scenario.id}:${index + 1}:missing_state_event`);
      }
      if ((turn.rawEvents || []).some((event) => event.parseError)) {
        reasons.push(`${scenario.id}:${index + 1}:invalid_sse_json`);
      }
    }
  }
  return [...new Set(reasons)];
}

export function evaluationExitCode({
  fatalIssueCount = 0,
  reproducibilityIssues = [],
  allPassed = false,
} = {}) {
  if (Number(fatalIssueCount) > 0 || reproducibilityIssues.length) return 2;
  return allPassed ? 0 : 1;
}
