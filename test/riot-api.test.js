const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRiotApiHosts,
  getRetryDelayMs,
  getRiotRegionalRoute,
  normalizeRiotPlatformRegion,
  parseRetryAfterMs,
  requestRiotJson
} = require('../riot-api');

test('normalizes Riot platform regions and derives regional routes', () => {
  assert.equal(normalizeRiotPlatformRegion('jp1'), 'JP1');
  assert.equal(normalizeRiotPlatformRegion('bad'), 'JP1');
  assert.equal(getRiotRegionalRoute('JP1'), 'ASIA');
  assert.equal(getRiotRegionalRoute('NA1'), 'AMERICAS');
  assert.equal(getRiotRegionalRoute('EUW1'), 'EUROPE');
  assert.equal(getRiotRegionalRoute('SG2'), 'SEA');
  assert.deepEqual(createRiotApiHosts('jp1'), {
    platformRegion: 'JP1',
    regionalRoute: 'ASIA',
    platformHost: 'jp1.api.riotgames.com',
    regionalHost: 'asia.api.riotgames.com'
  });
});

test('parses Retry-After header values for rate limiting', () => {
  assert.equal(parseRetryAfterMs('2'), 2000);
  assert.equal(parseRetryAfterMs('0.5'), 500);
  assert.equal(parseRetryAfterMs('invalid'), null);
  assert.equal(getRetryDelayMs({ headers: { 'retry-after': '3' } }, 0), 3000);
  assert.equal(getRetryDelayMs({ headers: {} }, 1), 2000);
});

test('requestRiotJson waits and retries after HTTP 429', async () => {
  const calls = [];
  const waits = [];
  const response = await requestRiotJson({
    host: 'asia.api.riotgames.com',
    path: '/lol/match/v5/matches/JP1_1',
    apiToken: 'RGAPI-test',
    requestFn: async (request) => {
      calls.push(request);
      return calls.length === 1
        ? { statusCode: 429, headers: { 'retry-after': '1' }, body: '' }
        : { statusCode: 200, headers: {}, body: '{"ok":true}' };
    },
    wait: async (ms) => {
      waits.push(ms);
    }
  });

  assert.deepEqual(response, { ok: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [1000]);
  assert.equal(calls[0].headers['X-Riot-Token'], 'RGAPI-test');
});
