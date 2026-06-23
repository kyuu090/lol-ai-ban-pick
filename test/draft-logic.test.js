const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectBans,
  collectUnavailableChampionReasons,
  createFinalCompositionDraftContext,
  createInGameContext,
  createPickPhaseDraftContext,
  getBestIntoOpponentStats,
  getActiveAction,
  getDraftPanelState,
  getLocalChampSelectMember,
  getMemberChampionId,
  getPendingLabel,
  getPlannedPickChampionId,
  getPlannedPickThreatStats,
  getSummonerName,
  isChampSelectFinalization,
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

test('getActiveAction prefers local in-progress action during simultaneous draft turns', () => {
  const firstPick = { id: 1, actorCellId: 1, type: 'pick', isInProgress: true, completed: false };
  const secondPick = { id: 2, actorCellId: 2, type: 'pick', isInProgress: true, completed: false };
  const localBan = { id: 3, actorCellId: 4, type: 'ban', isInProgress: true, completed: false };

  assert.equal(getActiveAction({ actions: [[firstPick, secondPick]] }, 2), secondPick);
  assert.equal(getActiveAction({ actions: [[firstPick], [localBan]] }, 4), localBan);
  assert.equal(getActiveAction({ actions: [[firstPick, secondPick]] }, 9), firstPick);
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
  assert.equal(getMemberChampionId({ championId: 0, championPickIntent: 99 }), 99);
  assert.equal(getMemberChampionId({ championId: 103, championPickIntent: 99 }), 103);
  assert.deepEqual(getPlannedPickThreatStats({ localMember: { assignedPosition: 'MIDDLE' } }), {
    plannedChampionId: 0,
    position: 'MIDDLE',
    statsList: []
  });
  assert.deepEqual(getBestIntoOpponentStats({ stats: [], opponentChampionId: 0, position: 'MIDDLE' }), []);
  assert.deepEqual(getBestIntoOpponentStats({ stats: [], opponentChampionId: 103, position: '' }), []);
});

test('createInGameContext extracts local pick, same-position opponent, and draft snapshot', () => {
  const champSelect = {
    localPlayerCellId: 2,
    myTeam: [
      { cellId: 1, championId: 122, assignedPosition: 'TOP' },
      { cellId: 2, championId: 0, championPickIntent: 103, assignedPosition: 'MIDDLE' }
    ],
    theirTeam: [
      { cellId: 6, championId: 24, assignedPosition: 'TOP' },
      { cellId: 7, championId: 134, assignedPosition: 'MIDDLE' }
    ]
  };
  const matchup = { championId: 103, opponentChampionId: 134, position: 'MIDDLE', games: 6, winRate: 0.5 };

  assert.equal(getLocalChampSelectMember(champSelect), champSelect.myTeam[1]);
  assert.deepEqual(createInGameContext({
    champSelect,
    summonerName: 'Tester',
    matchupStats: [matchup]
  }), {
    championId: 103,
    position: 'MIDDLE',
    summonerName: 'Tester',
    opponentChampionId: 134,
    directMatchupStats: matchup,
    allyChampionIds: [122, 103],
    enemyChampionIds: [24, 134]
  });
});

test('createInGameContext handles missing champ-select snapshot', () => {
  assert.deepEqual(createInGameContext(), {
    championId: 0,
    position: '',
    summonerName: '',
    opponentChampionId: 0,
    directMatchupStats: null,
    allyChampionIds: [],
    enemyChampionIds: []
  });
});

