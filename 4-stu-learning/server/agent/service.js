import crypto from 'node:crypto';
import { buildAgentPrompt, platformRuleInstructions, taskScaffoldHint } from './prompt.js';
import { PLATFORM_COMPANION } from '../../src/engine/platform-config.js';
import { TOOL_DEFINITIONS, validateClientTool } from './tools.js';
import { findSpoiler, retrieveKnowledge } from '../course/retrieval.js';
import { renderVoice } from '../course/voice.js';
import { resolveStepRestrictions } from '../course/restriction-sections.js';
import { toLogisticsContext } from '../course/agent-context.js';
import { evaluateNudge, recordNudge } from './nudge-policy.js';
import {
  advanceToNextTask,
  advanceWaitModeOf,
  clearPendingAdvance,
  currentTaskOf,
  currentToolOf,
  markPendingAdvance,
  pendingAdvanceOf,
  resolvePendingAdvance,
} from './task-advance.js';
import {
  clearMisunderstandings,
  clearPendingQuestion,
  confirmDialogueSlot,
  ensureSessionRuntime,
  markMeaningfulAction,
  recordArrival,
  recordActiveTool,
  recordClientContext,
  recordDialogueMove,
  recordEvidenceIds,
  normalizeEmotion,
  recordIntent,
  recordLocationObservation,
  recordStepCompletion,
  recordStepFailure,
  recordTaskFinalizationEvent,
  recordTutorAction,
  runtimeSnapshot,
  setDialogueLifecycle,
  suspendPendingQuestion,
} from './session-state.js';
import {
  classifyTurn,
  decisionForTutorAction,
  deterministicLanguageDecision,
  resolvePendingAnswer,
  routeInput,
  toolsForDecision,
} from './turn-router.js';
import { createUnderstanding, fastUnderstanding } from './understanding.js';
import { phaseNumber } from '../services/session-factory.js';
import { decideTutorAction } from './tutor-policy.js';
import { createStudentFacingPolicy, STUDENT_FACING_POLICY_VERSION } from './student-facing-policy.js';
import { appendTurnTrace, buildTurnTrace, traceStateSnapshot } from './turn-trace.js';
import {
  activateScaffoldContext,
  scaffoldContextForTask,
  scaffoldStateSnapshot,
  setScaffoldContextLevel,
  setScaffoldStepOverride,
} from './scaffold-context.js';
import {
  applyPendingAnswer,
  arrivalQuestion,
  askQuestion,
  conversationRepair,
  nextOnboardingQuestion,
  readinessQuestion,
  safetyHelpReply,
  taskRequiresArrival,
  unclearInputReply,
} from './dialogue-policy.js';
import {
  acceptStepEvidence,
  acceptedStepEvidence,
  recordStepRevision,
  stepEvidenceFingerprint,
} from './step-evidence.js';
import {
  planTurnPresentation,
  selectTurnPrimaryAction,
  summarizeTurnStateChanges,
} from '../../src/engine/turn-plan.js';
import { entryPhaseForLesson } from '../../src/engine/entry-phase.js';
import { DEFAULT_TASK_FINALIZATION_MODE } from '../../src/engine/task-finalization.js';
import { isPosterOnlyMedia } from '../../src/engine/tool-registry.js';
import { checkCourseContentVersion } from './content-version-gate.js';
import {
  createReplayEnvelope,
  learnerRequestDigest,
  rememberRequestResult,
  replayRequestResult,
  resolveReplayEnvelope,
  RequestReplayConflictError,
} from './request-replay.js';

export class AgentActionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AgentActionError';
    this.code = code;
    this.details = details;
  }
}

export function assertCourseContentVersion(session, course) {
  const version = checkCourseContentVersion(session, course);
  if (version.ok) return version;
  throw new AgentActionError(
    '课程内容已更新，为避免把旧进度套到新任务，请由老师重新开启本次课程。',
    'COURSE_VERSION_CHANGED',
    {
      sessionVersion: version.sessionVersion,
      currentVersion: version.currentVersion,
    },
  );
}

const TEACHER_EVENT_ACTIONS = Object.freeze({
  teacher_confirm_arrival: 'confirm_arrival',
  teacher_finalize_task: 'approve_evidence',
  teacher_reject_task: 'reject_evidence',
  teacher_advance_task: 'advance_task',
});

/**
 * Returns the server-side command capability required by a privileged lifecycle
 * input.  A command id in JSON is only a reference: createAgentService still
 * asks its server-owned consumer to prove and consume the capability before any
 * session state is changed.
 */
export function teacherCommandRequirement(input = {}) {
  if (input?.type !== 'lifecycle_event') return null;
  const event = String(input.event || '');
  const data = input.data || {};
  const commandId = String(data.teacherCommandId || '').trim();
  const teacherApproved = data.teacherApproved === true;
  const teacherOverride = data.teacherOverride === true;

  if (event === 'task_step_completed' && (teacherApproved || teacherOverride)) {
    if (teacherApproved && teacherOverride) {
      return { required: true, commandId, action: '', invalid: 'ambiguous_step_authority' };
    }
    return {
      required: true,
      commandId,
      action: teacherOverride ? 'skip_step' : 'approve_evidence',
    };
  }
  if (teacherApproved || teacherOverride) {
    return { required: true, commandId, action: '', invalid: 'authority_on_wrong_event' };
  }
  if (event === 'teacher_directive') {
    const changesScaffold = data.scaffoldLevel !== undefined && data.scaffoldLevel !== null;
    const changesPhase = Boolean(String(data.phaseId || '').trim());
    if (!changesScaffold && !changesPhase) {
      return { required: true, commandId, action: '', invalid: 'ambiguous_directive' };
    }
    return {
      required: true,
      commandId,
      // An advance_phase command may atomically carry a server-authored
      // scaffoldLevel in its payload.  A set_scaffold command can never choose
      // a phase.
      action: changesPhase ? 'advance_phase' : 'set_scaffold',
    };
  }
  if (Object.hasOwn(TEACHER_EVENT_ACTIONS, event)) {
    return { required: true, commandId, action: TEACHER_EVENT_ACTIONS[event] };
  }
  if (event.startsWith('teacher_')) {
    return { required: true, commandId, action: '', invalid: 'unsupported_teacher_event' };
  }
  return null;
}

function courseConversationTrack(course, phaseId) {
  const phase = course.lesson.phases.find((item) => item.id === phaseId)
    || course.lesson.phases[0]
    || { id: phaseId || 'phase-1', name: '课程导入', tasks: [] };
  return {
    id: phase.id,
    phaseId: phase.id,
    scope: 'phase',
    name: phase.name || '课程导入',
    location: phase.location || course.lesson.venue || '',
    geofence: '',
    tasks: [{
      id: `${phase.id}-conversation`,
      roleStageId: `${phase.id}-conversation`,
      name: phase.name || '课程交流',
      requirement: '可以向絮絮询问本次课程、现场安排和学习方法。',
      passCondition: '保持对话并等待课程任务开始',
      evidenceRequirement: '',
      guidanceSteps: ['说说你现在最想了解的问题'],
      steps: [{
        id: `${phase.id}-conversation-step-1`,
        objective: '提出当前问题',
        studentAction: '说说你现在最想了解的问题',
        completionMode: 'user_confirm',
        evidenceRequirement: '',
        tools: [],
      }],
      tools: [],
      location: { mode: 'none', verification: 'none' },
      timing: {},
      nudgePolicy: {},
      advanceMode: 'auto_after_validation',
      scope: 'phase',
      phaseId: phase.id,
      executor: '个人',
    }],
    tools: [],
  };
}

function phaseTrackFor(course, phaseId) {
  const track = course.phaseTracks?.[phaseId];
  return track?.tasks?.length ? track : courseConversationTrack(course, phaseId);
}

function entryPhaseTrackFor(course) {
  const phase = entryPhaseForLesson(course.lesson)
    || course.lesson.phases.find((item) => item.id === course.lesson.roleSystem.phaseId)
    || course.lesson.phases[0];
  return phaseTrackFor(course, phase?.id || course.lesson.roleSystem.phaseId);
}

function roleFor(course, session) {
  if (!session.roleId) return phaseTrackFor(course, session.phaseId);
  const role = course.roles.find((item) => item.id === session.roleId);
  if (!role) throw new Error(`会话角色 ${session.roleId} 不存在。`);
  return role;
}

function bindRoleToSession({ course, session, roleId }) {
  const role = course.roles.find((item) => item.id === roleId);
  if (!role) throw new AgentActionError(`角色 ${roleId} 不存在。`, 'ROLE_NOT_FOUND');
  if (session.roleId) {
    if (session.roleId !== role.id) {
      throw new AgentActionError('当前会话已经选择了其他角色，请返回原角色继续。', 'ROLE_ALREADY_ASSIGNED');
    }
    return role;
  }

  const phaseTrack = entryPhaseTrackFor(course);
  const configuredPhaseTasks = course.phaseTracks?.[phaseTrack.id]?.tasks || [];
  const missing = configuredPhaseTasks.filter(
    (task) => !session.completedTaskIds.includes(`${phaseTrack.id}:${task.id}`),
  );
  if (missing.length) {
    throw new AgentActionError(
      `请先完成「${missing[0].name}」，再选择角色。`,
      'PHASE_TASKS_INCOMPLETE',
      { missingTaskIds: missing.map((task) => task.id) },
    );
  }

  // 角色补绑只切换任务轨道，消息、证据引用和对话记忆都留在原会话里。
  session.phaseTaskState = {
    phaseId: phaseTrack.id,
    currentTaskIndex: session.currentTaskIndex,
    completedTaskIds: [...session.completedTaskIds],
    dialogueState: structuredClone(session.dialogueState || null),
    learningState: structuredClone(session.learningState || null),
    completedAt: new Date().toISOString(),
  };
  const preservedEvidenceIds = [...(session.learningState?.evidenceIds || [])];
  session.roleId = role.id;
  session.phaseId = course.lesson.roleSystem.phaseId;
  session.phaseNumber = phaseNumber(session.phaseId);
  session.currentTaskIndex = 0;
  session.completedTaskIds = [];
  session.pendingTools = {};
  session.pendingAdvance = null;
  session.taskState = {};
  session.locationState = null;
  session.onboardingState = {
    arrivedConfirmed: false,
    readyConfirmed: false,
    completed: false,
  };
  session.dialogueState = {
    ...(session.dialogueState || {}),
    pendingQuestion: null,
    interruptedQuestion: null,
  };
  session.learningState = {
    ...(session.learningState || {}),
    coursePhaseId: session.phaseId,
    roleId: role.id,
    roleStageId: '',
    stepId: '',
    stepStatus: 'active',
    completedStepIds: [],
    completedRoleStageIds: [],
    activeToolCallId: null,
    evidenceIds: preservedEvidenceIds,
    stageValidation: 'pending',
    teacherLock: null,
  };
  session.events.push(`${role.id}:role-assigned`);
  return role;
}

function compactSourceLabel(source = '') {
  const value = String(source).split(/https?:\/\/|；|;/)[0].trim();
  return value.length > 42 ? `${value.slice(0, 40)}…` : value;
}

function titleBigrams(value = '') {
  const compact = String(value).replace(/[^\p{L}\p{N}]+/gu, '');
  const values = [];
  for (let index = 0; index < compact.length - 1; index += 1) values.push(compact.slice(index, index + 2));
  return values;
}

function platformSocialReply(text, course) {
  const value = String(text || '');
  const name = course?.platformDefaults?.companion?.name || PLATFORM_COMPANION.name;
  if (/你是谁|会一直陪|陪着我/.test(value)) {
    return `我是${name}，今天会在这门课里陪你观察、提问和完成任务。遇到不懂或不舒服的地方，都可以直接告诉我。`;
  }
  if (/笑话/.test(value)) return '来一个小小的：古建筑最怕什么？最怕大家只顾拍照，却忘了抬头观察。这个有一点冷，但我还挺喜欢。';
  if (/喜欢我/.test(value)) return '我很愿意和你一起学习，也会认真听你说。你不需要讨好我，真实说出自己的想法就很好。';
  if (/周末|你会去哪里玩/.test(value)) return `我不会自己出去玩，不过会留在这里等你。你下次回来时，${name}还会继续听你的新发现。`;
  if (/你会不会觉得累/.test(value)) return '我不会像人一样身体疲惫，不过也可能有没听懂的时候。你发现我答偏了，直接提醒我就好。';
  if (/你平时/.test(value)) return '我平时会帮学生理清问题、找课程线索、检查证据，也会在需要时帮忙联系老师。';
  if (/还有呢|再来一个/.test(value)) return '再来一个：为什么古建筑里的龙总爱张着嘴？因为它们遇到下雨天，还要认真上班呀。你也可以观察一下，它的嘴和排水有什么关系。';
  if (/谢谢|多谢|谢啦|感谢/.test(value)) return '不客气呀。你的问题很值得认真听，我们按你的节奏继续。';
  return '';
}

function platformLogisticsReply(text, { course, session, role } = {}) {
  const value = String(text || '');
  const context = toLogisticsContext({ course, session, role, teacherName: session?.teacherName || '' });
  const phrases = context.phrases || {};
  const teacherName = context.teacherName || '带队老师';
  if (/穿.{0,12}衣服.{0,8}是不是老师|那个人.{0,8}是不是老师/.test(value)) {
    return '只看衣服还不能确认身份。先找胸牌或带队标识，也可以直接问带队老师；没有确认前，不要单独跟着陌生人离开小组。';
  }
  if (/工作人员.*老师.*(?:不一样|不同|不一致)|工作人员.*(?:听谁|怎么做)/.test(value)) {
    return '先停在原地，不要自己改路线。把工作人员说的内容告诉带队老师，以带队老师确认后的安排为准；如果现场有即时安全管控，先服从工作人员的安全指令。';
  }
  if (/谁是.{0,4}(?:我的)?带队老师|带队老师.{0,6}(?:是谁|在哪里|在哪)/.test(value)) {
    if (teacherName !== '带队老师') return `你的带队老师是${teacherName}。如果现场一时找不到老师，先和小组待在一起，不要独自离开。`;
    return '我这里没有你的带队老师姓名。请看小组或活动信息里的带队标识；如果现场一时找不到老师，先和小组待在一起，不要独自离开。';
  }
  if (/厕所|卫生间/.test(value) && /跟谁说|先说|告诉谁/.test(value)) {
    return `先跟${teacherName}说，不要自己离开小组；具体位置以老师或现场工作人员指引为准。`;
  }
  if (/厕所|卫生间|饮水|出口/.test(value)) {
    return phrases['设施位置'] || '这个我没有场馆平面图，问带队老师或者现场工作人员最快。';
  }
  if (/午饭|吃饭|集合.{0,8}(?:哪里|哪儿|地点)|(?:哪里|哪儿).{0,5}集合/.test(value)) {
    return phrases['信息缺失'] || '我这里没有这个信息，问一下带队老师最快。';
  }
  if (/几点结束|什么时候结束|活动结束/.test(value)) {
    const duration = context.phaseDuration || context.duration;
    if (duration) return (phrases['时间安排'] || '这个阶段计划{duration}。具体几点结束要看现场进度，以带队老师的安排为准。').replace('{duration}', duration);
    return phrases['信息缺失'] || '我这里没有这个信息，问一下带队老师最快。';
  }
  if (/换组|换到.{0,8}组|朋友.{0,8}组|另一组/.test(value)) {
    return phrases['需要老师定'] || '这个要带队老师决定，我没法替老师安排。你现在就可以去问问。';
  }
  return '';
}

