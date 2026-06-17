const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');
const { createAuthHeader, createChampionsById, parseLockfile } = require('./lcu-logic');
const { createDefaultChampionPool, normalizeChampionPool } = require('./draft-logic');
const {
  RIOT_PLATFORM_REGIONS,
  DEFAULT_RIOT_PLATFORM_REGION,
  createRiotApiHosts,
  normalizeRiotPlatformRegion,
  requestRiotJson
} = require('./riot-api');
const {
  aggregateChampionStats,
  normalizeRiotMatches
} = require('./riot-match-history');
const { configureLogger, log, logRendererMessage, serializeForLog } = require('./logger');

const DEFAULT_LOL_INSTALL_DIR = 'C:\\Riot Games\\League of Legends';
const LCU_ENDPOINTS = {
  lobby: '/lol-lobby/v2/lobby',
  champSelect: '/lol-champ-select/v1/session',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase',
  championSummary: '/lol-game-data/assets/v1/champion-summary.json'
};
const LOCKFILE_RETRY_MS = 5000;
const WEBSOCKET_RECONNECT_MS = 3000;
const RIOT_MATCHES_PER_RUN = 90;
const RIOT_MATCH_DETAIL_CONCURRENCY = 5;
const RIOT_MATCH_DETAIL_BATCH_DELAY_MS = 350;
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');
const APP_USER_MODEL_ID = 'com.banpick.ai';

let mainWindow;
let lcuConnection = null;
let webSocket = null;
let reconnectTimer = null;
let retryTimer = null;
let settings = createDefaultSettings();
let championPool = createDefaultChampionPool();
let matchHistoryChampionStats = [];
let appState = createInitialState();
let championIconUnavailableUntil = 0;
let championIconUnavailableLogged = false;
let matchHistoryInProgress = false;

configureLogger();

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

function createDefaultSettings() {
  return {
    lolInstallDir: DEFAULT_LOL_INSTALL_DIR,
    riotApiToken: '',
    riotPlatformRegion: DEFAULT_RIOT_PLATFORM_REGION
  };
}

function createInitialState() {
  return {
    settings: createPublicSettings(settings),
    lcuStatus: 'disconnected',
    websocketStatus: 'disconnected',
    gameflowPhase: null,
    summoner: null,
    lobby: null,
    champSelect: null,
    championsById: {},
    championPool,
    matchHistoryStatus: createMatchHistoryStatus(),
    matchHistorySummary: null,
    matchHistoryChampionStats,
    lastEvent: null,
    error: null,
    updatedAt: null
  };
}

