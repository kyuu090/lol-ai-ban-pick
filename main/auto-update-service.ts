const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

import type { BrowserWindow } from 'electron';
import type { AppUpdater, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';

const { autoUpdater }: { autoUpdater?: AppUpdater } = (() => {
  try {
    return require('electron-updater');
  } catch {
    return {};
  }
})();

const SPLASH_MINIMUM_VISIBLE_MS = 2000;
const UPDATE_CHECK_TIMEOUT_MS = 10000;
const UPDATE_BASE_URL = 'https://update.banpick-ai.lol/app';

type StartupUpdateDeps = {
  currentVersion: string;
  splashWindow: BrowserWindow;
  setSplashStatus?: (message: string) => Promise<void> | void;
  log?: {
    info?: (message: string, details?: unknown) => void;
    warn?: (message: string, details?: unknown) => void;
    error?: (message: string, details?: unknown) => void;
  };
  serializeForLog?: (value: unknown) => unknown;
};

type StartupUpdateResult =
  | { action: 'continue' }
  | { action: 'quit' };

type UpdateCheckResult =
  | { status: 'available'; info: UpdateInfo }
  | { status: 'not-available' }
  | { status: 'error'; error: Error };

function isStartupUpdateSupported(): boolean {
  if (!app.isPackaged) return false;
  if (!autoUpdater) return false;

  // electron-builder portable builds set these env vars. Self-replacing the running
  // executable is fragile, so we only auto-update installed builds.
  if (process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE) {
    return false;
  }

  return Boolean(UPDATE_BASE_URL) || hasEmbeddedUpdateConfig();
}

function getEmbeddedUpdateConfigPath(): string {
  return path.join(process.resourcesPath, 'app-update.yml');
}

function hasEmbeddedUpdateConfig(): boolean {
  try {
    return fs.existsSync(getEmbeddedUpdateConfigPath());
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createTimeoutError(ms: number): Error {
  return new Error(`Auto update check timed out after ${ms}ms`);
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error || 'Unknown auto update error'));
}

function isMissingLatestManifestError(error: Error): boolean {
  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes('latest.yml') ||
    message.includes('latest-mac.yml') ||
    message.includes('app-update.yml') ||
    message.includes('404') ||
    message.includes('not found')
  );
}

function isIgnorableUpdateCheckError(error: Error): boolean {
  if (isMissingLatestManifestError(error)) return true;

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes('net::err_') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('failed to fetch') ||
    message.includes('timed out')
  );
}

async function checkForUpdatesWithTimeout(updater: AppUpdater, timeoutMs: number): Promise<UpdateCheckResult> {
  return new Promise<UpdateCheckResult>((resolve) => {
    let settled = false;
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      finish({ status: 'error', error: createTimeoutError(timeoutMs) });
    }, timeoutMs);

    function cleanup(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      updater.removeListener('update-available', onAvailable);
      updater.removeListener('update-not-available', onNotAvailable);
      updater.removeListener('error', onError);
    }

    function finish(result: UpdateCheckResult): void {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function onAvailable(info: UpdateInfo): void {
      finish({ status: 'available', info });
    }

    function onNotAvailable(): void {
      finish({ status: 'not-available' });
    }

    function onError(error: unknown): void {
      finish({ status: 'error', error: normalizeError(error) });
    }

    updater.once('update-available', onAvailable);
    updater.once('update-not-available', onNotAvailable);
    updater.once('error', onError);

    updater.checkForUpdates().catch(onError);
  });
}

async function downloadAndInstallUpdate(updater: AppUpdater): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;

    function cleanup(): void {
      updater.removeListener('update-downloaded', onDownloaded);
      updater.removeListener('error', onError);
    }

    function finish(callback: () => void): void {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    }

    function onDownloaded(_event: UpdateDownloadedEvent): void {
      finish(resolve);
    }

    function onError(error: unknown): void {
      finish(() => reject(normalizeError(error)));
    }

    updater.once('update-downloaded', onDownloaded);
    updater.once('error', onError);
    updater.downloadUpdate().catch(onError);
  });
}

