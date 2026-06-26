const { app, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');
const {
  createAuthHeader,
  createChampionsById,
  createLaneMatchupAnalysisRequest,
  describeLaneMatchupAnalysisReadiness,
  parseLockfile
} = require('./lcu-logic');
const {
  normalizeRiotPlatformRegion
} = require('./riot-api');
const {
  aggregateEnemyChampionStats,
  aggregateChampionStats,
  aggregateLaneOpponentStats,
  aggregateSelfChampionVsLaneOpponentStats,
  normalizeRiotMatches
} = require('./riot-match-history');
const {
  collectMissingMatchIds,
  createAnalysisMatchIds
} = require('./match-history-workflow');
const { configureLogger, log, logRendererMessage, serializeForLog } = require('./logger');
const {
  createDefaultSettings,
  createPublicSettings,
  loadSettings: loadSettingsFromStore,
  normalizeThemeMode,
  saveSettings: saveSettingsToStore
} = require('./main/settings-store');
const {
  loadChampionPool: loadChampionPoolFromStore,
  saveChampionPool: saveChampionPoolToStore
} = require('./main/champion-pool-store');
const { createDefaultChampionPool } = require('./draft-logic');
const {
  getMatchHistoryPath: getMatchHistoryStorePath,
  getRiotMatchCachePath: getRiotMatchCacheStorePath,
  readJsonFile,
  writeJsonFile
} = require('./main/match-history-store');
const {
  applyStatePatch,
  createInitialState: createAppInitialState,
  createLaneMatchupAnalysisState,
  createMatchHistoryStatus: createBaseMatchHistoryStatus,
  createMatchHistorySummary
} = require('./main/app-state');
const {
  closeWindow,
  createMainWindow,
  hasOpenWindows,
  minimizeWindow,
  toggleMaximizeWindow
} = require('./main/window');
const { registerIpcHandlers } = require('./main/ipc-handlers');
const {
  requestFinalCompositionAnalysis,
  requestLaneMatchupAnalysis,
  requestPickPhaseAnalysis
} = require('./main/ai-analysis-service');
const { createRiotMatchHistoryService } = require('./main/riot-match-history-service');

const LCU_ENDPOINTS = {
  lobby: '/lol-lobby/v2/lobby',
  champSelect: '/lol-champ-select/v1/session',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase',
  gameflowSession: '/lol-gameflow/v1/session',
  championSummary: '/lol-game-data/assets/v1/champion-summary.json'
};
const LOCKFILE_RETRY_MS = 5000;
const WEBSOCKET_RECONNECT_MS = 3000;
const RIOT_MATCHES_PER_RUN = 90;
const RIOT_MATCH_IDS_PAGE_SIZE = 100;
const RIOT_MATCH_DETAIL_CONCURRENCY = 5;
const RIOT_MATCH_DETAIL_BATCH_DELAY_MS = 350;
const RIOT_SEASON_MATCH_DETAIL_CONCURRENCY = RIOT_MATCH_DETAIL_CONCURRENCY;
const RIOT_SEASON_MATCH_DETAIL_BATCH_DELAY_MS = 0;
const RIOT_ESTIMATED_REQUESTS_PER_TWO_MINUTES = 100;
const AUTO_MATCH_HISTORY_STARTUP_DELAY_MS = 2000;
const AUTO_MATCH_HISTORY_GAME_END_DELAY_MS = 20000;
const LANE_MATCHUP_RETRY_DELAY_MS = 3000;
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');
const APP_USER_MODEL_ID = 'com.banpick.ai';
const APP_USER_DATA_DIR_NAME = 'banpick-ai';
const RIOT_MATCH_DATA_SERVICE_HELP_MESSAGE = '試合データ取得サービスへの接続を確認してください。';
let mainWindow;
let lcuConnection = null;
let webSocket = null;
let reconnectTimer = null;
let retryTimer = null;
let settings = createDefaultSettings();
let championPool = createDefaultChampionPool();
let matchHistoryChampionStats = [];
let matchHistoryEnemyChampionStats = [];
let matchHistoryLaneOpponentStats = [];
let matchHistorySelfVsLaneOpponentStats = [];
let appState = createInitialState();
let championIconUnavailableUntil = 0;
let championIconUnavailableLogged = false;
let matchHistoryInProgress = false;
let startupMatchHistoryScheduled = false;
let autoMatchHistoryTimer = null;
let activeMatchHistoryPuuid = null;
let riotRateLimitCountdownTimer = null;
let laneMatchupAnalysisRequestKey = null;
let laneMatchupAnalysisInFlightKey = null;
let laneMatchupAnalysisRetryTimer = null;

const riotMatchHistoryService = createRiotMatchHistoryService({
  matchIdsPageSize: RIOT_MATCH_IDS_PAGE_SIZE,
  updateMatchHistoryStatus,
  clearRiotRateLimitCountdown
});

configureAppUserDataPath();
configureLogger();

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

function configureAppUserDataPath() {
  const userDataPath = path.join(app.getPath('appData'), APP_USER_DATA_DIR_NAME);
  app.setPath('userData', userDataPath);
}

function createInitialState() {
  return createAppInitialState({
    settings: createPublicSettings(settings),
    championPool,
    matchHistoryStatus: createMatchHistoryStatus(),
    matchHistoryChampionStats,
    matchHistoryEnemyChampionStats,
    matchHistoryLaneOpponentStats,
    matchHistorySelfVsLaneOpponentStats
  });
}

function createMatchHistoryStatus(patch = {}) {
  return createBaseMatchHistoryStatus({
    defaultRequestedMatches: RIOT_MATCHES_PER_RUN,
    patch
  });
}

function getRiotMatchCachePath(puuid) {
  return getRiotMatchCacheStorePath(app.getPath('userData'), puuid);
}

function getMatchHistoryPath(puuid) {
  return getMatchHistoryStorePath(app.getPath('userData'), puuid);
}

function getPuuidFromSummoner(summoner) {
  const puuid = summoner && !summoner.error ? String(summoner.puuid || '').trim() : '';
  return puuid || null;
}

async function loadSettings() {
  settings = await loadSettingsFromStore({ userDataPath: app.getPath('userData'), log });
  updateState({ settings: createPublicSettings(settings) });
  return createPublicSettings(settings);
}

async function loadChampionPool() {
  championPool = await loadChampionPoolFromStore({ userDataPath: app.getPath('userData'), log });
  updateState({ championPool });
  return championPool;
}

function resetMatchHistoryData({ puuid = null, reason = 'reset' } = {}) {
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
      ...appState.matchHistoryStatus,
      phase: 'idle',
      message: '',
      error: null
    })
  });
  log.debug('Match history reset', { puuid, reason });
}

