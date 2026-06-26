const test = require('node:test');
const assert = require('node:assert/strict');

const { createInGameView } = require('../ui/in-game-view');

function createInGameViewForHelpers() {
  return createInGameView({
    elements: {},
    document: {},
    createInGameContext: () => ({}),
    getLastChampSelectSnapshot: () => null,
    getSummonerName: () => '',
    getMatchHistorySelfVsLaneOpponentStats: () => [],
    championLabel: (id) => `Champion ${id}`,
    championTitle: (id) => `Champion ${id}`,
    positionLabel: (position) => position || '-',
    loadChampionIcon() {},
    loadChampionIconEager() {},
    getChampionRoleDisplayStats: () => null,
    createPickPoolStatChip: () => ({}),
    formatPercent: () => '0%',
    formatAverageKda: () => '0.0/0.0/0.0',
    getFinalCompositionAnalysisStatus: () => 'idle',
    getFinalCompositionAnalysisNotes: () => [],
    getFinalCompositionAnalysisError: () => ''
  });
}

test('in-game view normalizes lane matchup details and filters structural fragments', () => {
  const view = createInGameViewForHelpers();

  assert.deepEqual(view.normalizeLaneMatchupDetail([
    { text: 'Trade around cooldowns' },
    [{ type: 'text', text: 'Watch ' }, { type: 'champion', championName: 'Ahri', championId: 103 }],
    '"goal":',
    [],
    null
  ]), [
    'Trade around cooldowns',
    [{ type: 'text', text: 'Watch ' }, { type: 'champion', championName: 'Ahri', championId: 103 }]
  ]);

  assert.equal(view.hasLaneMatchupRichText('"detail":'), false);
  assert.equal(view.hasLaneMatchupRichText('Push level 2'), true);
});
