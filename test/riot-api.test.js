const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_RIOT_BFF_BASE_URL,
  getRetryDelayMs,
  normalizeRiotBffBaseUrl,
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

test('normalizeRiotBffBaseUrl keeps http URLs and removes trailing URL parts', () => {
  assert.equal(
    normalizeRiotBffBaseUrl('http://localhost:8080///?debug=true#hash'),
    'http://localhost:8080'
  );
});

test('normalizeRiotBffBaseUrl falls back to production URL for invalid values', () => {
  assert.equal(normalizeRiotBffBaseUrl('ftp://example.test'), DEFAULT_RIOT_BFF_BASE_URL);
  assert.equal(normalizeRiotBffBaseUrl('not a url'), DEFAULT_RIOT_BFF_BASE_URL);
});

test('requestRiotJson notifies before retrying 429', async () => {
  const retries = [];
  let calls = 0;
  const body = await requestRiotJson({
    baseUrl: 'https://bff.example.test',
    path: '/test',
    wait: async () => {},
    onRetry: (retry) => retries.push(retry),
    requestFn: async ({ url, headers }) => {
      calls += 1;
      assert.equal(url.toString(), 'https://bff.example.test/test');
      assert.deepEqual(headers, { Accept: 'application/json' });
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

test('requestRiotJson exposes BFF non-2xx failures', async () => {
  await assert.rejects(
    requestRiotJson({
      baseUrl: 'https://bff.example.test',
      path: '/test',
      requestFn: async () => ({ statusCode: 503, headers: {}, body: '{"error":{"code":"riot_api_unavailable"}}' })
    }),
    (error) => {
      assert.equal(error instanceof RiotApiError, true);
      assert.equal(error.statusCode, 503);
      return true;
    }
  );
});
