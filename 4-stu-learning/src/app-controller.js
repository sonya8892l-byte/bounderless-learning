import {
  ArrowRight,
  ArrowUp,
  Blocks,
  BookOpenCheck,
  Camera,
  Check,
  ChevronLeft,
  CircleCheckBig,
  Clock3,
  createIcons,
  Flag,
  FastForward,
  Eraser,
  HandHelping,
  Info,
  Lightbulb,
  ListChecks,
  Map as MapIcon,
  MapPin,
  MapPinCheck,
  MessageCircleMore,
  Mic,
  Navigation,
  NotebookPen,
  PenTool,
  Play,
  Plus,
  Radio,
  ScanLine,
  Sparkles,
  Square,
  TimerReset,
  Users,
  Volume2,
  Waves,
  X,
} from 'lucide';
import {
  activateAgentSession,
  answerTimeBank as answerTimeBankRequest,
  claimAgentRole,
  createAgentSession,
  forceCompleteCurrentTask as forceCompleteCurrentTaskRequest,
  giftTime as giftTimeRequest,
  getTeacherCommands,
  requestTeacherHelp,
  reportStudentPresence,
  resumeAgentSession,
  sendAgentTurn,
  sendTeacherCommandReceipt,
  uploadEvidence,
} from './services/ai-service.js';
import { getLesson } from './services/course-service.js';
import { mountAmapNavigation, openAmapNavigation } from './services/amap-service.js';
import { resolveStudentRuntime } from './services/runtime-mode.js';
import { PLATFORM_COMPANION } from './engine/platform-config.js';
import { createClientStudentFacingPolicy } from './engine/student-facing-policy.js';
import {
  challengeSubmissionPassed,
  challengeTaskAccess,
  clampChallengePageIndex,
  initialLearningView,
  nextLearningView,
} from './engine/learning-view.js';
import { resetShellScrollOffsets } from './engine/shell-scroll.js';
import { entryPhaseForLesson } from './engine/entry-phase.js';
import { DEFAULT_TASK_FINALIZATION_MODE } from './engine/task-finalization.js';
import { isPosterOnlyMedia } from './engine/tool-registry.js';
import { canonicalGradeLevel, DEFAULT_GRADE_LEVEL } from './engine/grade-level.js';
import {
  completeLocalTaskProgress,
  resolveLocalPendingAdvance,
  studentCanCompleteStep,
} from './engine/local-task-progress.js';
import { hasActiveEvidenceProcessing, hasCurrentTaskDraft } from './engine/draft-state.js';
import { consumeJoinCredential } from './engine/join-credential.js';
import { qaForceCompleteEnabled } from './engine/qa-mode.js';
import { dispatchTeacherCommand } from './engine/teacher-command-dispatch.js';
import { courseRunGateFromError } from './engine/course-run-gate.js';
import {
  restoredDialogueMessages,
  restoredTrackRuntime,
} from './engine/session-dialogue-history.js';
import { mergeRoleClaimProjection, roleClaimChoice } from './engine/role-claim.js';
import {
  CONTENT_REVEAL_INTERVAL_MS,
  isAuditOnlyTransportEvent,
  PHASE_TRANSITION_DELAY_MS,
  republishActiveTaskMessage,
  shouldSuppressPassivePresentation,
  visibleEventDelay,
} from './engine/presentation-timing.js';
import {
  appendPhotoBatch,
  completePhotoBatch,
  removePhotoAt,
  rollbackPhotoBatch,
} from './engine/photo-evidence.js';
import {
  renderActivityTools,
  renderCompletedPhotoEditors,
  serializableToolValues,
  validateActivityStep,
  validateCompletedTaskSteps,
} from './components/activity-tools.js';

