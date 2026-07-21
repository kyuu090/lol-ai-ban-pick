const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCaptureState,
  createDraftCaptureState,
  createStatsFixtureResponse,
  createTimeline
} = require('../scripts/ui-capture-fixtures');

test('UI capture state includes champion catalog and selected theme', () => {
  const state = createCaptureState('dark');
  assert.equal(state.settings.themeMode, 'dark');
  assert.equal(state.championsById[103].alias, 'Ahri');
  assert.deepEqual(state.championPool.middle, [103, 61]);
});

test('UI capture provides standalone ban and pick draft states', () => {
  const banState = createDraftCaptureState('ban');
  const pickState = createDraftCaptureState('pick');

  assert.equal(banState.champSelect.actions[0][0].type, 'ban');
  assert.equal(banState.champSelect.myTeam[0].championPickIntent, 103);
  assert.equal(banState.matchHistoryLaneOpponentStats.length, 3);
  assert.equal(pickState.champSelect.actions[0][0].type, 'pick');
  assert.equal(pickState.champSelect.theirTeam[0].championId, 238);
  assert.equal(pickState.championPool.middle.length, 12);
  assert.equal(pickState.matchHistorySelfVsLaneOpponentStats.length, 11);
});

test('UI capture StatsAPI fixtures cover analysis navigation', () => {
  const meta = createStatsFixtureResponse('/v1/stats/meta');
  const champions = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions?patch=16.13');
  const matchups = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions/103/matchups?minGames=20');
  const matchup = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions/103/matchups/238');
  const counterPicks = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions/238/matchups?minGames=40');
  const timeline = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions/103/timeline');

  assert.deepEqual(meta.data.positions, ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']);
  assert.equal(champions.data[0].championId, 103);
  assert.equal(matchups.data.matchups[0].opponentChampionId, 238);
  assert.equal(matchup.data.timeline.length, 8);
  assert.equal(counterPicks.data.matchups.length, 7);
  assert.equal(timeline.data.timeline.length, 8);
});

test('UI capture timeline provides all dashboard metrics at 5 to 40 minutes', () => {
  const timeline = createTimeline('overall');
  assert.deepEqual(timeline.map((point) => point.minute), [5, 10, 15, 20, 25, 30, 35, 40]);
  assert.equal(typeof timeline[0].difference.goldLeadRate, 'number');
  assert.equal(typeof timeline[0].laneFights.fight_occurred_rate, 'number');
  assert.equal(typeof timeline[0].champion.avgDamageToChampions, 'number');
  assert.equal(typeof timeline[0].opponent.avgTimeEnemyCcMs, 'number');
  assert.equal(typeof timeline[0].laneObjectives.avgLaneOuterPlatesTaken, 'number');
  assert.equal(typeof timeline[0].laneObjectives.laneOuterTowerTakenRate, 'number');
});

test('UI capture fixtures reject unhandled StatsAPI paths', () => {
  assert.throws(
    () => createStatsFixtureResponse('/v1/stats/positions/TOP/champions/999/timeline'),
    /No UI capture fixture/
  );
});
