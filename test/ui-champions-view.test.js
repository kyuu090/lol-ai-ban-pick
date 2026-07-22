const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStatsApiChampionDetailsUrl,
  buildStatsApiChampionsUrl,
  buildStatsApiMatchupTimelineUrl,
  buildStatsApiMatchupsUrl,
  buildStatsApiTimelineUrl,
  buildStatsApiRuneIconUrl,
  buildStatsApiChampionSearchText,
  filterStatsApiChampionRows,
  filterStatsApiOpponentChampionOptions,
  buildStatsApiRunesDataUrl,
  formatStatsApiErrorMessage,
  getStatsApiOpponentChampionOptions,
  getStatsApiLaneFightIndicator,
  getStatsApiLeadRateScale,
  getStatsApiLaneLabel,
  getStatsApiRanksAtOrAbove,
  getStatsApiRanksForSelection,
  getStatsApiShardRowIndex,
  normalizeStatsApiSearchText,
  normalizeStatsApiRuneCatalog,
  normalizeStatsApiSelectedShardIds,
  parseStatsApiErrorInfo,
  parseStatsApiRetryAfterSeconds,
  sortStatsApiMatchupRows,
  sortStatsApiChampionRows
} = require('../ui/champions-view');

test('champions view rank threshold includes the selected rank and higher available ranks', () => {
  const availableRanks = ['IRON', 'GOLD', 'EMERALD', 'DIAMOND', 'MASTER', 'CHALLENGER'];

  assert.deepEqual(
    getStatsApiRanksAtOrAbove('EMERALD', availableRanks),
    ['EMERALD', 'DIAMOND', 'MASTER', 'CHALLENGER']
  );
  assert.deepEqual(getStatsApiRanksAtOrAbove('', availableRanks), []);
});

test('champions view rank selection supports exact and rank-or-higher filters', () => {
  const availableRanks = ['GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'CHALLENGER'];

  assert.deepEqual(getStatsApiRanksForSelection('exact:EMERALD', availableRanks), ['EMERALD']);
  assert.deepEqual(
    getStatsApiRanksForSelection('plus:EMERALD', availableRanks),
    ['EMERALD', 'DIAMOND', 'MASTER', 'CHALLENGER']
  );
});

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
    keystoneId: 8112,
    ranks: ['MASTER', 'GRANDMASTER'],
    opponentChampionId: 238
  }));

  assert.equal(url.origin, 'https://db.banpick-ai.lol');
  assert.equal(url.pathname, '/v1/stats/positions/MIDDLE/champions/103/details');
  assert.equal(url.searchParams.get('patch'), '16.13');
  assert.equal(url.searchParams.get('ranks'), 'MASTER,GRANDMASTER');
  assert.equal(url.searchParams.get('keystoneId'), '8112');
  assert.equal(url.searchParams.get('opponentChampionId'), '238');
});

