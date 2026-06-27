import type { AppState } from '../types/domain/app-state';
import type { Summoner, LcuErrorPayload } from '../types/domain/lcu';
import type {
  ChampionStats,
  EnemyChampionStats,
  LaneOpponentStats,
  MatchHistoryMode,
  MatchHistoryStatus,
  MatchHistorySummary,
  SelfVsLaneOpponentStats
} from '../types/domain/match-history';
import type { RiotPlatformRegion } from '../types/domain/settings';

const { normalizeRiotPlatformRegion } = require('../riot-api');
const {
  aggregateEnemyChampionStats,
  aggregateChampionStats,
  aggregateLaneOpponentStats,
  aggregateSelfChampionVsLaneOpponentStats,
  normalizeRiotMatches
} = require('../riot-match-history');
const {
  collectMissingMatchIds,
  createAnalysisMatchIds
} = require('../match-history-workflow');
const {
  createMatchHistorySummary
} = require('./app-state');

type Timer = ReturnType<typeof setTimeout>;
type RiotId = { gameName: string; tagLine: string };
type MatchId = string | number;
type MatchMap = Record<string, unknown>;
type SettingsLike = { riotPlatformRegion: RiotPlatformRegion | string };

interface PublishedMatchHistorySnapshot {
  summary: MatchHistorySummary;
  normalizedMatches: unknown[];
  championStats: ChampionStats[];
  enemyChampionStats: EnemyChampionStats[];
  laneOpponentStats: LaneOpponentStats[];
  selfVsLaneOpponentStats: SelfVsLaneOpponentStats[];
  loggedInPuuid: string | null;
  updatedAt: string;
}

interface DialogLike {
  showMessageBox: (window: unknown, options: unknown) => Promise<{ response: number }>;
}

interface MatchHistoryPaths {
  getMatchHistoryPath: (puuid: string) => string;
  getRiotMatchCachePath: (puuid: string) => string;
}

interface RiotMatchHistoryServiceLike {
  collectBffMatchDetailsBatch: (options: unknown) => Promise<{ fetchedMatches: number; failedMatchIds: MatchId[] }>;
  collectMatchIdsByMode: (options: unknown) => Promise<MatchId[]>;
  requestBffAccountByRiotId: (options: unknown) => Promise<unknown>;
  requestBffHealth: (options?: unknown) => Promise<unknown>;
}

interface MatchHistoryControllerDeps {
  dialog: DialogLike;
  getMainWindow: () => unknown;
  getSettings: () => SettingsLike;
  getState: () => AppState;
  updateState: (patch: Partial<AppState>) => void;
  createMatchHistoryStatus: (patch?: Partial<MatchHistoryStatus>) => MatchHistoryStatus;
  getPuuidFromSummoner: (summoner: Summoner | LcuErrorPayload | null) => string | null;
  getRiotIdFromSummoner: (summoner: Summoner | LcuErrorPayload | null) => RiotId;
  paths: MatchHistoryPaths;
  readJsonFile: (path: string, fallback: unknown) => Promise<unknown>;
  writeJsonFile: (path: string, value: unknown) => Promise<void>;
  riotMatchHistoryService: RiotMatchHistoryServiceLike;
  constants: {
    autoGameEndDelayMs: number;
    autoStartupDelayMs: number;
    defaultRequestedMatches: number;
    detailBatchDelayMs: number;
    detailConcurrency: number;
    estimatedRequestsPerTwoMinutes: number;
    seasonDetailBatchDelayMs: number;
    seasonDetailConcurrency: number;
    serviceHelpMessage: string;
  };
  log: {
    debug: (message: string, details?: unknown) => void;
    info: (message: string, details?: unknown) => void;
    warn: (message: string, details?: unknown) => void;
  };
  serializeForLog: (error: unknown) => unknown;
}

interface CollectRiotMatchHistoryOptions {
  count?: number;
  mode?: MatchHistoryMode | string;
  source?: 'auto' | 'manual' | string;
}

interface MatchHistoryController {
  cleanup: () => void;
  clearRiotRateLimitCountdown: () => void;
  collectRiotMatchHistory: (_event: unknown, options?: CollectRiotMatchHistoryOptions) => Promise<unknown>;
  isInProgress: () => boolean;
  loadForPuuid: (puuid: string | null) => Promise<unknown>;
  resetData: (options?: { puuid?: string | null; reason?: string }) => void;
  scheduleAuto: (reason: string, delayMs: number) => void;
  scheduleGameEndAuto: () => void;
  scheduleStartupIfReady: (reason: string) => void;
  syncForSummoner: (summoner: Summoner | LcuErrorPayload | null, reason: string) => Promise<unknown>;
}

