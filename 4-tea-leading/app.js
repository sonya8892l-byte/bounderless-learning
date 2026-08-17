import { fitTeacherMap, mountTeacherMap, resizeTeacherMap } from './amap-service.js';
import {
  clearTeacherCredential,
  hasTeacherCredential,
  storeTeacherCredential,
  teacherAccessStateForStatus,
  teacherAuthenticatedFetch,
  TEACHER_ACCESS_EVENT,
} from './teacher-auth.js';
import {
  clearTeacherSnapshots,
  loadTeacherSnapshot,
  saveTeacherSnapshot,
  buildStudentJoinUrl,
  resolveStudentAppBase,
} from './teacher-session-data.js';

const API = '/api';
const TEACHER_ID = 'teacher-demo';
const configuredRealtimeMode = String(globalThis.__TEACHER_APP_CONFIG__?.REALTIME_MODE || 'polling').trim().toLowerCase();
const REALTIME_MODE = configuredRealtimeMode === 'websocket' ? 'websocket' : 'polling';
// advance_task 真会推进学生进度（解开 `推进方式：teacher` 的任务），与 skip_step 同级需要二次确认。
const HIGH_IMPACT = new Set(['pause', 'start_phase', 'advance_phase', 'end_run', 'approve_evidence', 'skip_step', 'advance_task', 'emergency_rally']);
const ACTION_LABELS = {
  send_notice: '发送教师提示', push_knowledge: '推送知识卡', add_time: '追加时间',
  remove_time: '减少时间', pause: '暂停课程', resume: '恢复课程', release_roles: '开启角色领取',
  lock_roles: '锁定角色', start_phase: '开始课程阶段', advance_phase: '推进至下一阶段',
  end_run: '结束场次', confirm_arrival: '确认到达', reject_evidence: '退回证据',
  approve_evidence: '人工通过', skip_step: '跳过可选小步', advance_task: '确认进入下一任务',
  set_scaffold: '调整提示等级',
  switch_alternative: '切换替代任务', emergency_rally: '紧急集合',
};

const state = {
  runs: [], runId: null, snapshot: null, review: null, activeView: 'live',
  pendingCommand: null, socket: null, pollTimer: null, refreshTimer: null, toastTimer: null,
  mapUnavailable: false, locationListVisible: false,
  connected: true, eventSequence: 0, commandLedger: {},
  commandFeedExpanded: false, lastReceiptAnnouncement: '',
  accessState: 'connecting', bootstrapInFlight: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function participantClaimedRole(participant = {}) {
  const claimedRoleId = String(participant.claimedRoleId || '').trim();
  const roleId = String(participant.roleId || '').trim();
  const roleClaimed = claimedRoleId
    ? true
    : participant.device && Object.hasOwn(participant.device, 'roleClaimed')
      ? participant.device.roleClaimed === true
      : Boolean(roleId);
  if (!roleClaimed) return null;
  return {
    id: claimedRoleId || roleId,
    name: String(participant.roleName || '').trim() || claimedRoleId || roleId,
  };
}

function participantRoleLabel(participant) {
  return participantClaimedRole(participant)?.name || '待领取';
}

function participantRoleSeal(participant) {
  return participantClaimedRole(participant)?.name.slice(0, 1) || '待';
}

function participantGroupLabel(participant = {}) {
  return String(participant.groupName || participant.groupId || '未分组').trim();
}

function participantHasLearningActivity(participant = {}, alerts = []) {
  const learning = participant.learning || {};
  const device = participant.device || {};
  const location = participant.location || {};
  const hasOpenAlert = alerts.some((alert) => alert.participantId === participant.id);
  return Boolean(
    String(participant.learnerSessionId || '').trim()
    || String(participant.roleId || participant.roleName || '').trim()
    || device.roleClaimed === true
    || participant.online === true
    || participant.presenceObservedAt
    || participant.locationObservedAt
    || participant.latestDirective
    || device.loggedIn === true
    || !['', 'offline', 'unknown'].includes(String(device.network || ''))
    || !['', 'unknown'].includes(String(device.location || ''))
    || !['', 'unknown'].includes(String(device.camera || ''))
    || device.cameraObservedAt
    || location.observedAt
    || location.lng != null
    || location.lat != null
    || location.accuracyMeters != null
    || location.insideFence != null
    || !['', 'unknown'].includes(String(location.permission || ''))
    || Number(learning.progress || 0) > 0
    || Number(learning.evidenceCount || 0) > 0
    || Number(learning.scaffoldLevel || 0) > 0
    || Number(learning.timeBalance || 0) > 0
    || Boolean(String(learning.dialogueSummary || '').trim())
    || Boolean(String(learning.currentTaskId || learning.currentStepId || '').trim())
    || learning.lastMeaningfulActionAt
    || hasOpenAlert
  );
}

function formatTime(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 10) return '刚刚';
  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  return `${Math.floor(seconds / 3600)}小时前`;
}

function commandLedgerStorageKey(runId = state.runId) {
  return `teacher-command-ledger:${runId}`;
}

