// 只保留"直接影响状态机"的两组：待答问题的是/否。
// 寒暄、感谢、道别、情绪等语义判断已交给 understandTurn（决策 D6）。
const exactAffirmative = /^(好|好的|好了|嗯|嗯嗯|行|可以|没问题|ok|okay|yes|是|对|准备好了|开始吧)[呀啊哦嘛吗啦呢！!。.～~ ]*$/i;
const exactNegative = /^(不|不要|不行|还没|没有|没好|等等|等一下|no|不是|不对)[呀啊哦嘛吗啦呢！!。.～~ ]*$/i;
const complaintPattern = /你有毒|有病|傻|笨|烦死|真烦|一直重复|又问|说过了|听不懂人话|别催|别再问|怎么老是|卡住了|没反应/;

function lowSemanticInput(text) {
  const compact = text.replace(/\s+/g, '');
  if (!compact) return true;
  if (/^[=+\-*/_~～.。…，,!?！？、:：;；]+$/.test(compact)) return true;
  if (/^(额+|呃+|em+|emm+|啊+|哦+|哈+|呵+|？？+|\?\?+)$/i.test(compact)) return true;
  return false;
}

function base(intent, additions = {}) {
  return {
    intent,
    signal: 'neutral',
    fastPath: false,
    needsKnowledge: false,
    includeTaskContext: false,
    includePhasePrompt: false,
    includeRestrictions: false,
    allowedTools: [],
    sourceMode: 'conversation',
    ...additions,
  };
}

export function entrySignals(text) {
  return {
    notArrived: /还没到|没有到|没到位|在路上|快到了/.test(text),
    notReady: /还没准备好|没准备好|等一下|稍等|先等等/.test(text),
    arrived: /已经到|我到了|到位了|已到|在现场|在展区|到了|已经站在|就在任务点|跟大家会合|已经来了/.test(text),
    ready: /准备好了|我准备好|可以开始|开始吧|就绪|准备完毕|可以做了|开工吧|能开始了|继续吧|继续学习|回到任务|继续$/.test(text),
  };
}

export function resolvePendingAnswer(text, pendingQuestion) {
  if (!pendingQuestion) return { matched: false, value: null, confidence: 0 };
  const entry = entrySignals(text);
  const affirmative = exactAffirmative.test(text);
  const negative = exactNegative.test(text);
  if (pendingQuestion.kind === 'arrival') {
    if (entry.notArrived) return { matched: true, value: false, confidence: 0.99, entry };
    if (entry.arrived) return { matched: true, value: true, confidence: 0.99, entry };
    if (affirmative) return { matched: true, value: true, confidence: 0.9, entry };
    if (negative) return { matched: true, value: false, confidence: 0.82, entry };
  }
  if (pendingQuestion.kind === 'readiness') {
    if (entry.notReady) return { matched: true, value: false, confidence: 0.99, entry };
    if (entry.ready) return { matched: true, value: true, confidence: 0.99, entry };
    if (affirmative) return { matched: true, value: true, confidence: 0.9, entry };
    if (negative) return { matched: true, value: false, confidence: 0.82, entry };
  }
  return { matched: false, value: null, confidence: 0, entry };
}

// 运行层的分界线：语言输入 / 非语言输入（决策 D6「语义理解优先」）。
// 自由文字一律交给轻量 LLM 做语义判断，规则不再猜语义；
// 工具结果、位置、心跳、带 questionId 的按钮走确定性路径。
export function routeInput(input) {
  const isLanguage = input?.type === 'user_text' && Boolean(String(input.text || '').trim());
  return { kind: isLanguage ? 'language' : 'non_language' };
}

// 语言输入里仍需规则优先拦截的两件事：安全求助与明确的位置求助。
// 这两类不能等模型——安全有时效，位置有确定的工具动作。
const SAFETY_PATTERN = /受伤|流血|摔倒|走失|迷路|危险|救命|不舒服|联系老师|叫老师|找老师/;

export function safetyOverride(text = '') {
  return SAFETY_PATTERN.test(String(text).toLowerCase());
}

/**
 * 语言输入里必须由确定性规则处理的情形；都不命中时返回 null，交给语义理解。
 *
 * 这些不是"教学判断"，而是状态机输入与时效动作：安全求助有时效；到达/就绪的是否
 * 直接改状态机；抱怨要挂起待答问题；无语义输入没有意图可理解。因此它们不能等模型，
 * 也不能因为轻量模型不可用而卡死。
 *
 * 刻意不复用 classifyTurn：那里是一条长正则级联，"我到位置了"会先被导航正则截走，
 * 而这句话其实是在回答"到了吗"。按优先级显式判定，正是 D6 要消灭的误命中。
 */
