const { BrowserWindow } = require('electron');

type IpcEventWithSender = { sender: Electron.WebContents };

interface CreateMainWindowDeps {
  iconPath: string;
  preloadPath: string;
  log?: {
    debug?: (message: string, details?: unknown) => void;
  };
}

function createMainWindow({ iconPath, preloadPath, log }: CreateMainWindowDeps): Electron.BrowserWindow {
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
  hasOpenWindows,
  minimizeWindow,
  toggleMaximizeWindow
};
