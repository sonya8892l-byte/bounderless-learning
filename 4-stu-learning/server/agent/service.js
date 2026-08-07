import crypto from 'node:crypto';
import { buildAgentPrompt, platformRuleInstructions, taskScaffoldHint } from './prompt.js';
import { PLATFORM_COMPANION } from '../../src/engine/platform-config.js';
import { TOOL_DEFINITIONS, validateClientTool } from './tools.js';
import { findSpoiler, retrieveKnowledge } from '../course/retrieval.js';
import { resolveStepRestrictions } from '../course/restriction-sections.js';
import { evaluateNudge, recordNudge } from './nudge-policy.js';
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
  recordTutorAction,
  runtimeSnapshot,
  setDialogueLifecycle,
  suspendPendingQuestion,
} from './session-state.js';
import {
  classifyTurn,
  decisionForTutorAction,
  deterministicLanguageDecision,
  fastConversationReply,
  resolvePendingAnswer,
  routeInput,
  toolsForDecision,
} from './turn-router.js';
import { createUnderstanding } from './understanding.js';
import { decideTutorAction } from './tutor-policy.js';
import {
  applyGradeResponsePolicy,
  applyPendingAnswer,
  arrivalQuestion,
  askQuestion,
  avoidRepeatedReply,
  conversationRepair,
  nextOnboardingQuestion,
  readinessQuestion,
  taskRequiresArrival,
  unclearInputReply,
} from './dialogue-policy.js';
import { parseTurnUnderstanding, understandingInstructions } from './turn-understanding.js';

export class AgentActionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AgentActionError';
    this.code = code;
    this.details = details;
  }
}

function roleFor(course, session) {
  const role = course.roles.find((item) => item.id === session.roleId);
  if (!role) throw new Error(`会话角色 ${session.roleId} 不存在。`);
  return role;
}

function sourceMeta(knowledge, input, decision) {
  if (knowledge.length) {
    return {
      mode: 'course',
      label: `[课程知识库｜${knowledge[0].source}]`,
      citations: knowledge.map(({ id, topic, source }) => ({ id, title: topic, source })),
    };
  }
  if (decision.sourceMode === 'course-config' || input.type !== 'user_text') {
    return { mode: 'course-config', label: '', citations: [] };
  }
  if (decision.needsKnowledge) return { mode: 'model', label: '[根据AI已有知识]', citations: [] };
  return { mode: 'conversation', label: '', citations: [] };
}

function toolFallbackInstructions(instructions, role, session, tools) {
  const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
  const instance = role.tools.find((tool) => tool.taskIndex === session.currentTaskIndex);
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

function validateStepCompletion({ task, stepIndex, input, session }) {
  const step = task.steps?.[stepIndex];
  const mode = step?.completionMode || 'user_confirm';
  if (input.data?.teacherOverride === true && input.data?.teacherCommandId) return;
  if (mode === 'teacher_confirm') {
    if (input.data?.teacherApproved === true) return;
    throw new AgentActionError('这一步需要老师确认，请先呼叫老师或等待教师端处理。', 'STEP_TEACHER_CONFIRM_REQUIRED');
  }
  if (mode === 'location_event' && session.locationState?.status !== 'arrived') {
    throw new AgentActionError('到达指定地点并完成位置验证后，这一步才会通过。', 'STEP_LOCATION_REQUIRED');
  }
  if (mode === 'compound' && step?.location?.mode !== 'none' && session.locationState?.status !== 'arrived') {
    throw new AgentActionError('这个小步还需要完成到位验证。', 'STEP_LOCATION_REQUIRED');
  }
  if (mode === 'user_confirm') return;
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
    if (tool.id === 'media' && config.requireCompletion !== false && !value.completed) {
      throw new AgentActionError('请先查看完课程材料。', 'STEP_MEDIA_INCOMPLETE');
    }
    if (tool.id === 'scanner') {
      if (!value.result) throw new AgentActionError('请先完成扫码或识别。', 'STEP_SCAN_REQUIRED');
      if (config.expectedResults?.length && !config.expectedResults.map(String).includes(String(value.result))) {
        throw new AgentActionError('识别结果与本课程小步不匹配，请核对后重试。', 'STEP_SCAN_MISMATCH');
      }
    }
  }
}

function parseEvaluationResult(text = '') {
  const source = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/gi, '');
  try {
    const result = JSON.parse(source);
    if (typeof result.passed !== 'boolean') return null;
    return {
      passed: result.passed,
      feedback: String(result.feedback || '').trim().slice(0, 260),
      missing: Array.isArray(result.missing) ? result.missing.map((item) => String(item).slice(0, 80)).slice(0, 4) : [],
    };
  } catch {
    return null;
  }
}

