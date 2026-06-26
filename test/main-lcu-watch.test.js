const test = require('node:test');
const assert = require('node:assert/strict');
const { createLcuWebSocketUrl } = require('../main/lcu-watch');

test('createLcuWebSocketUrl encodes the LCU password', () => {
  assert.equal(
    createLcuWebSocketUrl({ password: 'a:b/c d', port: 12345 }),
    'wss://riot:a%3Ab%2Fc%20d@127.0.0.1:12345/'
  );
});
