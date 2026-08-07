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
  Eraser,
  HandHelping,
  Info,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Map,
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
  answerTimeBank as answerTimeBankRequest,
  createAgentSession,
  giftTime as giftTimeRequest,
  getTeacherCommands,
  requestTeacherHelp,
  reportStudentPresence,
  sendAgentTurn,
  sendTeacherCommandReceipt,
  uploadEvidence,
} from './services/ai-service.js';
import { getLesson } from './services/course-service.js';
import { mountAmapNavigation, openAmapNavigation } from './services/amap-service.js';
import { resolveStudentRuntime } from './services/runtime-mode.js';
import { PLATFORM_COMPANION } from './engine/platform-config.js';
import {
  challengeSubmissionPassed,
  challengeTaskAccess,
  clampChallengePageIndex,
  initialLearningView,
  nextLearningView,
} from './engine/learning-view.js';
import {
  renderActivityTools,
  serializableToolValues,
  validateActivityStep,
} from './components/activity-tools.js';

const pageParams = new URLSearchParams(window.location.search);
const lesson = getLesson(pageParams.get('lesson') || undefined);
const app = document.querySelector('#studentApp');
const studentRuntime = resolveStudentRuntime(pageParams);
const standaloneMode = studentRuntime.standalone;
const demoSession = {
  groupName: '第 3 小组',
  members: lesson.roles.map((role, index) => ({
    roleId: role.id,
    name: `学习者${index + 1}`,
    online: true,
  })),
};

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
  Eraser,
  HandHelping,
  Info,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Map,
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
  currentPhaseId: lesson.roleSystem.phaseId,
  activeTab: 'task',
  learningView: initialLearningView(lesson.learningView),
  openSheetId: null,
  teacherReleasedRoles: studentRuntime.teacherReleasedRoles,
  roleStates: Object.fromEntries(
    lesson.roles.map((role) => [role.id, {
      arrived: false,
      progress: 0,
      completed: false,
      messages: [],
      lastRenderableMessages: [],
      taskCallIds: {},
      taskPayloads: {},
      evidence: {},
      guidanceStepIndices: {},
      entryStarted: false,
      agentSessionId: null,
      teacherCommandSequence: 0,
      streamingMessageId: null,
      lastAgentRequestError: null,
      lastLocalActionAt: Date.now(),
      challengePageIndex: 0,
      challengeFeedback: {},
      // 服务端 state.updated 下发的「等谁推进」：`{ mode: 'teacher'|'student', taskId }` 或 null。
      // 任务卡据此显示「等老师确认」还是「继续下一个」按钮。
      pendingAdvance: null,
      locationStatus: {
        permission: 'unknown',
        insideFence: null,
        accuracyMeters: null,
        verifiedBy: null,
        arrivedAt: null,
      },
    }]),
  ),
  mockTeamProgress: lesson.roles.map((role, index) => Math.min(index % 4, role.tasks.length)),
  timeBalance: lesson.timeBank.initialBalance,
  timeEarned: 0,
  completedBankTasks: new Set(),
  bankDrafts: {},
  bankTab: 'earn',
  phaseEndTime: null,
  toastTimer: null,
  agentBusy: false,
  agentQueue: [],
  activeTeacherCommand: null,
};

let navigationMapInstances = [];
let mapHydrationVersion = 0;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  return lesson.roles.find((role) => role.id === state.currentRoleId) || lesson.roles[0];
}

function currentRoleState() {
  return state.roleStates[currentRole().id];
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
  toast.textContent = message;
  toast.classList.add('is-visible');
  state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function resetShellScrollOffsets() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  app.scrollTop = 0;
  document.querySelector('.learning-content')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.scrollTop = 0;
    panel.scrollLeft = 0;
  });
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
  if (!state.teacherReleasedRoles) {
    document.querySelector('[data-action="start-course"] span').textContent = '进入课程导入';
    document.querySelector('.launch-note').textContent = '导入期间请观看现场内容，身份领取由老师统一开启';
  }
  document.querySelector('#groupCode').textContent = demoSession.groupName;
  document.querySelector('#rolePickerEyebrow').textContent = courseTemplate(lesson.roleSystem.pickerEyebrow);
  document.querySelector('#rolePickerHeader').textContent = `领取${lesson.roleSystem.itemName}卡`;
  document.querySelector('#roleScreenTitle').textContent = courseTemplate(lesson.roleSystem.pickerTitle);
  document.querySelector('#rolePickerDescription').textContent = courseTemplate(lesson.roleSystem.pickerDescription);
  document.querySelector('#collectionPanelName').textContent = lesson.roleSystem.collectionPanelName;
  document.querySelector('#teamSessionStatus').innerHTML = `<i data-lucide="navigation"></i> ${escapeHtml(demoSession.groupName)} · ${demoSession.members.filter((member) => member.online).length} 人在线`;
  document.querySelector('#roleSwitchDescription').textContent = `当前入口用于预览 ${lesson.roles.length} 个${lesson.roleSystem.itemName}的课程任务配置。`;
  document.querySelector('#chatDayLabel').textContent = `今天 · ${lesson.venue || '课程现场'}`;
  document.querySelector('#chatInputLabel').textContent = `给${PLATFORM_COMPANION.name}发送消息`;
  document.querySelector('#chatInput').placeholder = `和${PLATFORM_COMPANION.name}说说你的发现…`;
}

function renderRoles() {
  const markup = lesson.roles.map((role, index) => `
    <button class="role-option" type="button" data-role-id="${role.id}" data-action="select-role">
      <img src="${role.cardImage}" alt="${escapeHtml(role.name)}${escapeHtml(lesson.roleSystem.itemName)}卡" />
      <span class="role-option__shade"></span>
      <span class="role-option__number">${String(index + 1).padStart(2, '0')}</span>
      <span class="role-option__copy">
        <h3>${escapeHtml(role.name)}</h3>
        <p>${escapeHtml(role.selectionDescription)}</p>
        <span class="role-option__meta">
          <span><i data-lucide="map-pin"></i>${escapeHtml(role.location)}</span>
          <strong>领取${escapeHtml(lesson.roleSystem.itemName)} <i data-lucide="arrow-right"></i></strong>
        </span>
      </span>
    </button>
  `).join('');
  document.querySelector('#roleList').innerHTML = markup;
}

