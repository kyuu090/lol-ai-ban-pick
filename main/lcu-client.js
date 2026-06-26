const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const {
  createAuthHeader,
  parseLockfile
} = require('../lcu-logic');

function createLcuClient({
  getSettings,
  getConnection,
  getStatus,
  setIconUnavailableUntil,
  getIconUnavailableUntil,
  getIconUnavailableLogged,
  setIconUnavailableLogged,
  log,
  serializeForLog
}) {
  async function readLockfile() {
    let raw;
    const lockfilePath = path.join(getSettings().lolInstallDir, 'lockfile');
    log.debug('Reading LCU lockfile', { lockfilePath });

    try {
      raw = await fs.readFile(lockfilePath, 'utf8');
    } catch (error) {
      throw new Error(`LoLクライアントが起動していないか、ログインしていません: ${lockfilePath}`);
    }

    const { processName, pid, port, password, protocol } = parseLockfile(raw);

    log.debug('LCU lockfile parsed', { processName, pid, port, protocol });
    return { processName, pid, port, password, protocol };
  }

  async function fetchJson(endpoint) {
    const connection = getConnection();
    if (!connection) {
      throw new Error('LCU接続情報がありません');
    }

    const startedAt = Date.now();
    const url = `${connection.protocol}://127.0.0.1:${connection.port}${endpoint}`;
    log.debug('LCU request started', { endpoint, port: connection.port });
    const response = await requestLcuJson(url, {
      Authorization: createAuthHeader(connection.password),
      Accept: 'application/json'
    });
    log.debug('LCU request finished', {
      endpoint,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt
    });

    if (response.statusCode === 404) return null;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`${endpoint} returned HTTP ${response.statusCode}: ${response.body}`);
    }

    return response.body ? JSON.parse(response.body) : null;
  }

  async function fetchBuffer(endpoint) {
    const connection = getConnection();
    if (!connection) {
      throw new Error('LCU接続情報がありません');
    }

    const startedAt = Date.now();
    const url = `${connection.protocol}://127.0.0.1:${connection.port}${endpoint}`;
    const response = await requestLcu(url, {
      Authorization: createAuthHeader(connection.password),
      Accept: '*/*'
    });
    log.debug('LCU asset request finished', {
      endpoint,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`${endpoint} returned HTTP ${response.statusCode}`);
    }

    return response.body;
  }

  async function getChampionIcon(_event, championId) {
    const id = Number(championId);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!getConnection() || getStatus() !== 'connected') return null;
    if (Date.now() < getIconUnavailableUntil()) return null;

    try {
      const buffer = await fetchBuffer(`/lol-game-data/assets/v1/champion-icons/${id}.png`);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (error) {
      if (isTransientIconFetchError(error)) {
        setIconUnavailableUntil(Date.now() + 10000);

        if (!getIconUnavailableLogged()) {
          setIconUnavailableLogged(true);
          log.warn(
            `Champion icon fetch is temporarily unavailable; suppressing repeated icon errors. First failed championId=${id}`,
            serializeForLog(error)
          );
        }
      } else {
        log.warn(`Failed to fetch champion icon for championId=${id}`, serializeForLog(error));
      }

      return null;
    }
  }

  return {
    fetchBuffer,
    fetchJson,
    getChampionIcon,
    readLockfile
  };
}

function requestLcuJson(url, headers) {
  return requestLcu(url, headers).then((response) => ({
    ...response,
    body: response.body.toString('utf8')
  }));
}

function requestLcu(url, headers) {
  const client = url.startsWith('https:') ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'GET',
        headers,
        // LCU is a loopback-only local API that uses a self-signed certificate.
        // Authentication is the lockfile password in the Basic auth header.
        // lgtm[js/disabling-certificate-validation]
        rejectUnauthorized: false,
        timeout: 5000
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks)
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`LCU request timed out: ${url}`));
    });

    request.on('error', reject);
    request.end();
  });
}

function isTransientIconFetchError(error) {
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE'
  ].includes(error?.code) || String(error?.message || '').includes('LCU request timed out');
}

module.exports = {
  createLcuClient,
  isTransientIconFetchError,
  requestLcu,
  requestLcuJson
};
