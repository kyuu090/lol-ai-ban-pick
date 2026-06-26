const test = require('node:test');
const assert = require('node:assert/strict');
const { isTransientIconFetchError } = require('../main/lcu-client');

test('isTransientIconFetchError detects temporary LCU transport failures', () => {
  assert.equal(isTransientIconFetchError({ code: 'ECONNREFUSED' }), true);
  assert.equal(isTransientIconFetchError({ code: 'ECONNRESET' }), true);
  assert.equal(isTransientIconFetchError(new Error('LCU request timed out: https://127.0.0.1')), true);
  assert.equal(isTransientIconFetchError(new Error('HTTP 404')), false);
});