async function selectRole(roleId) {
  if (!state.teacherReleasedRoles) {
    showScreen('immersiveScreen');
    showToast('请等待老师开启身份领取。');
    return;
  }
  const role = lesson.roles.find((item) => item.id === roleId);
  if (!role) return;
  state.currentRoleId = role.id;
  state.activeTab = 'task';
  beginCurrentPhase();
  const roleState = state.roleStates[role.id];
  renderLearningShell();
  showScreen('learningShell');
  closeSheet();
  if (standaloneMode) {
    if (!roleState.entryStarted) {
      roleState.entryStarted = true;
      roleState.messages = [
        {
          id: crypto.randomUUID(),
          type: 'assistant',
          text: `欢迎领取“${role.name}”角色。当前为本地体验模式，你可以直接完成任务小步并记录学习过程。`,
          source: '本地课程包',
        },
        ...currentTaskRecoveryMessages(role, roleState),
      ];
    }
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 40);
    return;
  }
  if (!roleState.agentSessionId) {
    try {
      const session = await createAgentSession({
        courseId: lesson.id,
        roleId: role.id,
        studentId: pageParams.get('studentId') || `demo-${role.id}`,
        groupId: pageParams.get('groupId') || 'group-3',
        runId: pageParams.get('runId') || undefined,
        participantId: pageParams.get('participantId') || undefined,
        grade: lesson.grades,
      });
      roleState.agentSessionId = session.id;
      void pollTeacherCommands();
    } catch (error) {
      showToast(error.message);
      return;
    }
  }
  renderLearningShell();
  window.setTimeout(scrollChatToBottom, 40);
  if (!roleState.entryStarted && roleState.messages.length === 0) {
    roleState.entryStarted = true;
    void runAgentTurn(
      { type: 'lifecycle_event', event: 'role_assigned', data: { roleId: role.id } },
      { initialEmpty: true, showLoading: false },
    );
  }
}

function renderHeader() {
  const role = currentRole();
  const roleState = currentRoleState();
  const progress = Math.round((roleState.progress / role.tasks.length) * 100);
  document.querySelector('#headerRoleBadge').src = role.badgeImage;
  document.querySelector('#headerRoleName').textContent = `${role.name} · ${roleState.completed ? `${lesson.roleSystem.itemName}任务完成` : (currentPhase()?.name || '课程任务')}`;
  document.querySelector('#headerPhase').textContent = roleState.completed
    ? '角色任务已完成'
    : `第 ${roleState.progress + 1} 阶段 · ${currentTask().name}`;
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
  document.querySelectorAll('.primary-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === state.activeTab);
  });
  document.querySelector('#taskTab').classList.toggle('is-active', state.activeTab === 'task');
  document.querySelector('#teamTab').classList.toggle('is-active', state.activeTab === 'team');
}

function assistantMessage(message) {
  return `
    <div class="message-row" data-message-id="${escapeHtml(message.id || '')}">
      ${companionAvatar()}
      <div class="message-content">
        <p class="message-name">${escapeHtml(PLATFORM_COMPANION.name)} · AI 学习同伴</p>
        <div class="message-bubble">
          <span data-message-text>${escapeHtml(message.text)}</span>
          ${message.source ? `<span class="source-label"><i data-lucide="book-open-check"></i>${escapeHtml(message.source)}</span>` : ''}
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
      ${message.options.map((option) => `
        <button type="button" data-action="send-quick-reply"
          data-question-id="${escapeHtml(message.questionId || '')}"
          data-act="${escapeHtml(option.act || 'affirm')}"
          data-value="${escapeHtml(option.value || option.label)}"
          data-label="${escapeHtml(option.label)}">
          ${escapeHtml(option.label)}
        </button>
      `).join('')}
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
          <h3>${escapeHtml(message.stageName)}</h3>
          <p>${message.location ? `地点：${escapeHtml(message.location)} · ` : ''}${minutes ? `预计：${minutes} 分钟 · ` : ''}主要任务：${escapeHtml(message.mainTask)}</p>
        </div>
      </article>
    `;
  }
  return `<div class="phase-message"><i data-lucide="flag"></i><span>${escapeHtml(message.text)}</span></div>`;
}

