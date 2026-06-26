const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRiotBffPath,
  requestBffJson
} = require('../main/ai-analysis-service');
const { DEFAULT_RIOT_BFF_BASE_URL } = require('../riot-api');

test('createRiotBffPath encodes Riot route segments and query values', () => {
  assert.equal(
    createRiotBffPath('JP1', ['account', 'by-riot-id', 'Name With Space', 'JP#1']),
    '/api/riot/JP1/account/by-riot-id/Name%20With%20Space/JP%231'
  );
  assert.equal(
    createRiotBffPath('JP1', ['matches', 'by-puuid', 'abc/def', 'ids'], {
      start: 0,
      count: 100,
      startTime: null
    }),
    '/api/riot/JP1/matches/by-puuid/abc%2Fdef/ids?start=0&count=100'
  );
});

test('requestBffJson forwards request options to Riot BFF request helper', async () => {
  const body = await requestBffJson({
    path: '/test',
    method: 'POST',
    body: { ok: true },
    maxRetries: 0,
    timeoutMs: 100,
    requestFn: async ({ url, method, body: requestBody, timeoutMs }) => {
      assert.equal(url.toString(), `${DEFAULT_RIOT_BFF_BASE_URL}/test`);
      assert.equal(method, 'POST');
      assert.equal(requestBody, '{"ok":true}');
      assert.equal(timeoutMs, 100);
      return { statusCode: 200, headers: {}, body: '{"result":true}' };
    }
  });

  assert.deepEqual(body, { result: true });
});