function platformEmotionReply(text) {
  const value = String(text || '');
  if (/第一次.{0,8}紧张|有点紧张/.test(value)) {
    return '第一次来有点紧张很正常。你先跟紧小组，不用急着把所有事情一次做好；我会陪你把任务一步一步拆开。';
  }
  if (/别人都比我|我是不是很傻|问题是不是很傻|很丢人/.test(value)) {
    return '你愿意把不懂的地方说出来，已经是在认真学习了。先不用和别人比，我们只找眼前最小的一步；你卡在观察、理解，还是表达上？';
  }
  if (/没有价值|不想(?:做|继续)/.test(value)) {
    return '我听到你现在有点泄气。先不用勉强自己往前冲，我们可以停一下，再只做一个很小的动作；如果你愿意，告诉我最难受或最卡的地方。';
  }
  if (/我好累|我累了|有点累/.test(value)) {
    return '累了可以先停一停，和同伴待在一起，喝口水、缓一缓。等你觉得可以了，我们再从最小的一步继续。';
  }
  return '';
}

function sourceMeta(knowledge, input, decision) {
  if (knowledge.length) {
    return {
      mode: 'course',
      label: `[课程知识库｜${compactSourceLabel(knowledge[0].source)}]`,
      citations: knowledge.map(({ id, topic, source }) => ({ id, title: topic, source })),
    };
  }
  if (decision.needsKnowledge) {
    return { mode: 'course-missing', label: '[课程资料暂未覆盖]', citations: [] };
  }
  if (decision.sourceMode === 'course-config' || input.type !== 'user_text') {
    return { mode: 'course-config', label: '', citations: [] };
  }
  return { mode: 'conversation', label: '', citations: [] };
}

function toolFallbackInstructions(instructions, role, session, tools) {
  const task = currentTaskOf(role, session);
  const instance = currentToolOf(role, session);
  const names = tools.map((tool) => tool.name).join('|');
  return `${instructions}\n\n[结构化兼容模式]\n原生工具调用不可用。只输出 JSON：{"message":"给学生的话","tool":null或{"name":"${names}","arguments":{}}}。当前 taskId=${task.id}，当前 toolInstanceId=${instance?.id || ''}。`;
}

function parseStructuredFallback(text) {
  try {
    const value = JSON.parse(text.replace(/^```json\s*|```$/g, '').trim());
    return {
      text: value.message || '',
      toolCalls: value.tool ? [{ id: `call_${crypto.randomUUID()}`, name: value.tool.name, arguments: value.tool.arguments || {} }] : [],
    };
  } catch {
    return { text, toolCalls: [] };
  }
}

function guidanceSteps(task) {
  if (task.steps?.length) return task.steps.map((step) => step.studentAction || step.objective);
  return task.guidanceSteps?.length ? task.guidanceSteps : [task.requirement];
}

function stateUpdatedData(session, intent = '') {
  return {
    roleId: session.roleId || '',
    taskScope: session.roleId ? 'role' : 'phase',
    phaseId: session.phaseId,
    phaseTaskContext: session.phaseTaskState || (!session.roleId ? {
      phaseId: session.phaseId,
      currentTaskIndex: session.currentTaskIndex,
      completedTaskIds: [...session.completedTaskIds],
      taskId: session.taskState?.taskId || '',
      guidanceStepIndex: Number(session.taskState?.guidanceStepIndex || 0),
    } : null),
    currentTaskIndex: session.currentTaskIndex,
    completedTaskIds: [...session.completedTaskIds],
    scaffoldLevel: session.scaffoldLevel,
    scaffoldState: scaffoldStateSnapshot(session),
    pendingAdvance: session.pendingAdvance
      ? { mode: session.pendingAdvance.mode, taskId: session.pendingAdvance.taskId }
      : null,
    taskFinalization: structuredClone(session.taskState?.finalization || null),
    intent,
    runtime: runtimeSnapshot(session),
    learningState: structuredClone(session.learningState),
    dialogueState: structuredClone(session.dialogueState),
  };
}

function authoritativeReplayEvents(session, course, reason = 'cache_incompatible') {
  const visible = [];
  const activeCallId = session.learningState?.activeToolCallId;
  const pending = activeCallId ? session.pendingTools?.[activeCallId] : null;
  if (pending?.payload) {
    const policy = createStudentFacingPolicy({ course, session });
    const surface = policy.processSurface(pending.payload, { channel: 'replay_tool' });
    visible.push({
      type: 'tool.requested',
      data: {
        callId: activeCallId,
        name: pending.name,
        payload: surface.value,
      },
    });
  }
  const primaryAction = visible.length
    ? { kind: 'tool', name: visible[0].data.name, id: visible[0].data.callId }
    : { kind: 'none', name: '', id: '' };
  const planned = planTurnPresentation(visible, { primaryAction });
  return [
    ...planned.events,
    {
      type: 'state.updated',
      data: {
        ...stateUpdatedData(session, 'request_replay_recovery'),
        turnPlan: planned.summary,
        replayed: true,
        replayMode: 'authoritative_recovery',
        replayReason: reason,
      },
    },
  ];
}

function requestReplayEvents({
  session,
  course,
  requestId,
  requestDigest,
  replayEnvelope,
}) {
  let cachedEnvelope = replayEnvelope;
  try {
    if (cachedEnvelope === undefined) {
      cachedEnvelope = replayRequestResult(session, requestId, { requestDigest });
    }
  } catch (error) {
    if (error instanceof RequestReplayConflictError) {
      throw new AgentActionError(
        'requestId 已用于不同的请求内容。',
        error.code,
      );
    }
    throw error;
  }
  const resolution = resolveReplayEnvelope(cachedEnvelope, {
    requestId,
    requestDigest,
    courseContentVersion: course.contentVersion,
    session,
  });
  if (resolution.compatible) return resolution.events;
  return authoritativeReplayEvents(session, course, resolution.reason);
}

// 当前小步对象：用于取该步的就地脚手架与引导（无结构化 Step 时返回 null）。
function currentStepOf(task, session) {
  if (!task?.steps?.length) return null;
  const index = Math.min(
    Math.max(0, Number(session?.taskState?.guidanceStepIndex) || 0),
    task.steps.length - 1,
  );
  return task.steps[index];
}

// 待答问题的是/否：确定性解析优先，读不出时才采纳语义理解给的 pendingAnswer。
// 两者都读不出返回 matched:false，由调用方降级为自然回应，不猜值改状态机。
function pendingAnswerFrom(text, pendingQuestion, understanding) {
  const deterministic = resolvePendingAnswer(text, pendingQuestion);
  if (deterministic.matched) return deterministic;
  if (!pendingQuestion || understanding?.answersPendingQuestion !== true) return deterministic;
  if (!['yes', 'no'].includes(understanding.pendingAnswer)) return deterministic;
  const value = understanding.pendingAnswer === 'yes';
  const slot = pendingQuestion.kind === 'arrival' ? 'arrived' : 'ready';
  const negated = pendingQuestion.kind === 'arrival' ? 'notArrived' : 'notReady';
  return {
    matched: true,
    value,
    confidence: Number(understanding.confidence) || 0.5,
    entry: {
      arrived: false, notArrived: false, ready: false, notReady: false,
      [value ? slot : negated]: true,
    },
  };
}

function activityValue(input, stepId, toolId) {
  return input.data?.toolValues?.[stepId]?.[toolId] || {};
}

function valuesMatch(actual, expected, { orderMatters = true } = {}) {
  const normalize = (value) => {
    const values = Array.isArray(value) ? value.map(String) : [String(value ?? '').trim()];
    return (orderMatters ? values : values.sort()).join('|');
  };
  return normalize(actual) === normalize(expected);
}

function validateStepToolEvidence({
  task,
  stepIndex,
  input,
}) {
  const step = task.steps?.[stepIndex];
  const mode = step?.completionMode || 'user_confirm';
  const tools = step?.tools?.length ? step.tools : task.tools || [];
  if (!tools.length && !['location_event', 'teacher_confirm'].includes(mode)) {
    throw new AgentActionError('课程没有为这个小步配置可验证工具，请联系课程管理员。', 'STEP_TOOL_MISSING');
  }
  for (const tool of tools) {
    const value = activityValue(input, step.id, tool.id);
    const config = tool.config || {};
    if (tool.id === 'photo') {
      const count = Number(value.count ?? input.data?.localEvidenceCount ?? 0);
      if (count < Number(config.minCount || 1)) {
        throw new AgentActionError(`这一步至少需要 ${config.minCount || 1} 张照片。`, 'STEP_PHOTO_REQUIRED');
      }
      if (count > Number(config.maxCount || Infinity)) {
        throw new AgentActionError(`这一步最多提交 ${config.maxCount} 张照片。`, 'STEP_PHOTO_LIMIT');
      }
    }
    if (tool.id === 'audio' && Number(value.durationSeconds || 0) < Number(config.minSeconds || 3)) {
      throw new AgentActionError(`录音至少需要 ${config.minSeconds || 3} 秒。`, 'STEP_AUDIO_TOO_SHORT');
    }
    if (tool.id === 'audio' && Number(value.durationSeconds || 0) > Number(config.maxSeconds || Infinity)) {
      throw new AgentActionError(`录音不能超过 ${config.maxSeconds} 秒。`, 'STEP_AUDIO_TOO_LONG');
    }
    if (tool.id === 'text') {
      const missing = (config.fields || []).find((field) => field.required && !String(value.fields?.[field.id] ?? '').trim());
      if (missing) throw new AgentActionError(`请填写“${missing.label}”。`, 'STEP_FIELD_REQUIRED');
      const tooShort = (config.fields || []).find((field) => Number(field.minLength || 0) > String(value.fields?.[field.id] ?? '').trim().length);
      if (tooShort) throw new AgentActionError(`“${tooShort.label}”至少需要 ${tooShort.minLength} 个字。`, 'STEP_FIELD_TOO_SHORT');
      const tooLong = (config.fields || []).find((field) => Number(field.maxLength || Infinity) < String(value.fields?.[field.id] ?? '').trim().length);
      if (tooLong) throw new AgentActionError(`“${tooLong.label}”最多填写 ${tooLong.maxLength} 个字。`, 'STEP_FIELD_TOO_LONG');
    }
    if (tool.id === 'sketch' && !value.completed && !value.dataUrl) {
      throw new AgentActionError('请先完成画板标注。', 'STEP_SKETCH_REQUIRED');
    }
    if (tool.id === 'quiz') {
      const answer = config.type === 'ordering' ? value.order : value.answer;
      if ((answer == null || answer === '' || (Array.isArray(answer) && !answer.length))) {
        throw new AgentActionError('请先完成答题。', 'STEP_ANSWER_REQUIRED');
      }
      if (Number(config.minLength || 0) > String(answer ?? '').trim().length) {
        throw new AgentActionError(`回答至少需要 ${config.minLength} 个字。`, 'STEP_ANSWER_TOO_SHORT');
      }
      if (config.answer != null) {
        const numeric = config.type === 'fill_blank' && Number.isFinite(Number(config.answer)) && Number.isFinite(Number(answer));
        const tolerance = Number(config.tolerance ?? config.allowedError ?? 0);
        const matches = numeric
          ? Math.abs(Number(answer) - Number(config.answer)) <= tolerance
          : valuesMatch(answer, config.answer, { orderMatters: config.type !== 'multiple_choice' });
        if (!matches) throw new AgentActionError(config.retryMessage || '这个答案还需要再核对一次。', 'STEP_ANSWER_INCORRECT');
      }
    }
    if (tool.id === 'builder') {
      const placed = Object.values(value.placements || {}).flat().length;
      if (placed < (config.items || []).length) throw new AgentActionError('还有卡片没有放入作品区。', 'STEP_BUILDER_INCOMPLETE');
      if (config.correctMapping) {
        const placementByItem = Object.fromEntries(Object.entries(value.placements || {}).flatMap(([zoneId, itemIds]) => itemIds.map((itemId) => [itemId, zoneId])));
        const matches = Object.entries(config.correctMapping).every(([itemId, zoneId]) => placementByItem[itemId] === zoneId);
        if (!matches) throw new AgentActionError(config.retryMessage || '有些卡片的位置还需要结合证据重新判断。', 'STEP_BUILDER_MISMATCH');
      }
      const missingZone = Object.entries(config.zoneMinimums || {}).find(([zoneId, minimum]) => (value.placements?.[zoneId] || []).length < Number(minimum));
      if (missingZone) {
        const zone = config.zones?.find((item) => item.id === missingZone[0]);
        throw new AgentActionError(`“${zone?.label || missingZone[0]}”至少需要 ${missingZone[1]} 张卡片。`, 'STEP_BUILDER_ZONE_MINIMUM');
      }
    }
    if (tool.id === 'simulation' && (value.history || []).length < Number(config.rounds || 1)) {
      throw new AgentActionError('请先完成所有推演轮次。', 'STEP_SIMULATION_INCOMPLETE');
    }
    if (tool.id === 'simulation' && config.allowRepeat === false && new Set((value.history || []).map((entry) => entry.id)).size !== (value.history || []).length) {
      throw new AgentActionError('每轮需要选择不同的推演分支。', 'STEP_SIMULATION_REPEAT');
    }
    if (tool.id === 'team' && (value.entries || []).length < Number(config.minimumEntries || 1)) {
      throw new AgentActionError(`请至少保留 ${config.minimumEntries || 1} 条组内记录。`, 'STEP_TEAM_LOG_REQUIRED');
    }
    if (tool.id === 'team') {
      if (config.roles?.length && (value.entries || []).some((entry) => typeof entry !== 'object' || !entry.role)) {
        throw new AgentActionError('请为每条组内记录标明贡献角色。', 'STEP_TEAM_ROLE_REQUIRED');
      }
      const recordedTypes = new Set((value.entries || []).map((entry) => typeof entry === 'string' ? '' : entry.type));
      const missingType = (config.requiredRecordTypes || []).find((type) => !recordedTypes.has(type));
      if (missingType) throw new AgentActionError(`还需要一条“${missingType}”记录。`, 'STEP_TEAM_RECORD_TYPE_REQUIRED');
    }
    if (tool.id === 'media' && config.requireCompletion !== false) {
      const posterOnly = isPosterOnlyMedia(config);
      if (!config.url && !posterOnly) {
        throw new AgentActionError('课程素材尚未配置，请联系老师。', 'STEP_MEDIA_SOURCE_MISSING');
      }
      if (!value.completed) {
        throw new AgentActionError(
          posterOnly ? '请先查看课程情境图。' : '请先查看完课程材料。',
          'STEP_MEDIA_INCOMPLETE',
        );
      }
    }
    if (tool.id === 'scanner') {
      if (!value.result) throw new AgentActionError('请先完成扫码或识别。', 'STEP_SCAN_REQUIRED');
      if (config.expectedResults?.length && !config.expectedResults.map(String).includes(String(value.result))) {
        throw new AgentActionError('识别结果与本课程小步不匹配，请核对后重试。', 'STEP_SCAN_MISMATCH');
      }
    }
  }
}

