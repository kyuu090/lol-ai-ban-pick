const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lcuApi', {
  getState: () => ipcRenderer.invoke('lcu:get-state'),
  refresh: () => ipcRenderer.invoke('lcu:refresh'),
  getChampionIcon: (championId) => ipcRenderer.invoke('lcu:get-champion-icon', championId),
  getChampionPool: () => ipcRenderer.invoke('champion-pool:get'),
  saveChampionPool: (championPool) => ipcRenderer.invoke('champion-pool:save', championPool),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  chooseLolInstallDir: () => ipcRenderer.invoke('settings:choose-lol-install-dir'),
  updateLolInstallDir: (lolInstallDir) => ipcRenderer.invoke('settings:update-lol-install-dir', lolInstallDir),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('lcu:state', listener);

    return () => {
      ipcRenderer.removeListener('lcu:state', listener);
    };
  }
});
