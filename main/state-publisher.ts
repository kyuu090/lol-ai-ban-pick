import type { AppState } from '../types/domain/app-state';

type AppStatePatch = Partial<AppState>;

interface WebContentsLike {
  isDestroyed?: () => boolean;
  send: (channel: string, payload: unknown) => void;
}

interface BrowserWindowLike {
  isDestroyed: () => boolean;
  webContents: WebContentsLike;
}

interface StatePublisherDeps {
  initialState: AppState;
  applyStatePatch: (currentState: AppState, patch: AppStatePatch) => AppState;
  getWindow: () => BrowserWindowLike | null | undefined;
  log?: {
    debug: (message: string, details?: unknown) => void;
  };
}

interface StatePublisher {
  getState: () => AppState;
  sendState: () => void;
  updateState: (patch: AppStatePatch) => AppState;
}

function createStatePublisher({
  initialState,
  applyStatePatch,
  getWindow,
  log
}: StatePublisherDeps): StatePublisher {
  let appState = initialState;

  function sendState(): void {
    const mainWindow = getWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.webContents.isDestroyed?.()) return;
    try {
      mainWindow.webContents.send('lcu:state', appState);
    } catch (error) {
      log?.debug('Skipped state publish to unavailable renderer', error);
    }
  }

  function updateState(patch: AppStatePatch): AppState {
    appState = applyStatePatch(appState, patch);
    sendState();
    return appState;
  }

  return {
    getState: () => appState,
    sendState,
    updateState
  };
}

export = {
  createStatePublisher
};
