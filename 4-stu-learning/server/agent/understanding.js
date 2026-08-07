/**
 * 回合语义理解器：学生自由文字输入的第一站。
 * 调用轻量模型把一句话转成结构化意图；调用失败、超时、解析失败或校验不过时退回保守缺省，
 * 任何输入下都不抛异常，避免回落到会造成死循环的正则分支。
 */
import { z } from 'zod';

export const INTENTS = Object.freeze([
  'greeting',
  'help_start',
  'help_stuck',
  'asking_location',
  'asking_knowledge',
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
]);

export const FALLBACK_UNDERSTANDING = Object.freeze({
  intent: 'unknown',
  emotion: 'neutral',
  answersPendingQuestion: false,
  pendingAnswer: 'unknown',
  want: '',
  confidence: 0,
});

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;
const HISTORY_LIMIT = 4;

const understandingSchema = z.object({
  intent: z.enum([...INTENTS]),
  emotion: z.enum([...EMOTIONS]),
  answersPendingQuestion: z.boolean(),
  // 学生对待答问题给出的是/否。确定性解析读不出时才用它，见 service.resolveDecision。
  pendingAnswer: z.enum(['yes', 'no', 'unknown']).optional(),
  want: z.string().max(200).optional(),
  confidence: z.coerce.number().transform((value) => Math.max(0, Math.min(1, value))),
});

const OUTPUT_SPEC = `你是研学课程AI学习同伴的语义理解模块。读懂学生这句话，只输出一个JSON对象，不要Markdown代码块。
格式：{"intent":"","emotion":"","answersPendingQuestion":true或false,"pendingAnswer":"yes或no或unknown","want":"一句话说明学生想要什么","confidence":0到1的小数}
intent 取值：greeting寒暄 | help_start不知从哪开始 | help_stuck过程中卡住 | asking_location问路或找不到地点 | asking_knowledge问课程知识 | chat_offtopic闲聊跑题 | emotional_low情绪低落或累或抱怨 | answering_question在回答待答问题 | claim_done口头说完成了 | request_answer直接要答案 | unknown看不懂
注意区分：asking_location 是问"在哪里/怎么走"这类地理位置问题；asking_knowledge 是问课程内容本身。
emotion 取值：neutral | positive | frustrated | tired | anxious
只有学生确实在回答下面的"待答问题"时，answersPendingQuestion 才为 true，并在 pendingAnswer 给出 yes 或 no；其他情况 pendingAnswer 填 unknown。不要揣测课程答案，不要给学生建议。`;

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
   * 总预算覆盖首次调用与一次重试；预算耗尽即返回保守缺省。
   * `signal` 已取消时立即返回缺省——整轮都要结束了，没必要再问一次模型。
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
