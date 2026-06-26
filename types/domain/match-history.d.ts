export type MatchHistoryPhase =
  | 'idle'
  | 'collecting'
  | 'normalizing'
  | 'aggregating'
  | 'completed'
  | 'partial'
  | 'retrying'
  | 'error';

export type MatchHistorySource = 'manual' | 'auto';

export type MatchHistoryMode = 'recent' | 'season';

export interface MatchHistoryStatus {
  phase: MatchHistoryPhase;
  source: MatchHistorySource;
  mode: MatchHistoryMode;
  requestedMatches: number;
  fetchedMatches: number;
  normalizedMatches: number;
  updatedMatches: number;
  failedRequests: number;
  retryAttempt: number;
  nextRetryAt: string | null;
  message: string;
  error: string | null;
  startedAt: string | null;
  updatedAt: string | null;
}

export interface MatchHistorySummary {
  updatedAt: string | null;
  requestedMatches: number;
  matchIds: number;
  updatedMatches: number;
  normalizedMatches: number;
  failedRequests: number;
  championStats: number;
  oldestGameCreation: number | null;
  newestGameCreation: number | null;
}

export type QueueType = 'ranked' | 'normal' | 'all' | string;

export type QueueGroup =
  | 'ranked_solo'
  | 'ranked_flex'
  | 'normal_draft'
  | 'normal_blind'
  | 'normal_quickplay'
  | 'all_sr_5v5'
  | string;

export interface ChampionStats {
  championId: number;
  championName: string;
  queueType: QueueType;
  queueGroup: QueueGroup;
  position: string | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKda: number;
  recentGames: number;
  recentWins: number;
  recentWinRate: number;
  lastPlayedAt: number | null;
  positions: Record<string, number>;
}

export interface EnemyChampionStats {
  championId: number;
  championName: string;
  position: string | null;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKda: number;
}

export interface LaneOpponentStats extends EnemyChampionStats {
  position: string;
}

export interface SelfVsLaneOpponentStats {
  championId: number;
  championName: string;
  opponentChampionId: number;
  opponentChampionName: string;
  position: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKda: number;
}