test('createInGameContext ignores off-position opponents and caps team snapshots', () => {
  const champSelect = {
    localPlayerCellId: 1,
    myTeam: [
      { cellId: 1, championId: 103, assignedPosition: 'MIDDLE' },
      { cellId: 2, championId: 122, assignedPosition: 'TOP' },
      { cellId: 3, championId: 64, assignedPosition: 'JUNGLE' },
      { cellId: 4, championId: 202, assignedPosition: 'BOTTOM' },
      { cellId: 5, championId: 412, assignedPosition: 'UTILITY' },
      { cellId: 99, championId: 99, assignedPosition: 'MIDDLE' }
    ],
    theirTeam: [
      { cellId: 6, championId: 24, assignedPosition: 'TOP' },
      { cellId: 7, championId: 121, assignedPosition: 'JUNGLE' },
      { cellId: 8, championId: 145, assignedPosition: 'BOTTOM' },
      { cellId: 9, championId: 111, assignedPosition: 'UTILITY' },
      { cellId: 10, championId: 0, championPickIntent: 134, assignedPosition: 'MIDDLE' },
      { cellId: 100, championId: 55, assignedPosition: 'MIDDLE' }
    ]
  };
  const middleMatchup = { championId: 103, opponentChampionId: 134, position: 'MIDDLE', games: 3, winRate: 0.33 };
  const wrongPositionMatchup = { championId: 103, opponentChampionId: 24, position: 'TOP', games: 9, winRate: 1 };

  assert.deepEqual(createInGameContext({
    champSelect,
    matchupStats: [wrongPositionMatchup, middleMatchup]
  }), {
    championId: 103,
    position: 'MIDDLE',
    summonerName: '',
    opponentChampionId: 134,
    directMatchupStats: middleMatchup,
    allyChampionIds: [103, 122, 64, 202, 412],
    enemyChampionIds: [24, 121, 145, 111, 134]
  });
});

test('createPickPhaseDraftContext omits role fields from BFF analysis payload', () => {
  const champSelect = {
    localPlayerCellId: 2,
    myTeam: [
      { cellId: 1, championId: 122, assignedPosition: 'TOP' },
      { cellId: 2, championId: 0, championPickIntent: 103, assignedPosition: 'MIDDLE' },
      { cellId: 3, championId: 0, championPickIntent: 64, assignedPosition: 'JUNGLE' },
      { cellId: 4, championId: 202, assignedPosition: 'BOTTOM' },
      { cellId: 5, championId: 412, assignedPosition: 'UTILITY' }
    ],
    theirTeam: [
      { cellId: 6, championId: 134, assignedPosition: 'MIDDLE' },
      { cellId: 7, championId: 121, assignedPosition: 'JUNGLE' }
    ]
  };
  const championNames = {
    13: 'Ryze',
    64: 'Lee Sin',
    103: 'Ahri',
    112: 'Viktor',
    121: "Kha'Zix",
    122: 'Darius',
    134: 'Syndra',
    202: 'Jhin',
    412: 'Thresh'
  };

  const context = createPickPhaseDraftContext({
    champSelect,
    localMember: champSelect.myTeam[1],
    championPool: {
      middle: [103, 112, 13]
    },
    championLabel: (championId) => championNames[championId] || `Champion ${championId}`
  });

  assert.deepEqual(context, {
    phase: 'own_pick',
    localPlayer: {
      intendedPick: {
        championId: 103,
        championName: 'Ahri'
      }
    },
    allyTeam: {
      intendedPicks: [
        {
          championId: 64,
          championName: 'Lee Sin'
        }
      ],
      lockedPicks: [
        {
          championId: 122,
          championName: 'Darius'
        },
        {
          championId: 202,
          championName: 'Jhin'
        },
        {
          championId: 412,
          championName: 'Thresh'
        }
      ]
    },
    enemyTeam: {
      lockedPicks: [
        {
          championId: 134,
          championName: 'Syndra'
        },
        {
          championId: 121,
          championName: "Kha'Zix"
        }
      ]
    },
    ownChampionPool: [
      {
        championId: 103,
        championName: 'Ahri'
      },
      {
        championId: 112,
        championName: 'Viktor'
      },
      {
        championId: 13,
        championName: 'Ryze'
      }
    ]
  });
  assert.equal(JSON.stringify(context).includes('"role"'), false);
});

test('createPickPhaseDraftContext includes unlocked ally pick intents only in intendedPicks', () => {
  const champSelect = {
    myTeam: [
      { cellId: 1, championId: 0, championPickIntent: 103, assignedPosition: 'MIDDLE' },
      { cellId: 2, championId: 0, championPickIntent: 64, assignedPosition: 'JUNGLE' },
      { cellId: 3, championId: 202, championPickIntent: 222, assignedPosition: 'BOTTOM' },
      { cellId: 4, championId: 0, championPickIntent: 0, assignedPosition: 'UTILITY' }
    ],
    theirTeam: []
  };

  const context = createPickPhaseDraftContext({
    champSelect,
    localMember: champSelect.myTeam[0],
    championPool: { middle: [103] },
    championLabel: (championId) => `Champion ${championId}`
  });

  assert.deepEqual(context.allyTeam.intendedPicks, [
    {
      championId: 64,
      championName: 'Champion 64'
    }
  ]);
  assert.deepEqual(context.allyTeam.lockedPicks, [
    {
      championId: 202,
      championName: 'Champion 202'
    }
  ]);
});