export function deterministicLanguageDecision({ text = '', session = {} } = {}) {
  const value = String(text).trim();
  if (!value) return null;
  if (safetyOverride(value)) {
    return base('safety_help', { signal: 'anxious', fastWorkflow: true, allowedTools: ['call_teacher'] });
  }
  if (lowSemanticInput(value)) return base('unclear_input', { fastWorkflow: true });
  if (complaintPattern.test(value)) {
    return base('conversation_repair', { signal: 'frustrated', fastWorkflow: true, sourceMode: 'conversation' });
  }

  const pendingResolution = resolvePendingAnswer(value, session.dialogueState?.pendingQuestion);
  if (pendingResolution.matched) {
    return base('pending_answer', {
      fastWorkflow: true,
      includeTaskContext: true,
      includePhasePrompt: true,
      includeRestrictions: true,
      allowedTools: pendingResolution.value ? ['open_task_tool'] : ['show_navigation'],
      sourceMode: 'course-config',
      pendingResolution,
      entry: pendingResolution.entry,
    });
  }

  if (session.onboardingState?.completed) return null;
  const entry = entrySignals(value);
  if (entry.notArrived) {
    return base('onboarding_not_arrived', {
      fastWorkflow: true,
      includeTaskContext: true,
      allowedTools: ['show_navigation', 'call_teacher'],
      sourceMode: 'course-config',
      entry,
    });
  }
  if (entry.notReady) {
    return base('onboarding_not_ready', {
      fastWorkflow: true, includeTaskContext: true, sourceMode: 'course-config', entry,
    });
  }
  if (entry.arrived || entry.ready) {
    return base('onboarding_check', {
      fastWorkflow: true,
      includeTaskContext: true,
      includePhasePrompt: true,
      includeRestrictions: true,
      allowedTools: ['show_navigation', 'open_task_tool'],
      sourceMode: 'course-config',
      entry,
    });
  }
  return null;
}

/** 非语言输入的确定性分流：按钮、工具结果、生命周期事件、心跳。 */
export function classifyTurn({ input, session, nudge }) {
  if (input.type === 'quick_reply') {
    const pending = session.dialogueState?.pendingQuestion;
    if (!pending || pending.id !== input.questionId) {
      return base('quick_reply_stale', { fastWorkflow: true });
    }
    if (input.act === 'request_navigation') {
      return base('onboarding_navigation', {
        fastWorkflow: true,
        includeTaskContext: true,
        allowedTools: ['show_navigation', 'call_teacher'],
        sourceMode: 'course-config',
      });
    }
    return base('pending_answer', {
      fastWorkflow: true,
      includeTaskContext: true,
      includePhasePrompt: true,
      includeRestrictions: true,
      allowedTools: input.act === 'affirm' ? ['open_task_tool'] : ['show_navigation'],
      sourceMode: 'course-config',
      pendingResolution: {
        matched: true,
        value: input.act === 'affirm',
        confidence: 1,
        entry: pending.kind === 'arrival'
          ? { arrived: input.act === 'affirm', notArrived: input.act === 'deny', ready: false, notReady: false }
          : { arrived: false, notArrived: false, ready: input.act === 'affirm', notReady: input.act === 'deny' },
      },
      entry: pending.kind === 'arrival'
        ? { arrived: input.act === 'affirm', notArrived: input.act === 'deny', ready: false, notReady: false }
        : { arrived: false, notArrived: false, ready: input.act === 'affirm', notReady: input.act === 'deny' },
    });
  }
  if (input.type === 'tool_result') {
    const navigationCompleted = input.data?.resolvedTool === 'show_navigation' && input.result?.status === 'completed';
    return base(navigationCompleted ? 'navigation_completed' : 'tool_result', {
      fastWorkflow: navigationCompleted,
      includeTaskContext: true,
      includePhasePrompt: true,
      includeRestrictions: true,
      // 工具推进由状态机在模型回答后追加，避免模型为了选择一个确定工具而阻塞整轮回复。
      allowedTools: [],
      sourceMode: 'course-config',
    });
  }
  if (input.type === 'lifecycle_event') {
    if (input.event === 'context_tick') {
      return base(nudge?.due ? 'proactive_nudge' : 'silent_context_tick', {
        fastWorkflow: Boolean(nudge?.due),
        includeTaskContext: Boolean(nudge?.due),
        allowedTools: nudge?.reason === 'location_pending' ? ['show_navigation'] : [],
        sourceMode: 'course-config',
        silent: !nudge?.due,
        nudge,
      });
    }
    if (input.event === 'role_assigned') {
      return base('role_assigned', {
        fastWorkflow: true,
        includeTaskContext: true,
        includePhasePrompt: true,
        includeRestrictions: true,
        allowedTools: ['show_navigation', 'call_teacher'],
        sourceMode: 'course-config',
      });
    }
    if (input.event === 'task_step_completed') {
      return base('task_step_completed', {
        fastWorkflow: true,
        includeTaskContext: true,
        includePhasePrompt: true,
        includeRestrictions: true,
        sourceMode: 'course-config',
      });
    }
    return base('lifecycle_event', {
      includeTaskContext: true,
      includePhasePrompt: true,
      includeRestrictions: true,
      allowedTools: [],
      sourceMode: 'course-config',
    });
  }

  // 自由文字不再走这里：语言输入的语义判定由 deterministicLanguageDecision
  // ＋ understandTurn ＋ tutorPolicy 三段负责（决策 D6）。
  // 保留这个兜底只为容错——正常路径下 routeInput 已把语言输入分流出去。
  return base('social', { sourceMode: 'conversation' });
}

