const { parseRetryAfterMs } = require('../riot-api');
const {
  createRiotBffPath,
  requestBffJson
} = require('./ai-analysis-service');

import type { MatchHistoryStatus } from '../types/domain/match-history';

type MatchId = string | number;
type RetryCallback = (context: { attempt: number; delayMs: number } | unknown) => void | Promise<void>;

interface BffMatchIdsResponse {
  matchIds?: unknown;
}

interface BffMatchDetailsResponse {
  matchesById: Record<string, unknown>;
  failedMatchIds: MatchId[];
  retryAfter: unknown;
}

interface ApplyBffMatchDetailsResponseDeps {
  response: BffMatchDetailsResponse;
  pending: Set<string>;
  matchesById: Record<string, unknown>;
}

interface RiotId {
  gameName: string;
  tagLine: string;
}

interface RiotMatchHistoryServiceDeps {
  matchIdsPageSize: number;
  updateMatchHistoryStatus: (patch: Partial<MatchHistoryStatus>) => void;
  clearRiotRateLimitCountdown: () => void;
}

interface RequestRetryOptions {
  onRetry?: RetryCallback | null;
}

interface RequestBffAccountByRiotIdOptions extends RequestRetryOptions {
  region: string;
  riotId: RiotId;
}

interface RequestBffMatchIdsOptions extends RequestRetryOptions {
  region: string;
  puuid: string;
  start: number;
  count: number;
  startTime?: number | null;
}

interface CollectMatchIdsByModeOptions extends RequestRetryOptions {
  region: string;
  puuid: string;
  requestedMatches: number;
  mode: string;
}

interface RequestBffMatchDetailsOptions {
  region: string;
  matchIds: MatchId[];
}

interface CollectBffMatchDetailsBatchOptions extends RequestRetryOptions {
  region: string;
  matchIds: MatchId[];
  matchesById: Record<string, unknown>;
  publishCurrentSnapshot: (options: { swallowErrors: boolean }) => Promise<void>;
  maxAttempts?: number;
}

interface RiotMatchHistoryService {
  collectBffMatchDetailsBatch: (
    options: CollectBffMatchDetailsBatchOptions
  ) => Promise<{ fetchedMatches: number; failedMatchIds: MatchId[] }>;
  collectMatchIdsByMode: (options: CollectMatchIdsByModeOptions) => Promise<MatchId[]>;
  requestBffAccountByRiotId: (options: RequestBffAccountByRiotIdOptions) => Promise<unknown>;
  requestBffHealth: (options?: RequestRetryOptions) => Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeBffMatchIdsResponse(body: unknown): MatchId[] {
  const response = body as BffMatchIdsResponse | null | undefined;
  return Array.isArray(response?.matchIds) ? response.matchIds as MatchId[] : [];
}

function normalizeBffMatchDetailsResponse(body: unknown): BffMatchDetailsResponse {
  const response = isRecord(body) ? body : {};
  const matchesById = isRecord(response.matchesById) ? response.matchesById : {};

  return {
    matchesById,
    failedMatchIds: Array.isArray(response.failedMatchIds) ? response.failedMatchIds as MatchId[] : [],
    retryAfter: response.retryAfter ?? null
  };
}

function applyBffMatchDetailsResponse({ response, pending, matchesById }: ApplyBffMatchDetailsResponseDeps): number {
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

function getDefaultSeasonStartAt(now = new Date()): Date {
  const year = now.getFullYear();
  return new Date(`${year}-01-01T00:00:00+09:00`);
}

function createRiotMatchHistoryService({
  matchIdsPageSize,
  updateMatchHistoryStatus,
  clearRiotRateLimitCountdown
}: RiotMatchHistoryServiceDeps): RiotMatchHistoryService {
  function requestBffHealth({ onRetry = null }: RequestRetryOptions = {}): Promise<unknown> {
    return requestBffJson({
      path: '/health',
      onRetry
    });
  }

  function requestBffAccountByRiotId({ region, riotId, onRetry = null }: RequestBffAccountByRiotIdOptions): Promise<unknown> {
    return requestBffJson({
      path: createRiotBffPath(region, ['account', 'by-riot-id', riotId.gameName, riotId.tagLine]),
      onRetry
    });
  }

  function requestBffMatchIds({
    region,
    puuid,
    start,
    count,
    startTime = null,
    onRetry = null
  }: RequestBffMatchIdsOptions): Promise<unknown> {
    return requestBffJson({
      path: createRiotBffPath(region, ['matches', 'by-puuid', puuid, 'ids'], {
        start,
        count,
        startTime
      }),
      onRetry
    });
  }

  async function collectMatchIdsByMode({
    region,
    puuid,
    requestedMatches,
    mode,
    onRetry
  }: CollectMatchIdsByModeOptions): Promise<MatchId[]> {
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
    const allMatchIds: MatchId[] = [];

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

  async function requestBffMatchDetails({ region, matchIds }: RequestBffMatchDetailsOptions): Promise<BffMatchDetailsResponse> {
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
  }: CollectBffMatchDetailsBatchOptions): Promise<{ fetchedMatches: number; failedMatchIds: MatchId[] }> {
    const pending = new Set(matchIds.map(String));
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

export = {
  applyBffMatchDetailsResponse,
  createRiotMatchHistoryService,
  getDefaultSeasonStartAt,
  normalizeBffMatchDetailsResponse,
  normalizeBffMatchIdsResponse
};
