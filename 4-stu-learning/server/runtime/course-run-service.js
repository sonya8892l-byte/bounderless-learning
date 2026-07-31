import crypto from 'node:crypto';

const DEMO_NAMES = [
  '林以安', '周可欣', '陈思远', '顾清禾', '马知遥', '王雨桐',
  '赵书宁', '何嘉木', '许安然', '陆明哲', '吴若溪', '唐予安',
  '宋景行', '沈一诺', '韩知夏', '苏予澄', '姜念安', '程星野',
  '谢予舟', '方楚宁', '叶嘉言', '罗景明', '郑若洵', '徐知闻',
  '秦舒扬', '吴予安', '张景然', '李星阑', '王清越', '刘子衍',
];

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

function httpError(statusCode, message, details) {
  return Object.assign(new Error(message), { statusCode, details });
}

function courseCenter(course) {
  const configured = course.publicLesson.mapCenter;
  if (Array.isArray(configured) && configured.length === 2 && configured.every(Number.isFinite)) {
    return configured;
  }
  const points = course.roles.flatMap((role) => role.tasks)
    .map((task) => task.location?.coordinates)
    .filter((point) => Array.isArray(point) && point.length === 2);
  if (!points.length) return null;
  return [
    points.reduce((sum, point) => sum + Number(point[0]), 0) / points.length,
    points.reduce((sum, point) => sum + Number(point[1]), 0) / points.length,
  ];
}

function makeParticipants(course, groupCount = 5) {
  const center = courseCenter(course);
  if (!center) throw httpError(422, `课程「${course.publicLesson.title}」缺少坐标中心，无法创建安全场次。`);
  const participants = [];
  const groups = [];
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupId = `group-${groupIndex + 1}`;
    const memberIds = [];
    course.roles.forEach((role, roleIndex) => {
      const index = groupIndex * course.roles.length + roleIndex;
      const participantId = `student-${groupIndex + 1}-${roleIndex + 1}`;
      const task = role.tasks[0];
      const angle = (index / Math.max(1, groupCount * course.roles.length)) * Math.PI * 2;
      const distance = 0.00035 + groupIndex * 0.00008;
      const stale = index === 11;
      const observedAt = new Date(Date.now() - (stale ? 245_000 : (index % 5) * 9_000)).toISOString();
      participants.push({
        id: participantId,
        name: DEMO_NAMES[index] || `学习者${index + 1}`,
        groupId,
        roleId: role.id,
        roleName: role.name,
        learnerSessionId: null,
        online: !stale,
        device: {
          loggedIn: true,
          location: index === 7 ? 'attention' : 'ready',
          camera: 'ready',
          network: stale ? 'offline' : (index % 8 === 0 ? 'weak' : 'ready'),
          roleClaimed: true,
        },
        location: {
          lng: center[0] + Math.cos(angle) * distance,
          lat: center[1] + Math.sin(angle) * distance,
          accuracyMeters: index % 7 === 0 ? 48 : 16 + (index % 5) * 4,
          insideFence: index !== 11,
          observedAt,
        },
        learning: {
          progress: Math.min(100, 22 + groupIndex * 9 + roleIndex * 7),
          currentTask: task?.name || '待开始',
          roleStageName: task?.name || '现场任务',
          stepName: task?.steps?.[0]?.name || task?.requirement || '完成当前观察',
          idleSeconds: index === 8 ? 260 : 20 + index * 4,
          scaffoldLevel: index % 3,
          timeBalance: 10 + (index % 6),
          evidenceCount: index % 4,
          dialogueSummary: index === 8
            ? '学生已尝试两种记录方式，仍不确定应选择哪一处作为证据。'
            : '学生正在按任务要求收集现场证据，尚未出现明显理解偏差。',
          lastMeaningfulActionAt: observedAt,
        },
        latestDirective: null,
      });
      memberIds.push(participantId);
    });
    groups.push({
      id: groupId,
      name: `第 ${groupIndex + 1} 小组`,
      memberIds,
      progress: 0,
      timeRemainingSeconds: 5400 - groupIndex * 240,
      bankBalance: 15 + groupIndex * 2,
      collectionCount: groupIndex,
    });
  }
  return { groups, participants, center };
}

