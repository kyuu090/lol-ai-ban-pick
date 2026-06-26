const {
  DEFAULT_RIOT_BFF_BASE_URL,
  requestRiotBffJson
} = require('../riot-api');

function encodePathSegment(value) {
  return encodeURIComponent(String(value));
}

function createRiotBffPath(region, segments, query = null) {
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
}) {
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

function requestPickPhaseAnalysis(_event, draftContext) {
  return requestBffJson({
    path: '/api/openai/pick-phase',
    method: 'POST',
    body: draftContext,
    timeoutMs: 30000,
    maxRetries: 0
  });
}

function requestFinalCompositionAnalysis(_event, draftContext) {
  return requestBffJson({
    path: '/api/openai/final-composition',
    method: 'POST',
    body: draftContext,
    timeoutMs: 30000,
    maxRetries: 0
  });
}

function requestLaneMatchupAnalysis(laneMatchupPayload) {
  return requestBffJson({
    path: '/api/openai/lane-matchup',
    method: 'POST',
    body: laneMatchupPayload,
    timeoutMs: 30000,
    maxRetries: 0
  });
}

module.exports = {
  createRiotBffPath,
  requestBffJson,
  requestFinalCompositionAnalysis,
  requestLaneMatchupAnalysis,
  requestPickPhaseAnalysis
};