function navigationCard(message) {
  const role = currentRole();
  const roleState = currentRoleState();
  const location = message.payload?.location || role.location;
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
  return {
    taskId: task.id,
    taskIndex,
    config: { tools: task.tools || [] },
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
  lockedBrowse = false,
}) {
  const evidence = taskEvidence(task.id);
  const isComplete = status === 'complete' || readOnly;
  const minimumEvidence = Number(payload?.config?.minEvidenceCount || 1);
  const actionIcon = payload?.config?.tools?.[0]?.icon || task.tools?.[0]?.icon || 'notebook-pen';
  const stepDefinitions = task.steps?.length
    ? task.steps
    : (task.guidanceSteps?.length ? task.guidanceSteps : [task.requirement]).map((studentAction, index) => ({
      id: `${task.id}-step-${index + 1}`,
      studentAction,
      completionMode: 'user_confirm',
    }));
  const steps = stepDefinitions.map((step) => step.studentAction || step.objective);
  const stepIndex = Math.min(Number(roleState.guidanceStepIndices[task.id] || 0), steps.length);
  const stepsComplete = stepIndex >= steps.length;
  const activeStep = stepDefinitions[stepIndex];
  const activeTools = activeStep?.tools?.length
    ? activeStep.tools
    : (payload?.config?.tools?.length ? payload.config.tools : (task.tools || []));
  const stepId = activeStep?.id || `${task.id}-complete`;
  const canCompleteStep = !lockedBrowse && (standaloneMode || !['teacher_confirm', 'location_event'].includes(activeStep?.completionMode));
  const toolCallReady = !lockedBrowse && (standaloneMode || Boolean(callId));
  // 这个任务已经做完、但在等推进（`推进方式：teacher`／`ai_suggest`）。
  // 等待期间服务端不开新工具卡也不动 currentTaskIndex，所以卡片还是这一张——
  // 必须换掉提交区，否则学生看到的是一个点了没反应的「提交给絮絮分析」。
  const waiting = roleState.pendingAdvance?.taskId === task.id ? roleState.pendingAdvance.mode : '';

  return `
    <article class="tool-card task-workspace" data-task-card="${task.id}" data-learning-workspace="${escapeHtml(view)}">
      <div class="tool-card__visual">
        <img src="${taskVisual(role, task)}" alt="${escapeHtml(task.name)}任务素材" />
        <span class="tool-card__visual-badge"><i data-lucide="${actionIcon}"></i>${escapeHtml(task.modules || '任务工具')}</span>
      </div>
      <div class="tool-card__body">
        <div class="tool-card__kicker"><span>任务 ${taskIndex + 1} / ${role.tasks.length}</span><span>${isComplete ? '已提交' : lockedBrowse ? '待解锁' : '进行中'}</span></div>
        <h3>${escapeHtml(task.name)}</h3>
        <p>${escapeHtml(task.requirement)}</p>
        <div class="module-tags">
          ${moduleLabels(task.modules).map((module) => `<span class="module-tag">${escapeHtml(module)}</span>`).join('')}
        </div>
        ${!isComplete && !waiting ? `
          <section class="task-step-guide ${stepsComplete ? 'is-complete' : ''}">
            <div class="task-step-guide__top">
              <span>${stepsComplete ? '小步已完成' : `当前小步 ${stepIndex + 1} / ${steps.length}`}</span>
              <strong>${stepsComplete ? `${steps.length} / ${steps.length}` : `${stepIndex + 1} / ${steps.length}`}</strong>
            </div>
            <p>${escapeHtml(stepsComplete ? '可以整理照片或记录，提交给絮絮检查。' : steps[stepIndex])}</p>
            ${stepsComplete ? '' : renderActivityTools({ tools: activeTools, evidence, allEvidence: roleState.evidence, taskId: task.id, stepId })}
            ${stepsComplete || !canCompleteStep ? '' : `
              <button class="task-step-button" type="button" data-action="complete-activity-step" data-task-id="${task.id}" data-step-index="${stepIndex}" data-step-id="${escapeHtml(stepId)}">
                <i data-lucide="check"></i>${activeStep?.completionMode === 'user_confirm' ? '这一步完成了' : '保存并检查这一步'}
              </button>
            `}
            ${!stepsComplete && activeStep?.completionMode === 'teacher_confirm' ? '<span class="task-step-guide__validation">提交后需要老师确认，确认前会停留在本小步。</span>' : ''}
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
        ` : isComplete ? `
          <div class="source-label"><i data-lucide="circle-check-big"></i>证据已进入个人学习档案</div>
        ` : `
          <div class="evidence-form ${stepsComplete ? '' : 'is-locked'}">
            ${evidence.validationError ? `<p class="evidence-error"><i data-lucide="info"></i>${escapeHtml(evidence.validationError)}</p>` : ''}
            ${stepsComplete ? `<div class="activity-submit-summary"><i data-lucide="circle-check-big"></i><div><strong>所有小步已完成</strong><span>${evidence.imageUrls.length ? `已采集 ${evidence.imageUrls.length} 个文件；` : ''}工具结果将与补充说明一起提交。</span></div></div><textarea class="task-textarea" data-task-text="${task.id}" placeholder="可补充说明你的判断依据…">${escapeHtml(evidence.text)}</textarea>` : ''}
            ${view === 'challenge' && !toolCallReady && !lockedBrowse ? '<div class="challenge-tool-waiting"><i data-lucide="sparkles"></i>智能体正在准备本任务的提交通道，小步操作可以先继续。</div>' : ''}
            <button class="tool-primary" type="button" data-action="submit-task" data-task-id="${task.id}" data-tool-call-id="${escapeHtml(callId)}" data-min-evidence="${minimumEvidence}" ${stepsComplete && toolCallReady ? '' : 'disabled'}>
              <i data-lucide="sparkles"></i>${stepsComplete ? (toolCallReady ? `提交给${escapeHtml(PLATFORM_COMPANION.name)}分析` : '等待任务通道') : '完成当前小步后提交'}
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
  const label = labels[feedback.status] || '任务反馈';
  const text = feedback.text || (feedback.status === 'checking'
    ? '正在核对当前 Step 的证据和完成条件…'
    : '结果已记录。');
  return `
    <section class="challenge-feedback is-${escapeHtml(feedback.status || 'checking')}" data-challenge-feedback="${escapeHtml(taskId)}" aria-live="polite">
      <strong>${escapeHtml(label)}</strong>
      <p>${escapeHtml(text)}</p>
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
  const allowFutureTaskBrowse = Boolean(lesson.learningView?.allowFutureTaskBrowse);
  roleState.challengePageIndex = clampChallengePageIndex({
    requestedIndex: roleState.challengePageIndex,
    progress: roleState.progress,
    taskCount: role.tasks.length,
    roleCompleted: roleState.completed,
    allowAll: allowFutureTaskBrowse,
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
  const highestUnlocked = allowFutureTaskBrowse || roleState.completed
    ? role.tasks.length - 1
    : Math.min(roleState.progress, role.tasks.length - 1);
  container.innerHTML = `
    <header class="challenge-hero">
      <span>${escapeHtml(role.name)} · 任务闯关</span>
      <strong>${escapeHtml(task.name)}</strong>
      <p>一页完成一项任务；每个 Step 通过后自动进入下一步。</p>
    </header>
    <nav class="challenge-pages" aria-label="角色任务分页">
      ${role.tasks.map((item, index) => {
        const itemAccess = challengeTaskAccess({
          taskIndex: index,
          progress: roleState.progress,
          taskCount: role.tasks.length,
          roleCompleted: roleState.completed,
        });
        return `<button class="challenge-page-button ${index === pageIndex ? 'is-active' : ''} ${itemAccess === 'completed' ? 'is-completed' : ''}" type="button" data-action="select-challenge-page" data-page-index="${index}" ${itemAccess === 'locked' && !allowFutureTaskBrowse ? 'disabled' : ''}><span>${itemAccess === 'completed' ? '已完成' : itemAccess === 'current' ? '当前任务' : '待解锁'}</span><strong>${index + 1}. ${escapeHtml(item.name)}</strong></button>`;
      }).join('')}
    </nav>
    ${challengeFeedbackMarkup(task.id)}
    ${access === 'locked' && !allowFutureTaskBrowse
      ? '<div class="challenge-task-summary"><i data-lucide="lock-keyhole"></i><div><strong>任务尚未解锁</strong><span>完成当前任务后再来查看。</span></div></div>'
      : renderTaskWorkspace({
        role,
        roleState,
        task,
        taskIndex: pageIndex,
        status: access === 'completed' ? 'complete' : 'active',
        payload,
        callId,
        view: 'challenge',
        readOnly: access === 'completed',
        lockedBrowse: access === 'locked',
      })}
    <nav class="challenge-page-nav" aria-label="上一项或下一项任务">
      <button type="button" data-action="challenge-previous" ${pageIndex <= 0 ? 'disabled' : ''}><i data-lucide="chevron-left"></i>上一关</button>
      <span>${pageIndex + 1} / ${role.tasks.length}</span>
      <button type="button" data-action="challenge-next" ${pageIndex >= highestUnlocked ? 'disabled' : ''}>下一关<i data-lucide="arrow-right"></i></button>
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
    allowAll: Boolean(lesson.learningView?.allowFutureTaskBrowse),
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
    allowAll: Boolean(lesson.learningView?.allowFutureTaskBrowse),
  });
  roleState.challengePageIndex = nextIndex;
  renderChat();
  document.querySelector('#challengeScroll')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function tokenReveal() {
  const role = currentRole();
  const roleCount = lesson.roles.length;
  const itemName = lesson.roleSystem.collectionItemName;
  return `
    <article class="token-reveal">
      <img src="${role.collectionItemImage}" alt="${escapeHtml(role.collectionItem)}${escapeHtml(itemName)}" />
      <div>
        <p class="eyebrow">${escapeHtml(lesson.roleSystem.itemName)}任务完成</p>
        <h3>获得${escapeHtml(itemName)} ${escapeHtml(role.collectionItem)}</h3>
        <p>这份${escapeHtml(itemName)}已同步到小组。${roleCount}位${escapeHtml(lesson.roleSystem.collectionName)}全部完成后，将解锁“${escapeHtml(lesson.roleSystem.unlockTarget)}”。</p>
      </div>
    </article>
  `;
}

