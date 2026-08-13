import { createHash, randomUUID } from 'node:crypto';
import { AGENT_PROMPT_VERSION } from './prompt.js';

export const TURN_TRACE_SCHEMA_VERSION = 3;
export const TURN_TRACE_LIMIT = 100;

function sha256(value = '') {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function eventCounts(events = []) {
  const counts = {};
  for (const event of events) counts[event.type] = Number(counts[event.type] || 0) + 1;
  return counts;
}

export function traceStateSnapshot(session = {}) {
  return {
    phaseId: session.phaseId || '',
    roleId: session.roleId || '',
    taskId: session.taskState?.taskId || '',
    taskIndex: Number(session.currentTaskIndex || 0),
    stepId: session.learningState?.stepId || null,
    stepIndex: Number(session.taskState?.guidanceStepIndex || 0),
    lifecycle: session.dialogueState?.lifecycle || '',
    scaffoldLevel: Number(session.scaffoldLevel || 0),
    scaffoldContextKey: session.scaffoldState?.activeKey || '',
    grade: session.learnerState?.grade || session.grade || '',
    gradeSource: session.gradeSource || '',
    locationStatus: session.locationState?.status || '',
    pendingQuestionKind: session.dialogueState?.pendingQuestion?.kind || '',
    pendingAdvanceMode: session.pendingAdvance?.mode || '',
    completedTaskCount: (session.completedTaskIds || []).length,
    completedStepCount: (session.learningState?.completedStepIds || []).length,
  };
}

export function promptFingerprint(prompt = null) {
  if (!prompt) return '';
  const messages = (prompt.messages || []).map((message) => ({
    role: message.role,
    chars: String(message.content || '').length,
  }));
  // 只指纹化静态指令和消息形状。不对学生原话、历史回复或当轮
  // 输出做无密钥哈希，避免“不会”“不知道”等低熵文本被字典反查。
  return sha256(JSON.stringify({ instructions: String(prompt.instructions || ''), messages }));
}

export function inputTrace(input = {}) {
  const text = input.type === 'user_text'
    ? String(input.text || '')
    : input.type === 'quick_reply'
      ? String(input.value || '')
      : '';
  return {
    type: input.type || '',
    event: input.type === 'lifecycle_event' ? String(input.event || '') : '',
    chars: text.length,
    evidenceCount: Array.isArray(input.result?.evidence) ? input.result.evidence.length : 0,
    imageCount: Array.isArray(input.data?.stepImages) ? input.data.stepImages.length : 0,
  };
}

export function buildTurnTrace({
  requestId,
  startedAt,
  completedAt = Date.now(),
  course,
  input,
  stateBefore,
  stateAfter,
  decision,
  prompt,
  outputPath,
  outputText = '',
  events = [],
  policyVersion,
  policyActions = [],
  degraded = false,
  streamed = false,
  status = '',
  errorCode = '',
  turnPlan = null,
  teacherCommand = null,
} = {}) {
  const toolNames = events
    .filter((event) => event.type === 'tool.requested')
    .map((event) => event.data?.name)
    .filter(Boolean);
  const parts = events.filter((event) => event.type === 'assistant.completed');
  return {
    schemaVersion: TURN_TRACE_SCHEMA_VERSION,
    traceId: `tr_${randomUUID().replaceAll('-', '')}`,
    // requestId 由客户端生成，可能误带姓名、手机号等个人信息。
    // trace 只留不可直接展示原值的关联摘要。
    requestIdDigest: requestId ? sha256(`turn-request:${String(requestId)}`) : '',
    teacherCommand: teacherCommand?.teacherCommandId ? {
      teacherCommandId: String(teacherCommand.teacherCommandId),
      action: String(teacherCommand.action || ''),
    } : null,
    status: ['completed', 'degraded', 'failed'].includes(status)
      ? status
      : (degraded ? 'degraded' : 'completed'),
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    elapsedMs: Math.max(0, completedAt - startedAt),
    courseId: course?.id || '',
    versions: {
      courseVersion: course?.courseVersion || '',
      contentVersion: course?.contentVersion || '',
      platformRulesVersion: course?.platformRules?.version || '',
      platformDefaultsVersion: course?.platformDefaults?.version || '',
      promptBuilderVersion: AGENT_PROMPT_VERSION,
      promptHash: promptFingerprint(prompt),
      studentFacingPolicyVersion: policyVersion || '',
    },
    input: inputTrace(input),
    stateBefore,
    decision: {
      source: decision?.decisionSource || '',
      intent: decision?.intent || '',
      tutorAction: decision?.tutorAction || '',
      signal: decision?.signal || '',
      sourceMode: decision?.sourceMode || '',
      silent: Boolean(decision?.silent),
      fastWorkflow: Boolean(decision?.fastWorkflow),
      fastGuidance: Boolean(decision?.fastGuidance),
      needsKnowledge: Boolean(decision?.needsKnowledge),
      allowedTools: [...(decision?.allowedTools || [])],
    },
    output: {
      path: outputPath || '',
      chars: String(outputText || '').length,
      fingerprintMode: 'omitted_low_entropy_text',
      partCount: parts.length,
      toolNames,
      eventTypeCounts: eventCounts(events),
      streamed: Boolean(streamed),
      degraded: Boolean(degraded),
      errorCode: String(errorCode || ''),
      policyActions: [...new Set(policyActions)].sort(),
      turnPlan: turnPlan ? {
        version: turnPlan.version || '',
        primaryActionKind: turnPlan.primaryAction?.kind || 'none',
        primaryActionName: turnPlan.primaryAction?.name || '',
        nextActionKind: turnPlan.nextAction?.kind || 'continue_dialogue',
        nextActionName: turnPlan.nextAction?.name || '',
        toolName: turnPlan.tool?.name || '',
        quickReplyCount: Number(turnPlan.quickReplies?.count || 0),
        safetyActionKind: turnPlan.safetyAction?.kind || 'none',
        safetyActionRequired: Boolean(turnPlan.safetyAction?.required),
        stateChanges: (turnPlan.stateChanges || []).map((change) => ({
          field: String(change.field || ''),
          from: change.from ?? null,
          to: change.to ?? null,
        })),
        sourceMode: turnPlan.source?.mode || '',
        sourceCitationCount: Number(turnPlan.source?.citationCount || 0),
        rhythm: (turnPlan.rhythm || []).map((item) => ({
          sequence: Number(item.sequence || 0),
          kind: String(item.kind || ''),
          delayMs: Number(item.delayMs || 0),
        })),
        visibleCount: Number(turnPlan.visibleCount || 0),
        issues: [...(turnPlan.issues || [])],
      } : null,
    },
    stateAfter,
  };
}

export function appendTurnTrace(session, trace, limit = TURN_TRACE_LIMIT) {
  session.turnTraces ||= [];
  session.turnTraces.push(trace);
  session.turnTraces = session.turnTraces.slice(-Math.max(1, Number(limit) || TURN_TRACE_LIMIT));
  return trace;
}
