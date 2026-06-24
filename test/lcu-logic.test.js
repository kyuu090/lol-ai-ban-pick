const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAuthHeader,
  createLaneMatchupAnalysisRequest,
  createChampionsById,
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
  assert.deepEqual(result.localChampionIds, [222, 412]);
  assert.deepEqual(result.enemyChampionIds, [200, 117]);
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
