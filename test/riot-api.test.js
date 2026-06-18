const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getRetryDelayMs,
  isRiotApiAuthError,
  parseRetryAfterMs,
  RiotApiError,
  requestRiotJson
} = require('../riot-api');

test('parseRetryAfterMs supports seconds', () => {
  assert.equal(parseRetryAfterMs('1.5'), 1500);
});

test('getRetryDelayMs prefers Retry-After header', () => {
  assert.equal(getRetryDelayMs({ headers: { 'retry-after': '2' } }, 0), 2000);
});

test('requestRiotJson notifies before retrying 429', async () => {
  const retries = [];
  let calls = 0;
  const body = await requestRiotJson({
    host: 'asia.api.riotgames.com',
    path: '/test',
    apiToken: 'RGAPI-test',
    wait: async () => {},
    onRetry: (retry) => retries.push(retry),
    requestFn: async () => {
      calls += 1;
      return calls === 1
        ? { statusCode: 429, headers: { 'retry-after': '3' }, body: '' }
        : { statusCode: 200, headers: {}, body: '{"ok":true}' };
    }
  });

  assert.deepEqual(body, { ok: true });
  assert.equal(retries.length, 1);
  assert.equal(retries[0].attempt, 1);
  assert.equal(retries[0].delayMs, 3000);
});

test('requestRiotJson exposes Riot API authentication failures', async () => {
  await assert.rejects(
    requestRiotJson({
      host: 'asia.api.riotgames.com',
      path: '/test',
      apiToken: 'RGAPI-bad',
      requestFn: async () => ({ statusCode: 401, headers: {}, body: '{"status":"Unauthorized"}' })
    }),
    (error) => {
      assert.equal(error instanceof RiotApiError, true);
      assert.equal(error.statusCode, 401);
      assert.equal(isRiotApiAuthError(error), true);
      return true;
    }
  );
});