test('isChampSelectFinalization detects LCU finalization timer phase', () => {
  assert.equal(isChampSelectFinalization({
    timer: { phase: 'FINALIZATION' },
    myTeam: [],
    theirTeam: []
  }, 'ChampSelect'), true);
});

test('isChampSelectFinalization detects all picks locked when pick actions are completed', () => {
  const champSelect = {
    timer: { phase: 'BAN_PICK' },
    myTeam: [
      { cellId: 1, championId: 122 },
      { cellId: 2, championId: 64 },
      { cellId: 3, championId: 103 },
      { cellId: 4, championId: 202 },
      { cellId: 5, championId: 412 }
    ],
    theirTeam: [
      { cellId: 6, championId: 24 },
      { cellId: 7, championId: 121 },
      { cellId: 8, championId: 134 },
      { cellId: 9, championId: 145 },
      { cellId: 10, championId: 111 }
    ],
    actions: [
      [
        { type: 'pick', actorCellId: 1, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 2, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 3, completed: true, isInProgress: false }
      ],
      [
        { type: 'pick', actorCellId: 4, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 5, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 6, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 7, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 8, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 9, completed: true, isInProgress: false },
        { type: 'pick', actorCellId: 10, completed: true, isInProgress: false }
      ]
    ]
  };

  assert.equal(isChampSelectFinalization(champSelect, 'ChampSelect'), true);
});

test('isChampSelectFinalization rejects unfinished picks outside finalization timer phase', () => {
  const champSelect = {
    timer: { phase: 'BAN_PICK' },
    myTeam: [
      { cellId: 1, championId: 122 },
      { cellId: 2, championId: 64 },
      { cellId: 3, championId: 0 },
      { cellId: 4, championId: 202 },
      { cellId: 5, championId: 412 }
    ],
    theirTeam: [
      { cellId: 6, championId: 24 },
      { cellId: 7, championId: 121 },
      { cellId: 8, championId: 134 },
      { cellId: 9, championId: 145 },
      { cellId: 10, championId: 111 }
    ],
    actions: [
      [
        { type: 'pick', actorCellId: 3, completed: false, isInProgress: true }
      ]
    ]
  };

  assert.equal(isChampSelectFinalization(champSelect, 'ChampSelect'), false);
});

test('createFinalCompositionDraftContext separates local locked pick from ally locked picks', () => {
  const champSelect = {
    localPlayerCellId: 3,
    myTeam: [
      { cellId: 1, championId: 122 },
      { cellId: 2, championId: 64 },
      { cellId: 3, championId: 103 },
      { cellId: 4, championId: 202 },
      { cellId: 5, championId: 412 }
    ],
    theirTeam: [
      { cellId: 6, championId: 24 },
      { cellId: 7, championId: 121 },
      { cellId: 8, championId: 134 },
      { cellId: 9, championId: 145 },
      { cellId: 10, championId: 111 }
    ]
  };
  const championNames = {
    24: 'Jax',
    64: 'Lee Sin',
    103: 'Ahri',
    111: 'Nautilus',
    121: "Kha'Zix",
    122: 'Darius',
    134: 'Syndra',
    145: "Kai'Sa",
    202: 'Jhin',
    412: 'Thresh'
  };

  assert.deepEqual(createFinalCompositionDraftContext({
    champSelect,
    localMember: champSelect.myTeam[2],
    championLabel: (championId) => championNames[championId] || `Champion ${championId}`
  }), {
    phase: 'final_composition',
    localPlayer: {
      lockedPick: {
        championId: 103,
        championName: 'Ahri'
      }
    },
    allyTeam: {
      lockedPicks: [
        { championId: 122, championName: 'Darius' },
        { championId: 64, championName: 'Lee Sin' },
        { championId: 202, championName: 'Jhin' },
        { championId: 412, championName: 'Thresh' }
      ]
    },
    enemyTeam: {
      lockedPicks: [
        { championId: 24, championName: 'Jax' },
        { championId: 121, championName: "Kha'Zix" },
        { championId: 134, championName: 'Syndra' },
        { championId: 145, championName: "Kai'Sa" },
        { championId: 111, championName: 'Nautilus' }
      ]
    }
  });
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
