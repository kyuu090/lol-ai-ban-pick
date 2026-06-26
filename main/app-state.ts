import type { LaneMatchupAnalysisState } from '../types/domain/ai-analysis';
import type { AppState } from '../types/domain/app-state';
import type { ChampionPool } from '../types/domain/champion';
import type {
  ChampionStats,
  EnemyChampionStats,
  LaneOpponentStats,
  MatchHistoryStatus,
  MatchHistorySummary,
  SelfVsLaneOpponentStats
} from '../types/domain/match-history';
import type { PublicSettings } from '../types/domain/settings';

type MatchHistorySummarySourceMatch = { gameCreation?: number | string | null };
type AppStatePatch = Partial<AppState>;

interface CreateMatchHistoryStatusOptions {
  defaultRequestedMatches?: number;
  patch?: Partial<MatchHistoryStatus>;
}

interface CreateMatchHistorySummaryOptions {
  updatedAt?: string | null;
  requestedMatches?: number;
  matchIds?: number;
  updatedMatches?: number;
  matches?: MatchHistorySummarySourceMatch[];
  failedRequests?: number;
  championStats?: number;
}

interface CreateInitialStateOptions {
  settings: PublicSettings;
  championPool: ChampionPool;
  matchHistoryStatus: MatchHistoryStatus;
  matchHistoryChampionStats?: ChampionStats[];
  matchHistoryEnemyChampionStats?: EnemyChampionStats[];
  matchHistoryLaneOpponentStats?: LaneOpponentStats[];
  matchHistorySelfVsLaneOpponentStats?: SelfVsLaneOpponentStats[];
}

function createLaneMatchupAnalysisState(
  patch: Partial<LaneMatchupAnalysisState> = {}
): LaneMatchupAnalysisState {
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

function createMatchHistoryStatus({
  defaultRequestedMatches = 0,
  patch = {}
}: CreateMatchHistoryStatusOptions = {}): MatchHistoryStatus {
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
}: CreateMatchHistorySummaryOptions = {}): MatchHistorySummary {
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
}: CreateInitialStateOptions): AppState {
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

function applyStatePatch(currentState: AppState, patch: AppStatePatch, now = new Date()): AppState {
  return {
    ...currentState,
    ...patch,
    updatedAt: now.toISOString()
  };
}

export = {
  applyStatePatch,
  createInitialState,
  createLaneMatchupAnalysisState,
  createMatchHistoryStatus,
  createMatchHistorySummary
};
