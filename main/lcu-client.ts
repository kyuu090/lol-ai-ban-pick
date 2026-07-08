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
  getCachedChampionById?: (championId: number) => { alias?: string } | null | undefined;
  requestJsonFromUrl?: (url: string) => Promise<unknown>;
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
  getChampionCatalog: () => Promise<Record<number, { id: number; name: string; alias?: string; title?: string }>>;
  getChampionIcon: (_event: unknown, championId: unknown) => Promise<string | null>;
  readLockfile: () => Promise<LcuConnection>;
}

const DATA_DRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';
const DATA_DRAGON_LOCALE = 'en_US';

function createLcuClient({
  getSettings,
  getConnection,
  getStatus,
  getCachedChampionById,
  requestJsonFromUrl,
  setIconUnavailableUntil,
  getIconUnavailableUntil,
  getIconUnavailableLogged,
  setIconUnavailableLogged,
  log,
  serializeForLog
}: LcuClientDeps): LcuClient {
  const requestJson = requestJsonFromUrl || requestJsonFromUrlDefault;
  const dataDragonIconCache = new Map<number, Promise<string | null>>();
  let dataDragonVersionPromise: Promise<string | null> | null = null;
  let dataDragonAliasMapPromise: Promise<Record<number, string> | null> | null = null;
  let dataDragonChampionCatalogPromise: Promise<Record<number, { id: number; name: string; alias?: string; title?: string }> | null> | null = null;

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
    const canUseLcu = Boolean(getConnection()) && getStatus() === 'connected' && Date.now() >= getIconUnavailableUntil();

    if (canUseLcu) {
      try {
        const buffer = await fetchBuffer(`/lol-game-data/assets/v1/champion-icons/${id}.png`);
        return `data:image/png;base64,${buffer.toString('base64')}`;
      } catch (error) {
        if (isTransientIconFetchError(error)) {
          setIconUnavailableUntil(Date.now() + 10000);

          if (!getIconUnavailableLogged()) {
            setIconUnavailableLogged(true);
            log.warn(
              `Champion icon fetch is temporarily unavailable; falling back to Data Dragon. First failed championId=${id}`,
              serializeForLog(error)
            );
          }
        } else {
          log.warn(`Failed to fetch champion icon from LCU for championId=${id}; falling back to Data Dragon`, serializeForLog(error));
        }
      }
    }

    return getDataDragonChampionIcon(id);
  }

  async function getDataDragonChampionIcon(championId: number): Promise<string | null> {
    const cached = dataDragonIconCache.get(championId);
    if (cached) return cached;

    const iconPromise = resolveDataDragonChampionIcon(championId)
      .catch((error) => {
        log.warn(`Failed to fetch champion icon from Data Dragon for championId=${championId}`, serializeForLog(error));
        return null;
      });

    dataDragonIconCache.set(championId, iconPromise);
    return iconPromise;
  }

  async function resolveDataDragonChampionIcon(championId: number): Promise<string | null> {
    const version = await getLatestDataDragonVersion();
    if (!version) return null;

    const alias = await getDataDragonChampionAlias(championId);
    if (!alias) return null;

    return buildDataDragonChampionIconUrl(version, alias);
  }

  async function getLatestDataDragonVersion(): Promise<string | null> {
    if (!dataDragonVersionPromise) {
      dataDragonVersionPromise = requestJson(`${DATA_DRAGON_BASE_URL}/api/versions.json`)
        .then((response) => {
          const versions = Array.isArray(response) ? response : [];
          const latestVersion = String(versions[0] || '').trim();
          return latestVersion || null;
        })
        .catch((error) => {
          dataDragonVersionPromise = null;
          throw error;
        });
    }

    return dataDragonVersionPromise;
  }

  async function getDataDragonChampionAlias(championId: number): Promise<string | null> {
    const cachedAlias = String(getCachedChampionById?.(championId)?.alias || '').trim();
    if (cachedAlias) return cachedAlias;

    const aliasMap = await getDataDragonChampionAliasMap();
    return String(aliasMap?.[championId] || '').trim() || null;
  }

  async function getDataDragonChampionAliasMap(): Promise<Record<number, string> | null> {
    if (!dataDragonAliasMapPromise) {
      dataDragonAliasMapPromise = getLatestDataDragonVersion()
        .then((version) => {
          if (!version) return null;
          return requestJson(`${DATA_DRAGON_BASE_URL}/cdn/${version}/data/${DATA_DRAGON_LOCALE}/champion.json`);
        })
        .then((response) => createDataDragonChampionAliasMap(response))
        .catch((error) => {
          dataDragonAliasMapPromise = null;
          throw error;
        });
    }

    return dataDragonAliasMapPromise;
  }

  async function getDataDragonChampionCatalog(): Promise<Record<number, { id: number; name: string; alias?: string; title?: string }> | null> {
    if (!dataDragonChampionCatalogPromise) {
      dataDragonChampionCatalogPromise = getLatestDataDragonVersion()
        .then((version) => {
          if (!version) return null;
          return requestJson(`${DATA_DRAGON_BASE_URL}/cdn/${version}/data/${DATA_DRAGON_LOCALE}/champion.json`);
        })
        .then((response) => createDataDragonChampionCatalog(response))
        .catch((error) => {
          dataDragonChampionCatalogPromise = null;
          throw error;
        });
    }

    return dataDragonChampionCatalogPromise;
  }

  return {
    fetchBuffer,
    fetchJson,
    getChampionCatalog: async () => (await getDataDragonChampionCatalog()) || {},
    getChampionIcon,
    readLockfile
  };
}

