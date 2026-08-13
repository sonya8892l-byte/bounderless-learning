function claimError(code, message, details = {}) {
  return Object.assign(new Error(message), {
    statusCode: 409,
    code,
    details,
  });
}

export function roleOptionsForRun(run) {
  const configured = Array.isArray(run?.roleOptions) ? run.roleOptions : [];
  if (configured.length) return configured;
  const seen = new Set();
  return (run?.participants || []).flatMap((participant) => {
    const id = String(participant.roleId || '').trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: participant.roleName || id }];
  });
}

export function normalizeRunRoleClaims(run) {
  if (!run || run.roleClaimMode === 'student_claim') return run;
  const options = roleOptionsForRun(run);
  run.roleOptions = options;
  // 旧版正式场次把角色预填成“席位”，却没有真实领取事件。
  // 仅保留已有可审计领取标记的记录；演示场次的 roleClaimed 为 true。
  for (const participant of run.participants || []) {
    const auditedClaim = Boolean(
      participant.roleClaimedAt
      || participant.roleClaimSource
      || (participant.learnerSessionId && participant.device?.roleClaimed === true),
    );
    const demoSeed = run.demoMode === true && participant.device?.roleClaimed === true;
    const claimed = auditedClaim || demoSeed;
    if (!claimed) {
      participant.roleId = '';
      participant.roleName = '';
      if (participant.device) participant.device.roleClaimed = false;
    }
  }
  run.roleClaimMode = 'student_claim';
  return run;
}

export function learnerRoleState(run, participant) {
  const options = roleOptionsForRun(run);
  const takenRoleIds = [...new Set(
    (run?.participants || [])
      .filter((item) => item.groupId === participant?.groupId && item.roleId)
      .map((item) => item.roleId),
  )];
  const takenByOthers = new Set(
    (run?.participants || [])
      .filter((item) => item.id !== participant?.id && item.groupId === participant?.groupId && item.roleId)
      .map((item) => item.roleId),
  );
  return {
    claimedRoleId: participant?.roleId || '',
    claimedRoleName: participant?.roleName || '',
    takenRoleIds,
    availableRoleIds: options
      .map((option) => option.id)
      .filter((roleId) => !takenByOthers.has(roleId)),
  };
}

export function duplicateGroupRoleClaims(run) {
  const owners = new Map();
  const conflicts = new Map();
  for (const participant of run?.participants || []) {
    const roleId = String(participant.roleId || '').trim();
    if (!roleId) continue;
    const groupId = String(participant.groupId || '').trim();
    const key = `${groupId}\u0000${roleId}`;
    const owner = owners.get(key);
    if (!owner) {
      owners.set(key, participant.id);
      continue;
    }
    const conflict = conflicts.get(key) || {
      groupId,
      roleId,
      participantIds: [owner],
    };
    conflict.participantIds.push(participant.id);
    conflicts.set(key, conflict);
  }
  return [...conflicts.values()];
}

export function claimParticipantRole({
  run,
  participant,
  sessionId,
  roleId,
  source = 'student',
  now = new Date().toISOString(),
}) {
  const normalizedRoleId = String(roleId || '').trim();
  const role = roleOptionsForRun(run).find((option) => option.id === normalizedRoleId);
  if (!role) {
    throw Object.assign(new Error('该角色不存在或已下线。'), {
      statusCode: 422,
      code: 'COURSE_ROLE_NOT_FOUND',
      details: { roleId: normalizedRoleId },
    });
  }

  const sameClaim = participant.roleId === normalizedRoleId;
  if (!sameClaim && source === 'student') {
    if (run.status !== 'active') {
      throw claimError('COURSE_RUN_NOT_ACTIVE', '课程尚未开始，请等待老师。');
    }
    if (run.paused) throw claimError('COURSE_RUN_PAUSED', '课程已暂停，请等待老师恢复。');
    if (run.rallyActive) throw claimError('COURSE_RUN_RALLY_ACTIVE', '请先按老师要求前往集合点。');
    if (run.rolesReleased !== true || run.rolesLocked === true) {
      throw claimError('COURSE_ROLES_LOCKED', '老师还没有开放角色领取，或已经停止调换。');
    }
  }
  if (run.status === 'completed') {
    throw claimError('COURSE_RUN_COMPLETED', '本次课程已结束，不能再调整角色。');
  }

  const conflict = (run.participants || []).find((item) => (
    item.id !== participant.id
    && item.groupId === participant.groupId
    && item.roleId === normalizedRoleId
  ));
  if (conflict) {
    throw claimError(
      'COURSE_ROLE_TAKEN',
      `“${role.name}”已被本组其他同学领取，请选择另一个角色。`,
      { roleId: normalizedRoleId },
    );
  }

  participant.roleId = normalizedRoleId;
  participant.roleName = role.name || normalizedRoleId;
  participant.roleClaimedAt ||= now;
  if (!sameClaim) participant.roleClaimedAt = now;
  participant.roleClaimSource = source;
  participant.learnerSessionId = sessionId || participant.learnerSessionId || null;
  participant.device ||= {};
  participant.device.roleClaimed = true;
  return participant;
}
