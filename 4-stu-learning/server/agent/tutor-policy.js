/**
 * 教学决策器：把语义理解结果映射成一个确定性的教学动作。
 * 纯函数、无 I/O、无外部依赖。
 *
 * 结构上分三段，刻意不混在一条 if-else 链里——它们回答的是三个不同的问题：
 *
 *   ① 分诊链 triage：这句话属于哪一类？互斥、有序，决定 action。
 *      L0 危险紧急 → L1 状态机输入 → L2 任务相关 → L3 活动组织 → L4 兜底
 *   ② 情绪维度 withEmotionTone：不夺权，只决定语气与是否拉回（tone / refocus）。
 *      纯情绪且无具体诉求时才独占动作走 comfort。
 *   ③ 重复治理 withRepeatPolicy：按"族"计数而不是按 action 计数。
 *      求助族到顶转教师而不是撤走帮助；知识/组织族照答并附一句拉回。
 *
 * 为什么这么分：情绪是一个维度而不是一个分支——"这个好难啊我不知道从哪开始"既是
 * frustrated 也是 help_start，把它判成 comfort 就等于撤走了学生要的脚手架。同理，
 * 连续三次问知识不该被"防复读"改成指回任务，那是不回答问题。
 */

export const TUTOR_ACTIONS = Object.freeze([
  'reply_natural',
  'give_scaffold',
  'advance_pending_question',
  'comfort',
  'redirect_task',
  'guide_location',
  // 新增：分诊链各层各自的确定性出口。
  'call_teacher_safety',
  'answer_knowledge',
  'answer_logistics',
  'clarify',
  'escalate_teacher',
]);

const HELP_INTENTS = Object.freeze(['help_start', 'help_stuck', 'request_answer']);
const LOW_EMOTIONS = Object.freeze(['frustrated', 'tired', 'anxious']);

/**
 * 重复治理按族计数：同族连续出现才算"复读"。
 * 不列入任何族的动作（安全、待答问题、导航）完全豁免——学生问两次路就该得到两次导航。
 */
const ACTION_FAMILY = Object.freeze({
  give_scaffold: 'scaffold',
  answer_knowledge: 'knowledge',
  answer_logistics: 'logistics',
  reply_natural: 'social',
  comfort: 'social',
  clarify: 'clarify',
  redirect_task: 'progress',
});

const MAX_SCAFFOLD_LEVEL = 4;
const LOW_CONFIDENCE = 0.4;
const REPEAT_LIMIT = 2;

