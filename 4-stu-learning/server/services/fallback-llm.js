const HARD_FAILURE_STATUSES = new Set([401, 402, 403]);
const FALLBACK_STATUSES = new Set([400, 401, 402, 403, 404, 408, 409, 415, 422, 429]);

function failureCode(error) {
  if (error?.code) return String(error.code);
  if (Number.isInteger(error?.status)) return `HTTP_${error.status}`;
  return error?.name || 'MODEL_ERROR';
}

export function shouldFallbackFromModelError(error, signal) {
  if (signal?.aborted || error?.name === 'AbortError') return false;
  if (error?.code === 'LLM_TIMEOUT' || error?.name === 'LLMTimeoutError') return true;
  if (FALLBACK_STATUSES.has(error?.status) || Number(error?.status) >= 500) return true;
  return error instanceof TypeError;
}

/**
 * 给语义理解和 AI 验收使用的双模型门面。
 *
 * 专用模型正常时走 primary；认证、余额、网络、超时或接口兼容失败时，立即改走
 * fallback，并在一段时间内跳过已知不可用的 primary。它不记录请求内容，只暴露
 * 脱敏后的运行状态，供 readiness 和诊断使用。
 */
export function createFallbackLLM({
  primary,
  fallback,
  purpose = 'auxiliary',
  logger,
  transientCircuitMs = 60_000,
  hardFailureCircuitMs = 15 * 60_000,
  now = () => Date.now(),
} = {}) {
  if (!primary?.generate || !fallback?.generate) {
    throw new TypeError('createFallbackLLM 需要 primary 和 fallback 两个模型客户端。');
  }

  let openUntil = 0;
  let lastFailureCode = null;
  let fallbackCount = 0;

  function status() {
    const fallbackActive = openUntil > now();
    return {
      purpose,
      fallbackActive,
      lastFailureCode,
      fallbackCount,
    };
  }

  async function generate(input = {}) {
    if (openUntil > now()) {
      fallbackCount += 1;
      return fallback.generate(input);
    }
    try {
      const result = await primary.generate(input);
      openUntil = 0;
      lastFailureCode = null;
      return result;
    } catch (error) {
      if (!shouldFallbackFromModelError(error, input.signal)) throw error;
      const hardFailure = HARD_FAILURE_STATUSES.has(error?.status);
      openUntil = now() + (hardFailure ? hardFailureCircuitMs : transientCircuitMs);
      lastFailureCode = failureCode(error);
      fallbackCount += 1;
      logger?.warn?.({
        modelFallback: {
          purpose,
          code: lastFailureCode,
          hardFailure,
          circuitMs: hardFailure ? hardFailureCircuitMs : transientCircuitMs,
        },
      }, 'specialized model unavailable; using main model fallback');
      return fallback.generate(input);
    }
  }

  return {
    generate,
    status,
    capabilities() {
      // fallback 是兜底能力的下限；例如专用验收模型不支持视觉时，主模型仍可接手。
      return fallback.capabilities();
    },
  };
}
