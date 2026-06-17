const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateChampionStats,
  calculateKda,
  getQueueClassification,
  normalizeRiotMatch,
  normalizeRiotMatches
} = require('../riot-match-history');

function createMatch(overrides = {}) {
  const self = {
    puuid: 'self-puuid',
    championId: 103,
    championName: 'Ahri',
    teamId: 100,
    teamPosition: 'MIDDLE',
    lane: 'MIDDLE',
    win: true,
    kills: 8,
    deaths: 2,
    assists: 9
  };
  const participants = [
    self,
    { puuid: 'ally-1', championId: 122, championName: 'Darius', teamId: 100, teamPosition: 'TOP' },
    { puuid: 'ally-2', championId: 64, championName: 'Lee Sin', teamId: 100, teamPosition: 'JUNGLE' },
    { puuid: 'ally-3', championId: 202, championName: 'Jhin', teamId: 100, teamPosition: 'BOTTOM' },
    { puuid: 'ally-4', championId: 412, championName: 'Thresh', teamId: 100, teamPosition: 'UTILITY' },
    { puuid: 'enemy-1', championId: 24, championName: 'Jax', teamId: 200, teamPosition: 'TOP' },
    { puuid: 'enemy-2', championId: 121, championName: "Kha'Zix", teamId: 200, teamPosition: 'JUNGLE' },
    { puuid: 'enemy-3', championId: 134, championName: 'Syndra', teamId: 200, teamPosition: 'MIDDLE' },
    { puuid: 'enemy-4', championId: 145, championName: "Kai'Sa", teamId: 200, teamPosition: 'BOTTOM' },
    { puuid: 'enemy-5', championId: 111, championName: 'Nautilus', teamId: 200, teamPosition: 'UTILITY' }
  ];

  return {
    metadata: { matchId: overrides.matchId || 'JP1_1' },
    info: {
      gameCreation: overrides.gameCreation || 1000,
      mapId: overrides.mapId ?? 11,
      queueId: overrides.queueId ?? 420,
      gameMode: overrides.gameMode || 'CLASSIC',
      gameDuration: 1800,
      gameVersion: '16.12.1',
      participants: overrides.participants || participants
    }
  };
}

test('getQueueClassification maps supported ranked and normal queues', () => {
  assert.deepEqual(getQueueClassification(420), { queueType: 'ranked', queueGroup: 'ranked_solo' });
  assert.deepEqual(getQueueClassification(490), { queueType: 'normal', queueGroup: 'normal_quickplay' });
  assert.equal(getQueueClassification(450), null);
});

test('normalizeRiotMatch keeps supported SR 5v5 data and identifies teams', () => {
  const record = normalizeRiotMatch(createMatch(), 'self-puuid');

  assert.equal(record.matchId, 'JP1_1');
  assert.equal(record.queueType, 'ranked');
  assert.equal(record.queueGroup, 'ranked_solo');
  assert.equal(record.self.championName, 'Ahri');
  assert.equal(record.self.kda, 8.5);
  assert.equal(record.allies.length, 5);
  assert.equal(record.enemies.length, 5);
});

test('normalizeRiotMatches filters unsupported queues and sorts recent first', () => {
  const matchesById = {
    old: createMatch({ matchId: 'old', gameCreation: 1000 }),
    aram: createMatch({ matchId: 'aram', queueId: 450, gameCreation: 3000 }),
    new: createMatch({ matchId: 'new', gameCreation: 2000 })
  };

  assert.deepEqual(normalizeRiotMatches(matchesById, 'self-puuid').map((record) => record.matchId), ['new', 'old']);
});

test('aggregateChampionStats builds queue-specific and all SR 5v5 groups', () => {
  const records = normalizeRiotMatches({
    ranked: createMatch({ matchId: 'ranked', queueId: 420, gameCreation: 3000 }),
    normal: createMatch({ matchId: 'normal', queueId: 400, gameCreation: 2000 })
  }, 'self-puuid');
  records[1].self.win = false;

  const stats = aggregateChampionStats(records);
  const all = stats.find((entry) => entry.queueGroup === 'all_sr_5v5');

  assert.equal(all.games, 2);
  assert.equal(all.wins, 1);
  assert.equal(all.winRate, 0.5);
  assert.equal(stats.some((entry) => entry.queueGroup === 'ranked_solo'), true);
  assert.equal(stats.some((entry) => entry.queueGroup === 'normal_draft'), true);
});

test('aggregateChampionStats builds position-specific groups without replacing all-position groups', () => {
  const records = normalizeRiotMatches({
    middle: createMatch({ matchId: 'middle', gameCreation: 3000 }),
    jungle: createMatch({
      matchId: 'jungle',
      gameCreation: 2000,
      participants: createMatch().info.participants.map((participant) => (
        participant.puuid === 'self-puuid'
          ? { ...participant, teamPosition: 'JUNGLE', win: false, kills: 2, deaths: 5, assists: 6 }
          : participant
      ))
    })
  }, 'self-puuid');

  const stats = aggregateChampionStats(records);
  const allPositions = stats.find((entry) => entry.queueGroup === 'all_sr_5v5' && entry.position === null);
  const jungle = stats.find((entry) => entry.queueGroup === 'all_sr_5v5' && entry.position === 'JUNGLE');

  assert.equal(allPositions.games, 2);
  assert.equal(jungle.games, 1);
  assert.equal(jungle.wins, 0);
  assert.equal(jungle.avgKills, 2);
});

test('calculateKda handles deathless games', () => {
  assert.equal(calculateKda(5, 0, 7), 12);
});
