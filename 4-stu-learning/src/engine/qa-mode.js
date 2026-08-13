function envBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

export function qaForceCompleteEnabled(metaEnv = {}) {
  // 普通的 Vite 开发页也是学生体验页，不能因 DEV 自动混入跳关按钮。
  // 底层能力仅供显式的 QA 构建开启。
  return envBoolean(metaEnv.VITE_QA_FORCE_COMPLETE_ENABLED);
}
