import type { MatchHistoryMode } from './types/domain/match-history';

type MatchId = string | number;

type StoredMatchHistory = {
  source?: 'riot-api' | string;
  puuid?: string;
  matches?: { matchId?: MatchId }[];
};

type RiotMatchDetailCandidate = {
  metadata?: unknown;
  info?: unknown;
};

function hasCachedRiotMatchDetail(matchesById: Record<string, unknown>, matchId: MatchId): boolean {
  const detail = matchesById?.[matchId] as RiotMatchDetailCandidate | null | undefined;
  return Boolean(detail && typeof detail === 'object' && detail.metadata && detail.info);
}

function collectHistoryMatchIds(history: StoredMatchHistory | null | undefined): MatchId[] {
  if (!history || history.source !== 'riot-api' || !Array.isArray(history.matches)) return [];

  return history.matches.reduce<MatchId[]>((matchIds, match) => {
    const matchId = match?.matchId;
    if (matchId) matchIds.push(matchId);
    return matchIds;
  }, []);
}

function mergeMatchIds(...matchIdLists: MatchId[][]): MatchId[] {
  const seen = new Set<MatchId>();
  const merged: MatchId[] = [];

  matchIdLists.flat().forEach((matchId) => {
    if (!matchId || seen.has(matchId)) return;
    seen.add(matchId);
    merged.push(matchId);
  });

  return merged;
}

function createAnalysisMatchIds({
  mode,
  normalizedMatchIds,
  existingHistory,
  storagePuuid
}: {
  mode: MatchHistoryMode;
  normalizedMatchIds: MatchId[];
  existingHistory: StoredMatchHistory | null | undefined;
  storagePuuid: string;
}): MatchId[] {
  if (mode === 'season') return normalizedMatchIds;

  const existingHistoryMatchIds = existingHistory?.puuid === storagePuuid
    ? collectHistoryMatchIds(existingHistory)
    : [];
  return mergeMatchIds(normalizedMatchIds, existingHistoryMatchIds);
}

function collectMissingMatchIds(matchIds: MatchId[], matchesById: Record<string, unknown>): MatchId[] {
  return matchIds.filter((matchId) => !hasCachedRiotMatchDetail(matchesById, matchId));
}

export = {
  collectHistoryMatchIds,
  collectMissingMatchIds,
  createAnalysisMatchIds,
  hasCachedRiotMatchDetail,
  mergeMatchIds
};