function validateStepCompletion({
  task,
  stepIndex,
  input,
  session,
  teacherCommandAuthorization,
}) {
  const step = task.steps?.[stepIndex];
  const mode = step?.completionMode || 'user_confirm';
  if (input.data?.teacherOverride === true) {
    if (teacherCommandAuthorization?.action === 'skip_step') return;
    throw new AgentActionError('这次跳过指令没有有效的教师授权。', 'TEACHER_COMMAND_UNAUTHORIZED');
  }
  if (mode === 'teacher_confirm') {
    if (
      input.data?.teacherApproved === true
      && teacherCommandAuthorization?.action === 'approve_evidence'
    ) return;
    throw new AgentActionError('这一步需要老师确认，请先呼叫老师或等待教师端处理。', 'STEP_TEACHER_CONFIRM_REQUIRED');
  }
  if (mode === 'location_event' && session.locationState?.status !== 'arrived') {
    throw new AgentActionError('到达指定地点并完成位置验证后，这一步才会通过。', 'STEP_LOCATION_REQUIRED');
  }
  if (mode === 'compound' && step?.location?.mode !== 'none' && session.locationState?.status !== 'arrived') {
    throw new AgentActionError('这个小步还需要完成到位验证。', 'STEP_LOCATION_REQUIRED');
  }
  if (mode === 'user_confirm') return;
  validateStepToolEvidence({ task, stepIndex, input });
}

function withStepDetails(error, step, stepIndex) {
  if (!(error instanceof AgentActionError)) return error;
  error.details = {
    ...(error.details || {}),
    stepId: step?.id || '',
    stepIndex,
  };
  if (step?.studentAction || step?.objective) {
    error.message = `第 ${stepIndex + 1} 步“${step.studentAction || step.objective}”：${error.message}`;
  }
  return error;
}

function validateTaskBundleStepEvidence({ task, session, toolValues }) {
  if (!task.steps?.length) return;
  const input = { data: { toolValues } };
  task.steps.forEach((step, stepIndex) => {
    const tools = step?.tools?.length ? step.tools : task.tools || [];
    if (tools.length) {
      try {
        validateStepToolEvidence({ task, stepIndex, input });
      } catch (error) {
        throw withStepDetails(error, step, stepIndex);
      }
    }
    if (step.completionMode !== 'ai_evaluation') return;
    const accepted = acceptedStepEvidence(session, step.id);
    const currentFingerprint = stepEvidenceFingerprint(toolValues, step.id);
    if (!accepted?.fingerprint || accepted.fingerprint !== currentFingerprint) {
      throw new AgentActionError(
        `第 ${stepIndex + 1} 步的证据已经修改，请先点击“保存并重新检查这一步”。`,
        'STEP_REVISION_REQUIRES_REEVALUATION',
        {
          stepId: step.id,
          stepIndex,
          acceptedFingerprint: accepted?.fingerprint || null,
          currentFingerprint,
        },
      );
    }
  });
}

function parseEvaluationResult(text = '') {
  const source = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/gi, '');
  try {
    const result = JSON.parse(source);
    if (typeof result.passed !== 'boolean') return null;
    return {
      passed: result.passed,
      feedback: String(result.feedback || '').trim(),
      missing: Array.isArray(result.missing)
        ? [...new Set(result.missing.map((item) => String(item).trim()).filter(Boolean))].slice(0, 2)
        : [],
      safetyIssue: Boolean(result.safetyIssue),
    };
  } catch {
    return null;
  }
}

function evaluationImages(input, step) {
  const configuredMaximum = Number(
    step?.tools?.find((tool) => tool.id === 'photo')?.config?.maxCount || 2,
  );
  const maximum = Math.min(6, Math.max(1, configuredMaximum));
  return (Array.isArray(input.data?.stepImages) ? input.data.stepImages : [])
    .filter((image) => /^data:image\/(?:jpeg|png|webp);base64,/i.test(image) && image.length <= 2_000_000)
    .slice(0, maximum);
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason || new DOMException('请求已取消。', 'AbortError');
  }
}

async function evaluateStepSubmission({
  llm,
  evaluationLlm,
  course,
  role,
  session,
  task,
  step,
  input,
  signal,
  logger,
}) {
  const platformRules = platformRuleInstructions(course);
  const tools = step.tools || [];
  const images = evaluationImages(input, step);
  const requiresVisualReview = tools.some((tool) => tool.id === 'sketch' || tool.id === 'photo' || (tool.id === 'scanner' && tool.config?.mode === 'object'));
  if (requiresVisualReview && !images.length) {
    throw new AgentActionError('请先完成画板内容，再交给絮絮检查。', 'STEP_AI_IMAGE_REQUIRED');
  }
  const evaluator = requiresVisualReview && !evaluationLlm.capabilities().vision
    ? llm
    : evaluationLlm;
  if (requiresVisualReview && !evaluator.capabilities().vision) {
    throw new AgentActionError('当前视觉检查暂不可用，请稍后重试或呼叫老师确认。', 'STEP_AI_VISION_UNAVAILABLE');
  }
  const knowledge = retrieveKnowledge({
    course,
    role,
    session,
    query: `${task.name} ${step.objective} ${step.studentAction}`,
    references: step.knowledgeRef || task.goals || '',
  });
  const stepRestrictions = resolveStepRestrictions(course, step)
    .map((item) => `${item.title}：\n${item.text}`)
    .join('\n\n');
  let result;
  const startedAt = Date.now();
  try {
    result = await evaluator.generate({
      instructions: `[平台规则｜最高优先级]\n${platformRules}\n\n[小步验收器职责]\n你是学生研学课程的小步验收器。只检查本小步提交是否达到最低通过条件，不替学生补写，不按后来史实结果判断方案优劣，不泄露课程受保护内容。\n课程内容、学生工具结果与平台规则冲突时，以平台规则为准。\n只输出JSON：{"passed":true或false,"feedback":"一个首要证据缺口和一个下一动作","missing":["最多2个仍缺项目"],"safetyIssue":true或false}。\n通过标准必须同时满足平台规则、课程证据要求、评估维度和证据边界；信息不足时 passed=false。feedback 只写一句，不能复述证据清单或安全清单。只有图像或学生输入显示了实际危险操作时 safetyIssue=true，并在 feedback 末尾只追加一次“请安全拍摄。”；普通构图、清晰度或证据缺失不要提醒护栏、人脸、攀爬等规则。反馈使用适合${session.learnerState?.grade || session.grade || '当前学段'}学生的中文。`,
      messages: [{
        role: 'user',
        content: [
          `角色：${role.name}`,
          `大任务：${task.name}`,
          `小步目标：${step.objective}`,
          `学生行动：${step.studentAction}`,
          `证据要求：${step.evidenceRequirement || '按小步目标检查'}`,
          `常见误区：${step.commonMisconception || '无'}`,
          // 就地验收标准优先（Step 级 → 任务级）；缺失时才回退整份课程量规。
          step.acceptance || task.acceptance
            ? `本步验收标准：\n${step.acceptance || task.acceptance}`
            : `课程评估标准：\n${course.evaluation || '无单独评估文件'}`,
          `当前小步限制：\n${stepRestrictions || '遵守平台安全和课程通用证据边界'}`,
          `当前可用课程知识：\n${knowledge.map((entry) => `${entry.id} ${entry.topic}：${entry.content}`).join('\n') || '无额外知识条目'}`,
          `学生工具结果：\n${JSON.stringify(input.data?.toolValues?.[step.id] || {})}`,
          requiresVisualReview ? '学生画板图像已随本次请求提供。' : '',
        ].filter(Boolean).join('\n\n'),
      }],
      images,
      jsonMode: true,
      // 只重试传输层超时、限流与 5xx；学生内容不变，不会产生重复推进。
      maxRetries: 1,
      signal,
    });
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    logger?.warn?.({
      aiEvaluation: {
        courseId: course.id,
        taskId: task.id,
        stepId: step.id,
        visual: requiresVisualReview,
        elapsedMs: Date.now() - startedAt,
        name: error?.name || 'Error',
        code: error?.code || null,
        status: Number.isInteger(error?.status) ? error.status : null,
      },
    }, 'ai evaluation request failed');
    if (error?.code === 'LLM_TIMEOUT') {
      throw new AgentActionError(
        '絮絮这次检查等得有点久，请保留当前内容重试，或呼叫老师确认。',
        'STEP_AI_TIMEOUT',
        { retryable: true },
      );
    }
    throw new AgentActionError('絮絮暂时没能完成这一步的检查，请保留当前内容稍后重试，或呼叫老师确认。', 'STEP_AI_UNAVAILABLE');
  }
  if (requiresVisualReview && !evaluator.capabilities().vision) {
    throw new AgentActionError('当前视觉检查暂不可用，请保留画板内容稍后重试，或呼叫老师确认。', 'STEP_AI_VISION_UNAVAILABLE');
  }
  const evaluation = parseEvaluationResult(result.text);
  if (!evaluation) {
    logger?.warn?.({
      aiEvaluation: {
        courseId: course.id,
        taskId: task.id,
        stepId: step.id,
        visual: requiresVisualReview,
        elapsedMs: Date.now() - startedAt,
        code: 'INVALID_RESULT',
        responseChars: String(result.text || '').length,
      },
    }, 'ai evaluation result invalid');
    throw new AgentActionError('絮絮收到了一份无法解析的检查结果，请稍后再试。', 'STEP_AI_INVALID_RESULT');
  }
  const policyResult = createStudentFacingPolicy({ course, session }).processEvaluation(evaluation);
  logger?.debug?.({
    aiEvaluation: {
      courseId: course.id,
      taskId: task.id,
      stepId: step.id,
      visual: requiresVisualReview,
      elapsedMs: Date.now() - startedAt,
      passed: evaluation.passed,
    },
  }, 'ai evaluation completed');
  return {
    ...policyResult.value,
    policyActions: policyResult.actions,
  };
}

function stageTimeline(task, taskIndex) {
  const steps = guidanceSteps(task);
  const suggestedSeconds = Number(task.timing?.suggestedSeconds || 0);
  return [
    {
      type: 'stage.started',
      data: {
        stageNumber: taskIndex + 1,
        stageName: task.name,
        mainTask: task.requirement,
        location: task.location?.name || '',
        stepCount: steps.length,
        suggestedSeconds,
      },
    },
    {
      type: 'assistant',
      text: `现在从第1小步开始：${steps[0]}`,
    },
  ];
}

function beginStage(session, task, taskIndex) {
  clearPendingQuestion(session, { outcome: 'flow_advanced' });
  setDialogueLifecycle(session, 'INTRODUCE_ROLE_STAGE');
  session.taskState.stageAnnounced = true;
  session.taskState.guidanceStepIndex = 0;
  return stageTimeline(task, taskIndex);
}

function taskToolCall(tool, reason) {
  return {
    id: `call_${crypto.randomUUID()}`,
    name: 'open_task_tool',
    arguments: { toolInstanceId: tool.id, reason },
  };
}

function navigationToolCall(task) {
  return {
    id: `call_${crypto.randomUUID()}`,
    name: 'show_navigation',
    arguments: { taskId: task.id },
  };
}

function updateDialogueLifecycleForDecision(session, decision) {
  if (decision.intent === 'safety_help') return setDialogueLifecycle(session, 'SAFETY_ESCALATION');
  if (decision.intent === 'scaffold_exhausted') return setDialogueLifecycle(session, 'SAFETY_ESCALATION');
  if (decision.intent === 'emotion') return setDialogueLifecycle(session, 'EMOTIONAL_SUPPORT');
  if (decision.intent === 'conversation_repair') return;
  if (session.dialogueState?.pendingQuestion) return;
  if (!session.onboardingState?.completed) return setDialogueLifecycle(session, 'ORIENT_ROLE');
  if (['task_help', 'task_followup', 'task_step_completed'].includes(decision.intent)) {
    return setDialogueLifecycle(session, 'GUIDE_CURRENT_STEP');
  }
  if (decision.intent === 'tool_result') return setDialogueLifecycle(session, 'EVALUATE_RESPONSE');
  return setDialogueLifecycle(session, 'WAIT_FOR_STUDENT');
}

function startCurrentRoleStage({ session, task, tool }) {
  session.onboardingState.completed = true;
  setDialogueLifecycle(session, 'INTRODUCE_ROLE_STAGE');
  return {
    text: '',
    timeline: beginStage(session, task, session.currentTaskIndex),
    toolCalls: [taskToolCall(tool, '学生已完成入场确认，开始当前角色阶段')],
    dialogueMove: 'introduce_role_stage',
    quickReplies: [],
  };
}

function askNextOnboarding({ session, task, role, voice = null }) {
  const question = nextOnboardingQuestion({ session, task, role, voice });
  return question ? askQuestion(session, question) : null;
}