const pageParams = new URLSearchParams(window.location.search);
const pageFragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const lesson = getLesson(pageParams.get('lesson') || undefined);
const studentFacingPolicy = createClientStudentFacingPolicy();
const learnerJoinCredential = consumeJoinCredential(pageParams, {
  courseId: lesson.id,
  storage: window.sessionStorage,
  fragmentParams: pageFragmentParams,
  replaceLocation: ({ searchParams, fragmentParams }) => {
    const search = searchParams.toString();
    const fragment = fragmentParams.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}${fragment ? `#${fragment}` : ''}`,
    );
  },
});
const app = document.querySelector('#studentApp');
const localDevelopmentHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const studentRuntime = resolveStudentRuntime(pageParams, {
  // 本地联调默认连接 Agent/AI；公开托管页面若没有教师场次身份，
  // 仍使用无费用、无正式进度的课程包，避免暴露匿名付费 AI 入口。
  defaultStandalone: !localDevelopmentHost,
});
const standaloneMode = studentRuntime.standalone;
// 当前无学生数据库的直接体验不引入「领取／占位」产品语义。
// 真实教师场次仍保留服务端身份绑定与安全校验。
const prototypeFreeRoleSelection = standaloneMode || !pageParams.get('runId');
const qaProgressControlEnabled = qaForceCompleteEnabled(import.meta.env);
const entryPhase = entryPhaseForLesson(lesson);
const gradeFromUrl = canonicalGradeLevel(pageParams.get('grade'));
const initialGradeLevel = gradeFromUrl || DEFAULT_GRADE_LEVEL;
const phaseTrack = entryPhase ? {
  id: entryPhase.id,
  phaseId: entryPhase.id,
  scope: 'phase',
  name: entryPhase.name || '课程导入',
  location: entryPhase.location || lesson.venue || '',
  badgeImage: lesson.assets.importPlaceholder || lesson.assets.cover,
  cardImage: lesson.assets.importPlaceholder || lesson.assets.cover,
  tasks: entryPhase.tasks,
} : null;
const demoSession = {
  groupName: '第 3 小组',
  members: lesson.roles.map((role, index) => ({
    roleId: role.id,
    name: `学习者${index + 1}`,
    online: true,
  })),
};

function makeLearningTrackState() {
  return {
    arrived: false,
    progress: 0,
    completed: false,
    messages: [],
    lastRenderableMessages: [],
    taskCallIds: {},
    taskPayloads: {},
    republishedTaskMessageId: null,
    evidence: {},
    guidanceStepIndices: {},
    entryStarted: false,
    entryReady: false,
    agentSessionId: null,
    teacherCommandSequence: 0,
    streamingMessageId: null,
    lastAgentRequestError: null,
    lastLocalActionAt: Date.now(),
    challengePageIndex: 0,
    challengeFeedback: {},
    pendingAdvance: null,
    taskFinalizations: {},
    locationStatus: {
      permission: 'unknown',
      insideFence: null,
      accuracyMeters: null,
      verifiedBy: null,
      arrivedAt: null,
    },
  };
}

const iconSet = {
  ArrowRight,
  ArrowUp,
  Blocks,
  BookOpenCheck,
  Camera,
  Check,
  ChevronLeft,
  CircleCheckBig,
  Clock3,
  Flag,
  FastForward,
  Eraser,
  HandHelping,
  Info,
  Lightbulb,
  ListChecks,
  Map: MapIcon,
  MapPin,
  MapPinCheck,
  MessageCircleMore,
  Mic,
  Navigation,
  NotebookPen,
  PenTool,
  Play,
  Plus,
  Radio,
  ScanLine,
  Sparkles,
  Square,
  TimerReset,
  Users,
  Volume2,
  Waves,
  X,
};

const state = {
  screen: 'launchScreen',
  currentRoleId: null,
  currentPhaseId: entryPhase?.id || lesson.roleSystem.phaseId,
  activeTab: 'task',
  learningView: initialLearningView(lesson.learningView),
  openSheetId: null,
  teacherReleasedRoles: studentRuntime.teacherReleasedRoles,
  phaseState: phaseTrack ? makeLearningTrackState() : null,
  phaseSessionBoundRoleId: '',
  phaseTransitionShown: false,
  roleStates: Object.fromEntries(
    lesson.roles.map((role) => [role.id, makeLearningTrackState()]),
  ),
  timeBalance: lesson.timeBank.initialBalance,
  timeEarned: 0,
  completedBankTasks: new Set(),
  bankDrafts: {},
  bankTab: 'earn',
  phaseEndTime: null,
  toastTimer: null,
  agentBusy: false,
  evidenceUploadCount: 0,
  navigationBusy: false,
  qaForceBusy: false,
  agentQueue: [],
  activeTeacherCommand: null,
  teacherRolesLocked: false,
  teacherClaimedRoleId: null,
  teacherTakenRoleIds: null,
  teacherAvailableRoleIds: null,
  teacherRunStatus: null,
  teacherRunPaused: false,
  teacherEmergencyRally: false,
  teacherSessionInactive: false,
  teacherCommandApplications: new Map(),
  selectedGradeLevel: initialGradeLevel,
  gradeSource: gradeFromUrl ? 'url' : 'participant_profile',
  phaseStartBusy: false,
  roleSelectionBusy: false,
};

let navigationMapInstances = [];
let mapHydrationVersion = 0;
let externalFilePickerOpen = false;
let filePickerRestoreTimer = null;
let teacherPollInFlight = false;

const TEACHER_AGENT_COMMAND_ACTIONS = new Set([
  'set_scaffold',
  'advance_phase',
  'approve_evidence',
  'reject_evidence',
  'skip_step',
  'advance_task',
  'confirm_arrival',
]);

const RUN_GATE_ALLOWED_ACTIONS = new Set([
  'confirm-teacher-command',
  'call-teacher',
  'open-progress',
  'close-sheet',
  'set-learning-view',
  'challenge-previous',
  'challenge-forward',
]);

function teacherRunBlocksLearning() {
  return state.teacherSessionInactive
    || state.teacherRunPaused
    || state.teacherEmergencyRally
    || (state.teacherRunStatus && state.teacherRunStatus !== 'active');
}

function explainTeacherRunGate() {
  if (state.teacherSessionInactive) return '当前学习会话已切换或失效，请刷新页面恢复最新会话。';
  if (state.teacherRunStatus === 'completed') return '本次课程已结束，学习记录已转为只读。';
  if (state.teacherRunStatus && state.teacherRunStatus !== 'active') return '课程尚未开始，请等待老师发出开始指令。';
  if (state.teacherEmergencyRally) return '请先按老师要求前往集合点。';
  return '课程已暂停，请留在安全位置等待老师恢复。';
}

function applyCourseRunGateError(error, input) {
  const gate = courseRunGateFromError(error, {
    status: state.teacherRunStatus,
    paused: state.teacherRunPaused,
    rallyActive: state.teacherEmergencyRally,
    rolesReleased: state.teacherReleasedRoles,
    rolesLocked: state.teacherRolesLocked,
    sessionInactive: state.teacherSessionInactive,
  });
  if (!gate) return false;

  if (gate.code === 'COURSE_ROLES_LOCKED') {
    lockRoleAssignment();
  } else if (gate.sessionInactive) {
    state.teacherSessionInactive = true;
    suspendActiveLearningMedia();
    showTeacherDirective({
      id: '',
      action: 'pause',
      confirmed: true,
      payload: { message: gate.message },
    });
  } else {
    synchronizeTeacherRunState({
      status: gate.status,
      paused: gate.paused,
      rallyActive: gate.rallyActive,
      rolesReleased: gate.rolesReleased,
      rolesLocked: gate.rolesLocked,
    });
  }

  if (input?.type === 'user_text') {
    const chatInput = document.querySelector('#chatInput');
    if (chatInput && !chatInput.value.trim()) chatInput.value = input.text || '';
  }
  showToast(gate.message);
  return true;
}

function blockLearningAction(action = '') {
  if (!teacherRunBlocksLearning() || RUN_GATE_ALLOWED_ACTIONS.has(action)) return false;
  showToast(explainTeacherRunGate());
  return true;
}

function roleChoice(roleId) {
  return roleClaimChoice({
    roleId,
    standalone: prototypeFreeRoleSelection,
    currentRoleId: state.currentRoleId,
    claimedRoleId: state.teacherClaimedRoleId,
    takenRoleIds: state.teacherTakenRoleIds,
    availableRoleIds: state.teacherAvailableRoleIds,
    rolesReleased: state.teacherReleasedRoles,
    rolesLocked: state.teacherRolesLocked,
  });
}

function suspendActiveLearningMedia() {
  document.querySelectorAll('[data-activity-media]').forEach((media) => media.pause?.());
  const tracks = [state.phaseState, ...Object.values(state.roleStates || {})].filter(Boolean);
  for (const track of tracks) {
    for (const evidence of Object.values(track.evidence || {})) {
      for (const stepValues of Object.values(evidence.toolValues || {})) {
        for (const value of Object.values(stepValues || {})) {
          if (value?.recording && value.recorder?.state === 'recording') {
            window.clearTimeout(value.autoStopTimer);
            value.recognition?.stop?.();
            value.recorder.stop();
          }
        }
      }
    }
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function studentFacingText(value, { channel = 'ui', fallback = '' } = {}) {
  return studentFacingPolicy.processText(value, { channel, fallback }).text;
}

function studentFacingError(error, fallback = '这项操作暂未完成，请稍后重试。') {
  return studentFacingPolicy.processError(error, { fallback }).text;
}

function companionAvatar({ motion = 'idle', variant = 'message' } = {}) {
  const videoAsset = motion === 'talk' ? PLATFORM_COMPANION.talkAsset : PLATFORM_COMPANION.idleAsset;
  const variantClass = variant === 'floating' ? 'companion-avatar--floating' : 'companion-avatar--message';
  return `
    <span class="companion-avatar ${variantClass}" data-companion-avatar aria-hidden="true">
      <img class="companion-avatar__fallback" src="${PLATFORM_COMPANION.posterAsset}" alt="" />
      ${videoAsset ? `<video class="companion-avatar__video" data-companion-video src="${videoAsset}" poster="${PLATFORM_COMPANION.posterAsset}" autoplay muted loop playsinline preload="auto"></video>` : ''}
    </span>
  `;
}

function hydrateCompanionAvatars(root = document) {
  root.querySelectorAll('[data-companion-avatar]').forEach((avatar) => {
    const video = avatar.querySelector('[data-companion-video]');
    if (!video) return;
    if (avatar.dataset.hydrated !== 'true') {
      avatar.dataset.hydrated = 'true';
      video.addEventListener('playing', () => avatar.classList.add('is-playing'));
      video.addEventListener('pause', () => avatar.classList.remove('is-playing'));
      video.addEventListener('error', () => avatar.classList.remove('is-playing'));
    }
    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      avatar.classList.add('is-playing');
    }
    if (avatar.getClientRects().length) {
      video.play().catch(() => avatar.classList.remove('is-playing'));
    }
  });
}

function refreshIcons() {
  createIcons({ icons: iconSet, attrs: { 'aria-hidden': 'true' } });
}

function currentRole() {
  if (!state.currentRoleId && phaseTrack) return phaseTrack;
  return lesson.roles.find((role) => role.id === state.currentRoleId) || lesson.roles[0];
}

function currentRoleState() {
  if (!state.currentRoleId && phaseTrack) return state.phaseState;
  return state.roleStates[currentRole().id];
}

function isPhaseTrackActive() {
  return Boolean(phaseTrack && !state.currentRoleId && state.screen === 'learningShell');
}

function currentTask() {
  const role = currentRole();
  const roleState = currentRoleState();
  return role.tasks[Math.min(roleState.progress, role.tasks.length - 1)];
}

function currentPhase() {
  return lesson.phases.find((phase) => phase.id === state.currentPhaseId) || lesson.phases[0];
}

function sessionMember(roleId) {
  return demoSession.members.find((member) => member.roleId === roleId);
}

function courseTemplate(value = '') {
  const replacements = {
    roleCount: lesson.roles.length,
    collectionName: lesson.roleSystem.collectionName,
    itemName: lesson.roleSystem.itemName,
    collectionItemName: lesson.roleSystem.collectionItemName,
    unlockTarget: lesson.roleSystem.unlockTarget,
  };

  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)),
    value,
  );
}

function durationToMilliseconds(value = '') {
  const hours = Number.parseFloat(value.match(/([\d.]+)\s*(?:小时|h(?:our)?s?)/i)?.[1] || 0);
  const minutes = Number.parseFloat(value.match(/([\d.]+)\s*(?:分钟|min(?:ute)?s?)/i)?.[1] || 0);
  return ((hours * 60) + minutes) * 60 * 1000;
}

function beginCurrentPhase() {
  const duration = durationToMilliseconds(currentPhase()?.duration);
  state.phaseEndTime = duration ? Date.now() + duration : null;
}

function moduleLabels(modules = '') {
  return modules
    .split(',')
    .map((module) => module.trim())
    .filter(Boolean);
}

function taskEvidence(taskId) {
  const roleState = currentRoleState();
  roleState.evidence[taskId] ||= { text: '', imageUrls: [], files: [], toolValues: {} };
  roleState.evidence[taskId].toolValues ||= {};
  return roleState.evidence[taskId];
}

function activityValue(taskId, stepId, toolId) {
  const evidence = taskEvidence(taskId);
  evidence.toolValues[stepId] ||= {};
  evidence.toolValues[stepId][toolId] ||= {};
  return evidence.toolValues[stepId][toolId];
}

function showScreen(screenId) {
  state.screen = screenId;
  document.activeElement?.blur();
  app.scrollTop = 0;
  document.querySelectorAll('.app-screen').forEach((screen) => {
    screen.classList.toggle('is-active', screen.id === screenId);
    if (screen.id === screenId) screen.scrollTop = 0;
  });
  refreshIcons();
  if (screenId === 'learningShell') {
    window.requestAnimationFrame(() => hydrateCompanionAvatars());
  }
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  window.clearTimeout(state.toastTimer);
  toast.textContent = studentFacingText(message, {
    channel: 'toast',
    fallback: '这项操作暂未完成，请稍后重试。',
  });
  toast.classList.add('is-visible');
  state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function isLearningFilePicker(target) {
  return target instanceof HTMLInputElement
    && target.type === 'file'
    && Boolean(target.closest('.learning-content'));
}

function scheduleFilePickerLayoutRestore() {
  if (state.screen !== 'learningShell') return;
  window.clearTimeout(filePickerRestoreTimer);
  filePickerRestoreTimer = window.setTimeout(() => {
    resetShellScrollOffsets();
    window.requestAnimationFrame(() => resetShellScrollOffsets());
  }, 0);
}

function openSheet(sheetId) {
  closeSheet();
  state.openSheetId = sheetId;
  const sheet = document.getElementById(sheetId);
  const backdrop = document.querySelector('#sheetBackdrop');
  sheet.classList.add('is-open');
  sheet.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('is-visible');
  refreshIcons();
}

function closeSheet() {
  document.querySelectorAll('.bottom-sheet').forEach((sheet) => {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
  });
  document.querySelector('#sheetBackdrop').classList.remove('is-visible');
  state.openSheetId = null;
}

function renderLaunch() {
  document.documentElement.dataset.theme = lesson.themeTemplate;
  app.dataset.theme = lesson.themeTemplate;
  document.title = `${lesson.title}｜研学智能体学生端`;
  document.querySelector('#launchImage').src = lesson.assets.cover;
  document.querySelector('#immersiveImage').src = lesson.assets.importPlaceholder;
  document.querySelector('#brandSeal').textContent = lesson.series.slice(0, 1);
  document.querySelector('#brandName').textContent = `${lesson.series}研学`;
  document.querySelector('#launchBrand').setAttribute('aria-label', `${lesson.series}研学`);
  document.querySelector('#courseSeries').textContent = `${lesson.series} · 研学智能体课程`;
  document.querySelector('#courseTitle').textContent = lesson.title;
  document.querySelector('#coreQuestion').textContent = lesson.coreQuestion;
  document.querySelector('#launchMeta').innerHTML = `
    <span><i data-lucide="clock-3"></i>${escapeHtml(lesson.duration)}</span>
    <span><i data-lucide="users"></i>${escapeHtml(lesson.groupRule)}</span>
    ${lesson.level ? `<span><i data-lucide="layers-3"></i>${escapeHtml(lesson.level)}</span>` : ''}
  `;
  const previewNotice = document.querySelector('#standalonePreviewNotice');
  previewNotice.hidden = !standaloneMode && !studentRuntime.standaloneDenied;
  previewNotice.textContent = studentRuntime.standaloneDenied
    ? '当前发布环境未开放本地预览，已连接正式课程流程。'
    : '当前为本地预览：可查看界面与课程结构，AI 验收、教师确认和正式学习进度不会作为发布证据。';
  document.querySelector('#standaloneLearningBadge').hidden = !standaloneMode;
  if (phaseTrack) {
    document.querySelector('[data-action="start-course"] span').textContent = '进入课程导入';
    document.querySelector('.launch-note').textContent = `先完成“${phaseTrack.name}”的 ${phaseTrack.tasks.length} 项任务，再选择角色`;
  } else if (!state.teacherReleasedRoles) {
    document.querySelector('[data-action="start-course"] span').textContent = '进入课程导入';
    document.querySelector('.launch-note').textContent = '导入期间请观看现场内容，角色选择由老师统一开放';
  }
  document.querySelector('#groupCode').textContent = demoSession.groupName;
  document.querySelector('#rolePickerEyebrow').textContent = courseTemplate(lesson.roleSystem.pickerEyebrow);
  document.querySelector('#rolePickerHeader').textContent = `选择${lesson.roleSystem.itemName}`;
  document.querySelector('#roleScreenTitle').textContent = courseTemplate(lesson.roleSystem.pickerTitle);
  document.querySelector('#rolePickerDescription').textContent = courseTemplate(lesson.roleSystem.pickerDescription);
  document.querySelector('#collectionPanelName').textContent = lesson.roleSystem.collectionPanelName;
  document.querySelector('#teamSessionStatus').innerHTML = '<i data-lucide="navigation"></i> 个人进度 · 小组汇合由老师组织';
  document.querySelector('#roleSwitchDescription').textContent = prototypeFreeRoleSelection
    ? `可在 ${lesson.roles.length} 个${lesson.roleSystem.itemName}之间切换；每个${lesson.roleSystem.itemName}的任务进度独立保留。`
    : `同组一人领取一个${lesson.roleSystem.itemName}；已领取的角色不能重复选择。`;
  document.querySelector('#chatDayLabel').textContent = `今天 · ${lesson.venue || '课程现场'}`;
  document.querySelector('#chatInputLabel').textContent = `给${PLATFORM_COMPANION.name}发送消息`;
  document.querySelector('#chatInput').placeholder = `和${PLATFORM_COMPANION.name}说说你的发现…`;
}

function renderRoles() {
  const markup = lesson.roles.map((role, index) => {
    const choice = roleChoice(role.id);
    const disabled = !choice.selectable || state.roleSelectionBusy;
    return `
    <button class="role-option role-option--${choice.state}" type="button" data-role-id="${role.id}" data-action="select-role" ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(`${role.name}，${choice.label}`)}">
      <img src="${role.cardImage}" alt="${escapeHtml(role.name)}${escapeHtml(lesson.roleSystem.itemName)}卡" />
      <span class="role-option__shade"></span>
      <span class="role-option__number">${String(index + 1).padStart(2, '0')}</span>
      ${choice.state === 'taken' ? '<span class="role-option__claim-status">已领取</span>' : ''}
      <span class="role-option__copy">
        <h3>${escapeHtml(role.name)}</h3>
        <p>${escapeHtml(role.selectionDescription)}</p>
        <span class="role-option__meta">
          <span><i data-lucide="map-pin"></i>${escapeHtml(role.location)}</span>
          <strong>${escapeHtml(choice.label)} ${choice.selectable ? '<i data-lucide="arrow-right"></i>' : ''}</strong>
        </span>
      </span>
    </button>
  `;
  }).join('');
  document.querySelector('#roleList').innerHTML = markup;
}

function restoreTrackFromAgentSession(track, owner, session) {
  track.agentSessionId = session.id;
  state.selectedGradeLevel = canonicalGradeLevel(session.grade) || state.selectedGradeLevel;
  state.gradeSource = session.gradeSource || state.gradeSource;
  state.timeBalance = Number(session.timeBalance ?? state.timeBalance);
  track.progress = Math.max(0, Number(session.currentTaskIndex || 0));
  const restoredRuntime = restoredTrackRuntime(session, owner.tasks.length);
  track.completed = restoredRuntime.completed;
  const taskId = session.runtime?.task?.taskId || owner.tasks[track.progress]?.id || '';
  if (taskId) {
    track.guidanceStepIndices[taskId] = Number(session.runtime?.task?.guidanceStepIndex || 0);
    if (session.runtime?.task?.finalization) {
      track.taskFinalizations[taskId] = session.runtime.task.finalization;
    }
  }
  track.pendingAdvance = restoredRuntime.pendingAdvance;
  if (restoredRuntime.activeTool) {
    track.taskCallIds ||= {};
    track.taskPayloads ||= {};
    track.taskCallIds[restoredRuntime.activeTool.taskId] = restoredRuntime.activeTool.callId;
    track.taskPayloads[restoredRuntime.activeTool.taskId] = restoredRuntime.activeTool.payload;
  }
  const location = session.runtime?.location;
  track.evidenceCount = Array.isArray(session.runtime?.learning?.evidenceIds)
    ? session.runtime.learning.evidenceIds.length
    : Number(track.evidenceCount || 0);
  if (location) {
    track.arrived = ['arrived', 'not_required'].includes(location.status);
    track.locationStatus = {
      ...track.locationStatus,
      permission: location.permission,
      insideFence: location.insideFence,
      accuracyMeters: location.accuracyMeters,
      verifiedBy: location.verifiedBy,
      arrivedAt: location.enteredAt,
    };
  }
  track.entryStarted = session.resumeState?.entryStarted === true;
  track.entryReady = track.entryStarted;
  if (track.entryStarted) {
    const dialogueMessages = restoredDialogueMessages(session.dialogueHistory);
    track.messages = [
      ...dialogueMessages,
      {
        id: crypto.randomUUID(),
        type: 'assistant',
        text: `已恢复你在“${owner.name}”的学习进度。`,
        source: '本次课程记录',
      },
      ...(track.completed ? [] : currentTaskRecoveryMessages(owner, track)),
    ];
  }
}

async function resumeConnectedLearningSession() {
  const runId = pageParams.get('runId');
  const participantId = pageParams.get('participantId');
  if (standaloneMode || !runId || !participantId) return null;
  try {
    return await resumeAgentSession({
      runId,
      participantId,
      courseId: lesson.id,
      joinCredential: learnerJoinCredential || undefined,
      grade: state.selectedGradeLevel,
      gradeSource: state.gradeSource,
    });
  } catch (error) {
    if (error.code === 'SESSION_RESUME_NOT_FOUND' || error.status === 404) return null;
    throw error;
  }
}

async function startPhaseLearning() {
  if (state.phaseStartBusy) {
    showToast('课程正在进入，请稍等。');
    return;
  }
  if (teacherRunBlocksLearning()) return;
  state.phaseStartBusy = true;
  try {
    return await performStartPhaseLearning();
  } finally {
    state.phaseStartBusy = false;
  }
}

async function performStartPhaseLearning() {
  if (!phaseTrack || !state.phaseState) return;
  state.currentRoleId = null;
  state.currentPhaseId = phaseTrack.phaseId;
  state.activeTab = 'task';
  beginCurrentPhase();
  showScreen('learningShell');
  renderLearningShell();
  const phaseState = state.phaseState;

  if (standaloneMode) {
    if (!phaseState.entryStarted) {
      phaseState.entryStarted = true;
      phaseState.entryReady = false;
      phaseState.messages = [];
      await revealLocalMessages(phaseState, [
        {
          id: crypto.randomUUID(),
          type: 'assistant',
          text: `先从“${phaseTrack.name}”开始。完成这 ${phaseTrack.tasks.length} 项课程任务后，再选择角色。`,
          source: '本地课程包',
        },
        ...currentTaskRecoveryMessages(phaseTrack, phaseState),
      ], { initialEmpty: true });
      phaseState.entryReady = true;
    }
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 30);
    return;
  }

  if (!phaseState.agentSessionId) {
    try {
      const resumed = await resumeConnectedLearningSession();
      if (resumed?.roleId) {
        const resumedRole = lesson.roles.find((item) => item.id === resumed.roleId);
        if (!resumedRole) throw new Error('已保存的角色已不在当前课程中。');
        const resumedTrack = state.roleStates[resumedRole.id];
        restoreTrackFromAgentSession(resumedTrack, resumedRole, resumed);
        state.currentRoleId = resumedRole.id;
        state.currentPhaseId = resumed.phaseId || lesson.roleSystem.phaseId;
        synchronizeTeacherRunState(resumed.teacherRunState);
        beginCurrentPhase();
        showScreen('learningShell');
        renderLearningShell();
        void reportCurrentPresence({ owner: resumedRole, track: resumedTrack }).catch(() => undefined);
        if (!resumedTrack.entryStarted && !teacherRunBlocksLearning()) {
          resumedTrack.entryStarted = true;
          await runAgentTurn(
            { type: 'lifecycle_event', event: 'role_assigned', data: { roleId: resumedRole.id } },
            { initialEmpty: true, showLoading: false },
          );
          resumedTrack.entryReady = !resumedTrack.lastAgentRequestError;
          if (!resumedTrack.entryReady) resumedTrack.entryStarted = false;
        }
        void pollTeacherCommands();
        renderLearningShell();
        window.requestAnimationFrame(() => scrollChatToBottom());
        return;
      }
      if (resumed) {
        restoreTrackFromAgentSession(phaseState, phaseTrack, resumed);
        state.currentPhaseId = resumed.phaseId || phaseTrack.phaseId;
        synchronizeTeacherRunState(resumed.teacherRunState);
      }
      if (resumed) {
        void pollTeacherCommands();
        window.requestAnimationFrame(() => scrollChatToBottom());
      } else {
        const session = await createAgentSession({
          courseId: lesson.id,
          studentId: pageParams.get('studentId') || 'demo-pre-role',
          groupId: pageParams.get('groupId') || 'group-3',
          runId: pageParams.get('runId') || undefined,
          participantId: pageParams.get('participantId') || undefined,
          joinCredential: learnerJoinCredential || undefined,
          grade: state.selectedGradeLevel,
          gradeSource: state.gradeSource,
        });
        phaseState.agentSessionId = session.id;
        synchronizeTeacherRunState(session.teacherRunState);
        void pollTeacherCommands();
      }
    } catch (error) {
      showToast(studentFacingError(error, '课程进入暂未完成，请重试。'));
      return;
    }
  }
  // 新建或恢复会话后立即触发一次服务端投影，不等定时心跳。
  void reportCurrentPresence({ owner: phaseTrack, track: phaseState }).catch(() => undefined);
  if (teacherRunBlocksLearning()) return;
  if (!phaseState.entryStarted) {
    phaseState.entryStarted = true;
    phaseState.entryReady = false;
    await runAgentTurn(
      { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: phaseTrack.phaseId } },
      { initialEmpty: true, showLoading: false },
    );
    phaseState.entryReady = !phaseState.lastAgentRequestError;
    if (!phaseState.entryReady) phaseState.entryStarted = false;
    renderLearningShell();
  }
}

function phaseHistoryForRole() {
  return (state.phaseState?.messages || [])
    .filter((message) => ['assistant', 'user', 'phase'].includes(message.type))
    .map((message) => ({ ...message }));
}

function finishPhaseLearning() {
  if (!isPhaseTrackActive() || !state.phaseState?.completed || state.phaseTransitionShown) return;
  state.phaseTransitionShown = true;
  showScreen(state.teacherReleasedRoles ? 'roleScreen' : 'immersiveScreen');
  showToast(state.teacherReleasedRoles
    ? '课程导入已完成，现在选择角色。'
    : '课程导入已完成，请等待老师开放角色领取。');
}

async function selectRole(roleId) {
  if (state.agentBusy || state.qaForceBusy || state.roleSelectionBusy) {
    showToast('上一项操作还在处理中，请稍等。');
    return;
  }
  if (teacherRunBlocksLearning()) return;
  const choice = roleChoice(roleId);
  if (!choice.selectable) {
    showToast(choice.reason);
    return;
  }
  if (state.currentRoleId === roleId && currentRoleState()?.entryReady) {
    closeSheet();
    showToast('你正在使用这个角色。');
    return;
  }
  state.roleSelectionBusy = true;
  document.querySelectorAll('[data-action="select-role"], [data-action="switch-role"]')
    .forEach((button) => { button.disabled = true; });
  try {
    return await performRoleSelection(roleId);
  } finally {
    state.roleSelectionBusy = false;
    renderRoles();
    renderRoleSwitch();
  }
}

async function performRoleSelection(roleId) {
  const choice = roleChoice(roleId);
  if (!choice.selectable) {
    if (!state.teacherReleasedRoles && !state.teacherClaimedRoleId) {
      showScreen('immersiveScreen');
    }
    showToast(choice.reason);
    return;
  }
  if (!prototypeFreeRoleSelection && !state.teacherReleasedRoles && roleId !== state.teacherClaimedRoleId) {
    showScreen('immersiveScreen');
    showToast('请等待老师开放角色领取。');
    return;
  }
  if (!standaloneMode && phaseTrack && state.phaseState && !state.phaseState.completed) {
    showToast(`请先完成“${phaseTrack.name}”，再领取角色。`);
    return;
  }
  const role = lesson.roles.find((item) => item.id === roleId);
  if (!role) return;
  const roleState = state.roleStates[role.id];
  if (standaloneMode) {
    state.currentRoleId = role.id;
    state.currentPhaseId = lesson.roleSystem.phaseId;
    state.activeTab = 'task';
    beginCurrentPhase();
    renderLearningShell();
    showScreen('learningShell');
    closeSheet();
    if (!roleState.entryStarted) {
      roleState.entryStarted = true;
      roleState.entryReady = false;
      roleState.messages = phaseHistoryForRole();
      await revealLocalMessages(roleState, [
        {
          id: crypto.randomUUID(),
          type: 'assistant',
          text: `你已选择“${role.name}”。当前为本地体验模式，可以直接完成任务小步并记录学习过程。`,
          source: '本地课程包',
        },
        ...currentTaskRecoveryMessages(role, roleState),
      ]);
      roleState.entryReady = true;
    }
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 40);
    return;
  }

  // 正式场次先让服务端原子确认角色领取，再切换当前轨道和页面。
  // 这样同组并发领取发生冲突时，学生仍完整停留在原角色与原草稿中。
  const reusablePhaseSessionId = !state.phaseSessionBoundRoleId
    && state.phaseState?.completed
    && state.phaseState?.agentSessionId
    && !roleState.agentSessionId
    ? state.phaseState.agentSessionId
    : '';
  let reusedPhaseSession = false;
  let confirmedSessionId = roleState.agentSessionId || '';
  try {
    if (reusablePhaseSessionId) {
      const claimed = await claimAgentRole(reusablePhaseSessionId, role.id);
      confirmedSessionId = claimed.sessionId;
      reusedPhaseSession = true;
      synchronizeTeacherRunState(claimed.teacherRunState);
    } else if (!roleState.agentSessionId) {
      const created = await createAgentSession({
        courseId: lesson.id,
        roleId: role.id,
        studentId: pageParams.get('studentId') || `demo-${role.id}`,
        groupId: pageParams.get('groupId') || 'group-3',
        runId: pageParams.get('runId') || undefined,
        participantId: pageParams.get('participantId') || undefined,
        joinCredential: learnerJoinCredential || undefined,
        grade: state.selectedGradeLevel,
        gradeSource: state.gradeSource,
      });
      confirmedSessionId = created.id;
      synchronizeTeacherRunState(created.teacherRunState);
    } else if (!prototypeFreeRoleSelection) {
      const activated = await activateAgentSession(roleState.agentSessionId);
      synchronizeTeacherRunState(activated.teacherRunState);
    }
    if (!prototypeFreeRoleSelection && state.teacherClaimedRoleId !== role.id) {
      const error = new Error('角色领取尚未得到服务端确认，请根据最新可领取角色重试。');
      error.code = 'COURSE_ROLE_CLAIM_UNCONFIRMED';
      throw error;
    }
  } catch (error) {
    const authoritativeRunState = error?.details?.runState;
    if (authoritativeRunState) {
      synchronizeTeacherRunState(authoritativeRunState);
    } else if (currentRoleState()?.agentSessionId) {
      try {
        const latest = await getTeacherCommands(currentRoleState().agentSessionId, 0);
        synchronizeTeacherRunState(latest.runState);
      } catch {
        // 保留原轨道；下一个三秒轮询会再次同步可领取角色。
      }
    }
    const refreshedChoice = roleChoice(role.id);
    if (error.code === 'COURSE_ROLE_TAKEN' || refreshedChoice.state === 'taken') {
      showToast('这个角色刚刚被同组成员领取，请选择其他角色。');
    } else {
      showToast(studentFacingError(error, '这个角色暂时无法领取，请重试。'));
    }
    return;
  }

  roleState.agentSessionId = confirmedSessionId;
  if (reusedPhaseSession) state.phaseSessionBoundRoleId = role.id;
  if (!roleState.messages.length) roleState.messages = phaseHistoryForRole();
  state.currentRoleId = role.id;
  state.currentPhaseId = lesson.roleSystem.phaseId;
  state.activeTab = 'task';
  beginCurrentPhase();
  renderLearningShell();
  showScreen('learningShell');
  closeSheet();
  void pollTeacherCommands();
  // bind / activate 的服务端会话已经确定，立即同步当前权威学习投影。
  void reportCurrentPresence({ owner: role, track: roleState }).catch(() => undefined);
  if (teacherRunBlocksLearning()) return;
  renderLearningShell();
  window.setTimeout(scrollChatToBottom, 40);
  // 阶段任务的对话历史会被带进角色视图，所以这里不能再用 messages.length 判断
  // 是否首次入场；entryStarted 才是角色任务轨道是否真正启动的权威标记。
  if (!roleState.entryStarted) {
    roleState.entryStarted = true;
    roleState.entryReady = false;
    await runAgentTurn(
      { type: 'lifecycle_event', event: 'role_assigned', data: { roleId: role.id } },
      { initialEmpty: true, showLoading: false },
    );
    roleState.entryReady = !roleState.lastAgentRequestError;
    if (!roleState.entryReady) roleState.entryStarted = false;
    renderLearningShell();
  }
}

function renderHeader() {
  const role = currentRole();
  const roleState = currentRoleState();
  const phaseMode = role.scope === 'phase';
  const progress = Math.round((roleState.progress / role.tasks.length) * 100);
  document.querySelector('#headerRoleBadge').src = role.badgeImage;
  const roleSwitchDisabled = phaseMode || state.agentBusy || state.qaForceBusy || (!prototypeFreeRoleSelection && state.teacherRolesLocked);
  document.querySelector('.role-switch-button').disabled = roleSwitchDisabled;
  document.querySelector('.role-switch-button').setAttribute('aria-label', phaseMode
    ? '课程导入阶段'
    : state.teacherRolesLocked ? '老师已锁定角色' : '切换角色');
  document.querySelector('#headerRoleName').textContent = phaseMode
    ? `${role.name} · ${roleState.completed ? '课程导入完成' : '选择角色前'}`
    : `${role.name} · ${roleState.completed ? `${lesson.roleSystem.itemName}任务完成` : (currentPhase()?.name || '课程任务')}`;
  document.querySelector('#headerPhase').textContent = roleState.completed
    ? (phaseMode ? '前置阶段已完成' : '角色任务已完成')
    : `${phaseMode ? '阶段任务' : '第'} ${roleState.progress + 1}${phaseMode ? '' : ' 阶段'} · ${currentTask().name}`;
  document.querySelector('#taskStatusText').textContent = roleState.completed
    ? `${role.tasks.length} 项任务已完成`
    : `任务 ${roleState.progress + 1} / ${role.tasks.length}`;
  document.querySelector('#phaseProgressFill').style.width = `${Math.max(8, progress)}%`;
}

function renderLearningShell() {
  renderHeader();
  renderTabs();
  renderChat();
  renderTeam();
  renderProgressSheet();
  renderTimeBank();
  renderRoleSwitch();
  updateBalances();
  refreshIcons();
}

function renderTabs() {
  const phaseMode = currentRole()?.scope === 'phase';
  if (phaseMode && state.activeTab !== 'task') state.activeTab = 'task';
  document.querySelectorAll('.primary-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === state.activeTab);
    if (tab.dataset.tab === 'team') tab.hidden = phaseMode;
  });
  document.querySelector('#taskTab').classList.toggle('is-active', state.activeTab === 'task');
  document.querySelector('#teamTab').classList.toggle('is-active', state.activeTab === 'team');
}

function assistantMessage(message) {
  const text = studentFacingText(message.text, {
    channel: 'assistant',
    fallback: '这条提示暂时没有完整显示，请再试一次。',
  });
  const source = studentFacingText(message.source, { channel: 'source' });
  return `
    <div class="message-row" data-message-id="${escapeHtml(message.id || '')}">
      ${companionAvatar()}
      <div class="message-content">
        <p class="message-name">${escapeHtml(PLATFORM_COMPANION.name)} · AI 学习同伴</p>
        <div class="message-bubble">
          <span data-message-text>${escapeHtml(text)}</span>
          ${source ? `<span class="source-label"><i data-lucide="book-open-check"></i>${escapeHtml(source)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function userMessage(message) {
  return `
    <div class="message-row message-row--user">
      <div class="message-content">
        <p class="message-name">我</p>
        <div class="message-bubble">${escapeHtml(message.text)}</div>
      </div>
    </div>
  `;
}

function quickRepliesMessage(message) {
  return `
    <div class="quick-replies" role="group" aria-label="快捷回复">
      ${message.options.map((option) => {
    const label = studentFacingText(option.label, {
      channel: 'quick-reply', fallback: '继续',
    });
    const value = studentFacingText(option.value || label, {
      channel: 'quick-reply-value', fallback: label,
    });
    return `
        <button type="button" data-action="send-quick-reply"
          data-question-id="${escapeHtml(message.questionId || '')}"
          data-act="${escapeHtml(option.act || 'affirm')}"
          data-value="${escapeHtml(value)}"
          data-label="${escapeHtml(label)}">
          ${escapeHtml(label)}
        </button>
      `;
  }).join('')}
    </div>
  `;
}

function phaseMessage(message) {
  if (message.stageName) {
    const minutes = Number(message.suggestedSeconds || 0) > 0
      ? Math.max(1, Math.round(Number(message.suggestedSeconds) / 60))
      : 0;
    return `
      <article class="stage-message">
        <span class="stage-message__index">第 ${escapeHtml(message.stageNumber)} 阶段</span>
        <div>
          <h3>${escapeHtml(studentFacingText(message.stageName, { channel: 'stage-name', fallback: '当前阶段' }))}</h3>
          <p>${message.location ? `地点：${escapeHtml(studentFacingText(message.location, { channel: 'stage-location' }))} · ` : ''}${minutes ? `预计：${minutes} 分钟 · ` : ''}主要任务：${escapeHtml(studentFacingText(message.mainTask, { channel: 'stage-task', fallback: '完成当前课程任务' }))}</p>
        </div>
      </article>
    `;
  }
  return `<div class="phase-message"><i data-lucide="flag"></i><span>${escapeHtml(studentFacingText(message.text, { channel: 'phase', fallback: '课程状态已更新。' }))}</span></div>`;
}

function navigationCard(message) {
  const role = currentRole();
  const roleState = currentRoleState();
  const location = studentFacingText(message.payload?.location || role.location, {
    channel: 'navigation-location', fallback: '当前任务点',
  });
  const automatic = message.payload?.verification === 'geofence';
  const coordinates = message.payload?.coordinates || null;
  return `
    <article class="tool-card">
      <div class="tool-card__visual">
        <div class="amap-navigation" role="img" aria-label="前往${escapeHtml(location)}的高德地图"
          data-location="${escapeHtml(location)}"
          data-venue="${escapeHtml(lesson.venue || '')}"
          data-coordinates="${escapeHtml(JSON.stringify(coordinates))}"
          data-radius-meters="${escapeHtml(message.payload?.radiusMeters || '')}">
          <div class="amap-navigation__loading"><span></span><strong>正在加载高德地图</strong></div>
        </div>
        <span class="tool-card__visual-badge"><i data-lucide="navigation"></i>高德地图 · 步行导航</span>
      </div>
      <div class="tool-card__body">
        <div class="tool-card__kicker"><span>任务地点</span><span>请跟随老师统一移动</span></div>
        <h3>前往${escapeHtml(location)}</h3>
        <p>${automatic ? '进入任务范围后可以确认到达。' : '到达后请手动确认。'}请跟随老师有组织地移动。</p>
        <div class="tool-card__actions">
          <button class="tool-secondary" type="button" data-action="preview-route"
            data-location="${escapeHtml(location)}"
            data-venue="${escapeHtml(lesson.venue || '')}"
            data-coordinates="${escapeHtml(JSON.stringify(coordinates))}"><i data-lucide="map"></i>高德导航</button>
          <button class="tool-primary" type="button" data-action="arrive-role-location" data-tool-call-id="${escapeHtml(message.callId || '')}" ${roleState.arrived ? 'disabled' : ''}>
            <i data-lucide="map-pin-check"></i>${roleState.arrived ? '已到达' : '我已到达'}
          </button>
        </div>
      </div>
    </article>
  `;
}

function taskVisual(role, task) {
  return task.image || role.cardImage;
}

function defaultTaskPayload(task, taskIndex) {
  const configuredTools = [
    ...(task.tools || []),
    ...(task.steps || []).flatMap((step) => step.tools || []),
  ];
  const photo = configuredTools.find((tool) => tool.id === 'photo');
  return {
    taskId: task.id,
    taskIndex,
    config: {
      tools: task.tools || [],
      minEvidenceCount: photo ? Number(photo.config?.minCount || 1) : 0,
    },
  };
}

function renderTaskWorkspace({
  role,
  roleState,
  task,
  taskIndex,
  status = 'active',
  payload = defaultTaskPayload(task, taskIndex),
  callId = '',
  view = 'dialogue',
  readOnly = false,
}) {
  const evidence = taskEvidence(task.id);
  const visibleTaskName = studentFacingText(task.name, {
    channel: 'task-title', fallback: '当前任务',
  });
  const visibleRequirement = studentFacingText(task.requirement, {
    channel: 'task-requirement', fallback: '请按当前小步完成观察和记录。',
  });
  const evidenceUploadBusy = state.evidenceUploadCount > 0;
  const isComplete = status === 'complete' || readOnly;
  const qaOverrideCompleted = roleState.qaOverrides?.some((item) => item.taskId === task.id)
    || roleState.challengeFeedback?.[task.id]?.kind === 'qa_override';
  // 0 表示视频／文字／扫码等任务不要求照片；使用 ?? 保留这个有效值。
  const minimumEvidence = Number(payload?.config?.minEvidenceCount ?? 1);
  const actionIcon = payload?.config?.tools?.[0]?.icon || task.tools?.[0]?.icon || 'notebook-pen';
  const stepDefinitions = task.steps?.length
    ? task.steps
    : (task.guidanceSteps?.length ? task.guidanceSteps : [task.requirement]).map((studentAction, index) => ({
      id: `${task.id}-step-${index + 1}`,
      studentAction,
      completionMode: 'user_confirm',
    }));
  const steps = stepDefinitions.map((step) => studentFacingText(
    step.studentAction || step.objective,
    { channel: 'task-step', fallback: '完成当前小步。' },
  ));
  const stepIndex = Math.min(Number(roleState.guidanceStepIndices[task.id] || 0), steps.length);
  const stepsComplete = stepIndex >= steps.length;
  const finalizationMode = task.finalizationMode || DEFAULT_TASK_FINALIZATION_MODE;
  const taskFinalization = roleState.taskFinalizations?.[task.id] || {
    taskId: task.id,
    mode: finalizationMode,
    status: stepsComplete
      ? (finalizationMode === 'teacher_confirm'
        ? 'awaiting_teacher_confirm'
        : finalizationMode === 'auto_on_last_step' ? 'completed' : 'awaiting_bundle_submit')
      : 'collecting_steps',
  };
  const awaitingTeacherFinalization = taskFinalization.status === 'awaiting_teacher_confirm';
  const activeStep = stepDefinitions[stepIndex];
  const activeTools = activeStep?.tools?.length
    ? activeStep.tools
    : (payload?.config?.tools?.length ? payload.config.tools : (task.tools || []));
  const selfCompletingMedia = activeStep?.completionMode === 'tool_result'
    && activeTools.some((tool) => tool.id === 'media');
  const stepId = activeStep?.id || `${task.id}-complete`;
  const canCompleteStep = studentCanCompleteStep(activeStep);
  const toolCallReady = standaloneMode || Boolean(callId);
  const completedPhotoEditors = stepsComplete
    ? renderCompletedPhotoEditors({
      steps: stepDefinitions,
      evidence,
      allEvidence: roleState.evidence,
      taskId: task.id,
    })
    : '';
  // 这个任务已经做完、但在等推进（`推进方式：teacher`／`ai_suggest`）。
  // 等待期间服务端不开新工具卡也不动 currentTaskIndex，所以卡片还是这一张——
  // 必须换掉提交区，否则学生看到的是一个点了没反应的「提交给絮絮分析」。
  const waiting = roleState.pendingAdvance?.taskId === task.id ? roleState.pendingAdvance.mode : '';

  return `
    <article class="tool-card task-workspace" data-task-card="${task.id}" data-learning-workspace="${escapeHtml(view)}">
      <div class="tool-card__visual">
        <img src="${taskVisual(role, task)}" alt="${escapeHtml(visibleTaskName)}任务素材" />
        <span class="tool-card__visual-badge"><i data-lucide="${actionIcon}"></i>${escapeHtml(task.modules || '任务工具')}</span>
      </div>
      <div class="tool-card__body">
        <div class="tool-card__kicker"><span>任务 ${taskIndex + 1} / ${role.tasks.length}</span><span>${isComplete ? '已提交' : '进行中'}</span></div>
        <h3>${escapeHtml(visibleTaskName)}</h3>
        <p>${escapeHtml(visibleRequirement)}</p>
        <div class="module-tags">
          ${moduleLabels(task.modules).map((module) => `<span class="module-tag">${escapeHtml(studentFacingText(module, { channel: 'task-module' }))}</span>`).join('')}
        </div>
        ${!isComplete && !waiting ? `
          <section class="task-step-guide ${stepsComplete ? 'is-complete' : ''}">
            <div class="task-step-guide__top">
              <span>${stepsComplete ? '小步已完成' : `当前小步 ${stepIndex + 1} / ${steps.length}`}</span>
              <strong>${stepsComplete ? `${steps.length} / ${steps.length}` : `${stepIndex + 1} / ${steps.length}`}</strong>
            </div>
            <p>${escapeHtml(stepsComplete
    ? (taskFinalization.mode === 'teacher_confirm'
      ? '小步都已通过，正在等待老师终审。'
      : taskFinalization.mode === 'auto_on_last_step'
        ? '最后一步已通过，任务正在自动完成。'
        : '可以整理照片或记录，提交给絮絮检查。')
    : steps[stepIndex])}</p>
            ${stepsComplete ? '' : renderActivityTools({ tools: activeTools, evidence, allEvidence: roleState.evidence, taskId: task.id, stepId })}
            ${stepsComplete || !canCompleteStep || selfCompletingMedia ? '' : `
              <button class="task-step-button" type="button" data-action="complete-activity-step" data-task-id="${task.id}" data-step-index="${stepIndex}" data-step-id="${escapeHtml(stepId)}">
                <i data-lucide="check"></i>${activeStep?.completionMode === 'user_confirm' ? '这一步完成了' : '保存并检查这一步'}
              </button>
            `}
            ${!stepsComplete && activeStep?.completionMode === 'teacher_confirm' ? `<span class="task-step-guide__validation">${standaloneMode ? '本地体验没有连接教师端，这一步会停留等待；正式上课时由老师确认。' : '提交后需要老师确认，确认前会停留在本小步。'}</span>` : ''}
            ${!stepsComplete && activeStep?.completionMode === 'location_event' ? '<span class="task-step-guide__validation">到达课程配置地点并验证后，系统会完成本小步。</span>' : ''}
          </section>
        ` : ''}
        ${waiting ? `
          <div class="evidence-form">
            <div class="activity-submit-summary">
              <i data-lucide="${waiting === 'teacher' ? 'hand' : 'circle-check-big'}"></i>
              <div><strong>${waiting === 'teacher' ? '这个任务要老师确认后才继续' : '这个任务已经完成'}</strong><span>${waiting === 'teacher' ? '老师在教师端确认后会自动进入下一个任务。' : '准备好了就自己进入下一个任务。'}</span></div>
            </div>
            ${waiting === 'student' ? `
              <button class="tool-primary" type="button" data-action="advance-task" data-task-id="${task.id}">
                <i data-lucide="arrow-right"></i>继续下一个任务
              </button>
            ` : ''}
          </div>
        ` : awaitingTeacherFinalization ? `
          <div class="evidence-form">
            <div class="activity-submit-summary">
              <i data-lucide="hand"></i>
              <div><strong>所有小步已完成，等待老师终审</strong><span>老师确认后，系统才会把这项任务记为完成。</span></div>
            </div>
          </div>
        ` : isComplete ? `
          <div class="source-label"><i data-lucide="circle-check-big"></i>${qaOverrideCompleted ? '验收模式已标记完成，未生成学习证据' : '证据已进入个人学习档案'}</div>
        ` : `
          <div class="evidence-form ${stepsComplete ? '' : 'is-locked'}">
            ${evidence.validationError ? `<p class="evidence-error"><i data-lucide="info"></i>${escapeHtml(studentFacingText(evidence.validationError, { channel: 'validation', fallback: '请检查当前小步后重试。' }))}</p>` : ''}
            ${stepsComplete ? `<div class="activity-submit-summary"><i data-lucide="circle-check-big"></i><div><strong>所有小步已完成</strong><span>${evidence.imageUrls.length ? `已采集 ${evidence.imageUrls.length} 个文件；` : ''}提交前仍可删除、重拍或补拍照片。</span></div></div>${completedPhotoEditors}<textarea class="task-textarea" data-task-text="${task.id}" placeholder="可补充说明你的判断依据…">${escapeHtml(evidence.text)}</textarea>` : ''}
            ${view === 'challenge' && !toolCallReady ? '<div class="challenge-tool-waiting"><i data-lucide="sparkles"></i>智能体正在准备本任务的提交通道，小步操作可以先继续。</div>' : ''}
            <button class="tool-primary" type="button" data-action="submit-task" data-task-id="${task.id}" data-tool-call-id="${escapeHtml(callId)}" data-min-evidence="${minimumEvidence}" ${stepsComplete && toolCallReady && !evidenceUploadBusy ? '' : 'disabled'}>
              <i data-lucide="${evidenceUploadBusy ? 'loader-circle' : 'sparkles'}"></i>${evidenceUploadBusy ? '正在上传证据…' : stepsComplete ? (toolCallReady ? `提交给${escapeHtml(PLATFORM_COMPANION.name)}分析` : '等待任务通道') : '完成当前小步后提交'}
            </button>
          </div>
        `}
      </div>
    </article>
  `;
}

function taskCard(message) {
  const role = currentRole();
  const roleState = currentRoleState();
  const task = role.tasks[message.taskIndex];
  if (!task) return '';
  if (state.learningView === 'challenge') {
    return `
      <div class="challenge-task-summary">
        <i data-lucide="list-checks"></i>
        <div><strong>${escapeHtml(task.name)}</strong><span>${message.status === 'complete' ? '任务已完成' : '当前任务已在闯关视图中展开'}</span></div>
      </div>
    `;
  }
  return renderTaskWorkspace({
    role,
    roleState,
    task,
    taskIndex: message.taskIndex,
    status: message.status,
    payload: message.payload,
    callId: message.callId,
    view: 'dialogue',
  });
}

function challengeFeedbackMarkup(taskId) {
  const feedback = currentRoleState().challengeFeedback?.[taskId];
  if (!feedback) return '';
  const labels = {
    checking: 'AI 正在检查',
    passed: '本次检查通过',
    revision: '请继续修改',
    failed: '检查暂未完成',
  };
  const label = feedback.kind === 'qa_override'
    ? '平台验收标记已完成'
    : (labels[feedback.status] || '任务反馈');
  const text = feedback.text || (feedback.status === 'checking'
    ? '正在核对当前 Step 的证据和完成条件…'
    : '结果已记录。');
  return `
    <section class="challenge-feedback is-${escapeHtml(feedback.status || 'checking')}" data-challenge-feedback="${escapeHtml(taskId)}" aria-live="polite">
      <strong>${escapeHtml(label)}</strong>
      <p>${escapeHtml(studentFacingText(text, { channel: 'challenge-feedback', fallback: '检查结果暂未完整显示，请再试一次。' }))}</p>
    </section>
  `;
}

function renderLearningViewControls() {
  const config = lesson.learningView || {};
  const fab = document.querySelector('#learningModeFab');
  const button = document.querySelector('#learningModeButton');
  const companionMount = document.querySelector('#learningModeCompanion');
  const dialogueView = document.querySelector('#dialogueView');
  const challengeView = document.querySelector('#challengeView');
  const switchVisible = Boolean(config.enabled && config.allowStudentSwitch && state.activeTab === 'task');
  const targetView = state.learningView === 'dialogue' ? 'challenge' : 'dialogue';
  const targetLabel = targetView === 'challenge' ? '切换为闯关模式' : '切换为智能 AI 模式';
  if (!companionMount.hasChildNodes()) companionMount.innerHTML = companionAvatar({ variant: 'floating' });
  fab.hidden = !switchVisible;
  fab.classList.toggle('is-dialogue', state.learningView === 'dialogue');
  fab.classList.toggle('is-challenge', state.learningView === 'challenge');
  button.dataset.learningView = targetView;
  button.setAttribute('aria-label', targetLabel);
  button.innerHTML = `<i data-lucide="${targetView === 'challenge' ? 'list-checks' : 'message-circle-more'}"></i><span>${targetLabel}</span>`;
  dialogueView.classList.toggle('is-active', state.learningView === 'dialogue');
  challengeView.classList.toggle('is-active', state.learningView === 'challenge');
}

function renderChallenge() {
  const container = document.querySelector('#challengeContent');
  if (!container) return;
  if (state.learningView !== 'challenge') {
    container.innerHTML = '';
    return;
  }
  const role = currentRole();
  const roleState = currentRoleState();
  roleState.challengePageIndex = clampChallengePageIndex({
    requestedIndex: roleState.challengePageIndex,
    progress: roleState.progress,
    taskCount: role.tasks.length,
    roleCompleted: roleState.completed,
  });
  const pageIndex = roleState.challengePageIndex;
  const task = role.tasks[pageIndex];
  const access = challengeTaskAccess({
    taskIndex: pageIndex,
    progress: roleState.progress,
    taskCount: role.tasks.length,
    roleCompleted: roleState.completed,
  });
  const payload = roleState.taskPayloads?.[task.id] || defaultTaskPayload(task, pageIndex);
  const callId = roleState.taskCallIds?.[task.id] || (standaloneMode ? `local-${role.id}-${task.id}` : '');
  const currentPageIndex = roleState.completed
    ? role.tasks.length - 1
    : Math.min(roleState.progress, role.tasks.length - 1);
  const qaControlVisible = qaProgressControlEnabled
    && access === 'current'
    && !roleState.completed
    && roleState.entryReady;
  container.innerHTML = `
    <header class="challenge-hero">
      <span>${escapeHtml(role.name)} · 任务闯关</span>
      <strong>${escapeHtml(task.name)}</strong>
      <p>一页完成一项任务；每个 Step 通过后自动进入下一步。</p>
    </header>
    ${challengeFeedbackMarkup(task.id)}
    ${renderTaskWorkspace({
      role,
      roleState,
      task,
      taskIndex: pageIndex,
      status: access === 'completed' ? 'complete' : 'active',
      payload,
      callId,
      view: 'challenge',
      readOnly: access === 'completed',
    })}
    ${qaControlVisible ? `
      <aside class="qa-progress-control" aria-label="平台验收控制">
        <div class="qa-progress-control__copy">
          <span><i data-lucide="flag"></i>平台验收模式</span>
          <p>仅用于走查完整课程。执行后会绕过本关的证据、定位、教师确认和 AI 检查，并真实更新当前测试会话。</p>
        </div>
        <button type="button" data-action="qa-force-complete" data-task-id="${escapeHtml(task.id)}" ${state.agentBusy || state.qaForceBusy ? 'disabled' : ''}>
          <i data-lucide="fast-forward"></i>${state.qaForceBusy ? '正在推进…' : pageIndex >= role.tasks.length - 1 ? '强制完成最后一关' : '强制完成本关并进入下一关'}
        </button>
      </aside>
    ` : ''}
    <nav class="challenge-page-nav" aria-label="已完成任务回看">
      <button type="button" data-action="challenge-previous" ${pageIndex <= 0 ? 'disabled' : ''}><i data-lucide="chevron-left"></i>上一任务</button>
      <span>${pageIndex + 1} / ${role.tasks.length} · ${access === 'completed' ? '已完成回看' : '当前任务'}</span>
      ${pageIndex < currentPageIndex
        ? '<button type="button" data-action="challenge-forward">下一任务<i data-lucide="arrow-right"></i></button>'
        : `<span class="challenge-page-nav__hint">${roleState.completed ? '角色任务已完成' : '完成后自动进入下一项'}</span>`}
    </nav>
  `;
}

function setLearningView(targetView) {
  if (targetView === state.learningView) return;
  const resolvedView = nextLearningView({ current: state.learningView, target: targetView, config: lesson.learningView });
  if (resolvedView === state.learningView) return;
  state.learningView = resolvedView;
  const roleState = currentRoleState();
  roleState.challengePageIndex = clampChallengePageIndex({
    requestedIndex: roleState.challengePageIndex,
    progress: roleState.progress,
    taskCount: currentRole().tasks.length,
    roleCompleted: roleState.completed,
  });
  renderLearningShell();
  if (resolvedView === 'dialogue') window.setTimeout(scrollChatToBottom, 20);
  else document.querySelector('#challengeScroll')?.scrollTo({ top: 0, behavior: 'auto' });
}

function selectChallengePage(requestedIndex) {
  const role = currentRole();
  const roleState = currentRoleState();
  const nextIndex = clampChallengePageIndex({
    requestedIndex,
    progress: roleState.progress,
    taskCount: role.tasks.length,
    roleCompleted: roleState.completed,
  });
  roleState.challengePageIndex = nextIndex;
  renderChat();
  document.querySelector('#challengeScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
}

async function forceCompleteChallengeTask(taskId) {
  if (!qaProgressControlEnabled) return;
  const role = currentRole();
  const roleState = currentRoleState();
  if (!roleState.entryReady) {
    showToast('当前任务还在准备中，请稍后再进行验收推进。');
    return;
  }
  const taskIndex = Math.min(roleState.progress, role.tasks.length - 1);
  const task = role.tasks[taskIndex];
  if (!task || roleState.completed || task.id !== taskId) {
    showToast('当前任务已经变化，请按最新关卡继续。');
    renderLearningShell();
    return;
  }
  if (state.agentBusy || state.qaForceBusy) {
    showToast('上一项操作还在处理中，请稍等。');
    return;
  }
  const confirmed = window.confirm(
    `确认强制完成“${task.name}”吗？\n\n这会绕过本关的证据、定位、教师确认和 AI 检查，并真实更新当前测试会话。`,
  );
  if (!confirmed) return;

  state.qaForceBusy = true;
  state.agentBusy = true;
  renderLearningShell();
  try {
    if (standaloneMode) {
      const result = completeLocalTaskProgress({
        role,
        roleState,
        taskId,
        qaOverride: true,
      });
      if (!result.ok) throw new Error('当前任务已经变化，请按最新关卡继续。');
      roleState.challengeFeedback[taskId] = {
        status: 'passed',
        text: '平台验收模式已强制完成本关；未生成学习证据。',
        kind: 'qa_override',
      };
      if (result.roleCompleted) {
        if (role.scope === 'phase') window.setTimeout(finishPhaseLearning, PHASE_TRANSITION_DELAY_MS);
        else if (!roleState.messages.some((message) => message.type === 'token')) {
          roleState.messages.push({ id: crypto.randomUUID(), type: 'token' });
        }
      } else {
        roleState.messages.push(...currentTaskRecoveryMessages(role, roleState));
      }
      showToast(result.roleCompleted ? '验收推进完成：角色任务已全部完成。' : '验收推进完成：已进入下一关。');
    } else {
      if (!roleState.agentSessionId) throw new Error('当前会话尚未建立，请稍后重试。');
      const result = await forceCompleteCurrentTaskRequest({
        sessionId: roleState.agentSessionId,
        taskId,
        requestId: crypto.randomUUID(),
      });
      for (const event of result.events || []) applyAgentEvent(event, null, { role, roleState });
      roleState.challengeFeedback[taskId] = {
        status: 'passed',
        text: '平台验收模式已强制完成本关；未生成学习证据。',
        kind: 'qa_override',
      };
      showToast(result.allTasksCompleted ? '验收推进完成：角色任务已全部完成。' : '验收推进完成：已进入下一关。');
    }
  } catch (error) {
    const visibleError = studentFacingError(error, '验收推进失败，请重试。');
    roleState.challengeFeedback[taskId] = {
      status: 'failed',
      text: visibleError,
      kind: 'qa_override',
    };
    showToast(visibleError);
  } finally {
    state.qaForceBusy = false;
    finishAgentActivity();
    renderLearningShell();
    document.querySelector('#challengeScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function tokenReveal() {
  const role = currentRole();
  const itemName = lesson.roleSystem.collectionItemName;
  return `
    <article class="token-reveal">
      <img src="${role.collectionItemImage}" alt="${escapeHtml(role.collectionItem)}${escapeHtml(itemName)}" />
      <div>
        <p class="eyebrow">${escapeHtml(lesson.roleSystem.itemName)}任务完成</p>
        <h3>获得${escapeHtml(itemName)} ${escapeHtml(role.collectionItem)}</h3>
        <p>这是你完成本角色任务获得的个人${escapeHtml(itemName)}。请带着它参加小组汇合；老师会核对全组进度并组织进入“${escapeHtml(lesson.roleSystem.unlockTarget)}”。</p>
      </div>
    </article>
  `;
}

function renderMessage(message) {
  if (message.type === 'assistant') return assistantMessage(message);
  if (message.type === 'user') return userMessage(message);
  if (message.type === 'phase') return phaseMessage(message);
  if (message.type === 'navigation') return navigationCard(message);
  if (message.type === 'task') {
    const card = taskCard(message);
    if (!card) return '';
    const republished = currentRoleState().republishedTaskMessageId === message.id;
    return `<div class="task-card-placement ${republished ? 'is-republished' : ''}" data-task-message-id="${escapeHtml(message.id || '')}">${card}</div>`;
  }
  if (message.type === 'token') return tokenReveal();
  if (message.type === 'quick-replies') return quickRepliesMessage(message);
  if (message.type === 'loading') {
    return `
      <div class="message-row">
        ${companionAvatar({ motion: 'talk' })}
        <div class="loading-bubble" aria-label="${escapeHtml(PLATFORM_COMPANION.name)}正在分析"><span></span><span></span><span></span></div>
      </div>
    `;
  }
  return '';
}

function cloneMessages(messages = []) {
  try {
    return structuredClone(messages);
  } catch {
    return messages.map((message) => ({ ...message }));
  }
}

function currentTaskRecoveryMessages(role, roleState) {
  const taskIndex = Math.min(roleState.progress, role.tasks.length - 1);
  const task = role.tasks[taskIndex];
  if (!task) return [];
  const callId = roleState.taskCallIds?.[task.id] || (standaloneMode ? `local-${role.id}-${task.id}` : '');
  const payload = roleState.taskPayloads?.[task.id] || defaultTaskPayload(task, taskIndex);
  const recoveryText = studentFacingText(`界面已恢复 · 继续完成「${task.name}」`, {
    channel: 'recovery', fallback: '界面已恢复 · 请继续当前任务',
  });
  return [
    {
      id: crypto.randomUUID(),
      type: 'phase',
      text: recoveryText,
    },
    {
      id: crypto.randomUUID(),
      type: 'task',
      callId,
      taskIndex,
      status: 'active',
      payload,
    },
  ];
}

function renderableChatMessages(role, roleState) {
  if (roleState.messages.length) {
    roleState.lastRenderableMessages = cloneMessages(roleState.messages);
    return roleState.messages;
  }
  if (roleState.lastRenderableMessages?.length) {
    roleState.messages = cloneMessages(roleState.lastRenderableMessages);
    return roleState.messages;
  }
  if (!roleState.entryStarted) return roleState.messages;
  roleState.messages = currentTaskRecoveryMessages(role, roleState);
  roleState.lastRenderableMessages = cloneMessages(roleState.messages);
  return roleState.messages;
}

function renderChat() {
  if (!state.currentRoleId && !isPhaseTrackActive()) return;
  resetShellScrollOffsets();
  renderLearningViewControls();
  const role = currentRole();
  const roleState = currentRoleState();
  navigationMapInstances.forEach((map) => map?.destroy?.());
  navigationMapInstances = [];
  mapHydrationVersion += 1;
  document.querySelector('#chatMessages').innerHTML = renderableChatMessages(role, roleState).map(renderMessage).join('');
  renderChallenge();
  resetShellScrollOffsets();
  refreshIcons();
  if (state.learningView === 'dialogue') hydrateNavigationMaps(mapHydrationVersion);
  window.requestAnimationFrame(() => hydrateCompanionAvatars());
  window.requestAnimationFrame(hydrateSketchCanvases);
  if (roleState.republishedTaskMessageId) {
    window.requestAnimationFrame(() => {
      roleState.republishedTaskMessageId = null;
    });
  }
}

function drawCanvasImage(canvas, source) {
  if (!source) return;
  const image = new Image();
  image.onload = () => canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.src = source;
}

function hydrateSketchCanvases() {
  document.querySelectorAll('[data-sketch-canvas]').forEach((canvas) => {
    if (canvas.dataset.hydrated === 'true') return;
    canvas.dataset.hydrated = 'true';
    canvas.dataset.brush = '#8d211f';
    const context = canvas.getContext('2d');
    context.fillStyle = '#fffdf8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawCanvasImage(canvas, canvas.dataset.snapshot || canvas.dataset.background);
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
      };
    };
    canvas.addEventListener('pointerdown', (event) => {
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const start = point(event);
      context.beginPath();
      context.moveTo(start.x, start.y);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drawing) return;
      const next = point(event);
      context.strokeStyle = canvas.dataset.brush || '#8d211f';
      context.lineWidth = 5;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineTo(next.x, next.y);
      context.stroke();
    });
    const finish = () => {
      if (!drawing) return;
      drawing = false;
      const value = activityValue(canvas.dataset.taskId, canvas.dataset.stepId, 'sketch');
      value.dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      value.completed = true;
      currentRoleState().lastLocalActionAt = Date.now();
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  });
}

async function hydrateNavigationMaps(version) {
  const containers = [...document.querySelectorAll('.amap-navigation')];
  const maps = await Promise.all(containers.map((container) => {
    let coordinates = null;
    try { coordinates = JSON.parse(container.dataset.coordinates || 'null'); } catch { coordinates = null; }
    return mountAmapNavigation(container, {
      coordinates,
      location: container.dataset.location,
      venue: container.dataset.venue,
      radiusMeters: container.dataset.radiusMeters,
    });
  }));
  if (version !== mapHydrationVersion) {
    maps.forEach((map) => map?.destroy?.());
    return;
  }
  navigationMapInstances = maps.filter(Boolean);
}

function scrollChatToBottom() {
  resetShellScrollOffsets();
  const scroll = document.querySelector('#chatScroll');
  if (scroll) scroll.scrollTo({ top: scroll.scrollHeight, behavior: 'smooth' });
  window.requestAnimationFrame(() => resetShellScrollOffsets());
}

function waitFor(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function revealLocalMessages(roleState, messages, { initialEmpty = false } = {}) {
  let visibleEventCount = 0;
  for (const message of messages) {
    const event = {
      type: message.type === 'task'
        ? 'tool.requested'
        : message.type === 'phase' ? 'stage.started' : 'assistant.completed',
    };
    const delay = visibleEventDelay(event, { visibleEventCount, initialEmpty });
    if (delay) await waitFor(delay);
    roleState.messages.push(message);
    visibleEventCount += 1;
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 20);
  }
}

function beginChallengeFeedback({ taskId, stepId = '', beforeStepIndex = 0, taskIndex = 0, kind = 'step' }) {
  if (state.learningView !== 'challenge') return null;
  const roleState = currentRoleState();
  const target = { taskId, stepId, beforeStepIndex, taskIndex, kind };
  roleState.challengeFeedback[taskId] = {
    status: 'checking',
    text: '',
    stepId,
    kind,
  };
  renderChat();
  return target;
}

function refreshChallengeFeedback(taskId) {
  if (state.learningView !== 'challenge') return;
  const node = document.querySelector(`[data-challenge-feedback="${CSS.escape(taskId)}"]`);
  if (node) node.outerHTML = challengeFeedbackMarkup(taskId);
}

function applyChallengeFeedbackEvent(event, target) {
  if (!target) return;
  const roleState = currentRoleState();
  const feedback = roleState.challengeFeedback?.[target.taskId];
  if (!feedback) return;
  if (event.type === 'assistant.delta') {
    feedback.text += event.data.text || '';
  }
  if (event.type === 'assistant.completed') {
    feedback.text = event.data.text || feedback.text;
  }
  if (event.type === 'state.updated') {
    const passed = challengeSubmissionPassed({
      kind: target.kind,
      taskIndex: target.taskIndex,
      beforeStepIndex: target.beforeStepIndex,
      currentTaskIndex: roleState.progress,
      runtimeTaskId: event.data.runtime?.taskId,
      runtimeStepIndex: event.data.runtime?.guidanceStepIndex,
      taskId: target.taskId,
      roleCompleted: roleState.completed,
    });
    feedback.status = passed ? 'passed' : 'revision';
    if (!feedback.text) {
      feedback.text = passed ? '当前内容已经记录，可以继续下一步。' : '当前 Step 还需要补充，请根据完成条件继续修改。';
    }
  }
  refreshChallengeFeedback(target.taskId);
}

function applyAgentEvent(event, feedbackTarget = null, targetContext = null) {
  const role = targetContext?.role || currentRole();
  const roleState = targetContext?.roleState || currentRoleState();
  if (event.type === 'stage.started') {
    roleState.messages = roleState.messages.filter((message) => message.type !== 'quick-replies');
    const stageMessageId = `stage-${event.data.stageNumber}-${event.data.stageName}`;
    const stageMessage = {
      id: stageMessageId,
      type: 'phase',
      stageNumber: event.data.stageNumber,
      stageName: event.data.stageName,
      mainTask: event.data.mainTask,
      location: event.data.location,
      suggestedSeconds: event.data.suggestedSeconds,
    };
    const existingStageIndex = roleState.messages.findIndex((message) => message.id === stageMessageId);
    if (existingStageIndex >= 0) roleState.messages[existingStageIndex] = stageMessage;
    else roleState.messages.push(stageMessage);
  }
  if (event.type === 'assistant.delta') {
    roleState.messages = roleState.messages.filter((message) => message.id !== roleState.activeLoadingId);
    let message = roleState.messages.find((item) => item.id === roleState.streamingMessageId);
    let created = false;
    if (!message) {
      roleState.streamingMessageId = `stream-${crypto.randomUUID()}`;
      message = { id: roleState.streamingMessageId, type: 'assistant', text: '', source: '' };
      roleState.messages.push(message);
      created = true;
    }
    message.text += event.data.text || '';
    const row = [...document.querySelectorAll('[data-message-id]')]
      .find((item) => item.dataset.messageId === message.id);
    const textNode = row?.querySelector('[data-message-text]');
    if (created || !textNode) renderChat();
    else textNode.textContent = studentFacingText(message.text, {
      channel: 'assistant-stream',
      fallback: '这条提示暂时没有完整显示，请再试一次。',
    });
    window.requestAnimationFrame(scrollChatToBottom);
  }
  if (event.type === 'assistant.completed') {
    roleState.messages = roleState.messages.filter((message) => message.type !== 'quick-replies');
    const streamedMessage = roleState.messages.find((message) => message.id === roleState.streamingMessageId);
    const completedMessage = event.data.id
      ? roleState.messages.find((message) => message.id === event.data.id)
      : null;
    if (streamedMessage) {
      if (completedMessage && completedMessage !== streamedMessage) {
        roleState.messages = roleState.messages.filter((message) => message !== streamedMessage);
      }
      const targetMessage = completedMessage || streamedMessage;
      targetMessage.id = event.data.id || targetMessage.id;
      targetMessage.text = event.data.text;
      targetMessage.source = event.data.source?.label || '';
      targetMessage.citations = event.data.source?.citations || [];
      roleState.streamingMessageId = null;
    } else if (completedMessage) {
      completedMessage.text = event.data.text;
      completedMessage.source = event.data.source?.label || '';
      completedMessage.citations = event.data.source?.citations || [];
    } else {
      roleState.messages.push({
        id: event.data.id || crypto.randomUUID(),
        type: 'assistant',
        text: event.data.text,
        source: event.data.source?.label || '',
        citations: event.data.source?.citations || [],
      });
    }
  }
  if (event.type === 'ui.quick_replies') {
    roleState.messages = roleState.messages.filter((message) => message.type !== 'quick-replies');
    if (event.data.options?.length) {
      roleState.messages.push({
        id: `quick-${event.data.questionId || crypto.randomUUID()}`,
        type: 'quick-replies',
        questionId: event.data.questionId,
        options: event.data.options,
      });
    }
  }
  if (event.type === 'tool.requested') {
    const { callId, payload } = event.data;
    if (payload.renderer === 'navigation') {
      const existingNavigation = roleState.messages.find(
        (message) => message.type === 'navigation' && message.payload?.taskId === payload.taskId,
      );
      if (existingNavigation) {
        existingNavigation.callId = callId;
        existingNavigation.payload = payload;
      } else {
        roleState.messages.push({ id: crypto.randomUUID(), type: 'navigation', callId, payload });
      }
    } else if (payload.renderer === 'teacher-call') {
      callTeacher(false);
      window.setTimeout(() => runAgentTurn({
        type: 'tool_result',
        toolCallId: callId,
        result: { status: 'completed', values: { sent: true } },
      }), 0);
    } else {
      roleState.taskCallIds ||= {};
      roleState.taskPayloads ||= {};
      roleState.taskCallIds[payload.taskId] = callId;
      roleState.taskPayloads[payload.taskId] = payload;
      roleState.messages
        .filter((message) => message.type === 'task' && message.status === 'active')
        .forEach((message) => { message.status = 'complete'; });
      if (!roleState.messages.some((message) => message.type === 'task' && message.callId === callId)) {
        roleState.messages.push({
          id: crypto.randomUUID(),
          type: 'task',
          callId,
          taskIndex: payload.taskIndex,
          status: 'active',
          payload,
        });
      }
    }
  }
  if (event.type === 'state.updated') {
    const previousProgress = roleState.progress;
    if (event.data.phaseId) state.currentPhaseId = event.data.phaseId;
    roleState.progress = event.data.currentTaskIndex;
    const completedCount = event.data.completedTaskIds.filter((id) => id.startsWith(`${role.id}:`)).length;
    if (completedCount >= role.tasks.length) {
      roleState.progress = role.tasks.length;
      if (!roleState.completed && role.scope !== 'phase') {
        roleState.messages.push({ id: crypto.randomUUID(), type: 'token' });
      }
      roleState.completed = true;
    }
    // 做完 `推进方式：teacher`／`ai_suggest` 的任务后进度不动，界面必须说清为什么停住。
    // 没有这一行，学生看到的是一个提交完就没反应的任务卡。
    roleState.pendingAdvance = event.data.pendingAdvance || null;
    const taskFinalization = event.data.taskFinalization || event.data.runtime?.taskFinalization;
    if (taskFinalization?.taskId) {
      roleState.taskFinalizations ||= {};
      roleState.taskFinalizations[taskFinalization.taskId] = taskFinalization;
    }
    for (const message of roleState.messages.filter((item) => item.type === 'task')) {
      const messageTaskId = message.payload?.taskId || role.tasks[message.taskIndex]?.id;
      if (event.data.completedTaskIds.includes(`${role.id}:${messageTaskId}`)) message.status = 'complete';
    }
    if (event.data.qaOverride) {
      roleState.qaOverrides ||= [];
      if (!roleState.qaOverrides.some((item) => item.requestId === event.data.qaOverride.requestId)) {
        roleState.qaOverrides.push(event.data.qaOverride);
      }
    }
    const location = event.data.runtime?.location;
    const runtime = event.data.runtime;
    if (runtime?.taskId) {
      roleState.guidanceStepIndices[runtime.taskId] = Number(runtime.guidanceStepIndex || 0);
    }
    if (runtime?.lastStepRevision) {
      roleState.lastStepRevision = runtime.lastStepRevision;
      roleState.stepRevisionHistory ||= [];
      if (!roleState.stepRevisionHistory.some(
        (entry) => entry.revisionId === runtime.lastStepRevision.revisionId,
      )) {
        roleState.stepRevisionHistory.push(runtime.lastStepRevision);
      }
    }
    // 服务端累计的证据条数是权威值（本地 roleState.evidence 只有当前任务那一份）。
    // 教师端要靠 presence 上报它来判断"这个学生到底交了几项"。
    if (Array.isArray(runtime?.learning?.evidenceIds)) {
      roleState.evidenceCount = runtime.learning.evidenceIds.length;
    }
    if (roleState.progress > previousProgress) {
      roleState.challengePageIndex = Math.min(roleState.progress, role.tasks.length - 1);
    }
    if (location) {
      roleState.arrived = location.status === 'arrived' || location.status === 'not_required';
      roleState.locationStatus = {
        ...roleState.locationStatus,
        permission: location.permission,
        insideFence: location.insideFence,
        accuracyMeters: location.accuracyMeters,
        verifiedBy: location.verifiedBy,
        arrivedAt: location.enteredAt,
      };
    }
    // 教师端的任务投影应跟随权威 state.updated 立即刷新，
    // 不能再等下一个 30 秒心跳。此上报不携带缓存坐标。
    void reportCurrentPresence({ owner: role, track: roleState }).catch(() => undefined);
    if (role.scope === 'phase' && roleState.completed) {
      window.setTimeout(finishPhaseLearning, PHASE_TRANSITION_DELAY_MS);
    }
  }
  applyChallengeFeedbackEvent(event, feedbackTarget);
}

function finishAgentActivity() {
  state.agentBusy = false;
  const queued = state.agentQueue.shift();
  if (queued) window.setTimeout(() => runAgentTurn(queued.input, queued.options), 0);
}

async function runAgentTurn(input, options = {}) {
  const {
    passive = false,
    initialEmpty = false,
    showLoading = !passive && !initialEmpty,
    requestId = crypto.randomUUID(),
    feedbackTarget = null,
  } = options;
  const republishTaskId = !passive
    && input?.type === 'lifecycle_event'
    && ['task_step_completed', 'task_step_revised'].includes(input.event)
    ? String(input.data?.taskId || '')
    : '';
  const roleState = currentRoleState();
  if (!roleState.agentSessionId) return;
  // 暂停、紧急集合和结束都是教师场次的权威门禁。
  // 队列中早于门禁产生的回合也不能在恢复前补执行。
  if (teacherRunBlocksLearning()) {
    if (!passive) showToast(explainTeacherRunGate());
    return;
  }
  const requestLastLocalActionAt = roleState.lastLocalActionAt;
  if (state.agentBusy) {
    if (!passive) {
      state.agentQueue.push({
        input,
        options: {
          passive,
          initialEmpty,
          showLoading,
          requestId,
          feedbackTarget,
        },
      });
    }
    return;
  }
  state.agentBusy = true;
  const loadingId = showLoading ? crypto.randomUUID() : null;
  let shouldRender = !passive;
  const bufferedEvents = [];
  roleState.activeLoadingId = loadingId;
  if (loadingId) {
    roleState.messages.push({ id: loadingId, type: 'loading' });
    renderChat();
    window.setTimeout(scrollChatToBottom, 20);
  }
  try {
    await sendAgentTurn({
      sessionId: roleState.agentSessionId,
      requestId,
      input,
    }, (event) => {
      if (isAuditOnlyTransportEvent(event)) {
        // delta 在服务端完成安全、剧透和完整性审查后才会到达。
        // 学生端仍等 assistant.completed + TurnPlan 逐泡显示，避免全文
        // 先闪现、再缩回第一泡的视觉回退。
        return;
      }
      bufferedEvents.push(event);
    });
    let visibleEventCount = 0;
    let displayedAssistantFeedback = false;
    for (const event of bufferedEvents) {
      if (shouldSuppressPassivePresentation(event, {
        passive,
        requestLastLocalActionAt,
        currentLastLocalActionAt: roleState.lastLocalActionAt,
        pageHidden: document.hidden,
      })) {
        continue;
      }
      const completesStream = event.type === 'assistant.completed' && Boolean(roleState.streamingMessageId);
      const visuallyAddsMessage = event.type === 'stage.started'
        || event.type === 'tool.requested'
        || (event.type === 'assistant.completed' && !completesStream);
      if (visuallyAddsMessage) {
        const delay = visibleEventDelay(event, {
          visibleEventCount,
          initialEmpty,
          completesStream,
        });
        if (delay) await waitFor(delay);
        if (shouldSuppressPassivePresentation(event, {
          passive,
          requestLastLocalActionAt,
          currentLastLocalActionAt: roleState.lastLocalActionAt,
          pageHidden: document.hidden,
        })) {
          continue;
        }
        if (loadingId) roleState.messages = roleState.messages.filter((message) => message.id !== loadingId);
        roleState.activeLoadingId = null;
      }
      if (['assistant.completed', 'stage.started', 'tool.requested', 'ui.quick_replies'].includes(event.type)) shouldRender = true;
      if (event.type === 'assistant.completed') displayedAssistantFeedback = true;
      applyAgentEvent(event, feedbackTarget);
      if (visuallyAddsMessage) {
        visibleEventCount += 1;
        renderLearningShell();
        window.setTimeout(scrollChatToBottom, 20);
      } else if (completesStream) {
        visibleEventCount += 1;
        renderLearningShell();
      }
    }
    roleState.lastAgentRequestError = null;
    const taskCardAlreadyPresented = bufferedEvents.some((event) => (
      event.type === 'tool.requested'
      && event.data?.payload?.taskId === republishTaskId
    ));
    if (displayedAssistantFeedback && republishTaskId && !taskCardAlreadyPresented
      && !roleState.completed && roleState.progress < currentRole().tasks.length) {
      const activeTask = currentRole().tasks[roleState.progress];
      const stepCount = activeTask?.steps?.length || activeTask?.guidanceSteps?.length || 1;
      if (activeTask?.id === republishTaskId && stepCount > 1) {
        const hasActiveTaskCard = roleState.messages.some((message) => (
          message?.type === 'task'
          && message.status === 'active'
          && message.payload?.taskId === republishTaskId
        ));
        if (hasActiveTaskCard) await waitFor(CONTENT_REVEAL_INTERVAL_MS);
        const republished = republishActiveTaskMessage(roleState.messages, republishTaskId);
        roleState.republishedTaskMessageId = republished?.id || null;
        if (republished) shouldRender = true;
      }
    }
  } catch (error) {
    const visibleError = studentFacingError(error, '检查暂未完成，请稍后重试。');
    roleState.lastAgentRequestError = {
      requestId,
      status: error.status ?? error.statusCode ?? null,
      code: error.code || null,
      message: visibleError,
      retryable: Boolean(error.retryable),
      leaseExpiresAt: error.leaseExpiresAt || null,
    };
    if (error?.details?.runState) synchronizeTeacherRunState(error.details.runState);
    const isCourseRunGate = applyCourseRunGateError(error, input);
    const isToolSubmission = input.type === 'tool_result';
    const isValidation = isCourseRunGate
      || error.kind === 'validation'
      || /^(?:STEP_|EVIDENCE_|TASK_)/.test(error.code || '');
    if ((isToolSubmission || isValidation) && !isCourseRunGate) {
      showToast(visibleError);
      const task = currentTask();
      taskEvidence(task.id).validationError = visibleError;
      shouldRender = true;
    }
    if (feedbackTarget) {
      const feedback = roleState.challengeFeedback?.[feedbackTarget.taskId];
      if (feedback) {
        feedback.status = 'failed';
        feedback.text = visibleError;
        refreshChallengeFeedback(feedbackTarget.taskId);
      }
    }
    const streamedMessage = roleState.messages.find((message) => message.id === roleState.streamingMessageId);
    if (streamedMessage) {
      roleState.messages = roleState.messages.filter((message) => message !== streamedMessage);
    }
    if (!isToolSubmission && !isValidation) {
      roleState.messages.push({
        id: crypto.randomUUID(),
        type: 'assistant',
        text: '刚刚连接中断了，这句话没有完整显示。请再发一次。',
        source: '',
      });
    }
    roleState.streamingMessageId = null;
  } finally {
    if (loadingId) roleState.messages = roleState.messages.filter((message) => message.id !== loadingId);
    roleState.activeLoadingId = null;
    finishAgentActivity();
    if (shouldRender) {
      renderLearningShell();
      window.setTimeout(scrollChatToBottom, 30);
    }
  }
}

function hasActiveDraft(roleState) {
  const chatDraft = document.querySelector('#chatInput')?.value?.trim();
  return hasCurrentTaskDraft({
    evidenceByTask: roleState.evidence,
    taskId: currentTask()?.id,
    chatDraft,
  });
}

function learningBusyState(roleState) {
  const toolValues = Object.values(roleState.evidence || {})
    .flatMap((evidence) => Object.values(evidence.toolValues || {}))
    .flatMap((step) => Object.values(step || {}));
  const mediaPlaying = [...document.querySelectorAll('[data-activity-media]')]
    .some((media) => media.paused === false && media.ended === false);
  return {
    mediaPlaying,
    cameraOrFilePicker: externalFilePickerOpen,
    recording: toolValues.some((value) => value?.recording === true),
    uploadOrProcessing: hasActiveEvidenceProcessing({
      uploadCount: state.evidenceUploadCount,
      toolValues,
    }),
    evaluation: state.agentBusy,
    navigation: state.navigationBusy,
  };
}

function taskForTrack(owner, track) {
  return owner.tasks[Math.min(Number(track.progress || 0), Math.max(0, owner.tasks.length - 1))];
}

function locationSampleFromPosition(owner, track, position) {
  const task = taskForTrack(owner, track);
  const lng = Number(position?.coords?.longitude);
  const lat = Number(position?.coords?.latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const sample = {
    permission: 'granted',
    lng,
    lat,
    accuracyMeters: Number.isFinite(Number(position.coords.accuracy))
      ? Math.max(0, Number(position.coords.accuracy))
      : undefined,
  };
  const coordinates = task?.location?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2
    && coordinates.every((value) => Number.isFinite(Number(value)))) {
    const [targetLng, targetLat] = coordinates.map(Number);
    const radians = (degrees) => degrees * (Math.PI / 180);
    const dLat = radians(lat - targetLat);
    const dLng = radians(lng - targetLng);
    const value = Math.sin(dLat / 2) ** 2
      + Math.cos(radians(targetLat)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
    const distance = 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    sample.insideFence = distance <= Number(task.location.radiusMeters || 50);
  }
  return sample;
}

async function sampleGrantedGeolocation(owner, track) {
  if (!navigator.geolocation) return { permission: 'unavailable' };
  // 后台心跳只在浏览器确认已授权时取样。`prompt` 状态绝不调用
  // getCurrentPosition，避免学生没有主动操作时突然弹出权限请求。
  if (!navigator.permissions?.query) {
    return { permission: track.locationStatus.permission || 'unknown' };
  }
  let permission;
  try {
    permission = await navigator.permissions.query({ name: 'geolocation' });
  } catch {
    return { permission: track.locationStatus.permission || 'unknown' };
  }
  if (permission.state !== 'granted') return { permission: permission.state || 'unknown' };
  try {
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8_000,
      maximumAge: 0,
    }));
    return locationSampleFromPosition(owner, track, position) || { permission: 'granted' };
  } catch (error) {
    return { permission: Number(error?.code) === 1 ? 'denied' : 'granted' };
  }
}

async function sampleCameraPermission() {
  if (!navigator.mediaDevices) return { permission: 'unavailable' };
  if (!navigator.permissions?.query) return { permission: 'unknown' };
  try {
    const permission = await navigator.permissions.query({ name: 'camera' });
    return { permission: permission.state || 'unknown' };
  } catch {
    return { permission: 'unknown' };
  }
}

function hasLocationCoordinates(location) {
  return Number.isFinite(location?.lng) && Number.isFinite(location?.lat);
}

async function reportCurrentPresence({
  owner = currentRole(),
  track = currentRoleState(),
  refreshLocation = false,
  locationSample,
} = {}) {
  if (!track?.agentSessionId) return undefined;
  const [location, camera] = await Promise.all([
    locationSample === undefined && refreshLocation
      ? sampleGrantedGeolocation(owner, track)
      : locationSample,
    sampleCameraPermission(),
  ]);
  // 任务、Step、进度和证据数由 presence 接口从服务端 Agent session
  // 现场投影；客户端只发设备心跳和这一轮的原始定位样本。
  return reportStudentPresence(track.agentSessionId, {
    online: navigator.onLine,
    network: navigator.onLine ? (navigator.connection?.effectiveType === '2g' ? 'weak' : 'ready') : 'offline',
    camera,
    ...(location ? { location } : {}),
  });
}

async function sendContextTick() {
  if ((!state.currentRoleId && !isPhaseTrackActive()) || state.screen !== 'learningShell') return;
  const owner = currentRole();
  const roleState = currentRoleState();
  if (!roleState.agentSessionId) return;
  const locationSample = await sampleGrantedGeolocation(owner, roleState);
  const remaining = state.phaseEndTime ? Math.max(0, Math.floor((state.phaseEndTime - Date.now()) / 1000)) : null;
  // presence 与 AI 提醒分开：即使模型回合正在处理，教师端也要
  // 持续收到学生在线、位置和进度快照。坐标只能来自这一轮的新采样。
  const presence = reportCurrentPresence({
    owner,
    track: roleState,
    locationSample,
  }).catch(() => undefined);
  if (state.agentBusy || document.hidden || teacherRunBlocksLearning()) {
    await presence;
    return;
  }
  const tick = runAgentTurn({
    type: 'lifecycle_event',
    event: 'context_tick',
    data: {
      clientNow: new Date().toISOString(),
      lastLocalActionAt: roleState.lastLocalActionAt,
      pageVisible: !document.hidden,
      activeTab: state.activeTab,
      learningView: state.learningView,
      hasDraft: hasActiveDraft(roleState),
      busy: learningBusyState(roleState),
      phaseRemainingSeconds: remaining,
      arrived: roleState.arrived,
      ...(hasLocationCoordinates(locationSample) ? { location: locationSample } : {}),
    },
  }, { passive: true });
  await Promise.all([presence, tick]);
}

async function arriveRoleLocation(toolCallId) {
  const role = currentRole();
  const roleState = currentRoleState();
  if (roleState.arrived) return;
  if (!toolCallId) {
    showToast('导航调用已经失效，请在对话中请智能体重新打开。');
    return;
  }
  const task = currentTask();
  const automatic = /geofence|gps|auto/.test(task.location?.verification || '');
  if (automatic && task.location?.coordinates?.length >= 2) {
    if (!navigator.geolocation) return showToast('当前设备无法定位，请呼叫老师人工确认。');
    state.navigationBusy = true;
    try {
      showToast('正在验证你是否进入任务范围…');
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000,
      }));
      const locationSample = locationSampleFromPosition(role, roleState, position);
      const insideFence = locationSample?.insideFence === true;
      await runAgentTurn({
        type: 'lifecycle_event', event: 'location_updated',
        data: { permission: 'granted', insideFence, accuracyMeters: position.coords.accuracy, lng: position.coords.longitude, lat: position.coords.latitude },
      }, { passive: true, showLoading: false });
      await reportCurrentPresence({ owner: role, track: roleState, locationSample }).catch(() => undefined);
      if (!currentRoleState().arrived) return showToast(insideFence ? '定位精度或停留时间还未达到要求，请稍后再试。' : '你还没有进入当前任务范围。');
    } catch {
      return showToast('没有取得定位权限，请允许定位或呼叫老师人工确认。');
    } finally {
      state.navigationBusy = false;
    }
  }
  roleState.arrived = true;
  roleState.lastLocalActionAt = Date.now();
  const verification = automatic ? 'geofence' : 'manual';
  roleState.locationStatus = { ...roleState.locationStatus, verifiedBy: verification, arrivedAt: new Date().toISOString() };
  const taskLocation = currentTask().location?.name || role.location;
  roleState.messages.push({ id: crypto.randomUUID(), type: 'user', text: `我已到达${taskLocation}` });
  renderLearningShell();
  await runAgentTurn({
    type: 'tool_result',
    toolCallId,
    result: { status: 'completed', values: { arrived: true, verification } },
  });
}

function activeStepContext(taskId, requestedStepId = '') {
  const task = currentRole().tasks.find((item) => item.id === taskId);
  if (!task) return {};
  const index = Math.min(Number(currentRoleState().guidanceStepIndices[taskId] || 0), task.steps?.length || 0);
  const step = task.steps?.[index];
  if (requestedStepId && step?.id !== requestedStepId) return { task, index, expired: true };
  return {
    task,
    index,
    step,
    tools: step?.tools?.length ? step.tools : (task.tools || []),
  };
}

function completedStepContext(taskId, requestedStepId = '') {
  const task = currentRole().tasks.find((item) => item.id === taskId);
  if (!task?.steps?.length || !requestedStepId) return {};
  const index = task.steps.findIndex((step) => step.id === requestedStepId);
  const completedThrough = Math.min(
    Number(currentRoleState().guidanceStepIndices[taskId] || 0),
    task.steps.length,
  );
  if (index < 0 || index >= completedThrough) return { task, index, expired: true };
  const step = task.steps[index];
  return {
    task,
    index,
    step,
    revision: true,
    tools: step.tools?.length ? step.tools : (task.tools || []),
  };
}

function editableStepContext(taskId, requestedStepId = '') {
  const active = activeStepContext(taskId, requestedStepId);
  return active.expired
    ? completedStepContext(taskId, requestedStepId)
    : active;
}

function markPhotoRevisionAccepted(context, taskId, stepId, acceptedRevision = null) {
  if (!context.tools?.some((tool) => tool.id === 'photo')) return;
  const photo = activityValue(taskId, stepId, 'photo');
  photo.acceptedRevision = Number(acceptedRevision ?? photo.revision ?? 0);
}

function completeStandaloneActivityStep({ context, taskId, stepId, feedbackTarget }) {
  const role = currentRole();
  const roleState = currentRoleState();
  const nextStepIndex = context.index + 1;
  const steps = context.task.steps?.length
    ? context.task.steps
    : [{ id: stepId }];
  const allStepsCompleted = nextStepIndex >= steps.length;
  const mode = context.task.finalizationMode || DEFAULT_TASK_FINALIZATION_MODE;
  roleState.guidanceStepIndices[taskId] = nextStepIndex;
  roleState.taskFinalizations ||= {};
  roleState.taskFinalizations[taskId] = {
    taskId,
    mode,
    status: allStepsCompleted
      ? (mode === 'auto_on_last_step'
        ? 'completed'
        : mode === 'teacher_confirm' ? 'awaiting_teacher_confirm' : 'awaiting_bundle_submit')
      : 'collecting_steps',
    completedStepIds: steps.slice(0, nextStepIndex).map((step, index) => (
      step.id || `${taskId}-step-${index + 1}`
    )),
    revision: null,
  };

  if (allStepsCompleted && mode === 'auto_on_last_step') {
    const completion = completeLocalTaskProgress({ role, roleState, taskId });
    if (!completion.ok) {
      showToast('当前任务已经变化，请按最新关卡继续。');
      return false;
    }
    roleState.taskFinalizations[taskId].status = 'completed';
    if (feedbackTarget) {
      roleState.challengeFeedback[taskId] = {
        status: 'passed',
        text: `“${context.task.name}”已完成。`,
        stepId,
        kind: 'step',
      };
    }
    roleState.messages.push({
      id: crypto.randomUUID(),
      type: 'assistant',
      text: `“${context.task.name}”已完成。`,
      source: '本地课程包',
    });
    if (!completion.advanced) {
      roleState.messages.push({
        id: crypto.randomUUID(),
        type: 'assistant',
        text: completion.waitingMode === 'teacher'
          ? '这项任务已完成，正在等待老师推进。'
          : '这项任务已完成，准备好后点击“继续下一个任务”。',
        source: '本地课程包',
      });
    } else if (completion.roleCompleted) {
      if (role.scope === 'phase') window.setTimeout(finishPhaseLearning, PHASE_TRANSITION_DELAY_MS);
      else if (!roleState.messages.some((message) => message.type === 'token')) {
        roleState.messages.push({ id: crypto.randomUUID(), type: 'token' });
      }
    } else {
      roleState.messages.push(...currentTaskRecoveryMessages(role, roleState));
    }
  } else {
    const text = allStepsCompleted && mode === 'teacher_confirm'
      ? '所有小步都已记录，正在等待老师终审。'
      : allStepsCompleted
        ? '所有小步都已记录，可以整理本任务证据后提交。'
        : `第 ${nextStepIndex} 个任务小步已记录，可以继续下一步。`;
    if (feedbackTarget) {
      roleState.challengeFeedback[taskId] = {
        status: 'passed', text, stepId, kind: 'step',
      };
    }
    roleState.messages.push({
      id: crypto.randomUUID(), type: 'assistant', text, source: '本地课程包',
    });
    if (steps.length > 1) {
      const republished = republishActiveTaskMessage(roleState.messages, taskId);
      roleState.republishedTaskMessageId = republished?.id || null;
    }
  }
  renderLearningShell();
  window.setTimeout(scrollChatToBottom, 20);
  return true;
}

async function completeActivityStep(taskId, stepId) {
  if (state.agentBusy) {
    showToast(`${PLATFORM_COMPANION.name}正在回应，请稍等一下。`);
    return false;
  }
  const context = editableStepContext(taskId, stepId);
  if (!context.task || context.expired || !context.step) {
    showToast('当前小步已经切换，请按新提示继续。');
    return false;
  }
  const evidence = taskEvidence(taskId);
  const error = context.step.completionMode === 'user_confirm' && !context.revision
    ? ''
    : validateActivityStep({ tools: context.tools, evidence, stepId });
  if (error) {
    evidence.validationError = error;
    renderChat();
    showToast(error);
    return false;
  }
  evidence.validationError = '';
  const feedbackTarget = beginChallengeFeedback({
    taskId,
    stepId,
    beforeStepIndex: context.index,
    taskIndex: currentRole().tasks.findIndex((task) => task.id === taskId),
    kind: context.revision ? 'revision' : 'step',
  });
  if (standaloneMode) {
    if (context.revision) {
      markPhotoRevisionAccepted(context, taskId, stepId);
      const roleState = currentRoleState();
      roleState.stepRevisionHistory ||= [];
      roleState.stepRevisionHistory.push({
        revisionId: crypto.randomUUID(),
        taskId,
        stepId,
        passed: true,
        revisedAt: new Date().toISOString(),
      });
      if (feedbackTarget) {
        roleState.challengeFeedback[taskId] = {
          status: 'passed',
          text: '这一步修改后的照片已重新检查并记录。',
          stepId,
          kind: 'revision',
        };
      }
      if ((context.task.steps?.length || context.task.guidanceSteps?.length || 1) > 1) {
        roleState.messages.push({
          id: crypto.randomUUID(),
          type: 'assistant',
          text: '这一步修改后的照片已重新检查并记录。',
          source: '本地课程包',
        });
        const republished = republishActiveTaskMessage(roleState.messages, taskId);
        roleState.republishedTaskMessageId = republished?.id || null;
      }
      renderLearningShell();
      return true;
    }
    const completed = completeStandaloneActivityStep({ context, taskId, stepId, feedbackTarget });
    if (completed) markPhotoRevisionAccepted(context, taskId, stepId);
    return completed;
  }
  const stepImages = context.step.completionMode === 'ai_evaluation'
    ? context.tools.flatMap((tool) => {
      const value = activityValue(taskId, stepId, tool.id);
      if (tool.id === 'photo') return value.dataUrls || [];
      if (['sketch', 'scanner'].includes(tool.id)) return value.dataUrl ? [value.dataUrl] : [];
      return [];
    }).filter(Boolean)
    : [];
  const photoValue = context.tools.some((tool) => tool.id === 'photo')
    ? activityValue(taskId, stepId, 'photo')
    : null;
  const submittedPhotoRevision = Number(photoValue?.revision || 0);
  const revisionId = context.revision ? crypto.randomUUID() : '';
  if (photoValue) photoValue.revisionSubmitting = true;
  try {
    await runAgentTurn({
      type: 'lifecycle_event',
      event: context.revision ? 'task_step_revised' : 'task_step_completed',
      data: {
        taskId,
        stepId,
        stepIndex: context.index,
        revisionId,
        stepText: context.step.studentAction || context.step.objective,
        completionMode: context.step.completionMode,
        localEvidenceCount: evidence.imageUrls.length,
        toolValues: serializableToolValues(evidence),
        stepImages,
      },
    }, { feedbackTarget });
  } finally {
    if (photoValue) photoValue.revisionSubmitting = false;
  }
  if (photoValue) renderLearningShell();
  if (context.revision) {
    const revision = currentRoleState().lastStepRevision;
    const passed = revision?.revisionId === revisionId && revision.passed === true;
    const feedback = currentRoleState().challengeFeedback?.[taskId];
    if (feedbackTarget && feedback) {
      feedback.status = passed ? 'passed' : 'revision';
      feedback.text = revision?.revisionId === revisionId
        ? (revision.feedback || (passed
          ? '这一步修改后的照片已重新检查并记录。'
          : '修改后的照片还需要补充，请继续调整。'))
        : (feedback.text || '这次重新检查没有完整返回，请再试一次。');
    }
    if (passed) {
      markPhotoRevisionAccepted(context, taskId, stepId, submittedPhotoRevision);
      taskEvidence(taskId).validationError = '';
    }
    renderLearningShell();
    return passed;
  }
  const nextContext = activeStepContext(taskId, stepId);
  const completed = Boolean(nextContext.expired || !nextContext.step);
  if (completed) {
    markPhotoRevisionAccepted(context, taskId, stepId, submittedPhotoRevision);
    renderLearningShell();
  }
  return completed;
}

async function completeMediaActivity(taskId, stepId) {
  const context = activeStepContext(taskId, stepId);
  const mediaTool = context.tools?.find((tool) => tool.id === 'media');
  if (mediaTool?.config?.requireCompletion !== false
    && !mediaTool?.config?.url
    && !isPosterOnlyMedia(mediaTool?.config)) {
    showToast('课程素材尚未配置，请联系老师。');
    return;
  }
  const value = activityValue(taskId, stepId, 'media');
  value.completed = true;
  if (context.expired || !context.step || context.step.completionMode !== 'tool_result') {
    renderChat();
    return;
  }
  if (value.submitting || value.submitted) return;
  value.submitting = true;
  renderChat();
  try {
    value.submitted = await completeActivityStep(taskId, stepId);
  } finally {
    value.submitting = false;
    renderLearningShell();
  }
}

async function toggleActivityRecording(taskId, stepId) {
  const value = activityValue(taskId, stepId, 'audio');
  if (value.recording && value.recorder) {
    window.clearTimeout(value.autoStopTimer);
    value.recognition?.stop?.();
    value.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    showToast('当前浏览器不支持录音，请使用小程序真机或更新浏览器。');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = Recognition ? new Recognition() : null;
    const chunks = [];
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      value.blob = blob;
      value.url = URL.createObjectURL(blob);
      value.durationSeconds = Math.max(1, Math.round((Date.now() - value.startedAt) / 1000));
      value.recording = false;
      window.clearTimeout(value.autoStopTimer);
      value.stream?.getTracks().forEach((track) => track.stop());
      delete value.recorder;
      delete value.stream;
      delete value.recognition;
      renderChat();
      window.setTimeout(scrollChatToBottom, 20);
    });
    value.recorder = recorder;
    value.stream = stream;
    if (recognition) {
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        value.transcript = [...event.results].map((result) => result[0].transcript).join('');
      };
      recognition.onerror = () => undefined;
      recognition.start();
      value.recognition = recognition;
    }
    value.startedAt = Date.now();
    value.recording = true;
    recorder.start();
    const { tools } = activeStepContext(taskId, stepId);
    const maximum = Number(tools?.find((tool) => tool.id === 'audio')?.config?.maxSeconds || 90);
    value.autoStopTimer = window.setTimeout(() => {
      if (value.recording && recorder.state === 'recording') {
        value.recognition?.stop?.();
        recorder.stop();
        showToast(`已达到 ${maximum} 秒上限，录音自动结束。`);
      }
    }, maximum * 1000);
    renderChat();
  } catch {
    showToast('没有取得麦克风权限，请在系统设置中允许后重试。');
  }
}

function clearSketch(taskId, stepId) {
  const canvas = [...document.querySelectorAll('[data-sketch-canvas]')]
    .find((item) => item.dataset.taskId === taskId && item.dataset.stepId === stepId);
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fffdf8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawCanvasImage(canvas, canvas.dataset.background);
  const value = activityValue(taskId, stepId, 'sketch');
  value.dataUrl = '';
  value.completed = false;
}

function moveOrderItem(taskId, stepId, index, direction) {
  const { tools } = activeStepContext(taskId, stepId);
  const quiz = tools?.find((tool) => tool.id === 'quiz');
  const value = activityValue(taskId, stepId, 'quiz');
  const order = value.order?.length ? [...value.order] : [...(quiz?.config?.options || [])];
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  value.order = order;
  renderChat();
}

function runSimulation(taskId, stepId) {
  const { tools } = activeStepContext(taskId, stepId);
  const tool = tools?.find((item) => item.id === 'simulation');
  const value = activityValue(taskId, stepId, 'simulation');
  const choice = tool?.config?.choices?.find((item) => item.id === value.pendingChoice);
  if (!choice) return showToast('请先选择本轮方案。');
  value.history ||= [];
  if (value.history.length >= Number(tool.config?.rounds || 1)) return;
  if (tool.config?.allowRepeat === false && value.history.some((entry) => entry.id === choice.id)) {
    value.pendingChoice = '';
    renderChat();
    return showToast('这一分支已经运行过，请换一种反应继续比较。');
  }
  value.metrics ||= Object.fromEntries((tool.config?.metrics || []).map((metric) => {
    const initialValue = Number(metric.initial);
    return [metric.id, Number.isFinite(initialValue) ? initialValue : 0];
  }));
  for (const [metricId, delta] of Object.entries(choice.effects || {})) {
    if (!(metricId in value.metrics)) value.metrics[metricId] = 0;
    value.metrics[metricId] = Number(value.metrics[metricId] || 0) + Number(delta || 0);
  }
  value.history.push({ id: choice.id, label: choice.label, feedback: choice.feedback || choice.publicFeedback || '本轮结果已记录，继续比较下一种可能。' });
  value.pendingChoice = '';
  renderChat();
}

function addTeamEntry(taskId, stepId) {
  const value = activityValue(taskId, stepId, 'team');
  const text = String(value.draft || '').trim();
  if (!text) return showToast('先写下一条观点、分工或证据。');
  const { tools } = activeStepContext(taskId, stepId);
  const config = tools?.find((tool) => tool.id === 'team')?.config || {};
  if (config.roles?.length && !value.selectedRole) return showToast('请先选择这条记录由哪个角色贡献。');
  if (config.recordTypes?.length && !value.recordType) return showToast('请先选择这条记录的类型。');
  value.entries ||= [];
  value.entries.push({ text, role: value.selectedRole || '', type: value.recordType || '' });
  value.draft = '';
  value.recordType = '';
  renderChat();
}

function confirmScan(taskId, stepId, result = '') {
  const value = activityValue(taskId, stepId, 'scanner');
  const resolved = String(result || value.manual || '').trim();
  if (!resolved) return showToast('请扫描或输入课程码。');
  value.result = resolved;
  renderChat();
}

function removeActivityPhoto(taskId, stepId, index) {
  const evidence = taskEvidence(taskId);
  const value = activityValue(taskId, stepId, 'photo');
  if (value.processing || value.revisionSubmitting) return showToast('照片正在准备或检查，请稍等一下再修改。');
  const removed = removePhotoAt(evidence, value, index, {
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  });
  if (!removed) return showToast('这张照片已经不在当前小步里了。');
  evidence.validationError = '';
  renderChat();
  window.setTimeout(scrollChatToBottom, 20);
}

async function optimizedImageDataUrl(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const maximum = 1280;
    const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.76);
  } catch {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

async function scanImageFile(taskId, stepId, file) {
  if (!file) return;
  const { tools } = activeStepContext(taskId, stepId);
  const scanner = tools?.find((tool) => tool.id === 'scanner');
  const rememberCapture = async () => {
    const evidence = taskEvidence(taskId);
    const value = activityValue(taskId, stepId, 'scanner');
    const previewUrl = URL.createObjectURL(file);
    evidence.files.push(file);
    evidence.imageUrls.push(previewUrl);
    value.previewUrl = previewUrl;
    value.dataUrl = await optimizedImageDataUrl(file);
    value.captured = true;
  };
  if (scanner?.config?.mode === 'object') {
    await rememberCapture();
    confirmScan(taskId, stepId, '已采集待AI核验的实物图像');
    return;
  }
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      const codes = await detector.detect(await createImageBitmap(file));
      if (codes[0]?.rawValue) {
        await rememberCapture();
        return confirmScan(taskId, stepId, codes[0].rawValue);
      }
    } catch {
      // Falls through to the manual-entry guidance below.
    }
  }
  showToast('没有读出码值，请对准后重试，或在下方手动输入。');
}

let draggedBuilderItem = null;

function placeBuilderItem(taskId, stepId, zoneId, itemId) {
  if (!itemId) return;
  const value = activityValue(taskId, stepId, 'builder');
  value.placements ||= {};
  Object.keys(value.placements).forEach((key) => {
    value.placements[key] = value.placements[key].filter((candidate) => candidate !== itemId);
  });
  value.placements[zoneId] ||= [];
  value.placements[zoneId].push(itemId);
  renderChat();
}

function returnBuilderItem(taskId, stepId, zoneId, itemId) {
  const value = activityValue(taskId, stepId, 'builder');
  value.placements ||= {};
  value.placements[zoneId] = (value.placements[zoneId] || []).filter((candidate) => candidate !== itemId);
  renderChat();
}

async function completeTaskStep(taskId) {
  if (state.agentBusy) {
    showToast(`${PLATFORM_COMPANION.name}正在回应，请稍等一下。`);
    return;
  }
  const roleState = currentRoleState();
  const task = currentRole().tasks.find((item) => item.id === taskId);
  if (!task) return;
  const stepDefinitions = task.steps?.length
    ? task.steps
    : (task.guidanceSteps?.length ? task.guidanceSteps : [task.requirement]).map((studentAction, index) => ({
      id: `${task.id}-step-${index + 1}`,
      studentAction,
      completionMode: 'user_confirm',
    }));
  const steps = stepDefinitions.map((step) => step.studentAction || step.objective);
  const stepIndex = Math.min(Number(roleState.guidanceStepIndices[task.id] || 0), steps.length);
  if (stepIndex >= steps.length) return;
  if (stepDefinitions[stepIndex]?.completionMode !== 'user_confirm') {
    showToast('当前小步会在指定操作完成后自动验证。');
    return;
  }
  roleState.lastLocalActionAt = Date.now();
  roleState.messages.push({
    id: crypto.randomUUID(),
    type: 'user',
    text: `第${stepIndex + 1}小步完成：${steps[stepIndex]}`,
  });
  renderLearningShell();
  window.setTimeout(scrollChatToBottom, 20);
  const feedbackTarget = beginChallengeFeedback({
    taskId,
    stepId: stepDefinitions[stepIndex]?.id || '',
    beforeStepIndex: stepIndex,
    taskIndex: currentRole().tasks.findIndex((item) => item.id === taskId),
    kind: 'step',
  });
  if (standaloneMode) {
    roleState.guidanceStepIndices[taskId] = stepIndex + 1;
    if (feedbackTarget) {
      roleState.challengeFeedback[taskId] = {
        status: 'passed',
        text: `第 ${stepIndex + 1} 个任务小步已记录，可以继续下一步。`,
        stepId: stepDefinitions[stepIndex]?.id || '',
        kind: 'step',
      };
    }
    roleState.messages.push({
      id: crypto.randomUUID(),
      type: 'assistant',
      text: `第 ${stepIndex + 1} 个任务小步已记录，可以继续下一步。`,
      source: '本地课程包',
    });
    renderLearningShell();
    return;
  }
  await runAgentTurn({
    type: 'lifecycle_event',
    event: 'task_step_completed',
    data: { taskId, stepIndex, stepText: steps[stepIndex] },
  }, { feedbackTarget });
}

async function dataUrlFile(dataUrl, filename) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

async function appendGeneratedEvidence(evidence, taskId) {
  evidence.generatedSketchIds ||= [];
  const sketches = Object.entries(evidence.toolValues || {})
    .map(([stepId, tools]) => ({ stepId, dataUrl: tools.sketch?.dataUrl }))
    .filter((item) => item.dataUrl && !evidence.generatedSketchIds.includes(item.stepId));
  for (const sketch of sketches) {
    evidence.files.push(await dataUrlFile(sketch.dataUrl, `${taskId}-${sketch.stepId}-sketch.jpg`));
    evidence.generatedSketchIds.push(sketch.stepId);
  }
  evidence.generatedAudioIds ||= [];
  const recordings = Object.entries(evidence.toolValues || {})
    .map(([stepId, tools]) => ({ stepId, blob: tools.audio?.blob }))
    .filter((item) => item.blob && !evidence.generatedAudioIds.includes(item.stepId));
  for (const recording of recordings) {
    const extension = recording.blob.type.includes('ogg') ? 'ogg' : recording.blob.type.includes('mp4') ? 'm4a' : 'webm';
    evidence.files.push(new File([recording.blob], `${taskId}-${recording.stepId}-audio.${extension}`, {
      type: recording.blob.type || 'audio/webm',
    }));
    evidence.generatedAudioIds.push(recording.stepId);
  }
}

async function submitTask(taskId, toolCallId, minimumEvidence = 1) {
  if (state.agentBusy || state.qaForceBusy || state.evidenceUploadCount > 0) {
    showToast('上一项操作还在处理中，请稍等。');
    return;
  }
  const role = currentRole();
  const roleState = currentRoleState();
  const taskIndex = role.tasks.findIndex((task) => task.id === taskId);
  const task = role.tasks[taskIndex];
  const evidence = taskEvidence(taskId);

  if ((task.finalizationMode || DEFAULT_TASK_FINALIZATION_MODE) !== 'explicit_bundle_submit') {
    showToast(task.finalizationMode === 'teacher_confirm'
      ? '这项任务的小步完成后由老师终审，不需要再次提交。'
      : '这项任务会在最后一步通过后自动完成，不需要再次提交。');
    return;
  }

  const stepValidation = validateCompletedTaskSteps({ task, evidence });
  if (stepValidation) {
    evidence.validationError = stepValidation.message;
    renderChat();
    window.setTimeout(scrollChatToBottom, 20);
    showToast(stepValidation.message);
    return;
  }

  if (task.toolType === 'capture' && evidence.imageUrls.length < minimumEvidence) {
    const remaining = minimumEvidence - evidence.imageUrls.length;
    evidence.validationError = `当前已选 ${evidence.imageUrls.length} 张，还需要 ${remaining} 张（本任务至少 ${minimumEvidence} 张）。`;
    roleState.evidence[taskId] = evidence;
    renderChat();
    window.setTimeout(scrollChatToBottom, 20);
    showToast(`还需要 ${remaining} 张照片。`);
    return;
  }

  const toolValues = serializableToolValues(evidence);
  if (!evidence.text?.trim() && !evidence.imageUrls.length && !Object.keys(toolValues).length) {
    showToast('请先完成任务工具或补充一条现场记录。');
    return;
  }

  if (!toolCallId) return showToast('任务工具调用已经失效，请让智能体重新打开任务。');
  const feedbackTarget = beginChallengeFeedback({
    taskId,
    beforeStepIndex: Number(roleState.guidanceStepIndices[taskId] || 0),
    taskIndex,
    kind: 'task',
  });
  roleState.messages.push({
    id: crypto.randomUUID(),
    type: 'user',
    text: evidence.text?.trim() || (evidence.imageUrls.length ? `我提交了 ${evidence.imageUrls.length} 张现场照片。` : '我已经完成并提交了这一阶段的工具结果。'),
  });
  if (standaloneMode) {
    const completion = completeLocalTaskProgress({ role, roleState, taskId });
    if (!completion.ok) {
      showToast('当前任务已经变化，请按最新关卡继续。');
      renderLearningShell();
      return;
    }
    if (feedbackTarget) {
      roleState.challengeFeedback[taskId] = {
        status: 'passed',
        text: `“${task.name}”已记录在本次体验进度中。`,
        kind: 'task',
      };
    }
    roleState.messages.push({
      id: crypto.randomUUID(),
      type: 'assistant',
      text: `“${task.name}”已记录在本次体验进度中。`,
      source: '本地课程包',
    });
    if (!completion.advanced) {
      roleState.messages.push({
        id: crypto.randomUUID(),
        type: 'assistant',
        text: completion.waitingMode === 'teacher'
          ? '任务证据已记录，正在等待老师推进。'
          : '任务证据已记录，准备好后点击“继续下一个任务”。',
        source: '本地课程包',
      });
    } else if (completion.roleCompleted) {
      if (role.scope === 'phase') window.setTimeout(finishPhaseLearning, PHASE_TRANSITION_DELAY_MS);
      else roleState.messages.push({ id: crypto.randomUUID(), type: 'token' });
    } else {
      roleState.messages.push(...currentTaskRecoveryMessages(role, roleState));
    }
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 30);
    return;
  }
  state.evidenceUploadCount += 1;
  renderLearningShell();
  try {
    await appendGeneratedEvidence(evidence, taskId);
    if (!roleState.agentSessionId) throw new Error('当前学习会话尚未建立，请稍后重试。');
    const uploaded = evidence.files.length
      ? await Promise.all(evidence.files.map((file) => uploadEvidence(file, roleState.agentSessionId)))
      : [];
    await runAgentTurn({
      type: 'tool_result',
      toolCallId,
      result: { status: 'completed', values: { text: evidence.text || '', toolValues, photoEvidenceCount: evidence.imageUrls.length }, evidence: uploaded },
    }, { feedbackTarget });
  } catch (error) {
    const visibleError = studentFacingError(error, '提交暂未完成，请稍后重试。');
    if (feedbackTarget) {
      roleState.challengeFeedback[taskId] = {
        status: 'failed',
        text: visibleError,
        kind: 'task',
      };
      renderChat();
    }
    showToast(visibleError);
  } finally {
    state.evidenceUploadCount = Math.max(0, state.evidenceUploadCount - 1);
    renderLearningShell();
  }
}

async function sendMessage() {
  const input = document.querySelector('#chatInput');
  const text = input.value.trim();
  if (!text || (!state.currentRoleId && !isPhaseTrackActive())) return;
  if (blockLearningAction('send-message')) return;
  input.value = '';

  const roleState = currentRoleState();
  roleState.lastLocalActionAt = Date.now();
  roleState.messages = roleState.messages.filter((message) => message.type !== 'quick-replies');
  roleState.messages.push({ id: crypto.randomUUID(), type: 'user', text });
  if (standaloneMode) {
    roleState.messages.push({
      id: crypto.randomUUID(),
      type: 'assistant',
      text: `你的想法已经记录。请结合“${currentTask()?.name || '当前任务'}”的任务要求继续观察和验证。`,
      source: '本地课程包',
    });
    renderChat();
    window.setTimeout(scrollChatToBottom, 30);
    return;
  }
  renderChat();
  window.setTimeout(scrollChatToBottom, 30);
  await runAgentTurn({ type: 'user_text', text });
}

async function sendQuickReply({ questionId, act, value, label }) {
  if (blockLearningAction('send-quick-reply')) return;
  const text = String(value || label || '').trim();
  if (!text || (!state.currentRoleId && !isPhaseTrackActive()) || state.agentBusy) return;
  const roleState = currentRoleState();
  roleState.lastLocalActionAt = Date.now();
  roleState.messages = roleState.messages.filter((message) => message.type !== 'quick-replies');
  roleState.messages.push({ id: crypto.randomUUID(), type: 'user', text: label || text });
  renderChat();
  window.setTimeout(scrollChatToBottom, 20);
  await runAgentTurn({ type: 'quick_reply', questionId, act, value: text });
}

function renderTeam() {
  if (!state.currentRoleId) return;
  const role = currentRole();
  const roleState = currentRoleState();
  const completed = roleState.completed || roleState.progress >= role.tasks.length;
  const itemName = lesson.roleSystem.collectionItemName;
  document.querySelector('#teamMap').src = lesson.assets.navigationMap;
  document.querySelector('#tokenProgress').textContent = completed ? '已获得' : '完成后获得';
  document.querySelector('#teamTokens').innerHTML = `
    <div class="team-token ${completed ? '' : 'is-locked'}" title="${escapeHtml(role.name)}${escapeHtml(itemName)}">
      <img src="${role.collectionItemImage}" alt="${escapeHtml(role.collectionItem)}${escapeHtml(itemName)}${completed ? '已获得' : '未获得'}" />
    </div>
  `;
  const taskIndex = Math.min(roleState.progress, role.tasks.length - 1);
  document.querySelector('#memberList').innerHTML = `
    <div class="member-row">
      <img src="${role.badgeImage}" alt="${escapeHtml(role.name)}徽章" />
      <div class="member-copy">
        <strong>${escapeHtml(role.name)} · 我的进度</strong>
        <span>${completed ? `本角色任务已完成，请等待老师组织小组汇合` : `正在进行：${escapeHtml(role.tasks[taskIndex].name)}`}</span>
      </div>
      <span class="member-progress ${completed ? '' : 'is-waiting'}">${completed ? `已获${escapeHtml(itemName)}` : `${roleState.progress} / ${role.tasks.length}`}</span>
    </div>
  `;
}

function renderProgressSheet() {
  if (!state.currentRoleId && !isPhaseTrackActive()) return;
  const role = currentRole();
  const roleState = currentRoleState();
  document.querySelector('#progressSheetTitle').textContent = `${role.name}任务进度`;
  document.querySelector('#progressContent').innerHTML = `
    <div class="progress-list">
      ${role.tasks.map((task, index) => {
        const done = roleState.progress > index;
        const current = roleState.progress === index && !roleState.completed;
        return `
          <div class="progress-item ${done ? 'is-done' : ''}">
            <span class="progress-item__index">${done ? '<i data-lucide="check"></i>' : index + 1}</span>
            <div class="progress-item__copy">
              <strong>${escapeHtml(task.name)}</strong>
              <span>${escapeHtml(done || current ? task.passCondition : '完成前一任务后解锁')}</span>
            </div>
            <span>${done ? '已完成' : current ? '进行中' : '待解锁'}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function updateBalances() {
  document.querySelector('#timeBalance').textContent = `${state.timeBalance} ${lesson.timeBank.currencyUnit}`;
  document.querySelector('#bankBalance').textContent = state.timeBalance;
  document.querySelector('#bankCurrencyUnit').textContent = lesson.timeBank.currencyUnit;
}

function bankTaskControl(task) {
  if (task.options.length) {
    return task.options.map((option) => `<button class="bank-option" type="button" data-action="answer-bank-task" data-task-id="${task.id}" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('');
  }

  if (task.answerType === 'open_ended') {
    return `
      <textarea class="field-control bank-open-answer" rows="2" data-bank-answer placeholder="写下你的回答…"></textarea>
      <button class="bank-option" type="button" data-action="answer-bank-task" data-task-id="${task.id}">提交回答</button>
    `;
  }

  if (task.type === 'photo_checkpoint') {
    const draft = state.bankDrafts[task.id] || {};
    return `
      <label class="activity-upload bank-photo-upload"><i data-lucide="camera"></i><span>${draft.file ? '已选择照片，可重新拍摄' : '拍摄打卡照片'}</span><input type="file" accept="image/*" capture="environment" data-bank-file="${task.id}" /></label>
      ${draft.preview ? `<img class="bank-photo-preview" src="${draft.preview}" alt="时间银行打卡照片预览" />` : ''}
      ${task.requiresText ? `<textarea class="field-control bank-open-answer" rows="2" data-bank-answer data-bank-task-id="${task.id}" placeholder="补充展项标题、日期或说明…">${escapeHtml(draft.text || '')}</textarea>` : ''}
      <button class="bank-option" type="button" data-action="answer-bank-task" data-task-id="${task.id}" ${draft.file ? '' : 'disabled'}>提交照片验证</button>
    `;
  }

  const actionLabel = task.type === 'location_checkin'
    ? '到达后签到'
      : '完成任务';
  return `<button class="bank-option" type="button" data-action="answer-bank-task" data-task-id="${task.id}" data-answer="${escapeHtml(task.answer || '完成')}">${actionLabel}</button>`;
}

function bankTaskIsUnlocked(task) {
  const requiredPhase = Number.parseInt(task.unlockAfter.match(/phase(\d+)/i)?.[1], 10);
  return !requiredPhase || currentPhase()?.number >= requiredPhase;
}

function giftAmounts() {
  const { minAmount, maxPerAction } = lesson.timeBank.giftRules;
  const amounts = [];
  for (let amount = minAmount; amount <= maxPerAction; amount += minAmount) amounts.push(amount);
  return amounts.length ? amounts : [1];
}

function renderTimeBank() {
  const enabled = lesson.timeBank.enabled && currentRole()?.scope !== 'phase';
  document.querySelectorAll('.time-bank-entry').forEach((entry) => {
    entry.classList.toggle('is-hidden', !enabled);
  });
  if (!enabled) return;

  document.querySelectorAll('[data-bank-tab]').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.bankTab === state.bankTab);
  });
  const content = document.querySelector('#timeBankContent');
  if (state.bankTab === 'earn') {
    const visibleTasks = lesson.timeBank.tasks
      .filter((task) => !state.completedBankTasks.has(task.id))
      .filter(bankTaskIsUnlocked)
      .slice(0, lesson.timeBank.earnRules.tasksVisibleAtOnce);
    content.innerHTML = `
      <div class="bank-task-list">
        ${visibleTasks.length ? visibleTasks.map((task) => `
            <article class="bank-task">
              <div class="bank-task__top">
                <strong>${escapeHtml(task.question)}</strong>
                <span class="bank-task__reward">+${task.reward} ${escapeHtml(lesson.timeBank.currencyUnit)}</span>
              </div>
              ${task.hint ? `<p class="source-label"><i data-lucide="lightbulb"></i>${escapeHtml(task.hint)}</p>` : ''}
              <div class="bank-options">
                ${bankTaskControl(task)}
              </div>
            </article>
          `).join('') : '<p class="sheet-empty">当前可用的时间银行任务已完成。</p>'}
      </div>
    `;
  } else {
    const giftTargets = lesson.timeBank.giftRules.allowGiftToSelf
      ? lesson.roles
      : lesson.roles.filter((role) => role.id !== state.currentRoleId);
    content.innerHTML = `
      <div class="gift-list">
        ${giftTargets.map((role) => `
          <div class="gift-member">
            <img src="${role.badgeImage}" alt="${escapeHtml(role.name)}徽章" />
            <div><strong>${escapeHtml(sessionMember(role.id)?.name || '学习者')}</strong><span>${escapeHtml(role.name)} · 组内成员</span></div>
            <div class="gift-actions">
              ${giftAmounts().map((amount) => `<button type="button" data-action="gift-time" data-role-id="${role.id}" data-amount="${amount}" ${state.timeBalance < amount ? 'disabled' : ''}>${amount}</button>`).join('')}
              <span>${escapeHtml(lesson.timeBank.currencyUnit)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  updateBalances();
  refreshIcons();
}

function renderRoleSwitch() {
  if (!state.currentRoleId) return;
  document.querySelector('#compactRoleList').innerHTML = lesson.roles.map((role) => {
    const choice = roleChoice(role.id);
    const current = role.id === state.currentRoleId;
    const disabled = current || !choice.selectable || state.agentBusy || state.qaForceBusy || state.roleSelectionBusy;
    return `
    <div class="compact-role ${current ? 'is-current' : ''} ${choice.state === 'taken' ? 'is-taken' : ''}">
      <img src="${role.badgeImage}" alt="${escapeHtml(role.name)}徽章" />
      <div><strong>${escapeHtml(role.name)}</strong><span>${escapeHtml(role.tasks[0].name)} · ${role.tasks.length}项任务</span></div>
      <button type="button" data-action="switch-role" data-role-id="${role.id}" ${disabled ? 'disabled' : ''}>${escapeHtml(current ? '当前角色' : standaloneMode ? '切换' : choice.label)}</button>
    </div>
  `;
  }).join('');
}

async function answerBankTask(taskId, answer) {
  const task = lesson.timeBank.tasks.find((item) => item.id === taskId);
  if (!task || state.completedBankTasks.has(taskId)) return;
  const sessionId = currentRoleState()?.agentSessionId;
  if (!sessionId) return showToast('请先选择角色，再使用时间银行。');
  try {
    const draft = state.bankDrafts[taskId] || {};
    let evidence = [];
    let location;
    if (task.type === 'photo_checkpoint') {
      if (!draft.file) return showToast('请先拍摄一张打卡照片。');
      state.evidenceUploadCount += 1;
      try {
        evidence = [await uploadEvidence(draft.file, sessionId)];
      } finally {
        state.evidenceUploadCount = Math.max(0, state.evidenceUploadCount - 1);
      }
      answer = draft.text || answer;
    }
    if (task.type === 'location_checkin') {
      if (!navigator.geolocation) return showToast('当前设备不支持定位，请请老师人工确认。');
      showToast('正在验证当前位置…');
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000,
      }));
      location = { lng: position.coords.longitude, lat: position.coords.latitude, accuracyMeters: position.coords.accuracy };
    }
    const result = await answerTimeBankRequest({ sessionId, taskId, answer, evidence, location });
    if (!result.correct) return showToast(result.hint);
    state.completedBankTasks.add(taskId);
    state.timeBalance = result.balance;
    state.timeEarned += result.reward;
    delete state.bankDrafts[taskId];
    renderTimeBank();
    showToast(`完成小任务，时间银行到账 ${result.reward} ${lesson.timeBank.currencyUnit}。`);
  } catch (error) {
    showToast(studentFacingError(error, '时间银行任务暂未提交，请稍后重试。'));
  }
}