function renderMessage(message) {
  if (message.type === 'assistant') return assistantMessage(message);
  if (message.type === 'user') return userMessage(message);
  if (message.type === 'phase') return phaseMessage(message);
  if (message.type === 'navigation') return navigationCard(message);
  if (message.type === 'task') return taskCard(message);
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
  const payload = roleState.taskPayloads?.[task.id] || {
    taskId: task.id,
    taskIndex,
    config: { tools: task.tools || [] },
  };
  return [
    {
      id: crypto.randomUUID(),
      type: 'phase',
      text: `界面已恢复 · 继续完成「${task.name}」`,
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
  if (!state.currentRoleId) return;
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
  window.requestAnimationFrame(resetShellScrollOffsets);
}

function waitFor(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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

function applyAgentEvent(event, feedbackTarget = null) {
  const role = currentRole();
  const roleState = currentRoleState();
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
    else textNode.textContent = message.text;
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
    roleState.progress = event.data.currentTaskIndex;
    const completedCount = event.data.completedTaskIds.filter((id) => id.startsWith(`${role.id}:`)).length;
    if (completedCount >= role.tasks.length) {
      roleState.progress = role.tasks.length;
      if (!roleState.completed) roleState.messages.push({ id: crypto.randomUUID(), type: 'token' });
      roleState.completed = true;
    }
    // 做完 `推进方式：teacher`／`ai_suggest` 的任务后进度不动，界面必须说清为什么停住。
    // 没有这一行，学生看到的是一个提交完就没反应的任务卡。
    roleState.pendingAdvance = event.data.pendingAdvance || null;
    const location = event.data.runtime?.location;
    const runtime = event.data.runtime;
    if (runtime?.taskId) {
      roleState.guidanceStepIndices[runtime.taskId] = Number(runtime.guidanceStepIndex || 0);
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
  }
  applyChallengeFeedbackEvent(event, feedbackTarget);
}

async function runAgentTurn(input, options = {}) {
  const {
    passive = false,
    initialEmpty = false,
    showLoading = !passive && !initialEmpty,
    requestId = crypto.randomUUID(),
    feedbackTarget = null,
  } = options;
  const roleState = currentRoleState();
  if (!roleState.agentSessionId) return;
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
      if (event.type === 'assistant.delta') {
        shouldRender = true;
        applyAgentEvent(event, feedbackTarget);
        return;
      }
      bufferedEvents.push(event);
    });
    let visibleEventCount = 0;
    for (const event of bufferedEvents) {
      const completesStream = event.type === 'assistant.completed' && Boolean(roleState.streamingMessageId);
      const visuallyAddsMessage = event.type === 'stage.started'
        || event.type === 'tool.requested'
        || (event.type === 'assistant.completed' && !completesStream);
      if (visuallyAddsMessage) {
        if ((initialEmpty && visibleEventCount === 0) || visibleEventCount > 0) await waitFor(500);
        if (loadingId) roleState.messages = roleState.messages.filter((message) => message.id !== loadingId);
        roleState.activeLoadingId = null;
      }
      if (['assistant.completed', 'stage.started', 'tool.requested', 'ui.quick_replies'].includes(event.type)) shouldRender = true;
      applyAgentEvent(event, feedbackTarget);
      if (visuallyAddsMessage) {
        visibleEventCount += 1;
        renderLearningShell();
        window.setTimeout(scrollChatToBottom, 20);
      } else if (completesStream) {
        renderLearningShell();
      }
    }
    roleState.lastAgentRequestError = null;
  } catch (error) {
    roleState.lastAgentRequestError = {
      requestId,
      status: error.status ?? error.statusCode ?? null,
      code: error.code || null,
      retryable: Boolean(error.retryable),
      leaseExpiresAt: error.leaseExpiresAt || null,
    };
    const isToolSubmission = input.type === 'tool_result';
    const isValidation = error.kind === 'validation' || /^(?:STEP_|EVIDENCE_|TASK_)/.test(error.code || '');
    if (isToolSubmission || isValidation) {
      showToast(error.message);
      const task = currentTask();
      taskEvidence(task.id).validationError = error.message;
      shouldRender = true;
    }
    if (feedbackTarget) {
      const feedback = roleState.challengeFeedback?.[feedbackTarget.taskId];
      if (feedback) {
        feedback.status = 'failed';
        feedback.text = error.message || '检查暂未完成，请稍后重试。';
        refreshChallengeFeedback(feedbackTarget.taskId);
      }
    }
    const streamedMessage = roleState.messages.find((message) => message.id === roleState.streamingMessageId);
    if (!isToolSubmission && !isValidation && !streamedMessage?.text) {
      roleState.messages.push({
        id: crypto.randomUUID(),
        type: 'assistant',
        text: '我还在。刚刚连接有点慢，请把这句话再发一次；遇到现场安全问题可以直接呼叫老师。',
        source: '',
      });
    }
    roleState.streamingMessageId = null;
  } finally {
    if (loadingId) roleState.messages = roleState.messages.filter((message) => message.id !== loadingId);
    roleState.activeLoadingId = null;
    state.agentBusy = false;
    if (shouldRender) {
      renderLearningShell();
      window.setTimeout(scrollChatToBottom, 30);
    }
    const queued = state.agentQueue.shift();
    if (queued) window.setTimeout(() => runAgentTurn(queued.input, queued.options), 0);
  }
}

