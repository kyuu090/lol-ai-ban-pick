const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lcuApi', {
  getState: () => ipcRenderer.invoke('lcu:get-state'),
  refresh: () => ipcRenderer.invoke('lcu:refresh'),
  getChampionIcon: (championId) => ipcRenderer.invoke('lcu:get-champion-icon', championId),
  getChampionPool: () => ipcRenderer.invoke('champion-pool:get'),
  saveChampionPool: (championPool) => ipcRenderer.invoke('champion-pool:save', championPool),
  log: (level, message, details) => ipcRenderer.send('log:renderer', level, message, details),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  chooseLolInstallDir: () => ipcRenderer.invoke('settings:choose-lol-install-dir'),
  updateLolInstallDir: (lolInstallDir) => ipcRenderer.invoke('settings:update-lol-install-dir', lolInstallDir),
  updateRiotPlatformRegion: (riotPlatformRegion) => ipcRenderer.invoke('settings:update-riot-platform-region', riotPlatformRegion),
  updateThemeMode: (themeMode) => ipcRenderer.invoke('settings:update-theme-mode', themeMode),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowMaximized: (callback) => {
    const listener = (_event, isMaximized) => callback(Boolean(isMaximized));
    ipcRenderer.on('window:maximized', listener);

    return () => {
      ipcRenderer.removeListener('window:maximized', listener);
    };
  },
  collectRiotMatchHistory: (options) => ipcRenderer.invoke('riot-match-history:collect', options),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('lcu:state', listener);

    return () => {
      ipcRenderer.removeListener('lcu:state', listener);
    };
  }
});
