import type { LaneMatchupAnalysisState } from './ai-analysis';
import type { ChampionPool, ChampionsById } from './champion';
import type {
  ChampSelectSession,
  GameflowPhase,
  GameflowSession,
  LcuErrorPayload,
  LcuJsonApiEvent,
  LcuStatus,
  Lobby,
  PerksCurrentPage,
  Summoner,
  WebSocketStatus
} from './lcu';
import type {
  ChampionStats,
  EnemyChampionStats,
  LaneOpponentStats,
  MatchHistoryStatus,
  MatchHistorySummary,
  SelfVsLaneOpponentStats
} from './match-history';
import type { PublicSettings, RiotPlatformRegion, RiotRegionalRoute } from './settings';

export interface AppState {
  settings: PublicSettings;
  lcuStatus: LcuStatus;
  detectedRiotPlatformRegion: RiotPlatformRegion | null;
  detectedRiotRegionalRoute: RiotRegionalRoute | null;
  websocketStatus: WebSocketStatus;
  gameflowPhase: GameflowPhase | null;
  summoner: Summoner | LcuErrorPayload | null;
  lobby: Lobby | LcuErrorPayload | null;
  champSelect: ChampSelectSession | LcuErrorPayload | null;
  perksCurrentPage: PerksCurrentPage | LcuErrorPayload | null;
  championsById: ChampionsById;
  championPool: ChampionPool;
  matchHistoryStatus: MatchHistoryStatus;
  matchHistorySummary: MatchHistorySummary | null;
  matchHistoryChampionStats: ChampionStats[];
  matchHistoryEnemyChampionStats: EnemyChampionStats[];
  matchHistoryLaneOpponentStats: LaneOpponentStats[];
  matchHistorySelfVsLaneOpponentStats: SelfVsLaneOpponentStats[];
  matchHistoryLaneMatchupTimeline: any[];
  gameflowSession: GameflowSession | LcuErrorPayload | null;
  laneMatchupAnalysis: LaneMatchupAnalysisState;
  lastEvent: LcuJsonApiEvent | null;
  error: string | null;
  updatedAt: string | null;
}
