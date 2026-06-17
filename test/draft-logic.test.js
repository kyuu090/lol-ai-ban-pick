const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectBans,
  getActiveAction,
  getCoachPanelState,
  getPendingLabel,
  getSummonerName,
  getTimerTimeLeftMs,
  normalizeChampionId,
  normalizeChampionPool,
  normalizeChampionIds,
  positionLabel
} = require('../draft-logic');

test('collectBans merges champ-select bans and ban actions by team without duplicates', () => {
  const allyTeam = [{ cellId: 1 }, { cellId: 2 }];
  const enemyTeam = [{ cellId: 6 }, { cellId: 7 }];
  const champSelect = {
    bans: {
      myTeamBans: [122, '103', 0, -1, 'bad'],
      theirTeamBans: [99]
    },
    actions: [
      [
        { type: 'ban', actorCellId: 1, championId: '122' },
        { type: 'ban', actorCellId: 6, championId: 24 },
        { type: 'pick', actorCellId: 2, championId: 11 },
        { type: 'ban', actorCellId: 999, championId: 55 },
        { type: 'ban', actorCellId: 7, championId: 12.5 },
        { type: 'ban', actorCellId: 7, championId: Infinity },
        { type: 'ban', actorCellId: 7, championId: 0 }
      ]
    ]
  };

  assert.deepEqual(collectBans(champSelect, allyTeam, enemyTeam), {
    allyBans: [122, 103],
    enemyBans: [99, 24]
  });
});

test('getActiveAction prefers in-progress action before pending actions', () => {
  const pending = { id: 1, completed: false };
  const inProgress = { id: 2, isInProgress: true, completed: false };

  assert.equal(getActiveAction({ actions: [[pending], [inProgress]] }), inProgress);
  assert.equal(getActiveAction({ actions: [[pending]] }), pending);
  assert.equal(getActiveAction({ actions: [[{ completed: true }]] }), null);
});

test('getCoachPanelState distinguishes logged out, champ select, and in-game states', () => {
  assert.deepEqual(getCoachPanelState({ lcuStatus: 'disconnected' }), {
    phase: null,
    champSelect: null,
    loggedIn: false,
    inGame: false,
    inChampSelect: false
  });

  assert.deepEqual(getCoachPanelState({
    lcuStatus: 'connected',
    summoner: { gameName: 'Tester' },
    gameflowPhase: 'ChampSelect',
    champSelect: { localPlayerCellId: 1 }
  }), {
    phase: 'ChampSelect',
    champSelect: { localPlayerCellId: 1 },
    loggedIn: true,
    inGame: false,
    inChampSelect: true
  });

  assert.equal(getCoachPanelState({
    lcuStatus: 'connected',
    summoner: { gameName: 'Tester' },
    gameflowPhase: 'InProgress',
    champSelect: { localPlayerCellId: 1 }
  }).inGame, true);
});

test('small normalization helpers handle LCU edge cases', () => {
  assert.equal(normalizeChampionId('1'), 1);
  assert.equal(normalizeChampionId(12.5), null);
  assert.equal(normalizeChampionId(Infinity), null);
  assert.deepEqual(normalizeChampionIds(['1', 2, 0, -5, 'x', Infinity, 12.5]), [1, 2]);
  assert.equal(getTimerTimeLeftMs({ adjustedTimeLeftInPhase: 1500, timeLeftInPhase: 9000 }), 1500);
  assert.equal(getTimerTimeLeftMs({ timeLeftInPhase: 9000 }), 9000);
  assert.equal(getTimerTimeLeftMs({}), null);
  assert.equal(getSummonerName({ gameName: 'RiftName', displayName: 'OldName' }), 'RiftName');
  assert.equal(getSummonerName({ error: 'not logged in' }), '');
  assert.equal(positionLabel('jungle'), 'JG');
  assert.equal(positionLabel('fill'), 'FILL');
  assert.equal(positionLabel(null), '未確定');
  assert.equal(getPendingLabel({}, () => 'Unused'), 'PICKING NEXT');
  assert.equal(getPendingLabel({ championPickIntent: 103 }, (championId) => `Champion ${championId}`), 'Champion 103 を予定');
});

test('normalizeChampionPool keeps one positive champion id list per lane', () => {
  assert.deepEqual(normalizeChampionPool({
    top: [122, '122', 0, 'bad', 103],
    middle: ['99'],
    unknown: [1]
  }), {
    top: [122, 103],
    jungle: [],
    middle: [99],
    bottom: [],
    utility: []
  });

  assert.deepEqual(normalizeChampionPool(null), {
    top: [],
    jungle: [],
    middle: [],
    bottom: [],
    utility: []
  });
});
