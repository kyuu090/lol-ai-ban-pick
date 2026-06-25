const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAuthHeader,
  createLaneMatchupAnalysisRequest,
  createChampionsById,
  describeLaneMatchupAnalysisReadiness,
  normalizeGameflowSelectedPosition,
  parseLockfile
} = require('../lcu-logic');

test('parseLockfile extracts LCU connection fields', () => {
  assert.deepEqual(parseLockfile('LeagueClientUx:1234:50999:test-password:https'), {
    processName: 'LeagueClientUx',
    pid: '1234',
    port: '50999',
    password: 'test-password',
    protocol: 'https'
  });
});

test('parseLockfile rejects malformed lockfile content', () => {
  assert.throws(() => parseLockfile('LeagueClientUx:1234'), /lockfileの形式/);
});

test('createAuthHeader builds Riot basic auth header', () => {
  assert.equal(createAuthHeader('pw'), 'Basic cmlvdDpwdw==');
});

test('createChampionsById normalizes valid champion summary entries', () => {
  assert.deepEqual(createChampionsById([
    {
      id: '122',
      name: 'Darius',
      alias: 'Darius',
      title: 'the Hand of Noxus',
      squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/122.png'
    },
    { id: 0, name: 'None' },
    { id: -1, name: 'Invalid' },
    { id: 12.5, name: 'Invalid' },
    { id: Infinity, name: 'Invalid' },
    { id: 'not-a-number', name: 'Invalid' }
  ]), {
    122: {
      id: 122,
      name: 'Darius',
      alias: 'Darius',
      title: 'the Hand of Noxus',
      squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/122.png'
    }
  });
});

test('normalizeGameflowSelectedPosition keeps gameflow lane names predictable', () => {
  assert.equal(normalizeGameflowSelectedPosition('middle'), 'MIDDLE');
  assert.equal(normalizeGameflowSelectedPosition('support'), 'UTILITY');
  assert.equal(normalizeGameflowSelectedPosition(''), '');
});

test('createLaneMatchupAnalysisRequest creates a solo-lane BFF payload from gameflow session', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'self-puuid',
    championsById: createChampionsById([
      { id: 268, name: 'アジール' },
      { id: 238, name: 'ゼド' }
    ]),
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        gameId: 589378305,
        teamOne: [
          { championId: 238, selectedPosition: 'MIDDLE' }
        ],
        teamTwo: [
          { championId: 268, selectedPosition: 'MIDDLE', puuid: 'self-puuid' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'アジール',
    myChampionId: 268,
    lane: 'MID',
    enemyChampionName: 'ゼド',
    enemyChampionId: 238
  });
  assert.equal(result.gameId, 589378305);
  assert.equal(result.laneMatchupLane, 'MID');
  assert.deepEqual(result.localChampionIds, [268]);
  assert.deepEqual(result.enemyChampionIds, [238]);
  assert.match(result.requestKey, /589378305/);
});