function eventFor(state, runId, type, data) {
  state.sequence += 1;
  const event = { sequence: state.sequence, runId, type, data, createdAt: nowIso() };
  state.events.push(event);
  if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
  return event;
}

function audit(state, runId, actorId, action, subject, reason = '', payload = {}) {
  state.auditEvents.push({
    id: id('audit'), runId, actorId, action, subject, reason, payload, createdAt: nowIso(),
  });
}

function findRun(state, runId) {
  const run = state.runs.find((item) => item.id === runId);
  if (!run) throw httpError(404, '课程场次不存在。');
  return run;
}

function locateParticipant(state, sessionId, participantId) {
  for (const run of state.runs) {
    const participant = run.participants.find((item) => (
      (sessionId && item.learnerSessionId === sessionId) || (participantId && item.id === participantId)
    ));
    if (participant) return { run, participant };
  }
  return null;
}

function targetParticipants(run, target) {
  if (target.scope === 'all') return run.participants;
  if (target.scope === 'group') return run.participants.filter((item) => item.groupId === target.id);
  if (target.scope === 'role') return run.participants.filter((item) => item.roleId === target.id);
  if (target.scope === 'participant') return run.participants.filter((item) => item.id === target.id);
  return [];
}

function alertRank(severity) {
  return { P0: 0, P1: 1, P2: 2 }[severity] ?? 3;
}

function alertStatus(alert) {
  return alert.status || 'open';
}