async function loadMatchHistoryForPuuid(puuid) {
  if (!puuid) {
    resetMatchHistoryData({ reason: 'no-puuid' });
    return null;
  }

  if (activeMatchHistoryPuuid === puuid && appState.matchHistorySummary) {
    return appState.matchHistorySummary;
  }

  activeMatchHistoryPuuid = puuid;
  const historyPath = getMatchHistoryPath(puuid);
  const history = await readJsonFile(historyPath, null);

  if (!history || history.source !== 'riot-api' || history.puuid !== puuid) {
    resetMatchHistoryData({ puuid, reason: 'missing-or-invalid-account-history' });
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
      ...appState.matchHistoryStatus,
      phase: 'idle',
      message: '',
      error: null
    })
  });
  log.debug('Account match history loaded', { path: historyPath, puuid, summary });
  return history;
}

async function syncMatchHistoryForSummoner(summoner, reason) {
  const puuid = getPuuidFromSummoner(summoner);
  if (!puuid) {
    resetMatchHistoryData({ reason });
    return null;
  }

  return loadMatchHistoryForPuuid(puuid);
}

async function saveChampionPool(_event, nextChampionPool) {
  championPool = await saveChampionPoolToStore({
    userDataPath: app.getPath('userData'),
    nextChampionPool,
    log
  });
  updateState({ championPool });
  return championPool;
}

async function saveSettings(nextSettings) {
  settings = await saveSettingsToStore({
    userDataPath: app.getPath('userData'),
    currentSettings: settings,
    nextSettings,
    log
  });
  updateState({ settings: createPublicSettings(settings) });
  return settings;
}

function createWindow() {
  mainWindow = createMainWindow({
    iconPath: APP_ICON_PATH,
    preloadPath: path.join(__dirname, 'preload.js'),
    log
  });
}

function sendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('lcu:state', appState);
}

