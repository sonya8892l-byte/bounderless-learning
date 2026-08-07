import { mergeDefaults } from '../../src/engine/platform-defaults.js';

// _platform/voice.md 缺失时的回落。键与 decision.intent 一一对齐，点号后是该 intent
// 内部的分支名。双轨期内不要删除：它同时是模板缺失时的兜底。
export const VOICE_DEFAULTS = Object.freeze({
  'role_assigned.欢迎': '欢迎你，{roleName}！我是{companionName}。{next}',
  'quick_reply_stale.有下一问': '刚才的选项已经失效了。{next}',
  'quick_reply_stale.无下一问': '刚才的选项已经失效了，我们按当前进度继续。',
  'onboarding_not_arrived.无需前往': '这个任务没有指定地点。{next}',
  'onboarding_not_arrived.导航': '好，先跟紧小组和老师。我把前往“{location}”的高德地图打开，到了再告诉我。',
  'onboarding_not_ready.等待': '好，我等你。先检查队伍、物品和周围安全，准备好时告诉我。',
  'pending_answer.未到达导航': '知道了。我把去“{location}”的高德地图打开，你跟着老师和小组移动。',
  'pending_answer.等待准备': '好，我等你。准备好时告诉我就行。',
  'pending_answer.到达确认': '到达确认了。{next}',
  'navigation_completed.已到位': '已经到位了。{next}',
  'navigation_completed.继续小步': '到位验证通过。现在做第{stepNumber}小步：{stepText}。',
  'navigation_completed.小步已完成': '到位验证通过，这个阶段的小步已经完成，可以整理结果提交。',
  'navigation_completed.回到任务': '已经回到“{taskName}”，我们接着当前小步继续。',
  'navigation.无需前往': '当前“{taskName}”不需要前往指定地点，可以直接继续。',
  'navigation.已打开': '我把前往“{location}”的高德地图打开了。请跟随老师统一移动，现场路线变化以老师引导为准。',
});

export const VOICE_KEYS = Object.freeze(Object.keys(VOICE_DEFAULTS));

const VOICE_FALLBACK_DOCUMENT = Object.freeze({
  filename: 'voice.md',
  declaration: Object.freeze({ overridable: true, merge: 'by-key', courseField: '话术覆盖', locked: Object.freeze([]) }),
  entries: VOICE_DEFAULTS,
  sections: Object.freeze({}),
  markdown: '',
});

export function resolveVoice(document, courseOverrides = {}) {
  const { entries, warnings } = mergeDefaults(document || VOICE_FALLBACK_DOCUMENT, courseOverrides);
  const voice = {};
  for (const key of VOICE_KEYS) voice[key] = entries[key] || VOICE_DEFAULTS[key];
  const unknown = Object.keys(courseOverrides).filter((key) => !VOICE_KEYS.includes(key));
  for (const key of unknown) {
    warnings.push({ file: 'voice.md', key, message: `话术覆盖里的「${key}」不是已知模板键，已忽略。` });
  }
  return { voice: Object.freeze(voice), warnings };
}

/**
 * 渲染一条话术。占位符没拿到值时保留 `{名字}` 字面量——宁可让缺值在学生面前显形，
 * 也不要静默变成空串，否则会出现"我把前往「」的地图打开"这种句子。
 */
export function renderVoice(voice, key, params = {}) {
  const template = voice?.[key] || VOICE_DEFAULTS[key];
  if (!template) throw new Error(`话术模板缺少键：${key}`);
  return template.replace(/\{(\w+)\}/g, (literal, name) => {
    const value = params[name];
    return value === undefined || value === null || value === '' ? literal : String(value);
  });
}

/** 模板是课程可写的，因此必须和模型输出一样过防剧透。放在编译期而不是渲染期，运行时行为不变。 */
export function assertVoiceHasNoSpoiler(voice, protectedTerms = []) {
  for (const term of protectedTerms) {
    const text = String(term || '').trim();
    if (!text) continue;
    for (const [key, template] of Object.entries(voice)) {
      if (template.includes(text)) {
        throw new Error(`话术模板 ${key} 命中课程保护词「${text}」，会向学生剧透。`);
      }
    }
  }
}
