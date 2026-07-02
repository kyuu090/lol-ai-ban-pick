const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStatsApiChampionsUrl,
  formatStatsApiErrorMessage,
  getStatsApiLaneLabel,
  parseStatsApiErrorInfo,
  parseStatsApiRetryAfterSeconds,
  sortStatsApiChampionRows
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
  assert.equal(url.searchParams.get('sort'), 'tierScore:desc');
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

test('champions view lane labels use compact stats tab naming', () => {
  assert.equal(getStatsApiLaneLabel('TOP'), 'TOP');
  assert.equal(getStatsApiLaneLabel('JUNGLE'), 'JG');
  assert.equal(getStatsApiLaneLabel('MIDDLE'), 'MID');
  assert.equal(getStatsApiLaneLabel('BOTTOM'), 'BOT');
  assert.equal(getStatsApiLaneLabel('UTILITY'), 'SUP');
  assert.equal(getStatsApiLaneLabel(''), '-');
});

test('champions view sort helper defaults cleanly across numeric and text columns', () => {
  const stats = [
    { championId: 1, mostPlayedLane: 'MIDDLE', games: 120, winRate: 0.515, pickRate: 0.083, banRate: 0.021, tier: 'A', tierScore: 52.12 },
    { championId: 2, mostPlayedLane: 'TOP', games: 88, winRate: 0.553, pickRate: 0.044, banRate: 0.012, tier: 'S', tierScore: 55.32 },
    { championId: 3, mostPlayedLane: 'JUNGLE', games: 88, winRate: 0.553, pickRate: 0.041, banRate: 0.018, tier: 'S', tierScore: 55.32 }
  ];
  const championLabel = (championId) => ({ 1: 'Ahri', 2: 'Garen', 3: 'Amumu' }[championId]);

  assert.deepEqual(
    sortStatsApiChampionRows(stats, 'tierScore', 'desc', championLabel).map((entry) => entry.championId),
    [3, 2, 1]
  );
  assert.deepEqual(
    sortStatsApiChampionRows(stats, 'winRate', 'desc', championLabel).map((entry) => entry.championId),
    [3, 2, 1]
  );
  assert.deepEqual(
    sortStatsApiChampionRows(stats, 'champion', 'asc', championLabel).map((entry) => entry.championId),
    [1, 3, 2]
  );
});
