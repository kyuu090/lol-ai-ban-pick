const test = require('node:test');
const assert = require('node:assert/strict');

const { createChampionPoolView } = require('../ui/champion-pool-view');

function createView(overrides = {}) {
  return createChampionPoolView({
    elements: {},
    lanes: [
      { id: 'top', label: 'Top' },
      { id: 'middle', label: 'Mid' }
    ],
    laneToPosition: {
      top: 'TOP',
      middle: 'MIDDLE'
    },
    normalizeChampionPool: (pool) => pool || {},
    loadChampionIcon() {},
    championLabel: (id) => `Champion ${id}`,
    championTitle: (id) => `Champion ${id}`,
    getChampionRoleDisplayStats: () => null,
    createChampionStatsElement: () => ({}),
    getActiveLaneId: () => 'middle',
    setActiveLaneId() {},
    getChampionsById: () => ({}),
    getChampionPool: () => ({}),
    setChampionPool() {},
    toggleChampionInPool() {},
    removeChampionFromPool() {},
    ...overrides
  });
}

test('champion pool view exposes active lane and position helpers', () => {
  const view = createView();

  assert.deepEqual(view.getActiveChampionPoolLane(), { id: 'middle', label: 'Mid' });
  assert.equal(view.getChampionPoolLanePosition('top'), 'TOP');
  assert.equal(view.getChampionPoolLanePosition('unknown'), null);
  assert.deepEqual(view.getChampionPoolLaneByPosition('middle'), { id: 'middle', label: 'Mid' });
  assert.equal(view.getChampionPoolLaneByPosition('unknown'), null);
});
