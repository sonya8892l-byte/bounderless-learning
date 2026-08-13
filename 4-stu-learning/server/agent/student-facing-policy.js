import {
  applyGradeResponsePolicy,
  avoidRepeatedReply,
  splitGradeResponse,
} from './dialogue-policy.js';
import { findSpoiler, restrictionUnlocked } from '../course/retrieval.js';

export const STUDENT_FACING_POLICY_VERSION = '2026-08-11.3';

const INTERNAL_MARKER = '[待学生探索的数据]';
const PUBLIC_MARKER = '尚待你通过现场证据验证的内容';
const DIRECT_SCAFFOLD_ANSWER = /(?:答案|结果|结论)(?:是|为)|(?:实际|正确)(?:答案|结果)|(?:准确|精确)(?:数值|答案)|\b\d+(?:\.\d+)?\s*[+×*/=-]\s*\d+/;
const UNSAFE_DIRECTIVE = /摸摸看|触摸(?:展品|文物|建筑)|往[^。！？\n]{0,16}倒水|把[^。！？\n]{0,12}(?:树叶|物品)[^。！？\n]{0,12}(?:放|扔|投)[^。！？\n]{0,8}(?:河|水)|(?:靠近|走近|贴近|下到)[^。！？\n]{0,10}(?:水边|水面|河边|池边)(?:[^。！？\n]{0,14}(?:拍|手机|观察|查看))?|(?:跳|跨|翻|爬|攀|越)[^。！？\n]{0,10}(?:护栏|栏杆|石栏|围栏)|(?:边|一边)?(?:过|穿过|横穿)[^。！？\n]{0,8}(?:马路|道路)[^。！？\n]{0,12}(?:边|同时)?(?:看|用|操作|玩)[^。！？\n]{0,6}(?:手机|屏幕)|(?:看|用|操作|玩)[^。！？\n]{0,6}(?:手机|屏幕)[^。！？\n]{0,12}(?:过|穿过|横穿)[^。！？\n]{0,8}(?:马路|道路)/;
const NEGATED_SAFETY = /(?:不要|不得|禁止|严禁|请勿|不可|不能|别|避免|远离)[^。！？\n]{0,24}(?:摸|触摸|倒水|投放|投|扔|靠近|贴近|下到|水边|水面|河边|池边|跳|跨|翻|爬|攀|越|护栏|栏杆|石栏|围栏|马路|道路|手机|屏幕)/;
const SAFE_ACTION_FALLBACK = '先不要执行这个动作。请跟随老师，在安全位置完成观察。';
const GENERIC_SAFETY_CLAUSE = /^(?:请)?(?:安全拍摄|在安全位置拍摄|拍摄时(?:请)?注意安全|注意拍摄安全|注意安全|跟随老师(?:统一)?移动|跟紧老师|务必跟紧老师|不要离队|不要独自行动|不要拍摄他人正脸|不要(?:跳|跨|翻|爬|攀|越)(?:过|越)?(?:护栏|栏杆|石栏|围栏)|请勿(?:跳|跨|翻|爬|攀|越)(?:过|越)?(?:护栏|栏杆|石栏|围栏)|不要攀爬|请勿攀爬|不要边过马路边看手机)$/;
const SAFETY_ACTION_SENTENCE = /(?:请|不要|不得|禁止|严禁|请勿|不可|不能|别|避免|远离|立即|马上|先)[^。！？\n]{0,36}(?:安全|护栏|栏杆|石栏|围栏|攀爬|翻越|跨越|离队|独自|马路|道路|手机|屏幕)|(?:护栏|栏杆|石栏|围栏)[^。！？\n]{0,18}(?:外|危险)/;

function lockedFallback({ channel = 'assistant', passed = false } = {}) {
  if (channel === 'evaluation') {
    return passed
      ? '这一步的证据结构已经达到继续条件。'
      : '这一步仍缺少可核对的证据，请回看当前小步要求后补充。';
  }
  return '这个精确结论仍在探索区。把你的观察方法或现场证据告诉我，我可以陪你检查推理过程。';
}

