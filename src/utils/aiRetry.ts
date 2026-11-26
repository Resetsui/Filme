export function isTransientAiError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('500') ||
    lower.includes('internal') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed')
  );
}

export function isAuthOrInvalidKeyError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('invalid api key')
  );
}

export interface FallbackAttemptOptions {
  models: string[];
  timeoutMs?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI request timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Runs a Gemini generation task across an ordered list of candidate models
 * with bounded per-attempt timeouts and short exponential backoff on 503/transient errors.
 * Non-retryable auth/key errors fail fast without wasting retries.
 */
export async function runWithModelFallback<T>(
  executor: (model: string, attemptIndex: number) => Promise<T>,
  options: FallbackAttemptOptions,
): Promise<{ result: T; modelUsed: string }> {
  const { models, timeoutMs = 22_000, baseDelayMs = 700, sleep = defaultSleep } = options;
  if (models.length === 0) {
    throw new Error('Nenhum modelo configurado para geração.');
  }

  let lastError: unknown = null;

  for (let idx = 0; idx < models.length; idx += 1) {
    const model = models[idx];
    try {
      const result = await withTimeout(executor(model, idx), timeoutMs);
      return { result, modelUsed: model };
    } catch (error) {
      lastError = error;
      if (isAuthOrInvalidKeyError(error) || !isTransientAiError(error)) {
        throw error;
      }
      if (idx < models.length - 1) {
        const delay = baseDelayMs * Math.pow(1.8, idx);
        await sleep(Math.round(delay));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Falha na chamada de IA.'));
}
