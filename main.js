const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const WebSocket = require('ws');

const LOCKFILE_PATH = 'C:\\Riot Games\\League of Legends\\lockfile';
const LCU_ENDPOINTS = {
  lobby: '/lol-lobby/v2/lobby',
  champSelect: '/lol-champ-select/v1/session',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase'
};

let mainWindow;
let lcuConnection = null;
let webSocket = null;
let reconnectTimer = null;
let appState = createInitialState();

function createInitialState() {
  return {
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

  try {
    raw = await fs.readFile(LOCKFILE_PATH, 'utf8');
  } catch (error) {
    throw new Error('LoLクライアントが起動していないか、ログインしていません');
  }

  const [processName, pid, port, password, protocol] = raw.trim().split(':');

  if (!port || !password || !protocol) {
    throw new Error('lockfileの形式を読み取れませんでした');
  }

  return { processName, pid, port, password, protocol };
}

function createAuthHeader(password) {
  return `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`;
}

async function lcuFetch(endpoint) {
  if (!lcuConnection) {
    throw new Error('LCU接続情報がありません');
  }

  const url = `${lcuConnection.protocol}://127.0.0.1:${lcuConnection.port}${endpoint}`;

  // LCU uses a self-signed certificate. This agent is scoped to local dev LCU calls.
  const agent = new https.Agent({ rejectUnauthorized: false });
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: createAuthHeader(lcuConnection.password),
      Accept: 'application/json'
    },
    agent
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${endpoint} returned HTTP ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function refreshLcuState() {
  try {
    lcuConnection = await readLockfile();
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
    cleanupWebSocket();
    updateState({
      lcuStatus: 'disconnected',
      websocketStatus: 'disconnected',
      error: error.message
    });
    return appState;
  }
}

function cleanupWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (webSocket) {
    webSocket.removeAllListeners();
    webSocket.close();
    webSocket = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await refreshLcuState();
  }, 3000);
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
    updateState({ gameflowPhase: data });
  }
}

app.whenReady().then(async () => {
  createWindow();

  ipcMain.handle('lcu:get-state', () => appState);
  ipcMain.handle('lcu:refresh', refreshLcuState);

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