// 把 tutorPolicy 的教学动作翻译成本层的 decision（上下文开关、工具白名单、来源标注）。
// 语义理解已经判定过意图，这里不再做任何文本猜测。
const TUTOR_ACTION_DECISIONS = Object.freeze({
  comfort: () => base('emotion', {
    signal: 'frustrated',
    // 情绪回合交给模型自然生成，不再用写死话术顶回去
    includeTaskContext: false,
    sourceMode: 'conversation',
  }),
  advance_pending_question: (context) => base('pending_answer', {
    fastWorkflow: true,
    includeTaskContext: true,
    includePhasePrompt: true,
    includeRestrictions: true,
    allowedTools: context.pendingValue ? ['open_task_tool'] : ['show_navigation'],
    sourceMode: 'course-config',
    pendingResolution: context.pendingResolution,
    entry: context.entry,
  }),
  // fastGuidance：分级提示是课程作者写的原文，直接用，不让模型改写也不等模型。
  // 防复读靠 tutorPolicy 升档换提示内容，不靠换措辞。
  give_scaffold: () => base('task_help', {
    fastGuidance: true,
    includeTaskContext: true,
    includeRestrictions: true,
    needsKnowledge: false,
    allowedTools: [],
    sourceMode: 'course-config',
  }),
  // fastWorkflow：口头声称完成要走确定性的小步推进/索要证据，不能让模型决定进度。
  redirect_task: (context) => base('task_progress', {
    fastWorkflow: true,
    includeTaskContext: true,
    includePhasePrompt: true,
    includeRestrictions: true,
    allowedTools: ['open_task_tool', 'show_navigation'],
    sourceMode: 'course-config',
    claimsDone: context.claimsDone === true,
  }),
  // 入场阶段的问路要顺带推进到达确认，所以分流到 onboarding_navigation。
  guide_location: (context) => base(context.onboardingCompleted ? 'navigation' : 'onboarding_navigation', {
    fastWorkflow: true,
    includeTaskContext: true,
    allowedTools: ['show_navigation', 'call_teacher'],
    sourceMode: 'course-config',
  }),
  reply_natural: (context) => (context.needsKnowledge
    ? base('course_knowledge', {
      includeTaskContext: true,
      includeRestrictions: true,
      needsKnowledge: true,
      allowedTools: [],
    })
    : base('social', { includeTaskContext: false, sourceMode: 'conversation' })),
});

export function decisionForTutorAction(action, context = {}) {
  const build = TUTOR_ACTION_DECISIONS[action] || TUTOR_ACTION_DECISIONS.reply_natural;
  const decision = build(context);
  return { ...decision, tutorAction: action, tutorReason: context.reason || '' };
}

export function fastConversationReply(intent, companionName = '絮絮', signal = 'neutral') {
  if (intent === 'greeting') return `你好呀，我是${companionName}～我在呢。你想聊什么都可以。`;
  if (intent === 'gratitude') return '不客气呀～我一直在，有想法就继续告诉我。';
  if (intent === 'goodbye') return '好呀，回头见～需要我的时候再来找我。';
  if (intent === 'acknowledgement') return '嗯嗯，我在听。你可以接着说。';
  if (intent === 'emotion' && signal === 'tired') return '听起来你有点累了。先在安全的位置休息一分钟，好吗？我会在这里等你。';
  if (intent === 'emotion') return '我在听。紧张、烦躁或害怕都可以告诉我，你愿意先说说刚刚发生了什么吗？';
  return '';
}

export function toolsForDecision(decision, definitions) {
  const allowed = new Set(decision.allowedTools || []);
  return definitions.filter((tool) => allowed.has(tool.name));
}
