/**
 * 回合语义理解器：学生自由文字输入的第一站。
 * 调用轻量模型把一句话转成结构化意图；调用失败、超时、解析失败或校验不过时退回保守默认，
 * 任何输入下都不抛异常，避免回落到会造成死循环的正则分支。
 */
import { z } from 'zod';

export const INTENTS = Object.freeze([
  // 安全/紧急排在最前不是为了顺序好看：它是分诊链 L0，模型侧与 turn-router 的正则并联兜网。
  'safety_risk',
  'greeting',
  'help_start',
  'help_stuck',
  'asking_location',
  'asking_knowledge',
  // 与本次活动组织有关的问题（时间/集合/流程/规则/场地设施），不是课程知识也不是任务求助。
  'asking_logistics',
  'chat_offtopic',
  'emotional_low',
  'answering_question',
  'claim_done',
  'request_answer',
  'unknown',
]);

export const EMOTIONS = Object.freeze([
  'neutral',
  'positive',
  'frustrated',
  'tired',
  'anxious',
  'panic',
]);

/** 位置问题的两类：任务点走导航卡，场地设施走组织信息问答。 */
export const LOCATION_KINDS = Object.freeze(['task', 'venue', 'none']);

export const FALLBACK_UNDERSTANDING = Object.freeze({
  intent: 'unknown',
  emotion: 'neutral',
  answersPendingQuestion: false,
  pendingAnswer: 'unknown',
  hasTaskRequest: false,
  locationKind: 'none',
  want: '',
  confidence: 0,
});

// 这些意图本身就是"带诉求"的，模型漏填 hasTaskRequest 时据此补齐。
const IMPLIES_TASK_REQUEST = Object.freeze([
  'help_start', 'help_stuck', 'request_answer', 'asking_knowledge',
  'asking_location', 'asking_logistics', 'claim_done', 'safety_risk',
]);

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;
const HISTORY_LIMIT = 4;

const understandingSchema = z.object({
  intent: z.enum([...INTENTS]),
  emotion: z.enum([...EMOTIONS]),
  answersPendingQuestion: z.boolean(),
  // 学生对待答问题给出的是/否。确定性解析读不出时才用它，见 service.resolveDecision。
  pendingAnswer: z.enum(['yes', 'no', 'unknown']).optional(),
  // 情绪之外还有没有具体诉求。决定"情绪只改语气"还是"情绪独占动作"，见 tutor-policy。
  hasTaskRequest: z.boolean().optional(),
  locationKind: z.enum([...LOCATION_KINDS]).optional(),
  want: z.string().max(200).optional(),
  confidence: z.coerce.number().transform((value) => Math.max(0, Math.min(1, value))),
});

const OUTPUT_SPEC = `你是研学课程AI学习同伴的语义理解模块。读懂学生这句话，只输出一个JSON对象，不要Markdown代码块。
格式：{"intent":"","emotion":"","answersPendingQuestion":true或false,"pendingAnswer":"yes或no或unknown","hasTaskRequest":true或false,"locationKind":"task或venue或none","want":"一句话说明学生想要什么","confidence":0到1的小数}

intent 取值（自上而下判断，命中即停）：
- safety_risk：受伤、身体不适、走失、迷路、被困、害怕危险、要找老师、周围有危险情况。**这一类宁可多报不可漏报**，只要话里透出人身安全或走失的可能就选它，不要因为不确定而降级成其他意图。
- answering_question：在回答下面列出的"待答问题"
- help_start不知从哪开始 | help_stuck过程中卡住 | request_answer直接要答案
- asking_knowledge：问课程内容本身（这是什么动物、为什么会这样）
- asking_location：问某个地点在哪里、怎么走、找不到
- asking_logistics：问本次活动的组织安排——几点结束、什么时候集合、在哪集合、接下来什么流程、分组规则、时间银行怎么算、厕所饮水处出口在哪、带队老师在哪
- claim_done口头说完成了 | greeting寒暄 | chat_offtopic与本次活动无关的闲聊 | emotional_low情绪低落或累或抱怨 | unknown看不懂

区分要点：asking_knowledge 问的是课程内容；asking_location / asking_logistics 问的是现场安排。"标本在哪"是 asking_location，"厕所在哪"是 asking_logistics。

emotion 取值：neutral | positive | frustrated | tired | anxious | panic（panic 只用于惊慌害怕，通常伴随 safety_risk）

hasTaskRequest：这句话里除了情绪表达，是否还带着一个具体诉求（想知道怎么做、要提示、问问题、报告进度）。"太难了我不知道怎么下手"是 true；"我好累啊"是 false。

locationKind：这句话问的地点属于哪类。task=课程任务点/展品/标本位置；venue=场馆设施（厕所、饮水、出口、集合区）；none=没问地点。

只有学生确实在回答"待答问题"时 answersPendingQuestion 才为 true，并在 pendingAnswer 给出 yes 或 no；其他情况填 unknown。不要揣测课程答案，不要给学生建议。`;

