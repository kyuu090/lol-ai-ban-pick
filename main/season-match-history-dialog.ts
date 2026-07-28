const { BrowserWindow, ipcMain } = require('electron');

import type { BrowserWindow as ElectronBrowserWindow } from 'electron';
import type { AppLanguage, ThemeMode } from '../types/domain/settings';
const { translate } = require('./i18n');

const RESPONSE_CHANNEL = 'season-match-history-dialog:response';

interface ShowSeasonMatchHistoryDialogOptions {
  parent: ElectronBrowserWindow | null;
  iconPath: string;
  htmlPath: string;
  preloadPath: string;
  themeMode: ThemeMode;
  language: AppLanguage;
  totalMatches: number;
  missingMatches: number;
  estimateText: string;
}

function showSeasonMatchHistoryDialog({
  parent,
  iconPath,
  htmlPath,
  preloadPath,
  themeMode,
  language,
  totalMatches,
  missingMatches,
  estimateText
}: ShowSeasonMatchHistoryDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const dialogWindow = new BrowserWindow({
      parent: parent ?? undefined,
      modal: Boolean(parent),
      show: false,
      width: 500,
      height: 430,
      minWidth: 500,
      minHeight: 430,
      maxWidth: 500,
      maxHeight: 430,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      backgroundColor: themeMode === 'dark' ? '#10162d' : '#f5f4ff',
      title: translate(language, 'season.title'),
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const settle = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener(RESPONSE_CHANNEL, handleResponse);
      resolve(confirmed);
    };
    const handleResponse = (event: Electron.IpcMainEvent, confirmed: unknown) => {
      if (event.sender !== dialogWindow.webContents) return;
      settle(Boolean(confirmed));
      dialogWindow.close();
    };

    ipcMain.on(RESPONSE_CHANNEL, handleResponse);
    dialogWindow.once('ready-to-show', () => dialogWindow.show());
    dialogWindow.on('closed', () => settle(false));
    dialogWindow.loadFile(htmlPath, {
      query: {
        themeMode,
        language,
        totalMatches: String(totalMatches),
        missingMatches: String(missingMatches),
        estimateText
      }
    });
  });
}

export = { showSeasonMatchHistoryDialog };
