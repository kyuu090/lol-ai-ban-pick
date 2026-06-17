const ALLOWED_SR_5V5_QUEUE_GROUPS = {
  420: { queueType: 'ranked', queueGroup: 'ranked_solo' },
  440: { queueType: 'ranked', queueGroup: 'ranked_flex' },
  400: { queueType: 'normal', queueGroup: 'normal_draft' },
  430: { queueType: 'normal', queueGroup: 'normal_blind' },
  490: { queueType: 'normal', queueGroup: 'normal_quickplay' }
};

function getQueueClassification(queueId) {
  return ALLOWED_SR_5V5_QUEUE_GROUPS[Number(queueId)] || null;
}

function isSupportedSr5v5Match(match) {
  const info = match?.info;
  return Boolean(
    info &&
    info.mapId === 11 &&
    info.gameMode === 'CLASSIC' &&
    getQueueClassification(info.queueId) &&
    Array.isArray(info.participants) &&
    info.participants.length === 10
  );
}

function normalizeParticipant(participant) {
  return {
    championId: Number(participant.championId) || 0,
    championName: participant.championName || '',
    position: participant.teamPosition || participant.individualPosition || participant.lane || ''
  };
}

function calculateKda(kills, deaths, assists) {
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

function normalizeRiotMatch(match, targetPuuid) {
  if (!isSupportedSr5v5Match(match)) return null;

  const info = match.info;
  const self = info.participants.find((participant) => participant.puuid === targetPuuid);
  if (!self) return null;

  const queue = getQueueClassification(info.queueId);
  const allies = info.participants
    .filter((participant) => participant.teamId === self.teamId)
    .map(normalizeParticipant);
  const enemies = info.participants
    .filter((participant) => participant.teamId !== self.teamId)
    .map(normalizeParticipant);
  const kills = Number(self.kills) || 0;
  const deaths = Number(self.deaths) || 0;
  const assists = Number(self.assists) || 0;

  return {
    matchId: match.metadata?.matchId || '',
    gameCreation: info.gameCreation || null,
    mapId: info.mapId,
    queueId: info.queueId,
    queueType: queue.queueType,
    queueGroup: queue.queueGroup,
    gameMode: info.gameMode,
    gameDuration: info.gameDuration || 0,
    gameVersion: info.gameVersion || '',
    self: {
      puuid: self.puuid,
      championId: Number(self.championId) || 0,
      championName: self.championName || '',
      teamId: self.teamId,
      position: self.teamPosition || self.individualPosition || self.lane || '',
      lane: self.lane || '',
      win: Boolean(self.win),
      kills,
      deaths,
      assists,
      kda: calculateKda(kills, deaths, assists)
    },
    allies,
    enemies
  };
}

function normalizeRiotMatches(matchesById, targetPuuid, matchIds = Object.keys(matchesById || {})) {
  return matchIds
    .map((matchId) => normalizeRiotMatch(matchesById?.[matchId], targetPuuid))
    .filter(Boolean)
    .sort((a, b) => (b.gameCreation || 0) - (a.gameCreation || 0));
}

function createEmptyStats(record, queueGroup = record.queueGroup, queueType = record.queueType, position = null) {
  return {
    championId: record.self.championId,
    championName: record.self.championName,
    queueType,
    queueGroup,
    position,
    games: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgKills: 0,
    avgDeaths: 0,
    avgAssists: 0,
    avgKda: 0,
    recentGames: 0,
    recentWins: 0,
    recentWinRate: 0,
    lastPlayedAt: record.gameCreation || null,
    positions: {}
  };
}

function addRecordToStats(stats, record) {
  stats.games += 1;
  stats.wins += record.self.win ? 1 : 0;
  stats.losses = stats.games - stats.wins;
  stats.avgKills += record.self.kills;
  stats.avgDeaths += record.self.deaths;
  stats.avgAssists += record.self.assists;
  stats.avgKda += record.self.kda;
  stats.lastPlayedAt = Math.max(stats.lastPlayedAt || 0, record.gameCreation || 0) || null;

  const position = record.self.position || 'UNKNOWN';
  stats.positions[position] = (stats.positions[position] || 0) + 1;
}

function finalizeStats(stats, records) {
  const recentRecords = records.slice(0, 5);
  const recentWins = recentRecords.filter((record) => record.self.win).length;

  return {
    ...stats,
    winRate: stats.games > 0 ? stats.wins / stats.games : 0,
    avgKills: stats.games > 0 ? stats.avgKills / stats.games : 0,
    avgDeaths: stats.games > 0 ? stats.avgDeaths / stats.games : 0,
    avgAssists: stats.games > 0 ? stats.avgAssists / stats.games : 0,
    avgKda: stats.games > 0 ? stats.avgKda / stats.games : 0,
    recentGames: recentRecords.length,
    recentWins,
    recentWinRate: recentRecords.length > 0 ? recentWins / recentRecords.length : 0
  };
}

function aggregateChampionStats(matchRecords) {
  const grouped = new Map();

  matchRecords.forEach((record) => {
    const position = record.self.position || 'UNKNOWN';
    [
      { key: `${record.self.championId}:${record.queueGroup}:all_positions`, queueGroup: record.queueGroup, queueType: record.queueType, position: null },
      { key: `${record.self.championId}:all_sr_5v5:all_positions`, queueGroup: 'all_sr_5v5', queueType: 'all', position: null },
      { key: `${record.self.championId}:${record.queueGroup}:${position}`, queueGroup: record.queueGroup, queueType: record.queueType, position },
      { key: `${record.self.championId}:all_sr_5v5:${position}`, queueGroup: 'all_sr_5v5', queueType: 'all', position }
    ].forEach((groupDefinition) => {
      const { key, queueGroup, queueType } = groupDefinition;

      if (!grouped.has(key)) {
        grouped.set(key, {
          stats: createEmptyStats(record, queueGroup, queueType, groupDefinition.position),
          records: []
        });
      }

      const group = grouped.get(key);
      group.records.push(record);
      addRecordToStats(group.stats, record);
    });
  });

  return Array.from(grouped.values())
    .map(({ stats, records }) => finalizeStats(stats, records))
    .sort((a, b) => (b.games - a.games) || String(a.championName).localeCompare(String(b.championName), 'en'));
}

module.exports = {
  ALLOWED_SR_5V5_QUEUE_GROUPS,
  getQueueClassification,
  isSupportedSr5v5Match,
  calculateKda,
  normalizeRiotMatch,
  normalizeRiotMatches,
  aggregateChampionStats
};
