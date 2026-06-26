// @ts-check

/**
 * @typedef {import('./types/domain/match-history').MatchHistoryMode} MatchHistoryMode
 */

/**
 * @typedef {object} StoredMatchHistory
 * @property {'riot-api' | string} [source]
 * @property {string} [puuid]
 * @property {{ matchId?: string | number }[]} [matches]
 */

/**
 * @param {Record<string, unknown>} matchesById
 * @param {string | number} matchId
 * @returns {boolean}
 */
function hasCachedRiotMatchDetail(matchesById, matchId) {
  const detail = /** @type {{ metadata?: unknown, info?: unknown } | null | undefined} */ (matchesById?.[matchId]);
  return Boolean(detail && typeof detail === 'object' && detail.metadata && detail.info);
}

/**
 * @param {StoredMatchHistory | null | undefined} history
 * @returns {(string | number)[]}
 */
function collectHistoryMatchIds(history) {
  if (!history || history.source !== 'riot-api' || !Array.isArray(history.matches)) return [];

  return history.matches.reduce((matchIds, match) => {
    const matchId = match?.matchId;
    if (matchId) matchIds.push(matchId);
    return matchIds;
  }, /** @type {(string | number)[]} */ ([]));
}

/**
 * @param {...(string | number)[]} matchIdLists
 * @returns {(string | number)[]}
 */
function mergeMatchIds(...matchIdLists) {
  const seen = new Set();
  /** @type {(string | number)[]} */
  const merged = [];

  matchIdLists.flat().forEach((matchId) => {
    if (!matchId || seen.has(matchId)) return;
    seen.add(matchId);
    merged.push(matchId);
  });

  return merged;
}

/**
 * @param {object} options
 * @param {MatchHistoryMode} options.mode
 * @param {(string | number)[]} options.normalizedMatchIds
 * @param {StoredMatchHistory | null | undefined} options.existingHistory
 * @param {string} options.storagePuuid
 * @returns {(string | number)[]}
 */
function createAnalysisMatchIds({ mode, normalizedMatchIds, existingHistory, storagePuuid }) {
  if (mode === 'season') return normalizedMatchIds;

  const existingHistoryMatchIds = existingHistory?.puuid === storagePuuid
    ? collectHistoryMatchIds(existingHistory)
    : [];
  return mergeMatchIds(normalizedMatchIds, existingHistoryMatchIds);
}

/**
 * @param {(string | number)[]} matchIds
 * @param {Record<string, unknown>} matchesById
 * @returns {(string | number)[]}
 */
function collectMissingMatchIds(matchIds, matchesById) {
  return matchIds.filter((matchId) => !hasCachedRiotMatchDetail(matchesById, matchId));
}

module.exports = {
  collectHistoryMatchIds,
  collectMissingMatchIds,
  createAnalysisMatchIds,
  hasCachedRiotMatchDetail,
  mergeMatchIds
};
