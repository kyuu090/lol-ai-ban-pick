import type {
  AiAnalysisResponse,
  LaneMatchupAnalysisContext
} from '../types/domain/ai-analysis';
import type { AppState } from '../types/domain/app-state';
import type { GameflowSession, LcuErrorPayload, Summoner } from '../types/domain/lcu';

const {
  createLaneMatchupAnalysisRequest,
  describeLaneMatchupAnalysisReadiness
} = require('../lcu-logic');
const { createLaneMatchupAnalysisState } = require('./app-state');

type Timer = ReturnType<typeof setTimeout>;
type StatePatch = Partial<AppState>;

interface LcuClientLike {
  fetchJson: (endpoint: string) => Promise<unknown>;
}

interface LaneMatchupControllerDeps {
  getState: () => AppState;
  updateState: (patch: StatePatch) => void;
  getPuuidFromSummoner: (summoner: Summoner | LcuErrorPayload | null) => string | null;
  lcuClient: LcuClientLike;
  gameflowSessionEndpoint: string;
  retryDelayMs: number;
  requestLaneMatchupAnalysis: (payload: unknown) => Promise<AiAnalysisResponse>;
  log: {
    debug: (message: string, details?: unknown) => void;
    info: (message: string, details?: unknown) => void;
    warn: (message: string, details?: unknown) => void;
  };
  serializeForLog: (error: unknown) => unknown;
}

interface LaneMatchupController {
  clearInFlight: () => void;
  clearRetry: () => void;
  refreshFromSession: (gameflowSession: unknown, reason: string) => void;
  refreshGameflowSession: (reason: string) => Promise<unknown>;
  reset: (reason?: string) => void;
}

