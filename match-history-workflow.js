function hasCachedRiotMatchDetail(matchesById, matchId) {
  const detail = matchesById?.[matchId];
  return Boolean(detail && typeof detail === 'object' && detail.metadata && detail.info);
}

function collectHistoryMatchIds(history) {
  if (!history || history.source !== 'riot-api' || !Array.isArray(history.matches)) return [];

  return history.matches
    .map((match) => match?.matchId)
    .filter(Boolean);
}

function mergeMatchIds(...matchIdLists) {
  const seen = new Set();
  const merged = [];

  matchIdLists.flat().forEach((matchId) => {
    if (!matchId || seen.has(matchId)) return;
    seen.add(matchId);
    merged.push(matchId);
  });

  return merged;
}

function createAnalysisMatchIds({ mode, normalizedMatchIds, existingHistory, storagePuuid }) {
  if (mode === 'season') return normalizedMatchIds;

  const existingHistoryMatchIds = existingHistory?.puuid === storagePuuid
    ? collectHistoryMatchIds(existingHistory)
    : [];
  return mergeMatchIds(normalizedMatchIds, existingHistoryMatchIds);
}

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
