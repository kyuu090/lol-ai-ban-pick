// @ts-check

/**
 * @typedef {import('../types/domain/ai-analysis').LaneMatchupAnalysisState} LaneMatchupAnalysisState
 * @typedef {import('../types/domain/app-state').AppState} AppState
 * @typedef {import('../types/domain/champion').ChampionPool} ChampionPool
 * @typedef {import('../types/domain/match-history').ChampionStats} ChampionStats
 * @typedef {import('../types/domain/match-history').EnemyChampionStats} EnemyChampionStats
 * @typedef {import('../types/domain/match-history').LaneOpponentStats} LaneOpponentStats
 * @typedef {import('../types/domain/match-history').MatchHistoryStatus} MatchHistoryStatus
 * @typedef {import('../types/domain/match-history').MatchHistorySummary} MatchHistorySummary
 * @typedef {import('../types/domain/match-history').SelfVsLaneOpponentStats} SelfVsLaneOpponentStats
 * @typedef {import('../types/domain/settings').PublicSettings} PublicSettings
 */

/**
 * @typedef {{ gameCreation?: number | string | null }} MatchHistorySummarySourceMatch
 */

/**
 * @param {Partial<LaneMatchupAnalysisState>} [patch]
 * @returns {LaneMatchupAnalysisState}
 */
function createLaneMatchupAnalysisState(patch = {}) {
  return {
    status: 'idle',
    requestKey: null,
    request: null,
    response: null,
    error: null,
    updatedAt: null,
    ...patch
  };
}

/**
 * @param {object} [options]
 * @param {number} [options.defaultRequestedMatches]
 * @param {Partial<MatchHistoryStatus>} [options.patch]
 * @returns {MatchHistoryStatus}
 */
function createMatchHistoryStatus({ defaultRequestedMatches = 0, patch = {} } = {}) {
  return {
    phase: 'idle',
    source: 'manual',
    mode: 'recent',
    requestedMatches: defaultRequestedMatches,
    fetchedMatches: 0,
    normalizedMatches: 0,
    updatedMatches: 0,
    failedRequests: 0,
    retryAttempt: 0,
    nextRetryAt: null,
    message: '',
    error: null,
    startedAt: null,
    updatedAt: null,
    ...patch
  };
}

/**
 * @param {object} [options]
 * @param {string | null} [options.updatedAt]
 * @param {number} [options.requestedMatches]
 * @param {number} [options.matchIds]
 * @param {number} [options.updatedMatches]
 * @param {MatchHistorySummarySourceMatch[]} [options.matches]
 * @param {number} [options.failedRequests]
 * @param {number} [options.championStats]
 * @returns {MatchHistorySummary}
 */
function createMatchHistorySummary({
  updatedAt = null,
  requestedMatches = 0,
  matchIds = 0,
  updatedMatches = 0,
  matches = [],
  failedRequests = 0,
  championStats = 0
} = {}) {
  const gameCreations = matches
    .map((match) => Number(match.gameCreation))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    updatedAt,
    requestedMatches,
    matchIds,
    updatedMatches,
    normalizedMatches: matches.length,
    failedRequests,
    championStats,
    oldestGameCreation: gameCreations.length > 0 ? Math.min(...gameCreations) : null,
    newestGameCreation: gameCreations.length > 0 ? Math.max(...gameCreations) : null
  };
}

/**
 * @param {object} options
 * @param {PublicSettings} options.settings
 * @param {ChampionPool} options.championPool
 * @param {MatchHistoryStatus} options.matchHistoryStatus
 * @param {ChampionStats[]} [options.matchHistoryChampionStats]
 * @param {EnemyChampionStats[]} [options.matchHistoryEnemyChampionStats]
 * @param {LaneOpponentStats[]} [options.matchHistoryLaneOpponentStats]
 * @param {SelfVsLaneOpponentStats[]} [options.matchHistorySelfVsLaneOpponentStats]
 * @returns {AppState}
 */
function createInitialState({
  settings,
  championPool,
  matchHistoryStatus,
  matchHistoryChampionStats = [],
  matchHistoryEnemyChampionStats = [],
  matchHistoryLaneOpponentStats = [],
  matchHistorySelfVsLaneOpponentStats = []
}) {
  return {
    settings,
    lcuStatus: 'disconnected',
    websocketStatus: 'disconnected',
    gameflowPhase: null,
    summoner: null,
    lobby: null,
    champSelect: null,
    championsById: {},
    championPool,
    matchHistoryStatus,
    matchHistorySummary: null,
    matchHistoryChampionStats,
    matchHistoryEnemyChampionStats,
    matchHistoryLaneOpponentStats,
    matchHistorySelfVsLaneOpponentStats,
    gameflowSession: null,
    laneMatchupAnalysis: createLaneMatchupAnalysisState(),
    lastEvent: null,
    error: null,
    updatedAt: null
  };
}

/**
 * @param {AppState} currentState
 * @param {Partial<AppState>} patch
 * @param {Date} [now]
 * @returns {AppState}
 */
function applyStatePatch(currentState, patch, now = new Date()) {
  return {
    ...currentState,
    ...patch,
    updatedAt: now.toISOString()
  };
}

module.exports = {
  applyStatePatch,
  createInitialState,
  createLaneMatchupAnalysisState,
  createMatchHistoryStatus,
  createMatchHistorySummary
};
