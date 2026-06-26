const test = require('node:test');
const assert = require('node:assert/strict');

const { createStatsView } = require('../ui/stats-view');

function createStatsViewForHelpers(overrides = {}) {
  return createStatsView({
    elements: {},
    document: {},
    lanes: [{ id: 'top', label: 'Top' }],
    getChampionPoolLanePosition: () => 'TOP',
    createInlineChampionName: () => ({}),
    formatPercent: (value) => `${Math.round(Number(value || 0) * 100)}%`,
    formatAverageKda: () => '0.0/0.0/0.0',
    championLabel: (id) => ({ 1: 'Aatrox', 2: 'Brand', 3: 'Caitlyn' }[id] || `Champion ${id}`),
    formatWinLoss: () => '0-0',
    getLosses: (stats) => Number(stats.losses || 0),
    getPlayedStatsMinGames: () => 0,
    getOpponentStatsMinGames: () => 0,
    getMatchHistoryChampionStats: () => [],
    getMatchHistoryLaneOpponentStats: () => [],
    getMatchHistorySelfVsLaneOpponentStats: () => [],
    getActivePlayedLaneId: () => 'top',
    setActivePlayedLaneId() {},
    getActiveOpponentLaneId: () => 'top',
    setActiveOpponentLaneId() {},
    getPlayedStatsSortKey: () => 'winRate',
    setPlayedStatsSortKey() {},
    getOpponentStatsSortKey: () => 'winRate',
    setOpponentStatsSortKey() {},
    getPlayedStatsSortDirection: () => 'desc',
    setPlayedStatsSortDirection() {},
    getOpponentStatsSortDirection: () => 'desc',
    setOpponentStatsSortDirection() {},
    getExpandedPlayedStatsChampionId: () => null,
    setExpandedPlayedStatsChampionId() {},
    getExpandedOpponentStatsChampionId: () => null,
    setExpandedOpponentStatsChampionId() {},
    getShouldOpenFirstPlayedStatsRow: () => false,
    setShouldOpenFirstPlayedStatsRow() {},
    getShouldOpenFirstOpponentStatsRow: () => false,
    setShouldOpenFirstOpponentStatsRow() {},
    ...overrides
  });
}

test('stats view sort helper orders by primary key then games and champion name', () => {
  const view = createStatsViewForHelpers();
  const stats = [
    { championId: 3, games: 3, winRate: 0.5 },
    { championId: 1, games: 6, winRate: 0.5 },
    { championId: 2, games: 4, winRate: 0.75 }
  ];

  assert.deepEqual(
    view.sortStatsTableRows(stats, 'winRate', 'desc').map((entry) => entry.championId),
    [2, 1, 3]
  );
  assert.deepEqual(
    view.sortStatsTableRows(stats, 'games', 'asc').map((entry) => entry.championId),
    [3, 2, 1]
  );
});