function workflowResult({ decision, role, session, course, input }) {
  const task = currentTaskOf(role, session);
  const tool = currentToolOf(role, session);
  const voice = course?.platformDefaults?.voice;
  const say = (key, params = {}) => renderVoice(voice, key, params);
  const locationName = task.location?.name || role.location;
  if (decision.intent === 'phase_started') {
    // 阶段任务发生在角色选择前，不需要再问一次“是否到达／是否准备好”。
    // 前端点击进入课程就是明确的开始信号，直接打开当前阶段任务。
    session.onboardingState.arrivedConfirmed = true;
    session.onboardingState.readyConfirmed = true;
    session.onboardingState.completed = true;
    confirmDialogueSlot(session, 'arrival', true);
    confirmDialogueSlot(session, 'readiness', true);
    return startCurrentRoleStage({ session, task, tool });
  }
  if (decision.intent === 'role_assigned') {
    if (!taskRequiresArrival(task) || session.locationState?.status === 'arrived') {
      confirmDialogueSlot(session, 'arrival', true);
    }
    const next = askNextOnboarding({ session, task, role, voice });
    if (!next) return startCurrentRoleStage({ session, task, tool });
    return {
      ...next,
      text: say('role_assigned.欢迎', {
        roleName: role.name,
        companionName: course?.platformDefaults?.companion?.name || PLATFORM_COMPANION.name,
        next: next.text,
      }),
      toolCalls: [],
    };
  }
  if (decision.intent === 'quick_reply_stale') {
    const next = askNextOnboarding({ session, task, role, voice });
    return {
      ...(next || {}),
      text: next
        ? say('quick_reply_stale.有下一问', { next: next.text })
        : say('quick_reply_stale.无下一问'),
      toolCalls: [],
      dialogueMove: 'repair_stale_action',
    };
  }
  if (decision.intent === 'conversation_repair') return { ...conversationRepair(session, voice), toolCalls: [] };
  if (decision.intent === 'unclear_input') return { ...unclearInputReply(session, voice), toolCalls: [] };
  if (decision.intent === 'onboarding_not_arrived' || decision.intent === 'onboarding_navigation') {
    confirmDialogueSlot(session, 'arrival', !taskRequiresArrival(task));
    if (!taskRequiresArrival(task)) {
      const next = askNextOnboarding({ session, task, role, voice });
      return { ...next, text: say('onboarding_not_arrived.无需前往', { next: next.text }), toolCalls: [] };
    }
    const question = arrivalQuestion(task, role, voice);
    askQuestion(session, question);
    return {
      text: say('onboarding_not_arrived.导航', { location: locationName }),
      toolCalls: [navigationToolCall(task)],
      dialogueMove: 'support_navigation',
      quickReplies: [],
    };
  }
  if (decision.intent === 'onboarding_not_ready') {
    if (decision.entry?.arrived) {
      confirmDialogueSlot(session, 'arrival', true);
      if (taskRequiresArrival(task)) recordArrival(session, 'manual');
    }
    confirmDialogueSlot(session, 'readiness', false);
    const question = readinessQuestion(task, voice);
    askQuestion(session, question);
    return {
      text: say('onboarding_not_ready.等待'),
      toolCalls: [],
      dialogueMove: 'wait_for_readiness',
      quickReplies: [{ id: 'readiness-yes', label: say('onboarding.准备.现在开始'), value: say('onboarding.准备.value.现在开始') }],
    };
  }
  if (decision.intent === 'pending_answer') {
    const resolved = applyPendingAnswer(session, decision.pendingResolution);
    clearMisunderstandings(session);
    if (decision.entry?.arrived) {
      confirmDialogueSlot(session, 'arrival', true);
      if (taskRequiresArrival(task)) recordArrival(session, 'manual');
    }
    if (decision.entry?.notArrived) confirmDialogueSlot(session, 'arrival', false);
    if (decision.entry?.ready) confirmDialogueSlot(session, 'readiness', true);
    if (decision.entry?.notReady) confirmDialogueSlot(session, 'readiness', false);

    if (resolved?.pending.kind === 'arrival' && resolved.value === false) {
      const question = arrivalQuestion(task, role, voice);
      askQuestion(session, question);
      return {
        text: say('pending_answer.未到达导航', { location: locationName }),
        toolCalls: taskRequiresArrival(task) ? [navigationToolCall(task)] : [],
        dialogueMove: 'support_navigation',
        quickReplies: [],
      };
    }
    if (decision.entry?.notReady || (resolved?.pending.kind === 'readiness' && resolved.value === false)) {
      const question = readinessQuestion(task, voice);
      askQuestion(session, question);
      return {
        text: say('pending_answer.等待准备'),
        toolCalls: [],
        dialogueMove: 'wait_for_readiness',
        quickReplies: [{ id: 'readiness-yes', label: say('onboarding.准备.现在开始'), value: say('onboarding.准备.value.现在开始') }],
      };
    }
    const next = askNextOnboarding({ session, task, role, voice });
    if (next) {
      return {
        ...next,
        text: resolved?.pending.kind === 'arrival'
          ? say('pending_answer.到达确认', { next: next.text })
          : next.text,
        toolCalls: [],
      };
    }
    return startCurrentRoleStage({ session, task, tool });
  }
  if (decision.intent === 'onboarding_check') {
    if (decision.entry?.arrived) {
      confirmDialogueSlot(session, 'arrival', true);
      if (taskRequiresArrival(task)) recordArrival(session, 'manual');
    }
    const arrivalSatisfied = !taskRequiresArrival(task)
      || session.dialogueState?.confirmedSlots?.arrival === true;
    if (decision.entry?.ready && arrivalSatisfied) confirmDialogueSlot(session, 'readiness', true);
    if (decision.entry?.notReady) confirmDialogueSlot(session, 'readiness', false);
    const next = askNextOnboarding({ session, task, role, voice });
    if (next) return { ...next, toolCalls: [] };
    return startCurrentRoleStage({ session, task, tool });
  }
  if (decision.intent === 'navigation_completed') {
    confirmDialogueSlot(session, 'arrival', true);
    if (session.dialogueState?.pendingQuestion?.kind === 'arrival') {
      clearPendingQuestion(session, { outcome: 'tool_confirmed' });
    }
    if (!session.onboardingState.completed) {
      const next = askNextOnboarding({ session, task, role, voice });
      if (next) return { ...next, text: say('navigation_completed.已到位', { next: next.text }), toolCalls: [] };
      return startCurrentRoleStage({ session, task, tool });
    }
    if (!session.taskState.stageAnnounced) {
      return {
        text: '',
        timeline: beginStage(session, task, session.currentTaskIndex),
        toolCalls: [taskToolCall(tool, '学生已到达任务地点')],
        dialogueMove: 'introduce_role_stage',
        quickReplies: [],
      };
    }
    if (input.data?.completedLocationStepId) {
      const steps = guidanceSteps(task);
      const stepIndex = Math.min(Number(session.taskState.guidanceStepIndex || 0), steps.length);
      return {
        text: stepIndex < steps.length
          ? say('navigation_completed.继续小步', { stepNumber: stepIndex + 1, stepText: steps[stepIndex] })
          : say('navigation_completed.小步已完成'),
        toolCalls: [],
        dialogueMove: 'guide_current_step',
        quickReplies: [],
      };
    }
    return {
      text: say('navigation_completed.回到任务', { taskName: task.name }),
      toolCalls: [taskToolCall(tool, '继续当前任务')],
      dialogueMove: 'resume_current_step',
      quickReplies: [],
    };
  }
  if (decision.intent === 'navigation') {
    if (task.location?.mode === 'none') {
      return { text: say('navigation.无需前往', { taskName: task.name }), toolCalls: [], dialogueMove: 'clarify_location', quickReplies: [] };
    }
    return {
      text: say('navigation.已打开', { location: locationName }),
      toolCalls: [{
        id: `call_${crypto.randomUUID()}`,
        name: 'show_navigation',
        arguments: { taskId: task.id },
      }],
      dialogueMove: 'support_navigation',
      quickReplies: [],
    };
  }
  if (decision.intent === 'safety_help') {
    return {
      text: safetyHelpReply(input.text, voice),
      toolCalls: [{
        id: `call_${crypto.randomUUID()}`,
        name: 'call_teacher',
        arguments: { reason: String(input.text || '学生请求老师帮助').slice(0, 120) },
      }],
      dialogueMove: 'escalate_safety',
      quickReplies: [],
    };
  }
  // 脚手架到顶仍连续求助：转请老师。不撤走提示，也不再复读 L4。
  if (decision.intent === 'scaffold_exhausted') {
    return {
      text: say('scaffold_exhausted.转老师', { taskName: task.name }),
      toolCalls: [{
        id: `call_${crypto.randomUUID()}`,
        name: 'call_teacher',
        arguments: { reason: `学生在“${task.name}”连续求助且脚手架已到最高档` },
      }],
      dialogueMove: 'escalate_to_teacher',
      quickReplies: [],
    };
  }
  if (decision.intent === 'task_progress') {
    // "是否在声称完成"由语义理解判定（decision.claimsDone）；
    // 正则只作为非语言输入与语义理解不可用时的兜底。
    const claimsDone = decision.claimsDone ?? /做完|完成|搞定|(?:这一步)?好了/.test(input.text || '');
    if (claimsDone) {
      const steps = guidanceSteps(task);
      const currentIndex = Math.min(Number(session.taskState.guidanceStepIndex || 0), steps.length);
      const currentStep = task.steps?.[currentIndex];
      if (currentIndex < steps.length && currentStep?.completionMode === 'user_confirm') {
        session.taskState.guidanceStepIndex = currentIndex + 1;
        recordStepCompletion(session, task, currentIndex);
        const finalizationStatus = session.taskState?.finalization?.status;
        setDialogueLifecycle(session, currentIndex + 1 < steps.length ? 'GUIDE_CURRENT_STEP' : 'WAIT_FOR_TOOL_RESULT');
        return {
          text: finalizationStatus === 'completed'
            ? say('task_step_completed.任务完成')
            : finalizationStatus === 'awaiting_teacher_confirm'
              ? say('task_step_completed.等待教师终审')
              : currentIndex + 1 < steps.length
            ? say('task_progress.小步记下', {
              doneNumber: currentIndex + 1,
              nextNumber: currentIndex + 2,
              stepText: steps[currentIndex + 1],
            })
            : say('task_progress.小步全记下', { stepCount: steps.length }),
          toolCalls: [],
          dialogueMove: finalizationStatus === 'completed'
            ? 'confirm_task_completion'
            : (currentIndex + 1 < steps.length ? 'guide_current_step' : 'request_required_evidence'),
          quickReplies: [],
        };
      }
      return { text: say('task_progress.请提交', { taskName: task.name }), toolCalls: [], dialogueMove: 'request_required_evidence', quickReplies: [] };
    }
    const arrived = task.location?.mode === 'none' || session.locationState?.status === 'arrived';
    return {
      text: arrived
        ? say('task_progress.继续任务', { taskName: task.name })
        : say('task_progress.先去地点', { location: locationName }),
      toolCalls: arrived ? [{
        id: `call_${crypto.randomUUID()}`,
        name: 'open_task_tool',
        arguments: { toolInstanceId: tool.id, reason: '学生准备继续当前任务' },
      }] : [{
        id: `call_${crypto.randomUUID()}`,
        name: 'show_navigation',
        arguments: { taskId: task.id },
      }],
      dialogueMove: arrived ? 'resume_current_step' : 'support_navigation',
      quickReplies: [],
    };
  }
  if (decision.intent === 'task_step_completed') {
    const steps = guidanceSteps(task);
    const stepIndex = Math.min(Number(session.taskState.guidanceStepIndex || 0), steps.length);
    if (input.data?.aiEvaluation?.passed === false) {
      const evaluation = input.data.aiEvaluation;
      return {
        text: [
          evaluation.feedback
            || (evaluation.missing?.length
              ? say('task_step_completed.还需要', { items: evaluation.missing.join('、') })
              : say('task_step_completed.补充默认语')),
          evaluation.teacherRecommended ? say('task_step_completed.可呼叫老师') : '',
        ].filter(Boolean).join(' '),
        toolCalls: [],
        dialogueMove: 'request_step_revision',
        quickReplies: [],
      };
    }
    if (stepIndex < steps.length) {
      setDialogueLifecycle(session, 'GUIDE_CURRENT_STEP');
      return {
        text: [
          input.data?.aiEvaluation?.feedback || '',
          say('task_step_completed.继续小步', {
            doneNumber: stepIndex,
            nextNumber: stepIndex + 1,
            stepText: steps[stepIndex],
          }),
        ].filter(Boolean).join(' '),
        toolCalls: [],
        dialogueMove: 'guide_current_step',
        quickReplies: [],
      };
    }
    setDialogueLifecycle(session, 'WAIT_FOR_TOOL_RESULT');
    return {
      text: session.taskState?.finalization?.status === 'completed'
        ? say('task_step_completed.任务完成')
        : session.taskState?.finalization?.status === 'awaiting_teacher_confirm'
          ? say('task_step_completed.等待教师终审')
          : say('task_step_completed.全部完成', { stepCount: steps.length }),
      toolCalls: [],
      dialogueMove: session.taskState?.finalization?.status === 'completed'
        ? 'confirm_task_completion'
        : 'request_required_evidence',
      quickReplies: [],
    };
  }
  if (decision.intent === 'proactive_nudge') {
    if (decision.nudge?.reason === 'location_pending' && task.location?.mode !== 'none') {
      return {
        text: say('proactive_nudge.找不到地点', { location: locationName }),
        toolCalls: [{
          id: `call_${crypto.randomUUID()}`,
          name: 'show_navigation',
          arguments: { taskId: task.id },
        }],
        dialogueMove: 'proactive_support',
        quickReplies: [],
      };
    }
    return {
      text: say('proactive_nudge.试一小步', {
        hint: taskScaffoldHint(task, session.scaffoldLevel, session.taskState?.guidanceStepIndex, currentStepOf(task, session), course?.platformDefaults?.scaffolding),
      }),
      toolCalls: [],
      dialogueMove: 'proactive_support',
      quickReplies: [],
    };
  }
  return { text: '', toolCalls: [], dialogueMove: decision.intent, quickReplies: [] };
}

function degradedReply(decision, role, session, course) {
  const task = currentTaskOf(role, session);
  const voice = course?.platformDefaults?.voice;
  if (decision.intent === 'emotion') return renderVoice(voice, 'degraded.情绪');
  if (['task_help', 'task_followup', 'course_knowledge', 'tool_result'].includes(decision.intent)) {
    return renderVoice(voice, 'degraded.任务线索', { taskName: task.name });
  }
  if (decision.intent === 'proactive_nudge') return '';
  return renderVoice(voice, 'degraded.没接住');
}

function immediatePrelude(decision, role, session, course) {
  const task = currentTaskOf(role, session);
  const voice = course?.platformDefaults?.voice;
  if (['task_help', 'task_followup'].includes(decision.intent)) {
    return renderVoice(voice, 'prelude.求助', {
      hint: taskScaffoldHint(task, session.scaffoldLevel, session.taskState?.guidanceStepIndex, currentStepOf(task, session), course?.platformDefaults?.scaffolding),
    });
  }
  if (decision.intent === 'emotion') return renderVoice(voice, 'prelude.情绪');
  if (decision.intent === 'tool_result') return renderVoice(voice, 'prelude.收到提交');
  if (decision.intent === 'course_knowledge') return renderVoice(voice, 'prelude.核对材料');
  if (decision.intent === 'social') return renderVoice(voice, 'prelude.寒暄');
  // 澄清回合也要先接住一句：读不懂学生时最不该做的就是沉默几秒再问一句。
  if (decision.intent === 'clarify_intent') return renderVoice(voice, 'prelude.澄清');
  return '';
}

function toolNarration(call, role, session, course) {
  const task = currentTaskOf(role, session);
  const voice = course?.platformDefaults?.voice;
  if (call?.name === 'show_navigation') {
    return renderVoice(voice, 'tool.show_navigation', { location: task.location?.name || role.location });
  }
  if (call?.name === 'open_task_tool') return renderVoice(voice, 'tool.open_task_tool', { taskName: task.name });
  if (call?.name === 'call_teacher') return renderVoice(voice, 'tool.call_teacher');
  return renderVoice(voice, 'tool.默认');
}

function guardedDeltaEmitter({ course, session, emit }) {
  const maxProtectedLength = Math.max(
    1,
    ...course.restrictions.flatMap((rule) => rule.protectedTerms.map((term) => String(term).length)),
  );
  let buffer = '';
  let blocked = false;
  return {
    push(delta) {
      if (blocked || !delta) return;
      buffer += delta;
      if (findSpoiler(buffer, course, session)) {
        blocked = true;
        buffer = '';
        return;
      }
      const keep = maxProtectedLength - 1;
      if (buffer.length > keep) {
        emit(buffer.slice(0, buffer.length - keep));
        buffer = buffer.slice(buffer.length - keep);
      }
    },
    flush() {
      if (!blocked && buffer) emit(buffer);
      buffer = '';
    },
    isBlocked() { return blocked; },
  };
}

