function registerIpcHandlers({
  ipcMain,
  handlers,
  logRendererMessage
}) {
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

module.exports = {
  registerIpcHandlers
};
