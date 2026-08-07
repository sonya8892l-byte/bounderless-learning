import { fitTeacherMap, mountTeacherMap, resizeTeacherMap } from './amap-service.js';

const API = '/api';
const TEACHER_ID = 'teacher-demo';
const configuredRealtimeMode = String(globalThis.__TEACHER_APP_CONFIG__?.REALTIME_MODE || 'polling').trim().toLowerCase();
const REALTIME_MODE = configuredRealtimeMode === 'websocket' ? 'websocket' : 'polling';
const HIGH_IMPACT = new Set(['pause', 'advance_phase', 'end_run', 'approve_evidence', 'skip_step', 'emergency_rally']);
const ACTION_LABELS = {
  send_notice: '发送教师提示', push_knowledge: '推送知识卡', add_time: '追加时间',
  remove_time: '减少时间', pause: '暂停课程', resume: '恢复课程', release_roles: '开启角色领取',
  lock_roles: '锁定角色', start_phase: '开始课程阶段', advance_phase: '推进至下一阶段',
  end_run: '结束场次', confirm_arrival: '确认到达', reject_evidence: '退回证据',
  approve_evidence: '人工通过', skip_step: '跳过可选小步', set_scaffold: '调整提示等级',
  switch_alternative: '切换替代任务', emergency_rally: '紧急集合',
};

const state = {
  runs: [], runId: null, snapshot: null, review: null, activeView: 'live',
  pendingCommand: null, socket: null, pollTimer: null, refreshTimer: null, toastTimer: null,
  mapUnavailable: false, locationListVisible: false,
  connected: true, eventSequence: 0, commandLedger: {},
  lastReceiptAnnouncement: '',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
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
    <div class="section-heading command-feed__heading">
      <div>
        <p class="eyebrow">指令回执</p>
        <h2 id="commandFeedTitle">教师指令送达</h2>
      </div>
      <button class="outline-button command-feed__controls" type="button" data-action="open-controls">打开遥控器</button>
    </div>
    <div class="command-feed__list" id="commandFeedList" role="list"></div>
    <p class="command-feed__announcer visually-hidden" id="commandReceiptAnnouncer" aria-live="polite" aria-atomic="true"></p>`;
  $('#statusStrip')?.insertAdjacentElement('afterend', mount);
}

function renderCommandFeed() {
  ensureCommandFeedMount();
  const list = $('#commandFeedList');
  if (!list) return;
  const commands = Object.values(state.commandLedger)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
    .slice(0, 8);
  if (!commands.length) {
    list.innerHTML = '<div class="command-feed__empty">还没有发出指令。发送后这里会显示已下发、已送达与已确认状态。</div>';
    return;
  }
  list.innerHTML = commands.map((command) => {
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
  }).join('');
  const latest = commands[0];
  const latestSummary = summarizeReceipts(latest);
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
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-teacher-id': TEACHER_ID, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Object.assign(new Error(body.error || `请求失败（${response.status}）`), { status: response.status, details: body.details });
    throw error;
  }
  return body;
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
  try {
    state.runs = await request('/teacher/runs');
    if (!state.runs.length) {
      const demo = await request('/teacher/demo', { method: 'POST', body: '{}' });
      state.runs = [demo];
    }
    state.runId = state.runs.find((run) => run.status === 'active')?.id || state.runs[0].id;
    state.commandLedger = loadCommandLedger(state.runId);
    state.eventSequence = 0;
    await hydrateCommandLedgerFromReview();
    await refreshSnapshot();
    connectRealtime();
    state.pollTimer = window.setInterval(refreshSnapshot, 5000);
  } catch (error) {
    showToast(error.message);
    renderFatal(error.message);
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
    localStorage.setItem(`teacher-snapshot:${state.runId}`, JSON.stringify(state.snapshot));
  } catch (error) {
    const cached = localStorage.getItem(`teacher-snapshot:${state.runId}`);
    if (cached && !state.snapshot) state.snapshot = JSON.parse(cached);
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
  if (REALTIME_MODE !== 'websocket' || !state.runId) return;
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
    <button class="group-card" type="button" data-action="open-group" data-group-id="${group.id}">
      <span class="group-index">${index + 1}</span>
      <span class="group-copy"><strong>${escapeHtml(group.name)}</strong><p>${group.onlineCount}/${group.members.length}人在线 · 小组密符 ${group.collectionCount}/${group.members.length}</p></span>
      <span class="group-meta"><strong class="${group.highestSeverity === 'P0' ? 'is-danger' : ''}">${group.alertCount ? `${group.highestSeverity} · ${group.alertCount}` : `${group.progress}%`}</strong><span>${formatTime(group.timeRemainingSeconds)}</span></span>
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
    groups,
    participants,
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
      <div class="metric"><span>剩余时间</span><strong>${formatTime(group.timeRemainingSeconds)}</strong></div>
      <div class="metric"><span>时间银行</span><strong>${group.bankBalance} min</strong></div>
      <div class="metric"><span>阻断项</span><strong>${blockers.length}</strong></div>
    </div></div>
    <div class="detail-block"><h3>六名组员与角色</h3><div class="member-list">${group.members.map(memberRow).join('')}</div></div>
    <div class="detail-block"><h3>小组干预</h3><div class="action-grid">
      ${actionButton('send_notice', '发送提示', '进入全组学生对话', { scope: 'group', id: group.id }, { text: '请回到当前任务，检查小组是否还缺一项关键证据。' })}
      ${actionButton('add_time', '全组加时', '默认追加3分钟', { scope: 'group', id: group.id }, { amount: 3 })}
      ${actionButton('switch_alternative', '替代任务', '切换同目标离线方案', { scope: 'group', id: group.id }, { alternative: 'offline-equivalent' })}
      ${actionButton('pause', '暂停课程', '暂停全班任务计时', { scope: 'all' }, {}, true)}
    </div></div>` });
}

