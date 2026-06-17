const https = require('node:https');

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
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

function normalizeRiotPlatformRegion(value) {
  const region = String(value || '').trim().toUpperCase();
  return RIOT_PLATFORM_REGIONS.includes(region) ? region : DEFAULT_RIOT_PLATFORM_REGION;
}

function getRiotRegionalRoute(platformRegion) {
  return PLATFORM_TO_REGIONAL_ROUTE[normalizeRiotPlatformRegion(platformRegion)] || 'ASIA';
}

function createRiotApiHosts(platformRegion) {
  const normalizedPlatformRegion = normalizeRiotPlatformRegion(platformRegion);
  const regionalRoute = getRiotRegionalRoute(normalizedPlatformRegion);

  return {
    platformRegion: normalizedPlatformRegion,
    regionalRoute,
    platformHost: `${normalizedPlatformRegion.toLowerCase()}.api.riotgames.com`,
    regionalHost: `${regionalRoute.toLowerCase()}.api.riotgames.com`
  };
}

function parseRetryAfterMs(value) {
  if (value === undefined || value === null || value === '') return null;

  const retryAfterSeconds = Number(value);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.ceil(retryAfterSeconds * 1000);
  }

  const retryAfterDateMs = Date.parse(String(value));
  if (Number.isNaN(retryAfterDateMs)) return null;

  return Math.max(0, retryAfterDateMs - Date.now());
}

function getRetryDelayMs(response, attempt) {
  const headers = response?.headers || {};
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
  const retryAfterMs = parseRetryAfterMs(retryAfter);
  if (retryAfterMs !== null) return retryAfterMs;

  return DEFAULT_RETRY_DELAY_MS * Math.max(1, attempt + 1);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function requestRiotJson(options) {
  const {
    host,
    path,
    apiToken,
    maxRetries = DEFAULT_MAX_RETRIES,
    requestFn = requestHttpsJson,
    wait = delay
  } = options || {};

  if (!host) throw new Error('Riot API host is required');
  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('Riot API path must start with /');
  }
  if (!apiToken) throw new Error('Riot APIトークンが未設定です');

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await requestFn({
      host,
      path,
      headers: {
        Accept: 'application/json',
        'X-Riot-Token': apiToken
      }
    });

    if (response.statusCode === 429 && attempt < maxRetries) {
      await wait(getRetryDelayMs(response, attempt));
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Riot API ${path} returned HTTP ${response.statusCode}: ${response.body}`);
    }

    return response.body ? JSON.parse(response.body) : null;
  }

  throw new Error(`Riot API ${path} retry limit exceeded`);
}

function requestHttpsJson({ host, path, headers }) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        method: 'GET',
        host,
        path,
        headers,
        timeout: 10000
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(chunk));
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
      request.destroy(new Error(`Riot API request timed out: ${host}${path}`));
    });

    request.on('error', reject);
    request.end();
  });
}

module.exports = {
  RIOT_PLATFORM_REGIONS,
  DEFAULT_RIOT_PLATFORM_REGION,
  normalizeRiotPlatformRegion,
  getRiotRegionalRoute,
  createRiotApiHosts,
  parseRetryAfterMs,
  getRetryDelayMs,
  requestRiotJson
};
