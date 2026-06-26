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

function createMatchHistoryStatus({ defaultRequestedMatches, patch = {} } = {}) {
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
