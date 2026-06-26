import type { AppState } from '../types/domain/app-state';
import type {
  ChampSelectSession,
  GameflowPhase,
  GameflowSession,
  LcuErrorPayload,
  LcuJsonApiEvent,
  Lobby,
  Summoner
} from '../types/domain/lcu';
import type { PublicSettings } from '../types/domain/settings';

const { createChampionsById } = require('../lcu-logic');
const { createLaneMatchupAnalysisState } = require('./app-state');
const { createLcuClient } = require('./lcu-client');
const { createLcuWatch } = require('./lcu-watch');

type StatePatch = Partial<AppState>;

interface LcuConnection {
  processName?: string;
  pid?: string | number;
  port: string | number;
  password: string;
  protocol: string;
}

interface LcuClientLike {
  fetchJson: (endpoint: string) => Promise<unknown>;
  getChampionIcon: (_event: unknown, championId: unknown) => Promise<string | null>;
  readLockfile: () => Promise<LcuConnection>;
}

interface LcuWatchLike {
  cleanup: () => void;
  clearRetryTimer: () => void;
  closeWebSocket: () => void;
  connectWebSocket: () => void;
  scheduleRetry: () => void;
}

interface LaneMatchupControllerLike {
  clearInFlight: () => void;
  refreshFromSession: (gameflowSession: unknown, reason: string) => void;
  refreshGameflowSession: (reason: string) => Promise<unknown>;
  reset: (reason?: string) => void;
}

interface MatchHistoryControllerLike {
  isInProgress: () => boolean;
  resetData: (options?: { puuid?: string | null; reason?: string }) => void;
  scheduleGameEndAuto: () => void;
  scheduleStartupIfReady: (reason: string) => void;
  syncForSummoner: (summoner: Summoner | LcuErrorPayload | null, reason: string) => Promise<unknown>;
}

interface LcuControllerDeps {
  getSettings: () => PublicSettings;
  getState: () => AppState;
  updateState: (patch: StatePatch) => void;
  getLaneMatchupController: () => LaneMatchupControllerLike;
  getMatchHistoryController: () => MatchHistoryControllerLike;
  endpoints: {
    lobby: string;
    champSelect: string;
    summoner: string;
    gameflowPhase: string;
    gameflowSession: string;
    championSummary: string;
  };
  lockfileRetryMs: number;
  websocketReconnectMs: number;
  log: {
    debug: (message: string, details?: unknown) => void;
    warn: (message: string, details?: unknown) => void;
  };
  serializeForLog: (error: unknown) => unknown;
}

interface LcuController {
  cleanup: () => void;
  getClient: () => LcuClientLike;
  getConnection: () => LcuConnection | null;
  reconnectWithCurrentSettings: () => Promise<void>;
  refreshLcuState: () => Promise<AppState>;
}