function snapshot(state, run) {
  const currentTime = Date.now();
  const openAlerts = state.alerts
    .filter((alert) => alert.runId === run.id && !['resolved', 'false_alarm'].includes(alertStatus(alert)))
    .sort((a, b) => alertRank(a.severity) - alertRank(b.severity) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const participants = run.participants.map((participant) => {
    const age = Math.max(0, Math.floor((currentTime - Date.parse(participant.location.observedAt)) / 1000));
    const positionStatus = age > 180 ? 'lost' : (age > 60 ? 'stale' : 'fresh');
    return { ...participant, positionAgeSeconds: age, positionStatus };
  });
  const groups = run.groups.map((group) => {
    const members = participants.filter((participant) => participant.groupId === group.id);
    const alerts = openAlerts.filter((alert) => alert.groupId === group.id);
    return {
      ...group,
      progress: Math.round(members.reduce((sum, item) => sum + item.learning.progress, 0) / Math.max(1, members.length)),
      onlineCount: members.filter((item) => item.online).length,
      alertCount: alerts.length,
      highestSeverity: alerts.sort((a, b) => alertRank(a.severity) - alertRank(b.severity))[0]?.severity || null,
      members,
    };
  });
  return {
    run: { ...run, participants: undefined, groups: undefined },
    groups,
    participants,
    alerts: openAlerts,
    sequence: state.sequence,
    summary: {
      total: participants.length,
      online: participants.filter((item) => item.online).length,
      pending: openAlerts.length,
      p0: openAlerts.filter((item) => item.severity === 'P0').length,
      averageProgress: Math.round(participants.reduce((sum, item) => sum + item.learning.progress, 0) / Math.max(1, participants.length)),
    },
  };
}

export function createCourseRunService({ store, getCourse, realtime }) {
  async function assertTeacherAccess(runId, teacherId) {
    const state = await store.read();
    const run = findRun(state, runId);
    if (run.teacherId !== teacherId) throw httpError(403, '你无权访问该班级场次。');
    return true;
  }

  async function createRun(input = {}) {
    const course = await getCourse(input.courseId || 'lesson_gewu_001');
    const { groups, participants, center } = makeParticipants(course, Number(input.groupCount || 5));
    const createdAt = nowIso();
    const run = {
      id: id('run'),
      teacherId: input.teacherId || 'teacher-demo',
      teacherName: input.teacherName || '带队教师',
      courseId: course.id,
      courseVersion: input.courseVersion || '1.0.0',
      courseTitle: course.publicLesson.title,
      className: input.className || '故宫研学班',
      status: input.status || 'draft',
      phaseId: course.publicLesson.phases[0]?.id || 'phase-1',
      phaseName: course.publicLesson.phases[0]?.name || '课前准备',
      phaseIndex: 0,
      phaseRemainingSeconds: 5400,
      paused: false,
      rolesReleased: false,
      rolesLocked: false,
      entryCode: String(Math.floor(100000 + Math.random() * 900000)),
      mapAsset: `/${course.publicLesson.assets.navigationMap}`,
      mapCenter: center,
      groupCount: groups.length,
      groups,
      participants,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    };
    let publishedEvent;
    await store.transaction((state) => {
      state.runs.push(run);
      audit(state, run.id, run.teacherId, 'run.created', { runId: run.id }, input.reason || '创建场次');
      publishedEvent = eventFor(state, run.id, 'run.created', { runId: run.id });
    });
    realtime.publish(run.id, publishedEvent);
    return run;
  }

  async function ensureDemoRun() {
    const state = await store.read();
    const existing = state.runs.find((run) => run.teacherId === 'teacher-demo');
    if (existing) return existing;
    const run = await createRun({ status: 'active', className: '五年级·故宫研学', reason: '初始化演示场次' });
    await store.transaction((next) => {
      const saved = findRun(next, run.id);
      saved.phaseId = 'phase-2';
      saved.phaseName = '现场任务挑战';
      saved.phaseIndex = 1;
      saved.rolesReleased = true;
      saved.rolesLocked = true;
      const helpStudent = saved.participants[8];
      const lostStudent = saved.participants[11];
      next.alerts.push({
        id: id('alert'), runId: saved.id, participantId: lostStudent.id, groupId: lostStudent.groupId,
        severity: 'P0', type: 'lost_outside_fence', title: '越界后位置失联', status: 'open',
        context: { message: `${lostStudent.name}的位置已超过3分钟未更新，上次位置在安全围栏外。` },
        createdAt: nowIso(), updatedAt: nowIso(),
      });
      next.alerts.push({
        id: id('alert'), runId: saved.id, participantId: helpStudent.id, groupId: helpStudent.groupId,
        severity: 'P1', type: 'student_help', title: '学生请求任务帮助', status: 'open',
        context: { message: helpStudent.learning.dialogueSummary }, createdAt: nowIso(), updatedAt: nowIso(),
      });
    });
    return run;
  }

  async function listRuns(teacherId = 'teacher-demo') {
    const state = await store.read();
    return state.runs.filter((run) => run.teacherId === teacherId)
      .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((run) => ({ ...run, participants: undefined, groups: undefined }));
  }

  async function getSnapshot(runId) {
    const state = await store.read();
    return snapshot(state, findRun(state, runId));
  }

  async function getEvents(runId, after = 0) {
    const state = await store.read();
    findRun(state, runId);
    return state.events.filter((event) => event.runId === runId && event.sequence > Number(after)).slice(0, 500);
  }

  async function preflight(runId) {
    const state = await store.read();
    const run = findRun(state, runId);
    const checks = [
      { id: 'roster', label: '名单与入课', required: true, passed: run.participants.every((item) => item.name && item.device.loggedIn), failures: run.participants.filter((item) => !item.name || !item.device.loggedIn) },
      { id: 'groups', label: '小组与角色', required: true, passed: run.groups.every((group) => new Set(run.participants.filter((item) => item.groupId === group.id).map((item) => item.roleId)).size === run.participants.filter((item) => item.groupId === group.id).length), failures: [] },
      { id: 'permissions', label: '设备权限', required: true, passed: run.participants.every((item) => item.device.location === 'ready' && item.device.camera === 'ready'), failures: run.participants.filter((item) => item.device.location !== 'ready' || item.device.camera !== 'ready') },
      { id: 'course', label: '课程版本', required: true, passed: Boolean(run.courseVersion), failures: [] },
      { id: 'safety', label: '路线与安全围栏', required: true, passed: Boolean(run.mapCenter), failures: [] },
    ];
    return { checks, ready: checks.filter((item) => item.required).every((item) => item.passed) };
  }

  async function importRoster(runId, input) {
    const rows = String(input.csv || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!rows.length) throw httpError(400, '名单文件为空。');
    const first = rows[0].split(',').map((cell) => cell.trim().toLowerCase());
    const hasHeader = first.some((cell) => ['name', '姓名', '学生姓名'].includes(cell));
    const names = rows.slice(hasHeader ? 1 : 0).map((line) => line.split(',')[0]?.trim()).filter(Boolean);
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const run = findRun(state, runId);
      if (names.length > run.participants.length) throw httpError(400, `名单包含${names.length}人，超过当前场次${run.participants.length}人容量。`);
      names.forEach((name, index) => { run.participants[index].name = name; });
      run.version += 1;
      run.updatedAt = nowIso();
      audit(state, runId, input.actorId, 'roster.imported', { runId }, input.reason, { count: names.length });
      publishedEvent = eventFor(state, runId, 'roster.imported', { count: names.length });
      result = { imported: names.length, capacity: run.participants.length, runVersion: run.version };
    });
    realtime.publish(runId, publishedEvent);
    return result;
  }

  async function updateParticipant(runId, participantId, input) {
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const run = findRun(state, runId);
      const participant = run.participants.find((item) => item.id === participantId);
      if (!participant) throw httpError(404, '学生不存在。');
      if (input.recheckDevice) participant.device = { ...participant.device, location: 'ready', camera: 'ready', network: 'ready' };
      if (input.name) participant.name = input.name;
      if (input.groupId || input.roleId) {
        const groupId = input.groupId || participant.groupId;
        const roleId = input.roleId || participant.roleId;
        const conflict = run.participants.find((item) => item.id !== participant.id && item.groupId === groupId && item.roleId === roleId);
        if (conflict) throw httpError(409, `该小组已由${conflict.name}领取这个角色。`);
        participant.groupId = groupId;
        participant.roleId = roleId;
        const courseRoleName = run.participants.find((item) => item.roleId === roleId)?.roleName;
        if (courseRoleName) participant.roleName = courseRoleName;
      }
      run.version += 1;
      run.updatedAt = nowIso();
      audit(state, runId, input.actorId, 'participant.updated', { participantId }, input.reason, input);
      publishedEvent = eventFor(state, runId, 'participant.updated', { participantId });
      result = participant;
    });
    realtime.publish(runId, publishedEvent);
    return result;
  }

  async function updateAlert(runId, alertId, input) {
    let publishedEvent;
    let result;
    await store.transaction((state) => {
      findRun(state, runId);
      const alert = state.alerts.find((item) => item.id === alertId && item.runId === runId);
      if (!alert) throw httpError(404, '待处理事件不存在。');
      const transitions = {
        open: ['acknowledged', 'false_alarm'],
        acknowledged: ['in_progress', 'resolved', 'false_alarm'],
        in_progress: ['resolved', 'false_alarm'],
      };
      if (input.status && !transitions[alert.status]?.includes(input.status)) {
        throw httpError(409, '该事件状态已变化，请刷新后再处理。', { current: alert });
      }
      alert.status = input.status || alert.status;
      alert.resolution = input.resolution || alert.resolution;
      alert.updatedAt = nowIso();
      audit(state, runId, input.actorId, 'alert.updated', { alertId }, input.reason, { status: alert.status });
      publishedEvent = eventFor(state, runId, 'alert.updated', { alertId, status: alert.status });
      result = alert;
    });
    realtime.publish(runId, publishedEvent);
    return result;
  }

  function applyCommand(run, command, participants) {
    const { action, payload } = command;
    if (action === 'release_roles') run.rolesReleased = true;
    if (action === 'lock_roles') run.rolesLocked = true;
    if (action === 'start_phase') run.status = 'active';
    if (action === 'pause') run.paused = true;
    if (action === 'resume') run.paused = false;
    if (action === 'end_run') run.status = 'completed';
    if (action === 'advance_phase') {
      run.phaseIndex += 1;
      run.phaseId = payload.phaseId || `phase-${run.phaseIndex + 1}`;
      run.phaseName = payload.phaseName || '下一课程阶段';
    }
    for (const participant of participants) {
      participant.latestDirective = {
        commandId: command.id, sequence: command.sequence, action, payload,
        teacherLabel: payload.teacherLabel || '带队教师', createdAt: command.createdAt,
      };
      if (action === 'add_time') participant.learning.timeBalance += Number(payload.amount || 3);
      if (action === 'set_scaffold') participant.learning.scaffoldLevel = Number(payload.level || 0);
      if (action === 'confirm_arrival') participant.location.insideFence = true;
      if (action === 'approve_evidence') participant.learning.progress = Math.min(100, participant.learning.progress + 12);
      if (action === 'skip_step') participant.learning.progress = Math.min(100, participant.learning.progress + 8);
    }
  }

  async function sendCommand(runId, input) {
    let publishedEvent;
    let result;
    await store.transaction((state) => {
      const run = findRun(state, runId);
      const duplicate = state.commands.find((item) => item.runId === runId && item.idempotencyKey === input.idempotencyKey);
      if (duplicate) { result = duplicate; return; }
      if (Number(input.expectedVersion) !== run.version) {
        throw httpError(409, '场次状态已更新，请确认最新状态。', { currentVersion: run.version });
      }
      const participants = targetParticipants(run, input.target);
      if (!participants.length && input.target.scope !== 'all') throw httpError(400, '未找到指令对象。');
      const command = {
        id: id('cmd'), runId, sequence: state.sequence + 1, idempotencyKey: input.idempotencyKey,
        actorId: input.actorId, action: input.action, target: input.target, payload: input.payload || {},
        reason: input.reason, status: 'accepted', createdAt: nowIso(),
      };
      state.commands.push(command);
      applyCommand(run, command, participants);
      run.version += 1;
      run.updatedAt = nowIso();
      for (const participant of participants) {
        const delivered = participant.online;
        state.receipts.push({
          id: id('receipt'), commandId: command.id, participantId: participant.id,
          learnerSessionId: participant.learnerSessionId, status: delivered ? 'delivered' : 'accepted',
          acceptedAt: command.createdAt, deliveredAt: delivered ? nowIso() : null, confirmedAt: null,
        });
      }
      audit(state, runId, input.actorId, 'teacher.command', input.target, input.reason, { commandId: command.id, action: input.action });
      state.interventions.push({
        id: id('intervention'), runId, commandId: command.id, actorId: input.actorId,
        action: input.action, target: input.target, reason: input.reason, createdAt: command.createdAt,
      });
      publishedEvent = eventFor(state, runId, 'teacher.command.accepted', { commandId: command.id, action: command.action });
      result = { ...command, receipts: state.receipts.filter((item) => item.commandId === command.id), runVersion: run.version };
    });
    if (publishedEvent) realtime.publish(runId, publishedEvent);
    return result;
  }

  async function bindLearnerSession({ runId, participantId, sessionId, groupId, roleId, studentId }) {
    let found = null;
    await store.transaction((state) => {
      const candidates = runId ? [findRun(state, runId)] : state.runs.filter((run) => run.status === 'active');
      for (const run of candidates) {
        const participant = run.participants.find((item) => item.id === participantId)
          || run.participants.find((item) => item.groupId === groupId && item.roleId === roleId);
        if (!participant) continue;
        participant.learnerSessionId = sessionId;
        participant.online = true;
        participant.device.loggedIn = true;
        found = { runId: run.id, participantId: participant.id };
        eventFor(state, run.id, 'participant.session_bound', found);
        break;
      }
    });
    return found;
  }

  async function requestHelp(input) {
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const located = locateParticipant(state, input.sessionId, input.participantId);
      if (!located) throw httpError(404, '未找到对应的学生场次，请重新入课。');
      const { run, participant } = located;
      const severity = input.kind === 'safety' ? 'P0' : 'P1';
      const dedupeSince = Date.now() - 5 * 60_000;
      const duplicate = state.alerts.find((alert) => alert.runId === run.id && alert.participantId === participant.id
        && alert.type === (input.kind === 'safety' ? 'safety_help' : 'student_help')
        && !['resolved', 'false_alarm'].includes(alert.status) && Date.parse(alert.createdAt) > dedupeSince);
      if (duplicate) { result = duplicate; return; }
      const alert = {
        id: id('alert'), runId: run.id, participantId: participant.id, groupId: participant.groupId,
        severity, type: input.kind === 'safety' ? 'safety_help' : 'student_help',
        title: input.kind === 'safety' ? '学生发起安全求助' : '学生请求老师帮助', status: 'open',
        context: {
          message: input.reason || '学生在当前任务中请求帮助。', roleName: participant.roleName,
          task: participant.learning.currentTask, location: participant.location,
          dialogueSummary: participant.learning.dialogueSummary, network: participant.device.network,
        },
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      state.alerts.push(alert);
      publishedEvent = eventFor(state, run.id, 'alert.created', { alertId: alert.id, severity: alert.severity });
      result = alert;
    });
    if (publishedEvent) realtime.publish(result.runId, publishedEvent);
    return result;
  }

  async function reportPresence(sessionId, input) {
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const located = locateParticipant(state, sessionId);
      if (!located) throw httpError(404, '学生会话未绑定课程场次。');
      const { run, participant } = located;
      participant.online = true;
      participant.device.network = input.online === false ? 'offline' : (input.network || 'ready');
      if (input.location) {
        const lng = Number(input.location.lng);
        const lat = Number(input.location.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          participant.location.lng = lng;
          participant.location.lat = lat;
        }
        if (Number.isFinite(Number(input.location.accuracyMeters))) participant.location.accuracyMeters = Number(input.location.accuracyMeters);
        if (typeof input.location.insideFence === 'boolean') participant.location.insideFence = input.location.insideFence;
        participant.device.location = input.location.permission === 'denied' ? 'attention' : 'ready';
      }
      participant.location.observedAt = nowIso();
      if (Number.isFinite(Number(input.progress))) participant.learning.progress = Math.max(0, Math.min(100, Number(input.progress)));
      if (input.currentTask) participant.learning.currentTask = String(input.currentTask).slice(0, 200);
      if (Number.isFinite(Number(input.idleSeconds))) participant.learning.idleSeconds = Math.max(0, Number(input.idleSeconds));
      publishedEvent = eventFor(state, run.id, 'participant.presence', { participantId: participant.id });
      result = { runId: run.id, participantId: participant.id, observedAt: participant.location.observedAt };
    });
    realtime.publish(result.runId, publishedEvent);
    return result;
  }

  async function commandsForSession(sessionId, after = 0) {
    const state = await store.read();
    const located = locateParticipant(state, sessionId);
    if (!located) return { commands: [], sequence: state.sequence };
    const receipts = state.receipts.filter((receipt) => receipt.learnerSessionId === sessionId || receipt.participantId === located.participant.id);
    const commandIds = new Set(receipts.map((receipt) => receipt.commandId));
    return {
      commands: state.commands.filter((command) => commandIds.has(command.id) && command.sequence > Number(after))
        .map((command) => ({ ...command, receipt: receipts.find((receipt) => receipt.commandId === command.id) })),
      sequence: state.sequence,
    };
  }

  async function confirmCommand(sessionId, commandId, status = 'confirmed') {
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const located = locateParticipant(state, sessionId);
      if (!located) throw httpError(404, '学生会话未绑定课程场次。');
      const receipt = state.receipts.find((item) => item.commandId === commandId && item.participantId === located.participant.id);
      if (!receipt) throw httpError(404, '指令回执不存在。');
      receipt.status = status;
      receipt.deliveredAt ||= nowIso();
      if (status === 'confirmed') receipt.confirmedAt = nowIso();
      publishedEvent = eventFor(state, located.run.id, 'teacher.command.receipt', { commandId, participantId: located.participant.id, status });
      result = receipt;
    });
    realtime.publish(publishedEvent.runId, publishedEvent);
    return result;
  }

  async function getReview(runId) {
    const state = await store.read();
    const run = findRun(state, runId);
    const snap = snapshot(state, run);
    return {
      ...snap,
      interventions: state.interventions.filter((item) => item.runId === runId),
      auditEvents: state.auditEvents.filter((item) => item.runId === runId).slice(-100).reverse(),
      resolvedAlerts: state.alerts.filter((item) => item.runId === runId && ['resolved', 'false_alarm'].includes(item.status)),
    };
  }

  async function recordAudit(runId, input) {
    let result;
    await store.transaction((state) => {
      findRun(state, runId);
      result = {
        id: id('audit'), runId, actorId: input.actorId, action: input.action,
        subject: input.subject || { runId }, reason: input.reason, payload: input.payload || {}, createdAt: nowIso(),
      };
      state.auditEvents.push(result);
      eventFor(state, runId, 'audit.recorded', { auditId: result.id, action: result.action });
    });
    return result;
  }

  return {
    assertTeacherAccess, bindLearnerSession, commandsForSession, confirmCommand, createRun, ensureDemoRun, getEvents,
    getReview, getSnapshot, importRoster, listRuns, preflight, realtime, recordAudit, reportPresence, requestHelp, sendCommand,
    updateAlert, updateParticipant,
  };
}
