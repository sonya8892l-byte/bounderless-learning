function normalizedRoleId(value) {
  return String(value || '').trim();
}

function normalizedRoleIds(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map(normalizedRoleId).filter(Boolean))];
}

/**
 * Merge the student-safe role claim projection without treating an omitted
 * field as an empty authoritative list. This matters during mixed-version
 * deploys, where a later command response can contain only the run gate.
 */
export function mergeRoleClaimProjection(previous = {}, runState = {}) {
  const hasClaimedRole = Object.hasOwn(runState, 'claimedRoleId');
  const takenRoleIds = normalizedRoleIds(runState.takenRoleIds);
  const availableRoleIds = normalizedRoleIds(runState.availableRoleIds);
  return {
    claimedRoleId: hasClaimedRole
      ? normalizedRoleId(runState.claimedRoleId) || null
      : normalizedRoleId(previous.claimedRoleId) || null,
    takenRoleIds: takenRoleIds ?? normalizedRoleIds(previous.takenRoleIds),
    availableRoleIds: availableRoleIds ?? normalizedRoleIds(previous.availableRoleIds),
  };
}

/**
 * Resolve one role card from the authoritative group claim projection.
 * The learner's own claimed role stays enterable even when it is also listed
 * in takenRoleIds; locking only prevents moving to a different role.
 */
export function roleClaimChoice({
  roleId,
  standalone = false,
  currentRoleId = '',
  claimedRoleId = '',
  takenRoleIds = null,
  availableRoleIds = null,
  rolesReleased = false,
  rolesLocked = false,
} = {}) {
  const id = normalizedRoleId(roleId);
  const current = normalizedRoleId(currentRoleId);
  const claimed = normalizedRoleId(claimedRoleId);
  const isCurrent = id === current;
  const isOwnClaim = Boolean(id && id === claimed);

  if (standalone) {
    return {
      selectable: true,
      state: isCurrent ? 'current' : 'available',
      label: isCurrent ? '当前角色' : '选择角色',
      reason: '',
    };
  }

  if (isOwnClaim) {
    return {
      selectable: true,
      state: isCurrent ? 'current' : 'claimed',
      label: isCurrent ? '当前角色' : '继续当前角色',
      reason: '',
    };
  }

  if (rolesLocked) {
    return {
      selectable: false,
      state: 'locked',
      label: '已锁定',
      reason: '老师已锁定角色，当前不能更换。',
    };
  }

  if (!rolesReleased) {
    return {
      selectable: false,
      state: 'waiting',
      label: '等待开放',
      reason: '请等待老师开放角色领取。',
    };
  }

  const taken = new Set(normalizedRoleIds(takenRoleIds) || []);
  const available = normalizedRoleIds(availableRoleIds);
  const unavailable = taken.has(id) || (available !== null && !available.includes(id));
  if (unavailable) {
    return {
      selectable: false,
      state: 'taken',
      label: '已领取',
      reason: '这个角色已被同组成员领取，请选择其他角色。',
    };
  }

  return {
    selectable: true,
    state: 'available',
    label: claimed ? '换领角色' : '领取角色',
    reason: '',
  };
}