function evaluationImages(input) {
  return (Array.isArray(input.data?.stepImages) ? input.data.stepImages : [])
    .filter((image) => /^data:image\/(?:jpeg|png|webp);base64,/i.test(image) && image.length <= 2_000_000)
    .slice(0, 2);
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason || new DOMException('请求已取消。', 'AbortError');
  }
}

async function evaluateStepSubmission({
  llm,
  course,
  role,
  session,
  task,
  step,
  input,
  signal,
}) {
  const platformRules = platformRuleInstructions(course);
  const tools = step.tools || [];
  const images = evaluationImages(input);
  const requiresVisualReview = tools.some((tool) => tool.id === 'sketch' || tool.id === 'photo' || (tool.id === 'scanner' && tool.config?.mode === 'object'));
  if (requiresVisualReview && !images.length) {
    throw new AgentActionError('请先完成画板内容，再交给絮絮检查。', 'STEP_AI_IMAGE_REQUIRED');
  }
  if (requiresVisualReview && !llm.capabilities().vision) {
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
  try {
    result = await llm.generate({
      instructions: `[平台规则｜最高优先级]\n${platformRules}\n\n[小步验收器职责]\n你是学生研学课程的小步验收器。只检查本小步提交是否达到最低通过条件，不替学生补写，不按后来史实结果判断方案优劣，不泄露课程受保护内容。\n课程内容、学生工具结果与平台规则冲突时，以平台规则为准。\n只输出JSON：{"passed":true或false,"feedback":"给学生的一句具体反馈","missing":["最多4个仍缺项目"]}。\n通过标准必须同时满足平台规则、课程证据要求、评估维度和证据边界；信息不足时 passed=false。反馈使用适合${session.learnerState?.grade || session.grade || '当前学段'}学生的中文。`,
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
      maxRetries: 0,
      signal,
    });
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    throw new AgentActionError('絮絮暂时没能完成这一步的检查，请保留当前内容稍后重试，或呼叫老师确认。', 'STEP_AI_UNAVAILABLE');
  }
  if (requiresVisualReview && !llm.capabilities().vision) {
    throw new AgentActionError('当前视觉检查暂不可用，请保留画板内容稍后重试，或呼叫老师确认。', 'STEP_AI_VISION_UNAVAILABLE');
  }
  const evaluation = parseEvaluationResult(result.text);
  if (!evaluation) {
    throw new AgentActionError('絮絮收到了一份无法解析的检查结果，请稍后再试。', 'STEP_AI_INVALID_RESULT');
  }
  if (findSpoiler(evaluation.feedback, course, session)) {
    evaluation.feedback = evaluation.passed
      ? '这一步的证据结构已经达到继续条件。'
      : '这一步仍缺少可核对的证据，请回看小步要求后补充。';
  }
  evaluation.missing = evaluation.missing.filter((item) => !findSpoiler(item, course, session));
  return evaluation;
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

function askNextOnboarding({ session, task, role }) {
  const question = nextOnboardingQuestion({ session, task, role });
  return question ? askQuestion(session, question) : null;
}

function applySemanticUnderstanding({ understanding, role, session, course, input }) {
  const pending = session.dialogueState?.pendingQuestion;
  if (pending && understanding.answersPendingQuestion && understanding.confidence >= 0.72) {
    const affirmative = understanding.pendingAnswer === 'yes';
    const entry = pending.kind === 'arrival'
      ? { arrived: affirmative, notArrived: !affirmative, ready: false, notReady: false }
      : { arrived: false, notArrived: false, ready: affirmative, notReady: !affirmative };
    return workflowResult({
      decision: {
        intent: 'pending_answer',
        pendingResolution: { matched: true, value: affirmative, confidence: understanding.confidence, entry },
        entry,
      },
      role,
      session,
      course,
      input,
    });
  }
  if (understanding.speechAct === 'complaint') {
    return workflowResult({ decision: { intent: 'conversation_repair' }, role, session, course, input });
  }
  if (understanding.speechAct === 'request_navigation') {
    return workflowResult({ decision: { intent: 'onboarding_navigation' }, role, session, course, input });
  }
  if (understanding.speechAct === 'request_teacher') {
    suspendPendingQuestion(session);
    return workflowResult({ decision: { intent: 'safety_help' }, role, session, course, input });
  }
  if (understanding.speechAct === 'unclear') {
    return { ...unclearInputReply(session), toolCalls: [] };
  }
  if (['greeting', 'emotion', 'course_question', 'social'].includes(understanding.speechAct)) {
    suspendPendingQuestion(session);
  }
  if (understanding.speechAct === 'emotion') setDialogueLifecycle(session, 'EMOTIONAL_SUPPORT');
  return {
    text: understanding.reply || '我听见了。你愿意再多说一点吗？',
    toolCalls: [],
    dialogueMove: understanding.dialogueMove,
    quickReplies: [],
  };
}

function workflowResult({ decision, role, session, course, input }) {
  const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
  const tool = role.tools.find((item) => item.taskIndex === session.currentTaskIndex);
  if (decision.intent === 'role_assigned') {
    if (!taskRequiresArrival(task) || session.locationState?.status === 'arrived') {
      confirmDialogueSlot(session, 'arrival', true);
    }
    const next = askNextOnboarding({ session, task, role });
    if (!next) return startCurrentRoleStage({ session, task, tool });
    return {
      ...next,
      text: `欢迎你，${role.name}！我是${PLATFORM_COMPANION.name}。${next.text}`,
      toolCalls: [],
    };
  }
  if (decision.intent === 'quick_reply_stale') {
    const next = askNextOnboarding({ session, task, role });
    return {
      ...(next || {}),
      text: next ? `刚才的选项已经失效了。${next.text}` : '刚才的选项已经失效了，我们按当前进度继续。',
      toolCalls: [],
      dialogueMove: 'repair_stale_action',
    };
  }
  if (decision.intent === 'conversation_repair') return { ...conversationRepair(session), toolCalls: [] };
  if (decision.intent === 'unclear_input') return { ...unclearInputReply(session), toolCalls: [] };
  if (decision.intent === 'onboarding_not_arrived' || decision.intent === 'onboarding_navigation') {
    confirmDialogueSlot(session, 'arrival', !taskRequiresArrival(task));
    if (!taskRequiresArrival(task)) {
      const next = askNextOnboarding({ session, task, role });
      return { ...next, text: `这个任务没有指定地点。${next.text}`, toolCalls: [] };
    }
    const question = arrivalQuestion(task, role);
    askQuestion(session, question);
    return {
      text: `好，先跟紧小组和老师。我把前往“${task.location?.name || role.location}”的高德地图打开，到了再告诉我。`,
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
    const question = readinessQuestion(task);
    askQuestion(session, question);
    return {
      text: '好，我等你。先检查队伍、物品和周围安全，准备好时告诉我。',
      toolCalls: [],
      dialogueMove: 'wait_for_readiness',
      quickReplies: [{ id: 'readiness-yes', label: '现在开始', value: '我准备好了' }],
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
      const question = arrivalQuestion(task, role);
      askQuestion(session, question);
      return {
        text: `知道了。我把去“${task.location?.name || role.location}”的高德地图打开，你跟着老师和小组移动。`,
        toolCalls: taskRequiresArrival(task) ? [navigationToolCall(task)] : [],
        dialogueMove: 'support_navigation',
        quickReplies: [],
      };
    }
    if (decision.entry?.notReady || (resolved?.pending.kind === 'readiness' && resolved.value === false)) {
      const question = readinessQuestion(task);
      askQuestion(session, question);
      return {
        text: '好，我等你。准备好时告诉我就行。',
        toolCalls: [],
        dialogueMove: 'wait_for_readiness',
        quickReplies: [{ id: 'readiness-yes', label: '现在开始', value: '我准备好了' }],
      };
    }
    const next = askNextOnboarding({ session, task, role });
    if (next) {
      return {
        ...next,
        text: resolved?.pending.kind === 'arrival' ? `到达确认了。${next.text}` : next.text,
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
    const next = askNextOnboarding({ session, task, role });
    if (next) return { ...next, toolCalls: [] };
    return startCurrentRoleStage({ session, task, tool });
  }
  if (decision.intent === 'navigation_completed') {
    confirmDialogueSlot(session, 'arrival', true);
    if (session.dialogueState?.pendingQuestion?.kind === 'arrival') {
      clearPendingQuestion(session, { outcome: 'tool_confirmed' });
    }
    if (!session.onboardingState.completed) {
      const next = askNextOnboarding({ session, task, role });
      if (next) return { ...next, text: `已经到位了。${next.text}`, toolCalls: [] };
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
          ? `到位验证通过。现在做第${stepIndex + 1}小步：${steps[stepIndex]}。`
          : '到位验证通过，这个阶段的小步已经完成，可以整理结果提交。',
        toolCalls: [],
        dialogueMove: 'guide_current_step',
        quickReplies: [],
      };
    }
    return {
      text: `已经回到“${task.name}”，我们接着当前小步继续。`,
      toolCalls: [taskToolCall(tool, '继续当前任务')],
      dialogueMove: 'resume_current_step',
      quickReplies: [],
    };
  }
  if (decision.intent === 'navigation') {
    if (task.location?.mode === 'none') {
      return { text: `当前“${task.name}”不需要前往指定地点，可以直接继续。`, toolCalls: [], dialogueMove: 'clarify_location', quickReplies: [] };
    }
    return {
      text: `我把前往“${task.location?.name || role.location}”的高德地图打开了。请跟随老师统一移动，现场路线变化以老师引导为准。`,
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
      text: '收到，我现在帮你呼叫老师。先停在安全的位置，不要独自继续移动。',
      toolCalls: [{
        id: `call_${crypto.randomUUID()}`,
        name: 'call_teacher',
        arguments: { reason: String(input.text || '学生请求老师帮助').slice(0, 120) },
      }],
      dialogueMove: 'escalate_safety',
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
        setDialogueLifecycle(session, currentIndex + 1 < steps.length ? 'GUIDE_CURRENT_STEP' : 'WAIT_FOR_TOOL_RESULT');
        return {
          text: currentIndex + 1 < steps.length
            ? `好，第${currentIndex + 1}小步记下了。现在做第${currentIndex + 2}小步：${steps[currentIndex + 1]}。`
            : `好，这个阶段的${steps.length}个小步都记下了。现在整理任务卡里的照片或记录，提交给我检查。`,
          toolCalls: [],
          dialogueMove: currentIndex + 1 < steps.length ? 'guide_current_step' : 'request_required_evidence',
          quickReplies: [],
        };
      }
      return { text: `收到。请在“${task.name}”任务卡中提交记录或照片，我会根据提交内容帮你检查。`, toolCalls: [], dialogueMove: 'request_required_evidence', quickReplies: [] };
    }
    const arrived = task.location?.mode === 'none' || session.locationState?.status === 'arrived';
    return {
      text: arrived
        ? `好，我们继续“${task.name}”。我把任务工具打开了，有发现随时告诉我。`
        : `好，我们先去“${task.location?.name || role.location}”。我把高德地图打开了。`,
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
      const missing = evaluation.missing?.length ? ` 还需要：${evaluation.missing.join('、')}。` : '';
      const teacherHint = evaluation.teacherRecommended ? ' 已达到本步最大尝试次数，可以呼叫老师一起看。' : '';
      return {
        text: `${evaluation.feedback || '这一步还需要补充。'}${missing}${teacherHint}`,
        toolCalls: [],
        dialogueMove: 'request_step_revision',
        quickReplies: [],
      };
    }
    if (stepIndex < steps.length) {
      setDialogueLifecycle(session, 'GUIDE_CURRENT_STEP');
      return {
        text: `${input.data?.aiEvaluation?.feedback ? `${input.data.aiEvaluation.feedback} ` : ''}第${stepIndex}小步完成了。现在做第${stepIndex + 1}小步：${steps[stepIndex]}。`,
        toolCalls: [],
        dialogueMove: 'guide_current_step',
        quickReplies: [],
      };
    }
    setDialogueLifecycle(session, 'WAIT_FOR_TOOL_RESULT');
    return {
      text: `很好，这个阶段的${steps.length}个小步都完成了。现在整理好照片或记录，在任务卡里提交给我检查。`,
      toolCalls: [],
      dialogueMove: 'request_required_evidence',
      quickReplies: [],
    };
  }
  if (decision.intent === 'proactive_nudge') {
    if (decision.nudge?.reason === 'location_pending' && task.location?.mode !== 'none') {
      return {
        text: `还顺利吗？如果没找到“${task.location?.name || role.location}”，我把高德地图再放到这里。`,
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
      text: `还顺利吗？可以先试这一小步：${taskScaffoldHint(task, session.scaffoldLevel, session.taskState?.guidanceStepIndex, currentStepOf(task, session))}`,
      toolCalls: [],
      dialogueMove: 'proactive_support',
      quickReplies: [],
    };
  }
  return { text: '', toolCalls: [], dialogueMove: decision.intent, quickReplies: [] };
}

function degradedReply(decision, role, session, course) {
  const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
  if (decision.intent === 'emotion') return '我在听。你可以慢一点说，我会陪你一起理清。';
  if (['task_help', 'task_followup', 'course_knowledge', 'tool_result'].includes(decision.intent)) {
    return `我收到啦。先从“${task.name}”里最确定的一条现场线索开始，把它告诉我，我继续陪你分析。`;
  }
  if (decision.intent === 'proactive_nudge') return '';
  return `我听见了，不过这句话我还没完全接住。你愿意再多说一点吗？`;
}

function immediatePrelude(decision, role, session) {
  const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
  if (['task_help', 'task_followup'].includes(decision.intent)) {
    return `我在。先试一个小步骤：${taskScaffoldHint(task, session.scaffoldLevel, session.taskState?.guidanceStepIndex, currentStepOf(task, session))}`;
  }
  if (decision.intent === 'emotion') return '我在听，你慢慢说。';
  if (decision.intent === 'tool_result') return '我收到你的提交了，正在看这条证据。';
  if (decision.intent === 'course_knowledge') return '我先按课程材料帮你核对。';
  if (decision.intent === 'social') return '嗯嗯，我在听～';
  return '';
}

function knowledgeExcerptReply(knowledge) {
  const content = String(knowledge[0]?.content || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!content) return '';
  const excerpt = content.length > 110 ? `${content.slice(0, 108)}……` : content;
  return `根据课程材料，${excerpt}`;
}

function toolNarration(call, role, session) {
  const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
  if (call?.name === 'show_navigation') return `我把前往“${task.location?.name || role.location}”的高德地图打开了。`;
  if (call?.name === 'open_task_tool') return `我把“${task.name}”任务工具打开了，我们继续。`;
  if (call?.name === 'call_teacher') return '我现在帮你呼叫老师，请先停在安全的位置。';
  return '我已经打开接下来需要的工具。';
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
  if (input.type !== 'tool_result' || input.result?.status !== 'completed') return result;
  if (input.data?.resolvedTool !== 'open_task_tool' || !input.data?.completedTaskId || input.data?.allTasksCompleted) return result;
  if (result.toolCalls?.length) return result;
  const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
  const tool = role.tools.find((item) => item.taskIndex === session.currentTaskIndex);
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

function applyToolResult({ course, session, role, input }) {
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
    const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
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
  const task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
  const steps = guidanceSteps(task);
  const completedSteps = Math.min(Number(session.taskState?.guidanceStepIndex || 0), steps.length);
  if (completedSteps < steps.length) {
    throw new AgentActionError(
      `请先完成当前小步（${completedSteps + 1}/${steps.length}），絮絮会继续带你做。`,
      'TASK_STEPS_PENDING',
      { completed: completedSteps, total: steps.length },
    );
  }
  const completedLocationName = task.location?.name || '';
  const completedLocationStatus = session.locationState?.status;
  const completedVerification = session.locationState?.verifiedBy;
  const evidence = input.result?.evidence || [];
  const text = String(input.result?.values?.text || '').trim();
  const toolValues = input.result?.values?.toolValues || {};
  const minimum = Number(pending.payload?.config?.minEvidenceCount || 1);
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
  input.data = {
    ...(input.data || {}),
    submissionTaskId: task.id,
    submissionTaskName: task.name,
    pendingCompletion: {
      toolCallId: input.toolCallId,
      taskId: task.id,
      taskIndex: session.currentTaskIndex,
      completedLocationName,
      completedLocationStatus,
      completedVerification,
    },
  };
}

function finalizeToolResult({ session, role, input }) {
  const completion = input.data?.pendingCompletion;
  if (!completion) return;
  const task = role.tasks[completion.taskIndex];
  if (!task || task.id !== completion.taskId || session.currentTaskIndex !== completion.taskIndex) {
    throw new AgentActionError('任务已经切换，这次提交没有改变新任务进度。', 'TASK_SUBMISSION_EXPIRED');
  }
  delete session.pendingTools[completion.toolCallId];
  recordActiveTool(session, null);
  const completedId = `${role.id}:${task.id}`;
  if (!session.completedTaskIds.includes(completedId)) session.completedTaskIds.push(completedId);
  session.learningState.completedRoleStageIds = [...session.completedTaskIds];
  session.learningState.stageValidation = 'passed';
  markMeaningfulAction(session, Date.now(), 'tool');
  setDialogueLifecycle(session, 'GIVE_FEEDBACK');
  input.data = {
    ...(input.data || {}),
    completedTaskId: completedId,
    completedTaskName: task.name,
    allTasksCompleted: session.currentTaskIndex >= role.tasks.length - 1,
  };
  if (task.advanceMode === 'teacher') {
    session.events.push(`${completedId}:waiting-teacher-advance`);
    input.data.waitingForTeacher = true;
  } else if (task.advanceMode === 'ai_suggest') {
    session.events.push(`${completedId}:waiting-student-advance`);
    input.data.waitingForStudent = true;
  } else if (session.currentTaskIndex < role.tasks.length - 1) {
    session.currentTaskIndex += 1;
    const nextTask = role.tasks[session.currentTaskIndex];
    input.data.continueAtSameLocation = Boolean(
      completion.completedLocationStatus === 'arrived'
      && completion.completedLocationName
      && nextTask.location?.name === completion.completedLocationName,
    );
    input.data.previousVerification = completion.completedVerification;
  } else {
    session.events.push(`${role.id}:all-tasks-completed`);
  }
}

export function createAgentService({
  llm,
  store,
  getCourse,
  loadEvidence = async () => null,
  logger,
  // 语义理解用的轻量模型。未单独配置时复用主模型（同一网关，行为不变）。
  understandingLlm = llm,
}) {
  const understanding = createUnderstanding({ llm: understandingLlm });
  // 决策入口（D6 乙案）：非语言输入走原有确定性规则；
  // 自由文字必经「轻量语义理解 → 确定性教学决策 → 映射为 decision」三段。
  async function resolveDecision({ input, session, course, role, nudge, task, signal }) {
    if (routeInput(input).kind === 'non_language') {
      return classifyTurn({ input, session, course, role, nudge });
    }

    const text = String(input.text || '').trim();
    // 状态机输入与时效动作（安全/到达就绪/抱怨/无语义）先由确定性规则处理，
    // 不等模型，也不因轻量模型不可用而卡死。都不命中才做语义理解。
    const deterministic = deterministicLanguageDecision({ text, session });
    if (deterministic) return deterministic;

    const pendingQuestion = session.dialogueState?.pendingQuestion || null;
    const currentStep = currentStepOf(task, session);
    const result = await understanding.understandTurn({
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

    const tutor = decideTutorAction(result, {
      scaffoldLevel: Number(session.scaffoldLevel || 0),
      pendingQuestion,
      currentStep,
      recentActions: session.conversationState?.recentTutorActions || [],
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
      needsKnowledge: result.intent === 'asking_knowledge',
      onboardingCompleted: Boolean(session.onboardingState?.completed),
      claimsDone: result.intent === 'claim_done',
    });

    return {
      ...decision,
      signal: normalizeEmotion(result.emotion),
      params: tutor.params || {},
      understanding: result,
    };
  }

  async function createSession(input) {
    const course = await getCourse(input.courseId);
    const role = course.roles.find((item) => item.id === input.roleId);
    if (!role) throw new Error(`角色 ${input.roleId} 不存在。`);
    const session = await store.create({
      ...input,
      phaseId: course.publicLesson.roleSystem.phaseId,
      timeBalance: course.publicLesson.timeBank.initialBalance,
    });
    ensureSessionRuntime(session, role.tasks[0]);
    await store.save(session);
    return { session, course, role };
  }

  async function runTurn({
    sessionId,
    requestId,
    input,
    onTextDelta,
    signal,
    persistSession,
  }) {
    throwIfAborted(signal);
    const session = await store.get(sessionId);
    if (!session) throw new Error('会话不存在或已经失效。');
    if (session.handledRequestIds.includes(requestId)) {
      return { duplicate: true, session, events: [] };
    }
    const course = await getCourse(session.courseId);
    const role = roleFor(course, session);
    let task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
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
        if (requestedIndex === currentIndex && currentIndex < steps.length) {
          const completionMode = task.steps?.[currentIndex]?.completionMode || 'user_confirm';
          validateStepCompletion({ task, stepIndex: currentIndex, input, session });
          if (completionMode === 'ai_evaluation') {
            const step = task.steps[currentIndex];
            const evaluation = await evaluateStepSubmission({
              llm, course, role, session, task, step, input, signal,
            });
            session.taskState.stepAttempts ||= {};
            session.taskState.stepAttempts[step.id] = Number(session.taskState.stepAttempts[step.id] || 0) + 1;
            const maxAttempts = Number(step.maxAttempts || 0);
            input.data.aiEvaluation = {
              ...evaluation,
              teacherRecommended: !evaluation.passed && maxAttempts > 0 && session.taskState.stepAttempts[step.id] >= maxAttempts,
            };
            if (evaluation.passed) {
              session.taskState.guidanceStepIndex = currentIndex + 1;
              recordStepCompletion(session, task, currentIndex);
              markMeaningfulAction(session, Date.now(), 'tool');
            }
          } else {
            session.taskState.guidanceStepIndex = currentIndex + 1;
            recordStepCompletion(session, task, currentIndex);
            markMeaningfulAction(session, Date.now(), 'tool');
          }
        }
      }
      if (input.event === 'location_updated') {
        recordLocationObservation(session, input.data || {});
        markMeaningfulAction(session, Date.now(), 'other');
      }
    }
    applyToolResult({ course, session, role, input });
    task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
    ensureSessionRuntime(session, task);
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
    if (['greeting', 'gratitude', 'goodbye', 'emotion', 'course_knowledge', 'safety_help', 'social'].includes(decision.intent)) {
      suspendPendingQuestion(session);
    }
    updateDialogueLifecycleForDecision(session, decision);
    if (['user_text', 'quick_reply'].includes(input.type)) {
      // 升档由 tutorPolicy 判定（它看得到教学动作历史），这里只执行。
      if (decision.params?.scaffoldLevelDelta) {
        session.scaffoldLevel = Math.min(4, session.scaffoldLevel + decision.params.scaffoldLevelDelta);
      }
      if (decision.tutorAction) {
        recordTutorAction(session, { intent: decision.understanding?.intent, action: decision.tutorAction });
      }
      recordIntent(session, decision.intent, decision.signal);
      if (!['unclear_input', 'conversation_repair'].includes(decision.intent)) clearMisunderstandings(session);
    }
    if (nudge.due) recordNudge(session);

    const query = input.type === 'user_text'
      ? input.text
      : input.type === 'quick_reply'
        ? input.value
      : `${input.event || input.type} ${task?.name || ''}`;
    const knowledge = decision.needsKnowledge
      ? retrieveKnowledge({
        course,
        session,
        role,
        query,
        references: [
          task.steps?.[Number(session.taskState?.guidanceStepIndex || 0)]?.knowledgeRef,
          task.goals,
        ].filter(Boolean).join(' '),
      })
      : [];
    const prompt = buildAgentPrompt({ course, session, role, knowledge, input, decision });
    const tools = toolsForDecision(decision, TOOL_DEFINITIONS);
    let result = { text: '', toolCalls: [] };
    let streamed = false;
    let modelFailure = null;

    if (!decision.silent) {
      if (decision.fastWorkflow) {
        result = workflowResult({ decision, role, session, course, input });
      } else if (decision.fastPath) {
        result.text = fastConversationReply(decision.intent, PLATFORM_COMPANION.name, decision.signal);
      } else if (decision.fastGuidance) {
        result.text = immediatePrelude(decision, role, session);
      } else if (decision.intent === 'course_knowledge' && knowledge.length) {
        result.text = knowledgeExcerptReply(knowledge);
      } else {
        try {
        const needsTurnUnderstanding = Boolean(
          decision.intent === 'onboarding_unclear'
          && session.dialogueState?.pendingQuestion,
        );
        let shouldUseStructured = Boolean(tools.length && !llm.capabilities().nativeTools);
        const canStream = Boolean(
          onTextDelta
          && !tools.length
          && !needsTurnUnderstanding
          && !['proactive_nudge', 'lifecycle_event'].includes(decision.intent),
        );
        const prelude = canStream ? immediatePrelude(decision, role, session) : '';
        if (prelude) {
          streamed = true;
          onTextDelta(prelude);
        }
        if (needsTurnUnderstanding && onTextDelta) {
          streamed = true;
          onTextDelta('我听见了。');
        }
        const baseModelInstructions = prelude
          ? `${shouldUseStructured ? toolFallbackInstructions(prompt.instructions, role, session, tools) : prompt.instructions}\n已即时回应学生：“${prelude}” 请紧接着补充，避免重复。`
          : (shouldUseStructured ? toolFallbackInstructions(prompt.instructions, role, session, tools) : prompt.instructions);
        const modelInstructions = needsTurnUnderstanding
          ? understandingInstructions(baseModelInstructions, session.dialogueState.pendingQuestion)
          : baseModelInstructions;
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
          jsonMode: shouldUseStructured || needsTurnUnderstanding,
          onTextDelta: canStream ? (text) => deltaGuard.push(text) : undefined,
          signal,
        });
        throwIfAborted(signal);
        deltaGuard?.flush();
        if (prelude) result.text = `${prelude}${result.text ? ` ${result.text}` : ''}`;
        if (input.data?.visualAnalysisAvailable && !llm.capabilities().vision) input.data.visualAnalysisAvailable = false;
        if (needsTurnUnderstanding) {
          const understanding = parseTurnUnderstanding(result.text);
          if (understanding) {
            result = applySemanticUnderstanding({ understanding, role, session, course, input });
          } else {
            result = {
              text: '我听见了，不过还没完全理解这句话。你可以换一种说法，我会接着听。',
              toolCalls: [],
              dialogueMove: 'clarify_input',
              quickReplies: session.dialogueState?.pendingQuestion?.quickReplies || [],
            };
          }
        } else if (shouldUseStructured) {
          result = parseStructuredFallback(result.text);
        }

        if (!result.text && result.toolCalls.length) {
          result = { ...result, text: toolNarration(result.toolCalls[0], role, session) };
        }

        const spoiler = deltaGuard?.isBlocked() || findSpoiler(result.text, course, session);
        if (spoiler) {
          result = {
            ...result,
            text: '这个精确结论仍在探索区。把你的观察方法或现场证据告诉我，我可以陪你检查推理过程。',
          };
        }
        } catch (error) {
          if (signal?.aborted || error?.name === 'AbortError') throw error;
          modelFailure = error;
          logger?.warn?.({
            modelError: {
              name: error?.name || 'Error',
              code: error?.code || null,
              status: Number.isInteger(error?.status) ? error.status : null,
            },
          }, 'model request degraded');
          const prelude = immediatePrelude(decision, role, session);
          streamed = Boolean(prelude);
          result = {
            text: prelude || degradedReply(decision, role, session, course),
            toolCalls: [],
          };
        }
      }
    }

    if (result.text) {
      result.text = applyGradeResponsePolicy(
        avoidRepeatedReply(session, result.text, {
          intent: decision.intent,
          dialogueMove: result.dialogueMove,
        }),
        session.learnerState?.grade || session.grade,
      );
    }
    const taskIndexBeforeFinalize = session.currentTaskIndex;
    finalizeToolResult({ session, role, input });
    if (session.currentTaskIndex !== taskIndexBeforeFinalize) {
      task = role.tasks[Math.min(session.currentTaskIndex, role.tasks.length - 1)];
      ensureSessionRuntime(session, task);
      if (input.data?.continueAtSameLocation && task.location?.mode !== 'none') {
        recordArrival(session, input.data.previousVerification || 'manual');
      }
    }
    result = appendStateDrivenTools(result, { input, role, session });

    const events = [];
    const responseSource = sourceMeta(knowledge, input, decision);
    if (result.text) {
      session.messages.push({ role: 'user', content: query, createdAt: new Date().toISOString() });
      session.messages.push({ role: 'assistant', content: result.text, createdAt: new Date().toISOString() });
      events.push({
        type: 'assistant.completed',
        data: {
          id: `msg_${crypto.randomUUID()}`,
          text: result.text,
          source: responseSource,
          intent: decision.intent,
          dialogueMove: result.dialogueMove || decision.intent,
          streamed,
          degraded: Boolean(modelFailure),
        },
      });
      recordDialogueMove(session, {
        move: result.dialogueMove || decision.intent,
        text: result.text,
      });
    }

    for (const item of result.timeline || []) {
      if (item.type === 'stage.started') {
        events.push(item);
        continue;
      }
      if (item.type !== 'assistant' || !item.text) continue;
      const timelineText = applyGradeResponsePolicy(
        avoidRepeatedReply(session, item.text, {
          intent: decision.intent,
          dialogueMove: item.dialogueMove || result.dialogueMove,
        }),
        session.learnerState?.grade || session.grade,
      );
      session.messages.push({ role: 'assistant', content: timelineText, createdAt: new Date().toISOString() });
      events.push({
        type: 'assistant.completed',
        data: {
          id: `msg_${crypto.randomUUID()}`,
          text: timelineText,
          source: responseSource,
          intent: decision.intent,
          dialogueMove: item.dialogueMove || result.dialogueMove || decision.intent,
          streamed: false,
          degraded: false,
        },
      });
      recordDialogueMove(session, {
        move: item.dialogueMove || result.dialogueMove || decision.intent,
        text: timelineText,
      });
    }

    if (result.quickReplies?.length) {
      events.push({
        type: 'ui.quick_replies',
        data: {
          questionId: session.dialogueState?.pendingQuestion?.id || null,
          options: result.quickReplies.slice(0, 3),
        },
      });
    }

    for (const call of result.toolCalls.filter((item) => item.name !== 'retrieve_course_knowledge')) {
      const payload = validateClientTool({ call, role, session });
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

    throwIfAborted(signal);
    session.handledRequestIds.push(requestId);
    session.handledRequestIds = session.handledRequestIds.slice(-100);
    events.push({
      type: 'state.updated',
      data: {
        phaseId: session.phaseId,
        currentTaskIndex: session.currentTaskIndex,
        completedTaskIds: session.completedTaskIds,
        scaffoldLevel: session.scaffoldLevel,
        intent: decision.intent,
        runtime: runtimeSnapshot(session),
        learningState: structuredClone(session.learningState),
        dialogueState: structuredClone(session.dialogueState),
      },
    });
    if (persistSession) {
      await persistSession({ session, events });
    } else {
      await store.save(session);
    }
    return { duplicate: false, session, events, streamed };
  }

  async function answerTimeBank({ sessionId, taskId, answer, evidence = [], location }) {
    const session = await store.get(sessionId);
    if (!session) throw new Error('会话不存在或已经失效。');
    const course = await getCourse(session.courseId);
    const bank = course.publicLesson.timeBank;
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
    await store.save(session);
    return { correct: true, reward: task.reward, balance: session.timeBalance, completedTaskIds: session.completedBankTaskIds };
  }

  async function giftTime({ sessionId, roleId, amount }) {
    const session = await store.get(sessionId);
    if (!session) throw new Error('会话不存在或已经失效。');
    const course = await getCourse(session.courseId);
    const role = course.roles.find((item) => item.id === roleId);
    if (!role) throw new Error('赠送对象不存在。');
    const rules = course.publicLesson.timeBank.giftRules;
    if (!Number.isFinite(amount) || amount < rules.minAmount || amount > rules.maxPerAction) throw new Error('赠送数量不符合课程规则。');
    if (!rules.allowGiftToSelf && roleId === session.roleId) throw new Error('不能赠送给自己。');
    if (session.timeBalance < amount) throw new Error('时间余额不足。');
    session.timeBalance -= amount;
    session.gifts.push({ roleId, amount, createdAt: new Date().toISOString() });
    await store.save(session);
    return { balance: session.timeBalance };
  }

  return { createSession, runTurn, answerTimeBank, giftTime };
}
