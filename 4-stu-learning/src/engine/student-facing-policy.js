export const CLIENT_STUDENT_FACING_POLICY_VERSION = '2026-08-11.1';

const INTERNAL_MARKER = '[待学生探索的数据]';
const PUBLIC_MARKER = '尚待你通过现场证据验证的内容';
const SAFE_ACTION_FALLBACK = '先不要执行这个动作。请跟随老师，在安全位置完成观察。';
const DEFAULT_ERROR_FALLBACK = '这项操作暂未完成，请稍后重试。';
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const UNSAFE_DIRECTIVE = /摸摸看|触摸(?:展品|文物|建筑)|往[^。！？\n]{0,16}倒水|把[^。！？\n]{0,12}(?:树叶|物品)[^。！？\n]{0,12}(?:放|扔|投)[^。！？\n]{0,8}(?:河|水)|(?:靠近|走近|贴近|下到)[^。！？\n]{0,10}(?:水边|水面|河边|池边)(?:[^。！？\n]{0,14}(?:拍|手机|观察|查看))?|(?:跳|跨|翻|爬|攀|越)[^。！？\n]{0,10}(?:护栏|栏杆|石栏|围栏)|(?:边|一边)?(?:过|穿过|横穿)[^。！？\n]{0,8}(?:马路|道路)[^。！？\n]{0,12}(?:边|同时)?(?:看|用|操作|玩)[^。！？\n]{0,6}(?:手机|屏幕)|(?:看|用|操作|玩)[^。！？\n]{0,6}(?:手机|屏幕)[^。！？\n]{0,12}(?:过|穿过|横穿)[^。！？\n]{0,8}(?:马路|道路)/;
const NEGATED_SAFETY = /(?:不要|不得|禁止|严禁|请勿|不可|不能|别|避免|远离)[^。！？\n]{0,24}(?:摸|触摸|倒水|投放|投|扔|靠近|贴近|下到|水边|水面|河边|池边|跳|跨|翻|爬|攀|越|护栏|栏杆|石栏|围栏|马路|道路|手机|屏幕)/;
const INTERNAL_DIAGNOSTIC = /(?:\bat\s+[\w$.<>]+\s*\([^\n]+:\d+:\d+\)|(?:node:)?internal\/|node_modules\/|file:\/\/|\/Users\/|\/private\/|\/home\/|\/[A-Za-z0-9_.-]+\/server\/|[A-Z]:\\|SQLSTATE|postgres(?:ql)?|ECONNREFUSED|ENOTFOUND|stack\s*trace|database\s+(?:query|connection)|api[_-]?key|authorization\s*:\s*bearer|password\s*[=:]|token\s*[=:]|<!doctype\s+html|<html[\s>]|\{\s*"(?:stack|sql|query)"\s*:)/i;

const PUBLIC_ERROR_CODE = /^(?:(?:AGENT|AI|COURSE|EVIDENCE|GRADE|JOIN|LEASE|LOCATION|PARTICIPANT|PHASE|QA|ROLE|SESSION|STEP|TASK|TEACHER|TIME_BANK|TOOL|UPLOAD)_[A-Z0-9_]+|INVALID_RESULT)$/;

const ERROR_MESSAGES = Object.freeze({
  AGENT_REQUEST_TIMEOUT: '连接响应超时，请再试一次。',
  AGENT_STREAM_INCOMPLETE: '絮絮的回复没有完整传到，请重试。',
  AGENT_STREAM_UNSUPPORTED: '当前浏览器不支持流式响应，请更换浏览器后重试。',
  AGENT_NETWORK_ERROR: '网络连接中断，请再试一次。',
  AI_TURN_TIMEOUT: '絮絮这次响应超时，请再试一次。',
  AI_DISABLED: 'AI 服务当前未启用，请联系老师。',
});

function cleanText(value = '') {
  return String(value ?? '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replace(CONTROL_CHARACTERS, '')
    .replaceAll(INTERNAL_MARKER, PUBLIC_MARKER)
    .trim();
}

export function containsClientUnsafeDirective(text = '') {
  const actionable = cleanText(text)
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

function safeFallback(value, fallback) {
  const cleanedFallback = cleanText(fallback);
  if (cleanedFallback && !containsClientUnsafeDirective(cleanedFallback)) return cleanedFallback;
  return value || DEFAULT_ERROR_FALLBACK;
}

function processText(text, {
  channel = 'student',
  fallback = '',
} = {}) {
  const actions = [];
  const original = String(text ?? '');
  let value = cleanText(original);
  if (value !== original.trim()) actions.push('normalized');
  if (containsClientUnsafeDirective(value)) {
    value = SAFE_ACTION_FALLBACK;
    actions.push('unsafe_action_blocked');
  }
  if (!value && fallback) {
    value = safeFallback('', fallback);
    actions.push('fallback_used');
  }
  return {
    text: value,
    actions: actions.map((action) => `${channel}:${action}`),
    policyVersion: CLIENT_STUDENT_FACING_POLICY_VERSION,
  };
}

function publicErrorMessage(error, fallback = DEFAULT_ERROR_FALLBACK) {
  const code = cleanText(error?.code || '');
  const configured = ERROR_MESSAGES[code];
  if (configured) return configured;

  const rawCandidate = typeof error === 'string'
    ? error
    : typeof error?.message === 'string' ? error.message : '';
  const raw = cleanText(rawCandidate);
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const canUsePublicMessage = Boolean(raw)
    && PUBLIC_ERROR_CODE.test(code)
    && !INTERNAL_DIAGNOSTIC.test(raw);
  if (canUsePublicMessage) {
    return processText(raw, { channel: 'error', fallback }).text;
  }

  const connectionFallback = error?.kind === 'connection' || status >= 500
    ? '服务暂时没有响应，请稍后重试。'
    : fallback;
  return safeFallback('', connectionFallback);
}

function visitSurface(value, options) {
  if (typeof value === 'string') return processText(value, options).text;
  if (Array.isArray(value)) return value.map((item) => visitSurface(item, options));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    visitSurface(item, options),
  ]));
}

export function createClientStudentFacingPolicy() {
  return Object.freeze({
    version: CLIENT_STUDENT_FACING_POLICY_VERSION,
    processText,
    processError(error, { fallback = DEFAULT_ERROR_FALLBACK } = {}) {
      return {
        text: publicErrorMessage(error, fallback),
        policyVersion: CLIENT_STUDENT_FACING_POLICY_VERSION,
      };
    },
    processSurface(value, { channel = 'surface', fallback = '' } = {}) {
      return {
        value: visitSurface(value, { channel, fallback }),
        policyVersion: CLIENT_STUDENT_FACING_POLICY_VERSION,
      };
    },
  });
}

const defaultPolicy = createClientStudentFacingPolicy();

export function studentFacingApiErrorMessage(error, fallback = DEFAULT_ERROR_FALLBACK) {
  return defaultPolicy.processError(error, { fallback }).text;
}
