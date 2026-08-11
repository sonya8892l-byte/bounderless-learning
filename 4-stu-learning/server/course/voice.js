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
  'safety_help.呼叫老师': '收到，我现在帮你呼叫老师。先停在安全的位置，不要独自继续移动。',
  'scaffold_exhausted.转老师': '这一步我把能给的线索都给你了，还是卡着说明它确实难。我请老师过来和你一起看“{taskName}”，你先把已经确认的部分留着。',
  'task_progress.小步记下': '好，第{doneNumber}小步记下了。现在做第{nextNumber}小步：{stepText}。',
  'task_progress.小步全记下': '好，这个阶段的{stepCount}个小步都记下了。现在整理任务卡里的照片或记录，提交给我检查。',
  'task_progress.请提交': '收到。请在“{taskName}”任务卡中提交记录或照片，我会根据提交内容帮你检查。',
  'task_progress.继续任务': '好，我们继续“{taskName}”。我把任务工具打开了，有发现随时告诉我。',
  'task_progress.先去地点': '好，我们先去“{location}”。我把高德地图打开了。',
  'task_step_completed.补充默认语': '这一步还需要补充。',
  'task_step_completed.还需要': '还需要：{items}。',
  'task_step_completed.可呼叫老师': '已达到本步最大尝试次数，可以呼叫老师一起看。',
  'task_step_completed.继续小步': '第{doneNumber}小步完成了。现在做第{nextNumber}小步：{stepText}。',
  'task_step_completed.全部完成': '很好，这个阶段的{stepCount}个小步都完成了。现在整理好照片或记录，在任务卡里提交给我检查。',
  'proactive_nudge.找不到地点': '还顺利吗？如果没找到“{location}”，我把高德地图再放到这里。',
  'proactive_nudge.试一小步': '还顺利吗？可以先试这一小步：{hint}',
  'degraded.情绪': '我在听。你可以慢一点说，我会陪你一起理清。',
  'degraded.任务线索': '我收到啦。先从“{taskName}”里最确定的一条现场线索开始，把它告诉我，我继续陪你分析。',
  'degraded.没接住': '我听见了，不过这句话我还没完全接住。你愿意再多说一点吗？',
  'prelude.求助': '我在。先试一个小步骤：{hint}',
  'prelude.情绪': '我在听，你慢慢说。',
  'prelude.收到提交': '我收到你的提交了，正在看这条证据。',
  'prelude.核对材料': '我先按课程材料帮你核对。',
  'prelude.寒暄': '嗯嗯，我在听～',
  'prelude.澄清': '我在，不过这句话我还没完全接住。',
  'tool.show_navigation': '我把前往“{location}”的高德地图打开了。',
  'tool.open_task_tool': '我把“{taskName}”任务工具打开了，我们继续。',
  'tool.call_teacher': '我现在帮你呼叫老师，请先停在安全的位置。',
  'tool.默认': '我已经打开接下来需要的工具。',
  'knowledge.摘录': '根据课程材料，{excerpt}',
  'onboarding.到达确认': '你已经到“{place}”了吗？',
  'onboarding.到达.已到达': '已到达',
  'onboarding.到达.还在路上': '还在路上',
  'onboarding.到达.需要导航': '需要导航',
  'onboarding.到达.value.已到达': '我已到达',
  'onboarding.到达.value.还在路上': '我还没到',
  'onboarding.到达.value.需要导航': '请帮我导航',
  'onboarding.准备确认': '你准备好开始了吗？',
  'onboarding.准备.现在开始': '现在开始',
  'onboarding.准备.等一下': '等一下',
  'onboarding.准备.value.现在开始': '我准备好了',
  'onboarding.准备.value.等一下': '我还没准备好',
  'conversation_repair.主回复': '你说得对，刚才的回应让人很烦。我先停下来听你说；想继续时告诉我“继续”就行。',
  'unclear_input.首次': '我没太看懂这条消息。你可以换句话说，也可以直接点选项。',
  'unclear_input.再次': '这条我还是没理解。直接点一个选项就可以。',
  'avoid_repeat.conversation_repair': '我听见了，也先不催你。你想说什么就继续说，想回到学习时告诉我“继续”。',
  'avoid_repeat.safety': '老师已经收到求助。请继续停在安全、显眼的位置，不要独自移动；如果身体更不舒服，马上告诉身边的成年人。',
  'avoid_repeat.emotion': '我还在，先照顾好自己。你可以慢慢说，现在不需要赶任务。',
  'avoid_repeat.social': '嗯嗯，我还在听～你可以接着说，想回到学习时告诉我“继续”。',
  'avoid_repeat.有待答': '这件事我已经问过了，你可以直接点下面的选项，我会按你的回答继续。',
  'avoid_repeat.默认': '这句话我刚才说过了。我们接着你现在的想法往下聊。',
});

export const VOICE_KEYS = Object.freeze(Object.keys(VOICE_DEFAULTS));

// 2026-08 把「缺省」统一改成「默认」时留下的旧键名。课程或 _platform/voice.md 仍写旧键时
// 照旧生效：话术键要过 VOICE_KEYS 校验，不认旧名就会被当成"未知键已忽略"，学生那边看到
// 的是默认话术而不是课程写的那句——静默，且很难查。等存量内容都改完再删这张表。
const LEGACY_VOICE_KEYS = Object.freeze({
  'task_step_completed.补充缺省语': 'task_step_completed.补充默认语',
});

const CURRENT_TO_LEGACY_VOICE_KEY = Object.freeze(
  Object.fromEntries(Object.entries(LEGACY_VOICE_KEYS).map(([legacy, current]) => [current, legacy])),
);

/** 把旧键名换成现行键名。传入非旧键时原样返回。 */
function canonicalVoiceKey(key) {
  return LEGACY_VOICE_KEYS[key] || key;
}

/** 现行键名对应的旧键名；没有旧名时返回空串（用它查表拿不到值，正是想要的结果）。 */
function legacyNameOf(key) {
  return CURRENT_TO_LEGACY_VOICE_KEY[key] || '';
}

const VOICE_FALLBACK_DOCUMENT = Object.freeze({
  filename: 'voice.md',
  declaration: Object.freeze({ overridable: true, merge: 'by-key', courseField: '话术覆盖', locked: Object.freeze([]) }),
  entries: VOICE_DEFAULTS,
  sections: Object.freeze({}),
  markdown: '',
});

export function resolveVoice(document, courseOverrides = {}) {
  // 先把旧键名归一，再走合并与未知键校验，否则旧名会被判成未知键而丢掉。
  const normalizedOverrides = {};
  for (const [key, value] of Object.entries(courseOverrides)) normalizedOverrides[canonicalVoiceKey(key)] = value;
  const { entries, warnings } = mergeDefaults(document || VOICE_FALLBACK_DOCUMENT, normalizedOverrides);
  const voice = {};
  for (const key of VOICE_KEYS) voice[key] = entries[key] || entries[legacyNameOf(key)] || VOICE_DEFAULTS[key];
  const unknown = Object.keys(normalizedOverrides).filter((key) => !VOICE_KEYS.includes(key));
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