test('createLaneMatchupAnalysisRequest sends BOT and SUPPORT as a 2v2 request', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'support-puuid',
    championsById: createChampionsById([
      { id: 222, name: 'ジンクス' },
      { id: 412, name: 'スレッシュ' },
      { id: 200, name: 'アフェリオス' },
      { id: 117, name: 'ルル' }
    ]),
    gameflowSession: {
      phase: 'InProgress',
      gameData: {
        gameId: 101,
        teamOne: [
          { championId: 222, selectedPosition: 'BOTTOM' },
          { championId: 412, selectedPosition: 'UTILITY', puuid: 'support-puuid' }
        ],
        teamTwo: [
          { championId: 200, selectedPosition: 'BOTTOM' },
          { championId: 117, selectedPosition: 'UTILITY' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'ジンクス/スレッシュ',
    myChampionId: '222/412',
    lane: 'BOTTOM/SUPPORT',
    enemyChampionName: 'アフェリオス/ルル',
    enemyChampionId: '200/117'
  });
  assert.equal(result.laneMatchupLane, 'BOTTOM/SUPPORT');
  assert.deepEqual(result.localChampionIds, [222, 412]);
  assert.deepEqual(result.enemyChampionIds, [200, 117]);
});

test('createLaneMatchupAnalysisRequest fills a missing ally from champ-select before champion selections', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'bottom-puuid',
    championsById: createChampionsById([
      { id: 147, name: 'Seraphine' },
      { id: 235, name: 'Senna' },
      { id: 412, name: 'Thresh' },
      { id: 804, name: 'Yunara' },
      { id: 888, name: 'Renata Glasc' }
    ]),
    champSelectSession: {
      myTeam: [
        { championId: 777, assignedPosition: 'TOP' },
        { championId: 142, assignedPosition: 'MIDDLE' },
        { championId: 235, assignedPosition: 'BOTTOM', puuid: 'bottom-puuid' },
        { championId: 234, assignedPosition: 'JUNGLE' },
        { championId: 147, championPickIntent: 412, assignedPosition: 'UTILITY' }
      ]
    },
    gameflowSession: {
      phase: 'InProgress',
      gameData: {
        gameId: 104,
        playerChampionSelections: [
          { championId: 777 },
          { championId: 142 },
          { championId: 235, puuid: 'bottom-puuid' },
          { championId: 234 },
          { championId: 412 },
          { championId: 804 },
          { championId: 888 },
          { championId: 950 },
          { championId: 112 },
          { championId: 904 }
        ],
        teamOne: [
          { championId: 777, selectedPosition: 'TOP' },
          { championId: 142, selectedPosition: 'MIDDLE' },
          { championId: 235, selectedPosition: 'BOTTOM', puuid: 'bottom-puuid' },
          { championId: 234, selectedPosition: 'JUNGLE' }
        ],
        teamTwo: [
          { championId: 804, selectedPosition: 'BOTTOM' },
          { championId: 888, selectedPosition: 'UTILITY' },
          { championId: 950, selectedPosition: 'JUNGLE' },
          { championId: 112, selectedPosition: 'MIDDLE' },
          { championId: 904, selectedPosition: 'TOP' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'Senna/Seraphine',
    myChampionId: '235/147',
    lane: 'BOTTOM/SUPPORT',
    enemyChampionName: 'Yunara/Renata Glasc',
    enemyChampionId: '804/888'
  });
  assert.deepEqual(result.localChampionIds, [235, 147]);
});

test('createLaneMatchupAnalysisRequest can fall back to champ-select when the local player is missing from gameflow teams', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'bottom-puuid',
    championsById: createChampionsById([
      { id: 147, name: 'Seraphine' },
      { id: 235, name: 'Senna' },
      { id: 804, name: 'Yunara' },
      { id: 888, name: 'Renata Glasc' }
    ]),
    champSelectSession: {
      localPlayerCellId: 2,
      myTeam: [
        { cellId: 0, championId: 777, assignedPosition: 'TOP' },
        { cellId: 1, championId: 142, assignedPosition: 'MIDDLE' },
        { cellId: 2, championId: 235, assignedPosition: 'BOTTOM' },
        { cellId: 3, championId: 234, assignedPosition: 'JUNGLE' },
        { cellId: 4, championId: 147, assignedPosition: 'UTILITY' }
      ]
    },
    gameflowSession: {
      phase: 'InProgress',
      gameData: {
        gameId: 105,
        teamOne: [
          { championId: 777, selectedPosition: 'TOP' },
          { championId: 142, selectedPosition: 'MIDDLE' },
          { championId: 234, selectedPosition: 'JUNGLE' },
          { championId: 147, selectedPosition: 'UTILITY' }
        ],
        teamTwo: [
          { championId: 804, selectedPosition: 'BOTTOM' },
          { championId: 888, selectedPosition: 'UTILITY' },
          { championId: 950, selectedPosition: 'JUNGLE' },
          { championId: 112, selectedPosition: 'MIDDLE' },
          { championId: 904, selectedPosition: 'TOP' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'Senna/Seraphine',
    myChampionId: '235/147',
    lane: 'BOTTOM/SUPPORT',
    enemyChampionName: 'Yunara/Renata Glasc',
    enemyChampionId: '804/888'
  });
  assert.deepEqual(result.localChampionIds, [235, 147]);
});

test('createLaneMatchupAnalysisRequest can fall back to champ-select local player by puuid', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'top-puuid',
    championsById: createChampionsById([
      { id: 777, name: 'Yone' },
      { id: 904, name: 'KSmante' }
    ]),
    champSelectSession: {
      myTeam: [
        { championId: 777, assignedPosition: 'TOP', puuid: 'top-puuid' },
        { championId: 142, assignedPosition: 'MIDDLE' }
      ]
    },
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        gameId: 106,
        teamOne: [
          { championId: 142, selectedPosition: 'MIDDLE' },
          { championId: 234, selectedPosition: 'JUNGLE' }
        ],
        teamTwo: [
          { championId: 904, selectedPosition: 'TOP' },
          { championId: 112, selectedPosition: 'MIDDLE' },
          { championId: 950, selectedPosition: 'JUNGLE' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'Yone',
    myChampionId: 777,
    lane: 'TOP',
    enemyChampionName: 'KSmante',
    enemyChampionId: 904
  });
  assert.equal(result.laneMatchupLane, 'TOP');
});

test('createLaneMatchupAnalysisRequest does not use champ-select fallback when ally team inference is ambiguous', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'self-puuid',
    champSelectSession: {
      localPlayerCellId: 1,
      myTeam: [
        { cellId: 0, championId: 777, assignedPosition: 'TOP' },
        { cellId: 1, championId: 142, assignedPosition: 'MIDDLE' }
      ]
    },
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        teamOne: [
          { championId: 777, selectedPosition: 'TOP' }
        ],
        teamTwo: [
          { championId: 142, selectedPosition: 'MIDDLE' }
        ]
      }
    }
  });

  assert.equal(result, null);
});

