const { parseRetryAfterMs } = require('../riot-api');
const {
  createRiotBffPath,
  requestBffJson
} = require('./ai-analysis-service');

function normalizeBffMatchIdsResponse(body) {
  return Array.isArray(body?.matchIds) ? body.matchIds : [];
}

function normalizeBffMatchDetailsResponse(body) {
  return {
    matchesById: body?.matchesById && typeof body.matchesById === 'object' ? body.matchesById : {},
    failedMatchIds: Array.isArray(body?.failedMatchIds) ? body.failedMatchIds : [],
    retryAfter: body?.retryAfter ?? null
  };
}

function applyBffMatchDetailsResponse({ response, pending, matchesById }) {
  let fetchedMatches = 0;

  Object.entries(response.matchesById).forEach(([matchId, detail]) => {
    if (!pending.has(matchId)) return;
    matchesById[matchId] = detail;
    pending.delete(matchId);
    fetchedMatches += 1;
  });

  const failedMatchIds = new Set(response.failedMatchIds);
  [...pending].forEach((matchId) => {
    if (!response.matchesById[matchId] && !failedMatchIds.has(matchId)) {
      pending.delete(matchId);
    }
  });

  return fetchedMatches;
}

function getDefaultSeasonStartAt(now = new Date()) {
  const year = now.getFullYear();
  return new Date(`${year}-01-01T00:00:00+09:00`);
}

function createRiotMatchHistoryService({
  matchIdsPageSize,
  updateMatchHistoryStatus,
  clearRiotRateLimitCountdown
}) {
  function requestBffHealth({ onRetry = null } = {}) {
    return requestBffJson({
      path: '/health',
      onRetry
    });
  }

  function requestBffAccountByRiotId({ region, riotId, onRetry = null }) {
    return requestBffJson({
      path: createRiotBffPath(region, ['account', 'by-riot-id', riotId.gameName, riotId.tagLine]),
      onRetry
    });
  }

  function requestBffMatchIds({ region, puuid, start, count, startTime = null, onRetry = null }) {
    return requestBffJson({
      path: createRiotBffPath(region, ['matches', 'by-puuid', puuid, 'ids'], {
        start,
        count,
        startTime
      }),
      onRetry
    });
  }

  async function collectMatchIdsByMode({ region, puuid, requestedMatches, mode, onRetry }) {
    if (mode !== 'season') {
      const body = await requestBffMatchIds({
        region,
        puuid,
        start: 0,
        count: requestedMatches,
        onRetry
      });
      clearRiotRateLimitCountdown();

      return normalizeBffMatchIdsResponse(body).slice(0, requestedMatches);
    }

    const seasonStartAt = getDefaultSeasonStartAt();
    const startTime = Math.floor(seasonStartAt.getTime() / 1000);
    const allMatchIds = [];

    for (let start = 0; ; start += matchIdsPageSize) {
      const page = await requestBffMatchIds({
        region,
        puuid,
        start,
        count: matchIdsPageSize,
        startTime,
        onRetry
      });
      clearRiotRateLimitCountdown();
      const pageMatchIds = normalizeBffMatchIdsResponse(page);
      allMatchIds.push(...pageMatchIds);

      updateMatchHistoryStatus({
        phase: 'collecting',
        requestedMatches: allMatchIds.length,
        message: `試合IDリスト取得中... ${allMatchIds.length} 試合`
      });

      if (pageMatchIds.length < matchIdsPageSize) break;
    }

    return allMatchIds;
  }

  async function requestBffMatchDetails({ region, matchIds }) {
    const body = await requestBffJson({
      path: createRiotBffPath(region, ['matches', 'details'], {
        matchIds: matchIds.join(',')
      }),
      maxRetries: 0
    });

    return normalizeBffMatchDetailsResponse(body);
  }

  async function collectBffMatchDetailsBatch({
    region,
    matchIds,
    matchesById,
    onRetry,
    publishCurrentSnapshot,
    maxAttempts = 3
  }) {
    const pending = new Set(matchIds);
    let fetchedMatches = 0;

    for (let attempt = 0; attempt < maxAttempts && pending.size > 0; attempt += 1) {
      const targetMatchIds = [...pending];
      const response = await requestBffMatchDetails({
        region,
        matchIds: targetMatchIds
      });

      fetchedMatches += applyBffMatchDetailsResponse({ response, pending, matchesById });

      if (pending.size === 0) break;

      const retryDelayMs = parseRetryAfterMs(response.retryAfter);
      if (retryDelayMs === null || attempt + 1 >= maxAttempts) break;

      await publishCurrentSnapshot({ swallowErrors: true });
      if (typeof onRetry === 'function') {
        await onRetry({ attempt: attempt + 1, delayMs: retryDelayMs });
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    return {
      fetchedMatches,
      failedMatchIds: [...pending]
    };
  }

  return {
    collectBffMatchDetailsBatch,
    collectMatchIdsByMode,
    requestBffAccountByRiotId,
    requestBffHealth
  };
}

module.exports = {
  applyBffMatchDetailsResponse,
  createRiotMatchHistoryService,
  getDefaultSeasonStartAt,
  normalizeBffMatchDetailsResponse,
  normalizeBffMatchIdsResponse
};
