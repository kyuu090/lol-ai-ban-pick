const test = require('node:test');
const assert = require('node:assert/strict');

const {
  StatsDbApiError,
  createStatsDbApiUrl,
  parseStatsDbRetryAfterSeconds,
  requestStatsDbApiJson
} = require('../stats-db-api');

test('createStatsDbApiUrl allows only StatsAPI endpoints on the configured host', () => {
  assert.equal(createStatsDbApiUrl('/v1/stats/meta').toString(), 'https://db.banpick-ai.lol/v1/stats/meta');
  assert.equal(
    createStatsDbApiUrl('https://db.banpick-ai.lol/v1/stats/champions?patch=15.12').toString(),
    'https://db.banpick-ai.lol/v1/stats/champions?patch=15.12'
  );
  assert.throws(() => createStatsDbApiUrl('https://example.com/v1/stats/meta'), /not allowed/);
  assert.throws(() => createStatsDbApiUrl('/v1/stats/coverage'), /not allowed/);
});

test('requestStatsDbApiJson exposes status and Retry-After on failures', async () => {
  await assert.rejects(
    requestStatsDbApiJson('/v1/stats/meta', {
      fetchFn: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => '2.1' },
        text: async () => '{"error":"rate_limit"}'
      })
    }),
    (error) => {
      assert.ok(error instanceof StatsDbApiError);
      assert.equal(error.statusCode, 429);
      assert.equal(error.retryAfterSeconds, 3);
      assert.match(error.message, /retryAfterSeconds=3/);
      return true;
    }
  );
});

test('parseStatsDbRetryAfterSeconds supports seconds and dates', () => {
  assert.equal(parseStatsDbRetryAfterSeconds('1.5'), 2);
  assert.equal(parseStatsDbRetryAfterSeconds('bad-value'), null);
});
