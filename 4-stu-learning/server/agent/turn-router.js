// 只保留"直接影响状态机"的两组：待答问题的是/否。
// 寒暄、感谢、道别、情绪等语义判断已交给 understandTurn（决策 D6）。
const exactAffirmative = /^(好|好的|好了|嗯|嗯嗯|行|可以|没问题|ok|okay|yes|是|对|准备好了|开始吧)[呀啊哦嘛吗啦呢！!。.～~ ]*$/i;
const exactNegative = /^(不|不要|不行|还没|没有|没好|等等|等一下|no|不是|不对)[呀啊哦嘛吗啦呢！!。.～~ ]*$/i;
const complaintPattern = /你有毒|你有病|你.{0,3}(?:傻|笨)|傻逼|烦死|真烦|一直重复|又问|说过了|听不懂人话|别催|别再问|怎么老是|卡住了|没反应/;

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
    needsKnowledge: false,
    includeTaskContext: false,
    includePhasePrompt: false,
    includeRestrictions: false,
    // 组织信息切片只在 answer_logistics 回合装配，避免每轮都往 Prompt 里塞运营字段。
    includeLogistics: false,
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
const SAFETY_PATTERN = /受伤|流血|摔倒|走失|走散|落单|迷路|危险|救命|不舒服|头晕|恶心|胸闷|呼吸困难|喘不上气|晕倒|肚子疼|被困|被推|脚.{0,3}(?:扭|崴)|找不到.{0,6}(?:队伍|同学|小组|老师)|陌生人.{0,8}(?:跟|带|拉|叫)|有人.{0,5}(?:推我|打我|拉我)|着火|起火|有烟|烟味|滑下去|掉进水|联系老师|叫老师|找老师/;
const UNSAFE_ACTION_PATTERN = /(?:翻|跨|爬).{0,5}护栏|护栏.{0,5}(?:翻|跨|爬)/;

export function safetyOverride(text = '') {
  const value = String(text).toLowerCase();
  return SAFETY_PATTERN.test(value) || UNSAFE_ACTION_PATTERN.test(value);
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
    if (input.event === 'phase_started') {
      return base('phase_started', {
        fastWorkflow: true,
        includeTaskContext: true,
        includePhasePrompt: true,
        includeRestrictions: true,
        allowedTools: ['open_task_tool', 'call_teacher'],
        sourceMode: 'course-config',
      });
    }
    if (input.event === 'teacher_confirm_arrival') {
      return base('navigation_completed', {
        fastWorkflow: true,
        includeTaskContext: true,
        includePhasePrompt: true,
        includeRestrictions: true,
        allowedTools: [],
        sourceMode: 'course-config',
      });
    }
    if (['task_step_completed', 'task_step_revised'].includes(input.event)) {
      return base('task_step_completed', {
        fastWorkflow: true,
        includeTaskContext: true,
        includePhasePrompt: true,
        includeRestrictions: true,
        sourceMode: 'course-config',
      });
    }
    if (['teacher_finalize_task', 'teacher_reject_task'].includes(input.event)) {
      return base('task_step_completed', {
        fastWorkflow: true,
        includeTaskContext: true,
        includePhasePrompt: true,
        includeRestrictions: true,
        sourceMode: 'course-config',
      });
    }
    // 教师指令只改会话状态（阶段、脚手架档位），不让絮絮开口：
    // 学生端已经自己弹了"老师已推进阶段"这类提示，模型再说一句就是重复。
    if (input.event === 'teacher_directive') {
      return base('teacher_directive', { silent: true, sourceMode: 'course-config' });
    }
    // 解除等待推进同理不让絮絮单独开口：推进成功后状态机会追加 stage.started
    // 与新任务的第一小步引导，那两条已经把"现在做什么"说清了。走通用
    // lifecycle_event 分支会真调一次主模型，且因为没有新话可说，反重复层会把
    // 回复替换成"这句话我刚才说过了"——学生看到的就是一句莫名其妙的抱怨。
    if (['teacher_advance_task', 'student_advance_task'].includes(input.event)) {
      return base('advance_task', { silent: true, sourceMode: 'course-config' });
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
  // L0：与 deterministicLanguageDecision 的 safety_help 共用 intent，
  // 因此复用同一条 workflowResult 分支——安全话术只有一份。
  call_teacher_safety: () => base('safety_help', {
    signal: 'anxious',
    fastWorkflow: true,
    includeTaskContext: false,
    allowedTools: ['call_teacher'],
    sourceMode: 'conversation',
  }),
  // L2 知识：needsKnowledge 由动作自带，不再靠 service 外挂判断 intent。
  answer_knowledge: () => base('course_knowledge', {
    includeTaskContext: true,
    includeRestrictions: true,
    needsKnowledge: true,
    allowedTools: [],
    sourceMode: 'course-config',
  }),
  // student_discovery（学生发现）由主模型结合当前阶段与课程引导回应；
  // 不带求助脚手架，也不允许通过工具或状态机推进任务。
  respond_to_discovery: () => base('student_discovery', {
    includeTaskContext: true,
    includePhasePrompt: true,
    includeRestrictions: true,
    includeScaffoldHint: false,
    needsKnowledge: false,
    allowedTools: [],
    sourceMode: 'course-config',
  }),
  // L3 组织信息：走模型生成（要按学生问的那一点作答），但取料只给运营切片，
  // 不给课程知识、不给脚手架——它不是教学回合。
  answer_logistics: () => base('activity_logistics', {
    includeTaskContext: true,
    includeLogistics: true,
    needsKnowledge: false,
    allowedTools: ['show_navigation', 'call_teacher'],
    sourceMode: 'course-config',
  }),
  // L4 澄清：与 social 分开，防复读才不会把"没读懂"和"闲聊"混在一起计数。
  clarify: () => base('clarify_intent', {
    includeTaskContext: false,
    sourceMode: 'conversation',
  }),
  // 脚手架到顶仍连续求助的出口。不撤走帮助，转请老师。
  escalate_teacher: () => base('scaffold_exhausted', {
    fastWorkflow: true,
    includeTaskContext: true,
    allowedTools: ['call_teacher'],
    sourceMode: 'course-config',
  }),
  reply_natural: () => base('social', { includeTaskContext: false, sourceMode: 'conversation' }),
});

export function decisionForTutorAction(action, context = {}) {
  const build = TUTOR_ACTION_DECISIONS[action] || TUTOR_ACTION_DECISIONS.reply_natural;
  const decision = build(context);
  return { ...decision, tutorAction: action, tutorReason: context.reason || '' };
}

export function toolsForDecision(decision, definitions) {
  const allowed = new Set(decision.allowedTools || []);
  return definitions.filter((tool) => allowed.has(tool.name));
}