function parseJson(text) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(source.slice(start, end + 1)); } catch { return null; }
  }
}

function buildInstructions({ pendingQuestion, currentStep, grade } = {}) {
  const lines = [OUTPUT_SPEC];
  lines.push(pendingQuestion?.prompt
    ? `待答问题：${String(pendingQuestion.prompt).slice(0, 120)}（${pendingQuestion.type || '未标注类型'}）`
    : '待答问题：无');
  if (currentStep?.objective || currentStep?.studentAction) {
    lines.push(`当前小步：${String(currentStep.objective || '').slice(0, 80)}｜学生行动：${String(currentStep.studentAction || '').slice(0, 80)}`);
  }
  if (grade) lines.push(`学段：${String(grade).slice(0, 20)}`);
  return lines.join('\n');
}

function buildMessages({ recentMessages, text } = {}) {
  const history = (Array.isArray(recentMessages) ? recentMessages : [])
    .slice(-HISTORY_LIMIT)
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').slice(0, 200),
    }))
    .filter((item) => item.content);
  return [...history, { role: 'user', content: String(text || '').slice(0, 500) }];
}

export function createUnderstanding({ llm, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  async function requestOnce(input, budgetMs, outerSignal) {
    const controller = new AbortController();
    // 整轮被取消（客户端断开或触达 turn deadline）时，理解调用必须一起取消，
    // 否则它会用完自己那份预算，把已经该结束的回合又拖住几秒。
    const abortOuter = () => controller.abort(outerSignal?.reason);
    outerSignal?.addEventListener?.('abort', abortOuter, { once: true });
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort(new DOMException('语义理解超时。', 'TimeoutError'));
        reject(new Error('UNDERSTANDING_TIMEOUT'));
      }, budgetMs);
    });
    try {
      const response = await Promise.race([
        llm.generate({
          instructions: buildInstructions(input),
          messages: buildMessages(input),
          jsonMode: true,
          maxRetries: 0,
          signal: controller.signal,
        }),
        deadline,
      ]);
      const parsed = understandingSchema.safeParse(parseJson(response?.text));
      if (!parsed.success) return null;
      return {
        intent: parsed.data.intent,
        emotion: parsed.data.emotion,
        answersPendingQuestion: parsed.data.answersPendingQuestion,
        pendingAnswer: parsed.data.pendingAnswer || 'unknown',
        // 求助与知识提问天然带诉求：模型漏填时按意图补齐，避免情绪维度误判成"纯情绪"。
        hasTaskRequest: parsed.data.hasTaskRequest ?? IMPLIES_TASK_REQUEST.includes(parsed.data.intent),
        locationKind: parsed.data.locationKind
          || (parsed.data.intent === 'asking_location' ? 'task' : 'none'),
        want: String(parsed.data.want || '').trim(),
        confidence: parsed.data.confidence,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener?.('abort', abortOuter);
    }
  }

  /**
   * 总预算覆盖首次调用与一次重试；预算耗尽即返回保守默认。
   * `signal` 已取消时立即返回默认——整轮都要结束了，没必要再问一次模型。
   */
  async function understandTurn(input = {}, { signal } = {}) {
    const budget = Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    const expiresAt = Date.now() + budget;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (signal?.aborted) break;
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) break;
      const result = await requestOnce(input, remaining, signal);
      if (result) return result;
    }
    return { ...FALLBACK_UNDERSTANDING };
  }

  return { understandTurn };
}
