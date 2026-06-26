export type ThemeMode = 'system' | 'light' | 'dark';

export type RiotPlatformRegion =
  | 'BR1'
  | 'EUN1'
  | 'EUW1'
  | 'JP1'
  | 'KR'
  | 'LA1'
  | 'LA2'
  | 'NA1'
  | 'OC1'
  | 'TR1'
  | 'RU'
  | 'PH2'
  | 'SG2'
  | 'TH2'
  | 'TW2'
  | 'VN2';

export type RiotRegionalRoute = 'AMERICAS' | 'EUROPE' | 'ASIA' | 'SEA';

export interface PublicSettings {
  lolInstallDir: string;
  riotPlatformRegion: RiotPlatformRegion;
  riotRegionalRoute: RiotRegionalRoute;
  riotPlatformRegions: readonly RiotPlatformRegion[];
  themeMode: ThemeMode;
  themeModes: readonly ThemeMode[];
}

export type ChampionPoolLaneId = 'top' | 'jungle' | 'middle' | 'bottom' | 'utility';

export type ChampionPool = Record<ChampionPoolLaneId, number[]>;

export interface ChampionSummaryItem {
  id: number;
  name: string;
  alias?: string;
  title?: string;
  squarePortraitPath?: string;
}

export type ChampionsById = Record<number, ChampionSummaryItem>;

export type LcuStatus = 'disconnected' | 'connecting' | 'connected';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'InProgress'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | string;

export interface LcuErrorPayload {
  error: string;
  [key: string]: unknown;
}

export interface Summoner {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  riotIdTagLine?: string;
  displayName?: string;
  internalName?: string;
  name?: string;
  [key: string]: unknown;
}

export interface Lobby {
  gameConfig?: {
    mapId?: number;
    gameMode?: string;
    gameModeName?: string;
    queueId?: number;
    queueType?: string;
    pickMode?: string;
    isCustom?: boolean;
    isCustomGame?: boolean;
    isRanked?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type ChampSelectActionType = 'pick' | 'ban' | string;

export interface ChampSelectAction {
  id?: number;
  actorCellId?: number;
  championId?: number;
  completed?: boolean;
  isInProgress?: boolean;
  type?: ChampSelectActionType;
  [key: string]: unknown;
}

export interface ChampSelectMember {
  assignedPosition?: string;
  cellId: number;
  championId?: number;
  championPickIntent?: number;
  puuid?: string;
  playerPuuid?: string;
  [key: string]: unknown;
}

export interface ChampSelectSession {
  actions?: ChampSelectAction[][];
  bans?: {
    myTeamBans?: number[];
    theirTeamBans?: number[];
    [key: string]: unknown;
  };
  localPlayerCellId?: number;
  myTeam?: ChampSelectMember[];
  theirTeam?: ChampSelectMember[];
  timer?: {
    phase?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

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

export interface DraftPanelState {
  phase: GameflowPhase | null;
  champSelect: ChampSelectSession | null;
  loggedIn: boolean;
  inGame: boolean;
  inChampSelect: boolean;
  supportedDraftGameMode: boolean;
  unsupportedGameMode: boolean;
}

export interface DraftChampionEntry {
  championId: number;
  championName: string;
}

export interface PickPhaseDraftContext {
  phase: 'own_pick';
  localPlayer: {
    intendedPick: DraftChampionEntry;
  };
  allyTeam: {
    intendedPicks: DraftChampionEntry[];
    lockedPicks: DraftChampionEntry[];
  };
  enemyTeam: {
    lockedPicks: DraftChampionEntry[];
  };
  ownChampionPool: DraftChampionEntry[];
}

export interface FinalCompositionDraftContext {
  phase: 'final_composition';
  localPlayer: {
    lockedPick: DraftChampionEntry;
  };
  allyTeam: {
    lockedPicks: DraftChampionEntry[];
  };
  enemyTeam: {
    lockedPicks: DraftChampionEntry[];
  };
}

export interface InGameContext {
  championId: number;
  position: string;
  summonerName: string;
  opponentChampionId: number;
  directMatchupStats: SelfVsLaneOpponentStats | null;
  allyChampionIds: number[];
  enemyChampionIds: number[];
}

export type LaneMatchupLane = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'BOTTOM/SUPPORT';

export interface LaneMatchupAnalysisPayload {
  myChampionName: string;
  myChampionId: number | string;
  lane?: LaneMatchupLane;
  enemyChampionName: string;
  enemyChampionId: number | string;
}

export interface LaneMatchupAnalysisContext {
  gameId: number | string | null;
  localPosition: string;
  opponentPosition: string;
  laneMatchupLane: LaneMatchupLane;
  localChampionIds: number[];
  enemyChampionIds: number[];
  payload: LaneMatchupAnalysisPayload;
  requestKey: string;
}

export type AiAnalysisStatus = 'idle' | 'requesting' | 'ready' | 'error';

export interface AiAnalysisNote {
  title: string;
  body: string;
}

export type AiAnalysisRichTextToken =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'champion';
      championName: string;
      championId?: number;
    };

export type AiAnalysisRichText = string | AiAnalysisRichTextToken[];

export interface AiAnalysisResponse {
  notes?: AiAnalysisNote[];
  difficulty?: string;
  laneStyle?: string;
  laneSummary?: {
    goal?: AiAnalysisRichText;
    detail?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LaneMatchupAnalysisState {
  status: AiAnalysisStatus;
  requestKey: string | null;
  request: LaneMatchupAnalysisContext | null;
  response: AiAnalysisResponse | null;
  error: string | null;
  updatedAt: string | null;
}

export interface GameflowParticipant {
  championId?: number;
  selectedPosition?: string;
  puuid?: string;
  playerPuuid?: string;
  [key: string]: unknown;
}

export interface GameflowSession {
  phase?: GameflowPhase;
  gameId?: number | string | null;
  gameData?: {
    gameId?: number | string | null;
    mapId?: number;
    gameMode?: string;
    queueId?: number;
    queue?: Record<string, unknown>;
    playerChampionSelections?: GameflowParticipant[];
    teamOne?: GameflowParticipant[];
    teamTwo?: GameflowParticipant[];
    [key: string]: unknown;
  };
  queue?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LcuJsonApiEvent {
  uri: string;
  eventType?: string;
  data: unknown;
  [key: string]: unknown;
}

export interface AppState {
  settings: PublicSettings;
  lcuStatus: LcuStatus;
  websocketStatus: WebSocketStatus;
  gameflowPhase: GameflowPhase | null;
  summoner: Summoner | LcuErrorPayload | null;
  lobby: Lobby | LcuErrorPayload | null;
  champSelect: ChampSelectSession | LcuErrorPayload | null;
  championsById: ChampionsById;
  championPool: ChampionPool;
  matchHistoryStatus: MatchHistoryStatus;
  matchHistorySummary: MatchHistorySummary | null;
  matchHistoryChampionStats: ChampionStats[];
  matchHistoryEnemyChampionStats: EnemyChampionStats[];
  matchHistoryLaneOpponentStats: LaneOpponentStats[];
  matchHistorySelfVsLaneOpponentStats: SelfVsLaneOpponentStats[];
  gameflowSession: GameflowSession | LcuErrorPayload | null;
  laneMatchupAnalysis: LaneMatchupAnalysisState;
  lastEvent: LcuJsonApiEvent | null;
  error: string | null;
  updatedAt: string | null;
}