async function giftTime(roleId, requestedAmount) {
  const amount = Number(requestedAmount);
  const member = sessionMember(roleId);
  try {
    const result = await giftTimeRequest({ sessionId: currentRoleState().agentSessionId, roleId, amount });
    state.timeBalance = result.balance;
    renderTimeBank();
    showToast(`已向${member?.name || '组员'}赠送 ${amount} ${lesson.timeBank.currencyUnit}。`);
  } catch (error) {
    showToast(studentFacingError(error, '时间赠送暂未完成，请稍后重试。'));
  }
}

async function callTeacher(addMessage = true) {
  if (standaloneMode) return showToast('当前为本地体验模式，暂未连接教师端。');
  const sessionId = currentRoleState()?.agentSessionId;
  if (!sessionId) return showToast('请先选择角色，再呼叫老师。');
  try {
    await requestTeacherHelp({
      sessionId,
      kind: 'task',
      reason: `学生在「${currentTask()?.name || '当前任务'}」中请求教师帮助。`,
    });
    showToast('老师端已接收，并附带你的位置和当前任务。');
  } catch (error) {
    showToast(studentFacingError(error, '求助暂未发送，请稍后重试。'));
    return;
  }
  if (!addMessage || (!state.currentRoleId && !isPhaseTrackActive())) return;
  currentRoleState().messages.push({
    id: crypto.randomUUID(),
    type: 'phase',
    text: '求助已发送 · 老师将看到你的位置、角色和当前任务上下文',
  });
  renderChat();
  window.setTimeout(scrollChatToBottom, 30);
}