function createLcuController({
  getSettings,
  getState,
  updateState,
  getLaneMatchupController,
  getMatchHistoryController,
  endpoints,
  lockfileRetryMs,
  websocketReconnectMs,
  log,
  serializeForLog
}: LcuControllerDeps): LcuController {
  let lcuConnection: LcuConnection | null = null;
  let championIconUnavailableUntil = 0;
  let championIconUnavailableLogged = false;

  const lcuClient = createLcuClient({
    getSettings,
    getConnection: () => lcuConnection,
    getStatus: () => getState().lcuStatus,
    setIconUnavailableUntil: (value: number) => {
      championIconUnavailableUntil = value;
    },
    getIconUnavailableUntil: () => championIconUnavailableUntil,
    getIconUnavailableLogged: () => championIconUnavailableLogged,
    setIconUnavailableLogged: (value: boolean) => {
      championIconUnavailableLogged = value;
    },
    log,
    serializeForLog
  }) as LcuClientLike;

  const lcuWatch = createLcuWatch({
    getConnection: () => lcuConnection,
    setConnection: (connection: LcuConnection | null) => {
      lcuConnection = connection;
    },
    updateState,
    refreshLcuState,
    applyWebSocketEvent,
    lockfileRetryMs,
    websocketReconnectMs,
    log,
    serializeForLog
  }) as LcuWatchLike;

  async function reconnectWithCurrentSettings(): Promise<void> {
    log.debug('Reconnecting with current settings');
    lcuWatch.closeWebSocket();
    lcuConnection = null;
    await refreshLcuState();
  }

  async function refreshLcuState(): Promise<AppState> {
    log.debug('Refreshing LCU state');
    try {
      lcuConnection = await lcuClient.readLockfile();
      lcuWatch.clearRetryTimer();
      championIconUnavailableUntil = 0;
      championIconUnavailableLogged = false;
      updateState({ lcuStatus: 'connecting', error: null });

      const [lobby, champSelect, summoner, gameflowPhase, gameflowSession, championSummary] = await Promise.all([
        lcuClient.fetchJson(endpoints.lobby).catch((error: Error) => ({ error: error.message })),
        lcuClient.fetchJson(endpoints.champSelect).catch((error: Error) => ({ error: error.message })),
        lcuClient.fetchJson(endpoints.summoner).catch((error: Error) => ({ error: error.message })),
        lcuClient.fetchJson(endpoints.gameflowPhase).catch((error: Error) => ({ error: error.message })),
        lcuClient.fetchJson(endpoints.gameflowSession).catch((error: Error) => ({ error: error.message })),
        lcuClient.fetchJson(endpoints.championSummary).catch(() => [])
      ]);

      if (hasError(summoner) && hasError(gameflowPhase)) {
        throw new Error(`LCU API request failed: ${summoner.error}`);
      }

      const championsById = createChampionsById(championSummary);
      log.debug('LCU state refreshed', {
        hasLobby: Boolean(lobby && !hasError(lobby)),
        hasChampSelect: Boolean(champSelect && !hasError(champSelect)),
        hasSummoner: Boolean(summoner && !hasError(summoner)),
        gameflowPhase,
        hasGameflowSession: Boolean(gameflowSession && !hasError(gameflowSession)),
        championCount: Object.keys(championsById).length
      });

      updateState({
        lobby: lobby as Lobby | LcuErrorPayload | null,
        champSelect: champSelect as ChampSelectSession | LcuErrorPayload | null,
        summoner: summoner as Summoner | LcuErrorPayload | null,
        gameflowPhase: gameflowPhase as GameflowPhase | null,
        gameflowSession: gameflowSession as GameflowSession | LcuErrorPayload | null,
        championsById,
        lcuStatus: 'connected',
        error: null
      });
      await getMatchHistoryController().syncForSummoner(summoner as Summoner | LcuErrorPayload | null, 'lcu-refresh');
      getLaneMatchupController().refreshFromSession(gameflowSession, 'lcu-refresh');

      lcuWatch.connectWebSocket();
      getMatchHistoryController().scheduleStartupIfReady('startup');
      return getState();
    } catch (error) {
      const normalizedError = error as Error;
      log.warn('Failed to refresh LCU state', serializeForLog(error));
      lcuWatch.closeWebSocket();
      lcuConnection = null;
      getLaneMatchupController().clearInFlight();
      updateState({
        lcuStatus: 'disconnected',
        websocketStatus: 'disconnected',
        gameflowPhase: null,
        gameflowSession: null,
        summoner: null,
        lobby: null,
        champSelect: null,
        championsById: {},
        laneMatchupAnalysis: createLaneMatchupAnalysisState(),
        error: normalizedError.message
      });
      getMatchHistoryController().resetData({ reason: 'lcu-disconnected' });
      lcuWatch.scheduleRetry();
      return getState();
    }
  }

  async function applyWebSocketEvent(event: LcuJsonApiEvent): Promise<void> {
    const { uri, data } = event;
    log.debug('Applying LCU WebSocket event', { uri });

    if (uri === endpoints.lobby) {
      updateState({ lobby: data as Lobby | LcuErrorPayload | null });
    } else if (uri === endpoints.champSelect) {
      updateState({ champSelect: data as ChampSelectSession | LcuErrorPayload | null });
    } else if (uri === endpoints.summoner) {
      updateState({ summoner: data as Summoner | LcuErrorPayload | null });
      await getMatchHistoryController().syncForSummoner(data as Summoner | LcuErrorPayload | null, 'summoner-event');
      getMatchHistoryController().scheduleStartupIfReady('summoner-login');
    } else if (uri === endpoints.gameflowPhase) {
      const previousPhase = getState().gameflowPhase;
      updateState({
        gameflowPhase: data as GameflowPhase | null,
        champSelect: data === 'ChampSelect' ? getState().champSelect : null
      });

      if (['GameStart', 'InProgress'].includes(String(data))) {
        await getLaneMatchupController().refreshGameflowSession('gameflow-phase');
      } else {
        getLaneMatchupController().reset('gameflow-phase-left-game');
      }

      if (
        ['GameStart', 'InProgress'].includes(previousPhase ?? '') &&
        !['GameStart', 'InProgress'].includes(String(data))
      ) {
        getMatchHistoryController().scheduleGameEndAuto();
      }
    } else if (uri === endpoints.gameflowSession) {
      updateState({ gameflowSession: data as GameflowSession | LcuErrorPayload | null });
      getLaneMatchupController().refreshFromSession(data, 'gameflow-session-event');
    }
  }

  function cleanup(): void {
    lcuWatch.cleanup();
  }

  return {
    cleanup,
    getClient: () => lcuClient,
    getConnection: () => lcuConnection,
    reconnectWithCurrentSettings,
    refreshLcuState
  };
}

function hasError(value: unknown): value is LcuErrorPayload {
  return Boolean(value) && typeof value === 'object' && typeof (value as LcuErrorPayload).error === 'string';
}

export = {
  createLcuController
};
