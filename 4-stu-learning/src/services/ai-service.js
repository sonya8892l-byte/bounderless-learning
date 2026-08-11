export function resolvePublicApiBase(value) {
  const configured = String(value || '').trim();
  const redactedPlaceholder = /^\[[A-Z][A-Z0-9_-]*\]$/.test(configured);
  return (configured && !redactedPlaceholder ? configured : '/api').replace(/\/$/, '');
}

const API_BASE = resolvePublicApiBase(import.meta.env?.VITE_API_BASE_URL);
export const AGENT_TURN_TIMEOUT_MS = 100_000;

export class AgentRequestError extends Error {
  constructor(message, metadata = {}) {
    super(message, metadata.cause ? { cause: metadata.cause } : undefined);
    this.name = 'AgentRequestError';
    this.status = metadata.status ?? metadata.statusCode ?? null;
    this.statusCode = metadata.statusCode ?? metadata.status ?? null;
    this.code = metadata.code || null;
    this.retryable = Boolean(metadata.retryable);
    this.leaseExpiresAt = metadata.leaseExpiresAt || null;
    this.kind = metadata.kind || null;
    this.details = metadata.details;
  }
}

function errorFromResponse(response, body, fallbackMessage) {
  const status = response.status;
  return new AgentRequestError(body.error || fallbackMessage, {
    status,
    code: body.code || `HTTP_${status}`,
    retryable: body.retryable ?? (
      status === 408 || status === 425 || status === 429 || status >= 500
    ),
    leaseExpiresAt: body.leaseExpiresAt,
    kind: body.kind,
    details: body.details,
  });
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw errorFromResponse(response, body, `请求失败（${response.status}）`);
  return body;
}

export function createAgentSession(payload) {
  return jsonRequest('/sessions', { method: 'POST', body: JSON.stringify(payload) });
}

export function getAgentSession(sessionId) {
  return jsonRequest(`/sessions/${encodeURIComponent(sessionId)}`);
}

export function parseEventBlock(block) {
  let type = 'message';
  const data = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  return { type, data: JSON.parse(data.join('\n')) };
}

export function agentEventReplayKey(event) {
  if (!event?.type || event.type === 'assistant.delta') return null;
  try {
    return `${event.type}:${JSON.stringify(event.data ?? null)}`;
  } catch {
    return null;
  }
}

function normalizeTransportError(error, timedOut) {
  if (error instanceof AgentRequestError) return error;
  if (timedOut || error?.name === 'AbortError') {
    return new AgentRequestError('连接响应超时，请再试一次。', {
      code: 'AGENT_REQUEST_TIMEOUT',
      retryable: true,
      kind: 'connection',
      cause: error,
    });
  }
  return new AgentRequestError(error?.message || '网络连接中断，请再试一次。', {
    code: 'AGENT_NETWORK_ERROR',
    retryable: true,
    kind: 'connection',
    cause: error,
  });
}

