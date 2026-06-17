const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createAuthHeader,
  createChampionsById,
  parseLockfile
} = require('../lcu-logic');

test('parseLockfile extracts LCU connection fields', () => {
  assert.deepEqual(parseLockfile('LeagueClientUx:1234:50999:test-password:https'), {
    processName: 'LeagueClientUx',
    pid: '1234',
    port: '50999',
    password: 'test-password',
    protocol: 'https'
  });
});

test('parseLockfile rejects malformed lockfile content', () => {
  assert.throws(() => parseLockfile('LeagueClientUx:1234'), /lockfile/);
});

test('createAuthHeader builds Riot basic auth header', () => {
  assert.equal(createAuthHeader('pw'), 'Basic cmlvdDpwdw==');
});

test('createChampionsById normalizes valid champion summary entries', () => {
  assert.deepEqual(createChampionsById([
    {
      id: '122',
      name: 'Darius',
      alias: 'Darius',
      title: 'the Hand of Noxus',
      squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/122.png'
    },
    { id: 0, name: 'None' },
    { id: -1, name: 'Invalid' },
    { id: 12.5, name: 'Invalid' },
    { id: Infinity, name: 'Invalid' },
    { id: 'not-a-number', name: 'Invalid' }
  ]), {
    122: {
      id: 122,
      name: 'Darius',
      alias: 'Darius',
      title: 'the Hand of Noxus',
      squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/122.png'
    }
  });
});