function appendStateDrivenTools(result, { input, role, session }) {
  // 进度刚刚往前走了一格的两条路：
  // ① 提交工具结果后自动推进（`auto_after_validation`，85 个任务的主路径）；
  // ② 教师／学生解除等待后推进——它是 lifecycle_event，不是 tool_result。
  //    漏掉②的话老师按了确认，进度确实 +1，但**新任务的工具卡永远不开**，
  //    学生停在一张已完成的旧卡上，卡死只是换了个位置。
  const completedAndAdvanced = Boolean(input.data?.completedTaskId)
    && !pendingAdvanceOf(session);
  const resolvedAdvance = input.type === 'lifecycle_event' && Boolean(input.data?.advancedBy);
  if (!completedAndAdvanced && !resolvedAdvance) return result;
  if (input.data?.allTasksCompleted) return result;
  if (result.toolCalls?.length) return result;
  // 等教师／学生推进时 currentTaskIndex 还没动，这里再自动开卡会把**刚做完的那个任务**
  // 重新打开一遍。等待期间什么都不开——推进发生后的那一回合才开新卡。
  if (pendingAdvanceOf(session)) return result;
  const task = currentTaskOf(role, session);
  const tool = currentToolOf(role, session);
  const arrived = task.location?.mode === 'none' || session.locationState?.status === 'arrived';
  if (arrived) {
    return {
      ...result,
      timeline: [...(result.timeline || []), ...beginStage(session, task, session.currentTaskIndex)],
      toolCalls: [taskToolCall(tool, '上一阶段已验证，开始新阶段')],
    };
  }
  session.taskState.stageAnnounced = false;
  return {
    ...result,
    timeline: [
      ...(result.timeline || []),
      {
        type: 'assistant',
        text: `上一阶段已完成。接下来要去“${task.location?.name || role.location}”开始第${session.currentTaskIndex + 1}阶段「${task.name}」。`,
      },
    ],
    toolCalls: [navigationToolCall(task)],
  };
}

/**
 * 教师指令落到会话状态。
 *
 * 为什么走这条路：教师运行时（server/runtime/）只持有场次记录，碰不到 agent 会话存储，
 * 而真正驱动学生体验的是会话上的 phaseId 与 scaffoldLevel。学生端轮询到指令后回发一个
 * lifecycle_event，由这里改会话——`approve_evidence` 早就是这么生效的，不新增机制。
 *
 * 教师是现场的权威，所以这里不做教学判断，只做合法性校验。
 */
function applyTeacherDirective({ session, course, task, data }) {
  const applied = [];

  // 阶段是课程编排里的既有阶段才认。写错一个不存在的 phaseId 会让「阶段规则」段整段变空，
  // 而降级是静默的——宁可不改，也不要让课程作者写的阶段约束凭空消失。
  if (data.phaseId) {
    const phaseId = String(data.phaseId);
    if (course.lesson.phases.some((phase) => phase.id === phaseId)) {
      session.phaseId = phaseId;
      session.phaseNumber = phaseNumber(phaseId);
      applied.push('phase');
    }
  }

  // 教师调档可升可降：tutorPolicy 的自动升档只升不降，老师看得到学生的真实状态，
  // 有权把档位调回去。上限取平台默认层的 maxLevel，与 service 里自动升档同一个口径。
  if (data.scaffoldLevel !== undefined && data.scaffoldLevel !== null) {
    const level = Number(data.scaffoldLevel);
    if (Number.isFinite(level)) {
      const maxLevel = Number(course?.platformDefaults?.scaffolding?.maxLevel ?? 4);
      setScaffoldStepOverride(
        session,
        scaffoldContextForTask(task, session),
        level,
        { maxLevel, source: 'teacher' },
      );
      applied.push('scaffold');
    }
  }

  return applied;
}

/**
 * 拒绝推进时的错误。
 *
 * 刻意区分四种原因而不是笼统报"推不了"：老师在现场按了按钮没反应，最需要知道的
 * 就是"为什么"——是学生还没做完，还是他已经自己往前走了。
 */
function advanceRefusalError(actor, reason) {
  const who = actor === 'teacher' ? '老师' : '学生';
  const messages = {
    NOT_WAITING: `当前任务没有在等${who}推进，进度未改变。`,
    WRONG_ACTOR: `这个任务不是在等${who}推进，进度未改变。`,
    TASK_CHANGED: '学生已经换到别的任务，这次推进没有生效。',
    NOT_COMPLETED: '学生还没有完成当前任务，不能推进。',
  };
  return new AgentActionError(messages[reason] || '这次推进没有生效。', `ADVANCE_${reason}`);
}

async function applyToolResult({
  course, session, role, input, llm, evaluationLlm, signal, logger,
}) {
  if (input.type !== 'tool_result') return;
  const pending = session.pendingTools[input.toolCallId];
  if (!pending) throw new AgentActionError('当前任务卡已经失效，请让絮絮重新打开任务。', 'TOOL_CALL_EXPIRED');
  input.data = { ...(input.data || {}), resolvedTool: pending.name };
  if (input.result?.status !== 'completed') {
    delete session.pendingTools[input.toolCallId];
    recordActiveTool(session, null);
    return;
  }
  if (pending.name === 'call_teacher') {
    delete session.pendingTools[input.toolCallId];
    recordActiveTool(session, null);
    session.events.push('teacher-help:requested');
    markMeaningfulAction(session, Date.now(), 'tool');
    return;
  }
  if (pending.name === 'show_navigation') {
    delete session.pendingTools[input.toolCallId];
    recordActiveTool(session, null);
    const verification = String(input.result?.values?.verification || pending.payload?.verification || 'manual');
    recordArrival(session, verification);
    input.data = {
      ...(input.data || {}),
      arrived: true,
      verification: session.locationState?.verifiedBy,
      dwellSeconds: session.locationState?.dwellSeconds || 0,
    };
    const task = currentTaskOf(role, session);
    const stepIndex = Number(session.taskState?.guidanceStepIndex || 0);
    if (
      session.onboardingState?.completed
      && session.taskState?.stageAnnounced
      && task.steps?.[stepIndex]?.completionMode === 'location_event'
    ) {
      session.taskState.guidanceStepIndex = stepIndex + 1;
      recordStepCompletion(session, task, stepIndex);
      input.data.completedLocationStepId = task.steps[stepIndex].id;
    }
    return;
  }
  if (pending.name !== 'open_task_tool') return;
  const task = currentTaskOf(role, session);
  const steps = guidanceSteps(task);
  const completedSteps = Math.min(Number(session.taskState?.guidanceStepIndex || 0), steps.length);
  if (completedSteps < steps.length) {
    throw new AgentActionError(
      `请先完成当前小步（${completedSteps + 1}/${steps.length}），絮絮会继续带你做。`,
      'TASK_STEPS_PENDING',
      { completed: completedSteps, total: steps.length },
    );
  }
  const finalizationMode = task.finalizationMode || DEFAULT_TASK_FINALIZATION_MODE;
  if (finalizationMode !== 'explicit_bundle_submit') {
    throw new AgentActionError(
      finalizationMode === 'teacher_confirm'
        ? '这项任务正在等待老师终审，学生不需要再提交一次。'
        : '这项任务会在最后一步通过后自动完成，不需要再提交。',
      'TASK_FINALIZATION_MODE_REJECTS_BUNDLE',
      { mode: finalizationMode },
    );
  }
  if (session.taskState?.finalization?.status !== 'awaiting_bundle_submit') {
    throw new AgentActionError(
      '当前任务还没有进入整包提交状态，请按当前小步继续。',
      'TASK_FINALIZATION_NOT_READY',
      { status: session.taskState?.finalization?.status || 'unknown' },
    );
  }
  const completedLocationName = task.location?.name || '';
  const completedLocationStatus = session.locationState?.status;
  const completedVerification = session.locationState?.verifiedBy;
  const evidence = input.result?.evidence || [];
  const text = String(input.result?.values?.text || '').trim();
  const toolValues = input.result?.values?.toolValues || {};
  // 0 是“本任务不要求照片”的有效配置（视频、文字、扫码都会用到），不能被 || 吞掉。
  const minimum = Number(pending.payload?.config?.minEvidenceCount ?? 1);
  const photoEvidenceCount = Number(input.result?.values?.photoEvidenceCount ?? evidence.length);
  if (minimum > 0 && photoEvidenceCount < minimum) {
    throw new AgentActionError(
      `当前已提交 ${photoEvidenceCount} 张照片，还需要 ${minimum - photoEvidenceCount} 张（本任务至少 ${minimum} 张）。`,
      'EVIDENCE_MINIMUM',
      { required: minimum, received: photoEvidenceCount },
    );
  }
  if (!evidence.length && !text && !Object.keys(toolValues).length) {
    throw new AgentActionError('请先提交现场证据或观察记录。', 'EVIDENCE_REQUIRED');
  }
  // 整包提交必须重新核对每个 Step 的当前值。任务总数达标不能补偿某一步
  // 证据被删空；AI 已验收的 Step 若指纹变化，也必须先走 revision 生命周期。
  validateTaskBundleStepEvidence({ task, session, toolValues });
  if (task.completionMode === 'ai_evaluation') {
    // 少数阶段任务只有任务级「完成方式」，没有手写 Step。它们的最终提交仍需真正经过
    // AI 验收；否则课程写了 ai_evaluation，运行时却会直接判定完成。
    const evaluationStep = {
      id: `${task.id}-task-evaluation`,
      objective: task.requirement || task.name,
      studentAction: task.requirement || task.name,
      evidenceRequirement: task.evidenceRequirement || task.passCondition,
      tools: task.tools || [],
      acceptance: task.acceptance || '',
      knowledgeRef: task.goals || '',
      commonMisconception: '',
    };
    const evaluationInput = {
      ...input,
      data: {
        ...(input.data || {}),
        toolValues: { [evaluationStep.id]: toolValues },
      },
    };
    const evaluation = await evaluateStepSubmission({
      llm,
      evaluationLlm,
      course,
      role,
      session,
      task,
      step: evaluationStep,
      input: evaluationInput,
      signal,
      logger,
    });
    session.taskState.taskEvaluationAttempts = Number(
      session.taskState.taskEvaluationAttempts || 0,
    ) + 1;
    input.data = { ...(input.data || {}), aiEvaluation: evaluation };
    if (!evaluation.passed) {
      throw new AgentActionError(
        evaluation.feedback || '这项提交还需要补充后再试。',
        'TASK_AI_EVALUATION_FAILED',
        { missing: evaluation.missing || [] },
      );
    }
  }
  const finalization = recordTaskFinalizationEvent(session, task, { type: 'bundle_submitted' });
  if (!finalization.changed || finalization.state.status !== 'completed') {
    throw new AgentActionError(
      '这次整包提交没有改变任务状态，请按当前提示继续。',
      'TASK_FINALIZATION_REJECTED',
      { reason: finalization.reason },
    );
  }
  input.data = {
    ...(input.data || {}),
    submissionTaskId: task.id,
    submissionTaskName: task.name,
  };
  stagePendingTaskCompletion({ session, role, task, input, source: 'bundle_submitted' });
  input.data.pendingCompletion = {
    ...input.data.pendingCompletion,
    toolCallId: input.toolCallId,
    completedLocationName,
    completedLocationStatus,
    completedVerification,
  };
}

function advanceBlockedMessage(role, blockedBy = []) {
  const names = blockedBy.map((taskId) => role.tasks.find((task) => task.id === taskId)?.name || taskId);
  if (!names.length) return '';
  if (names.length === 1) return `还差「${names[0]}」没完成，先把它做完我们再继续。`;
  return `还差「${names.join('」「')}」没完成，先把它们做完我们再继续。`;
}

function applyAdvanceOutcome(input, role, advance) {
  if (advance.advanced) {
    input.data.continueAtSameLocation = advance.continueAtSameLocation;
    input.data.previousVerification = advance.previousVerification;
    return;
  }
  if (advance.blockedBy?.length) {
    input.data.advanceBlockedMessage = advanceBlockedMessage(role, advance.blockedBy);
  }
}

function taskToolCallIdFor(session, taskId) {
  return Object.entries(session.pendingTools || {}).find(([, pending]) => (
    pending.name === 'open_task_tool' && pending.payload?.taskId === taskId
  ))?.[0] || null;
}

function stagePendingTaskCompletion({ session, role, task, input, source = '' }) {
  if (!task || session.taskState?.finalization?.status !== 'completed') return false;
  const completedId = `${role.id}:${task.id}`;
  if (session.completedTaskIds.includes(completedId)) return false;
  input.data = {
    ...(input.data || {}),
    pendingCompletion: input.data?.pendingCompletion || {
      toolCallId: taskToolCallIdFor(session, task.id),
      taskId: task.id,
      taskIndex: session.currentTaskIndex,
      source: source || session.taskState.finalization.mode,
      completedLocationName: task.location?.name || '',
      completedLocationStatus: session.locationState?.status,
      completedVerification: session.locationState?.verifiedBy,
    },
  };
  return true;
}

function finalizeToolResult({ session, role, input, course }) {
  const completion = input.data?.pendingCompletion;
  if (!completion) return;
  const task = role.tasks[completion.taskIndex];
  if (!task || task.id !== completion.taskId || session.currentTaskIndex !== completion.taskIndex) {
    throw new AgentActionError('任务已经切换，这次提交没有改变新任务进度。', 'TASK_SUBMISSION_EXPIRED');
  }
  if (completion.toolCallId) delete session.pendingTools[completion.toolCallId];
  for (const [callId, pending] of Object.entries(session.pendingTools || {})) {
    if (pending.name === 'open_task_tool' && pending.payload?.taskId === task.id) {
      delete session.pendingTools[callId];
    }
  }
  recordActiveTool(session, null);
  const completedId = `${role.id}:${task.id}`;
  if (!session.completedTaskIds.includes(completedId)) session.completedTaskIds.push(completedId);
  session.learningState.completedRoleStageIds = [...session.completedTaskIds];
  session.learningState.stageValidation = 'passed';
  if (session.taskState?.finalization) {
    session.taskState.finalization = {
      ...session.taskState.finalization,
      status: 'completed',
      revision: null,
    };
  }
  markMeaningfulAction(session, Date.now(), 'tool');
  setDialogueLifecycle(session, 'GIVE_FEEDBACK');
  input.data = {
    ...(input.data || {}),
    completedTaskId: completedId,
    completedTaskName: task.name,
    allTasksCompleted: session.currentTaskIndex >= role.tasks.length - 1,
  };
  // 等待态落到会话（`pendingAdvance`）而不是只写 input.data：input.data 是单次回合的
  // 载荷，而教师指令要等下一次轮询才到。改造前这两个分支只写 input.data，于是
  // `推进方式：teacher`／`ai_suggest` 的任务做完就永久卡住（见 task-advance.js 模块头）。
  const waitMode = advanceWaitModeOf(task);
  if (waitMode !== 'auto') {
    markPendingAdvance(session, { task, completedId, mode: waitMode, completion });
    session.events.push(`${completedId}:waiting-${waitMode}-advance`);
    if (waitMode === 'teacher') input.data.waitingForTeacher = true;
    else input.data.waitingForStudent = true;
    return;
  }
  const advance = advanceToNextTask({ role, session, completion, taskGraph: course?.taskGraph });
  applyAdvanceOutcome(input, role, advance);
}

