const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyBffMatchDetailsResponse,
  getDefaultSeasonStartAt,
  normalizeBffMatchDetailsResponse,
  normalizeBffMatchIdsResponse
} = require('../main/riot-match-history-service');

test('Riot match history service normalizes BFF match id and detail responses', () => {
  assert.deepEqual(normalizeBffMatchIdsResponse({ matchIds: ['JP_1', 'JP_2'] }), ['JP_1', 'JP_2']);
  assert.deepEqual(normalizeBffMatchIdsResponse({ matchIds: null }), []);

  assert.deepEqual(
    normalizeBffMatchDetailsResponse({
      matchesById: { JP_1: { metadata: {} } },
      failedMatchIds: ['JP_2'],
      retryAfter: '2'
    }),
    {
      matchesById: { JP_1: { metadata: {} } },
      failedMatchIds: ['JP_2'],
      retryAfter: '2'
    }
  );
  assert.deepEqual(normalizeBffMatchDetailsResponse(null), {
    matchesById: {},
    failedMatchIds: [],
    retryAfter: null
  });
});

test('applyBffMatchDetailsResponse stores fetched details and leaves failed ids pending', () => {
  const pending = new Set(['JP_1', 'JP_2', 'JP_3']);
  const matchesById = {};

  const fetchedMatches = applyBffMatchDetailsResponse({
    response: {
      matchesById: {
        JP_1: { info: { gameId: 1 } }
      },
      failedMatchIds: ['JP_2']
    },
    pending,
    matchesById
  });

  assert.equal(fetchedMatches, 1);
  assert.deepEqual(matchesById, { JP_1: { info: { gameId: 1 } } });
  assert.deepEqual([...pending], ['JP_2']);
});

test('getDefaultSeasonStartAt uses the current year in JST', () => {
  assert.equal(
    getDefaultSeasonStartAt(new Date('2026-06-26T00:00:00.000Z')).toISOString(),
    '2025-12-31T15:00:00.000Z'
  );
});