async function askToUpdate(splashWindow: BrowserWindow, version: string): Promise<boolean> {
  const result = await dialog.showMessageBox(splashWindow, {
    type: 'question',
    buttons: ['アップデートする', 'アップデートせずに終了する'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: 'アップデートがあります',
    message: 'アップデートしますか？',
    detail: `新しいバージョン ${version} が利用できます。`
  });

  return result.response === 0;
}

async function showUpdateFailedAndQuit(splashWindow: BrowserWindow): Promise<void> {
  await dialog.showMessageBox(splashWindow, {
    type: 'error',
    buttons: ['終了する'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: 'アップデートに失敗しました',
    message: 'アップデートのダウンロードに失敗しました。',
    detail: '時間をおいて再度お試しください。'
  });
  app.quit();
}

async function runStartupUpdateFlow({
  currentVersion,
  splashWindow,
  setSplashStatus,
  log,
  serializeForLog
}: StartupUpdateDeps): Promise<StartupUpdateResult> {
  const minimumVisible = delay(SPLASH_MINIMUM_VISIBLE_MS);

  if (!isStartupUpdateSupported()) {
    await setSplashStatus?.('アップデート確認をスキップしています...');
    log?.info?.('Startup auto update is disabled', {
      isPackaged: app.isPackaged,
      updateBaseUrl: UPDATE_BASE_URL,
      hasEmbeddedUpdateConfig: hasEmbeddedUpdateConfig(),
      hasUpdaterModule: Boolean(autoUpdater),
      isPortable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE)
    });
    await minimumVisible;
    return { action: 'continue' };
  }

  const updater = autoUpdater as AppUpdater;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;

  updater.setFeedURL({
    provider: 'generic',
    url: UPDATE_BASE_URL
  });

  await setSplashStatus?.('アップデートを確認しています...');
  log?.info?.('Checking for startup update', {
    currentVersion,
    updateBaseUrl: UPDATE_BASE_URL,
    embeddedUpdateConfigPath: hasEmbeddedUpdateConfig() ? getEmbeddedUpdateConfigPath() : null
  });

  const checkResult = await checkForUpdatesWithTimeout(updater, UPDATE_CHECK_TIMEOUT_MS);
  await minimumVisible;

  if (checkResult.status === 'not-available') {
    await setSplashStatus?.('アップデートはありません。起動を続けます...');
    log?.info?.('No startup update available', { currentVersion });
    return { action: 'continue' };
  }

  if (checkResult.status === 'error') {
    await setSplashStatus?.('アップデート確認に失敗したため通常起動します...');
    const serializedError = serializeForLog ? serializeForLog(checkResult.error) : checkResult.error;
    if (isIgnorableUpdateCheckError(checkResult.error)) {
      log?.warn?.('Startup update check failed. Continuing without update.', serializedError);
      return { action: 'continue' };
    }

    log?.error?.('Startup update check failed. Continuing without update.', serializedError);
    return { action: 'continue' };
  }

  const nextVersion = String(checkResult.info?.version || '').trim() || 'unknown';
  log?.info?.('Startup update available', {
    currentVersion,
    nextVersion
  });

  await setSplashStatus?.('アップデートが見つかりました。選択を待っています...');
  const shouldUpdate = await askToUpdate(splashWindow, nextVersion);
  log?.info?.('Startup update dialog resolved', {
    currentVersion,
    nextVersion,
    shouldUpdate
  });

  if (!shouldUpdate) {
    await setSplashStatus?.('アップデートせずに終了します...');
    app.quit();
    return { action: 'quit' };
  }

  try {
    await setSplashStatus?.('アップデートをダウンロードしています...');
    await downloadAndInstallUpdate(updater);
    await setSplashStatus?.('アップデートを適用しています...');
    log?.info?.('Startup update downloaded. Installing now.', {
      currentVersion,
      nextVersion
    });
    updater.quitAndInstall(false, true);
    return { action: 'quit' };
  } catch (error) {
    await setSplashStatus?.('アップデートに失敗しました...');
    log?.error?.(
      'Startup update download failed',
      serializeForLog ? serializeForLog(error) : normalizeError(error)
    );
    await showUpdateFailedAndQuit(splashWindow);
    return { action: 'quit' };
  }
}

export = {
  runStartupUpdateFlow
};