function createMatchHistoryController({
  dialog,
  getMainWindow,
  getSettings,
  getState,
  updateState,
  createMatchHistoryStatus,
  getPuuidFromSummoner,
  getRiotIdFromSummoner,
  paths,
  readJsonFile,
  writeJsonFile,
  riotMatchHistoryService,
  constants,
  log,
  serializeForLog
}: MatchHistoryControllerDeps): MatchHistoryController {
  let matchHistoryChampionStats: ChampionStats[] = [];
  let matchHistoryEnemyChampionStats: EnemyChampionStats[] = [];
  let matchHistoryLaneOpponentStats: LaneOpponentStats[] = [];
  let matchHistorySelfVsLaneOpponentStats: SelfVsLaneOpponentStats[] = [];
  let matchHistoryInProgress = false;
  let startupMatchHistoryScheduled = false;
  let autoMatchHistoryTimer: Timer | null = null;
  let activeMatchHistoryPuuid: string | null = null;
  let riotRateLimitCountdownTimer: Timer | null = null;

  function updateMatchHistoryStatus(patch: Partial<MatchHistoryStatus>): void {
    updateState({
      matchHistoryStatus: createMatchHistoryStatus({
        ...getState().matchHistoryStatus,
        ...patch,
        updatedAt: new Date().toISOString()
      })
    });
  }

  function resetData({ puuid = null, reason = 'reset' }: { puuid?: string | null; reason?: string } = {}): void {
    activeMatchHistoryPuuid = puuid;
    matchHistoryChampionStats = [];
    matchHistoryEnemyChampionStats = [];
    matchHistoryLaneOpponentStats = [];
    matchHistorySelfVsLaneOpponentStats = [];
    updateState({
      matchHistoryChampionStats,
      matchHistoryEnemyChampionStats,
      matchHistoryLaneOpponentStats,
      matchHistorySelfVsLaneOpponentStats,
      matchHistorySummary: null,
      matchHistoryStatus: createMatchHistoryStatus({
        ...getState().matchHistoryStatus,
        phase: 'idle',
        message: '',
        error: null
      })
    });
    log.debug('Match history reset', { puuid, reason });
  }

  async function loadForPuuid(puuid: string | null): Promise<unknown> {
    if (!puuid) {
      resetData({ reason: 'no-puuid' });
      return null;
    }

    if (activeMatchHistoryPuuid === puuid && getState().matchHistorySummary) {
      return getState().matchHistorySummary;
    }

    activeMatchHistoryPuuid = puuid;
    const historyPath = paths.getMatchHistoryPath(puuid);
    const history = await readJsonFile(historyPath, null) as Record<string, any> | null;

    if (!history || history.source !== 'riot-api' || history.puuid !== puuid) {
      resetData({ puuid, reason: 'missing-or-invalid-account-history' });
      log.debug('Account match history file not found or invalid; using empty stats', { path: historyPath, puuid });
      return null;
    }

    const matches = Array.isArray(history.matches) ? history.matches : [];
    matchHistoryChampionStats = Array.isArray(history.championStats) ? history.championStats : [];
    matchHistoryEnemyChampionStats = Array.isArray(history.enemyChampionStats)
      ? history.enemyChampionStats
      : aggregateEnemyChampionStats(matches);
    matchHistoryLaneOpponentStats = Array.isArray(history.laneOpponentStats)
      ? history.laneOpponentStats
      : aggregateLaneOpponentStats(matches);
    matchHistorySelfVsLaneOpponentStats = Array.isArray(history.selfVsLaneOpponentStats)
      ? history.selfVsLaneOpponentStats
      : aggregateSelfChampionVsLaneOpponentStats(matches);
    const summary = createMatchHistorySummary({
      updatedAt: history.updatedAt || null,
      requestedMatches: matches.length,
      matchIds: matches.length,
      updatedMatches: 0,
      failedRequests: 0,
      championStats: matchHistoryChampionStats.length,
      matches
    });

    updateState({
      matchHistoryChampionStats,
      matchHistoryEnemyChampionStats,
      matchHistoryLaneOpponentStats,
      matchHistorySelfVsLaneOpponentStats,
      matchHistorySummary: summary,
      matchHistoryStatus: createMatchHistoryStatus({
        ...getState().matchHistoryStatus,
        phase: 'idle',
        message: '',
        error: null
      })
    });
    log.debug('Account match history loaded', { path: historyPath, puuid, summary });
    return history;
  }

  async function syncForSummoner(summoner: Summoner | LcuErrorPayload | null, reason: string): Promise<unknown> {
    const puuid = getPuuidFromSummoner(summoner);
    if (!puuid) {
      resetData({ reason });
      return null;
    }

    return loadForPuuid(puuid);
  }

  function clearRiotRateLimitCountdown(): void {
    if (riotRateLimitCountdownTimer) {
      clearInterval(riotRateLimitCountdownTimer);
      riotRateLimitCountdownTimer = null;
    }
  }

  function formatRiotRateLimitMessage(nextRetryAtMs: number): string {
    const seconds = Math.max(0, Math.ceil((nextRetryAtMs - Date.now()) / 1000));
    return `RiotAPIのRateLimitを待機中... (次回取得まで${seconds}秒)`;
  }

  function createRiotRetryHandler({ onRateLimitStart = null }: { onRateLimitStart?: (() => Promise<unknown> | unknown) | null } = {}) {
    return async ({ attempt, delayMs }: { attempt: number; delayMs: number }) => {
      const nextRetryAtMs = Date.now() + delayMs;
      clearRiotRateLimitCountdown();
      updateMatchHistoryStatus({
        phase: 'retrying',
        retryAttempt: attempt,
        nextRetryAt: new Date(nextRetryAtMs).toISOString(),
        message: formatRiotRateLimitMessage(nextRetryAtMs)
      });
      riotRateLimitCountdownTimer = setInterval(() => {
        const seconds = Math.max(0, Math.ceil((nextRetryAtMs - Date.now()) / 1000));
        updateMatchHistoryStatus({
          phase: 'retrying',
          retryAttempt: attempt,
          nextRetryAt: new Date(nextRetryAtMs).toISOString(),
          message: formatRiotRateLimitMessage(nextRetryAtMs)
        });
        if (seconds <= 0) {
          clearRiotRateLimitCountdown();
        }
      }, 1000);

      if (typeof onRateLimitStart === 'function') {
        await onRateLimitStart();
      }
    };
  }

  async function publishMatchHistorySnapshot({
    cachePath,
    historyPath,
    matchesById,
    storagePuuid,
    targetPuuid,
    riotId,
    normalizedMatchIds,
    analysisMatchIds = normalizedMatchIds,
    requestedMatches,
    mode,
    fetchedMatches,
    failedRequests,
    applyToState = true
  }: {
    cachePath: string;
    historyPath: string;
    matchesById: MatchMap;
    storagePuuid: string;
    targetPuuid: string;
    riotId: RiotId;
    normalizedMatchIds: MatchId[];
    analysisMatchIds?: MatchId[];
    requestedMatches: number;
    mode: MatchHistoryMode;
    fetchedMatches: number;
    failedRequests: number;
    applyToState?: boolean;
  }): Promise<PublishedMatchHistorySnapshot> {
    const updatedAt = new Date().toISOString();
    await writeJsonFile(cachePath, {
      version: 1,
      source: 'riot-api',
      updatedAt,
      matchesById
    });

    const normalizedMatches = normalizeRiotMatches(matchesById, targetPuuid, analysisMatchIds);
    const championStats = aggregateChampionStats(normalizedMatches);
    const enemyChampionStats = aggregateEnemyChampionStats(normalizedMatches);
    const laneOpponentStats = aggregateLaneOpponentStats(normalizedMatches);
    const selfVsLaneOpponentStats = aggregateSelfChampionVsLaneOpponentStats(normalizedMatches);
    const history = {
      version: 1,
      source: 'riot-api',
      updatedAt,
      puuid: storagePuuid,
      riotPuuid: targetPuuid,
      riotId: {
        gameName: riotId.gameName,
        tagLine: riotId.tagLine
      },
      matches: normalizedMatches,
      championStats,
      enemyChampionStats,
      laneOpponentStats,
      selfVsLaneOpponentStats
    };

    await writeJsonFile(historyPath, history);

    const summary = createMatchHistorySummary({
      updatedAt,
      requestedMatches: mode === 'season' ? normalizedMatchIds.length : requestedMatches,
      matchIds: analysisMatchIds.length,
      updatedMatches: fetchedMatches,
      failedRequests,
      championStats: championStats.length,
      matches: normalizedMatches
    });

    const loggedInPuuid = getPuuidFromSummoner(getState().summoner);
    if (applyToState && loggedInPuuid === storagePuuid) {
      activeMatchHistoryPuuid = storagePuuid;
      matchHistoryChampionStats = championStats;
      matchHistoryEnemyChampionStats = enemyChampionStats;
      matchHistoryLaneOpponentStats = laneOpponentStats;
      matchHistorySelfVsLaneOpponentStats = selfVsLaneOpponentStats;
      updateState({
        matchHistoryChampionStats,
        matchHistoryEnemyChampionStats,
        matchHistoryLaneOpponentStats,
        matchHistorySelfVsLaneOpponentStats,
        matchHistorySummary: summary
      });
    }

    return {
      summary,
      normalizedMatches,
      championStats,
      enemyChampionStats,
      laneOpponentStats,
      selfVsLaneOpponentStats,
      loggedInPuuid,
      updatedAt
    };
  }

  function isInBlockingGamePhase(phase: string | null): boolean {
    return ['ChampSelect', 'GameStart', 'InProgress'].includes(phase ?? '');
  }

  function canAutoCollectRiotMatchHistory(): boolean {
    if (matchHistoryInProgress) return false;
    if (isInBlockingGamePhase(getState().gameflowPhase)) return false;
    if (!getPuuidFromSummoner(getState().summoner)) return false;

    try {
      getRiotIdFromSummoner(getState().summoner);
      return true;
    } catch {
      return false;
    }
  }

  function scheduleAuto(reason: string, delayMs: number): void {
    if (autoMatchHistoryTimer) {
      clearTimeout(autoMatchHistoryTimer);
      autoMatchHistoryTimer = null;
    }

    log.debug('Scheduling automatic Riot match history collection', { reason, delayMs });
    autoMatchHistoryTimer = setTimeout(async () => {
      autoMatchHistoryTimer = null;

      if (!canAutoCollectRiotMatchHistory()) {
        log.debug('Automatic Riot match history collection skipped', {
          reason,
          lcuStatus: getState().lcuStatus,
          gameflowPhase: getState().gameflowPhase,
          matchHistoryInProgress
        });
        return;
      }

      try {
        await collectRiotMatchHistory(null, { source: 'auto' });
      } catch (error) {
        log.warn('Automatic Riot match history collection failed', { reason, error: serializeForLog(error) });
      }
    }, delayMs);
  }

  function scheduleStartupIfReady(reason: string): void {
    if (startupMatchHistoryScheduled || !canAutoCollectRiotMatchHistory()) return;

    startupMatchHistoryScheduled = true;
    scheduleAuto(reason, constants.autoStartupDelayMs);
  }

  function scheduleGameEndAuto(): void {
    scheduleAuto('game-end', constants.autoGameEndDelayMs);
  }

  function estimateSeasonCollectionMinutes(detailRequestCount: number): number {
    const requests = Math.max(0, Number(detailRequestCount) || 0);
    if (requests <= 0) return 0;

    return Math.max(1, Math.ceil((requests / constants.estimatedRequestsPerTwoMinutes) * 2));
  }

  async function confirmSeasonMatchHistoryCollection({ totalMatches, missingMatches }: {
    totalMatches: number;
    missingMatches: number;
  }): Promise<boolean> {
    const estimateMinutes = estimateSeasonCollectionMinutes(missingMatches);
    const estimateText = estimateMinutes > 0 ? `${estimateMinutes}分程度` : '1分未満';
    const result = await dialog.showMessageBox(getMainWindow(), {
      type: 'question',
      buttons: ['取得する', 'キャンセル'],
      defaultId: 0,
      cancelId: 1,
      title: 'シーズン中の全試合データ取得',
      message: 'シーズン中の全試合データを取得します。',
      detail: `この処理は試合数によって時間がかかるケースがあります。\nあなたの場合、${estimateText}かかります。\n\n対象試合: ${totalMatches}試合\n未取得試合: ${missingMatches}試合`
    });

    return result.response === 0;
  }

  async function collectRiotMatchHistory(
    _event: unknown,
    options: CollectRiotMatchHistoryOptions = {}
  ): Promise<unknown> {
    if (matchHistoryInProgress) {
      throw new Error('試合データを取得中です');
    }

    matchHistoryInProgress = true;
    const mode = options.mode === 'season' ? 'season' : 'recent';
    const requestedMatches = mode === 'season' ? 0 : Number(options.count) || constants.defaultRequestedMatches;
    const source = options.source === 'auto' ? 'auto' : 'manual';
    const startedAt = new Date().toISOString();

    updateMatchHistoryStatus({
      phase: 'collecting',
      source,
      mode,
      requestedMatches,
      fetchedMatches: 0,
      normalizedMatches: 0,
      updatedMatches: 0,
      failedRequests: 0,
      retryAttempt: 0,
      nextRetryAt: null,
      message: `試合データ収集中... 0/${requestedMatches} 試合`,
      error: null,
      startedAt
    });

    try {
      const currentSummonerPuuid = getPuuidFromSummoner(getState().summoner);
      if (!currentSummonerPuuid) {
        throw new Error('試合データを取得するにはLoLクライアントへログインしてください');
      }

      const riotId = getRiotIdFromSummoner(getState().summoner);
      const region = normalizeRiotPlatformRegion(getSettings().riotPlatformRegion);
      const onRetry = createRiotRetryHandler();
      const storagePuuid = currentSummonerPuuid;
      await riotMatchHistoryService.requestBffHealth({
        onRetry
      });

      const account = await riotMatchHistoryService.requestBffAccountByRiotId({
        region,
        riotId,
        onRetry
      }) as { puuid?: string } | null;

      if (!account?.puuid) {
        throw new Error('Riot APIからPUUIDを取得できませんでした');
      }
      clearRiotRateLimitCountdown();
      const targetPuuid = account.puuid;

      const normalizedMatchIds = await riotMatchHistoryService.collectMatchIdsByMode({
        region,
        puuid: targetPuuid,
        requestedMatches,
        mode,
        onRetry
      });
      const cachePath = paths.getRiotMatchCachePath(storagePuuid);
      const historyPath = paths.getMatchHistoryPath(storagePuuid);
      const cache = await readJsonFile(cachePath, {
        version: 1,
        source: 'riot-api',
        updatedAt: null,
        matchesById: {}
      }) as { matchesById?: MatchMap } | null;
      const matchesById = cache?.matchesById && typeof cache.matchesById === 'object' ? cache.matchesById : {};
      const existingHistory = await readJsonFile(historyPath, null);
      const analysisMatchIds = createAnalysisMatchIds({
        mode,
        normalizedMatchIds,
        existingHistory,
        storagePuuid
      });
      const missingMatchIds = collectMissingMatchIds(normalizedMatchIds, matchesById);
      if (mode === 'season' && source === 'manual') {
        const confirmed = await confirmSeasonMatchHistoryCollection({
          totalMatches: normalizedMatchIds.length,
          missingMatches: missingMatchIds.length
        });
        if (!confirmed) {
          updateMatchHistoryStatus({
            phase: 'idle',
            mode,
            requestedMatches: normalizedMatchIds.length,
            fetchedMatches: 0,
            normalizedMatches: 0,
            updatedMatches: 0,
            failedRequests: 0,
            retryAttempt: 0,
            nextRetryAt: null,
            message: '',
            error: null
          });
          return { canceled: true, requestedMatches: normalizedMatchIds.length, updatedMatches: 0 };
        }
      }
      const detailConcurrency = mode === 'season' ? constants.seasonDetailConcurrency : constants.detailConcurrency;
      const detailBatchDelayMs = mode === 'season' ? constants.seasonDetailBatchDelayMs : constants.detailBatchDelayMs;
      let fetchedMatches = 0;
      let failedRequests = 0;
      let snapshotPromise: Promise<PublishedMatchHistorySnapshot | null> = Promise.resolve(null);
      const publishCurrentSnapshot = ({ swallowErrors = false }: { swallowErrors?: boolean } = {}) => {
        const nextSnapshotPromise = snapshotPromise
          .catch(() => null)
          .then(() => publishMatchHistorySnapshot({
            cachePath,
            historyPath,
            matchesById,
            storagePuuid,
            targetPuuid,
            riotId,
            normalizedMatchIds,
            analysisMatchIds,
            requestedMatches,
            mode,
            fetchedMatches,
            failedRequests
          }));
        snapshotPromise = nextSnapshotPromise;
        if (!swallowErrors) return nextSnapshotPromise;

        return nextSnapshotPromise.catch((error) => {
          log.warn('Riot match history snapshot update failed', serializeForLog(error));
          return null;
        });
      };
      const detailOnRetry = createRiotRetryHandler({
        onRateLimitStart: () => publishCurrentSnapshot({ swallowErrors: true })
      });

      for (let index = 0; index < missingMatchIds.length; index += detailConcurrency) {
        const batch = missingMatchIds.slice(index, index + detailConcurrency);

        updateMatchHistoryStatus({
          phase: 'collecting',
          message: `試合データ収集中... ${fetchedMatches}/${missingMatchIds.length} 試合`
        });
        clearRiotRateLimitCountdown();

        try {
          const result = await riotMatchHistoryService.collectBffMatchDetailsBatch({
            region,
            matchIds: batch,
            matchesById,
            onRetry: detailOnRetry,
            publishCurrentSnapshot
          });
          fetchedMatches += result.fetchedMatches;
          failedRequests += result.failedMatchIds.length;
          result.failedMatchIds.forEach((matchId) => {
            log.warn(`Riot BFF match detail fetch failed for matchId=${matchId}`);
          });
        } catch (error) {
          failedRequests += batch.length;
          log.warn('Riot BFF match detail batch fetch failed', {
            matchIds: batch,
            error: serializeForLog(error)
          });
        }

        updateMatchHistoryStatus({
          phase: 'collecting',
          fetchedMatches,
          failedRequests,
          message: `試合データ収集中... ${fetchedMatches}/${missingMatchIds.length} 試合`
        });

        if (detailBatchDelayMs > 0 && index + detailConcurrency < missingMatchIds.length) {
          await new Promise((resolve) => setTimeout(resolve, detailBatchDelayMs));
        }
      }

      updateMatchHistoryStatus({
        phase: 'normalizing',
        message: '試合データを正規化しています'
      });

      const snapshot = await publishCurrentSnapshot() as PublishedMatchHistorySnapshot;
      const summary = snapshot.summary;
      const normalizedMatches = snapshot.normalizedMatches;

      const phase = failedRequests > 0 ? 'partial' : 'completed';
      if (snapshot.loggedInPuuid !== storagePuuid) {
        log.info('Riot match history collected for inactive account; skipped applying stats', {
          collectedPuuid: storagePuuid,
          loggedInPuuid: snapshot.loggedInPuuid
        });
      }
      if (snapshot.loggedInPuuid === storagePuuid) {
        updateMatchHistoryStatus({
          phase,
          mode,
          fetchedMatches,
          normalizedMatches: normalizedMatches.length,
          updatedMatches: fetchedMatches,
          failedRequests,
          retryAttempt: 0,
          nextRetryAt: null,
          message: phase === 'completed'
            ? `試合データ収集完了 ${fetchedMatches}試合を更新しました`
            : `一部の試合データを収集しました ${fetchedMatches}試合を更新 / ${failedRequests}件失敗`,
          error: null
        });
      }

      log.info('Riot match history collected', summary);
      return summary;
    } catch (error) {
      log.warn('Riot match history collection failed', serializeForLog(error));
      const message = constants.serviceHelpMessage;
      updateMatchHistoryStatus({
        phase: 'error',
        message,
        error: message
      });
      throw error;
    } finally {
      clearRiotRateLimitCountdown();
      matchHistoryInProgress = false;
    }
  }

  function cleanup(): void {
    if (autoMatchHistoryTimer) {
      clearTimeout(autoMatchHistoryTimer);
      autoMatchHistoryTimer = null;
    }

    clearRiotRateLimitCountdown();
  }

  return {
    cleanup,
    clearRiotRateLimitCountdown,
    collectRiotMatchHistory,
    isInProgress: () => matchHistoryInProgress,
    loadForPuuid,
    resetData,
    scheduleAuto,
    scheduleGameEndAuto,
    scheduleStartupIfReady,
    syncForSummoner
  };
}

export = {
  createMatchHistoryController
};
