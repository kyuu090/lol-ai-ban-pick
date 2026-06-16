const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lcuApi', {
  getState: () => ipcRenderer.invoke('lcu:get-state'),
  refresh: () => ipcRenderer.invoke('lcu:refresh'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('lcu:state', listener);

    return () => {
      ipcRenderer.removeListener('lcu:state', listener);
    };
  }
});