function createLaneMatchupController({
  getState,
  updateState,
  getPuuidFromSummoner,
  lcuClient,
  gameflowSessionEndpoint,
  retryDelayMs,
  requestLaneMatchupAnalysis,
  log,
  serializeForLog
}: LaneMatchupControllerDeps): LaneMatchupController {
  let laneMatchupAnalysisRequestKey: string | null = null;
  let laneMatchupAnalysisInFlightKey: string | null = null;
  let laneMatchupAnalysisRetryTimer: Timer | null = null;

  function clearRetry(): void {
    if (!laneMatchupAnalysisRetryTimer) return;

    clearTimeout(laneMatchupAnalysisRetryTimer);
    laneMatchupAnalysisRetryTimer = null;
  }

  function clearInFlight(): void {
    laneMatchupAnalysisRequestKey = null;
    laneMatchupAnalysisInFlightKey = null;
  }

  function reset(reason = 'reset'): void {
    clearRetry();
    clearInFlight();
    updateState({
      laneMatchupAnalysis: createLaneMatchupAnalysisState(),
      gameflowSession: null
    });
    log.debug('Lane matchup analysis reset', { reason });
  }

  function scheduleRetry(reason: string): void {
    const appState = getState();
    if (laneMatchupAnalysisRetryTimer) return;
    if (appState.gameflowPhase !== 'GameStart') return;
    if (laneMatchupAnalysisInFlightKey) return;
    if (appState.laneMatchupAnalysis?.status === 'ready') return;

    laneMatchupAnalysisRetryTimer = setTimeout(async () => {
      laneMatchupAnalysisRetryTimer = null;
      if (getState().gameflowPhase !== 'GameStart') {
        log.debug('Lane matchup analysis retry skipped', {
          reason,
          gameflowPhase: getState().gameflowPhase
        });
        return;
      }
      await refreshGameflowSession('retry');
    }, retryDelayMs);

    log.debug('Lane matchup analysis retry scheduled', {
      reason,
      delayMs: retryDelayMs
    });
  }

  function refreshFromSession(gameflowSession: unknown, reason: string): void {
    const appState = getState();
    const session = gameflowSession as (GameflowSession | LcuErrorPayload | null);
    const localPuuid = getPuuidFromSummoner(appState.summoner);
    if (!session || 'error' in session) {
      log.debug('Lane matchup analysis session unavailable', {
        reason,
        error: session?.error || null
      });
      scheduleRetry(reason);
      return;
    }

    const request = createLaneMatchupAnalysisRequest({
      gameflowSession: session,
      localPuuid,
      championsById: appState.championsById,
      champSelectSession: appState.champSelect
    }) as LaneMatchupAnalysisContext | null;
    if (!request) {
      log.debug('Lane matchup analysis not ready', {
        reason,
        ...describeLaneMatchupAnalysisReadiness({
          gameflowSession: session,
          localPuuid,
          champSelectSession: appState.champSelect
        })
      });
      scheduleRetry(reason);
      return;
    }

    if (
      request.requestKey === laneMatchupAnalysisRequestKey ||
      request.requestKey === laneMatchupAnalysisInFlightKey ||
      request.requestKey === appState.laneMatchupAnalysis?.requestKey
    ) {
      log.debug('Lane matchup analysis request skipped as duplicate', {
        reason,
        gameId: request.gameId,
        lane: request.laneMatchupLane,
        localPosition: request.localPosition
      });
      return;
    }

    laneMatchupAnalysisInFlightKey = request.requestKey;
    clearRetry();
    updateState({
      laneMatchupAnalysis: createLaneMatchupAnalysisState({
        status: 'requesting',
        requestKey: request.requestKey,
        request,
        updatedAt: new Date().toISOString()
      })
    });

    log.info('Lane matchup analysis request started', {
      reason,
      gameId: request.gameId,
      lane: request.laneMatchupLane,
      localPosition: request.localPosition,
      payload: request.payload
    });

    requestLaneMatchupAnalysis(request.payload)
      .then((response) => {
        if (laneMatchupAnalysisInFlightKey !== request.requestKey) return;

        laneMatchupAnalysisRequestKey = request.requestKey;
        laneMatchupAnalysisInFlightKey = null;
        updateState({
          laneMatchupAnalysis: createLaneMatchupAnalysisState({
            status: 'ready',
            requestKey: request.requestKey,
            request,
            response,
            updatedAt: new Date().toISOString()
          })
        });
        log.info('Lane matchup analysis response received', {
          gameId: request.gameId,
          lane: request.laneMatchupLane
        });
      })
      .catch((error) => {
        if (laneMatchupAnalysisInFlightKey !== request.requestKey) return;

        laneMatchupAnalysisRequestKey = request.requestKey;
        laneMatchupAnalysisInFlightKey = null;
        updateState({
          laneMatchupAnalysis: createLaneMatchupAnalysisState({
            status: 'error',
            requestKey: request.requestKey,
            request,
            error: createLaneMatchupAnalysisErrorMessage(error),
            updatedAt: new Date().toISOString()
          })
        });
        log.warn('Lane matchup analysis request failed', {
          gameId: request.gameId,
          lane: request.laneMatchupLane,
          error: serializeForLog(error)
        });
      });
  }

  async function refreshGameflowSession(reason: string): Promise<unknown> {
    if (!['GameStart', 'InProgress'].includes(getState().gameflowPhase ?? '')) return null;

    try {
      const gameflowSession = await lcuClient.fetchJson(gameflowSessionEndpoint);
      updateState({ gameflowSession: gameflowSession as GameflowSession | LcuErrorPayload | null });
      refreshFromSession(gameflowSession, reason);
      return gameflowSession;
    } catch (error) {
      log.warn('Failed to refresh gameflow session for lane matchup', {
        reason,
        error: serializeForLog(error)
      });
      scheduleRetry(reason);
      return null;
    }
  }

  return {
    clearInFlight,
    clearRetry,
    refreshFromSession,
    refreshGameflowSession,
    reset
  };
}

function createLaneMatchupAnalysisErrorMessage(error: unknown): string {
  const message = String((error as { message?: string } | null | undefined)?.message || '');
  if (message.includes('429')) return 'AI対面分析のリクエストが混み合っています。少し待ってから再度お試しください。';
  if (message.includes('400')) return 'AI対面分析に必要なチャンピオンまたはレーン情報が不足しています。';
  return 'AI対面分析を取得できませんでした。';
}

export = {
  createLaneMatchupAnalysisErrorMessage,
  createLaneMatchupController
};
