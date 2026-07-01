const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStatsApiChampionsUrl,
  formatStatsApiErrorMessage,
  parseStatsApiErrorInfo,
  parseStatsApiRetryAfterSeconds
} = require('../ui/champions-view');

test('champions view stats api URL includes selected filters and fixed min pick rate', () => {
  const url = new URL(buildStatsApiChampionsUrl({
    patch: '15.12',
    position: 'BOTTOM',
    ranks: ['DIAMOND', 'MASTER']
  }));

  assert.equal(url.origin, 'https://db.banpick-ai.lol');
  assert.equal(url.pathname, '/v1/stats/champions');
  assert.equal(url.searchParams.get('patch'), '15.12');
  assert.equal(url.searchParams.get('position'), 'BOTTOM');
  assert.equal(url.searchParams.get('ranks'), 'DIAMOND,MASTER');
  assert.equal(url.searchParams.get('minPickRate'), '0.005');
  assert.equal(url.searchParams.get('limit'), '200');
  assert.equal(url.searchParams.get('sort'), 'games:desc');
});

test('champions view retry helpers read Retry-After and identify rate limits', () => {
  assert.equal(parseStatsApiRetryAfterSeconds('2.1'), 3);
  assert.equal(parseStatsApiRetryAfterSeconds('bad-value'), null);

  const errorInfo = parseStatsApiErrorInfo(new Error('StatsAPI request failed: 429; retryAfterSeconds=7'));
  assert.deepEqual(errorInfo, {
    message: 'StatsAPI request failed: 429; retryAfterSeconds=7',
    retryAfterSeconds: 7,
    status: 429
  });
  assert.equal(
    formatStatsApiErrorMessage(new Error('StatsAPI request failed: 429; retryAfterSeconds=7')),
    'レート制限に達しました。7秒後に再試行できます。'
  );
});
