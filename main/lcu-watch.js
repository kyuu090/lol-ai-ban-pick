const WebSocket = require('ws');

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
}) {
  let webSocket = null;
  let reconnectTimer = null;
  let retryTimer = null;

  function cleanup() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    clearRetryTimer();
    closeWebSocket();
  }

  function closeWebSocket() {
    if (webSocket) {
      log.debug('Closing LCU WebSocket');
      webSocket.removeAllListeners();
      webSocket.close();
      webSocket = null;
    }
  }

  function clearRetryTimer() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry() {
    if (retryTimer) return;
    log.debug('Scheduling lockfile retry', { delayMs: lockfileRetryMs });

    retryTimer = setTimeout(async () => {
      retryTimer = null;
      await refreshLcuState();
    }, lockfileRetryMs);
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    log.debug('Scheduling WebSocket reconnect', { delayMs: websocketReconnectMs });

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      await refreshLcuState();
    }, websocketReconnectMs);
  }

  function connectWebSocket() {
    const connection = getConnection();
    if (!connection || webSocket?.readyState === WebSocketImpl.OPEN) return;

    if (webSocket) {
      webSocket.removeAllListeners();
      webSocket.close();
    }

    const wsUrl = createLcuWebSocketUrl(connection);
    log.debug('Connecting LCU WebSocket', { port: connection.port });

    webSocket = new WebSocketImpl(wsUrl, 'wamp', {
      rejectUnauthorized: false
    });

    updateState({ websocketStatus: 'connecting' });

    webSocket.on('open', () => {
      log.debug('LCU WebSocket connected');
      updateState({ websocketStatus: 'connected', error: null });

      // WAMP subscribe format used by the League Client Update WebSocket.
      webSocket.send(JSON.stringify([5, 'OnJsonApiEvent']));
    });

    webSocket.on('message', async (data) => {
      const raw = data.toString();
      let event;

      try {
        event = JSON.parse(raw);
      } catch {
        event = raw;
      }

      updateState({ lastEvent: event });

      if (Array.isArray(event) && event[2]?.uri) {
        log.debug('LCU WebSocket event received', {
          uri: event[2].uri,
          eventType: event[2].eventType
        });
        await applyWebSocketEvent(event[2]);
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

    webSocket.on('error', (error) => {
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

function createLcuWebSocketUrl(connection) {
  return `wss://riot:${encodeURIComponent(connection.password)}@127.0.0.1:${connection.port}/`;
}

module.exports = {
  createLcuWatch,
  createLcuWebSocketUrl
};
