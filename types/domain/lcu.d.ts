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
