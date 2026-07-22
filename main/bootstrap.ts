const { app, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { configureLogger, log, logRendererMessage, serializeForLog } = require('../logger');
const { runStartupUpdateFlow } = require('./auto-update-service');
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
const { resolveLaneOpponentContext } = require('../lcu-logic');
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
  createSplashWindow,
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
const { requestStatsDbApiJson } = require('../stats-db-api');
const { createRiotMatchHistoryService } = require('./riot-match-history-service');
const {
  getRiotPlatformRegionFromLcuRegion,
  getRiotRegionalRoute,
  normalizeRiotPlatformRegion
} = require('../riot-api');
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
  perksCurrentPage: '/lol-perks/v1/currentpage',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase',
  gameflowSession: '/lol-gameflow/v1/session',
  championSummary: '/lol-game-data/assets/v1/champion-summary.json',
  regionLocale: '/riotclient/region-locale'
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
const MAIN_HTML_PATH = path.join(__dirname, '..', 'index.html');
const SPLASH_HTML_PATH = path.join(__dirname, '..', 'splash.html');
const APP_USER_MODEL_ID = 'com.banpick.ai';
const APP_USER_DATA_DIR_NAME = 'banpick-ai';
const RIOT_MATCH_DATA_SERVICE_HELP_MESSAGE = '試合データ取得サービスへの接続を確認してください。';
const PACKAGE_LOCK_PATH = path.join(__dirname, '..', 'package-lock.json');
const SPLASH_LOAD_TIMEOUT_MS = 3000;

type StoredSettings = {
  lolInstallDir: string;
  riotPlatformRegion: RiotPlatformRegion;
  riotRegionalRoute: import('../types/domain/settings').RiotRegionalRoute;
  themeMode: ThemeMode;
};

function bootstrap(): void {
  let mainWindow: BrowserWindow | null = null;
  let settings: StoredSettings = createDefaultSettings();
  let championPool: ChampionPool = createDefaultChampionPool();
  let splashWindowLoadPromise: Promise<void> | null = null;

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
    getRiotRoutingFromLcu: async (regionLocale: unknown) => {
      const lcuRegion = (regionLocale as { region?: unknown } | null)?.region;
      const riotPlatformRegion = getRiotPlatformRegionFromLcuRegion(lcuRegion);
      if (!riotPlatformRegion) {
        log.warn('Unknown LCU region; Riot API calls will remain unavailable', { lcuRegion: String(lcuRegion || '') });
        return null;
      }
      const riotRegionalRoute = getRiotRegionalRoute(riotPlatformRegion);
      matchHistoryController.scheduleStartupIfReady('lcu-region-detected');
      log.debug('Riot routing detected from LCU', { riotPlatformRegion, riotRegionalRoute });
      return { riotPlatformRegion, riotRegionalRoute };
    },
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

  function createWindow(): BrowserWindow {
    const window = createMainWindow({
      htmlPath: MAIN_HTML_PATH,
      iconPath: APP_ICON_PATH,
      preloadPath: path.join(__dirname, '..', 'preload.js'),
      log
    });
    mainWindow = window;
    return window;
  }

  function createStartupSplashWindow(): BrowserWindow {
    const splashWindow = createSplashWindow({
      iconPath: APP_ICON_PATH,
      splashHtmlPath: SPLASH_HTML_PATH,
      preloadPath: path.join(__dirname, '..', 'preload.js'),
      log
    });
    splashWindowLoadPromise = new Promise<void>((resolve) => {
      let settled = false;
      let timeoutId: NodeJS.Timeout | null = null;

      function finish(): void {
        if (settled) return;
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve();
      }

      if (splashWindow.webContents.isLoadingMainFrame()) {
        splashWindow.webContents.once('did-finish-load', () => finish());
        splashWindow.webContents.once('did-fail-load', (_event: unknown, errorCode: number, errorDescription: string) => {
          log.warn('Splash window failed to load', { errorCode, errorDescription });
          finish();
        });
        timeoutId = setTimeout(() => {
          log.warn('Splash window load timed out. Continuing bootstrap.');
          finish();
        }, SPLASH_LOAD_TIMEOUT_MS);
      } else {
        finish();
      }
    });
    return splashWindow;
  }

  async function waitForSplashWindowLoaded(window: BrowserWindow | null): Promise<void> {
    if (!window || window.isDestroyed()) return;
    await splashWindowLoadPromise;
  }

  async function setSplashStatus(window: BrowserWindow | null, message: string): Promise<void> {
    if (!window || window.isDestroyed()) return;
    await waitForSplashWindowLoaded(window);

    const safeMessage = JSON.stringify(String(message || '').trim() || '起動を開始しています...');
    try {
      await window.webContents.executeJavaScript(
        `window.setSplashStatus && window.setSplashStatus(${safeMessage});`,
        true
      );
    } catch (error) {
      log.warn('Failed to update splash status', serializeForLog(error));
    }
  }

  async function setSplashVersion(window: BrowserWindow | null, version: string): Promise<void> {
    if (!window || window.isDestroyed()) return;
    await waitForSplashWindowLoaded(window);

    const safeVersion = JSON.stringify(String(version || '').trim() || '0.0.0');
    try {
      await window.webContents.executeJavaScript(
        `window.setSplashVersion && window.setSplashVersion(${safeVersion});`,
        true
      );
    } catch (error) {
      log.warn('Failed to update splash version', serializeForLog(error));
    }
  }

  async function waitForWindowReady(window: BrowserWindow): Promise<void> {
    if (!window || window.isDestroyed()) return;
    if (window.isVisible()) return;

    await new Promise<void>((resolve) => {
      window.once('ready-to-show', () => resolve());
    });
  }

  async function closeSplashWindow(window: BrowserWindow | null): Promise<void> {
    if (!window || window.isDestroyed()) return;
    window.close();
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
    const normalizedRegion = normalizeRiotPlatformRegion(riotPlatformRegion);
    await saveSettings({
      riotPlatformRegion: normalizedRegion,
      riotRegionalRoute: getRiotRegionalRoute(normalizedRegion)
    });
    matchHistoryController.scheduleStartupIfReady('riot-region-saved');
    return createPublicSettings(settings);
  }

  async function updateThemeMode(_event: unknown, themeMode: unknown): Promise<PublicSettings> {
    await saveSettings({ themeMode: normalizeThemeMode(themeMode) });
    return createPublicSettings(settings);
  }

  async function requestStatsApiJson(_event: unknown, pathOrUrl: unknown): Promise<unknown> {
    const requestTarget = String(pathOrUrl || '');
    let requestDetails: Record<string, unknown> = { pathOrUrl: requestTarget };

    try {
      const parsedUrl = new URL(requestTarget, 'https://db.banpick-ai.lol');
      requestDetails = {
        pathOrUrl: requestTarget,
        pathname: parsedUrl.pathname,
        championId: parsedUrl.pathname.match(/\/champions\/(\d+)\/details$/)?.[1] || null,
        position: parsedUrl.pathname.match(/\/positions\/([A-Z]+)\//)?.[1] || null,
        opponentChampionId: parsedUrl.searchParams.get('opponentChampionId'),
        keystoneId: parsedUrl.searchParams.get('keystoneId'),
        patch: parsedUrl.searchParams.get('patch'),
        ranks: parsedUrl.searchParams.get('ranks')
      };
    } catch {
      // Keep the raw target only when URL parsing fails.
    }

    log.debug('StatsAPI request started', requestDetails);

    try {
      const response = await requestStatsDbApiJson(pathOrUrl);
      const responseData = response && typeof response === 'object' ? (response as any).data : null;
      const returnedKeystones = Array.isArray(responseData?.keystones)
        ? responseData.keystones.map((entry: any) => Number(entry?.keystoneId) || 0).filter(Boolean)
        : [];
      log.debug('StatsAPI request completed', {
        ...requestDetails,
        returnedKeystones,
        keystoneCount: returnedKeystones.length
      });
      return response;
    } catch (error) {
      log.warn('StatsAPI request failed', {
        ...requestDetails,
        error: serializeForLog(error)
      });
      throw error;
    }
  }

  function resolveInGameStatsOpponent(): unknown {
    const state = statePublisher.getState();
    const resolution = resolveLaneOpponentContext({
      gameflowSession: state.gameflowSession,
      localPuuid: getPuuidFromSummoner(state.summoner),
      champSelectSession: state.champSelect,
      mode: 'stats'
    });
    if (!resolution) return null;

    return {
      enemyChampionIds: resolution.enemyParticipants.map((participant: any) => participant.championId).filter(Boolean),
      laneMatchupLane: resolution.laneMatchupLane,
      localPosition: resolution.localPosition,
      opponentChampionId: resolution.opponentChampionId,
      opponentPosition: resolution.opponentPosition
    };
  }

  async function getClientVersion(): Promise<string> {
    if (app.isPackaged) {
      const packagedVersion = String(app.getVersion() || '').trim();
      if (packagedVersion) return packagedVersion;
    }

    try {
      const packageLockText = await fs.readFile(PACKAGE_LOCK_PATH, 'utf8');
      const packageLock = JSON.parse(packageLockText);
      const rootPackageVersion = String(packageLock?.packages?.['']?.version || '').trim();
      const lockfileVersion = String(packageLock?.version || '').trim();
      const version = rootPackageVersion || lockfileVersion;

      if (version) return version;
    } catch (error) {
      log.warn('package-lock.json version lookup failed. Falling back to app version.', serializeForLog(error));
    }

    const appVersion = String(app.getVersion() || '').trim();
    if (appVersion) return appVersion;

    throw new Error('クライアントバージョンを取得できませんでした');
  }

  function cleanupWebSocket(): void {
    matchHistoryController.cleanup();
    lcuController.cleanup();
  }

  app.whenReady()
    .then(async () => {
      log.info('App ready');
      const splashWindow = createStartupSplashWindow();
      await setSplashStatus(splashWindow, 'バージョン情報を確認しています...');
      const currentVersion = await getClientVersion();
      await setSplashVersion(splashWindow, currentVersion);
      const startupUpdateResult = await runStartupUpdateFlow({
        currentVersion,
        splashWindow,
        setSplashStatus: (message: string) => setSplashStatus(splashWindow, message),
        log,
        serializeForLog
      });

      if (startupUpdateResult.action === 'quit') {
        await closeSplashWindow(splashWindow);
        return;
      }

      await setSplashStatus(splashWindow, '設定を読み込んでいます...');
      await loadSettings();
      await setSplashStatus(splashWindow, 'チャンピオンプールを読み込んでいます...');
      await loadChampionPool();
      await setSplashStatus(splashWindow, '起動準備をしています...');

      registerIpcHandlers({
        ipcMain: ipcMain as IpcMain,
        logRendererMessage,
        handlers: {
          getState: statePublisher.getState,
          getChampionIcon: lcuController.getClient().getChampionIcon,
          getChampionPool: () => championPool,
          saveChampionPool,
          getSettings: () => ({
            ...statePublisher.getState().settings,
            detectedRiotPlatformRegion: statePublisher.getState().detectedRiotPlatformRegion,
            detectedRiotRegionalRoute: statePublisher.getState().detectedRiotRegionalRoute
          }),
          getClientVersion,
          chooseLolInstallDir,
          updateLolInstallDir,
          updateRiotPlatformRegion,
          updateThemeMode,
          minimizeWindow,
          toggleMaximizeWindow,
            closeWindow,
            collectRiotMatchHistory: matchHistoryController.collectRiotMatchHistory,
            resolveInGameStatsOpponent,
            requestStatsApiJson,
            requestPickPhaseAnalysis,
            requestFinalCompositionAnalysis
          }
      });

      await setSplashStatus(splashWindow, 'ウィンドウを表示しています...');
      const nextMainWindow = createWindow();
      await waitForWindowReady(nextMainWindow);
      await closeSplashWindow(splashWindow);
      await lcuController.refreshLcuState();

      app.on('activate', () => {
        if (!hasOpenWindows()) {
          createWindow();
          statePublisher.sendState();
        }
      });
    })
    .catch((error: unknown) => {
      log.error('Bootstrap failed', serializeForLog(error));
      dialog.showErrorBox(
        '起動エラー',
        'アプリの起動中にエラーが発生しました。debug.log を確認してください。'
      );
      app.quit();
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