function teacherNotice(text) {
  if (!state.currentRoleId && !isPhaseTrackActive()) return;
  const notice = studentFacingText(text, {
    channel: 'teacher-notice', fallback: '请关注老师的最新提示。',
  });
  currentRoleState().messages.push({
    id: crypto.randomUUID(),
    type: 'phase',
    text: `教师提示 · ${notice}`,
  });
  renderChat();
  window.setTimeout(scrollChatToBottom, 30);
}

function showTeacherDirective(command) {
  const overlay = document.querySelector('#teacherDirectiveOverlay');
  const title = overlay.querySelector('#teacherDirectiveTitle');
  const text = overlay.querySelector('#teacherDirectiveText');
  const confirm = overlay.querySelector('#teacherDirectiveConfirm');
  const isRally = command.action === 'emergency_rally';
  const isEnded = command.action === 'end_run';
  const isPersistent = isRally || isEnded || command.action === 'pause';
  title.textContent = isRally ? '紧急集合' : isEnded ? '本次课程已结束' : command.action === 'pause' ? '课程已暂停' : '教师指令';
  const fallback = command.action === 'pause'
    ? '请停留在安全位置，等待老师恢复课程。'
    : isEnded ? '请停止当前任务，按老师安排完成集合或离场。' : '请按照老师的最新指令行动。';
  text.textContent = studentFacingText(command.payload?.message || command.payload?.text, {
    channel: 'teacher-overlay', fallback,
  });
  confirm.textContent = isRally ? '已收到，开始前往集合点' : isEnded ? '我已知道' : '我已知道';
  confirm.disabled = Boolean(isPersistent && (command.confirmed || !command.id));
  if (confirm.disabled) {
    confirm.textContent = isEnded ? '本次课程已结束' : isRally ? '已确认，正在集合' : '已确认，等待老师恢复';
  }
  overlay.hidden = false;
  state.activeTeacherCommand = command;
  document.activeElement?.blur();
}

