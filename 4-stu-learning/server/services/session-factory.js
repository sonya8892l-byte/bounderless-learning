import crypto from 'node:crypto';

export function phaseNumber(phaseId) {
  return Number.parseInt(String(phaseId || 'phase-2').match(/\d+/)?.[0], 10) || 2;
}

export function createSessionRecord(values = {}) {
  const phaseId = values.phaseId || 'phase-2';
  const createdAt = values.createdAt || new Date().toISOString();
  return {
    schemaVersion: 2,
    id: values.id || `ses_${crypto.randomUUID().replaceAll('-', '')}`,
    courseId: values.courseId,
    studentId: values.studentId,
    groupId: values.groupId,
    runId: values.runId || null,
    participantId: values.participantId || null,
    roleId: values.roleId,
    // 课程 md＋平台包的联合内容指纹。主体未产出时存空串，不阻塞建会话。
    contentVersion: values.contentVersion || '',
    grade: values.grade || '初中',
    phaseId,
    phaseNumber: phaseNumber(phaseId),
    currentTaskIndex: 0,
    scaffoldLevel: 0,
    completedTaskIds: [],
    events: [],
    messages: [],
    pendingTools: {},
    handledRequestIds: [],
    timeBalance: Number(values.timeBalance || 0),
    timeEarned: 0,
    completedBankTaskIds: [],
    gifts: [],
    taskState: {},
    learningState: {
      coursePhaseId: phaseId,
      roleId: values.roleId,
      roleStageId: '',
      stepId: '',
      stepStatus: 'active',
      completedStepIds: [],
      completedRoleStageIds: [],
      activeToolCallId: null,
      evidenceIds: [],
      stageValidation: 'pending',
      teacherLock: null,
    },
    locationState: null,
    onboardingState: {
      arrivedConfirmed: false,
      readyConfirmed: false,
      completed: false,
    },
    conversationState: {
      lastIntent: '',
      lastIntentAt: null,
      studentSignal: 'neutral',
      lastNudgeAt: null,
      nudgeCount: 0,
    },
    dialogueState: {
      lifecycle: 'ORIENT_ROLE',
      pendingQuestion: null,
      interruptedQuestion: null,
      confirmedSlots: { arrival: false, readiness: false },
      lastDialogueMove: '',
      lastAssistantText: '',
      recentAssistantFingerprints: [],
      consecutiveMisunderstandings: 0,
      repairCount: 0,
      lastRepairAt: null,
    },
    learnerState: {
      grade: values.grade || '初中',
      engagement: 'unknown',
      emotion: 'neutral',
      preferredInput: 'unknown',
      scaffoldLevel: 0,
      consecutiveDifficulties: 0,
    },
    environmentState: {
      pageVisible: true,
      activeTab: 'task',
      learningView: 'dialogue',
      hasDraft: false,
      phaseRemainingSeconds: null,
      teacherCommand: null,
      groupStatus: null,
      observedAt: null,
    },
    createdAt,
  };
}

function arrayOrDefault(value, fallback) {
  return Array.isArray(value) ? value : fallback;
}

function objectOrDefault(value, fallback) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : fallback;
}

export function normalizeSessionRecord(value) {
  if (!value || typeof value !== 'object' || !value.id) return null;
  const source = structuredClone(value);
  const defaults = createSessionRecord(source);
  const normalized = {
    ...defaults,
    ...source,
    schemaVersion: Math.max(2, Number(source.schemaVersion || 0)),
    phaseNumber: Number(source.phaseNumber || phaseNumber(source.phaseId)),
  };

  for (const key of [
    'completedTaskIds',
    'events',
    'messages',
    'handledRequestIds',
    'completedBankTaskIds',
    'gifts',
  ]) {
    normalized[key] = arrayOrDefault(source[key], defaults[key]);
  }

  normalized.pendingTools = objectOrDefault(source.pendingTools, defaults.pendingTools);
  normalized.taskState = objectOrDefault(source.taskState, defaults.taskState);
  for (const key of [
    'learningState',
    'onboardingState',
    'conversationState',
    'dialogueState',
    'learnerState',
    'environmentState',
  ]) {
    normalized[key] = {
      ...defaults[key],
      ...objectOrDefault(source[key], {}),
    };
  }
  normalized.dialogueState.confirmedSlots = {
    ...defaults.dialogueState.confirmedSlots,
    ...objectOrDefault(source.dialogueState?.confirmedSlots, {}),
  };
  return normalized;
}