function hasActiveDraft(roleState) {
  const chatDraft = document.querySelector('#chatInput')?.value?.trim();
  const taskDraft = Object.values(roleState.evidence).some((item) => item.text?.trim() || item.files?.length);
  return Boolean(chatDraft || taskDraft);
}

async function sendContextTick() {
  if (!state.currentRoleId || state.screen !== 'learningShell' || state.agentBusy || document.hidden) return;
  const roleState = currentRoleState();
  if (!roleState.agentSessionId) return;
  const remaining = state.phaseEndTime ? Math.max(0, Math.floor((state.phaseEndTime - Date.now()) / 1000)) : null;
  await runAgentTurn({
    type: 'lifecycle_event',
    event: 'context_tick',
    data: {
      clientNow: new Date().toISOString(),
      lastLocalActionAt: roleState.lastLocalActionAt,
      pageVisible: !document.hidden,
      activeTab: state.activeTab,
      learningView: state.learningView,
      hasDraft: hasActiveDraft(roleState),
      phaseRemainingSeconds: remaining,
      arrived: roleState.arrived,
      location: {
        permission: roleState.locationStatus.permission,
        insideFence: roleState.locationStatus.insideFence,
        accuracyMeters: roleState.locationStatus.accuracyMeters,
      },
    },
  }, { passive: true });
  await reportStudentPresence(roleState.agentSessionId, {
    online: navigator.onLine,
    network: navigator.onLine ? (navigator.connection?.effectiveType === '2g' ? 'weak' : 'ready') : 'offline',
    progress: Math.round((roleState.progress / Math.max(1, currentRole().tasks.length)) * 100),
    currentTask: currentTask()?.name,
    evidenceCount: Number(roleState.evidenceCount || 0),
    idleSeconds: Math.max(0, Math.floor((Date.now() - roleState.lastLocalActionAt) / 1000)),
    location: {
      permission: roleState.locationStatus.permission,
      insideFence: roleState.locationStatus.insideFence,
      accuracyMeters: roleState.locationStatus.accuracyMeters ?? undefined,
    },
  }).catch(() => undefined);
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
    try {
      showToast('正在验证你是否进入任务范围…');
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000,
      }));
      const [targetLng, targetLat] = task.location.coordinates;
      const radians = (degrees) => degrees * (Math.PI / 180);
      const dLat = radians(position.coords.latitude - targetLat);
      const dLng = radians(position.coords.longitude - targetLng);
      const value = Math.sin(dLat / 2) ** 2
        + Math.cos(radians(targetLat)) * Math.cos(radians(position.coords.latitude)) * Math.sin(dLng / 2) ** 2;
      const distance = 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
      const insideFence = distance <= Number(task.location.radiusMeters || 50);
      await runAgentTurn({
        type: 'lifecycle_event', event: 'location_updated',
        data: { permission: 'granted', insideFence, accuracyMeters: position.coords.accuracy, lng: position.coords.longitude, lat: position.coords.latitude },
      }, { passive: true, showLoading: false });
      if (!currentRoleState().arrived) return showToast(insideFence ? '定位精度或停留时间还未达到要求，请稍后再试。' : `你距离任务范围约 ${Math.round(distance)} 米。`);
    } catch {
      return showToast('没有取得定位权限，请允许定位或呼叫老师人工确认。');
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

async function completeActivityStep(taskId, stepId) {
  if (state.agentBusy) return showToast(`${PLATFORM_COMPANION.name}正在回应，请稍等一下。`);
  const context = activeStepContext(taskId, stepId);
  if (!context.task || context.expired || !context.step) return showToast('当前小步已经切换，请按新提示继续。');
  const evidence = taskEvidence(taskId);
  const error = context.step.completionMode === 'user_confirm'
    ? ''
    : validateActivityStep({ tools: context.tools, evidence, stepId });
  if (error) {
    evidence.validationError = error;
    renderChat();
    return showToast(error);
  }
  evidence.validationError = '';
  const feedbackTarget = beginChallengeFeedback({
    taskId,
    stepId,
    beforeStepIndex: context.index,
    taskIndex: currentRole().tasks.findIndex((task) => task.id === taskId),
    kind: 'step',
  });
  if (standaloneMode) {
    const roleState = currentRoleState();
    roleState.guidanceStepIndices[taskId] = context.index + 1;
    if (feedbackTarget) {
      roleState.challengeFeedback[taskId] = {
        status: 'passed',
        text: `第 ${context.index + 1} 个任务小步已记录，可以继续下一步。`,
        stepId,
        kind: 'step',
      };
    }
    roleState.messages.push({
      id: crypto.randomUUID(),
      type: 'assistant',
      text: `第 ${context.index + 1} 个任务小步已记录，可以继续下一步。`,
      source: '本地课程包',
    });
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 20);
    return;
  }
  const stepImages = context.step.completionMode === 'ai_evaluation'
    ? context.tools.flatMap((tool) => {
      const value = activityValue(taskId, stepId, tool.id);
      if (tool.id === 'photo') return value.dataUrls || [];
      if (['sketch', 'scanner'].includes(tool.id)) return value.dataUrl ? [value.dataUrl] : [];
      return [];
    }).filter(Boolean)
    : [];
  await runAgentTurn({
    type: 'lifecycle_event',
    event: 'task_step_completed',
    data: {
      taskId,
      stepId,
      stepIndex: context.index,
      stepText: context.step.studentAction || context.step.objective,
      completionMode: context.step.completionMode,
      localEvidenceCount: evidence.imageUrls.length,
      toolValues: serializableToolValues(evidence),
      stepImages,
    },
  }, { feedbackTarget });
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
  const role = currentRole();
  const roleState = currentRoleState();
  const taskIndex = role.tasks.findIndex((task) => task.id === taskId);
  const task = role.tasks[taskIndex];
  const evidence = taskEvidence(taskId);

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
    roleState.progress = taskIndex + 1;
    roleState.challengePageIndex = Math.min(roleState.progress, role.tasks.length - 1);
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
    if (roleState.progress >= role.tasks.length) {
      roleState.completed = true;
      roleState.messages.push({ id: crypto.randomUUID(), type: 'token' });
    } else {
      roleState.messages.push(...currentTaskRecoveryMessages(role, roleState));
    }
    renderLearningShell();
    window.setTimeout(scrollChatToBottom, 30);
    return;
  }
  try {
    await appendGeneratedEvidence(evidence, taskId);
    const uploaded = evidence.files.length ? await Promise.all(evidence.files.map(uploadEvidence)) : [];
    await runAgentTurn({
      type: 'tool_result',
      toolCallId,
      result: { status: 'completed', values: { text: evidence.text || '', toolValues, photoEvidenceCount: evidence.imageUrls.length }, evidence: uploaded },
    }, { feedbackTarget });
  } catch (error) {
    if (feedbackTarget) {
      roleState.challengeFeedback[taskId] = {
        status: 'failed',
        text: error.message || '提交暂未完成，请稍后重试。',
        kind: 'task',
      };
      renderChat();
    }
    showToast(error.message);
  }
}