function teacherCommandError(message, code = 'TEACHER_COMMAND_NOT_APPLIED') {
  return Object.assign(new Error(message), { code });
}

async function runRequiredTeacherAgentTurn(input) {
  const roleState = currentRoleState();
  if (!roleState?.agentSessionId) {
    throw teacherCommandError('学生智能体会话尚未建立。', 'TEACHER_COMMAND_SESSION_MISSING');
  }
  if (state.agentBusy || teacherRunBlocksLearning()) {
    throw teacherCommandError(
      '学生端当前正忙或已被课程场次锁定，请稍后重新发送这条指令。',
      'TEACHER_COMMAND_RETRY_LATER',
    );
  }
  const requestId = crypto.randomUUID();
  await runAgentTurn(input, { requestId, showLoading: false });
  if (roleState.lastAgentRequestError?.requestId === requestId) {
    throw teacherCommandError(
      roleState.lastAgentRequestError.message || '学生智能体未能应用这条教师指令。',
      roleState.lastAgentRequestError.code || 'TEACHER_COMMAND_AGENT_FAILED',
    );
  }
}

function synchronizeTeacherRunState(runState) {
  if (!runState || standaloneMode) return;
  const wasBlocked = teacherRunBlocksLearning();
  const claimProjection = mergeRoleClaimProjection({
    claimedRoleId: state.teacherClaimedRoleId,
    takenRoleIds: state.teacherTakenRoleIds,
    availableRoleIds: state.teacherAvailableRoleIds,
  }, runState);
  state.teacherClaimedRoleId = claimProjection.claimedRoleId;
  state.teacherTakenRoleIds = claimProjection.takenRoleIds;
  state.teacherAvailableRoleIds = claimProjection.availableRoleIds;
  const rolesReleased = runState.rolesReleased === true && runState.rolesLocked !== true;
  state.teacherReleasedRoles = rolesReleased;
  state.teacherRolesLocked = runState.rolesLocked === true;
  state.teacherRunStatus = runState.status || state.teacherRunStatus;
  state.teacherRunPaused = runState.paused === true;
  state.teacherEmergencyRally = runState.rallyActive === true;
  state.teacherSessionInactive = false;
  if (!wasBlocked && teacherRunBlocksLearning()) suspendActiveLearningMedia();
  const activeAction = state.activeTeacherCommand?.action;
  if (state.teacherRunStatus === 'completed' && activeAction !== 'end_run') {
    showTeacherDirective({
      id: '',
      action: 'end_run',
      confirmed: true,
      payload: { message: '本次课程已结束，请停止当前任务，按老师安排完成集合或离场。' },
    });
  } else if (state.teacherRunStatus && state.teacherRunStatus !== 'active' && activeAction !== 'pause') {
    showTeacherDirective({
      id: '',
      action: 'pause',
      confirmed: true,
      payload: { message: '课程尚未开始。请留在当前页面，等待老师发出开始指令。' },
    });
  } else if (state.teacherEmergencyRally && activeAction !== 'emergency_rally') {
    showTeacherDirective({
      id: '',
      action: 'emergency_rally',
      confirmed: true,
      payload: { message: '请停止当前任务，按老师要求前往集合点。' },
    });
  } else if (state.teacherRunPaused && !['pause', 'emergency_rally', 'end_run'].includes(activeAction)) {
    showTeacherDirective({
      id: '',
      action: 'pause',
      confirmed: true,
      payload: { message: '课程已暂停。请停留在安全位置，等待老师恢复课程。' },
    });
  } else if (
    !state.teacherRunPaused
    && !state.teacherEmergencyRally
    && (!state.teacherRunStatus || state.teacherRunStatus === 'active')
    && ['pause', 'emergency_rally'].includes(activeAction)
  ) {
    document.querySelector('#teacherDirectiveOverlay').hidden = true;
    state.activeTeacherCommand = null;
  }
  const roleSwitchDescription = document.querySelector('#roleSwitchDescription');
  if (roleSwitchDescription) {
    roleSwitchDescription.textContent = state.teacherRolesLocked
      ? '老师已锁定角色。你可以继续当前角色，暂时不能换领其他角色。'
      : `同组一人领取一个${lesson.roleSystem.itemName}；已领取的角色不能重复选择。`;
  }
  if (!state.currentRoleId && !isPhaseTrackActive() && state.screen === 'roleScreen' && !rolesReleased) {
    showScreen('immersiveScreen');
  }
  if (
    rolesReleased
    && !state.currentRoleId
    && state.phaseState?.completed
    && state.screen === 'immersiveScreen'
  ) {
    showScreen('roleScreen');
  }
  let refreshedRoleUi = false;
  if (state.screen === 'roleScreen' && document.querySelector('#roleList')) {
    renderRoles();
    refreshedRoleUi = true;
  }
  if (state.currentRoleId && state.openSheetId === 'roleSwitchSheet') {
    renderRoleSwitch();
    refreshedRoleUi = true;
  }
  if (refreshedRoleUi) refreshIcons();
}

