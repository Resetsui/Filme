import test from 'node:test';
import assert from 'node:assert/strict';
import { isTransientAiError, runWithModelFallback } from './aiRetry';

test('succeeds on primary model without invoking fallback', async () => {
  const calls: string[] = [];
  const { result, modelUsed } = await runWithModelFallback(
    async (model) => {
      calls.push(model);
      return 'ok-movies';
    },
    {
      models: ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
      sleep: async () => {},
    },
  );
  assert.equal(result, 'ok-movies');
  assert.equal(modelUsed, 'gemini-3.1-flash-lite');
  assert.deepEqual(calls, ['gemini-3.1-flash-lite']);
});

test('retries and falls back to secondary model on 503 UNAVAILABLE overload spike', async () => {
  const calls: string[] = [];
  const delays: number[] = [];
  const { result, modelUsed } = await runWithModelFallback(
    async (model) => {
      calls.push(model);
      if (model === 'gemini-3.1-flash-lite') {
        throw new Error('503 UNAVAILABLE: The model is overloaded due to high demand');
      }
      return 'fallback-ok';
    },
    {
      models: ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
      baseDelayMs: 500,
      sleep: async (ms) => {
        delays.push(ms);
      },
    },
  );
  assert.equal(result, 'fallback-ok');
  assert.equal(modelUsed, 'gemini-4-hydrogen');
  assert.deepEqual(calls, ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']);
  assert.deepEqual(delays, [500]);
});

test('fails fast without retrying invalid API key or permission errors', async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      runWithModelFallback(
        async (model) => {
          calls.push(model);
          throw new Error('403 PERMISSION_DENIED: API_KEY_INVALID');
        },
        {
          models: ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
          sleep: async () => {},
        },
      ),
    /API_KEY_INVALID/,
  );
  assert.deepEqual(calls, ['gemini-3.1-flash-lite']);
});

test('aborts hung request after timeout and falls back cleanly', async () => {
  const calls: string[] = [];
  const { result, modelUsed } = await runWithModelFallback(
    async (model) => {
      calls.push(model);
      if (model === 'slow-model') {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'too-late';
      }
      return 'fast-fallback';
    },
    {
      models: ['slow-model', 'fast-model'],
      timeoutMs: 30,
      sleep: async () => {},
    },
  );
  assert.equal(result, 'fast-fallback');
  assert.equal(modelUsed, 'fast-model');
  assert.deepEqual(calls, ['slow-model', 'fast-model']);
  assert.equal(isTransientAiError(new Error('503 Service Unavailable')), true);
});
