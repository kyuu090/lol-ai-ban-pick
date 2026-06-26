const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatAverageKda,
  formatDate,
  formatMatchDataDate,
  formatNumber,
  formatPercent
} = require('../ui/formatters');

test('formatters keep renderer display values stable', () => {
  assert.equal(formatDate(null), '-');
  assert.equal(formatMatchDataDate(null), null);
  assert.equal(formatPercent(0.534), '53%');
  assert.equal(formatNumber(2), '2.0');
  assert.equal(formatNumber(2.345, 2), '2.35');
  assert.equal(formatAverageKda({ avgKills: 2, avgDeaths: 3.456, avgAssists: 10 }), '2.0/3.5/10.0');
});