function lockRoleAssignment() {
  state.teacherReleasedRoles = false;
  state.teacherRolesLocked = true;
  if (!state.currentRoleId && (!isPhaseTrackActive() || state.phaseState?.completed)) {
    showScreen('immersiveScreen');
  } else if (state.screen === 'learningShell') {
    renderLearningShell();
  }
  showToast('老师已锁定角色，暂时不能换领。');
}

function positiveCommandAmount(command, fallback) {
  const amount = Number(command.payload?.amount ?? fallback);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw teacherCommandError('教师指令中的时间数值无效。', 'TEACHER_COMMAND_INVALID_PAYLOAD');
  }
  return amount;
}

function teacherCommandHandlers(roleState) {
  return {
    send_notice: (command) => teacherNotice(command.payload.text || command.payload.message || '请关注老师的最新提示。'),
    push_knowledge: (command) => teacherNotice(command.payload.text || command.payload.message || '老师已推送一条补充资料。'),
    add_time: (command) => {
      const minutes = positiveCommandAmount(command, 3);
      teacherNotice(`教师加时功能暂未开放（本次请求为 ${minutes} 分钟）。`);
    },
    remove_time: (command) => {
      const minutes = positiveCommandAmount(command, 1);
      teacherNotice(`教师减时功能暂未开放（本次请求为 ${minutes} 分钟）。`);
    },
    release_roles: () => releaseRoleAssignment(),
    lock_roles: () => lockRoleAssignment(),
    start_phase: (command) => {
      const requestedPhaseId = String(command.payload?.phaseId || '').trim();
      if (requestedPhaseId && requestedPhaseId !== state.currentPhaseId) {
        throw teacherCommandError('「开始阶段」只能开始学生当前阶段；跨阶段请使用「推进阶段」。', 'TEACHER_COMMAND_PHASE_MISMATCH');
      }
      state.teacherRunStatus = 'active';
      document.querySelector('#teacherDirectiveOverlay').hidden = true;
      teacherNotice(`老师已开始${currentPhase()?.name || '当前课程阶段'}。`);
    },
    set_scaffold: async (command) => {
      const level = Number(command.payload.level ?? 0);
      if (!Number.isInteger(level) || level < 0 || level > 4) {
        throw teacherCommandError('教师指令中的脚手架等级无效。', 'TEACHER_COMMAND_INVALID_PAYLOAD');
      }
      await runRequiredTeacherAgentTurn({
        type: 'lifecycle_event', event: 'teacher_directive',
        data: { scaffoldLevel: level, teacherCommandId: command.id },
      });
      teacherNotice('老师已调整后续提示深度。');
    },
    advance_phase: async (command) => {
      const phaseId = String(command.payload.phaseId || '').trim();
      if (!phaseId || !lesson.phases.some((phase) => phase.id === phaseId)) {
        throw teacherCommandError('教师指令中的目标阶段无效。', 'TEACHER_COMMAND_INVALID_PHASE');
      }
      await runRequiredTeacherAgentTurn({
        type: 'lifecycle_event', event: 'teacher_directive',
        data: { phaseId, teacherCommandId: command.id },
      });
      state.currentPhaseId = phaseId;
      beginCurrentPhase();
      renderLearningShell();
      teacherNotice(`老师已推进到${currentPhase()?.name || '下一课程阶段'}。`);
    },
    approve_evidence: async (command) => {
      const task = currentTask();
      if (!task) throw teacherCommandError('当前没有可确认的任务。', 'TEACHER_COMMAND_TASK_MISSING');
      const stepIndex = Number(roleState.guidanceStepIndices[task.id] || 0);
      const step = task.steps?.[stepIndex];
      if (['teacher_confirm', 'ai_evaluation'].includes(step?.completionMode)) {
        const evidence = taskEvidence(task.id);
        await runRequiredTeacherAgentTurn({
          type: 'lifecycle_event', event: 'task_step_completed',
          data: {
            taskId: task.id,
            stepId: step.id,
            stepIndex,
            completionMode: step.completionMode,
            localEvidenceCount: evidence.imageUrls.length,
            toolValues: serializableToolValues(evidence),
            teacherApproved: true,
            teacherCommandId: command.id,
          },
        });
      } else if (
        task.finalizationMode === 'teacher_confirm'
        && roleState.taskFinalizations?.[task.id]?.status === 'awaiting_teacher_confirm'
      ) {
        await runRequiredTeacherAgentTurn({
          type: 'lifecycle_event', event: 'teacher_finalize_task',
          data: { taskId: task.id, teacherCommandId: command.id },
        });
      } else {
        throw teacherCommandError('当前任务未处于等待教师确认的状态。', 'TEACHER_COMMAND_TASK_STATE_MISMATCH');
      }
      teacherNotice('老师已人工确认当前证据。');
    },
    reject_evidence: async (command) => {
      const task = currentTask();
      if (!task || task.finalizationMode !== 'teacher_confirm'
        || roleState.taskFinalizations?.[task.id]?.status !== 'awaiting_teacher_confirm') {
        throw teacherCommandError('当前任务未处于等待教师审核的状态。', 'TEACHER_COMMAND_TASK_STATE_MISMATCH');
      }
      await runRequiredTeacherAgentTurn({
        type: 'lifecycle_event', event: 'teacher_reject_task',
        data: {
          taskId: task.id,
          reason: command.payload.reason || command.payload.message || '老师请你修改最后一步后再次提交确认。',
          teacherCommandId: command.id,
        },
      });
      teacherNotice('老师请你补充或重新提交当前证据。');
    },
    skip_step: async (command) => {
      const task = currentTask();
      const stepIndex = Number(roleState.guidanceStepIndices[task?.id] || 0);
      const step = task?.steps?.[stepIndex];
      if (!task || !step) throw teacherCommandError('当前没有可跳过的任务小步。', 'TEACHER_COMMAND_STEP_MISSING');
      await runRequiredTeacherAgentTurn({
        type: 'lifecycle_event', event: 'task_step_completed',
        data: { taskId: task.id, stepId: step.id, stepIndex, teacherOverride: true, teacherCommandId: command.id },
      });
      teacherNotice('老师已允许跳过当前小步，系统保留了本次人工干预记录。');
    },
    advance_task: async (command) => {
      await runRequiredTeacherAgentTurn({
        type: 'lifecycle_event', event: 'teacher_advance_task',
        data: { taskId: roleState.pendingAdvance?.taskId || currentTask()?.id || '', teacherCommandId: command.id },
      });
      teacherNotice('老师已确认，可以进入下一个任务。');
    },
    pause: (command) => {
      state.teacherRunPaused = true;
      suspendActiveLearningMedia();
      showTeacherDirective(command);
    },
    emergency_rally: (command) => {
      state.teacherEmergencyRally = true;
      suspendActiveLearningMedia();
      showTeacherDirective(command);
    },
    resume: () => {
      if (state.teacherRunStatus === 'completed') {
        throw teacherCommandError('已结束的课程不能在学生端重新恢复。', 'TEACHER_RUN_COMPLETED');
      }
      state.teacherRunPaused = false;
      state.teacherEmergencyRally = false;
      document.querySelector('#teacherDirectiveOverlay').hidden = true;
      state.activeTeacherCommand = null;
      teacherNotice('老师已恢复课程，可以继续当前任务。');
      renderLearningShell();
    },
    end_run: (command) => {
      state.teacherRunStatus = 'completed';
      state.teacherRunPaused = false;
      state.teacherEmergencyRally = false;
      state.agentQueue.length = 0;
      suspendActiveLearningMedia();
      showTeacherDirective(command);
    },
    confirm_arrival: async (command) => {
      await runRequiredTeacherAgentTurn({
        type: 'lifecycle_event', event: 'teacher_confirm_arrival',
        data: { teacherCommandId: command.id },
      });
      teacherNotice('老师已人工确认你到达当前任务点。');
    },
    switch_alternative: () => ({
      handled: false,
      code: 'TEACHER_COMMAND_NOT_IMPLEMENTED',
      message: '当前课程没有可应用的替代任务配置。',
    }),
  };
}

