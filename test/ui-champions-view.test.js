const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStatsApiChampionDetailsUrl,
  buildStatsApiChampionsUrl,
  buildStatsApiRuneIconUrl,
  buildStatsApiRunesDataUrl,
  formatStatsApiErrorMessage,
  getStatsApiLaneLabel,
  normalizeStatsApiRuneCatalog,
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
  assert.equal(url.pathname, '/v1/stats/positions/BOTTOM/champions');
  assert.equal(url.searchParams.get('patch'), '15.12');
  assert.equal(url.searchParams.get('ranks'), 'DIAMOND,MASTER');
  assert.equal(url.searchParams.get('minPickRate'), '0.005');
  assert.equal(url.searchParams.get('limit'), '200');
  assert.equal(url.searchParams.get('sort'), 'tierScore:desc');
});

test('champions view detail URL keeps current filters and selected champion id', () => {
  const url = new URL(buildStatsApiChampionDetailsUrl({
    patch: '16.13',
    position: 'MIDDLE',
    championId: 103,
    ranks: ['MASTER', 'GRANDMASTER'],
    opponentChampionId: 238
  }));

  assert.equal(url.origin, 'https://db.banpick-ai.lol');
  assert.equal(url.pathname, '/v1/stats/positions/MIDDLE/champions/103/details');
  assert.equal(url.searchParams.get('patch'), '16.13');
  assert.equal(url.searchParams.get('ranks'), 'MASTER,GRANDMASTER');
  assert.equal(url.searchParams.get('opponentChampionId'), '238');
});

test('champions view builds official Data Dragon rune data URLs', () => {
  assert.equal(
    buildStatsApiRunesDataUrl('16.13', 'ja_JP'),
    'https://ddragon.leagueoflegends.com/cdn/16.13.1/data/ja_JP/runesReforged.json'
  );
  assert.equal(
    buildStatsApiRunesDataUrl('16.13.1', 'en_US'),
    'https://ddragon.leagueoflegends.com/cdn/16.13.1/data/en_US/runesReforged.json'
  );
});

test('champions view rune asset URLs point to Data Dragon image CDN', () => {
  assert.equal(
    buildStatsApiRuneIconUrl('perk-images/Styles/Domination/Electrocute/Electrocute.png'),
    'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png'
  );
  assert.equal(buildStatsApiRuneIconUrl(''), '');
});

test('champions view normalizes official rune data into style and perk maps', () => {
  const catalog = normalizeStatsApiRuneCatalog([
    {
      id: 8200,
      name: '鬲秘％',
      icon: 'perk-images/Styles/7202_Sorcery.png',
      slots: [
        {
          runes: [
            {
              id: 8237,
              name: '霑ｽ縺・↓',
              icon: 'perk-images/Styles/Sorcery/Scorch/Scorch.png'
            }
          ]
        }
      ]
    }
  ]);

  assert.deepEqual(catalog.styles['8200'], {
    iconPath: 'perk-images/Styles/7202_Sorcery.png',
    id: 8200,
    name: '鬲秘％',
    slots: [[{
      iconPath: 'perk-images/Styles/Sorcery/Scorch/Scorch.png',
      id: 8237,
      name: '霑ｽ縺・↓',
      styleId: 8200
    }]],
    styleId: 8200
  });
  assert.deepEqual(catalog.perks['8237'], {
    iconPath: 'perk-images/Styles/Sorcery/Scorch/Scorch.png',
    id: 8237,
    name: '霑ｽ縺・↓',
    styleId: 8200
  });
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
    typeof formatStatsApiErrorMessage(new Error('StatsAPI request failed: 429; retryAfterSeconds=7')),
    'string'
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