function memberRow(participant) {
  return `<button class="member-row" type="button" data-action="open-student" data-participant-id="${participant.id}">
    <span class="role-seal">${escapeHtml(participant.roleName.slice(0, 1))}</span>
    <span><strong>${escapeHtml(participant.name)}</strong><span>${escapeHtml(participant.roleName)} · ${escapeHtml(participant.learning.currentTask)}</span></span>
    <strong>${participant.learning.progress}%</strong></button>`;
}

function renderStudentDrawer(participantId) {
  const participant = state.snapshot.participants.find((item) => item.id === participantId);
  if (!participant) return;
  const ageLabel = participant.positionStatus === 'fresh' ? `${participant.positionAgeSeconds}秒前更新` : `位置可能过期 · ${Math.floor(participant.positionAgeSeconds / 60)}分钟前`;
  openDrawer({ eyebrow: `${participant.roleName} · ${state.snapshot.groups.find((item) => item.id === participant.groupId)?.name}`, title: participant.name, html: `
    <div class="detail-block"><div class="metric-grid">
      <div class="metric"><span>当前任务</span><strong>${escapeHtml(participant.learning.currentTask)}</strong></div>
      <div class="metric"><span>学习进度</span><strong>${participant.learning.progress}%</strong></div>
      <div class="metric"><span>提示等级</span><strong>L${participant.learning.scaffoldLevel}</strong></div>
      <div class="metric"><span>位置精度</span><strong>±${participant.location.accuracyMeters}m</strong></div>
    </div><p class="alert-card__meta">${ageLabel}</p></div>
    <div class="detail-block"><h3>AI对话摘要</h3><p>${escapeHtml(participant.learning.dialogueSummary)}</p><button class="outline-button" type="button" data-action="request-transcript" data-participant-id="${participant.id}">按授权查看原文</button></div>
    <div class="detail-block"><h3>任务与证据</h3><p>${escapeHtml(participant.learning.stepName)} · 已提交 ${participant.learning.evidenceCount} 项证据</p></div>
    <div class="detail-block"><h3>学生干预</h3><div class="action-grid">
      ${actionButton('send_notice', '教师提示', '明确标注教师来源', { scope: 'participant', id: participant.id }, { text: '我看到你的尝试了，请先选择一条最有把握的证据继续。' })}
      ${actionButton('add_time', '追加时间', '追加3分钟', { scope: 'participant', id: participant.id }, { amount: 3 })}
      ${actionButton('set_scaffold', '增强提示', '调整为L2', { scope: 'participant', id: participant.id }, { level: 2 })}
      ${actionButton('confirm_arrival', '确认到达', '教师人工确认位置', { scope: 'participant', id: participant.id })}
      ${actionButton('approve_evidence', '人工通过', '保留AI原判断记录', { scope: 'participant', id: participant.id }, {}, true)}
      ${actionButton('reject_evidence', '退回补做', '要求补充证据', { scope: 'participant', id: participant.id })}
    </div></div>` });
}

function actionButton(action, label, description, target, payload = {}, danger = false) {
  return `<button class="action-button ${danger ? 'is-danger' : ''}" type="button" data-action="prepare-command" data-command="${action}" data-target='${escapeHtml(JSON.stringify(target))}' data-payload='${escapeHtml(JSON.stringify(payload))}'><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></button>`;
}