function lockedTerms(course, session) {
  return (course?.restrictions || [])
    .filter((restriction) => !restrictionUnlocked(restriction, session, course))
    .flatMap((restriction) => restriction.protectedTerms || [])
    .map((term) => String(term || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function normalizeInternalMarkers(text = '') {
  return String(text || '').replaceAll(INTERNAL_MARKER, PUBLIC_MARKER).trim();
}

function sentenceSegments(text = '') {
  return String(text || '').match(/[^。！？!?\n]+[。！？!?]?/g)?.map((item) => item.trim()).filter(Boolean) || [];
}

function sentenceBody(sentence = '') {
  return String(sentence || '').replace(/[。！？!?]+$/g, '').trim();
}

function isGenericSafetySentence(sentence = '') {
  const clauses = sentenceBody(sentence)
    .split(/[，,；;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Boolean(clauses.length) && clauses.every((clause) => GENERIC_SAFETY_CLAUSE.test(clause));
}

function normalizeEvaluationSafety(feedback, safetyIssue) {
  const segments = sentenceSegments(feedback);
  if (!segments.length) return { text: '', action: '' };

  if (safetyIssue !== true) {
    const kept = segments.filter((segment) => !isGenericSafetySentence(segment));
    return {
      text: kept.join(''),
      action: kept.length === segments.length ? '' : 'generic_safety_removed',
    };
  }

  let safetyActionKept = false;
  let duplicateRemoved = false;
  const kept = [];
  for (const segment of segments) {
    const safetyAction = SAFETY_ACTION_SENTENCE.test(sentenceBody(segment))
      || isGenericSafetySentence(segment);
    if (!safetyAction) {
      kept.push(segment);
      continue;
    }
    if (!safetyActionKept) {
      safetyActionKept = true;
      kept.push(segment);
    } else {
      duplicateRemoved = true;
    }
  }
  if (!safetyActionKept) kept.push('请安全拍摄。');
  return {
    text: kept.join(''),
    action: duplicateRemoved
      ? 'duplicate_safety_removed'
      : safetyActionKept ? '' : 'safety_action_added',
  };
}

export function containsUnsafeDirective(text = '') {
  const value = String(text || '');
  // Negation is scoped to its sentence/clause.  Removing only negated safety
  // clauses keeps a later positive dangerous instruction visible, while still
  // allowing normal guidance such as “请安全拍摄，不要跨越护栏”。
  const actionable = value
    .split(/[。！？!?\n]+/)
    .flatMap((sentence) => sentence.split(
      /[，,；;]+|(?=(?:但是|但|不过|然而|而是|然后|接着|随后|现在)(?:请|要|去|立刻|马上)?)/,
    ))
    .map((clause) => clause.trim())
    .filter(Boolean)
    .filter((clause) => !NEGATED_SAFETY.test(clause))
    .join('。');
  return UNSAFE_DIRECTIVE.test(actionable);
}

/**
 * 对卡片、工具配置、快捷回复等非气泡表面做最小脱敏。结构字段不被改写；字符串
 * 只替换仍锁定的精确保护词，避免整张工具卡因一个词被丢弃。
 */
function redactSurfaceString(text, terms, actions, course, session) {
  let value = normalizeInternalMarkers(text);
  for (const term of terms) value = value.replaceAll(term, PUBLIC_MARKER);
  if (findSpoiler(value, course, session)) {
    value = PUBLIC_MARKER;
    actions.add('protected_answer_blocked');
  }
  if (containsUnsafeDirective(value)) {
    value = SAFE_ACTION_FALLBACK;
    actions.add('unsafe_action_blocked');
  }
  return value;
}

function visitSurface(value, terms, actions, course, session) {
  if (typeof value === 'string') {
    const next = redactSurfaceString(value, terms, actions, course, session);
    if (next !== value) actions.add('protected_surface_redacted');
    return next;
  }
  if (Array.isArray(value)) {
    return value.map((item) => visitSurface(item, terms, actions, course, session));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    visitSurface(item, terms, actions, course, session),
  ]));
}

export function createStudentFacingPolicy({ course, session } = {}) {
  const grade = session?.learnerState?.grade || session?.grade || '初中';
  const languageLevels = course?.platformDefaults?.languageLevels;
  const voice = course?.platformDefaults?.voice;
  const terms = lockedTerms(course, session);

  function processText(text, {
    channel = 'assistant',
    intent = '',
    dialogueMove = '',
    dedupe = true,
    passed = false,
  } = {}) {
    const actions = [];
    const original = String(text || '');
    let value = normalizeInternalMarkers(original);
    if (value !== original.trim()) actions.push('internal_marker_normalized');

    const spoiler = findSpoiler(value, course, session);
    if (spoiler) {
      value = lockedFallback({ channel, passed });
      actions.push('protected_answer_blocked');
    }
    if (intent === 'task_help' && DIRECT_SCAFFOLD_ANSWER.test(value)) {
      value = lockedFallback({ channel, passed });
      actions.push('direct_scaffold_answer_blocked');
    }
    if (containsUnsafeDirective(value)) {
      value = SAFE_ACTION_FALLBACK;
      actions.push('unsafe_action_blocked');
    }

    if (dedupe && value) {
      const rewritten = avoidRepeatedReply(session, value, {
        intent,
        dialogueMove,
        voice,
      });
      if (rewritten !== value) actions.push('duplicate_rewritten');
      value = rewritten;
    }

    value = applyGradeResponsePolicy(value, grade, languageLevels);
    // 课程可覆盖固定话术。防复读改写和学段清理之后，危险动作与保护答案
    // 都必须重新终检，避免 voice 模板绕过模型输出入口的首轮检查。
    if (containsUnsafeDirective(value)) {
      value = SAFE_ACTION_FALLBACK;
      actions.push('post_template_unsafe_blocked');
    }
    if (findSpoiler(value, course, session)) {
      value = lockedFallback({ channel, passed });
      actions.push('post_template_answer_blocked');
    }
    const parts = value ? splitGradeResponse(value, grade, languageLevels) : [];
    if (parts.length > 1) actions.push(`split_into_${parts.length}_bubbles`);
    return {
      text: value,
      parts,
      actions,
      policyVersion: STUDENT_FACING_POLICY_VERSION,
    };
  }

  function processSurface(value, { channel = 'surface' } = {}) {
    const actions = new Set();
    const output = visitSurface(value, terms, actions, course, session);
    return {
      value: output,
      actions: [...actions].map((action) => `${channel}:${action}`),
      policyVersion: STUDENT_FACING_POLICY_VERSION,
    };
  }

  function processEvaluation(evaluation = {}) {
    const feedback = processText(evaluation.feedback, {
      channel: 'evaluation',
      intent: 'tool_result',
      dialogueMove: 'evaluate_evidence',
      dedupe: false,
      passed: evaluation.passed === true,
    });
    const safety = normalizeEvaluationSafety(feedback.text, evaluation.safetyIssue === true);
    const visibleFeedback = safety.text || lockedFallback({
      channel: 'evaluation',
      passed: evaluation.passed === true,
    });
    const missing = (evaluation.missing || [])
      .map((item) => processText(item, {
        channel: 'evaluation',
        intent: 'tool_result',
        dialogueMove: 'evaluate_evidence',
        dedupe: false,
        passed: false,
      }))
      .filter((item) => !item.actions.includes('protected_answer_blocked'))
      .map((item) => item.text)
      .filter(Boolean);
    return {
      value: { ...evaluation, feedback: visibleFeedback, missing },
      actions: [
        ...feedback.actions.map((action) => `evaluation:${action}`),
        ...(safety.action ? [`evaluation:${safety.action}`] : []),
      ],
      policyVersion: STUDENT_FACING_POLICY_VERSION,
    };
  }

  return Object.freeze({
    version: STUDENT_FACING_POLICY_VERSION,
    processText,
    processSurface,
    processEvaluation,
  });
}
