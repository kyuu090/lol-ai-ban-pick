const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_RIOT_BFF_BASE_URL,
  getRiotRegionalRouteFromLcuRegion,
  getRiotPlatformRegionFromLcuRegion,
  getRetryDelayMs,
  normalizeRiotBffBaseUrl,
  parseRetryAfterMs,
  RiotApiError,
  requestRiotBffJson
} = require('../riot-api');

test('getRiotRegionalRouteFromLcuRegion derives Match-V5 routes without a platform ID', () => {
  assert.equal(getRiotRegionalRouteFromLcuRegion('JP'), 'ASIA');
  assert.equal(getRiotRegionalRouteFromLcuRegion('NA'), 'AMERICAS');
  assert.equal(getRiotRegionalRouteFromLcuRegion('EUW'), 'EUROPE');
  assert.equal(getRiotRegionalRouteFromLcuRegion('PH'), 'SEA');
  assert.equal(getRiotRegionalRouteFromLcuRegion('unknown'), null);
});

test('getRiotPlatformRegionFromLcuRegion supports every current LoL platform', () => {
  assert.deepEqual({
    BR: getRiotPlatformRegionFromLcuRegion('BR'),
    EUNE: getRiotPlatformRegionFromLcuRegion('EUNE'),
    EUW: getRiotPlatformRegionFromLcuRegion('EUW'),
    JP: getRiotPlatformRegionFromLcuRegion('JP'),
    KR: getRiotPlatformRegionFromLcuRegion('KR'),
    LAN: getRiotPlatformRegionFromLcuRegion('LAN'),
    LAS: getRiotPlatformRegionFromLcuRegion('LAS'),
    NA: getRiotPlatformRegionFromLcuRegion('NA'),
    OCE: getRiotPlatformRegionFromLcuRegion('OCE'),
    TR: getRiotPlatformRegionFromLcuRegion('TR'),
    RU: getRiotPlatformRegionFromLcuRegion('RU'),
    SG: getRiotPlatformRegionFromLcuRegion('SG'),
    TW: getRiotPlatformRegionFromLcuRegion('TW'),
    VN: getRiotPlatformRegionFromLcuRegion('VN')
  }, {
    BR: 'BR1', EUNE: 'EUN1', EUW: 'EUW1', JP: 'JP1', KR: 'KR',
    LAN: 'LA1', LAS: 'LA2', NA: 'NA1', OCE: 'OC1', TR: 'TR1', RU: 'RU', SG: 'SG2', TW: 'TW2', VN: 'VN2'
  });
  assert.equal(getRiotPlatformRegionFromLcuRegion('PH'), 'SG2');
  assert.equal(getRiotPlatformRegionFromLcuRegion('TH'), 'SG2');
});

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