function renderAlertDrawer(alertId) {
  const alert = state.snapshot.alerts.find((item) => item.id === alertId);
  if (!alert) return;
  const participant = state.snapshot.participants.find((item) => item.id === alert.participantId);
  openDrawer({ eyebrow: `${alert.severity} · ${alert.status === 'open' ? '待处理' : '处理中'}`, title: alert.title, html: `
    <div class="detail-block"><p>${escapeHtml(alert.context?.message || '')}</p><div class="metric-grid">
      <div class="metric"><span>学生</span><strong>${escapeHtml(participant?.name || '系统事件')}</strong></div>
      <div class="metric"><span>角色</span><strong>${escapeHtml(participant?.roleName || '全班')}</strong></div>
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
  openDrawer({ eyebrow: '确定性运行控制', title: '教学遥控器', html: `
    <div class="detail-block"><div class="metric-grid"><div class="metric"><span>当前阶段</span><strong>${escapeHtml(run.phaseName)}</strong></div><div class="metric"><span>场次版本</span><strong>v${run.version}</strong></div></div></div>
    <div class="detail-block"><h3>开课与角色</h3><div class="action-grid">${actionButton('release_roles', '开启领取', '学生可以领取角色', { scope: 'all' })}${actionButton('lock_roles', '锁定角色', '停止调换角色', { scope: 'all' })}</div></div>
    <div class="detail-block"><h3>课程节奏</h3><div class="action-grid">${actionButton(run.paused ? 'resume' : 'pause', run.paused ? '恢复课程' : '暂停全班', run.paused ? '恢复任务与计时' : '冻结任务与计时', { scope: 'all' }, {}, !run.paused)}${actionButton('advance_phase', '推进阶段', '核对阻断项后进入下一阶段', { scope: 'all' }, {}, true)}${actionButton('send_notice', '全班广播', '显示为教师消息', { scope: 'all' }, { text: '请各小组确认当前任务与组员位置。' })}${actionButton('emergency_rally', '紧急集合', '覆盖学生当前页面并要求确认', { scope: 'all' }, { rallyPoint: '太和门广场', message: '请立即停止任务，前往太和门广场集合。' }, true)}</div></div>
    <div class="detail-block"><h3>场次结束</h3>${actionButton('end_run', '结束并进入回看', '停止接收新任务，保留完整记录', { scope: 'all' }, {}, true)}</div>` });
}

async function renderPreflight(runId) {
  const result = await request(`/teacher/runs/${encodeURIComponent(runId)}/preflight`);
  openDrawer({ eyebrow: '开课控制台', title: result.ready ? '已具备开课条件' : '还有项目需要处理', html: `
    <div class="detail-block"><div class="preflight-list">${result.checks.map((check) => `<div class="preflight-row ${check.passed ? '' : 'is-failed'}"><span class="preflight-icon">${check.passed ? '✓' : '!'}</span><div><strong>${escapeHtml(check.label)}</strong><span>${check.passed ? '已通过' : `${check.failures.length}名学生需要处理`}</span></div><strong>${check.required ? '必需' : '可选'}</strong></div>${check.failures.map((student) => `<button class="member-row" type="button" data-action="recheck-device" data-participant-id="${student.id}" data-run-id="${runId}"><span class="role-seal">${escapeHtml(student.roleName.slice(0, 1))}</span><span><strong>${escapeHtml(student.name)}</strong><span>定位或设备状态需要重检</span></span><strong>重新检测</strong></button>`).join('')}`).join('')}</div></div>
    <div class="detail-block"><h3>导入学生名单</h3><p>支持第一列为姓名的 CSV，按现有小组和角色顺序分配。</p><input id="rosterFile" type="file" accept=".csv,text/csv" data-run-id="${runId}" /></div>
    ${result.ready ? `<button class="primary-button" type="button" data-action="switch-run" data-run-id="${runId}">进入课中带队</button>` : '<p>处理所有必需项后，系统会开放课程阶段指令。</p>'}` });
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

function newRunDrawer() {
  openDrawer({ eyebrow: '课前准备', title: '创建课程场次', html: `
    <form id="newRunForm">
      <div class="detail-block"><label class="field-label" for="newClassName">班级名称</label><input id="newClassName" name="className" required value="五年级研学班" /></div>
      <div class="detail-block">
        <label class="field-label" for="newCourseId">已发布课程</label>
        <select id="newCourseId" name="courseId">
          <option value="lesson_gewu_001">格物系列 · 故宫600年不积水的秘密</option>
          <option value="lesson_zhuhun_001">铸魂系列 · 四渡赤水研学课程</option>
        </select>
      </div>
      <div class="detail-block"><label class="field-label" for="newGroupCount">学习小组</label><select id="newGroupCount" name="groupCount"><option value="5">5组 · 30人</option><option value="4">4组 · 24人</option><option value="3">3组 · 18人</option></select></div>
      <button class="primary-button" type="submit">创建并进入课前检查</button>
    </form>` });
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
  if (action === 'new-run') return newRunDrawer();
  if (action === 'preflight') return renderPreflight(target.dataset.runId);
  if (action === 'recheck-device') {
    await request(`/teacher/runs/${encodeURIComponent(target.dataset.runId)}/participants/${encodeURIComponent(target.dataset.participantId)}`, { method: 'PATCH', body: JSON.stringify({ recheckDevice: true, reason: '教师发起设备权限重新检测' }) });
    showToast('设备状态已重新检测。'); await refreshSnapshot(); return renderPreflight(target.dataset.runId);
  }
  if (action === 'switch-run') {
    state.runId = target.dataset.runId;
    state.commandLedger = loadCommandLedger(state.runId);
    state.eventSequence = 0;
    closeLayer();
    await hydrateCommandLedgerFromReview();
    await refreshSnapshot();
    connectRealtime();
    return showView('live');
  }
  if (action === 'open-command') return renderCommandDrawer(target.dataset.commandId);
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
  if (event.target.id !== 'newRunForm') return;
  event.preventDefault(); createRun(event.target);
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => undefined);
bootstrap();