function updateState(patch) {
  appState = applyStatePatch(appState, patch);
  sendState();
}

function updateMatchHistoryStatus(patch) {
  updateState({
    matchHistoryStatus: createMatchHistoryStatus({
      ...appState.matchHistoryStatus,
      ...patch,
      updatedAt: new Date().toISOString()
    })
  });
}

function getRiotIdFromSummoner(summoner) {
  if (!summoner || summoner.error) {
    throw new Error('Riot IDを取得するにはLoLクライアントへログインしてください');
  }

  const rawGameName = summoner.gameName || summoner.riotIdGameName || '';
  const rawTagLine = summoner.tagLine || summoner.riotIdTagline || summoner.riotIdTagLine || '';
  if (rawGameName && rawTagLine) {
    return { gameName: rawGameName, tagLine: rawTagLine };
  }

  const displayName = summoner.displayName || summoner.name || '';
  if (displayName.includes('#')) {
    const [gameName, tagLine] = displayName.split('#');
    if (gameName && tagLine) return { gameName, tagLine };
  }

  throw new Error('LCU current summonerからRiot IDとTaglineを取得できませんでした');
}

function clearRiotRateLimitCountdown() {
  if (riotRateLimitCountdownTimer) {
    clearInterval(riotRateLimitCountdownTimer);
    riotRateLimitCountdownTimer = null;
  }
}

function formatRiotRateLimitMessage(nextRetryAtMs) {
  const seconds = Math.max(0, Math.ceil((nextRetryAtMs - Date.now()) / 1000));
  return `RiotAPIのRateLimitを待機中... (次回取得まで${seconds}秒)`;
}

