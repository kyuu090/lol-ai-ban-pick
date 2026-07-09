const { BrowserWindow } = require('electron');

type IpcEventWithSender = { sender: Electron.WebContents };

interface CreateMainWindowDeps {
  htmlPath: string;
  iconPath: string;
  preloadPath: string;
  log?: {
    debug?: (message: string, details?: unknown) => void;
  };
}

interface CreateSplashWindowDeps {
  iconPath: string;
  splashHtmlPath: string;
  preloadPath: string;
  log?: {
    debug?: (message: string, details?: unknown) => void;
  };
}

function createMainWindow({ htmlPath, iconPath, preloadPath, log }: CreateMainWindowDeps): Electron.BrowserWindow {
  log?.debug?.('Creating main window');
  const mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    minWidth: 1200,
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
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));
  mainWindow.loadFile(htmlPath);
  return mainWindow;
}

function createSplashWindow({ iconPath, splashHtmlPath, preloadPath, log }: CreateSplashWindowDeps): Electron.BrowserWindow {
  log?.debug?.('Creating splash window');
  const splashWindow = new BrowserWindow({
    width: 520,
    height: 330,
    minWidth: 520,
    minHeight: 330,
    maxWidth: 520,
    maxHeight: 330,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    movable: true,
    show: true,
    center: true,
    title: 'BanPick.AI',
    icon: iconPath,
    frame: false,
    transparent: false,
    backgroundColor: '#f5f4ff',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.setMenu(null);
  splashWindow.loadFile(splashHtmlPath);
  return splashWindow;
}

function hasOpenWindows(): boolean {
  return BrowserWindow.getAllWindows().length > 0;
}

function getWindowForEvent(event: IpcEventWithSender): Electron.BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function minimizeWindow(event: IpcEventWithSender): void {
  getWindowForEvent(event)?.minimize();
}

function toggleMaximizeWindow(event: IpcEventWithSender): boolean {
  const window = getWindowForEvent(event);
  if (!window) return false;

  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }

  return window.isMaximized();
}

function closeWindow(event: IpcEventWithSender): void {
  getWindowForEvent(event)?.close();
}

export = {
  closeWindow,
  createMainWindow,
  createSplashWindow,
  hasOpenWindows,
  minimizeWindow,
  toggleMaximizeWindow
};
