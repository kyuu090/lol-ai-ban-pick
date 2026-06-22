const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_RIOT_BFF_BASE_URL,
  getRetryDelayMs,
  normalizeRiotBffBaseUrl,
  parseRetryAfterMs,
  RiotApiError,
  requestRiotBffJson
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

test('requestRiotBffJson notifies before retrying 429', async () => {
  const retries = [];
  let calls = 0;
  const body = await requestRiotBffJson({
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

test('requestRiotBffJson exposes BFF non-2xx failures', async () => {
  await assert.rejects(
    requestRiotBffJson({
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

test('requestRiotBffJson posts JSON request bodies', async () => {
  const body = await requestRiotBffJson({
    baseUrl: 'https://bff.example.test',
    path: '/api/openai/pick-phase',
    method: 'POST',
    body: {
      phase: 'own_pick',
      ownChampionPool: []
    },
    timeoutMs: 30000,
    requestFn: async ({ url, method, headers, body: requestBody, timeoutMs }) => {
      assert.equal(url.toString(), 'https://bff.example.test/api/openai/pick-phase');
      assert.equal(method, 'POST');
      assert.deepEqual(headers, {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      });
      assert.equal(requestBody, '{"phase":"own_pick","ownChampionPool":[]}');
      assert.equal(timeoutMs, 30000);
      return { statusCode: 200, headers: {}, body: '{"notes":[]}' };
    }
  });

  assert.deepEqual(body, { notes: [] });
});
