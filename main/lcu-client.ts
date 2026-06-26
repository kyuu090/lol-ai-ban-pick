const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const {
  createAuthHeader,
  parseLockfile
} = require('../lcu-logic');

import type { PublicSettings } from '../types/domain/settings';

interface LcuConnection {
  processName?: string;
  pid?: string | number;
  port: string | number;
  password: string;
  protocol: 'http' | 'https' | string;
}

interface LcuClientDeps {
  getSettings: () => PublicSettings;
  getConnection: () => LcuConnection | null;
  getStatus: () => string;
  setIconUnavailableUntil: (value: number) => void;
  getIconUnavailableUntil: () => number;
  getIconUnavailableLogged: () => boolean;
  setIconUnavailableLogged: (value: boolean) => void;
  log: {
    debug: (message: string, details?: unknown) => void;
    warn: (message: string, details?: unknown) => void;
  };
  serializeForLog: (error: unknown) => unknown;
}

interface LcuHttpResponse<TBody> {
  statusCode: number;
  body: TBody;
}

interface LcuClient {
  fetchBuffer: (endpoint: string) => Promise<Buffer>;
  fetchJson: (endpoint: string) => Promise<unknown>;
  getChampionIcon: (_event: unknown, championId: unknown) => Promise<string | null>;
  readLockfile: () => Promise<LcuConnection>;
}

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
}: LcuClientDeps): LcuClient {
  async function readLockfile(): Promise<LcuConnection> {
    let raw: string;
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

  async function fetchJson(endpoint: string): Promise<unknown> {
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

  async function fetchBuffer(endpoint: string): Promise<Buffer> {
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

  async function getChampionIcon(_event: unknown, championId: unknown): Promise<string | null> {
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

function requestLcuJson(url: string, headers: Record<string, string>): Promise<LcuHttpResponse<string>> {
  return requestLcu(url, headers).then((response) => ({
    ...response,
    body: response.body.toString('utf8')
  }));
}

function requestLcu(url: string, headers: Record<string, string>): Promise<LcuHttpResponse<Buffer>> {
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
      (response: import('node:http').IncomingMessage) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => chunks.push(chunk));
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

function isTransientIconFetchError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE'
  ].includes(candidate?.code ?? '') || String(candidate?.message || '').includes('LCU request timed out');
}

export = {
  createLcuClient,
  isTransientIconFetchError,
  requestLcu,
  requestLcuJson
};
