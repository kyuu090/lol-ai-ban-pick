const { app, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { configureLogger, log, logRendererMessage, serializeForLog } = require('../logger');
const {
  createDefaultSettings,
  createPublicSettings,
  loadSettings: loadSettingsFromStore,
  normalizeThemeMode,
  saveSettings: saveSettingsToStore
} = require('./settings-store');
const {
  loadChampionPool: loadChampionPoolFromStore,
  saveChampionPool: saveChampionPoolToStore
} = require('./champion-pool-store');
const { createDefaultChampionPool } = require('../draft-logic');
const {
  getMatchHistoryPath: getMatchHistoryStorePath,
  getRiotMatchCachePath: getRiotMatchCacheStorePath,
  readJsonFile,
  writeJsonFile
} = require('./match-history-store');
const {
  applyStatePatch,
  createInitialState: createAppInitialState,
  createMatchHistoryStatus: createBaseMatchHistoryStatus
} = require('./app-state');
const {
  closeWindow,
  createMainWindow,
  hasOpenWindows,
  minimizeWindow,
  toggleMaximizeWindow
} = require('./window');
const { registerIpcHandlers } = require('./ipc-handlers');
const {
  requestFinalCompositionAnalysis,
  requestLaneMatchupAnalysis,
  requestPickPhaseAnalysis
} = require('./ai-analysis-service');
const { createRiotMatchHistoryService } = require('./riot-match-history-service');
const { normalizeRiotPlatformRegion } = require('../riot-api');
const { createStatePublisher } = require('./state-publisher');
const { createLaneMatchupController } = require('./lane-matchup-controller');
const { createMatchHistoryController } = require('./match-history-controller');
const { createLcuController } = require('./lcu-controller');

import type { BrowserWindow, IpcMain } from 'electron';
import type { AppState } from '../types/domain/app-state';
import type { ChampionPool } from '../types/domain/champion';
import type { Summoner, LcuErrorPayload } from '../types/domain/lcu';
import type { MatchHistoryStatus } from '../types/domain/match-history';
import type { PublicSettings, RiotPlatformRegion, ThemeMode } from '../types/domain/settings';

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
const APP_ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.ico');
const APP_USER_MODEL_ID = 'com.banpick.ai';
const APP_USER_DATA_DIR_NAME = 'banpick-ai';
const RIOT_MATCH_DATA_SERVICE_HELP_MESSAGE = '試合データ取得サービスへの接続を確認してください。';

type StoredSettings = {
  lolInstallDir: string;
  riotPlatformRegion: RiotPlatformRegion;
  themeMode: ThemeMode;
};

function bootstrap(): void {
  let mainWindow: BrowserWindow | null = null;
  let settings: StoredSettings = createDefaultSettings();
  let championPool: ChampionPool = createDefaultChampionPool();

  configureElectronRuntimeOptions();
  configureAppUserDataPath();
  configureLogger();

  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  function createMatchHistoryStatus(patch: Partial<MatchHistoryStatus> = {}): MatchHistoryStatus {
    return createBaseMatchHistoryStatus({
      defaultRequestedMatches: RIOT_MATCHES_PER_RUN,
      patch
    });
  }

  const statePublisher = createStatePublisher({
    initialState: createAppInitialState({
      settings: createPublicSettings(settings),
      championPool,
      matchHistoryStatus: createMatchHistoryStatus()
    }),
    applyStatePatch,
    getWindow: () => mainWindow,
    log
  });

  const riotMatchHistoryService = createRiotMatchHistoryService({
    matchIdsPageSize: RIOT_MATCH_IDS_PAGE_SIZE,
    updateMatchHistoryStatus: (patch: Partial<MatchHistoryStatus>) => {
      statePublisher.updateState({
        matchHistoryStatus: createMatchHistoryStatus({
          ...statePublisher.getState().matchHistoryStatus,
          ...patch,
          updatedAt: new Date().toISOString()
        })
      });
    },
    clearRiotRateLimitCountdown: () => matchHistoryController.clearRiotRateLimitCountdown()
  });

  const matchHistoryController = createMatchHistoryController({
    dialog,
    getMainWindow: () => mainWindow,
    getSettings: () => settings,
    getState: statePublisher.getState,
    updateState: statePublisher.updateState,
    createMatchHistoryStatus,
    getPuuidFromSummoner,
    getRiotIdFromSummoner,
    paths: {
      getMatchHistoryPath,
      getRiotMatchCachePath
    },
    readJsonFile,
    writeJsonFile,
    riotMatchHistoryService,
    constants: {
      autoGameEndDelayMs: AUTO_MATCH_HISTORY_GAME_END_DELAY_MS,
      autoStartupDelayMs: AUTO_MATCH_HISTORY_STARTUP_DELAY_MS,
      defaultRequestedMatches: RIOT_MATCHES_PER_RUN,
      detailBatchDelayMs: RIOT_MATCH_DETAIL_BATCH_DELAY_MS,
      detailConcurrency: RIOT_MATCH_DETAIL_CONCURRENCY,
      estimatedRequestsPerTwoMinutes: RIOT_ESTIMATED_REQUESTS_PER_TWO_MINUTES,
      seasonDetailBatchDelayMs: RIOT_SEASON_MATCH_DETAIL_BATCH_DELAY_MS,
      seasonDetailConcurrency: RIOT_SEASON_MATCH_DETAIL_CONCURRENCY,
      serviceHelpMessage: RIOT_MATCH_DATA_SERVICE_HELP_MESSAGE
    },
    log,
    serializeForLog
  });

  const laneMatchupController = createLaneMatchupController({
    getState: statePublisher.getState,
    updateState: statePublisher.updateState,
    getPuuidFromSummoner,
    lcuClient: {
      fetchJson: (endpoint: string) => lcuController.getClient().fetchJson(endpoint)
    },
    gameflowSessionEndpoint: LCU_ENDPOINTS.gameflowSession,
    retryDelayMs: LANE_MATCHUP_RETRY_DELAY_MS,
    requestLaneMatchupAnalysis,
    log,
    serializeForLog
  });

  const lcuController = createLcuController({
    getSettings: () => createPublicSettings(settings),
    getState: statePublisher.getState,
    updateState: statePublisher.updateState,
    getLaneMatchupController: () => laneMatchupController,
    getMatchHistoryController: () => matchHistoryController,
    endpoints: LCU_ENDPOINTS,
    lockfileRetryMs: LOCKFILE_RETRY_MS,
    websocketReconnectMs: WEBSOCKET_RECONNECT_MS,
    log,
    serializeForLog
  });

  async function loadSettings(): Promise<PublicSettings> {
    settings = await loadSettingsFromStore({ userDataPath: app.getPath('userData'), log });
    statePublisher.updateState({ settings: createPublicSettings(settings) });
    return createPublicSettings(settings);
  }

  async function loadChampionPool(): Promise<ChampionPool> {
    championPool = await loadChampionPoolFromStore({ userDataPath: app.getPath('userData'), log });
    statePublisher.updateState({ championPool });
    return championPool;
  }

  async function saveChampionPool(_event: unknown, nextChampionPool: unknown): Promise<ChampionPool> {
    championPool = await saveChampionPoolToStore({
      userDataPath: app.getPath('userData'),
      nextChampionPool,
      log
    });
    statePublisher.updateState({ championPool });
    return championPool;
  }

  async function saveSettings(nextSettings: Partial<StoredSettings>): Promise<StoredSettings> {
    settings = await saveSettingsToStore({
      userDataPath: app.getPath('userData'),
      currentSettings: settings,
      nextSettings,
      log
    });
    statePublisher.updateState({ settings: createPublicSettings(settings) });
    return settings;
  }

  function createWindow(): void {
    mainWindow = createMainWindow({
      iconPath: APP_ICON_PATH,
      preloadPath: path.join(__dirname, '..', 'preload.js'),
      log
    });
  }

  async function chooseLolInstallDir(): Promise<PublicSettings> {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'League of Legends のインストールディレクトリを選択',
      defaultPath: settings.lolInstallDir,
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return createPublicSettings(settings);
    }

    await saveSettings({ lolInstallDir: result.filePaths[0] });
    await lcuController.reconnectWithCurrentSettings();
    return createPublicSettings(settings);
  }

  async function updateLolInstallDir(_event: unknown, lolInstallDir: unknown): Promise<PublicSettings> {
    if (!lolInstallDir || typeof lolInstallDir !== 'string') {
      throw new Error('LoLインストールディレクトリが空です');
    }

    await saveSettings({ lolInstallDir });
    await lcuController.reconnectWithCurrentSettings();
    return createPublicSettings(settings);
  }

  async function updateRiotPlatformRegion(_event: unknown, riotPlatformRegion: unknown): Promise<PublicSettings> {
    await saveSettings({ riotPlatformRegion: normalizeRiotPlatformRegion(riotPlatformRegion) });
    matchHistoryController.scheduleStartupIfReady('riot-region-saved');
    return createPublicSettings(settings);
  }

  async function updateThemeMode(_event: unknown, themeMode: unknown): Promise<PublicSettings> {
    await saveSettings({ themeMode: normalizeThemeMode(themeMode) });
    return createPublicSettings(settings);
  }

  function cleanupWebSocket(): void {
    matchHistoryController.cleanup();
    lcuController.cleanup();
  }

  app.whenReady().then(async () => {
    log.info('App ready');
    await loadSettings();
    await loadChampionPool();

    registerIpcHandlers({
      ipcMain: ipcMain as IpcMain,
      logRendererMessage,
      handlers: {
        getState: statePublisher.getState,
        refreshLcuState: lcuController.refreshLcuState,
        getChampionIcon: lcuController.getClient().getChampionIcon,
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
        collectRiotMatchHistory: matchHistoryController.collectRiotMatchHistory,
        requestPickPhaseAnalysis,
        requestFinalCompositionAnalysis
      }
    });

    createWindow();
    await lcuController.refreshLcuState();

    app.on('activate', () => {
      if (!hasOpenWindows()) {
        createWindow();
        statePublisher.sendState();
      }
    });
  });

  app.on('window-all-closed', () => {
    cleanupWebSocket();

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

function configureElectronRuntimeOptions(): void {
  if (!process.argv.includes('--disable-gpu') && process.env.BANPICK_AI_DISABLE_GPU !== '1') return;

  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

function configureAppUserDataPath(): void {
  const userDataPath = path.join(app.getPath('appData'), APP_USER_DATA_DIR_NAME);
  app.setPath('userData', userDataPath);
}

function getMatchHistoryPath(puuid: string): string {
  return getMatchHistoryStorePath(app.getPath('userData'), puuid);
}

function getRiotMatchCachePath(puuid: string): string {
  return getRiotMatchCacheStorePath(app.getPath('userData'), puuid);
}

function getPuuidFromSummoner(summoner: Summoner | LcuErrorPayload | null): string | null {
  const puuid = summoner && !('error' in summoner) ? String(summoner.puuid || '').trim() : '';
  return puuid || null;
}

function getRiotIdFromSummoner(summoner: Summoner | LcuErrorPayload | null): { gameName: string; tagLine: string } {
  if (!summoner || 'error' in summoner) {
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

export = {
  bootstrap,
  getPuuidFromSummoner,
  getRiotIdFromSummoner
};
