const http = require('node:http');
const https = require('node:https');

type RiotApiErrorDetails = {
  statusCode?: number | null;
  path?: string;
  body?: string;
};

type HttpJsonResponse = {
  statusCode: number;
  headers: Record<string, any>;
  body: string;
};

type RequestHttpJsonOptions = {
  url: URL;
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  timeoutMs?: number;
};

type RequestRiotBffJsonOptions = {
  baseUrl?: string;
  path: string;
  method?: string;
  body?: any;
  timeoutMs?: number;
  maxRetries?: number;
  requestFn?: (options: RequestHttpJsonOptions) => Promise<HttpJsonResponse>;
  wait?: (ms: number) => Promise<void>;
  onRetry?: ((retry: { attempt: number; delayMs: number; response: HttpJsonResponse }) => void | Promise<void>) | null;
};

const RIOT_PLATFORM_REGIONS = [
  'BR1',
  'EUN1',
  'EUW1',
  'JP1',
  'KR',
  'LA1',
  'LA2',
  'NA1',
  'OC1',
  'TR1',
  'RU',
  'PH2',
  'SG2',
  'TH2',
  'TW2',
  'VN2'
];

const PLATFORM_TO_REGIONAL_ROUTE = {
  BR1: 'AMERICAS',
  LA1: 'AMERICAS',
  LA2: 'AMERICAS',
  NA1: 'AMERICAS',
  EUN1: 'EUROPE',
  EUW1: 'EUROPE',
  TR1: 'EUROPE',
  RU: 'EUROPE',
  JP1: 'ASIA',
  KR: 'ASIA',
  OC1: 'SEA',
  PH2: 'SEA',
  SG2: 'SEA',
  TH2: 'SEA',
  TW2: 'SEA',
  VN2: 'SEA'
};

const DEFAULT_RIOT_PLATFORM_REGION = 'JP1';
const DEFAULT_RIOT_BFF_BASE_URL = 'https://lol-ai-ban-pick-bff-production.up.railway.app';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 30000;

class RiotApiError extends Error {
  statusCode: number | null;
  path: string;
  body: string;

  constructor(message: string, details: RiotApiErrorDetails = {}) {
    super(message);
    this.name = 'RiotApiError';
    this.statusCode = details.statusCode ?? null;
    this.path = details.path ?? '';
    this.body = details.body ?? '';
  }
}

function normalizeRiotPlatformRegion(value: any): string {
  const region = String(value || '').trim().toUpperCase();
  return RIOT_PLATFORM_REGIONS.includes(region) ? region : DEFAULT_RIOT_PLATFORM_REGION;
}

function normalizeRiotBffBaseUrl(value: any): string {
  const baseUrl = String(value || '').trim() || DEFAULT_RIOT_BFF_BASE_URL;

  try {
    const parsed = new URL(baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return DEFAULT_RIOT_BFF_BASE_URL;
    }

    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_RIOT_BFF_BASE_URL;
  }
}

function getRiotRegionalRoute(platformRegion: any): string {
  return (PLATFORM_TO_REGIONAL_ROUTE as Record<string, string>)[normalizeRiotPlatformRegion(platformRegion)] || 'ASIA';
}

function createRiotApiHosts(platformRegion: any) {
  const normalizedPlatformRegion = normalizeRiotPlatformRegion(platformRegion);
  const regionalRoute = getRiotRegionalRoute(normalizedPlatformRegion);

  return {
    platformRegion: normalizedPlatformRegion,
    regionalRoute,
    platformHost: `${normalizedPlatformRegion.toLowerCase()}.api.riotgames.com`,
    regionalHost: `${regionalRoute.toLowerCase()}.api.riotgames.com`
  };
}

function parseRetryAfterMs(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;

  const retryAfterSeconds = Number(value);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.ceil(retryAfterSeconds * 1000);
  }

  const retryAfterDateMs = Date.parse(String(value));
  if (Number.isNaN(retryAfterDateMs)) return null;

  return Math.max(0, retryAfterDateMs - Date.now());
}

function getRetryDelayMs(response: Partial<HttpJsonResponse> | null | undefined, attempt: number): number {
  const headers = response?.headers || {};
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
  const retryAfterMs = parseRetryAfterMs(retryAfter);
  if (retryAfterMs !== null) return retryAfterMs;

  return DEFAULT_RETRY_DELAY_MS * Math.max(1, attempt + 1);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestRiotBffJson(options: RequestRiotBffJsonOptions): Promise<any> {
  const {
    baseUrl = DEFAULT_RIOT_BFF_BASE_URL,
    path,
    method = 'GET',
    body = null,
    timeoutMs = 10000,
    maxRetries = DEFAULT_MAX_RETRIES,
    requestFn = requestHttpJson,
    wait = delay,
    onRetry = null
  } = options || {};

  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('BFF API path must start with /');
  }

  const url = new URL(path, `${normalizeRiotBffBaseUrl(baseUrl)}/`);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await requestFn({
      url,
      method,
      headers: {
        Accept: 'application/json',
        ...(body === null || body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === null || body === undefined ? null : JSON.stringify(body),
      timeoutMs
    });

    if (response.statusCode === 429 && attempt < maxRetries) {
      const delayMs = getRetryDelayMs(response, attempt);
      if (typeof onRetry === 'function') {
        await onRetry({ attempt: attempt + 1, delayMs, response });
      }
      await wait(delayMs);
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new RiotApiError(`Riot BFF ${path} returned HTTP ${response.statusCode}: ${response.body}`, {
        statusCode: response.statusCode,
        path,
        body: response.body
      });
    }

    return response.body ? JSON.parse(response.body) : null;
  }

  throw new Error(`Riot BFF ${path} retry limit exceeded`);
}

function requestHttpJson({ url, method = 'GET', headers, body = null, timeoutMs = 10000 }: RequestHttpJsonOptions): Promise<HttpJsonResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(
      url,
      {
        method,
        headers,
        timeout: timeoutMs
      },
      (response: any) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8')
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Riot BFF request timed out: ${url.toString()}`));
    });

    request.on('error', reject);
    if (body !== null && body !== undefined) {
      request.write(body);
    }
    request.end();
  });
}

module.exports = {
  RiotApiError,
  RIOT_PLATFORM_REGIONS,
  DEFAULT_RIOT_PLATFORM_REGION,
  DEFAULT_RIOT_BFF_BASE_URL,
  normalizeRiotPlatformRegion,
  normalizeRiotBffBaseUrl,
  getRiotRegionalRoute,
  createRiotApiHosts,
  parseRetryAfterMs,
  getRetryDelayMs,
  requestRiotBffJson
};