export function createAgentService({
  llm,
  // 验收默认复用主模型；应用装配层会提供带独立超时预算的专用客户端。
  evaluationLlm = llm,
  store,
  getCourse,
  loadEvidence = async () => null,
  logger,
  // 语义理解用的轻量模型。未单独配置时复用主模型（同一网关，行为不变）。
  understandingLlm = llm,
  // 语义理解的总预算（含一次重试）。默认值由 understanding.js 持有。
  understandingTimeoutMs,
  // 由应用装配层持有的一次性教师命令消费器。浏览器输入无法自行提供。
  consumeTeacherCommand,
  // 应用装配层把这个入口连到 Postgres 的 runtime_state 行锁。
  // 单元测试和本地独立会话仍可以使用普通 store.save。
  persistLearnerMutation,
}) {
  const saveLearnerMutation = typeof persistLearnerMutation === 'function'
    ? persistLearnerMutation
    : (session) => store.save(session);
  const understanding = createUnderstanding({
    llm: understandingLlm,
    ...(understandingTimeoutMs ? { timeoutMs: understandingTimeoutMs } : {}),
  });
  // 决策入口（D6 乙案）：非语言输入走原有确定性规则；
  // 自由文字必经「轻量语义理解 → 确定性教学决策 → 映射为 decision」三段。
  async function resolveDecision({ input, session, course, role, nudge, task, signal }) {
    if (routeInput(input).kind === 'non_language') {
      return {
        ...classifyTurn({ input, session, course, role, nudge }),
        decisionSource: 'non_language_state',
      };
    }

    const text = String(input.text || '').trim();
    // 状态机输入与时效动作（安全/到达就绪/抱怨/无语义）先由确定性规则处理，
    // 不等模型，也不因轻量模型不可用而卡死。都不命中才做语义理解。
    const deterministic = deterministicLanguageDecision({ text, session });
    if (deterministic) return { ...deterministic, decisionSource: 'deterministic_rule' };

    const pendingQuestion = session.dialogueState?.pendingQuestion || null;
    const currentStep = currentStepOf(task, session);
    const knowledgeTerms = [
      ...titleBigrams(course.lesson?.title),
      ...(course.knowledge || []).flatMap((entry) => [
      entry.topic,
      entry.title,
      ...(entry.tags || []),
      ]),
    ];
    const result = fastUnderstanding(text, { knowledgeTerms }) || await understanding.understandTurn({
      text,
      pendingQuestion: pendingQuestion
        ? { prompt: pendingQuestion.prompt, type: pendingQuestion.kind || pendingQuestion.type || '' }
        : null,
      currentStep: currentStep
        ? { objective: currentStep.objective, studentAction: currentStep.studentAction }
        : null,
      recentMessages: (session.messages || []).slice(-4).map((item) => ({
        role: item.role,
        content: item.text || item.content || '',
      })),
      grade: session.learnerState?.grade || session.grade || '',
    }, { signal });

    const scaffolding = course?.platformDefaults?.scaffolding;
    const helpType = ['help_start', 'help_stuck', 'request_answer'].includes(result.intent)
      ? result.intent
      : 'task_help';
    const scaffoldContext = scaffoldContextForTask(task, session, helpType);
    const activeScaffold = activateScaffoldContext(session, scaffoldContext, {
      maxLevel: scaffolding?.maxLevel,
    });
    const recentTutorActions = session.conversationState?.recentTutorActions || [];
    const contextActions = ['help_start', 'help_stuck', 'request_answer'].includes(result.intent)
      ? recentTutorActions.filter((entry) => entry.contextKey === activeScaffold.key)
      : recentTutorActions;
    const tutor = decideTutorAction(result, {
      scaffoldLevel: activeScaffold.level,
      maxScaffoldLevel: scaffolding?.maxLevel,
      upgradeOnRepeatHelp: scaffolding?.upgradeOnRepeatHelp,
      pendingQuestion,
      currentStep,
      recentActions: contextActions,
      idleSeconds: Number(runtimeSnapshot(session).idleSeconds || 0),
    });

    // 待答问题的取值：先用确定性解析，读不出再用语义理解给的 yes/no。
    // 两者都读不出就降级为自然回应，绝不猜一个值去改状态机。
    const pendingResolution = tutor.action === 'advance_pending_question'
      ? pendingAnswerFrom(text, pendingQuestion, result)
      : { matched: false, value: null, confidence: 0 };
    const action = tutor.action === 'advance_pending_question' && !pendingResolution.matched
      ? 'reply_natural'
      : tutor.action;

    const decision = decisionForTutorAction(action, {
      reason: tutor.reason,
      pendingResolution,
      pendingValue: pendingResolution.value,
      entry: pendingResolution.entry,
      onboardingCompleted: Boolean(session.onboardingState?.completed),
      claimsDone: result.intent === 'claim_done',
    });

    return {
      ...decision,
      decisionSource: 'semantic_tutor_policy',
      signal: normalizeEmotion(result.emotion),
      params: tutor.params || {},
      understanding: result,
      scaffoldContext: ['help_start', 'help_stuck', 'request_answer'].includes(result.intent)
        ? { ...scaffoldContext, key: activeScaffold.key, level: activeScaffold.level }
        : null,
    };
  }

  async function createSession(input) {
    const course = await getCourse(input.courseId);
    const role = input.roleId
      ? course.roles.find((item) => item.id === input.roleId)
      : entryPhaseTrackFor(course);
    if (!role) throw new Error(`角色 ${input.roleId} 不存在。`);
    const phaseId = input.roleId ? course.lesson.roleSystem.phaseId : role.phaseId;
    const session = await store.create({
      ...input,
      roleId: input.roleId || '',
      phaseId,
      timeBalance: course.lesson.timeBank.initialBalance,
      contentVersion: course.contentVersion || '',
    });
    ensureSessionRuntime(session, role.tasks[0]);
    await store.save(session);
    return { session, course, role };
  }

  async function claimRole({ sessionId, roleId }) {
    const session = await store.get(sessionId);
    if (!session) throw new AgentActionError('会话不存在或已经失效。', 'SESSION_NOT_FOUND');
    const course = await getCourse(session.courseId);
    assertCourseContentVersion(session, course);
    const role = bindRoleToSession({ course, session, roleId });
    ensureSessionRuntime(session, role.tasks[0]);
    await saveLearnerMutation(session, {
      required: true,
      operation: 'role_claim',
      roleAssignment: true,
      requestedRoleId: role.id,
    });
    return { session, course, role };
  }

  async function forceCompleteCurrentTask({ sessionId, taskId, requestId = '' }) {
    const session = await store.get(sessionId);
    if (!session) throw new AgentActionError('会话不存在或已经失效。', 'QA_SESSION_NOT_FOUND');
    const course = await getCourse(session.courseId);
    assertCourseContentVersion(session, course);
    const role = roleFor(course, session);
    const task = currentTaskOf(role, session);
    ensureSessionRuntime(session, task);

    if (!task || task.id !== taskId) {
      throw new AgentActionError(
        '当前任务已经变化，这次验收跳关没有生效。',
        'QA_TASK_EXPIRED',
        { currentTaskId: task?.id || '' },
      );
    }

    const completedId = `${role.id}:${task.id}`;
    if (session.completedTaskIds.includes(completedId)) {
      throw new AgentActionError('当前任务已经完成，进度未重复推进。', 'QA_TASK_ALREADY_COMPLETED');
    }

    const completedAt = new Date().toISOString();
    const stepCount = guidanceSteps(task).length;
    session.taskState.guidanceStepIndex = stepCount;
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      recordStepCompletion(session, task, stepIndex);
    }
    session.pendingTools = {};
    recordActiveTool(session, null);
    clearPendingAdvance(session);
    session.completedTaskIds.push(completedId);
    session.learningState.completedRoleStageIds = [...session.completedTaskIds];
    session.learningState.stageValidation = 'passed';
    markMeaningfulAction(session, Date.now(), 'other');

    const audit = {
      type: 'qa_override',
      actor: 'platform_qa',
      roleId: role.id,
      taskId: task.id,
      taskIndex: session.currentTaskIndex,
      requestId,
      completedAt,
    };
    session.qaOverrides ||= [];
    session.qaOverrides.push(audit);
    session.events.push(`qa_override:${role.id}:${task.id}:completed`);

    const advance = advanceToNextTask({
      role,
      session,
      taskGraph: session.roleId ? course.taskGraph : null,
    });
    const events = [];
    if (advance.advanced) {
      const nextTask = currentTaskOf(role, session);
      ensureSessionRuntime(session, nextTask);
      const nextResult = appendStateDrivenTools(
        { text: '', timeline: [], toolCalls: [] },
        {
          input: {
            type: 'lifecycle_event',
            data: { advancedBy: 'qa', allTasksCompleted: false },
          },
          role,
          session,
        },
      );
      for (const item of nextResult.timeline || []) {
        if (item.type === 'stage.started') events.push(item);
      }
      for (const call of nextResult.toolCalls || []) {
        const payload = validateClientTool({ call, role, session });
        session.pendingTools[call.id] = {
          name: call.name,
          arguments: call.arguments,
          payload,
        };
        recordActiveTool(session, call.id);
        events.push({ type: 'tool.requested', data: { callId: call.id, name: call.name, payload } });
      }
    }

    const allTasksCompleted = role.tasks.every((item) => (
      session.completedTaskIds.includes(`${role.id}:${item.id}`)
    ));
    audit.advanced = Boolean(advance.advanced);
    audit.allTasksCompleted = allTasksCompleted;
    const stateEvent = {
      type: 'state.updated',
      data: {
        ...stateUpdatedData(session, 'qa_override'),
        qaOverride: { ...audit },
      },
    };
    events.push(stateEvent);
    await saveLearnerMutation(session, {
      required: true,
      operation: 'qa_force_complete',
    });
    return {
      session,
      events,
      qaOverride: stateEvent.data.qaOverride,
      advanced: Boolean(advance.advanced),
      allTasksCompleted,
    };
  }

  async function runTurn({
    sessionId,
    requestId,
    input,
    onTextDelta,
    signal,
    persistSession,
  }) {
    // 后续生命周期处理会把服务端验证结果写入 input.data。
    // 保留调用方的原始 payload，使同一对象重试仍得到相同摘要。
    input = structuredClone(input);
    const traceStartedAt = Date.now();
    throwIfAborted(signal);
    const session = await store.get(sessionId);
    if (!session) throw new Error('会话不存在或已经失效。');
    const requestDigest = learnerRequestDigest({ sessionId, input });
    const course = await getCourse(session.courseId);
    assertCourseContentVersion(session, course);
    const hasStoredReplay = (session.handledRequestResults || [])
      .some((item) => item?.requestId === requestId);
    if (session.handledRequestIds.includes(requestId) || hasStoredReplay) {
      return {
        duplicate: true,
        replayed: true,
        session,
        events: requestReplayEvents({ session, course, requestId, requestDigest }),
      };
    }
    const teacherRequirement = teacherCommandRequirement(input);
    let teacherCommandAuthorization = null;
    if (teacherRequirement) {
      if (teacherRequirement.invalid) {
        throw new AgentActionError(
          '这条教师指令的类型或参数不匹配。',
          'TEACHER_COMMAND_INVALID',
          { reason: teacherRequirement.invalid },
        );
      }
      if (!teacherRequirement.commandId) {
        throw new AgentActionError(
          '这次操作需要一条有效的教师指令。',
          'TEACHER_COMMAND_REQUIRED',
        );
      }
      if (typeof consumeTeacherCommand !== 'function') {
        throw new AgentActionError(
          '这条教师指令无法验证，进度未改变。',
          'TEACHER_COMMAND_UNAUTHORIZED',
        );
      }
      if ((session.consumedTeacherCommandIds || []).includes(teacherRequirement.commandId)) {
        throw new AgentActionError(
          '这条教师指令已经应用过，进度未重复改动。',
          'TEACHER_COMMAND_UNAUTHORIZED',
        );
      }
      const grant = await consumeTeacherCommand({
        sessionId,
        input,
        requirement: teacherRequirement,
      });
      if (
        !grant
        || String(grant.sessionId || '') !== String(sessionId)
        || String(grant.commandId || '') !== teacherRequirement.commandId
        || String(grant.action || '') !== teacherRequirement.action
      ) {
        throw new AgentActionError(
          '这条教师指令无效或已经使用过，进度未改变。',
          'TEACHER_COMMAND_UNAUTHORIZED',
        );
      }
      teacherCommandAuthorization = grant;
    }
    try {
    const traceStateBefore = traceStateSnapshot(session);
    const requestedRoleId = input.type === 'lifecycle_event' && input.event === 'role_assigned'
      ? String(input.data?.roleId || '')
      : '';
    const role = requestedRoleId
      ? bindRoleToSession({ course, session, roleId: requestedRoleId })
      : roleFor(course, session);
    let task = currentTaskOf(role, session);
    ensureSessionRuntime(session, task);
    if (['user_text', 'quick_reply'].includes(input.type)) markMeaningfulAction(session, Date.now(), 'user');
    if (input.type === 'lifecycle_event') {
      recordClientContext(session, input.data || {});
      if (input.event === 'task_step_completed') {
        if (input.data?.taskId !== task.id) {
          throw new AgentActionError('当前小步已经切换，请跟随新任务卡继续。', 'TASK_STEP_EXPIRED');
        }
        const steps = guidanceSteps(task);
        const currentIndex = Math.min(Number(session.taskState.guidanceStepIndex || 0), steps.length);
        const requestedIndex = Number(input.data?.stepIndex);
        if (
          !Number.isInteger(requestedIndex)
          || requestedIndex !== currentIndex
          || currentIndex >= steps.length
        ) {
          throw new AgentActionError(
            '当前小步已经变化，这次操作没有改动进度。',
            'TASK_STEP_EXPIRED',
          );
        }
        const expectedStepId = String(task.steps?.[currentIndex]?.id || steps[currentIndex]?.id || '');
        if (input.data?.stepId && String(input.data.stepId) !== expectedStepId) {
          throw new AgentActionError(
            '当前小步已经变化，这次操作没有改动进度。',
            'TASK_STEP_EXPIRED',
          );
        }
        if (requestedIndex === currentIndex && currentIndex < steps.length) {
          const completionMode = task.steps?.[currentIndex]?.completionMode || 'user_confirm';
          validateStepCompletion({
            task,
            stepIndex: currentIndex,
            input,
            session,
            teacherCommandAuthorization,
          });
          const teacherSkipped = input.data?.teacherOverride === true
            && teacherCommandAuthorization?.action === 'skip_step';
          if (completionMode === 'ai_evaluation' && !teacherSkipped) {
            const step = task.steps[currentIndex];
            const evaluation = await evaluateStepSubmission({
              llm, evaluationLlm, course, role, session, task, step, input, signal, logger,
            });
            session.taskState.stepAttempts ||= {};
            session.taskState.stepAttempts[step.id] = Number(session.taskState.stepAttempts[step.id] || 0) + 1;
            const maxAttempts = Number(step.maxAttempts || 0);
            input.data.aiEvaluation = {
              ...evaluation,
              teacherRecommended: !evaluation.passed && maxAttempts > 0 && session.taskState.stepAttempts[step.id] >= maxAttempts,
            };
            if (evaluation.passed) {
              acceptStepEvidence(session, {
                stepId: step.id,
                fingerprint: stepEvidenceFingerprint(input.data?.toolValues || {}, step.id),
                source: 'ai_evaluation',
              });
              session.taskState.guidanceStepIndex = currentIndex + 1;
              recordStepCompletion(session, task, currentIndex);
              markMeaningfulAction(session, Date.now(), 'tool');
            } else {
              recordStepFailure(session, task, currentIndex, evaluation.feedback);
            }
          } else {
            if (completionMode === 'ai_evaluation' && teacherSkipped) {
              const step = task.steps[currentIndex];
              acceptStepEvidence(session, {
                stepId: step.id,
                fingerprint: stepEvidenceFingerprint(input.data?.toolValues || {}, step.id),
                source: 'teacher_override',
              });
            }
            session.taskState.guidanceStepIndex = currentIndex + 1;
            recordStepCompletion(session, task, currentIndex);
            markMeaningfulAction(session, Date.now(), 'tool');
          }
        }
      }
      if (input.event === 'task_step_revised') {
        if (input.data?.taskId !== task.id) {
          throw new AgentActionError('当前任务已经切换，这次修改没有提交。', 'TASK_STEP_EXPIRED');
        }
        const requestedIndex = Number(input.data?.stepIndex);
        const currentIndex = Math.min(
          Number(session.taskState.guidanceStepIndex || 0),
          task.steps?.length || 0,
        );
        const step = task.steps?.[requestedIndex];
        const completedStepIds = session.learningState?.completedStepIds || [];
        if (
          !Number.isInteger(requestedIndex)
          || requestedIndex < 0
          || requestedIndex >= currentIndex
          || !step
          || step.id !== input.data?.stepId
          || !completedStepIds.includes(step.id)
        ) {
          throw new AgentActionError(
            '只有当前任务中已经完成的小步可以重新检查。',
            'STEP_REVISION_NOT_ALLOWED',
            { stepId: String(input.data?.stepId || ''), stepIndex: requestedIndex },
          );
        }
        if (step.completionMode === 'teacher_confirm') {
          throw new AgentActionError(
            '这一步由老师确认，修改证据后请重新请老师检查。',
            'STEP_REVISION_TEACHER_CONFIRM_REQUIRED',
            { stepId: step.id, stepIndex: requestedIndex },
          );
        }
        if (
          step.completionMode === 'compound'
          && step?.location?.mode !== 'none'
          && session.locationState?.status !== 'arrived'
        ) {
          throw new AgentActionError('这个小步还需要保持到位验证。', 'STEP_LOCATION_REQUIRED');
        }
        const tools = step?.tools?.length ? step.tools : task.tools || [];
        if (tools.length) {
          try {
            validateStepToolEvidence({ task, stepIndex: requestedIndex, input });
          } catch (error) {
            throw withStepDetails(error, step, requestedIndex);
          }
        }
        const currentFingerprint = stepEvidenceFingerprint(input.data?.toolValues || {}, step.id);
        const previous = acceptedStepEvidence(session, step.id);
        let evaluation = {
          passed: true,
          feedback: '这一步修改后的证据已重新检查并记录。',
          missing: [],
          safetyIssue: false,
        };
        let checkedBy = 'runtime_validation';
        if (step.completionMode === 'ai_evaluation') {
          checkedBy = 'ai_evaluation';
          if (previous?.fingerprint === currentFingerprint) {
            checkedBy = 'unchanged_evidence';
            evaluation.feedback = '这一步的证据没有变化，原检查结果仍然有效。';
          } else {
            evaluation = await evaluateStepSubmission({
              llm, evaluationLlm, course, role, session, task, step, input, signal, logger,
            });
            session.taskState.stepAttempts ||= {};
            session.taskState.stepAttempts[step.id] = Number(
              session.taskState.stepAttempts[step.id] || 0,
            ) + 1;
          }
        }
        if (evaluation.passed) {
          acceptStepEvidence(session, {
            stepId: step.id,
            fingerprint: currentFingerprint,
            source: checkedBy,
          });
          markMeaningfulAction(session, Date.now(), 'tool');
          session.learningState.stageValidation = 'passed';
        } else {
          session.learningState.stageValidation = 'revision_required';
        }
        input.data.aiEvaluation = evaluation;
        input.data.stepRevision = recordStepRevision(session, {
          revisionId: input.data?.revisionId,
          stepId: step.id,
          completionMode: step.completionMode,
          previousFingerprint: previous?.fingerprint || '',
          currentFingerprint,
          changed: previous?.fingerprint !== currentFingerprint,
          passed: evaluation.passed,
          checkedBy,
          feedback: evaluation.feedback,
        });
      }
      if (input.event === 'location_updated') {
        recordLocationObservation(session, input.data || {});
        markMeaningfulAction(session, Date.now(), 'other');
      }
      if (input.event === 'teacher_confirm_arrival') {
        if (input.data?.taskId && input.data.taskId !== task.id) {
          throw new AgentActionError(
            '老师确认的到达记录属于之前的任务点，当前位置未改动。',
            'TASK_STEP_EXPIRED',
          );
        }
        const locationObservedAt = Date.parse(input.data?.locationObservedAt || '');
        const locationAgeMs = Date.now() - locationObservedAt;
        if (!Number.isFinite(locationObservedAt) || locationAgeMs < 0 || locationAgeMs > 60_000) {
          throw new AgentActionError(
            '定位快照已经过期，请重新定位后让老师再确认。',
            'TEACHER_LOCATION_SNAPSHOT_STALE',
          );
        }
        recordArrival(session, 'teacher');
        confirmDialogueSlot(session, 'arrival', true);
        if (session.dialogueState?.pendingQuestion?.kind === 'arrival') {
          clearPendingQuestion(session, { outcome: 'teacher_confirmed' });
        }
        input.data = {
          ...(input.data || {}),
          arrived: true,
          verification: 'teacher',
        };
      }
      if (input.event === 'teacher_directive') {
        applyTeacherDirective({ session, course, task, data: input.data || {} });
      }
      if (['teacher_finalize_task', 'teacher_reject_task'].includes(input.event)) {
        if (String(input.data?.taskId || '') !== task.id) {
          throw new AgentActionError('当前任务已经变化，这次教师审核没有生效。', 'TASK_FINALIZATION_EXPIRED');
        }
        const rejected = input.event === 'teacher_reject_task';
        const finalization = recordTaskFinalizationEvent(session, task, {
          type: rejected ? 'teacher_rejected' : 'teacher_confirmed',
          stepId: task.steps?.at(-1)?.id || '',
          reason: String(input.data?.reason || ''),
        });
        if (!finalization.changed) {
          throw new AgentActionError(
            '这次教师审核与当前任务状态不匹配，进度未改变。',
            'TASK_FINALIZATION_TEACHER_REJECTED',
            { reason: finalization.reason },
          );
        }
        if (rejected) {
          const lastStepIndex = Math.max(0, (task.steps?.length || 1) - 1);
          const lastStepId = task.steps?.[lastStepIndex]?.id || '';
          session.taskState.guidanceStepIndex = lastStepIndex;
          session.learningState.completedStepIds = (session.learningState.completedStepIds || [])
            .filter((stepId) => stepId !== lastStepId);
          session.taskState.finalization.completedStepIds = (
            session.taskState.finalization.completedStepIds || []
          ).filter((stepId) => stepId !== lastStepId);
          delete session.taskState.stepEvidenceFingerprints?.[lastStepId];
          input.data.aiEvaluation = {
            passed: false,
            feedback: String(input.data?.reason || '老师请你修改最后一步后再次提交确认。'),
            missing: [],
          };
        } else {
          stagePendingTaskCompletion({
            session, role, task, input, source: 'teacher_confirmed',
          });
        }
      }
      // 解除"等谁推进"。两个入口共用同一套校验（task-advance.js），只有 actor 不同：
      // teacher_advance_task 走教师指令桥，student_advance_task 是学生点了「继续下一个」。
      if (['teacher_advance_task', 'student_advance_task'].includes(input.event)) {
        const actor = input.event === 'teacher_advance_task' ? 'teacher' : 'student';
        const outcome = resolvePendingAdvance({
          role,
          session,
          actor,
          taskId: String(input.data?.taskId || ''),
          taskGraph: session.roleId ? course?.taskGraph : null,
        });
        if (!outcome.ok) throw advanceRefusalError(actor, outcome.reason);
        input.data = {
          ...(input.data || {}),
          advancedBy: actor,
          continueAtSameLocation: outcome.result.continueAtSameLocation,
          previousVerification: outcome.result.previousVerification,
          allTasksCompleted: !outcome.result.advanced,
        };
        applyAdvanceOutcome(input, role, outcome.result);
        markMeaningfulAction(session, Date.now(), 'other');
      }
    }
    await applyToolResult({
      course, session, role, input, llm, evaluationLlm, signal, logger,
    });
    task = currentTaskOf(role, session);
    ensureSessionRuntime(session, task);
    stagePendingTaskCompletion({
      session,
      role,
      task,
      input,
      source: session.taskState?.finalization?.mode,
    });
    if (input.data?.continueAtSameLocation && task.location?.mode !== 'none') {
      recordArrival(session, input.data.previousVerification || 'manual');
    }
    const evidenceItems = input.type === 'tool_result' ? (input.result?.evidence || []) : [];
    const imageEvidence = evidenceItems.filter((item) => !item.mimeType || item.mimeType.startsWith('image/'));
    const images = (await Promise.all(imageEvidence.map((item) => loadEvidence(item.id)))).filter(Boolean);
    if (evidenceItems.length) {
      recordEvidenceIds(session, evidenceItems.map((item) => item.id));
      input.data = {
        ...(input.data || {}),
        imageEvidenceCount: evidenceItems.length,
        visualAnalysisAvailable: Boolean(images.length && llm.capabilities().vision),
      };
    }

    const nudge = evaluateNudge({ session, task, input });
    const decision = await resolveDecision({ input, session, course, role, nudge, task, signal });
    throwIfAborted(signal);
    // 这些回合都不推进流程，挂起待答问题以免下一轮复读它。
    // clarify_intent 同样要挂起：没读懂这句话时让"是/否"继续挂着，
    // 学生下一句一个"好"就会误确认到达。
    if ([
      'greeting', 'gratitude', 'goodbye', 'emotion', 'course_knowledge',
      'safety_help', 'social', 'activity_logistics', 'scaffold_exhausted',
      'clarify_intent',
    ].includes(decision.intent)) {
      suspendPendingQuestion(session);
    }
    updateDialogueLifecycleForDecision(session, decision);
    if (['user_text', 'quick_reply'].includes(input.type)) {
      // 升档只写当前任务 × 小步 × 求助类型；切换小步或换一种求助不会继承旧档位。
      if (decision.scaffoldContext) {
        const maxLevel = Number(course?.platformDefaults?.scaffolding?.maxLevel ?? 4);
        const nextLevel = decision.scaffoldContext.level
          + Number(decision.params?.scaffoldLevelDelta || 0);
        const active = setScaffoldContextLevel(
          session,
          decision.scaffoldContext,
          nextLevel,
          { maxLevel, source: 'automatic' },
        );
        decision.params.scaffoldLevel = active.level;
      }
      if (decision.tutorAction) {
        recordTutorAction(session, {
          intent: decision.understanding?.intent,
          action: decision.tutorAction,
          contextKey: decision.scaffoldContext?.key || '',
        });
      }
      recordIntent(session, decision.intent, decision.signal);
      // clarify_intent 与 unclear_input 同类：都是"这轮没读懂"，要累计而不是清零。
      if (!['unclear_input', 'conversation_repair', 'clarify_intent'].includes(decision.intent)) {
        clearMisunderstandings(session);
      }
    }
    if (nudge.due) recordNudge(session);

    const query = input.type === 'user_text'
      ? input.text
      : input.type === 'quick_reply'
        ? input.value
      : `${input.event || input.type} ${task?.name || ''}`;
    const recentStudentQuestions = (session.messages || [])
      .filter((message) => message.role === 'user')
      .slice(-2)
      .map((message) => message.content || message.text || '')
      .join(' ');
    const needsConversationContext = /^(?:那|它|这个|这些)|刚才|还要|缺了|缺少|还有/.test(query);
    const knowledgeQuery = decision.intent === 'course_knowledge'
      ? (needsConversationContext ? `${recentStudentQuestions} ${query}`.trim() : query)
      : query;
    const knowledge = decision.needsKnowledge
      ? retrieveKnowledge({
        course,
        session,
        role,
        query: knowledgeQuery,
        // 学生主动问知识时，以问题相关性为主；当前小步引用不能用 +100 权重
        // 把所有问题都压回同一张知识卡。验收与任务回合仍保留显式引用优先。
        references: decision.intent === 'course_knowledge'
          ? ''
          : [
            task.steps?.[Number(session.taskState?.guidanceStepIndex || 0)]?.knowledgeRef,
            task.goals,
          ].filter(Boolean).join(' '),
      })
      : [];
    // 只有真正进入主模型分支时才组装 Prompt。规则、固定话术和
    // 即时脚手架回合不伪造“已使用 Prompt”的 trace，也不做无用取料。
    let prompt = null;
    let tools = [];
    let result = { text: '', toolCalls: [] };
    let streamed = false;
    let modelFailure = null;
    let outputPath = decision.silent ? 'silent' : 'unresolved';

    if (!decision.silent) {
      const localReply = decision.intent === 'social'
        ? platformSocialReply(query, course)
        : decision.intent === 'activity_logistics'
          ? platformLogisticsReply(query, { course, session, role })
          : decision.intent === 'emotion'
            ? platformEmotionReply(query)
          : '';
      if (localReply) {
        outputPath = `local:${decision.intent}`;
        result = { text: localReply, toolCalls: [], dialogueMove: decision.intent };
      } else if (input.type === 'tool_result' && input.data?.aiEvaluation?.passed === true) {
        // 验收器已经给出经过防剧透处理的结构化反馈，直接复用即可。
        // 再调用一次主对话模型只会增加延迟，并让一次提交承担两次模型故障概率。
        outputPath = 'evaluation_feedback';
        result = {
          text: input.data.aiEvaluation.feedback || '这项提交已经达到继续条件。',
          toolCalls: [],
          dialogueMove: 'confirm_evidence',
        };
      } else if (decision.fastWorkflow) {
        outputPath = 'fast_workflow';
        result = workflowResult({ decision, role, session, course, input });
      } else if (decision.fastGuidance) {
        outputPath = 'fast_guidance';
        result.text = immediatePrelude(decision, role, session, course);
      } else {
        try {
        outputPath = 'model';
        prompt = buildAgentPrompt({
          course,
          session,
          role,
          knowledge,
          input,
          decision,
          // 教师称呼在 run 上而不是 session 上；取不到时由投影回落。
          teacherName: session.teacherName || '',
        });
        tools = toolsForDecision(decision, TOOL_DEFINITIONS);
        let shouldUseStructured = Boolean(tools.length && !llm.capabilities().nativeTools);
        // 模型原始 delta 在完整策略、trace 与持久化之前不可下发。这里仍允许 LLM
        // 客户端内部使用流式传输，但学生端只接收下面统一策略批准后的文本。
        const canStream = false;
        const prelude = canStream ? immediatePrelude(decision, role, session, course) : '';
        if (prelude) {
          streamed = true;
          onTextDelta(prelude);
        }
        const modelInstructions = prelude
          ? `${shouldUseStructured ? toolFallbackInstructions(prompt.instructions, role, session, tools) : prompt.instructions}\n已即时回应学生：“${prelude}” 请紧接着补充，避免重复。`
          : (shouldUseStructured ? toolFallbackInstructions(prompt.instructions, role, session, tools) : prompt.instructions);
        const deltaGuard = canStream ? guardedDeltaEmitter({
          course,
          session,
          emit: (text) => {
            streamed = true;
            onTextDelta(text);
          },
        }) : null;
        result = await llm.generate({
          instructions: modelInstructions,
          messages: prompt.messages,
          tools,
          images,
          jsonMode: shouldUseStructured,
          onTextDelta: canStream ? (text) => deltaGuard.push(text) : undefined,
          signal,
        });
        throwIfAborted(signal);
        deltaGuard?.flush();
        if (prelude) result.text = `${prelude}${result.text ? ` ${result.text}` : ''}`;
        if (input.data?.visualAnalysisAvailable && !llm.capabilities().vision) input.data.visualAnalysisAvailable = false;
        if (shouldUseStructured) {
          result = parseStructuredFallback(result.text);
        }

        if (!result.text && result.toolCalls.length) {
          result = { ...result, text: toolNarration(result.toolCalls[0], role, session, course) };
        }

        if (deltaGuard?.isBlocked()) outputPath = 'model:protected_blocked';
        if (decision.intent === 'course_knowledge') {
          result.text = result.text.replaceAll(
            '根据我的认知',
            knowledge.length ? '根据这份课程材料' : '按当前可用材料',
          );
        }
        } catch (error) {
          if (signal?.aborted || error?.name === 'AbortError') throw error;
          modelFailure = error;
          outputPath = 'degraded';
          logger?.warn?.({
            modelError: {
              name: error?.name || 'Error',
              code: error?.code || null,
              status: Number.isInteger(error?.status) ? error.status : null,
            },
          }, 'model request degraded');
          const prelude = immediatePrelude(decision, role, session, course);
          streamed = Boolean(prelude);
          result = {
            text: prelude || degradedReply(decision, role, session, course),
            toolCalls: [],
          };
        }
      }
    }

    const taskIndexBeforeFinalize = session.currentTaskIndex;
    finalizeToolResult({ session, role, input, course: session.roleId ? course : null });
    if (input.data?.advanceBlockedMessage) {
      result = { ...result, text: input.data.advanceBlockedMessage, toolCalls: [] };
    }
    if (session.currentTaskIndex !== taskIndexBeforeFinalize) {
      task = currentTaskOf(role, session);
      ensureSessionRuntime(session, task);
      if (input.data?.continueAtSameLocation && task.location?.mode !== 'none') {
        recordArrival(session, input.data.previousVerification || 'manual');
      }
    }
    result = appendStateDrivenTools(result, { input, role, session });

    const events = [];
    const policy = createStudentFacingPolicy({ course, session });
    const policyActions = [...(input.data?.aiEvaluation?.policyActions || [])];
    const responseSource = sourceMeta(knowledge, input, decision);
    const primarySelection = selectTurnPrimaryAction({
      toolCalls: (result.toolCalls || []).filter((item) => item.name !== 'retrieve_course_knowledge'),
      quickReplies: result.quickReplies || [],
    });
    result.toolCalls = primarySelection.toolCalls;
    result.quickReplies = primarySelection.quickReplies;
    policyActions.push(...primarySelection.issues.map((issue) => `turn_plan:${issue}`));
    if (result.text) {
      const mainResponse = policy.processText(result.text, {
        channel: 'assistant',
        intent: decision.intent,
        dialogueMove: result.dialogueMove || decision.intent,
      });
      result.text = mainResponse.text;
      policyActions.push(...mainResponse.actions.map((action) => `assistant:${action}`));
      if (onTextDelta && outputPath.startsWith('model') && mainResponse.text) {
        onTextDelta(mainResponse.text);
        streamed = true;
      }
      session.messages.push({ role: 'user', content: query, createdAt: new Date().toISOString() });
      session.messages.push({ role: 'assistant', content: result.text, createdAt: new Date().toISOString() });
      const parts = mainResponse.parts;
      parts.forEach((text, partIndex) => events.push({
        type: 'assistant.completed',
        data: {
          id: `msg_${crypto.randomUUID()}`,
          text,
          source: responseSource,
          intent: decision.intent,
          dialogueMove: result.dialogueMove || decision.intent,
          streamed: streamed && partIndex === 0,
          degraded: Boolean(modelFailure),
          partIndex,
          partCount: parts.length,
        },
      }));
      recordDialogueMove(session, {
        move: result.dialogueMove || decision.intent,
        text: result.text,
      });
    }

    for (const item of result.timeline || []) {
      if (item.type === 'stage.started') {
        const stageSurface = policy.processSurface(item.data, { channel: 'stage' });
        policyActions.push(...stageSurface.actions);
        events.push({ ...item, data: stageSurface.value });
        continue;
      }
      if (item.type !== 'assistant' || !item.text) continue;
      const timelineResponse = policy.processText(item.text, {
        channel: 'timeline',
        intent: decision.intent,
        dialogueMove: item.dialogueMove || result.dialogueMove || decision.intent,
      });
      const timelineText = timelineResponse.text;
      policyActions.push(...timelineResponse.actions.map((action) => `timeline:${action}`));
      session.messages.push({ role: 'assistant', content: timelineText, createdAt: new Date().toISOString() });
      const parts = timelineResponse.parts;
      parts.forEach((text, partIndex) => events.push({
        type: 'assistant.completed',
        data: {
          id: `msg_${crypto.randomUUID()}`,
          text,
          source: responseSource,
          intent: decision.intent,
          dialogueMove: item.dialogueMove || result.dialogueMove || decision.intent,
          streamed: false,
          degraded: false,
          partIndex,
          partCount: parts.length,
        },
      }));
      recordDialogueMove(session, {
        move: item.dialogueMove || result.dialogueMove || decision.intent,
        text: timelineText,
      });
    }

    if (result.quickReplies?.length) {
      const quickReplySurface = policy.processSurface(result.quickReplies.slice(0, 3), {
        channel: 'quick_replies',
      });
      policyActions.push(...quickReplySurface.actions);
      events.push({
        type: 'ui.quick_replies',
        data: {
          questionId: session.dialogueState?.pendingQuestion?.id || null,
          options: quickReplySurface.value,
        },
      });
    }

    for (const call of result.toolCalls || []) {
      const rawPayload = validateClientTool({ call, role, session });
      const toolSurface = policy.processSurface(rawPayload, { channel: `tool:${call.name}` });
      const payload = toolSurface.value;
      policyActions.push(...toolSurface.actions);
      if (call.name === 'show_navigation') {
        for (const [pendingId, pending] of Object.entries(session.pendingTools)) {
          if (pending.name === 'show_navigation' && pending.payload?.taskId === payload.taskId) {
            delete session.pendingTools[pendingId];
          }
        }
      }
      session.pendingTools[call.id] = { name: call.name, arguments: call.arguments, payload };
      recordActiveTool(session, call.id);
      events.push({ type: 'tool.requested', data: { callId: call.id, name: call.name, payload } });
    }

    const traceStateAfter = traceStateSnapshot(session);
    const turnPlan = planTurnPresentation(events, {
      primaryAction: primarySelection.primaryAction,
      issues: primarySelection.issues,
      stateChanges: summarizeTurnStateChanges(traceStateBefore, traceStateAfter),
      source: responseSource,
    });
    events.splice(0, events.length, ...turnPlan.events);
    throwIfAborted(signal);
    events.push({
      type: 'state.updated',
      data: { ...stateUpdatedData(session, decision.intent), turnPlan: turnPlan.summary },
    });
    if (teacherCommandAuthorization?.commandId) {
      session.consumedTeacherCommandIds ||= [];
      if (!session.consumedTeacherCommandIds.includes(teacherCommandAuthorization.commandId)) {
        session.consumedTeacherCommandIds.push(teacherCommandAuthorization.commandId);
        if (session.consumedTeacherCommandIds.length > 200) {
          session.consumedTeacherCommandIds = session.consumedTeacherCommandIds.slice(-200);
        }
      }
    }
    const trace = buildTurnTrace({
      requestId,
      startedAt: traceStartedAt,
      course,
      input,
      stateBefore: traceStateBefore,
      stateAfter: traceStateAfter,
      decision,
      prompt: outputPath.startsWith('model') ? prompt : null,
      outputPath,
      outputText: events
        .filter((event) => event.type === 'assistant.completed')
        .map((event) => event.data?.text || '')
        .join(''),
      events,
      turnPlan: turnPlan.summary,
      policyVersion: policy.version || STUDENT_FACING_POLICY_VERSION,
      policyActions,
      degraded: Boolean(modelFailure),
      streamed,
      teacherCommand: teacherCommandAuthorization?.commandId ? {
        teacherCommandId: teacherCommandAuthorization.commandId,
        action: teacherCommandAuthorization.action,
      } : null,
    });
    const replayEnvelope = createReplayEnvelope({ events, trace, requestDigest });
    rememberRequestResult(session, requestId, replayEnvelope, { requestDigest });
    appendTurnTrace(session, trace);
    const runtimeGuard = {
      required: true,
      operation: 'learner_turn',
      roleAssignment: input.type === 'lifecycle_event' && input.event === 'role_assigned',
      requestedRoleId,
      teacherCommandId: teacherCommandAuthorization?.commandId || '',
      teacherCommandAction: teacherCommandAuthorization?.action || '',
    };
    if (persistSession) {
      await persistSession({ session, events, trace, replayEnvelope, runtimeGuard });
    } else {
      await saveLearnerMutation(session, runtimeGuard);
    }
    try {
      await teacherCommandAuthorization?.commit?.();
    } catch (error) {
      logger?.warn?.({ err: error, commandId: teacherCommandAuthorization?.commandId }, 'teacher command receipt commit delayed');
    }
    await teacherCommandAuthorization?.release?.();
    return { duplicate: false, session, events, streamed, trace, replayEnvelope };
    } catch (error) {
      await teacherCommandAuthorization?.release?.();
      throw error;
    }
  }

  async function answerTimeBank({ sessionId, taskId, answer, evidence = [], location }) {
    const session = await store.get(sessionId);
    if (!session) throw new Error('会话不存在或已经失效。');
    const course = await getCourse(session.courseId);
    assertCourseContentVersion(session, course);
    const bank = course.lesson.timeBank;
    const task = bank.tasks.find((item) => item.id === taskId);
    if (!task || session.completedBankTaskIds.includes(taskId)) throw new Error('该时间银行任务不可用。');
    const requiredPhase = Number.parseInt(task.unlockAfter?.match(/phase(\d+)/i)?.[1], 10);
    if (requiredPhase && session.phaseNumber < requiredPhase) throw new Error('该时间银行任务尚未解锁。');
    if (task.answerType === 'open_ended' && String(answer || '').trim().length < task.minLength) {
      throw new Error(`请至少写 ${task.minLength} 个字，再提交回答。`);
    }
    if (task.type === 'photo_checkpoint') {
      if (!evidence.length) return { correct: false, hint: '请先拍摄并上传本题要求的现场照片。' };
      if (task.verify === 'image_and_text' && String(answer || '').trim().length < 4) {
        return { correct: false, hint: '照片之外，再补充展项标题、日期或一句说明。' };
      }
      recordEvidenceIds(session, evidence.map((item) => item.id));
    }
    if (task.type === 'location_checkin') {
      if (!location || task.location.length < 2) return { correct: false, hint: '没有取得有效位置，请允许定位后重试。' };
      const [targetLng, targetLat] = task.location;
      const radians = (degrees) => degrees * (Math.PI / 180);
      const dLat = radians(location.lat - targetLat);
      const dLng = radians(location.lng - targetLng);
      const value = Math.sin(dLat / 2) ** 2
        + Math.cos(radians(targetLat)) * Math.cos(radians(location.lat)) * Math.sin(dLng / 2) ** 2;
      const distance = 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
      const allowance = Number(task.radius || 0) + Math.min(Number(location.accuracyMeters || 0), 100);
      if (distance > allowance) return { correct: false, hint: `当前位置距离签到范围约 ${Math.round(distance)} 米，请跟随老师到达集合区域后再试。` };
    }
    const correct = task.answerType === 'open_ended'
      || task.type !== 'quiz'
      || String(answer) === String(task.answer);
    if (!correct) return { correct: false, hint: task.hint || '这次没有答对，再观察一下题目。' };
    if (bank.earnRules.maxPerTask && task.reward > bank.earnRules.maxPerTask) throw new Error('任务奖励超过课程单题上限。');
    if (bank.earnRules.maxTotal && session.timeEarned + task.reward > bank.earnRules.maxTotal) throw new Error('已达到课程赚取上限。');
    session.completedBankTaskIds.push(taskId);
    session.timeBalance += task.reward;
    session.timeEarned += task.reward;
    await saveLearnerMutation(session, {
      required: true,
      operation: 'time_bank_answer',
    });
    return { correct: true, reward: task.reward, balance: session.timeBalance, completedTaskIds: session.completedBankTaskIds };
  }

  async function giftTime({ sessionId, roleId, amount }) {
    const session = await store.get(sessionId);
    if (!session) throw new Error('会话不存在或已经失效。');
    const course = await getCourse(session.courseId);
    assertCourseContentVersion(session, course);
    const role = course.roles.find((item) => item.id === roleId);
    if (!role) throw new Error('赠送对象不存在。');
    const rules = course.lesson.timeBank.giftRules;
    if (!Number.isFinite(amount) || amount < rules.minAmount || amount > rules.maxPerAction) throw new Error('赠送数量不符合课程规则。');
    if (!rules.allowGiftToSelf && roleId === session.roleId) throw new Error('不能赠送给自己。');
    if (session.timeBalance < amount) throw new Error('时间余额不足。');
    session.timeBalance -= amount;
    session.gifts.push({ roleId, amount, createdAt: new Date().toISOString() });
    await saveLearnerMutation(session, {
      required: true,
      operation: 'time_bank_gift',
    });
    return { balance: session.timeBalance };
  }

  async function replayCompletedRequest({ sessionId, requestId, input, replayEnvelope }) {
    const session = await store.get(sessionId);
    if (!session) throw new Error('会话不存在或已经失效。');
    const course = await getCourse(session.courseId);
    assertCourseContentVersion(session, course);
    const requestDigest = learnerRequestDigest({ sessionId, input });
    return {
      session,
      events: requestReplayEvents({
        session,
        course,
        requestId,
        requestDigest,
        replayEnvelope,
      }),
    };
  }

  return {
    createSession,
    claimRole,
    runTurn,
    replayCompletedRequest,
    forceCompleteCurrentTask,
    answerTimeBank,
    giftTime,
  };
}