function normalizeUnderstanding(value) {
  const confidence = Number(value?.confidence);
  const intent = String(value?.intent || 'unknown');
  return {
    intent,
    emotion: String(value?.emotion || 'neutral'),
    answersPendingQuestion: value?.answersPendingQuestion === true,
    // 模型漏填时按意图补齐，和 understanding.js 的兜底同一套判断。
    hasTaskRequest: value?.hasTaskRequest === true
      || HELP_INTENTS.includes(intent)
      || ['asking_knowledge', 'asking_location', 'asking_logistics', 'claim_done', 'safety_risk'].includes(intent),
    locationKind: ['task', 'venue', 'none'].includes(value?.locationKind) ? value.locationKind : 'none',
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}

function normalizeContext(value) {
  const configuredMax = Math.round(Number(value?.maxScaffoldLevel));
  const maxLevel = Number.isFinite(configuredMax)
    ? Math.max(0, Math.min(MAX_SCAFFOLD_LEVEL, configuredMax))
    : MAX_SCAFFOLD_LEVEL;
  const level = Math.round(Number(value?.scaffoldLevel));
  return {
    scaffoldLevel: Math.max(0, Math.min(maxLevel, Number.isFinite(level) ? level : 0)),
    maxScaffoldLevel: maxLevel,
    upgradeOnRepeatHelp: value?.upgradeOnRepeatHelp !== false,
    hasPendingQuestion: Boolean(value?.pendingQuestion),
    recentActions: Array.isArray(value?.recentActions) ? value.recentActions.filter(Boolean) : [],
  };
}

/**
 * 分诊链。互斥且有序：上一层命中就不再往下看。
 * 顺序本身是产品判断，不是实现细节——安全永远在任务之前，任务相关永远在闲聊之前。
 */
function triage(understanding, context) {
  // ── L0 危险/紧急 ─────────────────────────────────────────────
  // 不看置信度：呼叫老师是低成本动作，误报的代价远小于漏报。
  // turn-router 的 SAFETY_PATTERN 已在更早处短路一部分；这里是模型侧的补网。
  if (understanding.intent === 'safety_risk' || understanding.emotion === 'panic') {
    return { action: 'call_teacher_safety', reason: '判定为安全或紧急情况，先呼叫老师并停止任务推进。' };
  }

  // ── L1 状态机输入 ───────────────────────────────────────────
  // 排在任务之前是因为它改的是会话状态而不是教学策略：不采纳就会重复问同一个问题。
  if (understanding.answersPendingQuestion) {
    return { action: 'advance_pending_question', reason: '学生在回答待答问题，交给待答问题流转。' };
  }
  if (understanding.intent === 'claim_done') {
    return { action: 'redirect_task', reason: '口头声称完成不推进进度，指引学生用工具提交证据。' };
  }

  // ── 置信度闸门 ──────────────────────────────────────────────
  // 位置刻意在 L1 之后、L2 之前：读不准这句话时，按某个具体意图行动（给提示、检索知识、
  // 开导航）都是在赌，赌错就是又一轮误命中。安全（L0）与状态机（L1）不受此闸门约束——
  // 前者宁可误报，后者另有确定性解析兜底。
  if (understanding.intent === 'unknown' || understanding.confidence < LOW_CONFIDENCE) {
    return {
      action: 'clarify',
      // 有待答问题时更要澄清而不是猜：读不懂这句话却让"是/否"继续挂着，
      // 学生下一句一个"好"就会把到达状态改掉。挂起它，等读懂了再重新问。
      reason: context.hasPendingQuestion
        ? '意图不明且有待答问题，先挂起该问题再澄清，不拿它去套一个取值。'
        : '意图不明或置信度偏低，温和澄清一句。',
    };
  }

  // ── L2 任务相关 ─────────────────────────────────────────────
  if (HELP_INTENTS.includes(understanding.intent)) {
    return {
      action: 'give_scaffold',
      reason: understanding.intent === 'request_answer'
        ? '学生直接要答案，按平台苏格拉底底线改为给分级提示。'
        : '任务相关求助，给当前小步的分级提示。',
    };
  }
  if (understanding.intent === 'asking_knowledge') {
    return { action: 'answer_knowledge', reason: '任务相关的背景知识提问，走课程知识库检索并标注来源。' };
  }
  // 任务点问路有确定的工具动作（打开导航）；场地设施问路属于组织信息。
  if (understanding.intent === 'asking_location') {
    if (understanding.locationKind === 'venue') {
      return { action: 'answer_logistics', reason: '问的是场馆设施位置，按活动组织信息回答。' };
    }
    return { action: 'guide_location', reason: '学生在问任务点位置，直接打开当前任务地点的导航。' };
  }

  // ── L3 与本次活动组织有关 ────────────────────────────────────
  if (understanding.intent === 'asking_logistics' || understanding.locationKind === 'venue') {
    return { action: 'answer_logistics', reason: '与本次活动组织有关的问题，按现场安排如实回答。' };
  }

  // ── L4 兜底 ────────────────────────────────────────────────
  // 纯情绪表达落在这里，由情绪维度接管成 comfort。
  if (understanding.intent === 'emotional_low') {
    return { action: 'reply_natural', reason: '情绪表达，先自然接住学生这句话。' };
  }
  return { action: 'reply_natural', reason: '与本次活动无关的表达，正常回应为主。' };
}

/**
 * 情绪维度。默认只着色不夺权：action 不变，加 tone / refocus。
 * 只有"纯情绪、没有任何具体诉求"时情绪才独占动作——否则会把学生要的帮助撤走。
 */
function withEmotionTone(decision, understanding) {
  const low = understanding.intent === 'emotional_low' || LOW_EMOTIONS.includes(understanding.emotion);
  // 安全动作不着色：那一轮的话术必须是"停下、别动、我叫老师"，不掺共情铺垫。
  if (decision.action === 'call_teacher_safety') {
    return { ...decision, params: { ...decision.params, tone: 'urgent', refocus: false } };
  }
  if (!low) {
    return { ...decision, params: { ...decision.params, tone: 'neutral' } };
  }
  if (!understanding.hasTaskRequest) {
    return {
      action: 'comfort',
      params: { ...decision.params, tone: 'comfort_only', refocus: false },
      reason: '纯情绪表达且没有具体诉求，先安抚，不推进任务。',
    };
  }
  // 情绪低落但带着诉求：先共情一句再把事办掉，且这一轮不拉回。
  return {
    ...decision,
    params: { ...decision.params, tone: 'comfort_first', refocus: false },
    reason: `${decision.reason}学生情绪偏低，回应先共情一句再办事。`,
  };
}

/** 同族连续出现的次数（从最近往前数，遇到不同族即停）。 */
function sameFamilyStreak(recentActions, family) {
  if (!family) return 0;
  let streak = 0;
  for (const entry of [...recentActions].reverse()) {
    if (ACTION_FAMILY[String(entry?.action)] !== family) break;
    streak += 1;
  }
  return streak;
}

/**
 * 重复治理。按族分开处理，因为"重复"在不同族里意味着不同的事：
 *   求助族重复 = 提示不够用了 → 升档；到顶还在求助 → 转教师（不是撤走帮助）
 *   知识/组织族重复 = 学生确实有一串问题 → 照答，只在情绪允许时附一句拉回
 *   社交族重复 = 真的在跑题 → 附一句拉回，再连续则指回任务
 */
function withRepeatPolicy(decision, understanding, context) {
  const family = ACTION_FAMILY[decision.action];
  if (!family) return decision;
  const streak = sameFamilyStreak(context.recentActions, family);
  const params = { ...decision.params };
  // 情绪低落时永不拉回：先接住比推进重要。
  const mayRefocus = params.tone === 'neutral';

  if (family === 'scaffold') {
    if (!context.upgradeOnRepeatHelp || streak < 1) return { ...decision, params };
    const headroom = context.maxScaffoldLevel - context.scaffoldLevel;
    if (headroom > 0) {
      return {
        action: 'give_scaffold',
        params: { ...params, scaffoldLevelDelta: 1 },
        reason: `同类求助第${streak + 1}次，升一档提示。`,
      };
    }
    // 已到最高档还在求助：继续复读 L4 没有意义，转教师。撤走提示是更坏的选择。
    if (streak >= REPEAT_LIMIT) {
      return {
        action: 'escalate_teacher',
        params: { ...params, scaffoldLevelDelta: 0 },
        reason: '脚手架已到最高档且仍连续求助，转请老师到场一起看。',
      };
    }
    return {
      action: 'give_scaffold',
      params: { ...params, scaffoldLevelDelta: 0 },
      reason: '同类求助再次出现，但脚手架已到最高级。',
    };
  }

  if (family === 'knowledge' || family === 'logistics') {
    // 问题照答——这是学生的正当提问权。只在连续多轮且情绪平稳时附一句拉回。
    if (streak >= REPEAT_LIMIT && mayRefocus) {
      return {
        ...decision,
        params: { ...params, refocus: true },
        reason: `${decision.reason}连续多轮离开任务，回答后附一句拉回当前小步。`,
      };
    }
    return { ...decision, params };
  }

  if (family === 'social') {
    if (streak >= REPEAT_LIMIT + 1 && mayRefocus) {
      return {
        action: 'redirect_task',
        params: { ...params, refocus: true },
        reason: '连续多轮无关闲聊且情绪平稳，改为指回当前任务。',
      };
    }
    if (streak >= REPEAT_LIMIT && mayRefocus) {
      return {
        ...decision,
        params: { ...params, refocus: true },
        reason: `${decision.reason}连续多轮闲聊，回应后附一句拉回当前场景。`,
      };
    }
    return { ...decision, params };
  }

  if (family === 'clarify' && streak >= REPEAT_LIMIT) {
    // 连着澄清两次仍没读懂，再问第三遍就是复读。给一个可点的确定动作。
    return {
      action: 'redirect_task',
      params: { ...params, refocus: false },
      reason: '连续澄清仍未读懂，改为给出可直接操作的下一步。',
    };
  }

  if (family === 'progress' && streak >= REPEAT_LIMIT) {
    return {
      action: 'give_scaffold',
      params: { ...params },
      reason: '连续指回任务仍无进展，改为给当前小步的分级提示。',
    };
  }

  return { ...decision, params };
}

export function decideTutorAction(understanding, context) {
  const parsed = normalizeUnderstanding(understanding);
  const state = normalizeContext(context);
  const base = { params: {}, ...triage(parsed, state) };
  const toned = withEmotionTone(base, parsed);
  const final = withRepeatPolicy(toned, parsed, state);
  return {
    action: final.action,
    params: final.params || {},
    reason: final.reason,
  };
}
