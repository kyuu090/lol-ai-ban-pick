const {
  DEFAULT_RIOT_BFF_BASE_URL,
  requestRiotBffJson
} = require('../riot-api');

type HttpMethod = 'GET' | 'POST';
type RetryCallback = (context: unknown) => void | Promise<void>;
type RequestFn = (...args: unknown[]) => unknown;

interface RequestBffJsonOptions {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  timeoutMs?: number;
  onRetry?: RetryCallback | null;
  maxRetries?: number;
  requestFn?: RequestFn;
}

interface AiAnalysisService {
  createRiotBffPath: typeof createRiotBffPath;
  requestBffJson: typeof requestBffJson;
  requestFinalCompositionAnalysis: typeof requestFinalCompositionAnalysis;
  requestLaneMatchupAnalysis: typeof requestLaneMatchupAnalysis;
  requestPickPhaseAnalysis: typeof requestPickPhaseAnalysis;
}

function encodePathSegment(value: string | number): string {
  return encodeURIComponent(String(value));
}

function createRiotBffPath(
  region: string,
  segments: Array<string | number>,
  query: Record<string, string | number | null | undefined> | null = null
): string {
  const path = `/api/riot/${[
    region,
    ...segments
  ].map(encodePathSegment).join('/')}`;

  if (!query) return path;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function requestBffJson({
  path,
  method = 'GET',
  body = null,
  timeoutMs = undefined,
  onRetry = null,
  maxRetries = undefined,
  requestFn = undefined
}: RequestBffJsonOptions): Promise<unknown> {
  return requestRiotBffJson({
    baseUrl: DEFAULT_RIOT_BFF_BASE_URL,
    path,
    method,
    body,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    onRetry,
    ...(maxRetries === undefined ? {} : { maxRetries }),
    ...(requestFn === undefined ? {} : { requestFn })
  });
}

function requestPickPhaseAnalysis(_event: unknown, draftContext: unknown): Promise<unknown> {
  return requestBffJson({
    path: '/api/openai/pick-phase',
    method: 'POST',
    body: draftContext,
    timeoutMs: 30000,
    maxRetries: 0
  });
}

function requestFinalCompositionAnalysis(_event: unknown, draftContext: unknown): Promise<unknown> {
  return requestBffJson({
    path: '/api/openai/final-composition',
    method: 'POST',
    body: draftContext,
    timeoutMs: 30000,
    maxRetries: 0
  });
}

function requestLaneMatchupAnalysis(laneMatchupPayload: unknown): Promise<unknown> {
  return requestBffJson({
    path: '/api/openai/lane-matchup',
    method: 'POST',
    body: laneMatchupPayload,
    timeoutMs: 30000,
    maxRetries: 0
  });
}

const service: AiAnalysisService = {
  createRiotBffPath,
  requestBffJson,
  requestFinalCompositionAnalysis,
  requestLaneMatchupAnalysis,
  requestPickPhaseAnalysis
};

export = service;