async function applyTeacherCommand(command) {
  const roleState = currentRoleState();
  if (!roleState?.agentSessionId) return { handled: false, code: 'TEACHER_COMMAND_SESSION_MISSING' };
  let result = state.teacherCommandApplications.get(command.id);
  if (!result) {
    result = await dispatchTeacherCommand(command, teacherCommandHandlers(roleState));
    // Retrying only the receipt must not apply add_time or another local side
    // effect twice when the first receipt request lost its connection.
    state.teacherCommandApplications.set(command.id, result);
  }
  await sendTeacherCommandReceipt(
    roleState.agentSessionId,
    command.id,
    result.handled ? 'delivered' : 'failed',
  );
  if (!result.handled) {
    showToast(studentFacingError(result.error || result, '这条教师指令未能应用。'));
  }
  return result;
}

async function pollTeacherCommands() {
  const roleState = currentRoleState();
  const sessionId = roleState?.agentSessionId;
  // 忙碌时先不领取命令。命令继续保持 accepted，下次轮询才实际应用并回执；
  // 避免入内存队列后立刻标 delivered，刷新页面时永久丢失。
  if (!sessionId || document.hidden || teacherPollInFlight) return;
  teacherPollInFlight = true;
  try {
    const result = await getTeacherCommands(sessionId, 0);
    synchronizeTeacherRunState(result.runState);
    if (
      document.hidden
      || currentRoleState() !== roleState
      || roleState.agentSessionId !== sessionId
    ) return;
    for (const command of result.commands) {
      if (
        TEACHER_AGENT_COMMAND_ACTIONS.has(command.action)
        && (state.agentBusy || teacherRunBlocksLearning())
      ) continue;
      await applyTeacherCommand(command);
      roleState.teacherCommandSequence = Math.max(roleState.teacherCommandSequence, command.sequence || 0);
    }
  } catch {
    // Polling is best-effort and resumes when connectivity returns.
  } finally {
    teacherPollInFlight = false;
  }
}

