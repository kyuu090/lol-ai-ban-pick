const { parseRetryAfterMs } = require('../riot-api');
const {
  createRiotBffPath,
  requestBffJson
} = require('./ai-analysis-service');

import type { MatchHistoryStatus } from '../types/domain/match-history';
const { translate } = require('./i18n');

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
  getLanguage?: () => 'en' | 'ja';
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

interface CollectBffMatchTimelinesOptions extends RequestRetryOptions {
  region: string;
  matchIds: MatchId[];
  onTimeline: (matchId: MatchId, timeline: unknown) => void | Promise<void>;
}

interface RiotMatchHistoryService {
  collectBffMatchDetailsBatch: (
    options: CollectBffMatchDetailsBatchOptions
  ) => Promise<{ fetchedMatches: number; failedMatchIds: MatchId[] }>;
  collectBffMatchTimelines: (options: CollectBffMatchTimelinesOptions) => Promise<{ fetchedTimelines: number; failedMatchIds: MatchId[] }>;
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
  clearRiotRateLimitCountdown,
  getLanguage
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
    const seasonStartAt = getDefaultSeasonStartAt();
    const startTime = Math.floor(seasonStartAt.getTime() / 1000);

    if (mode !== 'season') {
      const body = await requestBffMatchIds({
        region,
        puuid,
        start: 0,
        count: requestedMatches,
        startTime,
        onRetry
      });
      clearRiotRateLimitCountdown();

      return normalizeBffMatchIdsResponse(body).slice(0, requestedMatches);
    }

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
        message: translate(getLanguage?.(), 'matchHistory.fetchingIds', { matches: allMatchIds.length })
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

  function requestBffMatchTimeline(region: string, matchId: MatchId, onRetry: RetryCallback | null = null): Promise<unknown> {
    return requestBffJson({
      path: createRiotBffPath(region, ['matches', matchId, 'timeline']),
      onRetry,
      maxRetries: 3
    });
  }

  async function collectBffMatchTimelines({ region, matchIds, onTimeline, onRetry = null }: CollectBffMatchTimelinesOptions): Promise<{ fetchedTimelines: number; failedMatchIds: MatchId[] }> {
    let fetchedTimelines = 0;
    const failedMatchIds: MatchId[] = [];
    for (const matchId of matchIds) {
      try {
        const timeline = await requestBffMatchTimeline(region, matchId, onRetry);
        await onTimeline(matchId, timeline);
        fetchedTimelines += 1;
      } catch {
        failedMatchIds.push(matchId);
      }
    }
    return { fetchedTimelines, failedMatchIds };
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
    collectBffMatchTimelines,
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
