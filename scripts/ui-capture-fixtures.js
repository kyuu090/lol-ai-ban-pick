// @ts-check

const CAPTURE_CHAMPIONS = {
  4: { id: 4, name: 'ツイステッド・フェイト', alias: 'TwistedFate', title: 'カードマスター' },
  61: { id: 61, name: 'オリアナ', alias: 'Orianna', title: '時計仕掛けの舞姫' },
  103: { id: 103, name: 'アーリ', alias: 'Ahri', title: '九尾の狐' },
  134: { id: 134, name: 'シンドラ', alias: 'Syndra', title: '暗黒の女王' },
  238: { id: 238, name: 'ゼド', alias: 'Zed', title: '影の頭領' }
};

const CAPTURE_SETTINGS = {
  lolInstallDir: 'C:\\Riot Games\\League of Legends',
  riotPlatformRegion: 'JP1',
  riotRegionalRoute: 'ASIA',
  riotPlatformRegions: ['JP1', 'KR'],
  themeMode: 'light',
  themeModes: ['system', 'light', 'dark']
};

/** @param {string} [themeMode] */
function createCaptureState(themeMode = 'light') {
  return {
    settings: { ...CAPTURE_SETTINGS, themeMode },
    lcuStatus: 'connected',
    websocketStatus: 'connected',
    gameflowPhase: 'None',
    summoner: {
      displayName: 'CapturePlayer#JP1',
      gameName: 'CapturePlayer',
      tagLine: 'JP1',
      puuid: 'capture-puuid'
    },
    lobby: null,
    champSelect: null,
    championsById: CAPTURE_CHAMPIONS,
    championPool: { top: [], jungle: [], middle: [103, 61], bottom: [], utility: [] },
    matchHistoryStatus: { phase: 'idle', message: '', error: null },
    matchHistorySummary: {
      normalizedMatches: 120,
      oldestGameCreation: Date.now() - 1000 * 60 * 60 * 24 * 80,
      newestGameCreation: Date.now() - 1000 * 60 * 60 * 2
    },
    matchHistoryChampionStats: [],
    matchHistoryEnemyChampionStats: [],
    matchHistoryLaneOpponentStats: [],
    matchHistorySelfVsLaneOpponentStats: [],
    gameflowSession: null,
    laneMatchupAnalysis: { status: 'idle', requestKey: null, request: null, response: null, error: null },
    lastEvent: null,
    error: null,
    updatedAt: new Date().toISOString()
  };
}

/**
 * @param {number} minute
 * @param {string} [variant]
 */