async function sendAgentTurnAttempt(payload, onEvent, { timeoutMs }) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/agent/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw errorFromResponse(response, body, `智能体请求失败（${response.status}）`);
    }
    if (!response.body) {
      throw new AgentRequestError('浏览器不支持流式响应。', {
        code: 'AGENT_STREAM_UNSUPPORTED',
        retryable: false,
      });
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const events = [];
    let agentError = null;
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replaceAll('\r\n', '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const event = parseEventBlock(block);
        if (!event) continue;
        events.push(event);
        onEvent(event);
        if (event.type === 'agent.error') {
          agentError = new AgentRequestError(event.data?.message || '絮絮这次没有连接成功。', {
            ...(event.data || {}),
            status: event.data?.status ?? null,
          });
        }
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const event = parseEventBlock(buffer);
      if (event) {
        events.push(event);
        onEvent(event);
        if (event.type === 'agent.error') {
          agentError = new AgentRequestError(event.data?.message || '絮絮这次没有连接成功。', {
            ...(event.data || {}),
            status: event.data?.status ?? null,
          });
        }
      }
    }
    if (agentError) throw agentError;
    if (
      events.some((event) => event.type === 'assistant.delta')
      && !events.some((event) => event.type === 'assistant.completed')
    ) {
      throw new AgentRequestError('絮絮的回复没有完整传到，请重试。', {
        code: 'AGENT_STREAM_INCOMPLETE',
        retryable: true,
      });
    }
    return events;
  } catch (error) {
    throw normalizeTransportError(error, timedOut);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function retryDelay(error, retryNumber, {
  retryBaseDelayMs,
  maxRetryDelayMs,
  now,
}) {
  const exponentialDelay = Math.min(
    maxRetryDelayMs,
    retryBaseDelayMs * (2 ** Math.max(0, retryNumber - 1)),
  );
  if (error.status !== 409 || !error.leaseExpiresAt) return exponentialDelay;
  const untilLeaseExpiry = Date.parse(error.leaseExpiresAt) - now();
  if (!Number.isFinite(untilLeaseExpiry) || untilLeaseExpiry <= 0) return exponentialDelay;
  return Math.min(maxRetryDelayMs, Math.max(exponentialDelay, untilLeaseExpiry + 100));
}

function wait(milliseconds) {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function totalTurnTimeoutError() {
  return new AgentRequestError('连接响应超时，请再试一次。', {
    code: 'AGENT_REQUEST_TIMEOUT',
    retryable: true,
    kind: 'connection',
  });
}

export async function sendAgentTurn(payload, onEvent = () => {}, options = {}) {
  if (!payload?.requestId) {
    throw new AgentRequestError('智能体请求缺少 requestId。', {
      code: 'AGENT_REQUEST_ID_REQUIRED',
      retryable: false,
    });
  }
  const {
    timeoutMs = AGENT_TURN_TIMEOUT_MS,
    maxTransportRetries = 1,
    maxPendingRetries = 24,
    retryBaseDelayMs = 1_000,
    maxRetryDelayMs = 4_000,
    now = Date.now,
  } = options;
  const deliveredEventKeys = new Set();
  const deliverEvent = (event) => {
    const replayKey = agentEventReplayKey(event);
    if (replayKey && deliveredEventKeys.has(replayKey)) return;
    if (replayKey) deliveredEventKeys.add(replayKey);
    onEvent(event);
  };
  let transportRetries = 0;
  let pendingRetries = 0;
  const deadlineAt = now() + timeoutMs;

  while (true) {
    const remainingMs = deadlineAt - now();
    if (remainingMs <= 0) throw totalTurnTimeoutError();
    try {
      return await sendAgentTurnAttempt(payload, deliverEvent, { timeoutMs: remainingMs });
    } catch (error) {
      const pending = error.retryable && error.status === 409;
      let delayMs = null;
      if (pending && pendingRetries < maxPendingRetries) {
        pendingRetries += 1;
        delayMs = retryDelay(error, pendingRetries, {
          retryBaseDelayMs,
          maxRetryDelayMs,
          now,
        });
      } else if (!pending && error.retryable && transportRetries < maxTransportRetries) {
        transportRetries += 1;
        delayMs = retryDelay(error, transportRetries, {
          retryBaseDelayMs,
          maxRetryDelayMs,
          now,
        });
      }
      if (delayMs === null) throw error;
      const retryBudgetMs = deadlineAt - now();
      if (retryBudgetMs <= 0) throw totalTurnTimeoutError();
      await wait(Math.min(delayMs, retryBudgetMs));
    }
  }
}

async function compressEvidenceImage(file) {
  if (!file?.type?.startsWith('image/') || /hei[cf]/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 600 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
    if (!blob || blob.size >= file.size) return file;
    const filename = file.name.replace(/\.[^.]+$/, '') || 'evidence';
    return new File([blob], `${filename}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function uploadEvidence(file) {
  const uploadFile = await compressEvidenceImage(file);
  const form = new FormData();
  form.append('file', uploadFile, uploadFile.name);
  const response = await fetch(`${API_BASE}/uploads`, { method: 'POST', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '证据上传失败。');
  return body;
}

export function answerTimeBank(payload) {
  return jsonRequest('/time-bank/answer', { method: 'POST', body: JSON.stringify(payload) });
}

export function giftTime(payload) {
  return jsonRequest('/time-bank/gift', { method: 'POST', body: JSON.stringify(payload) });
}

export function requestTeacherHelp(payload) {
  return jsonRequest('/student/help', { method: 'POST', body: JSON.stringify(payload) });
}

export function getTeacherCommands(sessionId, after = 0) {
  return jsonRequest(`/student/sessions/${encodeURIComponent(sessionId)}/commands?after=${encodeURIComponent(after)}`);
}

export function sendTeacherCommandReceipt(sessionId, commandId, status) {
  return jsonRequest(`/student/sessions/${encodeURIComponent(sessionId)}/commands/${encodeURIComponent(commandId)}/receipt`, {
    method: 'POST', body: JSON.stringify({ status }),
  });
}

export function reportStudentPresence(sessionId, payload) {
  return jsonRequest(`/student/sessions/${encodeURIComponent(sessionId)}/presence`, {
    method: 'POST', body: JSON.stringify(payload),
  });
}
