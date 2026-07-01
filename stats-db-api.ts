type StatsDbApiErrorDetails = {
  body?: string;
  path?: string;
  retryAfterSeconds?: number | null;
  statusCode?: number | null;
};

type RequestStatsDbApiJsonOptions = {
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

const DEFAULT_STATS_DB_API_BASE_URL = 'https://db.banpick-ai.lol';
const STATS_DB_API_DEFAULT_RETRY_AFTER_SECONDS = 5;
const ALLOWED_STATS_DB_API_PATHS = new Set([
  '/v1/stats/meta',
  '/v1/stats/champions'
]);

class StatsDbApiError extends Error {
  body: string;
  path: string;
  retryAfterSeconds: number | null;
  statusCode: number | null;

  constructor(message: string, details: StatsDbApiErrorDetails = {}) {
    super(message);
    this.name = 'StatsDbApiError';
    this.body = details.body ?? '';
    this.path = details.path ?? '';
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
    this.statusCode = details.statusCode ?? null;
  }
}

function normalizeStatsDbApiBaseUrl(value: any): string {
  const baseUrl = String(value || '').trim() || DEFAULT_STATS_DB_API_BASE_URL;

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:') {
      return DEFAULT_STATS_DB_API_BASE_URL;
    }

    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_STATS_DB_API_BASE_URL;
  }
}

function createStatsDbApiUrl(pathOrUrl: unknown, baseUrl = DEFAULT_STATS_DB_API_BASE_URL): URL {
  const normalizedBaseUrl = normalizeStatsDbApiBaseUrl(baseUrl);
  const url = new URL(String(pathOrUrl || ''), `${normalizedBaseUrl}/`);
  if (url.origin !== normalizedBaseUrl || !ALLOWED_STATS_DB_API_PATHS.has(url.pathname)) {
    throw new Error('StatsAPI endpoint is not allowed.');
  }
  return url;
}

function parseStatsDbRetryAfterSeconds(value: any, now = Date.now()): number | null {
  if (value === undefined || value === null || value === '') return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds));
  }

  const retryAfterDateMs = Date.parse(String(value));
  if (Number.isNaN(retryAfterDateMs)) return null;

  return Math.max(1, Math.ceil((retryAfterDateMs - now) / 1000));
}

async function requestStatsDbApiJson(pathOrUrl: unknown, options: RequestStatsDbApiJsonOptions = {}): Promise<any> {
  const {
    baseUrl = DEFAULT_STATS_DB_API_BASE_URL,
    fetchFn = fetch
  } = options;
  const url = createStatsDbApiUrl(pathOrUrl, baseUrl);
  const response = await fetchFn(url);
  const body = await response.text();

  if (!response.ok) {
    const retryAfterSeconds = parseStatsDbRetryAfterSeconds(response.headers.get('retry-after')) ||
      (response.status === 429 ? STATS_DB_API_DEFAULT_RETRY_AFTER_SECONDS : null);
    const retryMessage = Number.isFinite(retryAfterSeconds)
      ? `; retryAfterSeconds=${retryAfterSeconds}`
      : '';
    throw new StatsDbApiError(`StatsAPI request failed: ${response.status}${retryMessage}`, {
      body,
      path: url.pathname,
      retryAfterSeconds,
      statusCode: response.status
    });
  }

  return body ? JSON.parse(body) : null;
}

module.exports = {
  DEFAULT_STATS_DB_API_BASE_URL,
  STATS_DB_API_DEFAULT_RETRY_AFTER_SECONDS,
  StatsDbApiError,
  createStatsDbApiUrl,
  normalizeStatsDbApiBaseUrl,
  parseStatsDbRetryAfterSeconds,
  requestStatsDbApiJson
};
