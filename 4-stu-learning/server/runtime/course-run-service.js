import crypto from 'node:crypto';
import {
  claimParticipantRole,
  duplicateGroupRoleClaims,
  learnerRoleState,
  normalizeRunRoleClaims,
  roleOptionsForRun,
} from './role-claims.js';

const DEMO_NAMES = [
  '林以安', '周可欣', '陈思远', '顾清禾', '马知遥', '王雨桐',
  '赵书宁', '何嘉木', '许安然', '陆明哲', '吴若溪', '唐予安',
  '宋景行', '沈一诺', '韩知夏', '苏予澄', '姜念安', '程星野',
  '谢予舟', '方楚宁', '叶嘉言', '罗景明', '郑若洵', '徐知闻',
  '秦舒扬', '吴予安', '张景然', '李星阑', '王清越', '刘子衍',
];

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
const JOIN_CREDENTIAL_BYTES = 32;
const RETIRED_LEARNER_SESSION_LIMIT = 100;
const RESET_LEARNING_REASON = '教师一键清零学生学习记录';

function emptyParticipantLearning() {
  return {
    progress: 0,
    currentTask: '待开始',
    currentTaskId: '',
    currentStepId: '',
    currentStepName: '',
    currentStepCompletionMode: '',
    currentStepAttempts: 0,
    currentStepMaxAttempts: 0,
    taskFinalizationStatus: '',
    teacherApprovalAllowed: false,
    teacherApprovalKind: '',
    pendingAdvanceMode: '',
    roleStageName: '',
    stepName: '',
    idleSeconds: 0,
    scaffoldLevel: 0,
    timeBalance: 0,
    evidenceCount: 0,
    dialogueSummary: '',
    lastMeaningfulActionAt: null,
  };
}

function retiredLearnerSessionIds(participant) {
  return Array.isArray(participant?.retiredLearnerSessionIds)
    ? participant.retiredLearnerSessionIds.filter(Boolean)
    : [];
}

function assertLearnerSessionNotReset(run, participant, sessionId) {
  if (!sessionId || !retiredLearnerSessionIds(participant).includes(sessionId)) return;
  throw codedHttpError(
    409,
    'COURSE_SESSION_RESET',
    '这条学习会话已被老师重置，请刷新后重新进入课程。',
    {
      participantId: participant.id,
      sessionId,
      runState: learnerRunState(run, participant),
    },
  );
}

function ensureJoinCredentialSecret(run) {
  if (!run.joinCredentialSecret) {
    run.joinCredentialSecret = crypto.randomBytes(JOIN_CREDENTIAL_BYTES).toString('base64url');
  }
  return run.joinCredentialSecret;
}

function participantJoinCredential(run, participantId) {
  const secret = ensureJoinCredentialSecret(run);
  return crypto.createHmac('sha256', Buffer.from(secret, 'base64url'))
    .update(`${run.id}:${participantId}`)
    .digest('base64url');
}