function releaseRoleAssignment() {
  state.teacherReleasedRoles = true;
  state.teacherRolesLocked = false;
  if (isPhaseTrackActive() && !state.phaseState?.completed) {
    showToast('老师已开放角色领取，完成当前导入任务后即可进入。');
    return;
  }
  showScreen('roleScreen');
  showToast('老师已开放角色领取。');
}

function startVoiceInput() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    showToast('当前浏览器不支持语音转文字，请使用小程序真机或系统键盘语音。');
    return;
  }
  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = false;
  const input = document.querySelector('#chatInput');
  const original = input.value;
  recognition.onstart = () => showToast('正在聆听，请开始说话…');
  recognition.onresult = (event) => {
    const transcript = [...event.results].map((result) => result[0].transcript).join('');
    input.value = `${original}${original && transcript ? ' ' : ''}${transcript}`;
  };
  recognition.onerror = () => showToast('这次没有听清，请重试或直接输入文字。');
  recognition.start();
}

function startCourseFromLaunch() {
  return phaseTrack
    ? startPhaseLearning()
    : showScreen(standaloneMode || state.teacherReleasedRoles ? 'roleScreen' : 'immersiveScreen');
}

const actions = {
  'start-course': startCourseFromLaunch,
  'show-course-info': () => showToast(`${lesson.grades} · ${lesson.duration} · ${lesson.groupRule}`),
  'select-role': (target) => selectRole(target.dataset.roleId),
  'switch-role': (target) => selectRole(target.dataset.roleId),
  'set-learning-view': (target) => setLearningView(target.dataset.learningView),
  'challenge-previous': () => selectChallengePage(currentRoleState().challengePageIndex - 1),
  'challenge-forward': () => selectChallengePage(currentRoleState().challengePageIndex + 1),
  'qa-force-complete': (target) => forceCompleteChallengeTask(target.dataset.taskId),
  'open-role-switch': () => {
    renderRoleSwitch();
    openSheet('roleSwitchSheet');
    refreshIcons();
  },
  'close-sheet': closeSheet,
  'arrive-role-location': (target) => arriveRoleLocation(target.dataset.toolCallId),
  'preview-route': (target) => {
    let coordinates = null;
    try { coordinates = JSON.parse(target.dataset.coordinates || 'null'); } catch { coordinates = null; }
    openAmapNavigation({ coordinates, location: target.dataset.location, venue: target.dataset.venue });
    showToast('正在打开高德步行导航。');
  },
  'complete-task-step': (target) => completeTaskStep(target.dataset.taskId),
  'complete-activity-step': (target) => completeActivityStep(target.dataset.taskId, target.dataset.stepId),
  'remove-photo': (target) => removeActivityPhoto(
    target.dataset.taskId,
    target.dataset.stepId,
    Number(target.dataset.photoIndex),
  ),
  'toggle-activity-recording': (target) => toggleActivityRecording(target.dataset.taskId, target.dataset.stepId),
  'select-sketch-color': (target) => {
    document.querySelectorAll('[data-sketch-canvas]').forEach((canvas) => {
      if (canvas.dataset.stepId === target.dataset.canvasId) canvas.dataset.brush = target.dataset.color;
    });
  },
  'clear-sketch': (target) => clearSketch(target.dataset.taskId, target.dataset.stepId),
  'move-order-item': (target) => moveOrderItem(target.dataset.taskId, target.dataset.stepId, Number(target.dataset.index), target.dataset.direction),
  'choose-simulation': (target) => {
    activityValue(target.dataset.taskId, target.dataset.stepId, 'simulation').pendingChoice = target.dataset.choiceId;
    renderChat();
  },
  'run-simulation': (target) => runSimulation(target.dataset.taskId, target.dataset.stepId),
  'add-team-entry': (target) => addTeamEntry(target.dataset.taskId, target.dataset.stepId),
  'complete-media': (target) => completeMediaActivity(target.dataset.taskId, target.dataset.stepId),
  'confirm-scan': (target) => confirmScan(target.dataset.taskId, target.dataset.stepId),
  'select-builder-item': (target) => {
    draggedBuilderItem = target.dataset.builderItem;
    showToast('已选中卡片，请点击目标区域的“放到这里”。');
  },
  'place-selected-builder': (target) => {
    if (!draggedBuilderItem) return showToast('请先选择一张卡片。');
    placeBuilderItem(target.dataset.taskId, target.dataset.stepId, target.dataset.zoneId, draggedBuilderItem);
    draggedBuilderItem = null;
  },
  'return-builder-item': (target) => returnBuilderItem(target.dataset.taskId, target.dataset.stepId, target.dataset.zoneId, target.dataset.itemId),
  'submit-task': (target) => submitTask(
    target.dataset.taskId,
    target.dataset.toolCallId,
    Number(target.dataset.minEvidence || 1),
  ),
  'send-message': sendMessage,
  // 学生自己确认进入下一任务（`推进方式：ai_suggest`）。教师侧的对应入口是
  // 教师端 advance_task 指令，两条路在服务端汇到同一个 resolvePendingAdvance。
  'advance-task': (target) => {
    const taskId = target.dataset.taskId || '';
    if (!standaloneMode) {
      return runAgentTurn({
        type: 'lifecycle_event',
        event: 'student_advance_task',
        data: { taskId },
      });
    }
    const role = currentRole();
    const roleState = currentRoleState();
    const result = resolveLocalPendingAdvance({ role, roleState, taskId, actor: 'student' });
    if (!result.ok) return showToast('当前任务不能由学生直接推进。');
    if (result.roleCompleted) {
      if (role.scope === 'phase') window.setTimeout(finishPhaseLearning, PHASE_TRANSITION_DELAY_MS);
      else if (!roleState.messages.some((message) => message.type === 'token')) {
        roleState.messages.push({ id: crypto.randomUUID(), type: 'token' });
      }
    } else {
      roleState.messages.push(...currentTaskRecoveryMessages(role, roleState));
    }
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 20);
    return result;
  },
  'send-quick-reply': (target) => sendQuickReply({
    questionId: target.dataset.questionId,
    act: target.dataset.act,
    value: target.dataset.value,
    label: target.dataset.label,
  }),
  'open-progress': () => openSheet('progressSheet'),
  'open-time-bank': () => {
    if (lesson.timeBank.enabled) openSheet('timeBankSheet');
  },
  'answer-bank-task': (target) => {
    const openAnswer = target.closest('.bank-task')?.querySelector('[data-bank-answer]')?.value;
    answerBankTask(target.dataset.taskId, openAnswer ?? target.dataset.answer);
  },
  'gift-time': (target) => giftTime(target.dataset.roleId, target.dataset.amount),
  'call-teacher': () => callTeacher(true),
  'confirm-teacher-command': async () => {
    const command = state.activeTeacherCommand;
    const persistent = ['pause', 'emergency_rally', 'end_run'].includes(command?.action);
    if (command?.id && !command.confirmed && currentRoleState()?.agentSessionId) {
      await sendTeacherCommandReceipt(currentRoleState().agentSessionId, command.id, 'confirmed').catch(() => undefined);
      command.confirmed = true;
      showToast('已向老师确认收到。');
    }
    if (persistent) {
      showTeacherDirective(command);
    } else {
      document.querySelector('#teacherDirectiveOverlay').hidden = true;
      state.activeTeacherCommand = null;
    }
  },
  'open-quick-tools': () => showToast(`工具会根据当前任务由${PLATFORM_COMPANION.name}主动调用。`),
  'voice-input': startVoiceInput,
};

app.addEventListener('click', (event) => {
  if (state.currentRoleId || isPhaseTrackActive()) currentRoleState().lastLocalActionAt = Date.now();
  if (isLearningFilePicker(event.target)) {
    if (teacherRunBlocksLearning()) {
      event.preventDefault();
      showToast(explainTeacherRunGate());
      return;
    }
    externalFilePickerOpen = true;
    scheduleFilePickerLayoutRestore();
  }
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    state.activeTab = tab.dataset.tab;
    renderTabs();
    renderLearningViewControls();
    refreshIcons();
    return;
  }

  const bankTab = event.target.closest('[data-bank-tab]');
  if (bankTab) {
    state.bankTab = bankTab.dataset.bankTab;
    renderTimeBank();
    return;
  }

  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  if (blockLearningAction(actionTarget.dataset.action)) return;
  const action = actions[actionTarget.dataset.action];
  if (action) action(actionTarget);
});

app.addEventListener('input', (event) => {
  if (state.currentRoleId || isPhaseTrackActive()) currentRoleState().lastLocalActionAt = Date.now();
  if (
    teacherRunBlocksLearning()
    && (event.target.dataset.bankTaskId
      || event.target.hasAttribute('data-activity-field')
      || event.target.dataset.taskText)
  ) return;
  if (event.target.dataset.bankTaskId) {
    state.bankDrafts[event.target.dataset.bankTaskId] ||= {};
    state.bankDrafts[event.target.dataset.bankTaskId].text = event.target.value;
    return;
  }
  if (event.target.hasAttribute('data-activity-field') && (state.currentRoleId || isPhaseTrackActive())) {
    const { taskId, stepId, toolId, fieldId } = event.target.dataset;
    const value = activityValue(taskId, stepId, toolId);
    if (toolId === 'text') {
      value.fields ||= {};
      value.fields[fieldId] = event.target.value;
    } else if (toolId === 'quiz' && event.target.type === 'checkbox') {
      value.answer = [...document.querySelectorAll(`[data-task-id="${CSS.escape(taskId)}"][data-step-id="${CSS.escape(stepId)}"][data-tool-id="quiz"]:checked`)].map((item) => item.value);
    } else {
      value[fieldId] = event.target.value;
    }
    taskEvidence(taskId).validationError = '';
    event.target.closest('.quiz-option')?.classList.toggle('is-selected', event.target.checked);
    return;
  }
  const taskId = event.target.dataset.taskText;
  if (!taskId || (!state.currentRoleId && !isPhaseTrackActive())) return;
  taskEvidence(taskId).text = event.target.value;
  taskEvidence(taskId).validationError = '';
});

app.addEventListener('change', async (event) => {
  if (state.currentRoleId || isPhaseTrackActive()) currentRoleState().lastLocalActionAt = Date.now();
  if (teacherRunBlocksLearning() && isLearningFilePicker(event.target)) {
    event.target.value = '';
    showToast(explainTeacherRunGate());
    return;
  }
  if (isLearningFilePicker(event.target)) {
    externalFilePickerOpen = false;
    scheduleFilePickerLayoutRestore();
  }
  if (event.target.dataset.bankFile) {
    const [file] = [...(event.target.files || [])];
    if (!file) return;
    const taskId = event.target.dataset.bankFile;
    state.bankDrafts[taskId] ||= {};
    if (state.bankDrafts[taskId].preview) URL.revokeObjectURL(state.bankDrafts[taskId].preview);
    state.bankDrafts[taskId].file = file;
    state.bankDrafts[taskId].preview = URL.createObjectURL(file);
    renderTimeBank();
    return;
  }
  if (event.target.hasAttribute('data-scan-file')) {
    const [file] = [...(event.target.files || [])];
    try {
      await scanImageFile(event.target.dataset.taskId, event.target.dataset.stepId, file);
    } finally {
      event.target.value = '';
      scheduleFilePickerLayoutRestore();
    }
    return;
  }
  const taskId = event.target.dataset.taskFile;
  let files = [...(event.target.files || [])];
  if (!taskId || !files.length || (!state.currentRoleId && !isPhaseTrackActive())) return;
  const evidence = taskEvidence(taskId);
  let value = null;
  let photoBatch = null;
  let taskOnlyImageUrls = [];
  const toolStepId = event.target.dataset.toolStep;
  try {
    if (toolStepId) {
      value = activityValue(taskId, toolStepId, 'photo');
      if (value.processing || value.revisionSubmitting) return showToast('照片正在准备或检查，请稍等一下。');
      const { tools } = editableStepContext(taskId, toolStepId);
      const maximum = Number(tools?.find((tool) => tool.id === 'photo')?.config?.maxCount || 6);
      const remaining = Math.max(0, maximum - Number(value.count || 0));
      if (!remaining) return showToast(`本小步最多提交 ${maximum} 张照片。`);
      if (files.length > remaining) {
        files = files.slice(0, remaining);
        showToast(`本次保留 ${remaining} 张，已达到本小步上限。`);
      }
    }

    const imageUrls = files.map((file) => URL.createObjectURL(file));
    evidence.validationError = '';
    if (value) {
      photoBatch = appendPhotoBatch(evidence, value, files, imageUrls);
    } else {
      evidence.imageUrls.push(...imageUrls);
      evidence.files.push(...files);
      taskOnlyImageUrls = imageUrls;
    }
    renderChat();
    window.setTimeout(scrollChatToBottom, 20);
    if (value) {
      const dataUrls = await Promise.all(files.map(optimizedImageDataUrl));
      completePhotoBatch(value, dataUrls);
      renderChat();
    }
  } catch (error) {
    if (value && photoBatch) {
      rollbackPhotoBatch(evidence, value, photoBatch, {
        revokeObjectUrl: (url) => URL.revokeObjectURL(url),
      });
    } else {
      for (const url of taskOnlyImageUrls) {
        const index = evidence.imageUrls.indexOf(url);
        if (index >= 0) {
          evidence.imageUrls.splice(index, 1);
          evidence.files.splice(index, 1);
        }
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
    }
    evidence.validationError = '这批照片没有处理完整，已撤回。请重新选择照片。';
    renderLearningShell();
    showToast(studentFacingError(error, '照片处理遇到问题，请再试一次。'));
  } finally {
    event.target.value = '';
  }
});

app.addEventListener('cancel', (event) => {
  if (!isLearningFilePicker(event.target)) return;
  externalFilePickerOpen = false;
  event.target.value = '';
  scheduleFilePickerLayoutRestore();
}, true);

window.addEventListener('focus', () => {
  if (externalFilePickerOpen) scheduleFilePickerLayoutRestore();
});

window.addEventListener('pageshow', () => {
  if (externalFilePickerOpen) scheduleFilePickerLayoutRestore();
});

document.addEventListener('visibilitychange', () => {
  if (externalFilePickerOpen && document.visibilityState === 'visible') {
    scheduleFilePickerLayoutRestore();
  }
});

app.addEventListener('ended', (event) => {
  if (!event.target.hasAttribute('data-activity-media')) return;
  if (teacherRunBlocksLearning()) return;
  void completeMediaActivity(event.target.dataset.taskId, event.target.dataset.stepId);
}, true);

app.addEventListener('dragstart', (event) => {
  if (teacherRunBlocksLearning()) return;
  const item = event.target.closest('[data-builder-item]');
  if (!item) return;
  draggedBuilderItem = item.dataset.builderItem;
  event.dataTransfer?.setData('text/plain', draggedBuilderItem);
});

app.addEventListener('dragover', (event) => {
  if (event.target.closest('[data-builder-zone]')) event.preventDefault();
});

app.addEventListener('drop', (event) => {
  const zone = event.target.closest('[data-builder-zone]');
  if (!zone) return;
  event.preventDefault();
  if (teacherRunBlocksLearning()) {
    showToast(explainTeacherRunGate());
    return;
  }
  const itemId = event.dataTransfer?.getData('text/plain') || draggedBuilderItem;
  placeBuilderItem(zone.dataset.taskId, zone.dataset.stepId, zone.dataset.builderZone, itemId);
  draggedBuilderItem = null;
});

document.querySelector('#chatInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (blockLearningAction('send-message')) return;
    sendMessage();
  }
});

window.setInterval(() => {
  const timer = document.querySelector('#phaseTimer');
  if (!timer) return;
  if (!state.phaseEndTime) {
    timer.textContent = '--:--:--';
    return;
  }
  const remaining = Math.max(0, state.phaseEndTime - Date.now());
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  timer.textContent = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}, 1000);

window.setInterval(sendContextTick, 30_000);

window.addEventListener('student-learning:teacher-command', (event) => {
  if (event.detail?.type === 'start-role-assignment') releaseRoleAssignment();
});

window.setInterval(() => { void pollTeacherCommands(); }, 3000);

window.studentLearningDemo = Object.freeze({
  teacherStartRoleAssignment() {
    window.dispatchEvent(new CustomEvent('student-learning:teacher-command', {
      detail: { type: 'start-role-assignment' },
    }));
  },
});

renderLaunch();
renderRoles();
refreshIcons();
