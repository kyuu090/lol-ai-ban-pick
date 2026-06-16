const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const WebSocket = require('ws');

const DEFAULT_LOL_INSTALL_DIR = 'C:\\Riot Games\\League of Legends';
const LCU_ENDPOINTS = {
  lobby: '/lol-lobby/v2/lobby',
  champSelect: '/lol-champ-select/v1/session',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase'
};
const LOCKFILE_RETRY_MS = 5000;
const WEBSOCKET_RECONNECT_MS = 3000;

let mainWindow;
let lcuConnection = null;
let webSocket = null;
let reconnectTimer = null;
let retryTimer = null;
let settings = createDefaultSettings();
let appState = createInitialState();

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
    lastEvent: null,
    error: null,
    updatedAt: null
  };
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8');
    settings = {
      ...createDefaultSettings(),
      ...JSON.parse(raw)
    };
  } catch {
    settings = createDefaultSettings();
  }

  updateState({ settings });
  return settings;
}

async function saveSettings(nextSettings) {
  settings = {
    ...settings,
    ...nextSettings
  };

  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  updateState({ settings });
  return settings;
}

function createWindow() {
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

  try {
    raw = await fs.readFile(lockfilePath, 'utf8');
  } catch (error) {
    throw new Error(`LoLクライアントが起動していないか、ログインしていません: ${lockfilePath}`);
  }

  const [processName, pid, port, password, protocol] = raw.trim().split(':');

  if (!port || !password || !protocol) {
    throw new Error('lockfileの形式を読み取れませんでした');
  }

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
  closeWebSocket();
  lcuConnection = null;
  await refreshLcuState();
}

function createAuthHeader(password) {
  return `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`;
}

async function lcuFetch(endpoint) {
  if (!lcuConnection) {
    throw new Error('LCU接続情報がありません');
  }

  const url = `${lcuConnection.protocol}://127.0.0.1:${lcuConnection.port}${endpoint}`;
  const response = await requestLcuJson(url, {
    Authorization: createAuthHeader(lcuConnection.password),
    Accept: 'application/json'
  });

  if (response.statusCode === 404) return null;

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${endpoint} returned HTTP ${response.statusCode}: ${response.body}`);
  }

  return response.body ? JSON.parse(response.body) : null;
}

function requestLcuJson(url, headers) {
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
            body: Buffer.concat(chunks).toString('utf8')
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

async function refreshLcuState() {
  try {
    lcuConnection = await readLockfile();
    clearRetryTimer();
    updateState({ lcuStatus: 'connected', error: null });

    const [lobby, champSelect, summoner, gameflowPhase] = await Promise.all([
      lcuFetch(LCU_ENDPOINTS.lobby).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.champSelect).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.summoner).catch((error) => ({ error: error.message })),
      lcuFetch(LCU_ENDPOINTS.gameflowPhase).catch((error) => ({ error: error.message }))
    ]);

    updateState({
      lobby,
      champSelect,
      summoner,
      gameflowPhase,
      lcuStatus: 'connected',
      error: null
    });

    connectWebSocket();
    return appState;
  } catch (error) {
    closeWebSocket();
    updateState({
      lcuStatus: 'disconnected',
      websocketStatus: 'disconnected',
      gameflowPhase: null,
      summoner: null,
      lobby: null,
      champSelect: null,
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

  retryTimer = setTimeout(async () => {
    retryTimer = null;
    await refreshLcuState();
  }, LOCKFILE_RETRY_MS);
}

function scheduleReconnect() {
  if (reconnectTimer) return;

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

  webSocket = new WebSocket(wsUrl, 'wamp', {
    rejectUnauthorized: false
  });

  updateState({ websocketStatus: 'connecting' });

  webSocket.on('open', () => {
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
      await applyWebSocketEvent(event[2]);
    }
  });

  webSocket.on('close', () => {
    updateState({ websocketStatus: 'disconnected' });
    scheduleReconnect();
  });

  webSocket.on('error', (error) => {
    updateState({
      websocketStatus: 'error',
      error: `WebSocket error: ${error.message}`
    });
  });
}

async function applyWebSocketEvent(event) {
  const { uri, data } = event;

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
  createWindow();
  await loadSettings();

  ipcMain.handle('lcu:get-state', () => appState);
  ipcMain.handle('lcu:refresh', refreshLcuState);
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:choose-lol-install-dir', chooseLolInstallDir);
  ipcMain.handle('settings:update-lol-install-dir', updateLolInstallDir);

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