function createTimelinePoint(minute, variant = 'overall') {
  const index = minute / 5 - 1;
  const matchupGold = [-90, -135, -80, 20, 105, 185, 270, 340];
  const overallGold = [18, 72, 138, 205, 278, 345, 405, 462];
  const gold = (variant === 'matchup' ? matchupGold : overallGold)[index];
  const xp = Math.round(gold * 0.58);
  const cs = Number((gold / 78).toFixed(1));
  const leadOffset = variant === 'matchup' ? -0.035 : 0.015;
  const goldLeadRate = Math.max(0.35, Math.min(0.68, 0.5 + gold / 2400 + leadOffset));
  const xpLeadRate = Math.max(0.35, Math.min(0.68, goldLeadRate - 0.012));
  const csLeadRate = Math.max(0.35, Math.min(0.68, goldLeadRate + 0.018));
  const championGold = 1650 + minute * 365 + Math.max(gold, 0) / 2;
  const opponentGold = championGold - gold;
  const championXp = 900 + minute * 282 + Math.max(xp, 0) / 2;
  const opponentXp = championXp - xp;
  const championCs = 4.1 * minute + Math.max(cs, 0) / 2;
  const opponentCs = championCs - cs;
  const fightRate = Math.min(0.82, 0.12 + index * 0.085);
  const championDamageToChampions = Math.round(420 + minute * 205 + index * index * 32);
  const opponentDamageToChampions = Math.round(championDamageToChampions * (variant === 'matchup' ? 1.04 : 0.93));
  const championDamageTaken = Math.round(520 + minute * 188 + index * index * 28);
  const opponentDamageTaken = Math.round(championDamageTaken * (variant === 'matchup' ? 0.96 : 1.06));
  const championCcMs = Math.round(120 + minute * 74 + index * 36);
  const opponentCcMs = Math.round(championCcMs * (variant === 'matchup' ? 1.12 : 0.88));
  const championKills = Number((0.08 + index * 0.43).toFixed(2));
  const opponentKills = Number((0.1 + index * (variant === 'matchup' ? 0.47 : 0.38)).toFixed(2));
  const championDeaths = Number((0.06 + index * 0.31).toFixed(2));
  const opponentDeaths = Number((0.07 + index * 0.34).toFixed(2));
  const championAssists = Number((0.12 + index * 0.58).toFixed(2));
  const opponentAssists = Number((0.1 + index * 0.54).toFixed(2));
  const plateProgress = [0.18, 0.72, 1.34, 1.42, 1.42, 1.42, 1.42, 1.42][index];
  const plateLostProgress = [0.14, 0.56, 1.02, 1.08, 1.08, 1.08, 1.08, 1.08][index];
  const towerTakenRate = [0.01, 0.05, 0.18, 0.34, 0.42, 0.46, 0.48, 0.49][index];
  const towerLostRate = [0.01, 0.04, 0.14, 0.27, 0.36, 0.4, 0.43, 0.45][index];
  return {
    minute,
    games: Math.max(286, 420 - index * 18),
    champion: {
      avgGold: Math.round(championGold),
      avgXp: Math.round(championXp),
      avgCs: Number(championCs.toFixed(1)),
      avgLevel: Number((1 + minute * 0.62).toFixed(1)),
      avgDamageToChampions: championDamageToChampions,
      avgDamageTaken: championDamageTaken,
      avgTimeEnemyCcMs: championCcMs,
      avgKills: championKills,
      avgDeaths: championDeaths,
      avgAssists: championAssists
    },
    opponent: {
      avgGold: Math.round(opponentGold),
      avgXp: Math.round(opponentXp),
      avgCs: Number(opponentCs.toFixed(1)),
      avgLevel: Number((1 + minute * 0.61).toFixed(1)),
      avgDamageToChampions: opponentDamageToChampions,
      avgDamageTaken: opponentDamageTaken,
      avgTimeEnemyCcMs: opponentCcMs,
      avgKills: opponentKills,
      avgDeaths: opponentDeaths,
      avgAssists: opponentAssists
    },
    difference: {
      avgGold: gold,
      avgXp: xp,
      avgCs: cs,
      goldLeadRate: Number(goldLeadRate.toFixed(3)),
      xpLeadRate: Number(xpLeadRate.toFixed(3)),
      csLeadRate: Number(csLeadRate.toFixed(3))
    },
    laneFights: {
      isolated_kills_vs_lane: Number((0.035 + index * 0.07).toFixed(2)),
      isolated_deaths_vs_lane: Number((0.025 + index * 0.052).toFixed(2)),
      isolated_assists_vs_lane: Number((0.012 + index * 0.032).toFixed(2)),
      isolated_kills_vs_lane_occurred_rate: Number(Math.min(0.58, 0.03 + index * 0.062).toFixed(3)),
      isolated_deaths_vs_lane_occurred_rate: Number(Math.min(0.48, 0.025 + index * 0.052).toFixed(3)),
      isolated_assists_vs_lane_occurred_rate: Number(Math.min(0.36, 0.012 + index * 0.038).toFixed(3)),
      fight_occurred_rate: Number(fightRate.toFixed(3))
    },
    laneObjectives: {
      avgLaneOuterPlatesTaken: Number(plateProgress.toFixed(2)),
      avgLaneOuterPlatesLost: Number(plateLostProgress.toFixed(2)),
      laneOuterTowerTakenRate: Number(towerTakenRate.toFixed(3)),
      laneOuterTowerLostRate: Number(towerLostRate.toFixed(3))
    }
  };
}

/** @param {string} [variant] */
function createTimeline(variant = 'overall') {
  return [5, 10, 15, 20, 25, 30, 35, 40].map((minute) => createTimelinePoint(minute, variant));
}

