const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectMissingMatchIds,
  createAnalysisMatchIds,
  hasCachedRiotMatchDetail,
  mergeMatchIds
} = require('../match-history-workflow');

function createHistory(matchIds, puuid = 'storage-puuid') {
  return {
    source: 'riot-api',
    puuid,
    matches: matchIds.map((matchId) => ({ matchId }))
  };
}

test('mergeMatchIds keeps first occurrence and removes duplicates', () => {
  assert.deepEqual(
    mergeMatchIds(['recent-1', 'recent-2'], ['recent-2', 'season-91'], ['recent-1', 'season-92']),
    ['recent-1', 'recent-2', 'season-91', 'season-92']
  );
});

test('recent analysis keeps existing history matches without duplicating recent ids', () => {
  const recentIds = ['match-1', 'match-2', 'match-3'];
  const existingHistory = createHistory(['match-2', 'match-3', 'match-4', 'match-5']);

  const analysisMatchIds = createAnalysisMatchIds({
    mode: 'recent',
    normalizedMatchIds: recentIds,
    existingHistory,
    storagePuuid: 'storage-puuid'
  });

  assert.deepEqual(analysisMatchIds, ['match-1', 'match-2', 'match-3', 'match-4', 'match-5']);
});

test('recent analysis ignores another account history', () => {
  const analysisMatchIds = createAnalysisMatchIds({
    mode: 'recent',
    normalizedMatchIds: ['match-1', 'match-2'],
    existingHistory: createHistory(['other-account-match'], 'other-puuid'),
    storagePuuid: 'storage-puuid'
  });

  assert.deepEqual(analysisMatchIds, ['match-1', 'match-2']);
});

test('season analysis uses only season ids', () => {
  const analysisMatchIds = createAnalysisMatchIds({
    mode: 'season',
    normalizedMatchIds: ['season-1', 'season-2'],
    existingHistory: createHistory(['old-history-1']),
    storagePuuid: 'storage-puuid'
  });

  assert.deepEqual(analysisMatchIds, ['season-1', 'season-2']);
});

test('collectMissingMatchIds skips only valid cached match details', () => {
  const matchesById = {
    cached: { metadata: { matchId: 'cached' }, info: {} },
    invalid: { metadata: { matchId: 'invalid' } }
  };

  assert.equal(hasCachedRiotMatchDetail(matchesById, 'cached'), true);
  assert.equal(hasCachedRiotMatchDetail(matchesById, 'invalid'), false);
  assert.deepEqual(
    collectMissingMatchIds(['cached', 'invalid', 'missing'], matchesById),
    ['invalid', 'missing']
  );
});
