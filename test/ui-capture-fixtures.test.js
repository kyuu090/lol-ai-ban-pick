const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCaptureState,
  createStatsFixtureResponse,
  createTimeline
} = require('../scripts/ui-capture-fixtures');

test('UI capture state includes champion catalog and selected theme', () => {
  const state = createCaptureState('dark');
  assert.equal(state.settings.themeMode, 'dark');
  assert.equal(state.championsById[103].alias, 'Ahri');
  assert.deepEqual(state.championPool.middle, [103, 61]);
});

test('UI capture StatsAPI fixtures cover analysis navigation', () => {
  const meta = createStatsFixtureResponse('/v1/stats/meta');
  const champions = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions?patch=16.13');
  const matchups = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions/103/matchups?minGames=20');
  const matchup = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions/103/matchups/238');
  const timeline = createStatsFixtureResponse('/v1/stats/positions/MIDDLE/champions/103/timeline');

  assert.deepEqual(meta.data.positions, ['MIDDLE']);
  assert.equal(champions.data[0].championId, 103);
  assert.equal(matchups.data.matchups[0].opponentChampionId, 238);
  assert.equal(matchup.data.timeline.length, 8);
  assert.equal(timeline.data.timeline.length, 8);
});

test('UI capture timeline provides all dashboard metrics at 5 to 40 minutes', () => {
  const timeline = createTimeline('overall');
  assert.deepEqual(timeline.map((point) => point.minute), [5, 10, 15, 20, 25, 30, 35, 40]);
  assert.equal(typeof timeline[0].difference.goldLeadRate, 'number');
  assert.equal(typeof timeline[0].laneFights.fight_occurred_rate, 'number');
});

test('UI capture fixtures reject unhandled StatsAPI paths', () => {
  assert.throws(
    () => createStatsFixtureResponse('/v1/stats/positions/TOP/champions/999/timeline'),
    /No UI capture fixture/
  );
});
