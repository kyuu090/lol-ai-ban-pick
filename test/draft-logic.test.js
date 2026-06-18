const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectBans,
  collectUnavailableChampionReasons,
  getBestIntoOpponentStats,
  getActiveAction,
  getDraftPanelState,
  getPendingLabel,
  getPlannedPickChampionId,
  getPlannedPickThreatStats,
  getSummonerName,
  normalizePosition,
  normalizeChampionId,
  normalizeChampionPool,
  normalizeChampionIds,
  positionLabel,
  sortBestWinRateStats,
  sortPickPoolCandidates,
  sortWorstWinRateStats
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

test('getDraftPanelState distinguishes logged out, champ select, and in-game states', () => {
  assert.deepEqual(getDraftPanelState({ lcuStatus: 'disconnected' }), {
    phase: null,
    champSelect: null,
    loggedIn: false,
    inGame: false,
    inChampSelect: false
  });

  assert.deepEqual(getDraftPanelState({
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

  assert.equal(getDraftPanelState({
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

test('collectUnavailableChampionReasons marks bans before picked champions', () => {
  const champSelect = {
    myTeam: [
      { cellId: 1, championId: 103 },
      { cellId: 2, championId: 55 }
    ],
    theirTeam: [
      { cellId: 6, championId: 99 },
      { cellId: 7, championId: 24 }
    ],
    bans: {
      myTeamBans: [55],
      theirTeamBans: [24]
    },
    actions: [
      [
        { type: 'ban', actorCellId: 1, championId: 99 },
        { type: 'ban', actorCellId: 6, championId: 122 }
      ]
    ]
  };

  assert.deepEqual(Array.from(collectUnavailableChampionReasons(champSelect).entries()), [
    [55, 'Banned'],
    [99, 'Banned'],
    [24, 'Banned'],
    [122, 'Banned'],
    [103, 'Picked']
  ]);
});

test('getPlannedPickThreatStats uses selected or intended pick and same-position opponents only', () => {
  const champSelect = {
    myTeam: [{ cellId: 1, championId: 0, championPickIntent: 127, assignedPosition: 'MIDDLE' }],
    theirTeam: [{ cellId: 6, championId: 238 }],
    bans: {
      myTeamBans: [134],
      theirTeamBans: []
    }
  };
  const stats = [
    { championId: 127, opponentChampionId: 134, position: 'MIDDLE', games: 8, winRate: 0.25 },
    { championId: 127, opponentChampionId: 238, position: 'MIDDLE', games: 6, winRate: 0.1 },
    { championId: 127, opponentChampionId: 103, position: 'MIDDLE', games: 2, winRate: 0.1 },
    { championId: 127, opponentChampionId: 55, position: 'TOP', games: 10, winRate: 0 },
    { championId: 103, opponentChampionId: 777, position: 'MIDDLE', games: 10, winRate: 0 }
  ];

  const result = getPlannedPickThreatStats({
    stats,
    champSelect,
    localMember: champSelect.myTeam[0],
    limit: 3
  });

  assert.equal(getPlannedPickChampionId({ championId: 103, championPickIntent: 127 }), 103);
  assert.equal(result.plannedChampionId, 127);
  assert.equal(result.position, 'MIDDLE');
  assert.deepEqual(result.statsList.map((entry) => entry.opponentChampionId), [103]);
});

test('planned and marked opponent stats return empty results when inputs are incomplete', () => {
  assert.equal(normalizePosition('middle'), 'MIDDLE');
  assert.equal(getPlannedPickChampionId({ championId: 0, championPickIntent: 127 }), 127);
  assert.deepEqual(getPlannedPickThreatStats({ localMember: { assignedPosition: 'MIDDLE' } }), {
    plannedChampionId: 0,
    position: 'MIDDLE',
    statsList: []
  });
  assert.deepEqual(getBestIntoOpponentStats({ stats: [], opponentChampionId: 0, position: 'MIDDLE' }), []);
  assert.deepEqual(getBestIntoOpponentStats({ stats: [], opponentChampionId: 103, position: '' }), []);
});

test('getBestIntoOpponentStats filters by opponent and position then ranks best win rate', () => {
  const stats = [
    { championId: 127, opponentChampionId: 103, position: 'MIDDLE', games: 4, winRate: 1 },
    { championId: 99, opponentChampionId: 103, position: 'MIDDLE', games: 6, winRate: 0.5 },
    { championId: 55, opponentChampionId: 103, position: 'TOP', games: 10, winRate: 1 },
    { championId: 112, opponentChampionId: 134, position: 'MIDDLE', games: 10, winRate: 1 }
  ];

  assert.deepEqual(
    getBestIntoOpponentStats({ stats, opponentChampionId: 103, position: 'middle' }).map((entry) => entry.championId),
    [127, 99]
  );
});

test('win-rate stat sorting falls back to games and champion names', () => {
  const stats = [
    { championId: 2, championName: 'Zed', games: 1, winRate: 0.5 },
    { championId: 1, championName: 'Ahri', games: 2, winRate: 0.5 },
    { championId: 3, championName: 'Syndra', games: 2, winRate: 0.5 }
  ];

  assert.deepEqual(sortWorstWinRateStats(stats).map((entry) => entry.championName), ['Ahri', 'Syndra', 'Zed']);
  assert.deepEqual(sortBestWinRateStats(stats).map((entry) => entry.championName), ['Ahri', 'Syndra', 'Zed']);
});

test('sortPickPoolCandidates keeps available reliable played champions first', () => {
  const candidates = [
    { championId: 1, available: true, stats: null },
    { championId: 2, available: false, stats: { games: 20, winRate: 1 } },
    { championId: 3, available: true, stats: { games: 2, winRate: 1 } },
    { championId: 4, available: true, stats: { games: 8, winRate: 0.5 } },
    { championId: 5, available: true, stats: { games: 8, winRate: 0.75 } }
  ];

  assert.deepEqual(
    sortPickPoolCandidates(candidates, 5).map((candidate) => candidate.championId),
    [5, 4, 3, 1, 2]
  );

  assert.deepEqual(
    sortPickPoolCandidates([
      { championId: 9, available: true, stats: { games: 8, winRate: 0.5 } },
      { championId: 7, available: true, stats: { games: 8, winRate: 0.5 } }
    ], 5).map((candidate) => candidate.championId),
    [7, 9]
  );

  assert.deepEqual(sortPickPoolCandidates(null), []);
});
