const WebSocket = require('ws');

import type { AppState } from '../types/domain/app-state';
import type { LcuJsonApiEvent } from '../types/domain/lcu';

interface LcuConnection {
  port: string | number;
  password: string;
}

type Timer = ReturnType<typeof setTimeout>;
type WebSocketLike = InstanceType<typeof WebSocket>;
type LcuWatchStatePatch = Omit<Partial<AppState>, 'lastEvent'> & { lastEvent?: unknown };

interface LcuWatchDeps {
  getConnection: () => LcuConnection | null;
  setConnection: (connection: LcuConnection | null) => void;
  updateState: (patch: LcuWatchStatePatch) => void;
  refreshLcuState: () => Promise<void>;
  applyWebSocketEvent: (event: LcuJsonApiEvent) => Promise<void>;
  lockfileRetryMs: number;
  websocketReconnectMs: number;
  log: {
    debug: (message: string, details?: unknown) => void;
    warn: (message: string, details?: unknown) => void;
  };
  serializeForLog: (error: unknown) => unknown;
  WebSocketImpl?: typeof WebSocket;
}

interface LcuWatch {
  cleanup: () => void;
  clearRetryTimer: () => void;
  closeWebSocket: () => void;
  connectWebSocket: () => void;
  scheduleRetry: () => void;
}

function normalizeLcuJsonApiEvent(value: unknown): LcuJsonApiEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as { uri?: unknown; eventType?: unknown; data?: unknown };
  return typeof event.uri === 'string'
    ? { ...event, uri: event.uri, eventType: typeof event.eventType === 'string' ? event.eventType : undefined, data: event.data }
    : null;
}

function createLcuWatch({
  getConnection,
  setConnection,
  updateState,
  refreshLcuState,
  applyWebSocketEvent,
  lockfileRetryMs,
  websocketReconnectMs,
  log,
  serializeForLog,
  WebSocketImpl = WebSocket
}: LcuWatchDeps): LcuWatch {
  let webSocket: WebSocketLike | null = null;
  let reconnectTimer: Timer | null = null;
  let retryTimer: Timer | null = null;

  function cleanup(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    clearRetryTimer();
    closeWebSocket();
  }

  function closeWebSocket(): void {
    if (webSocket) {
      log.debug('Closing LCU WebSocket');
      webSocket.removeAllListeners();
      webSocket.close();
      webSocket = null;
    }
  }

  function clearRetryTimer(): void {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(): void {
    if (retryTimer) return;
    log.debug('Scheduling lockfile retry', { delayMs: lockfileRetryMs });

    retryTimer = setTimeout(async () => {
      retryTimer = null;
      await refreshLcuState();
    }, lockfileRetryMs);
  }

  function scheduleReconnect(): void {
    if (reconnectTimer) return;
    log.debug('Scheduling WebSocket reconnect', { delayMs: websocketReconnectMs });

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      await refreshLcuState();
    }, websocketReconnectMs);
  }

  function connectWebSocket(): void {
    const connection = getConnection();
    if (!connection || webSocket?.readyState === WebSocketImpl.OPEN) return;

    if (webSocket) {
      webSocket.removeAllListeners();
      webSocket.close();
    }

    const wsUrl = createLcuWebSocketUrl(connection);
    log.debug('Connecting LCU WebSocket', { port: connection.port });

    webSocket = new WebSocketImpl(wsUrl, 'wamp', {
      // LCU is a loopback-only local WebSocket that uses a self-signed certificate.
      // Authentication is embedded in the URL from the lockfile credentials.
      // lgtm[js/disabling-certificate-validation]
      rejectUnauthorized: false
    });

    updateState({ websocketStatus: 'connecting' });

    webSocket.on('open', () => {
      log.debug('LCU WebSocket connected');
      updateState({ websocketStatus: 'connected', error: null });

      // WAMP subscribe format used by the League Client Update WebSocket.
      webSocket.send(JSON.stringify([5, 'OnJsonApiEvent']));
    });

    webSocket.on('message', async (data: Buffer | string) => {
      const raw = data.toString();
      let event: unknown;

      try {
        event = JSON.parse(raw);
      } catch {
        event = raw;
      }

      updateState({ lastEvent: event });

      const jsonApiEvent = Array.isArray(event) ? normalizeLcuJsonApiEvent(event[2]) : null;
      if (jsonApiEvent) {
        log.debug('LCU WebSocket event received', {
          uri: jsonApiEvent.uri,
          eventType: jsonApiEvent.eventType
        });
        await applyWebSocketEvent(jsonApiEvent);
      }
    });

    webSocket.on('close', () => {
      log.debug('LCU WebSocket closed');
      setConnection(null);
      updateState({
        lcuStatus: 'disconnected',
        websocketStatus: 'disconnected'
      });
      scheduleReconnect();
    });

    webSocket.on('error', (error: Error) => {
      log.warn('LCU WebSocket error', serializeForLog(error));
      updateState({
        websocketStatus: 'error',
        error: `WebSocket error: ${error.message}`
      });
    });
  }

  return {
    cleanup,
    clearRetryTimer,
    closeWebSocket,
    connectWebSocket,
    scheduleRetry
  };
}

function createLcuWebSocketUrl(connection: LcuConnection): string {
  return `wss://riot:${encodeURIComponent(connection.password)}@127.0.0.1:${connection.port}/`;
}

export = {
  createLcuWatch,
  createLcuWebSocketUrl
};
