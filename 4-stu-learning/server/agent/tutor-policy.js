/**
 * 教学决策器：把语义理解结果映射成一个确定性的教学动作。
 * 纯函数、无 I/O、无外部依赖。防复读规则是本模块存在的核心理由——
 * 同样的求助第二次来必须换策略，连续同一动作第三次必须强制换档。
 */

export const TUTOR_ACTIONS = Object.freeze([
  'reply_natural',
  'give_scaffold',
  'advance_pending_question',
  'comfort',
  'redirect_task',
  'guide_location',
]);

const HELP_INTENTS = Object.freeze(['help_start', 'help_stuck', 'request_answer']);
const LOW_EMOTIONS = Object.freeze(['frustrated', 'tired']);
const SWITCH_TARGETS = Object.freeze({
  give_scaffold: 'redirect_task',
  reply_natural: 'redirect_task',
});

const MAX_SCAFFOLD_LEVEL = 4;
const LOW_CONFIDENCE = 0.4;
const REPEAT_LIMIT = 2;

function normalizeUnderstanding(value) {
  const confidence = Number(value?.confidence);
  return {
    intent: String(value?.intent || 'unknown'),
    emotion: String(value?.emotion || 'neutral'),
    answersPendingQuestion: value?.answersPendingQuestion === true,
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}

function normalizeContext(value) {
  const level = Math.round(Number(value?.scaffoldLevel));
  return {
    scaffoldLevel: Math.max(0, Math.min(MAX_SCAFFOLD_LEVEL, Number.isFinite(level) ? level : 0)),
    recentActions: Array.isArray(value?.recentActions) ? value.recentActions.filter(Boolean) : [],
  };
}

function baseDecision(understanding) {
  if (understanding.intent === 'emotional_low' || LOW_EMOTIONS.includes(understanding.emotion)) {
    return { action: 'comfort', reason: '学生情绪低落，情绪安抚优先于任务推进。' };
  }
  if (understanding.answersPendingQuestion) {
    return { action: 'advance_pending_question', reason: '学生在回答待答问题，交给待答问题流转。' };
  }
  if (['greeting', 'chat_offtopic'].includes(understanding.intent)) {
    return { action: 'reply_natural', reason: '寒暄或闲聊，先自然接住学生这句话。' };
  }
  // 位置求助有确定的工具动作（打开导航），不进防复读换档——学生问两次路要给两次路。
  if (understanding.intent === 'asking_location') {
    return { action: 'guide_location', reason: '学生在问路，直接打开当前任务地点的导航。' };
  }
  if (HELP_INTENTS.includes(understanding.intent)) {
    return {
      action: 'give_scaffold',
      reason: understanding.intent === 'request_answer'
        ? '学生直接要答案，按平台苏格拉底底线改为给分级提示。'
        : '学生求助，给当前小步的分级提示。',
    };
  }
  if (understanding.intent === 'claim_done') {
    return { action: 'redirect_task', reason: '口头声称完成不推进进度，指引学生用工具提交证据。' };
  }
  if (understanding.intent === 'unknown' || understanding.confidence < LOW_CONFIDENCE) {
    return { action: 'reply_natural', reason: '意图不明或置信度偏低，温和澄清一句。' };
  }
  return { action: 'reply_natural', reason: '先自然回应，由回应生成层决定是否检索课程知识。' };
}

/** 同类求助连续出现时升一档脚手架，已到最高级则不越界。 */
function withScaffoldUpgrade(decision, understanding, context) {
  if (decision.action !== 'give_scaffold' || !HELP_INTENTS.includes(understanding.intent)) return decision;
  const repeated = [...context.recentActions].reverse().find((entry) => (
    entry?.action === 'give_scaffold' && HELP_INTENTS.includes(String(entry?.intent))
  ));
  if (!repeated) return decision;
  const delta = Math.max(0, Math.min(1, MAX_SCAFFOLD_LEVEL - context.scaffoldLevel));
  return {
    action: 'give_scaffold',
    params: { scaffoldLevelDelta: delta },
    reason: delta > 0
      ? '同类求助第二次，升档。'
      : '同类求助第二次，升档，但脚手架已到最高级。',
  };
}

// 带确定性副作用的动作不参与防复读：学生问两次路就该得到两次导航，
// 待答问题的是/否也必须每次都被采纳。防复读只治"话术复读"。
const REPEAT_EXEMPT = Object.freeze(['guide_location', 'advance_pending_question']);

/** 连续两次同一动作后强制换档，优先级高于升档。 */
function withForcedSwitch(decision, context) {
  if (REPEAT_EXEMPT.includes(decision.action)) return decision;
  const recent = context.recentActions.slice(-REPEAT_LIMIT);
  if (recent.length < REPEAT_LIMIT) return decision;
  if (!recent.every((entry) => entry?.action === decision.action)) return decision;
  return {
    action: SWITCH_TARGETS[decision.action] || 'reply_natural',
    params: {},
    reason: '防复读强制换。',
  };
}

export function decideTutorAction(understanding, context) {
  const parsed = normalizeUnderstanding(understanding);
  const state = normalizeContext(context);
  const base = { params: {}, ...baseDecision(parsed) };
  const upgraded = { params: {}, ...withScaffoldUpgrade(base, parsed, state) };
  const final = withForcedSwitch(upgraded, state);
  return {
    action: final.action,
    params: final.params || {},
    reason: final.reason,
  };
}