test('createLaneMatchupAnalysisRequest does not fill missing enemies from champ-select', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'middle-puuid',
    champSelectSession: {
      myTeam: [
        { championId: 142, assignedPosition: 'MIDDLE', puuid: 'middle-puuid' }
      ],
      theirTeam: [
        { championId: 112, assignedPosition: 'MIDDLE' }
      ]
    },
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        teamOne: [
          { championId: 142, selectedPosition: 'MIDDLE', puuid: 'middle-puuid' }
        ],
        teamTwo: [
          { championId: 904, selectedPosition: 'TOP' }
        ]
      }
    }
  });

  assert.equal(result, null);
});

test('createLaneMatchupAnalysisRequest infers one missing BOT lane partner from champion selections', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'bottom-puuid',
    championsById: createChampionsById([
      { id: 235, name: 'Senna' },
      { id: 412, name: 'Thresh' },
      { id: 804, name: 'Yunara' },
      { id: 888, name: 'Renata Glasc' }
    ]),
    gameflowSession: {
      phase: 'InProgress',
      gameData: {
        gameId: 103,
        playerChampionSelections: [
          { championId: 777 },
          { championId: 142 },
          { championId: 235, puuid: 'bottom-puuid' },
          { championId: 234 },
          { championId: 412 },
          { championId: 804 },
          { championId: 888 },
          { championId: 950 },
          { championId: 112 },
          { championId: 904 }
        ],
        teamOne: [
          { championId: 777, selectedPosition: 'TOP' },
          { championId: 142, selectedPosition: 'MIDDLE' },
          { championId: 235, selectedPosition: 'BOTTOM', puuid: 'bottom-puuid' },
          { championId: 234, selectedPosition: 'JUNGLE' }
        ],
        teamTwo: [
          { championId: 804, selectedPosition: 'BOTTOM' },
          { championId: 888, selectedPosition: 'UTILITY' },
          { championId: 950, selectedPosition: 'JUNGLE' },
          { championId: 112, selectedPosition: 'MIDDLE' },
          { championId: 904, selectedPosition: 'TOP' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'Senna/Thresh',
    myChampionId: '235/412',
    lane: 'BOTTOM/SUPPORT',
    enemyChampionName: 'Yunara/Renata Glasc',
    enemyChampionId: '804/888'
  });
  assert.equal(result.laneMatchupLane, 'BOTTOM/SUPPORT');
  assert.deepEqual(result.localChampionIds, [235, 412]);
  assert.deepEqual(result.enemyChampionIds, [804, 888]);
});

test('createLaneMatchupAnalysisRequest can proceed with multiple unrelated missing players', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'middle-puuid',
    championsById: createChampionsById([
      { id: 142, name: 'Zoe' },
      { id: 112, name: 'Viktor' }
    ]),
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        playerChampionSelections: [
          { championId: 777 },
          { championId: 142, puuid: 'middle-puuid' },
          { championId: 234 },
          { championId: 147 },
          { championId: 904 },
          { championId: 112 },
          { championId: 950 },
          { championId: 804 },
          { championId: 888 },
          { championId: 999 }
        ],
        teamOne: [
          { championId: 142, selectedPosition: 'MIDDLE', puuid: 'middle-puuid' },
          { championId: 234, selectedPosition: 'JUNGLE' }
        ],
        teamTwo: [
          { championId: 112, selectedPosition: 'MIDDLE' },
          { championId: 950, selectedPosition: 'JUNGLE' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'Zoe',
    myChampionId: 142,
    lane: 'MID',
    enemyChampionName: 'Viktor',
    enemyChampionId: 112
  });
  assert.equal(result.laneMatchupLane, 'MID');
});