async function sendMessage() {
  const input = document.querySelector('#chatInput');
  const text = input.value.trim();
  if (!text || !state.currentRoleId) return;
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
  const text = String(value || label || '').trim();
  if (!text || !state.currentRoleId || state.agentBusy) return;
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
  const completedRoles = lesson.roles.filter((role, index) => {
    const actual = state.roleStates[role.id].progress;
    return state.roleStates[role.id].completed || Math.max(actual, state.mockTeamProgress[index]) >= role.tasks.length;
  });
  document.querySelector('#teamMap').src = lesson.assets.navigationMap;
  document.querySelector('#tokenProgress').textContent = `${completedRoles.length} / ${lesson.roles.length}`;
  document.querySelector('#teamTokens').innerHTML = lesson.roles.map((role) => {
    const unlocked = completedRoles.some((item) => item.id === role.id);
    const itemName = lesson.roleSystem.collectionItemName;
    return `<div class="team-token ${unlocked ? '' : 'is-locked'}" title="${escapeHtml(role.name)}${escapeHtml(itemName)}"><img src="${role.collectionItemImage}" alt="${escapeHtml(role.collectionItem)}${escapeHtml(itemName)}${unlocked ? '已获得' : '未获得'}" /></div>`;
  }).join('');

  document.querySelector('#memberList').innerHTML = lesson.roles.map((role, index) => {
    const roleState = state.roleStates[role.id];
    const member = sessionMember(role.id);
    const progress = Math.max(roleState.progress, state.mockTeamProgress[index]);
    const done = roleState.completed || progress >= role.tasks.length;
    return `
      <div class="member-row">
        <img src="${role.badgeImage}" alt="${escapeHtml(role.name)}徽章" />
        <div class="member-copy">
          <strong>${escapeHtml(member?.name || '学习者')} · ${escapeHtml(role.name)}</strong>
          <span>${done ? `${escapeHtml(lesson.roleSystem.itemName)}任务完成，等待汇合` : `正在进行：${escapeHtml(role.tasks[Math.min(progress, role.tasks.length - 1)].name)}`}</span>
        </div>
        <span class="member-progress ${done ? '' : 'is-waiting'}">${done ? `已获${escapeHtml(lesson.roleSystem.collectionItemName)}` : `${progress} / ${role.tasks.length}`}</span>
      </div>
    `;
  }).join('');
}

function renderProgressSheet() {
  if (!state.currentRoleId) return;
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
              <span>${escapeHtml(task.passCondition)}</span>
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
  document.querySelectorAll('.time-bank-entry').forEach((entry) => {
    entry.classList.toggle('is-hidden', !lesson.timeBank.enabled);
  });
  if (!lesson.timeBank.enabled) return;

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
  document.querySelector('#compactRoleList').innerHTML = lesson.roles.map((role) => `
    <div class="compact-role ${role.id === state.currentRoleId ? 'is-current' : ''}">
      <img src="${role.badgeImage}" alt="${escapeHtml(role.name)}徽章" />
      <div><strong>${escapeHtml(role.name)}</strong><span>${escapeHtml(role.tasks[0].name)} · ${role.tasks.length}项任务</span></div>
      <button type="button" data-action="switch-role" data-role-id="${role.id}">${role.id === state.currentRoleId ? '当前角色' : '体验'}</button>
    </div>
  `).join('');
}