test('champions view analysis URLs keep the selected champion, opponent, and common filters', () => {
  const filters = {
    patch: '16.13',
    position: 'MIDDLE',
    championId: 103,
    ranks: ['MASTER', 'GRANDMASTER']
  };
  const matchupsUrl = new URL(buildStatsApiMatchupsUrl({ ...filters, minGames: 50 }));
  assert.equal(matchupsUrl.pathname, '/v1/stats/positions/MIDDLE/champions/103/matchups');
  assert.equal(matchupsUrl.searchParams.get('patch'), '16.13');
  assert.equal(matchupsUrl.searchParams.get('ranks'), 'MASTER,GRANDMASTER');
  assert.equal(matchupsUrl.searchParams.get('minGames'), '50');

  const matchupTimelineUrl = new URL(buildStatsApiMatchupTimelineUrl({
    ...filters,
    opponentChampionId: 238
  }));
  assert.equal(matchupTimelineUrl.pathname, '/v1/stats/positions/MIDDLE/champions/103/matchups/238');
  assert.equal(matchupTimelineUrl.searchParams.get('patch'), '16.13');

  const timelineUrl = new URL(buildStatsApiTimelineUrl(filters));
  assert.equal(timelineUrl.pathname, '/v1/stats/positions/MIDDLE/champions/103/timeline');
  assert.equal(timelineUrl.searchParams.get('ranks'), 'MASTER,GRANDMASTER');
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

test('champions view normalizes opponent search text for mixed jp/en inputs', () => {
  assert.equal(normalizeStatsApiSearchText('  Ahri '), 'ahri');
  assert.equal(normalizeStatsApiSearchText(' ツイステッド・フェイト '), 'ツイステッド・フェイト');
});

test('champions view opponent filter indexes japanese names and english aliases', () => {
  const options = getStatsApiOpponentChampionOptions({
    4: { id: 4, name: 'ツイステッド・フェイト', alias: 'TwistedFate', title: 'カードマスター' },
    103: { id: 103, name: 'アーリ', alias: 'Ahri', title: '九尾の狐' }
  });

  assert.deepEqual(
    filterStatsApiOpponentChampionOptions(options, 'ツイステッド').map((entry) => entry.championId),
    [4]
  );
  assert.deepEqual(
    filterStatsApiOpponentChampionOptions(options, 'ahri').map((entry) => entry.championId),
    [103]
  );
  assert.deepEqual(
    filterStatsApiOpponentChampionOptions(options, 'fate').map((entry) => entry.championId),
    [4]
  );
});

test('champions view champion search text includes localized name and english alias metadata', () => {
  assert.equal(
    buildStatsApiChampionSearchText(
      103,
      {
        103: { id: 103, name: 'アーリ', alias: 'Ahri', title: '九尾の狐' }
      },
      () => 'アーリ'
    ),
    'アーリ アーリ ahri 九尾の狐'
  );
});

test('champions view champion list filter matches japanese names and english aliases', () => {
  const statsList = [
    { championId: 103, mostPlayedLane: 'MIDDLE', games: 120, winRate: 0.515, pickRate: 0.083, banRate: 0.021, tier: 'A', tierScore: 52.12 },
    { championId: 4, mostPlayedLane: 'MIDDLE', games: 88, winRate: 0.553, pickRate: 0.044, banRate: 0.012, tier: 'S', tierScore: 55.32 }
  ];
  const championsById = {
    4: { id: 4, name: 'ツイステッド・フェイト', alias: 'TwistedFate', title: 'カードマスター' },
    103: { id: 103, name: 'アーリ', alias: 'Ahri', title: '九尾の狐' }
  };
  const championLabel = (championId) => championsById[championId].name;

  assert.deepEqual(
    filterStatsApiChampionRows(statsList, 'アーリ', championsById, championLabel).map((entry) => entry.championId),
    [103]
  );
  assert.deepEqual(
    filterStatsApiChampionRows(statsList, 'fate', championsById, championLabel).map((entry) => entry.championId),
    [4]
  );
  assert.deepEqual(
    filterStatsApiChampionRows(statsList, '', championsById, championLabel).map((entry) => entry.championId),
    [103, 4]
  );
});

test('champions view shard helper maps each shard id to the expected row', () => {
  assert.equal(getStatsApiShardRowIndex(5008), 0);
  assert.equal(getStatsApiShardRowIndex(5005), 0);
  assert.equal(getStatsApiShardRowIndex(5007), 0);
  assert.equal(getStatsApiShardRowIndex(5010), 1);
  assert.equal(getStatsApiShardRowIndex(5011), 2);
  assert.equal(getStatsApiShardRowIndex(5013), 2);
  assert.equal(getStatsApiShardRowIndex(5001), 1);
  assert.equal(getStatsApiShardRowIndex(5002), -1);
  assert.equal(getStatsApiShardRowIndex(5003), -1);
  assert.equal(getStatsApiShardRowIndex(9999), -1);
});

test('champions view shard helper keeps one selected shard per row when a preferred entry contains all rows', () => {
  assert.deepEqual(
    normalizeStatsApiSelectedShardIds([
      { shardIds: [5008, 5010, 5001] }
    ]),
    [5008, 5010, 5001]
  );
});

test('champions view shard helper reconstructs row selections from split stat shard entries', () => {
  assert.deepEqual(
    normalizeStatsApiSelectedShardIds([
      { shardIds: [5008] },
      { shardIds: [5010] },
      { shardIds: [5001] }
    ]),
    [5008, 5010, 0]
  );
});

test('champions view shard helper resolves the reported [5008, 5010, 5001] case without leaving rows dark', () => {
  assert.deepEqual(
    normalizeStatsApiSelectedShardIds([
      { shardIds: [5008, 5010, 5001] }
    ]),
    [5008, 5010, 5001]
  );
});

test('champions view shard helper falls back by greedily resolving mixed shard entries', () => {
  assert.deepEqual(
    normalizeStatsApiSelectedShardIds([
      { shardIds: [5008, 5005] },
      { shardIds: [5002] },
      { shardIds: [] },
      { shardIds: [5011, 5010] }
    ]),
    [5005, 5008, 5011]
  );
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

test('matchup rows sort by opponent, games, win rate, and baseline difference', () => {
  const matchups = [
    { opponentChampionId: 1, games: 120, wins: 60, winRateVsOpponent: 0.5 },
    { opponentChampionId: 2, games: 80, wins: 48, winRateVsOpponent: 0.6 },
    { opponentChampionId: 3, games: 200, wins: 90, winRateVsOpponent: 0.45 }
  ];
  const championLabel = (championId) => ({ 1: 'Ahri', 2: 'Zed', 3: 'Akali' }[championId]);

  assert.deepEqual(sortStatsApiMatchupRows(matchups, 0.52, 'opponent', 'asc', championLabel).map((entry) => entry.opponentChampionId), [1, 3, 2]);
  assert.deepEqual(sortStatsApiMatchupRows(matchups, 0.52, 'games', 'desc', championLabel).map((entry) => entry.opponentChampionId), [3, 1, 2]);
  assert.deepEqual(sortStatsApiMatchupRows(matchups, 0.52, 'winRate', 'desc', championLabel).map((entry) => entry.opponentChampionId), [2, 1, 3]);
  assert.deepEqual(sortStatsApiMatchupRows(matchups, 0.52, 'difference', 'asc', championLabel).map((entry) => entry.opponentChampionId), [3, 1, 2]);
});

test('lead rate scale stays centered on 50 percent and zooms to small changes', () => {
  assert.deepEqual(getStatsApiLeadRateScale([0.52, 0.55]), {
    minimum: 0.44,
    maximum: 0.56
  });
  assert.deepEqual(getStatsApiLeadRateScale([0.31, 0.53]), {
    minimum: 0.3,
    maximum: 0.7
  });
});

test('lane fight indicator uses role-specific lane combat formulas', () => {
  const laneFights = {
    isolated_kills_vs_lane: 0.4,
    isolated_deaths_vs_lane: 0.2,
    isolated_assists_vs_lane: 0.3
  };
  assert.deepEqual(getStatsApiLaneFightIndicator(laneFights, 'TOP'), {
    label: 'ソロキル収支',
    description: 'ソロKill − ソロDeath',
    detail: 'Kill 0.40 / Death 0.20',
    value: 0.2
  });
  assert.deepEqual(getStatsApiLaneFightIndicator(
    laneFights,
    'JUNGLE',
    { avgKills: 1.8, avgAssists: 2.4 },
    { avgKills: 1.25, avgAssists: 1.6 }
  ), {
    label: 'JGキル関与数差',
    description: '全Kill + Assist: 自JG − 相手JG',
    detail: '自JG K+A 4.20 / 相手JG K+A 2.85',
    value: 1.35
  });
  assert.deepEqual(getStatsApiLaneFightIndicator(laneFights, 'BOTTOM'), {
    label: '2v2キル収支',
    description: 'Kill − Death（2v2）',
    detail: 'Kill 0.40 / Death 0.20',
    value: 0.2
  });
  assert.throws(
    () => getStatsApiLaneFightIndicator(laneFights, 'JUNGLE'),
    /requires champion\/opponent avgKills and avgAssists/
  );
  assert.throws(
    () => getStatsApiLaneFightIndicator(
      laneFights,
      'JUNGLE',
      { avgKills: 1.8 },
      { avgKills: 1.25, avgAssists: 1.6 }
    ),
    /requires champion\/opponent avgKills and avgAssists/
  );
});