test('createLaneMatchupAnalysisRequest waits when multiple missing players include required BOT participants', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'bottom-puuid',
    gameflowSession: {
      phase: 'InProgress',
      gameData: {
        playerChampionSelections: [
          { championId: 235, puuid: 'bottom-puuid' },
          { championId: 147 },
          { championId: 804 },
          { championId: 888 },
          { championId: 112 },
          { championId: 904 }
        ],
        teamOne: [
          { championId: 235, selectedPosition: 'BOTTOM', puuid: 'bottom-puuid' }
        ],
        teamTwo: [
          { championId: 804, selectedPosition: 'BOTTOM' },
          { championId: 112, selectedPosition: 'MIDDLE' }
        ]
      }
    }
  });

  assert.equal(result, null);
});

test('createLaneMatchupAnalysisRequest can identify the local team from playerChampionSelections', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'self-puuid',
    championsById: createChampionsById([
      { id: 64, name: 'リーシン' },
      { id: 121, name: "カ＝ジックス" }
    ]),
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        gameId: 102,
        playerChampionSelections: [
          { championId: 64, puuid: 'self-puuid' }
        ],
        teamOne: [
          { championId: 64, selectedPosition: 'JUNGLE' }
        ],
        teamTwo: [
          { championId: 121, selectedPosition: 'JUNGLE' }
        ]
      }
    }
  });

  assert.deepEqual(result.payload, {
    myChampionName: 'リーシン',
    myChampionId: 64,
    lane: 'JG',
    enemyChampionName: "カ＝ジックス",
    enemyChampionId: 121
  });
  assert.equal(result.laneMatchupLane, 'JG');
});

test('createLaneMatchupAnalysisRequest waits until the matching opponent is known', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'self-puuid',
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        teamOne: [
          { championId: 64, selectedPosition: 'JUNGLE', puuid: 'self-puuid' }
        ],
        teamTwo: [
          { championId: 238, selectedPosition: 'MIDDLE' }
        ]
      }
    }
  });

  assert.equal(result, null);
});

test('createLaneMatchupAnalysisRequest ignores unsupported gameflow phases', () => {
  const result = createLaneMatchupAnalysisRequest({
    localPuuid: 'self-puuid',
    gameflowSession: {
      phase: 'ChampSelect',
      gameData: {
        teamOne: [
          { championId: 64, selectedPosition: 'JUNGLE', puuid: 'self-puuid' }
        ],
        teamTwo: [
          { championId: 121, selectedPosition: 'JUNGLE' }
        ]
      }
    }
  });

  assert.equal(result, null);
});

test('describeLaneMatchupAnalysisReadiness reports champ-select inferred participants', () => {
  const readiness = describeLaneMatchupAnalysisReadiness({
    localPuuid: 'bottom-puuid',
    champSelectSession: {
      myTeam: [
        { championId: 235, assignedPosition: 'BOTTOM', puuid: 'bottom-puuid' },
        { championId: 147, assignedPosition: 'UTILITY' }
      ]
    },
    gameflowSession: {
      phase: 'GameStart',
      gameData: {
        teamOne: [
          { championId: 235, selectedPosition: 'BOTTOM', puuid: 'bottom-puuid' }
        ],
        teamTwo: [
          { championId: 804, selectedPosition: 'BOTTOM' },
          { championId: 888, selectedPosition: 'UTILITY' },
          { championId: 950, selectedPosition: 'JUNGLE' },
          { championId: 112, selectedPosition: 'MIDDLE' },
          { championId: 904, selectedPosition: 'TOP' }
        ]
      }
    }
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.reason, 'ready');
  assert.equal(readiness.teamOneCount, 2);
  assert.equal(readiness.teamOnePositions.some((participant) => (
    participant.championId === 147 &&
    participant.selectedPosition === 'UTILITY' &&
    participant.inferredFromChampSelect
  )), true);
});