async function answerBankTask(taskId, answer) {
  const task = lesson.timeBank.tasks.find((item) => item.id === taskId);
  if (!task || state.completedBankTasks.has(taskId)) return;
  const sessionId = currentRoleState()?.agentSessionId;
  if (!sessionId) return showToast('请先领取角色，再使用时间银行。');
  try {
    const draft = state.bankDrafts[taskId] || {};
    let evidence = [];
    let location;
    if (task.type === 'photo_checkpoint') {
      if (!draft.file) return showToast('请先拍摄一张打卡照片。');
      evidence = [await uploadEvidence(draft.file)];
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
    showToast(error.message);
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
    showToast(error.message);
  }
}

async function callTeacher(addMessage = true) {
  if (standaloneMode) return showToast('当前为本地体验模式，暂未连接教师端。');
  const sessionId = currentRoleState()?.agentSessionId;
  if (!sessionId) return showToast('请先领取角色，再呼叫老师。');
  try {
    await requestTeacherHelp({
      sessionId,
      kind: 'task',
      reason: `学生在「${currentTask()?.name || '当前任务'}」中请求教师帮助。`,
    });
    showToast('老师端已接收，并附带你的位置和当前任务。');
  } catch (error) {
    showToast(error.message);
    return;
  }
  if (!addMessage || !state.currentRoleId) return;
  currentRoleState().messages.push({
    id: crypto.randomUUID(),
    type: 'phase',
    text: '求助已发送 · 老师将看到你的位置、角色和当前任务上下文',
  });
  renderChat();
  window.setTimeout(scrollChatToBottom, 30);
}

function teacherNotice(text) {
  if (!state.currentRoleId) return;
  currentRoleState().messages.push({
    id: crypto.randomUUID(),
    type: 'phase',
    text: `教师提示 · ${text}`,
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
  title.textContent = isRally ? '紧急集合' : command.action === 'pause' ? '课程已暂停' : '教师指令';
  text.textContent = command.payload.message || (command.action === 'pause' ? '请停留在安全位置，等待老师恢复课程。' : '请按照老师的最新指令行动。');
  confirm.textContent = isRally ? '已收到，开始前往集合点' : '我已知道';
  overlay.hidden = false;
  state.activeTeacherCommand = command;
}

async function applyTeacherCommand(command) {
  const roleState = currentRoleState();
  if (!roleState) return;
  if (command.action === 'send_notice' || command.action === 'push_knowledge') {
    teacherNotice(command.payload.text || command.payload.message || '请关注老师的最新提示。');
  } else if (command.action === 'add_time') {
    const minutes = Number(command.payload.amount || 3);
    state.phaseEndTime = (state.phaseEndTime || Date.now()) + (minutes * 60_000);
    teacherNotice(`老师为当前课程阶段追加了 ${minutes} 分钟。`);
  } else if (command.action === 'remove_time') {
    const minutes = Number(command.payload.amount || 1);
    state.phaseEndTime = Math.max(Date.now(), (state.phaseEndTime || Date.now()) - (minutes * 60_000));
    teacherNotice(`老师将当前课程阶段调整了 ${minutes} 分钟。`);
  } else if (command.action === 'set_scaffold') {
    // 把档位真正送到会话上：服务端 participant.learning.scaffoldLevel 只是场次记录里的
    // 展示字段，决定取哪一档提示的是会话上的 scaffoldLevel。
    await runAgentTurn({
      type: 'lifecycle_event',
      event: 'teacher_directive',
      data: { scaffoldLevel: Number(command.payload.level ?? 0), teacherCommandId: command.id },
    });
    teacherNotice('老师已调整后续提示深度。');
  } else if (command.action === 'advance_phase') {
    const phaseId = command.payload.phaseId;
    if (phaseId && lesson.phases.some((phase) => phase.id === phaseId)) {
      await runAgentTurn({
        type: 'lifecycle_event',
        event: 'teacher_directive',
        data: { phaseId, teacherCommandId: command.id },
      });
      state.currentPhaseId = phaseId;
      // 阶段换了，倒计时要按新阶段的时长重开，顶栏也要跟着变。
      beginCurrentPhase();
      renderLearningShell();
    }
    teacherNotice(`老师已推进到${currentPhase()?.name || '下一课程阶段'}。`);
  } else if (command.action === 'approve_evidence') {
    teacherNotice('老师已人工确认当前证据。');
    const task = currentTask();
    const stepIndex = Number(roleState.guidanceStepIndices[task.id] || 0);
    const step = task.steps?.[stepIndex];
    if (step?.completionMode === 'teacher_confirm') {
      await runAgentTurn({
        type: 'lifecycle_event', event: 'task_step_completed',
        data: { taskId: task.id, stepId: step.id, stepIndex, teacherApproved: true, teacherCommandId: command.id },
      });
    }
  } else if (command.action === 'reject_evidence') {
    teacherNotice('老师请你补充或重新提交当前证据。');
  } else if (command.action === 'skip_step') {
    const task = currentTask();
    const stepIndex = Number(roleState.guidanceStepIndices[task.id] || 0);
    const step = task.steps?.[stepIndex];
    if (step) {
      await runAgentTurn({
        type: 'lifecycle_event', event: 'task_step_completed',
        data: { taskId: task.id, stepId: step.id, stepIndex, teacherOverride: true, teacherCommandId: command.id },
      });
      teacherNotice('老师已允许跳过当前小步，系统保留了本次人工干预记录。');
    }
  } else if (command.action === 'advance_task') {
    // 解开 `推进方式：teacher` 的任务。学生做完这类任务后服务端只记 pendingAdvance
    // 不动进度，必须靠这条指令走「学生端作为桥」才能推进（见 server/agent/task-advance.js）。
    // 服务端会校验是否真的在等教师，没等就报错——所以这里不做本地判断，让服务端说话。
    await runAgentTurn({
      type: 'lifecycle_event',
      event: 'teacher_advance_task',
      data: { taskId: roleState.pendingAdvance?.taskId || currentTask()?.id || '', teacherCommandId: command.id },
    });
    teacherNotice('老师已确认，可以进入下一个任务。');
  } else if (['pause', 'emergency_rally'].includes(command.action)) {
    showTeacherDirective(command);
  } else if (command.action === 'resume') {
    document.querySelector('#teacherDirectiveOverlay').hidden = true;
    teacherNotice('老师已恢复课程，可以继续当前任务。');
  } else if (command.action === 'switch_alternative') {
    teacherNotice('现场任务已切换为同目标替代方案，请按新提示继续。');
  }
  await sendTeacherCommandReceipt(roleState.agentSessionId, command.id, 'delivered').catch(() => undefined);
}

async function pollTeacherCommands() {
  const roleState = currentRoleState();
  const sessionId = roleState?.agentSessionId;
  if (!sessionId || document.hidden) return;
  try {
    const result = await getTeacherCommands(sessionId, roleState.teacherCommandSequence);
    for (const command of result.commands) {
      await applyTeacherCommand(command);
      roleState.teacherCommandSequence = Math.max(roleState.teacherCommandSequence, command.sequence || 0);
    }
    roleState.teacherCommandSequence = Math.max(roleState.teacherCommandSequence, result.sequence || 0);
  } catch {
    // Polling is best-effort and resumes when connectivity returns.
  }
}

function releaseRoleAssignment() {
  state.teacherReleasedRoles = true;
  showScreen('roleScreen');
  showToast('老师已开启身份领取。');
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

const actions = {
  'start-course': () => showScreen(standaloneMode || state.teacherReleasedRoles ? 'roleScreen' : 'immersiveScreen'),
  'show-course-info': () => showToast(`${lesson.grades} · ${lesson.duration} · ${lesson.groupRule}`),
  'select-role': (target) => selectRole(target.dataset.roleId),
  'switch-role': (target) => selectRole(target.dataset.roleId),
  'set-learning-view': (target) => setLearningView(target.dataset.learningView),
  'select-challenge-page': (target) => selectChallengePage(Number(target.dataset.pageIndex)),
  'challenge-previous': () => selectChallengePage(currentRoleState().challengePageIndex - 1),
  'challenge-next': () => selectChallengePage(currentRoleState().challengePageIndex + 1),
  'open-role-switch': () => openSheet('roleSwitchSheet'),
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
  'complete-media': (target) => {
    activityValue(target.dataset.taskId, target.dataset.stepId, 'media').completed = true;
    renderChat();
  },
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
  'advance-task': (target) => runAgentTurn({
    type: 'lifecycle_event',
    event: 'student_advance_task',
    data: { taskId: target.dataset.taskId || '' },
  }),
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
    document.querySelector('#teacherDirectiveOverlay').hidden = true;
    state.activeTeacherCommand = null;
    if (command && currentRoleState()?.agentSessionId) {
      await sendTeacherCommandReceipt(currentRoleState().agentSessionId, command.id, 'confirmed').catch(() => undefined);
      showToast('已向老师确认收到。');
    }
  },
  'send-rally': () => showToast('集合点已发送给全组，等待其他成员确认。'),
  'open-quick-tools': () => showToast(`工具会根据当前任务由${PLATFORM_COMPANION.name}主动调用。`),
  'voice-input': startVoiceInput,
};

app.addEventListener('click', (event) => {
  if (state.currentRoleId) currentRoleState().lastLocalActionAt = Date.now();
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
  const action = actions[actionTarget.dataset.action];
  if (action) action(actionTarget);
});

app.addEventListener('input', (event) => {
  if (state.currentRoleId) currentRoleState().lastLocalActionAt = Date.now();
  if (event.target.dataset.bankTaskId) {
    state.bankDrafts[event.target.dataset.bankTaskId] ||= {};
    state.bankDrafts[event.target.dataset.bankTaskId].text = event.target.value;
    return;
  }
  if (event.target.hasAttribute('data-activity-field') && state.currentRoleId) {
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
  if (!taskId || !state.currentRoleId) return;
  taskEvidence(taskId).text = event.target.value;
  taskEvidence(taskId).validationError = '';
});

app.addEventListener('change', async (event) => {
  if (state.currentRoleId) currentRoleState().lastLocalActionAt = Date.now();
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
    void scanImageFile(event.target.dataset.taskId, event.target.dataset.stepId, file);
    return;
  }
  const taskId = event.target.dataset.taskFile;
  let files = [...(event.target.files || [])];
  if (!taskId || !files.length || !state.currentRoleId) return;
  const evidence = taskEvidence(taskId);
  let value = null;
  const toolStepId = event.target.dataset.toolStep;
  try {
    if (toolStepId) {
      value = activityValue(taskId, toolStepId, 'photo');
      const { tools } = activeStepContext(taskId, toolStepId);
      const maximum = Number(tools?.find((tool) => tool.id === 'photo')?.config?.maxCount || 6);
      const remaining = Math.max(0, maximum - Number(value.count || 0));
      if (!remaining) return showToast(`本小步最多提交 ${maximum} 张照片。`);
      if (files.length > remaining) {
        files = files.slice(0, remaining);
        showToast(`本次保留 ${remaining} 张，已达到本小步上限。`);
      }
    }

    const imageUrls = files.map((file) => URL.createObjectURL(file));
    evidence.imageUrls.push(...imageUrls);
    evidence.files.push(...files);
    evidence.validationError = '';
    if (value) {
      value.imageUrls ||= [];
      value.imageUrls.push(...imageUrls);
      value.count = value.imageUrls.length;
      value.processing = true;
    }
    renderChat();
    window.setTimeout(scrollChatToBottom, 20);
    if (value) {
      value.dataUrls ||= [];
      value.dataUrls.push(...await Promise.all(files.map(optimizedImageDataUrl)));
      value.processing = false;
      renderChat();
    }
  } catch (error) {
    if (value) value.processing = false;
    evidence.validationError = '照片已选择，但预览处理遇到问题。请再试一次，或先继续完成文字记录。';
    renderLearningShell();
    showToast(error?.message || '照片处理遇到问题，请再试一次。');
  } finally {
    event.target.value = '';
  }
});

app.addEventListener('ended', (event) => {
  if (!event.target.hasAttribute('data-activity-media')) return;
  activityValue(event.target.dataset.taskId, event.target.dataset.stepId, 'media').completed = true;
}, true);

app.addEventListener('dragstart', (event) => {
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
  const itemId = event.dataTransfer?.getData('text/plain') || draggedBuilderItem;
  placeBuilderItem(zone.dataset.taskId, zone.dataset.stepId, zone.dataset.builderZone, itemId);
  draggedBuilderItem = null;
});

document.querySelector('#chatInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
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