function createRiotRetryHandler({ onRateLimitStart = null } = {}) {
  return async ({ attempt, delayMs }) => {
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
}) {
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

  const loggedInPuuid = getPuuidFromSummoner(appState.summoner);
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

function isInBlockingGamePhase(phase) {
  return ['ChampSelect', 'GameStart', 'InProgress'].includes(phase);
}

function canAutoCollectRiotMatchHistory() {
  if (matchHistoryInProgress) return false;
  if (isInBlockingGamePhase(appState.gameflowPhase)) return false;
  if (!getPuuidFromSummoner(appState.summoner)) return false;

  try {
    getRiotIdFromSummoner(appState.summoner);
    return true;
  } catch {
    return false;
  }
}

function scheduleAutoRiotMatchHistory(reason, delayMs) {
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
        lcuStatus: appState.lcuStatus,
        gameflowPhase: appState.gameflowPhase,
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

function scheduleStartupRiotMatchHistoryIfReady(reason) {
  if (startupMatchHistoryScheduled || !canAutoCollectRiotMatchHistory()) return;

  startupMatchHistoryScheduled = true;
  scheduleAutoRiotMatchHistory(reason, AUTO_MATCH_HISTORY_STARTUP_DELAY_MS);
}

function resetLaneMatchupAnalysis(reason = 'reset') {
  clearLaneMatchupAnalysisRetry();
  laneMatchupAnalysisRequestKey = null;
  laneMatchupAnalysisInFlightKey = null;
  updateState({
    laneMatchupAnalysis: createLaneMatchupAnalysisState(),
    gameflowSession: null
  });
  log.debug('Lane matchup analysis reset', { reason });
}

function clearLaneMatchupAnalysisRetry() {
  if (!laneMatchupAnalysisRetryTimer) return;

  clearTimeout(laneMatchupAnalysisRetryTimer);
  laneMatchupAnalysisRetryTimer = null;
}

function scheduleLaneMatchupAnalysisRetry(reason) {
  if (laneMatchupAnalysisRetryTimer) return;
  if (appState.gameflowPhase !== 'GameStart') return;
  if (laneMatchupAnalysisInFlightKey) return;
  if (appState.laneMatchupAnalysis?.status === 'ready') return;

  laneMatchupAnalysisRetryTimer = setTimeout(async () => {
    laneMatchupAnalysisRetryTimer = null;
    if (appState.gameflowPhase !== 'GameStart') {
      log.debug('Lane matchup analysis retry skipped', {
        reason,
        gameflowPhase: appState.gameflowPhase
      });
      return;
    }
    await refreshGameflowSessionForLaneMatchup('retry');
  }, LANE_MATCHUP_RETRY_DELAY_MS);

  log.debug('Lane matchup analysis retry scheduled', {
    reason,
    delayMs: LANE_MATCHUP_RETRY_DELAY_MS
  });
}

function refreshLaneMatchupAnalysisFromSession(gameflowSession, reason) {
  const localPuuid = getPuuidFromSummoner(appState.summoner);
  if (!gameflowSession || gameflowSession.error) {
    log.debug('Lane matchup analysis session unavailable', {
      reason,
      error: gameflowSession?.error || null
    });
    scheduleLaneMatchupAnalysisRetry(reason);
    return;
  }

  const request = createLaneMatchupAnalysisRequest({
    gameflowSession,
    localPuuid,
    championsById: appState.championsById,
    champSelectSession: appState.champSelect
  });
  if (!request) {
    log.debug('Lane matchup analysis not ready', {
      reason,
      ...describeLaneMatchupAnalysisReadiness({
        gameflowSession,
        localPuuid,
        champSelectSession: appState.champSelect
      })
    });
    scheduleLaneMatchupAnalysisRetry(reason);
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
  clearLaneMatchupAnalysisRetry();
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

function createLaneMatchupAnalysisErrorMessage(error) {
  const message = String(error?.message || '');
  if (message.includes('429')) return 'AI対面分析のリクエストが混み合っています。少し待ってから再度お試しください。';
  if (message.includes('400')) return 'AI対面分析に必要なチャンピオンまたはレーン情報が不足しています。';
  return 'AI対面分析を取得できませんでした。';
}

async function refreshGameflowSessionForLaneMatchup(reason) {
  if (!['GameStart', 'InProgress'].includes(appState.gameflowPhase)) return null;

  try {
    const gameflowSession = await lcuFetch(LCU_ENDPOINTS.gameflowSession);
    updateState({ gameflowSession });
    refreshLaneMatchupAnalysisFromSession(gameflowSession, reason);
    return gameflowSession;
  } catch (error) {
    log.warn('Failed to refresh gameflow session for lane matchup', {
      reason,
      error: serializeForLog(error)
    });
    scheduleLaneMatchupAnalysisRetry(reason);
    return null;
  }
}

function estimateSeasonCollectionMinutes(detailRequestCount) {
  const requests = Math.max(0, Number(detailRequestCount) || 0);
  if (requests <= 0) return 0;

  return Math.max(1, Math.ceil((requests / RIOT_ESTIMATED_REQUESTS_PER_TWO_MINUTES) * 2));
}

async function confirmSeasonMatchHistoryCollection({ totalMatches, missingMatches }) {
  const estimateMinutes = estimateSeasonCollectionMinutes(missingMatches);
  const estimateText = estimateMinutes > 0 ? `${estimateMinutes}分程度` : '1分未満';
  const result = await dialog.showMessageBox(mainWindow, {
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

async function collectRiotMatchHistory(_event, options = {}) {
  if (matchHistoryInProgress) {
    throw new Error('試合データを取得中です');
  }

  matchHistoryInProgress = true;
  const mode = options.mode === 'season' ? 'season' : 'recent';
  const requestedMatches = mode === 'season' ? 0 : Number(options.count) || RIOT_MATCHES_PER_RUN;
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
    const currentSummonerPuuid = getPuuidFromSummoner(appState.summoner);
    if (!currentSummonerPuuid) {
      throw new Error('試合データを取得するにはLoLクライアントへログインしてください');
    }

    const riotId = getRiotIdFromSummoner(appState.summoner);
    const region = normalizeRiotPlatformRegion(settings.riotPlatformRegion);
    const onRetry = createRiotRetryHandler();
    const storagePuuid = currentSummonerPuuid;
    await riotMatchHistoryService.requestBffHealth({
      onRetry
    });

    const account = await riotMatchHistoryService.requestBffAccountByRiotId({
      region,
      riotId,
      onRetry
    });

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
    const cachePath = getRiotMatchCachePath(storagePuuid);
    const historyPath = getMatchHistoryPath(storagePuuid);
    const cache = await readJsonFile(cachePath, {
      version: 1,
      source: 'riot-api',
      updatedAt: null,
      matchesById: {}
    });
    const matchesById = cache.matchesById && typeof cache.matchesById === 'object' ? cache.matchesById : {};
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
    const detailConcurrency = mode === 'season' ? RIOT_SEASON_MATCH_DETAIL_CONCURRENCY : RIOT_MATCH_DETAIL_CONCURRENCY;
    const detailBatchDelayMs = mode === 'season' ? RIOT_SEASON_MATCH_DETAIL_BATCH_DELAY_MS : RIOT_MATCH_DETAIL_BATCH_DELAY_MS;
    let fetchedMatches = 0;
    let failedRequests = 0;
    let snapshotPromise = Promise.resolve();
    const publishCurrentSnapshot = ({ swallowErrors = false } = {}) => {
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

    const snapshot = await publishCurrentSnapshot();
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
    const message = RIOT_MATCH_DATA_SERVICE_HELP_MESSAGE;
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

async function readLockfile() {
  let raw;
  const lockfilePath = path.join(settings.lolInstallDir, 'lockfile');
  log.debug('Reading LCU lockfile', { lockfilePath });

  try {
    raw = await fs.readFile(lockfilePath, 'utf8');
  } catch (error) {
    throw new Error(`LoLクライアントが起動していないか、ログインしていません: ${lockfilePath}`);
  }

  const { processName, pid, port, password, protocol } = parseLockfile(raw);

  log.debug('LCU lockfile parsed', { processName, pid, port, protocol });
  return { processName, pid, port, password, protocol };
}

async function chooseLolInstallDir() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'League of Legends のインストールディレクトリを選択',
    defaultPath: settings.lolInstallDir,
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return createPublicSettings(settings);
  }

  await saveSettings({ lolInstallDir: result.filePaths[0] });
  await reconnectWithCurrentSettings();
  return createPublicSettings(settings);
}

async function updateLolInstallDir(_event, lolInstallDir) {
  if (!lolInstallDir || typeof lolInstallDir !== 'string') {
    throw new Error('LoLインストールディレクトリが空です');
  }

  await saveSettings({ lolInstallDir });
  await reconnectWithCurrentSettings();
  return createPublicSettings(settings);
}

async function updateRiotPlatformRegion(_event, riotPlatformRegion) {
  await saveSettings({ riotPlatformRegion: normalizeRiotPlatformRegion(riotPlatformRegion) });
  scheduleStartupRiotMatchHistoryIfReady('riot-region-saved');
  return createPublicSettings(settings);
}

async function updateThemeMode(_event, themeMode) {
  await saveSettings({ themeMode: normalizeThemeMode(themeMode) });
  return createPublicSettings(settings);
}

async function reconnectWithCurrentSettings() {
  log.debug('Reconnecting with current settings');
  closeWebSocket();
  lcuConnection = null;
  await refreshLcuState();
}

async function lcuFetch(endpoint) {
  if (!lcuConnection) {
    throw new Error('LCU接続情報がありません');
  }

  const startedAt = Date.now();
  const url = `${lcuConnection.protocol}://127.0.0.1:${lcuConnection.port}${endpoint}`;
  log.debug('LCU request started', { endpoint, port: lcuConnection.port });
  const response = await requestLcuJson(url, {
    Authorization: createAuthHeader(lcuConnection.password),
    Accept: 'application/json'
  });
  log.debug('LCU request finished', {
    endpoint,
    statusCode: response.statusCode,
    durationMs: Date.now() - startedAt
  });

  if (response.statusCode === 404) return null;

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${endpoint} returned HTTP ${response.statusCode}: ${response.body}`);
  }

  return response.body ? JSON.parse(response.body) : null;
}

async function lcuFetchBuffer(endpoint) {
  if (!lcuConnection) {
    throw new Error('LCU謗･邯壽ュ蝣ｱ縺後≠繧翫∪縺帙ｓ');
  }

  const startedAt = Date.now();
  const url = `${lcuConnection.protocol}://127.0.0.1:${lcuConnection.port}${endpoint}`;
  const response = await requestLcu(url, {
    Authorization: createAuthHeader(lcuConnection.password),
    Accept: '*/*'
  });
  log.debug('LCU asset request finished', {
    endpoint,
    statusCode: response.statusCode,
    durationMs: Date.now() - startedAt
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${endpoint} returned HTTP ${response.statusCode}`);
  }

  return response.body;
}

function requestLcuJson(url, headers) {
  return requestLcu(url, headers).then((response) => ({
    ...response,
    body: response.body.toString('utf8')
  }));
}

function requestLcu(url, headers) {
  const client = url.startsWith('https:') ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'GET',
        headers,
        // LCU uses a self-signed certificate. Keep this scoped to local LCU requests.
        rejectUnauthorized: false,
        timeout: 5000
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks)
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`LCU request timed out: ${url}`));
    });

    request.on('error', reject);
    request.end();
  });
}

async function getChampionIcon(_event, championId) {
  const id = Number(championId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!lcuConnection || appState.lcuStatus !== 'connected') return null;
  if (Date.now() < championIconUnavailableUntil) return null;

  try {
    const buffer = await lcuFetchBuffer(`/lol-game-data/assets/v1/champion-icons/${id}.png`);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    if (isTransientIconFetchError(error)) {
      championIconUnavailableUntil = Date.now() + 10000;

      if (!championIconUnavailableLogged) {
        championIconUnavailableLogged = true;
        log.warn(`Champion icon fetch is temporarily unavailable; suppressing repeated icon errors. First failed championId=${id}`, serializeForLog(error));
      }
    } else {
      log.warn(`Failed to fetch champion icon for championId=${id}`, serializeForLog(error));
    }

    return null;
  }
}

function isTransientIconFetchError(error) {
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE'
  ].includes(error?.code) || String(error?.message || '').includes('LCU request timed out');
}

async function refreshLcuState() {
  log.debug('Refreshing LCU state');
  try {
    lcuConnection = await readLockfile();
    clearRetryTimer();
    championIconUnavailableUntil = 0;
    championIconUnavailableLogged = false;
    updateState({ lcuStatus: 'connecting', error: null });

    const [lobby, champSelect, summoner, gameflowPhase, gameflowSession, championSummary] = await Promise.all([
      lcuFetch(LCU_ENDPOINTS.lobby).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.champSelect).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.summoner).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.gameflowPhase).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.gameflowSession).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.championSummary).catch(() => [])
    ]);

    if (summoner?.error && gameflowPhase?.error) {
      throw new Error(`LCU API request failed: ${summoner.error}`);
    }

    const championsById = createChampionsById(championSummary);
    log.debug('LCU state refreshed', {
      hasLobby: Boolean(lobby && !lobby.error),
      hasChampSelect: Boolean(champSelect && !champSelect.error),
      hasSummoner: Boolean(summoner && !summoner.error),
      gameflowPhase,
      hasGameflowSession: Boolean(gameflowSession && !gameflowSession.error),
      championCount: Object.keys(championsById).length
    });

    updateState({
      lobby,
      champSelect,
      summoner,
      gameflowPhase,
      gameflowSession,
      championsById,
      lcuStatus: 'connected',
      error: null
    });
    await syncMatchHistoryForSummoner(summoner, 'lcu-refresh');
    refreshLaneMatchupAnalysisFromSession(gameflowSession, 'lcu-refresh');

    connectWebSocket();
    scheduleStartupRiotMatchHistoryIfReady('startup');
    return appState;
  } catch (error) {
    log.warn('Failed to refresh LCU state', serializeForLog(error));
    closeWebSocket();
    lcuConnection = null;
    laneMatchupAnalysisRequestKey = null;
    laneMatchupAnalysisInFlightKey = null;
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
      error: error.message
    });
    resetMatchHistoryData({ reason: 'lcu-disconnected' });
    scheduleRetry();
    return appState;
  }
}

function cleanupWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (autoMatchHistoryTimer) {
    clearTimeout(autoMatchHistoryTimer);
    autoMatchHistoryTimer = null;
  }

  clearRetryTimer();
  clearRiotRateLimitCountdown();

  closeWebSocket();
}

function closeWebSocket() {
  if (webSocket) {
    log.debug('Closing LCU WebSocket');
    webSocket.removeAllListeners();
    webSocket.close();
    webSocket = null;
  }
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  log.debug('Scheduling lockfile retry', { delayMs: LOCKFILE_RETRY_MS });

  retryTimer = setTimeout(async () => {
    retryTimer = null;
    await refreshLcuState();
  }, LOCKFILE_RETRY_MS);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  log.debug('Scheduling WebSocket reconnect', { delayMs: WEBSOCKET_RECONNECT_MS });

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await refreshLcuState();
  }, WEBSOCKET_RECONNECT_MS);
}

function connectWebSocket() {
  if (!lcuConnection || webSocket?.readyState === WebSocket.OPEN) return;

  if (webSocket) {
    webSocket.removeAllListeners();
    webSocket.close();
  }

  const wsUrl = `wss://riot:${encodeURIComponent(lcuConnection.password)}@127.0.0.1:${lcuConnection.port}/`;
  log.debug('Connecting LCU WebSocket', { port: lcuConnection.port });

  webSocket = new WebSocket(wsUrl, 'wamp', {
    rejectUnauthorized: false
  });

  updateState({ websocketStatus: 'connecting' });

  webSocket.on('open', () => {
    log.debug('LCU WebSocket connected');
    updateState({ websocketStatus: 'connected', error: null });

    // WAMP subscribe format used by the League Client Update WebSocket.
    webSocket.send(JSON.stringify([5, 'OnJsonApiEvent']));
  });

  webSocket.on('message', async (data) => {
    const raw = data.toString();
    let event;

    try {
      event = JSON.parse(raw);
    } catch {
      event = raw;
    }

    updateState({ lastEvent: event });

    if (Array.isArray(event) && event[2]?.uri) {
      log.debug('LCU WebSocket event received', {
        uri: event[2].uri,
        eventType: event[2].eventType
      });
      await applyWebSocketEvent(event[2]);
    }
  });

  webSocket.on('close', () => {
    log.debug('LCU WebSocket closed');
    lcuConnection = null;
    updateState({
      lcuStatus: 'disconnected',
      websocketStatus: 'disconnected'
    });
    scheduleReconnect();
  });

  webSocket.on('error', (error) => {
    log.warn('LCU WebSocket error', serializeForLog(error));
    updateState({
      websocketStatus: 'error',
      error: `WebSocket error: ${error.message}`
    });
  });
}

async function applyWebSocketEvent(event) {
  const { uri, data } = event;
  log.debug('Applying LCU WebSocket event', { uri });

  if (uri === LCU_ENDPOINTS.lobby) {
    updateState({ lobby: data });
  } else if (uri === LCU_ENDPOINTS.champSelect) {
    updateState({ champSelect: data });
  } else if (uri === LCU_ENDPOINTS.summoner) {
    updateState({ summoner: data });
    await syncMatchHistoryForSummoner(data, 'summoner-event');
    scheduleStartupRiotMatchHistoryIfReady('summoner-login');
  } else if (uri === LCU_ENDPOINTS.gameflowPhase) {
    const previousPhase = appState.gameflowPhase;
    updateState({
      gameflowPhase: data,
      champSelect: data === 'ChampSelect' ? appState.champSelect : null
    });

    if (['GameStart', 'InProgress'].includes(data)) {
      await refreshGameflowSessionForLaneMatchup('gameflow-phase');
    } else {
      resetLaneMatchupAnalysis('gameflow-phase-left-game');
    }

    if (['GameStart', 'InProgress'].includes(previousPhase) && !['GameStart', 'InProgress'].includes(data)) {
      scheduleAutoRiotMatchHistory('game-end', AUTO_MATCH_HISTORY_GAME_END_DELAY_MS);
    }
  } else if (uri === LCU_ENDPOINTS.gameflowSession) {
    updateState({ gameflowSession: data });
    refreshLaneMatchupAnalysisFromSession(data, 'gameflow-session-event');
  }
}

app.whenReady().then(async () => {
  log.info('App ready');
  await loadSettings();
  await loadChampionPool();

  registerIpcHandlers({
    ipcMain,
    logRendererMessage,
    handlers: {
      getState: () => appState,
      refreshLcuState,
      getChampionIcon,
      getChampionPool: () => championPool,
      saveChampionPool,
      getSettings: () => createPublicSettings(settings),
      chooseLolInstallDir,
      updateLolInstallDir,
      updateRiotPlatformRegion,
      updateThemeMode,
      minimizeWindow,
      toggleMaximizeWindow,
      closeWindow,
      collectRiotMatchHistory,
      requestPickPhaseAnalysis,
      requestFinalCompositionAnalysis
    }
  });

  createWindow();
  await refreshLcuState();

  app.on('activate', () => {
    if (!hasOpenWindows()) {
      createWindow();
      sendState();
    }
  });
});

app.on('window-all-closed', () => {
  cleanupWebSocket();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