function createChampionDetailsData() {
  return {
    champion: { championId: 103, games: 1840, wins: 956, pickRate: 0.084, winRate: 0.52 },
    keystones: [{
      keystoneId: 8112,
      games: 920,
      wins: 497,
      pickRate: 0.5,
      winRate: 0.54,
      runes: [],
      statShards: [],
      summonerSpells: [{ spellIds: [4, 14], games: 710, wins: 382, pickRate: 0.772, winRate: 0.538 }],
      startingItems: [{ itemIds: [1056, 2003, 2003], games: 760, wins: 405, pickRate: 0.826, winRate: 0.533 }],
      boots: [{ itemId: 3020, games: 630, wins: 345, pickRate: 0.685, winRate: 0.548 }],
      firstSecondCoreItems: [{ itemIds: [6655, 4645], games: 380, wins: 214, pickRate: 0.413, winRate: 0.563 }],
      thirdItems: [{ itemId: 3089, games: 210, wins: 124, pickRate: 0.228, winRate: 0.59 }],
      fourthItems: [],
      fifthItems: [],
      sixthItems: [],
      skillOpenings: [{ skillOrder: ['3', '1', '2', '1', '1', '4'], games: 740, wins: 398, pickRate: 0.804, winRate: 0.538 }],
      skillPriorities: [{ firstMaxSkill: '1', secondMaxSkill: '2', thirdMaxSkill: '3', games: 780, wins: 421, pickRate: 0.848, winRate: 0.54 }]
    }]
  };
}

/** @param {unknown} pathOrUrl */
function createStatsFixtureResponse(pathOrUrl) {
  const url = new URL(String(pathOrUrl || ''), 'https://db.banpick-ai.lol');
  const path = url.pathname;
  if (path === '/v1/stats/meta') {
    return {
      data: {
        latestPatch: '16.13',
        patches: ['16.13'],
        regions: ['JP1', 'KR'],
        queueIds: [420],
        ranks: ['DIAMOND', 'MASTER'],
        positions: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'],
        watermark: '2026-07-16T00:00:00.000Z'
      }
    };
  }
  if (/\/champions\/103\/matchups\/238$/.test(path)) {
    return {
      data: {
        championId: 103,
        opponentChampionId: 238,
        games: 420,
        wins: 206,
        winRateVsOpponent: 0.49,
        timeline: createTimeline('matchup')
      }
    };
  }
  if (/\/champions\/103\/matchups$/.test(path)) {
    return {
      data: {
        championId: 103,
        baselineWinRate: 0.52,
        matchups: [
          { opponentChampionId: 238, games: 420, wins: 206, winRateVsOpponent: 0.49 },
          { opponentChampionId: 134, games: 388, wins: 217, winRateVsOpponent: 0.559 },
          { opponentChampionId: 61, games: 344, wins: 172, winRateVsOpponent: 0.5 },
          { opponentChampionId: 4, games: 305, wins: 174, winRateVsOpponent: 0.57 }
        ]
      }
    };
  }
  if (/\/champions\/103\/timeline$/.test(path)) {
    return {
      data: {
        championId: 103,
        games: 1840,
        wins: 956,
        winRate: 0.52,
        timeline: createTimeline('overall')
      }
    };
  }
  if (/\/champions\/103\/details$/.test(path)) {
    return { data: createChampionDetailsData() };
  }
  const championsMatch = path.match(/\/positions\/(TOP|JUNGLE|MIDDLE|BOTTOM|UTILITY)\/champions$/);
  if (championsMatch) {
    const position = championsMatch[1];
    return {
      data: [
        { championId: 103, winRate: 0.52, pickRate: 0.084, banRate: 0.071, tierScore: 57.4, tier: 'S', games: 1840, mostPlayedLane: position },
        { championId: 134, winRate: 0.514, pickRate: 0.062, banRate: 0.055, tierScore: 54.8, tier: 'A', games: 1510, mostPlayedLane: position },
        { championId: 61, winRate: 0.506, pickRate: 0.048, banRate: 0.012, tierScore: 52.1, tier: 'A', games: 1260, mostPlayedLane: position },
        { championId: 238, winRate: 0.498, pickRate: 0.071, banRate: 0.126, tierScore: 50.9, tier: 'B', games: 1620, mostPlayedLane: position }
      ]
    };
  }
  throw new Error(`No UI capture fixture for StatsAPI path: ${path}`);
}

/** @param {number} championId */
function createChampionIconDataUrl(championId) {
  const champion = /** @type {Record<number, { alias: string }>} */ (CAPTURE_CHAMPIONS)[championId];
  const label = champion?.alias?.slice(0, 2).toUpperCase() || String(championId);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="96" height="96" rx="20" fill="url(#g)"/><text x="48" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

module.exports = {
  CAPTURE_CHAMPIONS,
  CAPTURE_SETTINGS,
  createCaptureState,
  createChampionIconDataUrl,
  createStatsFixtureResponse,
  createTimeline
};
