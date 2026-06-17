const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');
const { createAuthHeader, createChampionsById, parseLockfile } = require('./lcu-logic');
const { createDefaultChampionPool, normalizeChampionPool } = require('./draft-logic');
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

let mainWindow;
let lcuConnection = null;
let webSocket = null;
let reconnectTimer = null;
let retryTimer = null;
let settings = createDefaultSettings();
let championPool = createDefaultChampionPool();
let appState = createInitialState();
let championIconUnavailableUntil = 0;
let championIconUnavailableLogged = false;

configureLogger();

function createDefaultSettings() {
  return {
    lolInstallDir: DEFAULT_LOL_INSTALL_DIR
  };
}

function createInitialState() {
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
    lastEvent: null,
    error: null,
    updatedAt: null
  };
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getChampionPoolPath() {
  return path.join(app.getPath('userData'), 'champion-pool.json');
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    settings = {
      ...createDefaultSettings(),
      ...JSON.parse(raw)
    };
    log.debug('Settings loaded', { path: getSettingsPath(), settings });
  } catch {
    settings = createDefaultSettings();
    log.debug('Settings file not found or invalid; using defaults', { path: getSettingsPath(), settings });
  }

  updateState({ settings });
  return settings;
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
  log.debug('Settings saved', { path: getSettingsPath(), settings });
  updateState({ settings });
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
    return settings;
  }

  await saveSettings({ lolInstallDir: result.filePaths[0] });
  await reconnectWithCurrentSettings();
  return settings;
}

async function updateLolInstallDir(_event, lolInstallDir) {
  if (!lolInstallDir || typeof lolInstallDir !== 'string') {
    throw new Error('LoLインストールディレクトリが空です');
  }

  await saveSettings({ lolInstallDir });
  await reconnectWithCurrentSettings();
  return settings;
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

  ipcMain.handle('lcu:get-state', () => appState);
  ipcMain.handle('lcu:refresh', refreshLcuState);
  ipcMain.handle('lcu:get-champion-icon', getChampionIcon);
  ipcMain.handle('champion-pool:get', () => championPool);
  ipcMain.handle('champion-pool:save', saveChampionPool);
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:choose-lol-install-dir', chooseLolInstallDir);
  ipcMain.handle('settings:update-lol-install-dir', updateLolInstallDir);
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