function createMatchHistoryStatus(patch = {}) {
  return {
    phase: 'idle',
    source: 'manual',
    requestedMatches: RIOT_MATCHES_PER_RUN,
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

function createMatchHistorySummary({ updatedAt = null, requestedMatches = 0, matchIds = 0, updatedMatches = 0, matches = [], failedRequests = 0, championStats = 0 } = {}) {
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

function createPublicSettings(sourceSettings = settings) {
  const riotPlatformRegion = normalizeRiotPlatformRegion(sourceSettings.riotPlatformRegion);
  const riotHosts = createRiotApiHosts(riotPlatformRegion);

  return {
    lolInstallDir: sourceSettings.lolInstallDir,
    hasRiotApiToken: Boolean(sourceSettings.riotApiToken),
    riotPlatformRegion,
    riotRegionalRoute: riotHosts.regionalRoute,
    riotPlatformRegions: RIOT_PLATFORM_REGIONS
  };
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getChampionPoolPath() {
  return path.join(app.getPath('userData'), 'champion-pool.json');
}

function getRiotMatchCachePath() {
  return path.join(app.getPath('userData'), 'riot-match-cache.json');
}

function getMatchHistoryPath() {
  return path.join(app.getPath('userData'), 'match-history.json');
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    settings = {
      ...createDefaultSettings(),
      ...JSON.parse(raw)
    };
    log.debug('Settings loaded', { path: getSettingsPath(), settings: createPublicSettings(settings) });
  } catch {
    settings = createDefaultSettings();
    log.debug('Settings file not found or invalid; using defaults', { path: getSettingsPath(), settings: createPublicSettings(settings) });
  }

  updateState({ settings: createPublicSettings(settings) });
  return createPublicSettings(settings);
}

async function loadChampionPool() {
  try {
    const raw = await fs.readFile(getChampionPoolPath(), 'utf8');
    championPool = normalizeChampionPool(JSON.parse(raw));
    log.debug('Champion pool loaded', { path: getChampionPoolPath(), championPool });
  } catch {
    championPool = createDefaultChampionPool();
    log.debug('Champion pool file not found or invalid; using empty pool', { path: getChampionPoolPath() });
  }

  updateState({ championPool });
  return championPool;
}

async function loadMatchHistory() {
  const historyPath = getMatchHistoryPath();
  const history = await readJsonFile(historyPath, null);

  if (!history || history.source !== 'riot-api') {
    matchHistoryChampionStats = [];
    updateState({
      matchHistoryChampionStats,
      matchHistorySummary: null
    });
    log.debug('Match history file not found or invalid; using empty stats', { path: historyPath });
    return null;
  }

  const matches = Array.isArray(history.matches) ? history.matches : [];
  matchHistoryChampionStats = Array.isArray(history.championStats) ? history.championStats : [];
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
    matchHistorySummary: summary
  });
  log.debug('Match history loaded', { path: historyPath, summary });
  return history;
}

async function saveChampionPool(_event, nextChampionPool) {
  championPool = normalizeChampionPool(nextChampionPool);

  await fs.mkdir(path.dirname(getChampionPoolPath()), { recursive: true });
  await fs.writeFile(getChampionPoolPath(), JSON.stringify(championPool, null, 2), 'utf8');
  log.debug('Champion pool saved', { path: getChampionPoolPath(), championPool });
  updateState({ championPool });
  return championPool;
}

async function saveSettings(nextSettings) {
  settings = {
    ...settings,
    ...nextSettings
  };

  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  log.debug('Settings saved', { path: getSettingsPath(), settings: createPublicSettings(settings) });
  updateState({ settings: createPublicSettings(settings) });
  return settings;
}

function createWindow() {
  log.debug('Creating main window');
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'LoL AI Draft Coach',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

function sendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('lcu:state', appState);
}

function updateState(patch) {
  appState = {
    ...appState,
    ...patch,
    updatedAt: new Date().toISOString()
  };
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

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
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

function encodePathSegment(value) {
  return encodeURIComponent(String(value));
}

function createRiotRetryHandler() {
  return ({ attempt, delayMs }) => {
    updateMatchHistoryStatus({
      phase: 'retrying',
      retryAttempt: attempt,
      nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
      message: `Riot API制限のため再試行します ${Math.ceil(delayMs / 1000)}秒後`
    });
  };
}

async function collectRiotMatchHistory(_event, options = {}) {
  if (matchHistoryInProgress) {
    throw new Error('試合データを取得中です');
  }
  if (!settings.riotApiToken) {
    throw new Error('Riot APIトークンが未設定です');
  }

  matchHistoryInProgress = true;
  const requestedMatches = Number(options.count) || RIOT_MATCHES_PER_RUN;
  const startedAt = new Date().toISOString();

  updateMatchHistoryStatus({
    phase: 'collecting',
    source: 'manual',
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
    const riotId = getRiotIdFromSummoner(appState.summoner);
    const hosts = createRiotApiHosts(settings.riotPlatformRegion);
    const onRetry = createRiotRetryHandler();
    const account = await requestRiotJson({
      host: hosts.regionalHost,
      path: `/riot/account/v1/accounts/by-riot-id/${encodePathSegment(riotId.gameName)}/${encodePathSegment(riotId.tagLine)}`,
      apiToken: settings.riotApiToken,
      onRetry
    });

    if (!account?.puuid) {
      throw new Error('Riot APIからPUUIDを取得できませんでした');
    }

    const matchIds = await requestRiotJson({
      host: hosts.regionalHost,
      path: `/lol/match/v5/matches/by-puuid/${encodePathSegment(account.puuid)}/ids?start=0&count=${requestedMatches}`,
      apiToken: settings.riotApiToken,
      onRetry
    });

    const normalizedMatchIds = Array.isArray(matchIds) ? matchIds.slice(0, requestedMatches) : [];
    const cachePath = getRiotMatchCachePath();
    const historyPath = getMatchHistoryPath();
    const cache = await readJsonFile(cachePath, {
      version: 1,
      source: 'riot-api',
      updatedAt: null,
      matchesById: {}
    });
    const matchesById = cache.matchesById && typeof cache.matchesById === 'object' ? cache.matchesById : {};
    const missingMatchIds = normalizedMatchIds.filter((matchId) => !matchesById[matchId]);
    let fetchedMatches = 0;
    let failedRequests = 0;

    for (let index = 0; index < missingMatchIds.length; index += RIOT_MATCH_DETAIL_CONCURRENCY) {
      const batch = missingMatchIds.slice(index, index + RIOT_MATCH_DETAIL_CONCURRENCY);

      updateMatchHistoryStatus({
        phase: 'collecting',
        message: `試合データ収集中... ${fetchedMatches}/${missingMatchIds.length} 試合`
      });

      const results = await Promise.all(batch.map(async (matchId) => {
        try {
          const detail = await requestRiotJson({
            host: hosts.regionalHost,
            path: `/lol/match/v5/matches/${encodePathSegment(matchId)}`,
            apiToken: settings.riotApiToken,
            onRetry
          });
          return { matchId, detail };
        } catch (error) {
          failedRequests += 1;
          log.warn(`Riot match detail fetch failed for matchId=${matchId}`, serializeForLog(error));
          return { matchId, error };
        }
      }));

      results.forEach((result) => {
        if (result.detail) {
          matchesById[result.matchId] = result.detail;
          fetchedMatches += 1;
        }
      });

      updateMatchHistoryStatus({
        phase: 'collecting',
        fetchedMatches,
        failedRequests,
        message: `試合データ収集中... ${fetchedMatches}/${missingMatchIds.length} 試合`
      });

      if (index + RIOT_MATCH_DETAIL_CONCURRENCY < missingMatchIds.length) {
        await new Promise((resolve) => setTimeout(resolve, RIOT_MATCH_DETAIL_BATCH_DELAY_MS));
      }
    }

    const updatedAt = new Date().toISOString();
    await writeJsonFile(cachePath, {
      version: 1,
      source: 'riot-api',
      updatedAt,
      matchesById
    });

    updateMatchHistoryStatus({
      phase: 'normalizing',
      message: '試合データを正規化しています'
    });

    const normalizedMatches = normalizeRiotMatches(matchesById, account.puuid).slice(0, requestedMatches);
    const championStats = aggregateChampionStats(normalizedMatches);
    const history = {
      version: 1,
      source: 'riot-api',
      updatedAt,
      puuid: account.puuid,
      riotId: {
        gameName: riotId.gameName,
        tagLine: riotId.tagLine
      },
      matches: normalizedMatches,
      championStats
    };

    await writeJsonFile(historyPath, history);

    const phase = failedRequests > 0 ? 'partial' : 'completed';
    matchHistoryChampionStats = championStats;
    const summary = createMatchHistorySummary({
      updatedAt,
      requestedMatches,
      matchIds: normalizedMatchIds.length,
      updatedMatches: fetchedMatches,
      failedRequests,
      championStats: championStats.length,
      matches: normalizedMatches
    });

    updateState({
      matchHistoryChampionStats,
      matchHistorySummary: summary
    });
    updateMatchHistoryStatus({
      phase,
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

    log.info('Riot match history collected', summary);
    return summary;
  } catch (error) {
    log.warn('Riot match history collection failed', serializeForLog(error));
    updateMatchHistoryStatus({
      phase: 'error',
      message: `試合データ収集に失敗しました ${error.message}`,
      error: error.message
    });
    throw error;
  } finally {
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

async function updateRiotApiToken(_event, riotApiToken) {
  if (typeof riotApiToken !== 'string') {
    throw new Error('Riot APIトークンが文字列ではありません');
  }

  await saveSettings({ riotApiToken: riotApiToken.trim() });
  return createPublicSettings(settings);
}

async function updateRiotPlatformRegion(_event, riotPlatformRegion) {
  await saveSettings({ riotPlatformRegion: normalizeRiotPlatformRegion(riotPlatformRegion) });
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

    const [lobby, champSelect, summoner, gameflowPhase, championSummary] = await Promise.all([
      lcuFetch(LCU_ENDPOINTS.lobby).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.champSelect).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.summoner).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.gameflowPhase).catch((error) => ({ error: error.message })),
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
      championCount: Object.keys(championsById).length
    });

    updateState({
      lobby,
      champSelect,
      summoner,
      gameflowPhase,
      championsById,
      lcuStatus: 'connected',
      error: null
    });

    connectWebSocket();
    return appState;
  } catch (error) {
    log.warn('Failed to refresh LCU state', serializeForLog(error));
    closeWebSocket();
    lcuConnection = null;
    updateState({
      lcuStatus: 'disconnected',
      websocketStatus: 'disconnected',
      gameflowPhase: null,
      summoner: null,
      lobby: null,
      champSelect: null,
      championsById: {},
      error: error.message
    });
    scheduleRetry();
    return appState;
  }
}

function cleanupWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  clearRetryTimer();

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
  } else if (uri === LCU_ENDPOINTS.gameflowPhase) {
    updateState({
      gameflowPhase: data,
      champSelect: data === 'ChampSelect' ? appState.champSelect : null
    });
  }
}

app.whenReady().then(async () => {
  log.info('App ready');
  await loadSettings();
  await loadChampionPool();
  await loadMatchHistory();

  ipcMain.handle('lcu:get-state', () => appState);
  ipcMain.handle('lcu:refresh', refreshLcuState);
  ipcMain.handle('lcu:get-champion-icon', getChampionIcon);
  ipcMain.handle('champion-pool:get', () => championPool);
  ipcMain.handle('champion-pool:save', saveChampionPool);
  ipcMain.handle('settings:get', () => createPublicSettings(settings));
  ipcMain.handle('settings:choose-lol-install-dir', chooseLolInstallDir);
  ipcMain.handle('settings:update-lol-install-dir', updateLolInstallDir);
  ipcMain.handle('settings:update-riot-api-token', updateRiotApiToken);
  ipcMain.handle('settings:update-riot-platform-region', updateRiotPlatformRegion);
  ipcMain.handle('riot-match-history:collect', collectRiotMatchHistory);
  ipcMain.on('log:renderer', logRendererMessage);

  createWindow();
  await refreshLcuState();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
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