function loadCommandLedger(runId = state.runId) {
  if (!runId) return {};
  try {
    const raw = localStorage.getItem(commandLedgerStorageKey(runId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCommandLedger() {
  if (!state.runId) return;
  localStorage.setItem(commandLedgerStorageKey(), JSON.stringify(state.commandLedger));
}

function targetScopeLabel(target = {}) {
  if (target.scope === 'all') return '全班';
  if (target.scope === 'group') return '所选小组';
  if (target.scope === 'role') return '所选角色';
  if (target.scope === 'participant') return '所选学生';
  return '目标对象';
}

function upsertCommandRecord(record = {}) {
  if (!record.id) return;
  const existing = state.commandLedger[record.id] || { receipts: {} };
  state.commandLedger[record.id] = {
    ...existing,
    ...record,
    receipts: { ...existing.receipts, ...(record.receipts || {}) },
    total: Math.max(Number(existing.total || 0), Number(record.total || 0), Object.keys({ ...existing.receipts, ...(record.receipts || {}) }).length),
  };
  saveCommandLedger();
}

function upsertCommandFromSendResult(result = {}) {
  const receipts = {};
  for (const receipt of result.receipts || []) receipts[receipt.participantId] = receipt.status;
  upsertCommandRecord({
    id: result.id,
    action: result.action,
    target: result.target,
    reason: result.reason,
    createdAt: result.createdAt,
    total: (result.receipts || []).length,
    receipts,
  });
}

function applyCommandEvent(event = {}) {
  if (event.type === 'teacher.command.accepted') {
    upsertCommandRecord({
      id: event.data?.commandId,
      action: event.data?.action,
      createdAt: event.createdAt,
      receipts: {},
    });
    return;
  }
  if (event.type !== 'teacher.command.receipt') return;
  const { commandId, participantId, status } = event.data || {};
  if (!commandId || !participantId) return;
  const existing = state.commandLedger[commandId] || { id: commandId, receipts: {}, createdAt: event.createdAt };
  existing.receipts[participantId] = status;
  existing.total = Math.max(Number(existing.total || 0), Object.keys(existing.receipts).length);
  upsertCommandRecord(existing);
}

function summarizeReceipts(command = {}, connected = state.connected && navigator.onLine) {
  if (!connected) {
    return { text: '状态未知', tone: 'unknown', parts: [{ key: 'unknown', text: '状态未知' }] };
  }
  const statuses = Object.values(command.receipts || {});
  const total = Math.max(Number(command.total || 0), statuses.length);
  const delivered = statuses.filter((status) => status === 'delivered' || status === 'confirmed').length;
  const confirmed = statuses.filter((status) => status === 'confirmed').length;
  const failed = statuses.filter((status) => status === 'failed').length;
  const acceptedOnly = total > 0 && statuses.length === total && statuses.every((status) => status === 'accepted');
  const parts = [];
  if (acceptedOnly) parts.push({ key: 'accepted', text: `已下发 ${total}/${total}` });
  else {
    if (delivered > 0 || total > 0) parts.push({ key: 'delivered', text: `已送达 ${delivered}/${total || '?'}` });
    if (confirmed > 0) parts.push({ key: 'confirmed', text: `已确认 ${confirmed}/${total || '?'}` });
    if (failed > 0) parts.push({ key: 'failed', text: `失败 ${failed}` });
    if (!parts.length && total > 0) parts.push({ key: 'accepted', text: `已下发 ${total}/${total}` });
  }
  return {
    text: parts.map((part) => part.text).join(' · ') || '等待回执',
    tone: failed > 0 ? 'failed' : (confirmed > 0 ? 'confirmed' : (delivered > 0 ? 'delivered' : 'accepted')),
    parts,
    total,
    delivered,
    confirmed,
    failed,
  };
}

async function syncCommandEvents() {
  if (!state.runId) return;
  try {
    const events = await request(`/teacher/runs/${encodeURIComponent(state.runId)}/events?after=${state.eventSequence}`);
    for (const event of events) {
      applyCommandEvent(event);
      state.eventSequence = Math.max(state.eventSequence, Number(event.sequence || 0));
    }
    if (state.snapshot?.sequence) {
      state.eventSequence = Math.max(state.eventSequence, Number(state.snapshot.sequence));
    }
  } catch {
    // 快照缓存仍可显示；回执状态在离线时不误报失败。
  }
}

async function hydrateCommandLedgerFromReview() {
  if (!state.runId) return;
  try {
    const review = await request(`/teacher/runs/${encodeURIComponent(state.runId)}/review`);
    for (const item of review.interventions || []) {
      upsertCommandRecord({
        id: item.commandId,
        action: item.action,
        target: item.target,
        reason: item.reason,
        createdAt: item.createdAt,
      });
    }
  } catch {
    // 干预时间线不可用时不阻塞主界面。
  }
}

function ensureCommandFeedMount() {
  if ($('#commandFeed')) return;
  const mount = document.createElement('section');
  mount.id = 'commandFeed';
  mount.className = 'command-feed';
  mount.setAttribute('aria-labelledby', 'commandFeedTitle');
  mount.innerHTML = `
    <div class="command-feed__bar">
      <div>
        <h2 id="commandFeedTitle">指令回执</h2>
        <p class="command-feed__summary" id="commandFeedSummary">暂无指令回执</p>
      </div>
      <button class="command-feed__toggle" id="commandFeedToggle" type="button" data-action="toggle-command-feed" aria-expanded="false" aria-controls="commandFeedHistory">
        <span id="commandFeedToggleLabel">查看历史</span>
        <span class="command-feed__chevron" aria-hidden="true">⌄</span>
      </button>
    </div>
    <div class="command-feed__history" id="commandFeedHistory" hidden>
      <div class="command-feed__list" id="commandFeedList" role="list"></div>
    </div>
    <p class="command-feed__announcer visually-hidden" id="commandReceiptAnnouncer" aria-live="polite" aria-atomic="true"></p>`;
  $('#statusStrip')?.insertAdjacentElement('afterend', mount);
}

function renderCommandFeed() {
  ensureCommandFeedMount();
  const mount = $('#commandFeed');
  const list = $('#commandFeedList');
  const history = $('#commandFeedHistory');
  const summaryText = $('#commandFeedSummary');
  const toggle = $('#commandFeedToggle');
  const toggleLabel = $('#commandFeedToggleLabel');
  if (!mount || !list || !history || !summaryText || !toggle || !toggleLabel) return;
  const allCommands = Object.values(state.commandLedger)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const commands = allCommands.slice(0, 8);
  const expanded = state.commandFeedExpanded && commands.length > 0;
  mount.classList.toggle('is-expanded', expanded);
  history.hidden = !expanded;
  toggle.disabled = commands.length === 0;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggleLabel.textContent = commands.length === 0
    ? '暂无历史'
    : expanded
      ? '收起'
      : `历史 ${commands.length}`;
  if (!commands.length) {
    summaryText.textContent = '发出指令后，这里会显示送达与确认状态';
    list.innerHTML = '';
    return;
  }
  const latest = commands[0];
  const latestSummary = summarizeReceipts(latest);
  summaryText.textContent = `${ACTION_LABELS[latest.action] || latest.action} · ${latestSummary.text} · ${relativeTime(latest.createdAt)}`;
  list.innerHTML = expanded ? commands.map((command) => {
    const summary = summarizeReceipts(command);
    const highImpact = HIGH_IMPACT.has(command.action);
    const label = ACTION_LABELS[command.action] || command.action;
    return `<button class="command-card ${highImpact ? 'is-high-impact' : ''}" type="button" role="listitem" data-action="open-command" data-command-id="${escapeHtml(command.id)}" data-receipt-tone="${summary.tone}">
      <div class="command-card__top">
        <div>
          ${highImpact ? '<span class="command-impact-tag">高影响</span>' : ''}
          <strong>${escapeHtml(label)}</strong>
          <span class="command-card__meta">${escapeHtml(targetScopeLabel(command.target))} · ${relativeTime(command.createdAt)}</span>
        </div>
        <span class="receipt-badge receipt-badge--${summary.tone}" aria-hidden="true">${summary.parts.map((part) => part.text).join(' · ') || '状态未知'}</span>
      </div>
      <p class="command-card__summary">${escapeHtml(summary.text)}</p>
    </button>`;
  }).join('') : '';
  const announcement = `${ACTION_LABELS[latest.action] || latest.action} ${latestSummary.text}`;
  if (announcement !== state.lastReceiptAnnouncement) {
    state.lastReceiptAnnouncement = announcement;
    const announcer = $('#commandReceiptAnnouncer');
    if (announcer) announcer.textContent = announcement;
  }
}

function renderCommandDrawer(commandId) {
  const command = state.commandLedger[commandId];
  if (!command) return;
  const summary = summarizeReceipts(command);
  const label = ACTION_LABELS[command.action] || command.action;
  const highImpact = HIGH_IMPACT.has(command.action);
  const participants = state.snapshot?.participants || [];
  const rows = Object.entries(command.receipts || {}).map(([participantId, status]) => {
    const participant = participants.find((item) => item.id === participantId);
    const statusLabel = {
      accepted: '已下发',
      delivered: '已送达',
      confirmed: '已确认',
      failed: '失败',
    }[status] || status;
    return `<div class="receipt-row"><strong>${escapeHtml(participant?.name || participantId)}</strong><span class="receipt-badge receipt-badge--${status}">${statusLabel}</span></div>`;
  }).join('');
  openDrawer({
    eyebrow: highImpact ? '高影响指令' : '指令详情',
    title: label,
    html: `
      <div class="detail-block">
        <p>${escapeHtml(command.reason || '未记录操作原因')}</p>
        <div class="metric-grid">
          <div class="metric"><span>作用范围</span><strong>${escapeHtml(targetScopeLabel(command.target))}</strong></div>
          <div class="metric"><span>发送时间</span><strong>${relativeTime(command.createdAt)}</strong></div>
        </div>
        <p class="command-detail-summary receipt-badge receipt-badge--${summary.tone}">${escapeHtml(summary.text)}</p>
      </div>
      <div class="detail-block"><h3>回执明细</h3><div class="receipt-list">${rows || '<p class="command-feed__empty">还没有学生端回执；服务端已接单时会显示为已下发。</p>'}</div></div>`,
  });
}

async function request(path, options = {}) {
  const response = await teacherAuthenticatedFetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      'x-teacher-id': TEACHER_ID,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const accessState = teacherAccessStateForStatus(response.status);
    const error = Object.assign(new Error(accessState?.message || body.error || `请求失败（${response.status}）`), {
      status: response.status,
      details: body.details,
      accessState,
    });
    throw error;
  }
  return body;
}

function stopTeacherRuntime() {
  clearInterval(state.pollTimer);
  clearTimeout(state.refreshTimer);
  state.pollTimer = null;
  state.refreshTimer = null;
  state.socket?.close();
  state.socket = null;
}

function showTeacherAccessState(accessState = {}) {
  const kind = accessState.kind || 'credential-required';
  state.accessState = kind;
  stopTeacherRuntime();
  clearTeacherSnapshots();
  state.snapshot = null;
  state.review = null;
  const gate = $('#teacherAccessGate');
  const form = $('#teacherAccessForm');
  const configActions = $('#teacherConfigActions');
  const isConfigurationIssue = kind === 'server-configuration';
  $('#teacherAccessEyebrow').textContent = isConfigurationIssue ? '服务器配置' : '教师安全会话';
  $('#teacherAccessTitle').textContent = isConfigurationIssue ? '教师端认证尚未就绪' : '输入教师访问凭证';
  $('#teacherAccessDescription').textContent = accessState.message
    || (isConfigurationIssue
      ? '请联系管理员完成服务器认证配置。'
      : '预览和正式环境需要教师访问凭证。');
  form.hidden = isConfigurationIssue;
  configActions.hidden = !isConfigurationIssue;
  gate.hidden = false;
  $('.app-main')?.setAttribute('inert', '');
  $('.bottom-nav')?.setAttribute('inert', '');
  if (!isConfigurationIssue) window.setTimeout(() => $('#teacherCredential')?.focus(), 0);
}

function hideTeacherAccessState() {
  state.accessState = 'ready';
  $('#teacherAccessGate').hidden = true;
  $('.app-main')?.removeAttribute('inert');
  $('.bottom-nav')?.removeAttribute('inert');
  $('#endTeacherSession').hidden = !hasTeacherCredential();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function showView(view) {
  state.activeView = view;
  $$('.app-view').forEach((node) => node.classList.toggle('is-active', node.dataset.view === view));
  $$('[data-nav]').forEach((node) => node.classList.toggle('is-active', node.dataset.nav === view));
  if (view === 'review') loadReview();
  if (view === 'live') window.requestAnimationFrame(resizeTeacherMap);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openDrawer({ eyebrow = '详情', title, html }) {
  $('#drawerEyebrow').textContent = eyebrow;
  $('#drawerTitle').textContent = title;
  $('#drawerBody').innerHTML = html;
  $('#backdrop').hidden = false;
  const drawer = $('#detailDrawer');
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeLayer() {
  $('#backdrop').hidden = true;
  $('#confirmDialog').hidden = true;
  const drawer = $('#detailDrawer');
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  state.pendingCommand = null;
}

async function bootstrap() {
  if (state.bootstrapInFlight) return;
  state.bootstrapInFlight = true;
  try {
    state.runs = await request('/teacher/runs');
    if (!state.runs.length) {
      try {
        const demo = await request('/teacher/demo', { method: 'POST', body: '{}' });
        state.runs = [demo];
      } catch (error) {
        // Preview / Production 不注册 demo 路由。合法的空账号应进入场次中心创建第一课，
        // 不把预期的 404 误报为鉴权或服务故障。
        if (error.status !== 404) throw error;
      }
    }
    if (!state.runs.length) {
      state.runId = null;
      state.snapshot = null;
      hideTeacherAccessState();
      $('#runSummary').textContent = '还没有课程场次。创建后先完成课前检查，再手动开始场次。';
      $('#runList').innerHTML = '<div class="empty-state"><strong>创建第一个课程场次</strong><p>名单、分组、设备和地图检查通过后，教师可以在遥控器中正式开始。</p><button class="primary-button" type="button" data-action="new-run">创建场次</button></div>';
      showView('runs');
      return;
    }
    state.runId = state.runs.find((run) => run.status === 'active')?.id || state.runs[0].id;
    state.commandLedger = loadCommandLedger(state.runId);
    state.eventSequence = 0;
    await hydrateCommandLedgerFromReview();
    await refreshSnapshot();
    hideTeacherAccessState();
    connectRealtime();
    clearInterval(state.pollTimer);
    state.pollTimer = window.setInterval(refreshSnapshot, 5000);
  } catch (error) {
    if (error.accessState) return;
    showToast(error.message);
    renderFatal(error.message);
  } finally {
    state.bootstrapInFlight = false;
  }
}

async function refreshSnapshot() {
  if (!state.runId) return;
  try {
    state.snapshot = await request(`/teacher/runs/${encodeURIComponent(state.runId)}/snapshot`);
    state.runs = await request('/teacher/runs');
    await syncCommandEvents();
    renderAll();
    if (REALTIME_MODE === 'polling') setConnection(true);
    saveTeacherSnapshot(state.runId, state.snapshot);
  } catch (error) {
    const cached = loadTeacherSnapshot(state.runId);
    if (cached && !state.snapshot) state.snapshot = cached;
    setConnection(false);
    if (state.snapshot) renderAll();
  }
}

function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(refreshSnapshot, 180);
}

function connectRealtime() {
  state.socket?.close();
  state.socket = null;
  // Browser WebSocket 无法设置 Authorization header。有 Bearer 会话时保留安全的 5 秒轮询，
  // 不将凭证放进 URL query 或 WebSocket subprotocol。
  if (REALTIME_MODE !== 'websocket' || !state.runId || hasTeacherCredential()) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}${API}/teacher/runs/${encodeURIComponent(state.runId)}/live`);
  state.socket = socket;
  socket.addEventListener('open', () => {
    if (state.socket === socket) setConnection(true);
  });
  socket.addEventListener('message', scheduleRefresh);
  socket.addEventListener('close', () => {
    if (state.socket === socket) setConnection(false);
  });
  socket.addEventListener('error', () => {
    if (state.socket === socket) setConnection(false);
  });
}

function setConnection(connected) {
  state.connected = connected && navigator.onLine;
  $('#offlineBanner').hidden = state.connected;
  $('#syncButton').classList.toggle('is-stale', !state.connected);
  $('#syncLabel').textContent = state.connected ? '刚刚同步' : '数据可能过期';
  renderCommandFeed();
}

function renderAll() {
  if (!state.snapshot) return;
  renderRuns();
  renderLive();
  renderAlerts();
  renderCommandFeed();
}

function renderRuns() {
  const activeCount = state.runs.filter((run) => run.status === 'active').length;
  $('#runSummary').textContent = `${state.runs.length} 个场次 · ${activeCount} 个正在进行，进行中场次已置顶。`;
  $('#runList').innerHTML = state.runs.map((run) => `
    <article class="run-card ${run.status === 'active' ? 'is-active' : ''}">
      <div class="run-card__top">
        <div><span class="status-tag ${escapeHtml(run.status)}">${run.status === 'active' ? '进行中' : run.status === 'completed' ? '已结束' : '待开始'}</span><h3>${escapeHtml(run.className)}</h3></div>
        <strong>${escapeHtml(run.entryCode)}</strong>
      </div>
      <p>${escapeHtml(run.courseTitle)} · ${escapeHtml(run.courseVersion)}</p>
      <div class="run-card__meta">
        <div><span>小组</span><strong>${run.groupCount}</strong></div>
        <div><span>当前阶段</span><strong>${escapeHtml(run.phaseName)}</strong></div>
        <div><span>入课码</span><strong>${escapeHtml(run.entryCode)}</strong></div>
      </div>
      <div class="run-card__actions">
        <button class="outline-button" type="button" data-action="preflight" data-run-id="${run.id}">课前检查</button>
        ${run.experiencePack ? `<button class="outline-button" type="button" data-action="copy-join-link" data-run-id="${run.id}">复制体验学生链接</button>` : ''}
        <button class="primary-button" type="button" data-action="switch-run" data-run-id="${run.id}">${run.id === state.runId ? '进入当前场次' : '打开场次'}</button>
      </div>
    </article>
  `).join('');
}

function renderLive() {
  const { run, summary, groups, participants, alerts } = state.snapshot;
  $('#liveTitle').textContent = run.courseTitle;
  $('#livePhase').textContent = `${run.phaseName}${run.paused ? ' · 已暂停' : ' · 进行中'}`;
  $('#statusStrip').innerHTML = `
    <div class="status-item"><span>阶段剩余</span><strong>${formatTime(run.phaseRemainingSeconds)}</strong></div>
    <div class="status-item"><span>在线</span><strong>${summary.online}/${summary.total}</strong></div>
    <div class="status-item is-alert"><span>待处理</span><strong>${summary.pending}${summary.p0 ? ` · P0 ${summary.p0}` : ''}</strong></div>
    <div class="status-item"><span>平均进度</span><strong>${summary.averageProgress}%</strong></div>`;
  renderMarkers(groups, participants, alerts);
  $('#groupList').innerHTML = groups.map((group, index) => `
    <button class="group-card ${group.collectionReady ? 'is-collection-ready' : ''}" type="button" data-action="open-group" data-group-id="${group.id}">
      <span class="group-index">${index + 1}</span>
      <span class="group-copy"><strong>${escapeHtml(group.name)}</strong><p>${group.onlineCount}/${group.members.length}人在线 · 角色任务 ${group.collectionCount}/${group.collectionTotal}${group.collectionReady ? ' · 密符已集齐' : ''}</p></span>
      <span class="group-meta"><strong class="${group.highestSeverity === 'P0' ? 'is-danger' : ''}">${group.alertCount ? `${group.highestSeverity} · ${group.alertCount}` : group.collectionReady ? '待教师核对' : `${group.progress}%`}</strong><span>${formatTime(group.timeRemainingSeconds)}</span></span>
    </button>`).join('');
  const fallback = $('#locationFallback');
  fallback.innerHTML = groups.map((group) => `
    <div class="fallback-row"><strong>${escapeHtml(group.name)}</strong><span>${group.onlineCount}/${group.members.length}在线 · ${group.alertCount}个异常</span></div>`).join('');
  fallback.hidden = !(state.mapUnavailable || state.locationListVisible);
}

async function renderMarkers(groups, participants, alerts) {
  const renderedRunId = state.runId;
  const ready = await mountTeacherMap($('#teacherMap'), {
    runId: renderedRunId,
    mapCenter: state.snapshot.run.mapCenter,
    groups,
    participants: participants.map((participant) => ({
      ...participant,
      roleName: participantRoleLabel(participant),
    })),
    alerts,
    onOpenGroup: renderGroupDrawer,
    onOpenParticipant: renderStudentDrawer,
  });
  if (renderedRunId !== state.runId) return;
  state.mapUnavailable = !ready;
  $('#locationFallback').hidden = !(state.mapUnavailable || state.locationListVisible);
}

function renderAlerts() {
  const alerts = state.snapshot.alerts;
  $('#alertCount').textContent = alerts.length;
  $('#alertNavBadge').hidden = !alerts.length;
  $('#alertNavBadge').textContent = alerts.length;
  $('#alertList').innerHTML = alerts.length ? alerts.map((alert) => {
    const participant = state.snapshot.participants.find((item) => item.id === alert.participantId);
    const group = state.snapshot.groups.find((item) => item.id === alert.groupId);
    return `<button class="alert-card" data-severity="${alert.severity}" type="button" data-action="open-alert" data-alert-id="${alert.id}">
      <div class="alert-card__top"><div><span class="severity">${alert.severity}</span><h3>${escapeHtml(alert.title)}</h3></div><span class="status-tag ${alert.status}">${alert.status === 'open' ? '待处理' : alert.status === 'acknowledged' ? '已接单' : '处理中'}</span></div>
      <p>${escapeHtml(alert.context?.message || '')}</p>
      <div class="alert-card__meta">${escapeHtml(participant?.name || '系统')} · ${escapeHtml(group?.name || '全班')} · ${relativeTime(alert.createdAt)}</div>
    </button>`;
  }).join('') : '<div class="empty-state"><strong>当前没有待处理事件</strong><p>全班仍在正常推进，地图会继续监测位置与任务状态。</p></div>';
}

function renderGroupDrawer(groupId) {
  const group = state.snapshot.groups.find((item) => item.id === groupId);
  if (!group) return;
  const blockers = group.members.filter((item) => item.positionStatus !== 'fresh' || item.learning.idleSeconds > 180);
  openDrawer({ eyebrow: '小组详情', title: group.name, html: `
    <div class="detail-block"><div class="metric-grid">
      <div class="metric"><span>小组进度</span><strong>${group.progress}%</strong></div>
      <div class="metric"><span>密符进度</span><strong>${group.collectionCount}/${group.collectionTotal}</strong></div>
      <div class="metric"><span>剩余时间</span><strong>${formatTime(group.timeRemainingSeconds)}</strong></div>
      <div class="metric"><span>时间银行</span><strong>${group.bankBalance} min</strong></div>
      <div class="metric"><span>阻断项</span><strong>${blockers.length}</strong></div>
    </div></div>
    <div class="detail-block"><h3>${group.collectionReady ? '密符已集齐' : '密符尚未集齐'}</h3><p>${group.collectionReady ? '请核对小组当前阶段的证据与拼合结果，再使用教学遥控器手动推进。阶段不会自动改变。' : `已有 ${group.collectionCount} 个角色完成全部任务；请继续关注未完成成员。`}</p></div>
    <div class="detail-block"><h3>六名组员与角色</h3><div class="member-list">${group.members.map(memberRow).join('')}</div></div>
    <div class="detail-block"><h3>小组干预</h3><div class="action-grid">
      ${actionButton('send_notice', '发送提示', '进入全组学生对话', { scope: 'group', id: group.id }, { text: '请回到当前任务，检查小组是否还缺一项关键证据。' })}
      ${actionButton('switch_alternative', '替代任务', '切换同目标离线方案', { scope: 'group', id: group.id }, { alternative: 'offline-equivalent' })}
      ${actionButton('pause', '暂停课程', '暂停全班任务计时', { scope: 'all' }, {}, true)}
    </div></div>` });
}

function memberRow(participant) {
  const roleLabel = participantRoleLabel(participant);
  return `<button class="member-row" type="button" data-action="open-student" data-participant-id="${participant.id}">
    <span class="role-seal">${escapeHtml(participantRoleSeal(participant))}</span>
    <span><strong>${escapeHtml(participant.name)}</strong><span>${escapeHtml(roleLabel)} · ${escapeHtml(participant.learning.currentTask)}</span></span>
    <strong>${participant.learning.progress}%</strong></button>`;
}

function renderStudentDrawer(participantId) {
  const participant = state.snapshot.participants.find((item) => item.id === participantId);
  if (!participant) return;
  const roleLabel = participantRoleLabel(participant);
  const groupLabel = state.snapshot.groups.find((item) => item.id === participant.groupId)?.name
    || participantGroupLabel(participant);
  const hasLearningActivity = participantHasLearningActivity(participant, state.snapshot.alerts);
  const ageLabel = participant.positionStatus === 'fresh' ? `${participant.positionAgeSeconds}秒前更新` : `位置可能过期 · ${Math.floor(participant.positionAgeSeconds / 60)}分钟前`;
  const teacherApprovalAllowed = participant.learning.teacherApprovalAllowed === true;
  const teacherApprovalDescription = participant.learning.teacherApprovalKind === 'ai_max_attempts'
    ? `AI 已达到最大尝试次数（${participant.learning.currentStepAttempts}/${participant.learning.currentStepMaxAttempts}），确认通过当前小步`
    : participant.learning.teacherApprovalKind === 'task_teacher_confirm'
      ? '完成教师终审并确认当前任务'
      : '确认通过当前小步';
  const awaitingTeacherAdvance = participant.learning.pendingAdvanceMode === 'teacher';
  const interventionStatus = teacherApprovalAllowed
    ? '当前可以人工通过。'
    : awaitingTeacherAdvance
      ? '当前任务已完成，等待老师确认进入下一任务。'
      : '学生仍在完成当前小步，暂不需要教师推进。';
  openDrawer({ eyebrow: `${roleLabel} · ${groupLabel}`, title: participant.name, html: `
    <div class="detail-block"><div class="metric-grid">
      <div class="metric"><span>当前任务</span><strong>${escapeHtml(participant.learning.currentTask)}</strong></div>
      <div class="metric"><span>学习进度</span><strong>${participant.learning.progress}%</strong></div>
      <div class="metric"><span>提示等级</span><strong>L${participant.learning.scaffoldLevel}</strong></div>
      <div class="metric"><span>位置精度</span><strong>±${participant.location.accuracyMeters}m</strong></div>
    </div><p class="alert-card__meta">${ageLabel}</p></div>
    <div class="detail-block"><h3>入课</h3><p>专属链接只在复制时向服务端领取，不会写入页面或快照缓存。</p>
      <button class="outline-button" type="button" data-action="copy-join-link" data-participant-id="${escapeHtml(participant.id)}">复制学习链接</button>
    </div>
    <div class="detail-block"><h3>AI对话摘要</h3><p>${escapeHtml(participant.learning.dialogueSummary)}</p><button class="outline-button" type="button" data-action="request-transcript" data-participant-id="${participant.id}">按授权查看原文</button></div>
    <div class="detail-block"><h3>任务与证据</h3><p>${escapeHtml(participant.learning.currentStepName || participant.learning.stepName)} · 已提交 ${participant.learning.evidenceCount} 项证据</p><p class="alert-card__meta">${escapeHtml(interventionStatus)}</p></div>
    <div class="detail-block"><h3>学生干预</h3><div class="action-grid">
      ${actionButton('send_notice', '教师提示', '明确标注教师来源', { scope: 'participant', id: participant.id }, { text: '我看到你的尝试了，请先选择一条最有把握的证据继续。' })}
      ${actionButton('set_scaffold', '增强提示', '调整为L2', { scope: 'participant', id: participant.id }, { level: 2 })}
      ${actionButton('confirm_arrival', '确认到达', '教师人工确认位置', { scope: 'participant', id: participant.id })}
      ${teacherApprovalAllowed ? actionButton('approve_evidence', '人工通过', teacherApprovalDescription, { scope: 'participant', id: participant.id }, {}, true) : ''}
      ${participant.learning.teacherApprovalKind === 'task_teacher_confirm' ? actionButton('reject_evidence', '退回补做', '要求补充证据', { scope: 'participant', id: participant.id }) : ''}
      ${awaitingTeacherAdvance ? actionButton('advance_task', '进入下一任务', '当前任务已完成，确认进入下一任务', { scope: 'participant', id: participant.id }, {}, true) : ''}
    </div></div>
    <div class="detail-block danger-zone"><h3>危险操作</h3><p>清除会话、角色、进度、对话、证据与到课状态；保留名单、分组和专属链接。</p>
      <button class="action-button is-danger" type="button" data-action="reset-learning" data-participant-id="${escapeHtml(participant.id)}" ${hasLearningActivity ? '' : 'disabled'}><strong>${hasLearningActivity ? '一键清零' : '已经是未到课状态'}</strong><small>${hasLearningActivity ? '点击后立即清零，无需再次确认' : '学生重新进入课程后才会生成新记录'}</small></button>
    </div>` });
}

function actionButton(action, label, description, target, payload = {}, danger = false) {
  return `<button class="action-button ${danger ? 'is-danger' : ''}" type="button" data-action="prepare-command" data-command="${action}" data-target='${escapeHtml(JSON.stringify(target))}' data-payload='${escapeHtml(JSON.stringify(payload))}'><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></button>`;
}

async function copyStudentJoinLink(runId, participantId, button) {
  const original = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = '正在复制…';
  }
  try {
    const run = state.runs.find((item) => item.id === runId) || state.snapshot?.run;
    if (!run?.courseId || !runId) throw new Error('当前场次信息不完整，无法生成入课链接。');
    const preflight = await request(`/teacher/runs/${encodeURIComponent(runId)}/preflight`);
    const item = (preflight.joinCredentials || []).find((entry) => entry.participantId === participantId)
      || (preflight.joinCredentials || [])[0];
    if (!item?.joinCredential || !item.participantId || !item.groupId) {
      throw new Error('还没有签发该学生的入课凭证。');
    }
    const href = buildStudentJoinUrl({
      baseUrl: resolveStudentAppBase(),
      courseId: run.courseId,
      runId,
      participant: {
        id: item.participantId,
        groupId: item.groupId,
        joinCredential: item.joinCredential,
      },
    });
    if (!navigator.clipboard?.writeText) throw new Error('当前浏览器无法复制，请改用课前检查接口。');
    await navigator.clipboard.writeText(href);
    showToast('已复制专属学习链接');
  } catch (error) {
    showToast(error.message || '复制失败，请重试。');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

async function resetStudentLearning(participantId, button) {
  const participant = state.snapshot?.participants.find((item) => item.id === participantId);
  if (!participant || !participantHasLearningActivity(participant, state.snapshot?.alerts || [])) {
    renderStudentDrawer(participantId);
    return;
  }
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = '正在清零…';
  try {
    await request(`/teacher/runs/${encodeURIComponent(state.runId)}/participants/${encodeURIComponent(participantId)}/reset-learning`, {
      method: 'POST',
    });
    await refreshSnapshot();
    renderStudentDrawer(participantId);
    showToast('已清零，学生刷新后将从课程开头进入');
  } catch (error) {
    showToast(error.message || '清零暂未完成，请重试。');
    await refreshSnapshot();
    renderStudentDrawer(participantId);
  }
}

function renderAlertDrawer(alertId) {
  const alert = state.snapshot.alerts.find((item) => item.id === alertId);
  if (!alert) return;
  const participant = state.snapshot.participants.find((item) => item.id === alert.participantId);
  openDrawer({ eyebrow: `${alert.severity} · ${alert.status === 'open' ? '待处理' : '处理中'}`, title: alert.title, html: `
    <div class="detail-block"><p>${escapeHtml(alert.context?.message || '')}</p><div class="metric-grid">
      <div class="metric"><span>学生</span><strong>${escapeHtml(participant?.name || '系统事件')}</strong></div>
      <div class="metric"><span>角色</span><strong>${escapeHtml(participant ? participantRoleLabel(participant) : '全班')}</strong></div>
      <div class="metric"><span>发生时间</span><strong>${relativeTime(alert.createdAt)}</strong></div>
      <div class="metric"><span>网络</span><strong>${escapeHtml(alert.context?.network || participant?.device.network || '正常')}</strong></div>
    </div></div>
    ${participant ? `<div class="detail-block"><h3>处置前上下文</h3><p>${escapeHtml(alert.context?.dialogueSummary || participant.learning.dialogueSummary)}</p></div>` : ''}
    <div class="detail-block"><h3>事件状态</h3><div class="action-grid">
      ${alert.status === 'open' ? `<button class="action-button" type="button" data-action="update-alert" data-alert-id="${alert.id}" data-status="acknowledged"><strong>接单</strong><small>标记教师已看到</small></button>` : ''}
      ${alert.status === 'acknowledged' ? `<button class="action-button" type="button" data-action="update-alert" data-alert-id="${alert.id}" data-status="in_progress"><strong>开始处置</strong><small>记录为处理中</small></button>` : ''}
      <button class="action-button" type="button" data-action="update-alert" data-alert-id="${alert.id}" data-status="resolved"><strong>已解决</strong><small>完成闭环并记录</small></button>
      <button class="action-button" type="button" data-action="update-alert" data-alert-id="${alert.id}" data-status="false_alarm"><strong>标记误报</strong><small>保留规则优化记录</small></button>
    </div></div>
    ${participant ? `<div class="detail-block"><h3>立即干预</h3><div class="action-grid">${actionButton('send_notice', '回复学生', '提示已收到求助', { scope: 'participant', id: participant.id }, { text: '老师已收到你的求助，请先停在安全位置等待。' })}${actionButton('confirm_arrival', '确认位置', '教师人工核验', { scope: 'participant', id: participant.id })}</div></div>` : ''}` });
}

function renderControls() {
  const run = state.snapshot.run;
  const readyGroups = state.snapshot.groups.filter((group) => group.collectionReady).length;
  openDrawer({ eyebrow: '确定性运行控制', title: '教学遥控器', html: `
    <div class="detail-block"><div class="metric-grid"><div class="metric"><span>当前阶段</span><strong>${escapeHtml(run.phaseName)}</strong></div><div class="metric"><span>场次版本</span><strong>v${run.version}</strong></div></div></div>
    <div class="detail-block"><h3>开课与角色</h3><p class="field-hint">场次创建后即可开始；学生在课程前置任务完成后进入角色选择页。</p></div>
    <div class="detail-block"><h3>课程节奏</h3><p class="field-hint">${readyGroups ? `${readyGroups}/${state.snapshot.groups.length} 组密符已集齐。请先核对当前阶段要求，再手动推进。` : '尚无小组集齐密符；教师仍可根据现场情况决定节奏。'}</p><div class="action-grid">${actionButton(run.paused ? 'resume' : 'pause', run.paused ? '恢复课程' : '暂停全班', run.paused ? '恢复任务与计时' : '冻结任务与计时', { scope: 'all' }, {}, !run.paused)}${actionButton('advance_phase', '推进阶段', '核对阻断项后进入下一阶段', { scope: 'all' }, {}, true)}${actionButton('send_notice', '全班广播', '显示为教师消息', { scope: 'all' }, { text: '请各小组确认当前任务与组员位置。' })}${actionButton('emergency_rally', '紧急集合', '覆盖学生当前页面并要求确认', { scope: 'all' }, { rallyPoint: '太和门广场', message: '请立即停止任务，前往太和门广场集合。' }, true)}</div></div>
    <div class="detail-block"><h3>场次结束</h3>${actionButton('end_run', '结束并进入回看', '停止接收新任务，保留完整记录', { scope: 'all' }, {}, true)}</div>` });
}

async function renderPreflight(runId) {
  const result = await request(`/teacher/runs/${encodeURIComponent(runId)}/preflight`);
  openDrawer({ eyebrow: '开课控制台', title: result.ready ? '已具备开课条件' : '还有项目需要处理', html: `
    <div class="detail-block"><div class="preflight-list">${result.checks.map((check) => `<div class="preflight-row ${check.passed ? '' : 'is-failed'}"><span class="preflight-icon">${check.passed ? '✓' : '!'}</span><div><strong>${escapeHtml(check.label)}</strong><span>${check.passed ? '已通过' : `${check.failures.length}名学生需要处理`}</span></div><strong>提示</strong></div>${check.failures.map((student) => `<button class="member-row" type="button" data-action="recheck-device" data-participant-id="${student.id}" data-run-id="${runId}"><span class="role-seal">${escapeHtml(participantRoleSeal(student))}</span><span><strong>${escapeHtml(student.name)}</strong><span>定位或设备状态需要重检</span></span><strong>重新检测</strong></button>`).join('')}`).join('')}</div><p class="field-hint">课前检查用于提示风险，当前原型不阻断开课。</p></div>
    <div class="detail-block"><h3>导入学生名单</h3><p>支持第一列为姓名的 CSV，按现有小组顺序加入；角色由学生领取。</p><input id="rosterFile" type="file" accept=".csv,text/csv" data-run-id="${runId}" /></div>
    <button class="primary-button" type="button" data-action="switch-run" data-run-id="${runId}">进入课中带队</button>` });
}

function prepareCommand(input) {
  state.pendingCommand = input;
  const label = ACTION_LABELS[input.action] || input.action;
  $('#confirmEyebrow').textContent = HIGH_IMPACT.has(input.action) ? '高影响操作' : '教师干预';
  $('#confirmTitle').textContent = label;
  $('#confirmDescription').textContent = `${label}将作用于${input.target.scope === 'all' ? '全班' : input.target.scope === 'group' ? '所选小组' : input.target.scope === 'role' ? '所选角色' : '所选学生'}。发送后可查看送达与确认状态。`;
  $('#commandReason').value = input.reason || '';
  $('#confirmCommandButton').textContent = HIGH_IMPACT.has(input.action) ? '我已确认影响，发送' : '确认并发送';
  $('#backdrop').hidden = false;
  $('#confirmDialog').hidden = false;
}

async function confirmCommand() {
  if (!state.pendingCommand || !state.snapshot) return;
  const reason = $('#commandReason').value.trim();
  if (reason.length < 2) return showToast('请记录这次操作的原因。');
  const button = $('#confirmCommandButton');
  button.disabled = true;
  button.textContent = '正在发送…';
  try {
    const result = await request(`/teacher/runs/${encodeURIComponent(state.runId)}/commands`, {
      method: 'POST',
      body: JSON.stringify({
        ...state.pendingCommand,
        reason,
        expectedVersion: state.snapshot.run.version,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    upsertCommandFromSendResult(result);
    const summary = summarizeReceipts(state.commandLedger[result.id]);
    showToast(`服务端已接单 · ${summary.text}`);
    closeLayer();
    renderCommandFeed();
    await refreshSnapshot();
  } catch (error) {
    showToast(error.status === 409 ? '场次已更新，请确认最新状态后重试。' : error.message);
    await refreshSnapshot();
  } finally {
    button.disabled = false;
    button.textContent = '确认并发送';
  }
}

async function updateAlert(alertId, status) {
  try {
    await request(`/teacher/runs/${encodeURIComponent(state.runId)}/alerts/${encodeURIComponent(alertId)}`, {
      method: 'PATCH', body: JSON.stringify({ status, reason: status === 'false_alarm' ? '教师核验后确认误报' : '带队教师现场处置' }),
    });
    showToast(status === 'resolved' ? '事件已解决并记入审计日志。' : '事件状态已更新。');
    closeLayer();
    await refreshSnapshot();
  } catch (error) { showToast(error.message); }
}

async function loadReview() {
  if (!state.runId) return;
  try {
    state.review = await request(`/teacher/runs/${encodeURIComponent(state.runId)}/review`);
    const { run, summary, groups } = state.review;
    $('#reviewContent').innerHTML = `
      <section class="review-hero"><p class="eyebrow">${escapeHtml(run.className)}</p><h2>${escapeHtml(run.courseTitle)}</h2><p>位置与用时只用于运行复盘，不自动转换为学习评价。</p><div class="review-stats"><div class="review-stat"><span>平均进度</span><strong>${summary.averageProgress}%</strong></div><div class="review-stat"><span>教师干预</span><strong>${state.review.interventions.length}</strong></div><div class="review-stat"><span>学习小组</span><strong>${groups.length}</strong></div></div></section>
      <section class="review-section"><h2>小组完成情况</h2><div class="group-list">${groups.map((group, index) => `<button class="group-card" type="button" data-action="open-group" data-group-id="${group.id}"><span class="group-index">${index + 1}</span><span class="group-copy"><strong>${escapeHtml(group.name)}</strong><p>${group.members.reduce((sum, item) => sum + item.learning.evidenceCount, 0)}项证据</p></span><span class="group-meta"><strong>${group.progress}%</strong><span>已完成</span></span></button>`).join('')}</div></section>
      <section class="review-section"><h2>干预时间线</h2><div class="timeline">${state.review.interventions.slice().reverse().map((item) => {
        const command = state.commandLedger[item.commandId];
        const summary = command ? summarizeReceipts(command) : null;
        return `<div class="timeline-item"><strong>${escapeHtml(ACTION_LABELS[item.action] || item.action)}</strong><p>${escapeHtml(item.reason)} · ${relativeTime(item.createdAt)}${summary ? ` · ${escapeHtml(summary.text)}` : ''}</p></div>`;
      }).join('') || '<p>本场次还没有教师干预记录。</p>'}</div></section>`;
  } catch (error) { showToast(error.message); }
}

// 课程列表接口挂掉时的兜底课单，
// 保证"新建开课"永远可用——开课是主流程，不能跟着列表接口一起死。
const FALLBACK_COURSES = [
  { id: 'lesson_gewu_001', title: '故宫600年不积水的秘密', series: '格物' },
  { id: 'lesson_zhizhi_001', title: '故宫里的动物朋友', series: '致知' },
  { id: 'lesson_zhizhi_002', title: '动物园里的动物朋友', series: '致知' },
  { id: 'lesson_zhizhi_003', title: '城市里的动物朋友', series: '致知' },
  { id: 'lesson_zhuhun_001', title: '四渡赤水研学课程', series: '铸魂' },
];

// 下拉显示格式：{series}系列 · {title}（courseId）。
// Sonya 要求直接看到 courseId，方便复制到学生端 ?lesson= 参数换课。
// series 本身已带"系列"二字时不再重复拼接；没有 series 就省略前缀。
function courseOptionLabel(course) {
  const seriesPrefix = course.series
    ? `${course.series}${course.series.includes('系列') ? '' : '系列'} · `
    : '';
  return `${seriesPrefix}${course.title}（${course.id}）`;
}

function renderCourseOptions(courses) {
  return courses
    .map((course) => `<option value="${escapeHtml(course.id)}">${escapeHtml(courseOptionLabel(course))}</option>`)
    .join('');
}

async function loadCourseOptions() {
  const select = $('#newCourseId');
  if (!select) return;
  try {
    const { courses } = await request('/courses');
    if (!Array.isArray(courses) || !courses.length) throw new Error('empty course list');
    if ($('#newCourseId') !== select) return;
    select.innerHTML = renderCourseOptions(courses);
  } catch {
    // 接口失败就留在兜底两门课上，并在抽屉里给一行可见提示。
    const notice = $('#newCourseNotice');
    if (notice) {
      notice.textContent = '课程列表服务暂不可用，当前显示内置课程。';
      notice.hidden = false;
    }
  }
}

function newRunDrawer() {
  openDrawer({ eyebrow: '课前准备', title: '创建课程场次', html: `
    <form id="newRunForm">
      <div class="detail-block"><label class="field-label" for="newClassName">班级名称</label><input id="newClassName" name="className" required value="五年级研学班" /></div>
      <div class="detail-block">
        <label class="field-label" for="newCourseId">已发布课程</label>
        <select id="newCourseId" name="courseId">${renderCourseOptions(FALLBACK_COURSES)}</select>
        <p id="newCourseNotice" class="field-hint" hidden></p>
      </div>
      <div class="detail-block"><label class="field-label" for="newGroupCount">学习小组</label><select id="newGroupCount" name="groupCount"><option value="5">5组 · 30人</option><option value="4">4组 · 24人</option><option value="3">3组 · 18人</option></select></div>
      <button class="primary-button" type="submit">创建并进入课前检查</button>
    </form>` });
  // 抽屉先用兜底课单秒开，随后异步换成服务端枚举的完整课程列表。
  loadCourseOptions();
}

async function createRun(form) {
  const data = Object.fromEntries(new FormData(form));
  try {
    const run = await request('/teacher/runs', { method: 'POST', body: JSON.stringify(data) });
    state.runId = run.id;
    state.runs = await request('/teacher/runs');
    closeLayer();
    await refreshSnapshot();
    await renderPreflight(run.id);
  } catch (error) { showToast(error.message); }
}

function renderFatal(message) {
  $('#groupList').innerHTML = `<div class="empty-state"><strong>教师工作台未连接</strong><p>${escapeHtml(message)}</p><button class="primary-button" type="button" data-action="refresh">重新连接</button></div>`;
}

document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-nav]');
  if (nav) return showView(nav.dataset.nav);
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'refresh') return refreshSnapshot();
  if (action === 'close-layer') return closeLayer();
  if (action === 'open-group') return renderGroupDrawer(target.dataset.groupId);
  if (action === 'open-student') return renderStudentDrawer(target.dataset.participantId);
  if (action === 'open-alert') return renderAlertDrawer(target.dataset.alertId);
  if (action === 'open-controls') return renderControls();
  if (action === 'toggle-command-feed') {
    state.commandFeedExpanded = !state.commandFeedExpanded;
    return renderCommandFeed();
  }
  if (action === 'new-run') return newRunDrawer();
  if (action === 'preflight') return renderPreflight(target.dataset.runId);
  if (action === 'copy-join-link') {
    return copyStudentJoinLink(
      target.dataset.runId || state.runId,
      target.dataset.participantId,
      target,
    );
  }
  if (action === 'recheck-device') {
    await request(`/teacher/runs/${encodeURIComponent(target.dataset.runId)}/participants/${encodeURIComponent(target.dataset.participantId)}`, { method: 'PATCH', body: JSON.stringify({ recheckDevice: true, reason: '教师发起设备权限重新检测' }) });
    showToast('设备状态已重新检测。'); await refreshSnapshot(); return renderPreflight(target.dataset.runId);
  }
  if (action === 'switch-run') {
    state.runId = target.dataset.runId;
    state.commandLedger = loadCommandLedger(state.runId);
    state.commandFeedExpanded = false;
    state.eventSequence = 0;
    closeLayer();
    await hydrateCommandLedgerFromReview();
    await refreshSnapshot();
    connectRealtime();
    return showView('live');
  }
  if (action === 'open-command') return renderCommandDrawer(target.dataset.commandId);
  if (action === 'reset-learning') return resetStudentLearning(target.dataset.participantId, target);
  if (action === 'prepare-rally') return prepareCommand({ action: 'emergency_rally', target: { scope: 'all' }, payload: { rallyPoint: '太和门广场', message: '请立即停止任务，前往太和门广场集合。' } });
  if (action === 'prepare-command') return prepareCommand({ action: target.dataset.command, target: JSON.parse(target.dataset.target), payload: JSON.parse(target.dataset.payload || '{}') });
  if (action === 'confirm-command') return confirmCommand();
  if (action === 'update-alert') return updateAlert(target.dataset.alertId, target.dataset.status);
  if (action === 'toggle-map-list') {
    state.locationListVisible = !state.locationListVisible;
    $('#locationFallback').hidden = !(state.mapUnavailable || state.locationListVisible); return;
  }
  if (action === 'center-map') { fitTeacherMap(); return; }
  if (action === 'request-transcript') {
    await request(`/teacher/runs/${encodeURIComponent(state.runId)}/audit`, { method: 'POST', body: JSON.stringify({ action: 'transcript.view_requested', subject: { participantId: target.dataset.participantId }, reason: '学生求助后的人工复核请求' }) });
    return showToast('已记录原文查看请求；演示环境仅提供对话摘要。');
  }
  if (action === 'export-review') {
    if (!state.review) await loadReview();
    await request(`/teacher/runs/${encodeURIComponent(state.runId)}/audit`, { method: 'POST', body: JSON.stringify({ action: 'review.exported', subject: { runId: state.runId }, reason: '带队教师导出课后回看数据' }) });
    const blob = new Blob([JSON.stringify(state.review, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `course-review-${state.runId}.json`; link.click(); URL.revokeObjectURL(link.href);
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'teacherAccessForm') {
    event.preventDefault();
    const input = $('#teacherCredential');
    const credential = input.value.trim();
    input.value = '';
    if (!credential) {
      $('#teacherAccessDescription').textContent = '请输入教师访问凭证。';
      input.focus();
      return;
    }
    storeTeacherCredential(credential);
    $('#teacherAccessDescription').textContent = '正在验证并连接教师工作台……';
    bootstrap();
    return;
  }
  if (event.target.id === 'newRunForm') {
    event.preventDefault(); createRun(event.target);
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.id !== 'rosterFile' || !event.target.files?.[0]) return;
  try {
    const csv = await event.target.files[0].text();
    const result = await request(`/teacher/runs/${encodeURIComponent(event.target.dataset.runId)}/roster/import`, { method: 'POST', body: JSON.stringify({ csv, reason: '教师在课前控制台导入名单' }) });
    showToast(`已导入 ${result.imported} 名学生。`); await refreshSnapshot(); await renderPreflight(event.target.dataset.runId);
  } catch (error) { showToast(error.message); }
});

window.addEventListener('online', () => {
  refreshSnapshot();
  if (REALTIME_MODE === 'websocket') connectRealtime();
});
window.addEventListener('offline', () => setConnection(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSnapshot(); });
window.addEventListener(TEACHER_ACCESS_EVENT, (event) => showTeacherAccessState(event.detail));

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'retry-teacher-access') bootstrap();
  if (action === 'end-teacher-session') {
    clearTeacherCredential();
    clearTeacherSnapshots();
    state.snapshot = null;
    state.runs = [];
    showTeacherAccessState({
      kind: 'credential-required',
      message: '安全会话已结束。如需继续，请重新输入教师访问凭证。',
    });
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => undefined);
bootstrap();
