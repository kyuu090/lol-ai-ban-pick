function registerIpcHandlers({
  ipcMain,
  handlers,
  logRendererMessage
}: IpcHandlersDeps): void {
  ipcMain.handle('lcu:get-state', handlers.getState);
  ipcMain.handle('lcu:refresh', handlers.refreshLcuState);
  ipcMain.handle('lcu:get-champion-icon', handlers.getChampionIcon);
  ipcMain.handle('champion-pool:get', handlers.getChampionPool);
  ipcMain.handle('champion-pool:save', handlers.saveChampionPool);
  ipcMain.handle('settings:get', handlers.getSettings);
  ipcMain.handle('settings:choose-lol-install-dir', handlers.chooseLolInstallDir);
  ipcMain.handle('settings:update-lol-install-dir', handlers.updateLolInstallDir);
  ipcMain.handle('settings:update-riot-platform-region', handlers.updateRiotPlatformRegion);
  ipcMain.handle('settings:update-theme-mode', handlers.updateThemeMode);
  ipcMain.handle('window:minimize', handlers.minimizeWindow);
  ipcMain.handle('window:toggle-maximize', handlers.toggleMaximizeWindow);
  ipcMain.handle('window:close', handlers.closeWindow);
  ipcMain.handle('riot-match-history:collect', handlers.collectRiotMatchHistory);
  ipcMain.handle('openai:pick-phase', handlers.requestPickPhaseAnalysis);
  ipcMain.handle('openai:final-composition', handlers.requestFinalCompositionAnalysis);
  ipcMain.on('log:renderer', logRendererMessage);
}

interface IpcMainLike {
  handle: (channel: string, handler: (...args: any[]) => unknown) => void;
  on: (channel: string, listener: (...args: any[]) => void) => void;
}

interface IpcHandlerMap {
  getState: (...args: any[]) => unknown;
  refreshLcuState: (...args: any[]) => unknown;
  getChampionIcon: (...args: any[]) => unknown;
  getChampionPool: (...args: any[]) => unknown;
  saveChampionPool: (...args: any[]) => unknown;
  getSettings: (...args: any[]) => unknown;
  chooseLolInstallDir: (...args: any[]) => unknown;
  updateLolInstallDir: (...args: any[]) => unknown;
  updateRiotPlatformRegion: (...args: any[]) => unknown;
  updateThemeMode: (...args: any[]) => unknown;
  minimizeWindow: (...args: any[]) => unknown;
  toggleMaximizeWindow: (...args: any[]) => unknown;
  closeWindow: (...args: any[]) => unknown;
  collectRiotMatchHistory: (...args: any[]) => unknown;
  requestPickPhaseAnalysis: (...args: any[]) => unknown;
  requestFinalCompositionAnalysis: (...args: any[]) => unknown;
}

interface IpcHandlersDeps {
  ipcMain: IpcMainLike;
  handlers: IpcHandlerMap;
  logRendererMessage: (...args: any[]) => void;
}

export = {
  registerIpcHandlers
};
