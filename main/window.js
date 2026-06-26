const { BrowserWindow } = require('electron');

function createMainWindow({ iconPath, preloadPath, log }) {
  log?.debug?.('Creating main window');
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    title: 'BanPick.AI',
    icon: iconPath,
    frame: false,
    backgroundColor: '#f5f4ff',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenu(null);
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));
  mainWindow.loadFile('index.html');
  return mainWindow;
}

function hasOpenWindows() {
  return BrowserWindow.getAllWindows().length > 0;
}

function getWindowForEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function minimizeWindow(event) {
  getWindowForEvent(event)?.minimize();
}

function toggleMaximizeWindow(event) {
  const window = getWindowForEvent(event);
  if (!window) return false;

  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }

  return window.isMaximized();
}

function closeWindow(event) {
  getWindowForEvent(event)?.close();
}

module.exports = {
  closeWindow,
  createMainWindow,
  hasOpenWindows,
  minimizeWindow,
  toggleMaximizeWindow
};