function buildDataDragonChampionIconUrl(version: string, alias: string): string | null {
  const normalizedVersion = String(version || '').trim();
  const normalizedAlias = String(alias || '').trim();
  if (!normalizedVersion || !normalizedAlias) return null;

  return `${DATA_DRAGON_BASE_URL}/cdn/${encodeURIComponent(normalizedVersion)}/img/champion/${encodeURIComponent(normalizedAlias)}.png`;
}

function createDataDragonChampionAliasMap(payload: unknown): Record<number, string> {
  const data = payload && typeof payload === 'object'
    ? (payload as { data?: Record<string, { key?: string; id?: string }> }).data
    : null;
  const champions = data && typeof data === 'object' ? Object.values(data) : [];

  return champions.reduce((acc, champion) => {
    const championId = Number(champion?.key);
    const alias = String(champion?.id || '').trim();
    if (!Number.isInteger(championId) || championId <= 0 || !alias) return acc;
    acc[championId] = alias;
    return acc;
  }, {} as Record<number, string>);
}

function createDataDragonChampionCatalog(
  payload: unknown
): Record<number, { id: number; name: string; alias?: string; title?: string }> {
  const data = payload && typeof payload === 'object'
    ? (payload as { data?: Record<string, { key?: string; id?: string; name?: string; title?: string }> }).data
    : null;
  const champions = data && typeof data === 'object' ? Object.values(data) : [];

  return champions.reduce((acc, champion) => {
    const championId = Number(champion?.key);
    const name = String(champion?.name || '').trim();
    const alias = String(champion?.id || '').trim();
    const title = String(champion?.title || '').trim();
    if (!Number.isInteger(championId) || championId <= 0 || !alias || !name) return acc;
    acc[championId] = {
      id: championId,
      name,
      alias,
      title: title || undefined
    };
    return acc;
  }, {} as Record<number, { id: number; name: string; alias?: string; title?: string }>);
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

function requestJsonFromUrlDefault(url: string): Promise<unknown> {
  return requestUrl(url, {
    Accept: 'application/json'
  }).then((response) => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Request failed: ${url} returned HTTP ${response.statusCode}`);
    }

    return response.body.length ? JSON.parse(response.body.toString('utf8')) : null;
  });
}

function requestUrl(url: string, headers: Record<string, string>): Promise<LcuHttpResponse<Buffer>> {
  const client = url.startsWith('https:') ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'GET',
        headers,
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
      request.destroy(new Error(`Request timed out: ${url}`));
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
  buildDataDragonChampionIconUrl,
  createDataDragonChampionCatalog,
  createDataDragonChampionAliasMap,
  createLcuClient,
  isTransientIconFetchError,
  requestLcu,
  requestLcuJson
};