function secureCredentialEqual(expected, supplied) {
  const left = Buffer.from(String(expected || ''));
  const right = Buffer.from(String(supplied || ''));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function publicParticipantView(participant) {
  const {
    retiredLearnerSessionIds: _retiredLearnerSessionIds,
    learningResetGeneration: _learningResetGeneration,
    ...publicParticipant
  } = participant;
  return publicParticipant;
}

function teacherRunView(run) {
  return {
    ...run,
    participants: Array.isArray(run.participants)
      ? run.participants.map(publicParticipantView)
      : run.participants,
    joinCredentialSecret: undefined,
  };
}

function httpError(statusCode, message, details) {
  return Object.assign(new Error(message), { statusCode, details });
}

function codedHttpError(statusCode, code, message, details) {
  return Object.assign(httpError(statusCode, message, details), { code });
}

function courseCenter(course) {
  const configured = course.lesson.mapCenter;
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

function taskById(course, taskId) {
  if (!taskId) return null;
  const roleTask = course.roles
    .flatMap((role) => role.tasks || [])
    .find((task) => task.id === taskId);
  if (roleTask) return roleTask;
  return Object.values(course.phaseTracks || {})
    .flatMap((track) => track.tasks || [])
    .find((task) => task.id === taskId) || null;
}

function insideTaskFence(course, taskId, lng, lat) {
  const task = taskById(course, taskId);
  const coordinates = task?.location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [targetLng, targetLat] = coordinates.map(Number);
  if (![targetLng, targetLat, lng, lat].every(Number.isFinite)) return null;
  const radians = (degrees) => degrees * (Math.PI / 180);
  const dLat = radians(lat - targetLat);
  const dLng = radians(lng - targetLng);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(targetLat)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
  const distanceMeters = 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  const radiusMeters = Number(task.location.radiusMeters || task.location.radius || 50);
  return distanceMeters <= radiusMeters;
}

function makeExperienceRoster(course, { participantName = '体验学生' } = {}) {
  const center = courseCenter(course);
  if (!center) throw httpError(422, `课程「${course.lesson.title}」缺少坐标中心，无法创建安全场次。`);
  const groupId = 'group-1';
  const participantId = 'student-1-1';
  return {
    center,
    groups: [{
      id: groupId,
      name: '第 1 小组',
      memberIds: [participantId],
      progress: 0,
      timeRemainingSeconds: 5400,
      bankBalance: 0,
      collectionCount: 0,
    }],
    participants: [{
      id: participantId,
      name: participantName,
      rosterAssigned: true,
      groupId,
      roleId: '',
      roleName: '',
      learnerSessionId: null,
      retiredLearnerSessionIds: [],
      learningResetGeneration: 0,
      online: false,
      presenceObservedAt: null,
      device: {
        loggedIn: false,
        location: 'unknown',
        camera: 'unknown',
        cameraObservedAt: null,
        network: 'offline',
        roleClaimed: false,
      },
      location: {
        lng: null,
        lat: null,
        accuracyMeters: null,
        insideFence: null,
        permission: 'unknown',
        observedAt: null,
      },
      learning: emptyParticipantLearning(),
      latestDirective: null,
    }],
  };
}

function makeParticipants(course, groupCount = 5, { demo = false, experience = false, participantName } = {}) {
  if (experience) return makeExperienceRoster(course, { participantName });
  const center = courseCenter(course);
  if (!center) throw httpError(422, `课程「${course.lesson.title}」缺少坐标中心，无法创建安全场次。`);
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
      const neutralName = `学习者${index + 1}`;
      participants.push({
        id: participantId,
        name: demo ? (DEMO_NAMES[index] || neutralName) : neutralName,
        rosterAssigned: demo,
        groupId,
        roleId: demo ? role.id : '',
        roleName: demo ? role.name : '',
        learnerSessionId: null,
        retiredLearnerSessionIds: [],
        learningResetGeneration: 0,
        online: demo ? !stale : false,
        presenceObservedAt: demo ? observedAt : null,
        device: {
          loggedIn: demo,
          location: demo ? (index === 7 ? 'attention' : 'ready') : 'unknown',
          camera: demo ? 'ready' : 'unknown',
          cameraObservedAt: demo ? observedAt : null,
          network: demo ? (stale ? 'offline' : (index % 8 === 0 ? 'weak' : 'ready')) : 'offline',
          roleClaimed: demo,
        },
        location: {
          lng: demo ? center[0] + Math.cos(angle) * distance : null,
          lat: demo ? center[1] + Math.sin(angle) * distance : null,
          accuracyMeters: demo ? (index % 7 === 0 ? 48 : 16 + (index % 5) * 4) : null,
          insideFence: demo ? index !== 11 : null,
          permission: demo ? 'granted' : 'unknown',
          observedAt: demo ? observedAt : null,
        },
        learning: {
          progress: demo ? Math.min(100, 22 + groupIndex * 9 + roleIndex * 7) : 0,
          currentTask: demo ? (task?.name || '待开始') : '待开始',
          currentTaskId: demo ? (task?.id || '') : '',
          currentStepId: demo ? (task?.steps?.[0]?.id || '') : '',
          currentStepName: demo ? (task?.steps?.[0]?.name || task?.steps?.[0]?.studentAction || '') : '',
          currentStepCompletionMode: demo ? (task?.steps?.[0]?.completionMode || '') : '',
          currentStepAttempts: 0,
          currentStepMaxAttempts: demo ? Math.max(0, Number(task?.steps?.[0]?.maxAttempts || 0)) : 0,
          taskFinalizationStatus: '',
          teacherApprovalAllowed: false,
          teacherApprovalKind: '',
          pendingAdvanceMode: '',
          roleStageName: demo ? (task?.name || '现场任务') : '',
          stepName: demo ? (task?.steps?.[0]?.name || task?.requirement || '完成当前观察') : '',
          idleSeconds: demo ? (index === 8 ? 260 : 20 + index * 4) : 0,
          scaffoldLevel: demo ? index % 3 : 0,
          timeBalance: demo ? 10 + (index % 6) : 0,
          // 证据条数由服务端从 Agent session.learningState.evidenceIds 投影。
          // 这里从 0 起，不再造演示数字——教师要靠它判断该不该点「人工通过」。
          evidenceCount: 0,
          dialogueSummary: demo && index === 8
            ? '学生已尝试两种记录方式，仍不确定应选择哪一处作为证据。'
            : demo ? '学生正在按任务要求收集现场证据，尚未出现明显理解偏差。' : '',
          lastMeaningfulActionAt: demo ? observedAt : null,
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
      bankBalance: demo ? 15 + groupIndex * 2 : 0,
      collectionCount: 0,
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
  return normalizeRunRoleClaims(run);
}

function locateParticipant(state, sessionId, participantId) {
  for (const run of state.runs) {
    normalizeRunRoleClaims(run);
    const participant = run.participants.find((item) => (
      (sessionId && item.learnerSessionId === sessionId) || (participantId && item.id === participantId)
    ));
    if (participant) return { run, participant };
  }
  return null;
}

function learnerRunState(run, participant = null) {
  return {
    status: run.status,
    paused: Boolean(run.paused),
    rallyActive: Boolean(run.rallyActive),
    rolesReleased: Boolean(run.rolesReleased),
    rolesLocked: Boolean(run.rolesLocked),
    phaseId: run.phaseId,
    phaseIndex: run.phaseIndex,
    version: run.version,
    ...(participant ? learnerRoleState(run, participant) : {}),
  };
}

function enrichRoleClaimError(error, run, participant) {
  error.details = {
    ...(error.details || {}),
    runState: learnerRunState(run, participant),
  };
  return error;
}

function resolveLearnerBinding(state, {
  runId, participantId, groupId, roleId, courseId, joinCredential,
} = {}, { requireJoinCredential = false, trustedIdentity = false } = {}) {
  if (runId) {
    if (!participantId) {
      throw httpError(422, '指定教师场次时必须提供有效的学生身份。');
    }
    const run = state.runs.find((item) => item.id === runId);
    if (run) normalizeRunRoleClaims(run);
    const participant = run?.participants.find((item) => item.id === participantId);
    if (!run || !participant || (courseId && run.courseId !== courseId)) {
      throw httpError(422, '学生身份与指定的课程场次不匹配。');
    }
    if (requireJoinCredential && !trustedIdentity) {
      if (!joinCredential) {
        throw Object.assign(new Error('请使用老师发放的专属入课链接。'), {
          statusCode: 401,
          code: 'JOIN_CREDENTIAL_REQUIRED',
        });
      }
      if (!secureCredentialEqual(participantJoinCredential(run, participant.id), joinCredential)) {
        throw Object.assign(new Error('入课凭证与该学生身份不匹配。'), {
          statusCode: 403,
          code: 'JOIN_CREDENTIAL_INVALID',
        });
      }
    }
    return { run, participant };
  }

  for (const run of state.runs.filter((item) => item.status === 'active')) {
    normalizeRunRoleClaims(run);
    const participant = (participantId
      ? run.participants.find((item) => item.id === participantId)
      : null)
      || run.participants.find((item) => item.groupId === groupId && item.roleId === roleId);
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

const RUN_WIDE_COMMANDS = new Set([
  'pause', 'resume', 'release_roles', 'lock_roles', 'start_phase',
  'advance_phase', 'end_run', 'emergency_rally',
]);

function normalizedCommandPayload(run, input, course) {
  if (RUN_WIDE_COMMANDS.has(input.action) && input.target?.scope !== 'all') {
    throw httpError(400, '该教师指令必须作用于整个课程场次。');
  }
  const payload = { ...(input.payload || {}) };
  if (['add_time', 'remove_time'].includes(input.action)) {
    const amount = Number(payload.amount ?? (input.action === 'add_time' ? 3 : 1));
    if (!Number.isInteger(amount) || amount < 1 || amount > 60) {
      throw httpError(400, '时间调整必须是 1–60 分钟的整数。');
    }
    payload.amount = amount;
  }
  if (input.action === 'set_scaffold') {
    const level = Number(payload.level);
    if (!Number.isInteger(level) || level < 0 || level > 4) {
      throw httpError(400, '脚手架等级必须是 L0–L4。');
    }
    payload.level = level;
  }
  if (input.action === 'start_phase' && run.status !== 'draft') {
    throw httpError(409, '课程已经开始，不能重复执行开始指令。');
  }
  if (input.action === 'lock_roles') {
    if (run.rolesReleased !== true) {
      throw codedHttpError(409, 'COURSE_ROLES_NOT_RELEASED', '角色领取尚未开放，无需锁定。');
    }
    const duplicateClaims = duplicateGroupRoleClaims(run);
    if (duplicateClaims.length) {
      throw codedHttpError(
        409,
        'COURSE_ROLE_CLAIMS_CONFLICT',
        '场次中存在同组重复角色，请先修复角色领取状态。',
        { conflicts: duplicateClaims },
      );
    }
    const missingClaims = run.participants.filter((participant) => (
      participant.rosterAssigned === true && !participant.roleId
    ));
    if (missingClaims.length) {
      throw codedHttpError(
        409,
        'COURSE_ROLE_CLAIMS_INCOMPLETE',
        `还有 ${missingClaims.length} 名学生未领取角色，暂不能锁定。`,
        { participantIds: missingClaims.map((participant) => participant.id) },
      );
    }
  }
  if (input.action === 'advance_phase') {
    if (run.status !== 'active') throw httpError(409, '课程尚未开始，不能推进阶段。');
    const phases = course?.lesson?.phases || [];
    const nextPhase = phases[run.phaseIndex + 1];
    if (!nextPhase) throw httpError(409, '当前已经是课程最后一个阶段。');
    if (payload.phaseId && payload.phaseId !== nextPhase.id) {
      throw httpError(400, '只能推进到课程定义的下一个阶段。');
    }
    payload.phaseId = nextPhase.id;
    payload.phaseName = nextPhase.name;
  }
  return payload;
}

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalJsonValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalJsonValue(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalJsonValue(value));
}

/**
 * Rebuild the payload projection that the original command would have stored,
 * without re-running state-transition validation against the run's new state.
 * This lets a retry of `advance_phase` replay after the phase has advanced,
 * while a changed request using the same key still conflicts.
 */
function comparableRetryPayload(input, duplicate) {
  const payload = { ...(input.payload || {}) };
  if (['add_time', 'remove_time'].includes(input.action)) {
    const amount = Number(payload.amount ?? (input.action === 'add_time' ? 3 : 1));
    if (Number.isFinite(amount)) payload.amount = amount;
  }
  if (input.action === 'set_scaffold') {
    const level = Number(payload.level);
    if (Number.isFinite(level)) payload.level = level;
  }
  if (input.action === 'advance_phase' && duplicate.action === 'advance_phase') {
    const suppliedPhaseId = String(payload.phaseId || '').trim();
    if (!suppliedPhaseId || suppliedPhaseId === duplicate.payload?.phaseId) {
      payload.phaseId = duplicate.payload?.phaseId;
      payload.phaseName = duplicate.payload?.phaseName;
    }
  }
  return payload;
}

function idempotencyConflictFields(duplicate, input) {
  const conflicts = [];
  if (duplicate.action !== input.action) conflicts.push('action');
  if (canonicalJson(duplicate.target) !== canonicalJson(input.target)) conflicts.push('target');
  if (String(duplicate.reason || '') !== String(input.reason || '')) conflicts.push('reason');
  if (canonicalJson(duplicate.payload || {}) !== canonicalJson(comparableRetryPayload(input, duplicate))) {
    conflicts.push('payload');
  }
  return conflicts;
}

function commandResponse(state, command, fallbackRunVersion) {
  return {
    ...command,
    receipts: state.receipts.filter((item) => item.commandId === command.id),
    runVersion: Number(command.runVersion || fallbackRunVersion),
  };
}

function snapshot(state, run, { includeJoinCredentials = false } = {}) {
  const currentTime = Date.now();
  const openAlerts = state.alerts
    .filter((alert) => alert.runId === run.id && !['resolved', 'false_alarm'].includes(alertStatus(alert)))
    .sort((a, b) => alertRank(a.severity) - alertRank(b.severity) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const participants = run.participants.map((participant) => {
    const locationObservedAt = participant.location.observedAt || null;
    const observedTime = Date.parse(locationObservedAt || '');
    const hasCoordinates = Number.isFinite(participant.location.lng)
      && Number.isFinite(participant.location.lat);
    const hasLocationObservation = hasCoordinates && Number.isFinite(observedTime);
    const age = hasLocationObservation
      ? Math.max(0, Math.floor((currentTime - observedTime) / 1000))
      : null;
    const positionStatus = age === null ? 'unknown' : (age > 180 ? 'lost' : (age > 60 ? 'stale' : 'fresh'));
    return {
      ...publicParticipantView(participant),
      device: {
        ...participant.device,
        roleClaimed: Boolean(participant.roleId),
      },
      ...(includeJoinCredentials ? { joinCredential: participantJoinCredential(run, participant.id) } : {}),
      presenceObservedAt: participant.presenceObservedAt || null,
      locationObservedAt,
      positionAgeSeconds: age,
      positionStatus,
    };
  });
  const groups = run.groups.map((group) => {
    const members = participants.filter((participant) => participant.groupId === group.id);
    const alerts = openAlerts.filter((alert) => alert.groupId === group.id);
    const collectionTotal = roleOptionsForRun(run).length || members.length;
    const collectionCount = new Set(members
      .filter((participant) => participant.roleId && Number(participant.learning.progress) >= 100)
      .map((participant) => participant.roleId)).size;
    return {
      ...group,
      progress: Math.round(members.reduce((sum, item) => sum + item.learning.progress, 0) / Math.max(1, members.length)),
      collectionCount,
      collectionTotal,
      collectionReady: collectionTotal > 0 && collectionCount >= collectionTotal,
      onlineCount: members.filter((item) => item.online).length,
      alertCount: alerts.length,
      highestSeverity: alerts.sort((a, b) => alertRank(a.severity) - alertRank(b.severity))[0]?.severity || null,
      members,
    };
  });
  return {
    run: { ...teacherRunView(run), participants: undefined, groups: undefined },
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

export function createCourseRunService({
  store,
  getCourse,
  realtime,
  requireJoinCredential = false,
  listLearnerSessionsForParticipant = null,
  removeLearnerSessionsForParticipant = null,
}) {
  async function assertTeacherAccess(runId, teacherId) {
    const state = await store.read();
    const run = findRun(state, runId);
    if (run.teacherId !== teacherId) throw httpError(403, '你无权访问该班级场次。');
    return true;
  }

  async function persistRun(input = {}, { demo = false } = {}) {
    const course = await getCourse(input.courseId || 'lesson_gewu_001');
    const experiencePack = input.experiencePack === true;
    const { groups, participants, center } = makeParticipants(
      course,
      Number(input.groupCount || (experiencePack ? 1 : 5)),
      { demo, experience: experiencePack, participantName: input.participantName },
    );
    const createdAt = nowIso();
    const run = {
      id: id('run'),
      joinCredentialSecret: crypto.randomBytes(JOIN_CREDENTIAL_BYTES).toString('base64url'),
      teacherId: input.teacherId || 'teacher-demo',
      demoMode: demo,
      experiencePack,
      teacherName: input.teacherName || (experiencePack ? '体验教师' : '带队教师'),
      courseId: course.id,
      courseVersion: input.courseVersion || '1.0.0',
      courseTitle: course.lesson.title,
      className: input.className || (experiencePack ? '体验场次' : '故宫研学班'),
      // 当前原型创建后即可体验；课前检查继续提示问题，不再成为二次开课门禁。
      status: input.status || 'active',
      phaseId: course.lesson.phases[0]?.id || 'phase-1',
      phaseName: course.lesson.phases[0]?.name || '课前准备',
      phaseIndex: 0,
      phaseRemainingSeconds: 5400,
      paused: false,
      rallyActive: false,
      rolesReleased: true,
      rolesLocked: false,
      entryCode: String(Math.floor(100000 + Math.random() * 900000)),
      mapAsset: `/${course.lesson.assets.navigationMap}`,
      mapCenter: center,
      groupCount: groups.length,
      roleClaimMode: 'student_claim',
      roleOptions: course.roles.map((role) => ({ id: role.id, name: role.name })),
      groups,
      participants,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    };
    let created = run;
    let publishedEvent;
    await store.transaction((state) => {
      if (experiencePack) {
        const existing = state.runs.find((item) => item.teacherId === run.teacherId && item.experiencePack === true);
        if (existing) {
          created = existing;
          return;
        }
      }
      state.runs.push(run);
      audit(state, run.id, run.teacherId, 'run.created', { runId: run.id }, input.reason || '创建场次');
      publishedEvent = eventFor(state, run.id, 'run.created', { runId: run.id });
    });
    if (publishedEvent) realtime.publish(created.id, publishedEvent);
    return teacherRunView(created);
  }

  async function createRun(input = {}) {
    return persistRun(input);
  }

  async function ensureExperienceRun(input = {}) {
    const teacherId = String(input.teacherId || '').trim();
    if (!teacherId) throw httpError(400, '体验场次缺少教师身份。');
    const state = await store.read();
    const existing = state.runs.find((run) => run.teacherId === teacherId && run.experiencePack === true);
    if (existing) return teacherRunView(existing);
    const teacherName = String(input.teacherName || '体验教师').trim() || '体验教师';
    return persistRun({
      teacherId,
      teacherName,
      className: input.className || `${teacherName} · 体验场次`,
      courseId: input.courseId || 'lesson_gewu_001',
      courseVersion: input.courseVersion,
      groupCount: 1,
      experiencePack: true,
      participantName: input.participantName || '体验学生',
      status: 'active',
      reason: input.reason || '初始化体验场次',
    });
  }

  async function ensureDemoRun() {
    const state = await store.read();
    const existing = state.runs.find((run) => run.teacherId === 'teacher-demo');
    if (existing) {
      if (existing.demoMode !== true) {
        await store.transaction((next) => {
          const saved = next.runs.find((run) => run.id === existing.id);
          if (saved) {
            saved.demoMode = true;
            normalizeRunRoleClaims(saved);
          }
        });
      }
      const refreshed = (await store.read()).runs.find((run) => run.id === existing.id) || existing;
      return teacherRunView(refreshed);
    }
    const run = await persistRun(
      { status: 'active', className: '五年级·故宫研学', reason: '初始化演示场次' },
      { demo: true },
    );
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
    return teacherRunView(run);
  }

  async function listRuns(teacherId = 'teacher-demo') {
    const state = await store.read();
    return state.runs.filter((run) => run.teacherId === teacherId)
      .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((run) => ({ ...teacherRunView(run), participants: undefined, groups: undefined }));
  }

  async function getSnapshot(runId) {
    let state = await store.read();
    const rawRun = state.runs.find((item) => item.id === runId);
    if (rawRun && rawRun.roleClaimMode !== 'student_claim') {
      await store.transaction((next) => normalizeRunRoleClaims(findRun(next, runId)));
      state = await store.read();
    }
    let run = findRun(state, runId);
    if (!run.joinCredentialSecret) {
      await store.transaction((next) => ensureJoinCredentialSecret(findRun(next, runId)));
      state = await store.read();
      run = findRun(state, runId);
    }
    // 学生入课凭证只在教师主动打开课前检查时签发；
    // 5 秒轮询的普通快照不反复下发整班 bearer token。
    return snapshot(state, run, { includeJoinCredentials: false });
  }

  async function getEvents(runId, after = 0) {
    const state = await store.read();
    findRun(state, runId);
    return state.events.filter((event) => event.runId === runId && event.sequence > Number(after)).slice(0, 500);
  }

  async function preflight(runId) {
    let state = await store.read();
    let run = findRun(state, runId);
    if (!run.joinCredentialSecret) {
      await store.transaction((next) => ensureJoinCredentialSecret(findRun(next, runId)));
      state = await store.read();
      run = findRun(state, runId);
    }
    const checks = [
      {
        id: 'roster',
        label: '名单与入课',
        required: true,
        passed: run.participants.every((item) => item.rosterAssigned === true && item.device.loggedIn),
        failures: run.participants.filter((item) => item.rosterAssigned !== true || !item.device.loggedIn),
      },
      {
        id: 'groups',
        label: '小组与角色席位',
        required: true,
        passed: run.groups.every((group) => {
          const members = run.participants.filter((item) => item.groupId === group.id);
          const claimedRoleIds = members.map((item) => item.roleId).filter(Boolean);
          return members.length === roleOptionsForRun(run).length
            && new Set(claimedRoleIds).size === claimedRoleIds.length;
        }),
        failures: [],
      },
      { id: 'permissions', label: '设备权限', required: true, passed: run.participants.every((item) => item.device.location === 'ready' && item.device.camera === 'ready'), failures: run.participants.filter((item) => item.device.location !== 'ready' || item.device.camera !== 'ready') },
      { id: 'course', label: '课程版本', required: true, passed: Boolean(run.courseVersion), failures: [] },
      { id: 'safety', label: '路线与安全围栏', required: true, passed: Boolean(run.mapCenter), failures: [] },
    ];
    return {
      checks,
      ready: checks.filter((item) => item.required).every((item) => item.passed),
      joinCredentials: run.participants.map((participant) => ({
        participantId: participant.id,
        name: participant.name,
        groupId: participant.groupId,
        claimedRoleId: participant.roleId || '',
        joinCredential: participantJoinCredential(run, participant.id),
      })),
    };
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
      names.forEach((name, index) => {
        run.participants[index].name = name;
        run.participants[index].rosterAssigned = true;
      });
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
      if (input.recheckDevice) {
        // 教师点「重检」只能请求学生设备重新上报，不能代替设备伪造授权成功。
        participant.device = { ...participant.device, location: 'checking', camera: 'checking' };
      }
      if (input.name) participant.name = input.name;
      const hasRoleInput = Object.hasOwn(input, 'roleId');
      if (input.groupId || hasRoleInput) {
        const groupId = input.groupId || participant.groupId;
        if (!run.groups.some((group) => group.id === groupId)) {
          throw httpError(422, '指定的小组不存在。');
        }
        const roleId = hasRoleInput ? String(input.roleId || '').trim() : participant.roleId;
        const changesActiveTrack = groupId !== participant.groupId || roleId !== participant.roleId;
        if (participant.learnerSessionId && changesActiveTrack) {
          throw codedHttpError(
            409,
            'COURSE_PARTICIPANT_SESSION_ACTIVE',
            '该学生已有活动学习会话；请开放角色调换并由学生在原页面换领，避免会话与教师名单分裂。',
          );
        }
        if (!roleId) {
          participant.groupId = groupId;
          participant.roleId = '';
          participant.roleName = '';
          participant.roleClaimedAt = null;
          participant.roleClaimSource = '';
          participant.device.roleClaimed = false;
        } else {
          const candidate = { ...participant, groupId, device: { ...participant.device } };
          claimParticipantRole({
            run,
            participant: candidate,
            sessionId: participant.learnerSessionId,
            roleId,
            source: 'teacher',
          });
          participant.groupId = candidate.groupId;
          participant.roleId = candidate.roleId;
          participant.roleName = candidate.roleName;
          participant.roleClaimedAt = candidate.roleClaimedAt;
          participant.roleClaimSource = candidate.roleClaimSource;
          participant.device.roleClaimed = true;
        }
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

  async function resetParticipantLearning(runId, participantId, input = {}) {
    const listedSessionIds = typeof listLearnerSessionsForParticipant === 'function'
      && !String(store.kind || '').startsWith('postgres')
      ? await listLearnerSessionsForParticipant({ runId, participantId })
      : [];
    const knownSessionIds = Array.isArray(listedSessionIds) ? listedSessionIds : [];
    let result;
    let cleanupAfterCommit = false;
    let retiredSessionIds = [];
    const publishedEvents = [];

    await store.transaction(async (state, transactionContext = {}) => {
      const run = findRun(state, runId);
      const participant = run.participants.find((item) => item.id === participantId);
      if (!participant) throw httpError(404, '学生不存在。');
      if (run.status === 'completed') {
        throw codedHttpError(
          409,
          'COURSE_RUN_COMPLETED',
          '本次课程已结束，学习记录已转为只读。',
          { currentVersion: run.version },
        );
      }
      const previousSessionId = String(participant.learnerSessionId || '');
      retiredSessionIds = [...new Set([
        ...knownSessionIds,
        ...(previousSessionId ? [previousSessionId] : []),
      ].filter(Boolean))];
      if (typeof transactionContext.deleteLearnerSessionsForParticipant === 'function') {
        const deletedSessionIds = await transactionContext.deleteLearnerSessionsForParticipant({
          runId,
          participantId,
        });
        retiredSessionIds = [...new Set([
          ...retiredSessionIds,
          ...(Array.isArray(deletedSessionIds) ? deletedSessionIds : []),
        ].filter(Boolean))];
      } else {
        cleanupAfterCommit = true;
      }
      const resetAt = nowIso();
      const runCommandIds = new Set(state.commands
        .filter((command) => command.runId === runId)
        .map((command) => command.id));
      const acceptedReceipts = state.receipts.filter((receipt) => (
        receipt.participantId === participantId
        && receipt.status === 'accepted'
        && runCommandIds.has(receipt.commandId)
      ));
      const openAlerts = state.alerts.filter((alert) => (
        alert.runId === runId
        && alert.participantId === participantId
        && !['resolved', 'false_alarm'].includes(alert.status)
      ));
      const initialLearning = emptyParticipantLearning();
      const alreadyReset = retiredSessionIds.length === 0
        && !participant.roleId
        && !participant.roleName
        && !participant.roleClaimedAt
        && !participant.roleClaimSource
        && participant.latestDirective == null
        && participant.online === false
        && participant.presenceObservedAt == null
        && participant.device?.loggedIn === false
        && participant.device?.roleClaimed === false
        && participant.device?.network === 'offline'
        && participant.device?.location === 'unknown'
        && participant.device?.camera === 'unknown'
        && participant.device?.cameraObservedAt == null
        && participant.location?.lng == null
        && participant.location?.lat == null
        && participant.location?.accuracyMeters == null
        && participant.location?.insideFence == null
        && participant.location?.permission === 'unknown'
        && participant.location?.observedAt == null
        && canonicalJson(participant.learning || {}) === canonicalJson(initialLearning)
        && acceptedReceipts.length === 0
        && openAlerts.length === 0;

      if (alreadyReset) {
        result = {
          participantId,
          previousSessionId: null,
          sessionId: null,
          resetAt,
          runVersion: run.version,
          alreadyReset: true,
        };
        return;
      }

      participant.learningResetGeneration = Number(participant.learningResetGeneration || 0) + 1;
      if (retiredSessionIds.length) {
        participant.retiredLearnerSessionIds = [
          ...new Set([...retiredLearnerSessionIds(participant), ...retiredSessionIds]),
        ].slice(-RETIRED_LEARNER_SESSION_LIMIT);
      }
      participant.learnerSessionId = null;
      participant.roleId = '';
      participant.roleName = '';
      participant.roleClaimedAt = null;
      participant.roleClaimSource = '';
      participant.learning = initialLearning;
      participant.latestDirective = null;
      participant.online = false;
      participant.presenceObservedAt = null;
      participant.device = {
        ...participant.device,
        loggedIn: false,
        roleClaimed: false,
        network: 'offline',
        location: 'unknown',
        camera: 'unknown',
        cameraObservedAt: null,
      };
      participant.location = {
        ...participant.location,
        lng: null,
        lat: null,
        accuracyMeters: null,
        insideFence: null,
        permission: 'unknown',
        observedAt: null,
      };

      for (const receipt of acceptedReceipts) {
        receipt.status = 'failed';
        receipt.deliveredAt ||= resetAt;
        publishedEvents.push(eventFor(state, runId, 'teacher.command.receipt', {
          commandId: receipt.commandId,
          participantId,
          status: 'failed',
        }));
      }
      for (const alert of openAlerts) {
        alert.status = 'resolved';
        alert.resolution = RESET_LEARNING_REASON;
        alert.updatedAt = resetAt;
        publishedEvents.push(eventFor(state, runId, 'alert.updated', {
          alertId: alert.id,
          status: alert.status,
        }));
      }

      run.version += 1;
      run.updatedAt = resetAt;
      audit(state, runId, input.actorId, 'participant.learning_reset', { participantId }, RESET_LEARNING_REASON, {
        failedReceiptCount: acceptedReceipts.length,
        resolvedAlertCount: openAlerts.length,
      });
      state.interventions.push({
        id: id('intervention'),
        runId,
        actorId: input.actorId,
        action: 'reset_learning',
        target: { scope: 'participant', id: participantId },
        reason: RESET_LEARNING_REASON,
        createdAt: resetAt,
      });
      publishedEvents.push(eventFor(state, runId, 'participant.learning_reset', {
        participantId,
        runVersion: run.version,
        failedReceiptCount: acceptedReceipts.length,
        resolvedAlertCount: openAlerts.length,
      }));

      result = {
        participantId,
        previousSessionId: previousSessionId || null,
        sessionId: null,
        resetAt,
        runVersion: run.version,
        alreadyReset: false,
      };
    });

    if (cleanupAfterCommit && typeof removeLearnerSessionsForParticipant === 'function') {
      const removedSessionIds = await removeLearnerSessionsForParticipant({
        runId,
        participantId,
        sessionIds: retiredSessionIds,
      });
      const missingTombstones = (Array.isArray(removedSessionIds) ? removedSessionIds : [])
        .filter((sessionId) => sessionId && !retiredSessionIds.includes(sessionId));
      if (missingTombstones.length) {
        await store.transaction((state) => {
          const participant = findRun(state, runId).participants.find((item) => item.id === participantId);
          if (!participant) return;
          participant.retiredLearnerSessionIds = [
            ...new Set([...retiredLearnerSessionIds(participant), ...missingTombstones]),
          ].slice(-RETIRED_LEARNER_SESSION_LIMIT);
        });
      }
    }
    for (const event of publishedEvents) realtime.publish(runId, event);
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
    if (action === 'release_roles') {
      run.rolesReleased = true;
      run.rolesLocked = false;
    }
    if (action === 'lock_roles') {
      run.rolesLocked = true;
    }
    if (action === 'start_phase') run.status = 'active';
    if (action === 'pause') run.paused = true;
    if (action === 'emergency_rally') run.rallyActive = true;
    if (action === 'resume') {
      run.paused = false;
      run.rallyActive = false;
    }
    if (action === 'end_run') {
      run.status = 'completed';
      run.rallyActive = false;
    }
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
      // 教师阶段计时与学生通过任务获得的「时间银行」是两个概念。
      // 加减时间在服务端统一阶段时钟之前暂不改任何学生余额。
      if (action === 'set_scaffold') participant.learning.scaffoldLevel = Number(payload.level || 0);
      // Evidence approval and step skipping are only capabilities delivered to
      // the learner Agent.  Progress is written back by Agent state/presence;
      // the teacher dashboard must not invent a percentage before that succeeds.
      // `advance_task` 只投递指令，真正改会话的是学生端桥回发的 lifecycle_event
      // （见 server/agent/task-advance.js）。这里刻意**不动** participant.learning.progress：
      // 进度前进多少由服务端按真实任务算，教师端不猜。
    }
  }

  async function sendCommand(runId, input) {
    const initialState = await store.read();
    const initialRun = findRun(initialState, runId);
    const knownDuplicate = initialState.commands.find((item) => (
      item.runId === runId && item.idempotencyKey === input.idempotencyKey
    ));
    const course = input.action === 'advance_phase' && !knownDuplicate
      ? await getCourse(initialRun.courseId)
      : null;
    let publishedEvent;
    let result;
    await store.transaction((state) => {
      const run = findRun(state, runId);
      const duplicate = state.commands.find((item) => item.runId === runId && item.idempotencyKey === input.idempotencyKey);
      if (duplicate) {
        const conflictingFields = idempotencyConflictFields(duplicate, input);
        if (conflictingFields.length) {
          throw codedHttpError(
            409,
            'TEACHER_COMMAND_IDEMPOTENCY_CONFLICT',
            '这个幂等键已绑定另一条教师指令，请生成新键后再发送。',
            { teacherCommandId: duplicate.id, conflictingFields },
          );
        }
        result = commandResponse(state, duplicate, run.version);
        return;
      }
      if (run.status === 'completed') {
        throw httpError(409, '本次课程已结束，不能再发送新的教师指令。', {
          code: 'COURSE_RUN_COMPLETED',
          currentVersion: run.version,
        });
      }
      if (Number(input.expectedVersion) !== run.version) {
        throw httpError(409, '场次状态已更新，请确认最新状态。', { currentVersion: run.version });
      }
      const payload = normalizedCommandPayload(run, input, course);
      const participants = targetParticipants(run, input.target);
      if (!participants.length && input.target.scope !== 'all') throw httpError(400, '未找到指令对象。');
      const command = {
        id: id('cmd'), runId, sequence: state.sequence + 1, idempotencyKey: input.idempotencyKey,
        actorId: input.actorId, action: input.action, target: input.target, payload,
        reason: input.reason, status: 'accepted', createdAt: nowIso(), runVersion: run.version + 1,
      };
      state.commands.push(command);
      applyCommand(run, command, participants);
      run.version += 1;
      run.updatedAt = nowIso();
      for (const participant of participants) {
        state.receipts.push({
          id: id('receipt'), commandId: command.id, participantId: participant.id,
          learnerSessionId: participant.learnerSessionId, status: 'accepted',
          acceptedAt: command.createdAt, deliveredAt: null, confirmedAt: null,
          targetSnapshot: {
            taskId: participant.learning.currentTaskId || '',
            stepId: participant.learning.currentStepId || '',
            phaseId: run.phaseId,
            locationObservedAt: participant.location.observedAt || null,
          },
        });
      }
      audit(state, runId, input.actorId, 'teacher.command', input.target, input.reason, {
        commandId: command.id,
        action: input.action,
        teacherCommandId: command.id,
        teacherCommandAction: input.action,
      });
      state.interventions.push({
        id: id('intervention'), runId, commandId: command.id, actorId: input.actorId,
        action: input.action, target: input.target, reason: input.reason, createdAt: command.createdAt,
      });
      publishedEvent = eventFor(state, runId, 'teacher.command.accepted', { commandId: command.id, action: command.action });
      result = commandResponse(state, command, run.version);
    });
    if (publishedEvent) realtime.publish(runId, publishedEvent);
    return result;
  }

  async function validateLearnerBinding(input) {
    let result = null;
    await store.transaction((state) => {
      const located = resolveLearnerBinding(state, input, { requireJoinCredential });
      if (!located) return;
      result = {
        runId: located.run.id,
        participantId: located.participant.id,
        learningResetGeneration: Number(located.participant.learningResetGeneration || 0),
        runState: learnerRunState(located.run, located.participant),
      };
    });
    return result;
  }

  async function bindLearnerSession({
    runId,
    participantId,
    sessionId,
    groupId,
    roleId,
    courseId,
    joinCredential,
    trustedIdentity = false,
    expectedLearningResetGeneration,
  }) {
    let found = null;
    await store.transaction(async (state, transactionContext = {}) => {
      const located = resolveLearnerBinding(state, {
        runId, participantId, groupId, roleId, courseId, joinCredential,
      }, { requireJoinCredential, trustedIdentity });
      if (!located) return;
      const { run, participant } = located;
      if (
        expectedLearningResetGeneration !== undefined
        && Number(expectedLearningResetGeneration) !== Number(participant.learningResetGeneration || 0)
      ) {
        throw codedHttpError(
          409,
          'COURSE_SESSION_RESET',
          '该学生的学习记录已被老师清零，请刷新后重新进入。',
        );
      }
      if (typeof transactionContext.assertLearnerSessionExists === 'function') {
        await transactionContext.assertLearnerSessionExists({ sessionId, runId: run.id, participantId: participant.id });
      }
      assertLearnerSessionNotReset(run, participant, sessionId);
      if (run.status === 'completed') {
        throw codedHttpError(409, 'COURSE_RUN_COMPLETED', '本次课程已结束，不能新建或激活学习会话。');
      }
      const changesActiveSession = Boolean(
        participant.learnerSessionId
        && participant.learnerSessionId !== sessionId,
      );
      const previousRoleId = participant.roleId || '';
      if (roleId) {
        try {
          claimParticipantRole({ run, participant, sessionId, roleId, source: 'student' });
        } catch (error) {
          throw enrichRoleClaimError(error, run, participant);
        }
      } else if (participant.roleId && changesActiveSession) {
        throw codedHttpError(
          409,
          'COURSE_ROLE_TRACK_ACTIVE',
          '已进入角色任务，不能再把选择前的阶段会话设为当前会话。',
        );
      }
      for (const candidateRun of state.runs) {
        for (const candidate of candidateRun.participants) {
          if (candidate !== participant && candidate.learnerSessionId === sessionId) {
            candidate.learnerSessionId = null;
          }
        }
      }
      participant.learnerSessionId = sessionId;
      participant.online = true;
      participant.device.loggedIn = true;
      found = {
        runId: run.id,
        participantId: participant.id,
        runState: learnerRunState(run, participant),
      };
      if (roleId && previousRoleId !== participant.roleId) {
        eventFor(state, run.id, 'participant.role_claimed', {
          participantId: participant.id,
          previousRoleId,
          roleId: participant.roleId,
        });
      }
      eventFor(state, run.id, 'participant.session_bound', found);
    });
    return found;
  }

  async function activateLearnerSession({ runId, participantId, sessionId, courseId, roleId }) {
    if (!runId || !participantId) {
      throw httpError(422, '该学习会话没有可信的教师场次身份，无法激活。');
    }
    return bindLearnerSession({
      runId, participantId, sessionId, courseId, roleId, trustedIdentity: true,
    });
  }

  async function claimRoleForSession({ runId, participantId, sessionId, courseId, roleId }) {
    if (!runId || !participantId || !sessionId) {
      throw httpError(422, '角色领取需要完整的场次、学生和会话身份。');
    }
    let result = null;
    await store.transaction((state) => {
      const { run, participant } = resolveLearnerBinding(state, {
        runId, participantId, courseId,
      }, { trustedIdentity: true });
      if (participant.learnerSessionId !== sessionId) {
        throw codedHttpError(409, 'COURSE_SESSION_INACTIVE', '当前会话已不是该学生的活动会话。');
      }
      const previousRoleId = participant.roleId || '';
      try {
        claimParticipantRole({ run, participant, sessionId, roleId, source: 'student' });
      } catch (error) {
        throw enrichRoleClaimError(error, run, participant);
      }
      if (previousRoleId !== participant.roleId) {
        eventFor(state, run.id, 'participant.role_claimed', {
          participantId: participant.id,
          previousRoleId,
          roleId: participant.roleId,
        });
      }
      result = {
        runId: run.id,
        participantId: participant.id,
        runState: learnerRunState(run, participant),
      };
    });
    return result;
  }

  async function publishRoleClaimed({ runId, participantId, roleId }) {
    const state = await store.read();
    const normalizedRoleId = String(roleId || '').trim();
    const events = state.events || [];
    let persistedEvent = null;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (
        event.runId === runId
        && event.type === 'participant.role_claimed'
        && event.data?.participantId === participantId
        && event.data?.roleId === normalizedRoleId
      ) {
        persistedEvent = event;
        break;
      }
    }
    if (!persistedEvent) return false;
    realtime.publish(runId, persistedEvent);
    return true;
  }

  async function resumeLearnerSession({ runId, participantId, courseId, joinCredential }) {
    if (!runId || !participantId || !courseId) {
      throw httpError(422, '恢复学习会话需要完整的场次、学生和课程身份。');
    }
    let result = null;
    await store.transaction((state) => {
      const { run, participant } = resolveLearnerBinding(state, {
        runId, participantId, courseId, joinCredential,
      }, { requireJoinCredential });
      result = {
        sessionId: participant.learnerSessionId || null,
        runId: run.id,
        participantId: participant.id,
        courseId: run.courseId,
        runState: learnerRunState(run, participant),
      };
      if (result.sessionId) {
        participant.online = true;
        participant.device.loggedIn = true;
        eventFor(state, run.id, 'participant.session_resumed', {
          sessionId: result.sessionId,
          participantId: participant.id,
        });
      }
    });
    return result;
  }

  async function requestHelp(input) {
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const located = locateParticipant(state, input.sessionId);
      if (!located) throw httpError(404, '未找到对应的学生场次，请重新入课。');
      const { run, participant } = located;
      if (input.participantId && input.participantId !== participant.id) {
        throw httpError(403, '学生身份与当前学习会话不匹配。');
      }
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

  async function reportPresence(sessionId, input = {}, { trustedLearningProjection = null } = {}) {
    const rawLng = input.location?.lng;
    const rawLat = input.location?.lat;
    const lng = Number(rawLng);
    const lat = Number(rawLat);
    const permission = ['granted', 'denied', 'prompt', 'unknown', 'unavailable']
      .includes(input.location?.permission)
      ? input.location.permission
      : null;
    const hasFreshCoordinates = rawLng !== null
      && rawLng !== undefined
      && rawLng !== ''
      && rawLat !== null
      && rawLat !== undefined
      && rawLat !== ''
      && Number.isFinite(lng)
      && Number.isFinite(lat)
      && lng >= -180
      && lng <= 180
      && lat >= -90
      && lat <= 90;
    const hasFreshLocationSample = hasFreshCoordinates && (permission === 'granted' || permission === null);
    let locationCourse = null;
    if (hasFreshLocationSample) {
      const initialState = await store.read();
      const initialLocated = locateParticipant(initialState, sessionId);
      if (!initialLocated) throw httpError(404, '学生会话未绑定课程场次。');
      locationCourse = await getCourse(initialLocated.run.courseId);
    }
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const located = locateParticipant(state, sessionId);
      if (!located) throw httpError(404, '学生会话未绑定课程场次。');
      const { run, participant } = located;
      const presenceObservedAt = nowIso();
      participant.online = input.online !== false;
      participant.presenceObservedAt = presenceObservedAt;
      participant.device.loggedIn = true;
      participant.device.network = input.online === false ? 'offline' : (input.network || 'ready');
      if (input.camera) {
        const cameraPermission = ['granted', 'denied', 'prompt', 'unknown', 'unavailable']
          .includes(input.camera.permission)
          ? input.camera.permission
          : 'unknown';
        participant.device.camera = cameraPermission === 'granted'
          ? 'ready'
          : ['denied', 'unavailable'].includes(cameraPermission) ? 'attention' : 'unknown';
        participant.device.cameraObservedAt = presenceObservedAt;
      }
      if (input.location) {
        if (permission) participant.location.permission = permission;
        if (hasFreshLocationSample) {
          participant.location.lng = lng;
          participant.location.lat = lat;
          participant.location.accuracyMeters = Number.isFinite(Number(input.location.accuracyMeters))
            ? Math.max(0, Number(input.location.accuracyMeters))
            : null;
          // insideFence 是教师安全决策字段，只能由服务端按课程坐标与半径计算。
          // 学生端即使传 insideFence=true 也不参与写入。
          participant.location.insideFence = insideTaskFence(
            locationCourse,
            trustedLearningProjection?.currentTaskId || participant.learning.currentTaskId,
            lng,
            lat,
          );
          participant.location.observedAt = presenceObservedAt;
          participant.location.permission = 'granted';
        }
        if (permission === 'denied' || permission === 'unavailable') participant.device.location = 'attention';
        else if (permission === 'granted' || hasFreshLocationSample) participant.device.location = 'ready';
        else if (permission === 'prompt' || permission === 'unknown') participant.device.location = 'unknown';
      }
      if (trustedLearningProjection) {
        const projectionMatches = trustedLearningProjection.sessionId === sessionId
          && trustedLearningProjection.runId === run.id
          && trustedLearningProjection.participantId === participant.id;
        if (!projectionMatches) throw httpError(409, '学习投影与当前场次会话不匹配。');
        // 暂停、集合期间只更新安全心跳与真实 GPS；结课后学习投影永久冻结。
        const learningProjectionAllowed = run.status === 'active' && !run.paused && !run.rallyActive;
        if (learningProjectionAllowed) {
          if (trustedLearningProjection.roleId && trustedLearningProjection.roleId !== participant.roleId) {
            throw codedHttpError(
              409,
              'COURSE_ROLE_TRACK_INACTIVE',
              '该角色会话已不是当前活动轨道，学习投影未写入。',
            );
          }
          if (trustedLearningProjection.roleId
            && trustedLearningProjection.roleId === participant.roleId) {
            participant.device.roleClaimed = true;
          }
          participant.learning.progress = Math.max(0, Math.min(100, Number(trustedLearningProjection.progress || 0)));
          participant.learning.evidenceCount = Math.max(0, Number(trustedLearningProjection.evidenceCount || 0));
          participant.learning.currentTask = String(trustedLearningProjection.currentTask || '待开始').slice(0, 200);
          participant.learning.currentTaskId = String(trustedLearningProjection.currentTaskId || '').slice(0, 160);
          participant.learning.currentStepId = String(trustedLearningProjection.currentStepId || '').slice(0, 160);
          participant.learning.currentStepName = String(trustedLearningProjection.currentStepName || '').slice(0, 300);
          participant.learning.currentStepCompletionMode = String(
            trustedLearningProjection.currentStepCompletionMode || '',
          ).slice(0, 80);
          participant.learning.currentStepAttempts = Math.max(
            0,
            Number(trustedLearningProjection.currentStepAttempts || 0),
          );
          participant.learning.currentStepMaxAttempts = Math.max(
            0,
            Number(trustedLearningProjection.currentStepMaxAttempts || 0),
          );
          participant.learning.taskFinalizationStatus = String(
            trustedLearningProjection.taskFinalizationStatus || '',
          ).slice(0, 80);
          participant.learning.teacherApprovalAllowed = trustedLearningProjection.teacherApprovalAllowed === true;
          participant.learning.teacherApprovalKind = String(
            trustedLearningProjection.teacherApprovalKind || '',
          ).slice(0, 80);
          participant.learning.pendingAdvanceMode = String(
            trustedLearningProjection.pendingAdvanceMode || '',
          ).slice(0, 80);
          participant.learning.idleSeconds = Math.max(0, Number(trustedLearningProjection.idleSeconds || 0));
          participant.learning.lastMeaningfulActionAt = trustedLearningProjection.lastMeaningfulActionAt || null;
        }
      }
      publishedEvent = eventFor(state, run.id, 'participant.presence', {
        participantId: participant.id,
        presenceObservedAt,
        locationObservedAt: participant.location.observedAt || null,
      });
      result = {
        runId: run.id,
        participantId: participant.id,
        presenceObservedAt,
        locationObservedAt: participant.location.observedAt || null,
      };
    });
    realtime.publish(result.runId, publishedEvent);
    return result;
  }

  async function commandsForSession(sessionId, after = 0) {
    let result;
    await store.transaction((state) => {
      const located = locateParticipant(state, sessionId);
      if (!located) {
        result = { commands: [], sequence: state.sequence, runState: null };
        return;
      }
      const receipts = state.receipts.filter((receipt) => (
        receipt.participantId === located.participant.id
        && receipt.status === 'accepted'
        && (!receipt.learnerSessionId || receipt.learnerSessionId === sessionId)
      ));
      // 教师可在学生首次进入前发指令。第一条有效会话领取时把空回执
      // 原子绑定到该会话，随后角色切换不能把旧轨道的指令领走。
      for (const receipt of receipts) receipt.learnerSessionId ||= sessionId;
      const commandIds = new Set(receipts.map((receipt) => receipt.commandId));
      result = {
        commands: state.commands.filter((command) => commandIds.has(command.id) && command.sequence > Number(after))
          .map((command) => ({ ...command, receipt: receipts.find((receipt) => receipt.commandId === command.id) })),
        sequence: state.sequence,
        runState: learnerRunState(located.run, located.participant),
      };
    });
    return result;
  }

  async function assertCommandTargetCurrent(sessionId, commandId, { maxLocationAgeMs = 60_000 } = {}) {
    const state = await store.read();
    const located = locateParticipant(state, sessionId);
    if (!located) throw httpError(404, '学生会话未绑定课程场次。');
    const command = state.commands.find((item) => item.id === commandId && item.runId === located.run.id);
    const receipt = state.receipts.find((item) => (
      item.commandId === commandId
      && item.participantId === located.participant.id
      && item.learnerSessionId === sessionId
    ));
    if (!command || !receipt) throw httpError(404, '指令回执不存在。');
    if (command.action !== 'confirm_arrival') return true;
    const expected = receipt.targetSnapshot?.locationObservedAt || null;
    const current = located.participant.location.observedAt || null;
    const observedTime = Date.parse(current || '');
    const fresh = expected
      && current
      && expected === current
      && Number.isFinite(observedTime)
      && Date.now() - observedTime >= 0
      && Date.now() - observedTime <= maxLocationAgeMs;
    if (!fresh) {
      throw codedHttpError(
        409,
        'TEACHER_LOCATION_SNAPSHOT_STALE',
        '定位快照已经过期或发生变化，请学生重新定位后再确认到达。',
      );
    }
    return true;
  }

  async function runStateForSession(sessionId) {
    let state = await store.read();
    const rawRun = state.runs.find((run) => (
      run.participants?.some((participant) => participant.learnerSessionId === sessionId)
    ));
    if (rawRun && rawRun.roleClaimMode !== 'student_claim') {
      await store.transaction((next) => {
        const matching = next.runs.find((run) => run.id === rawRun.id);
        if (matching) normalizeRunRoleClaims(matching);
      });
      state = await store.read();
    }
    const located = locateParticipant(state, sessionId);
    if (!located) return null;
    return {
      ...learnerRunState(located.run, located.participant),
      runId: located.run.id,
      participantId: located.participant.id,
      courseId: located.run.courseId,
    };
  }

  async function confirmCommand(sessionId, commandId, status = 'confirmed') {
    let result;
    let publishedEvent;
    await store.transaction((state) => {
      const located = locateParticipant(state, sessionId);
      if (!located) throw httpError(404, '学生会话未绑定课程场次。');
      const receipt = state.receipts.find((item) => (
        item.commandId === commandId
        && item.participantId === located.participant.id
        && item.learnerSessionId === sessionId
      ));
      if (!receipt) throw httpError(404, '指令回执不存在。');
      if (receipt.status === 'confirmed' || receipt.status === status) {
        result = receipt;
        return;
      }
      const transitions = {
        accepted: new Set(['delivered', 'failed']),
        delivered: new Set(['confirmed']),
        confirmed: new Set(),
        failed: new Set(),
      };
      if (!transitions[receipt.status]?.has(status)) {
        throw httpError(409, '指令回执状态已更新，不能倒退或改写终态。', {
          currentStatus: receipt.status,
          requestedStatus: status,
        });
      }
      receipt.status = status;
      receipt.deliveredAt ||= nowIso();
      if (status === 'confirmed') receipt.confirmedAt = nowIso();
      publishedEvent = eventFor(state, located.run.id, 'teacher.command.receipt', { commandId, participantId: located.participant.id, status });
      result = receipt;
    });
    if (publishedEvent) realtime.publish(publishedEvent.runId, publishedEvent);
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
    activateLearnerSession, assertCommandTargetCurrent, assertTeacherAccess, bindLearnerSession, claimRoleForSession,
    commandsForSession, confirmCommand, createRun,
    ensureDemoRun, ensureExperienceRun, getEvents,
    getReview, getSnapshot, importRoster, listRuns, preflight, publishRoleClaimed, realtime, recordAudit, reportPresence, requestHelp, sendCommand,
    resetParticipantLearning, resumeLearnerSession, runStateForSession, updateAlert, updateParticipant, validateLearnerBinding,
  };
}
