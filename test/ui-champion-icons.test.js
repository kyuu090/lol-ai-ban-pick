const test = require('node:test');
const assert = require('node:assert/strict');

const { createChampionIconLoader } = require('../ui/champion-icons');

test('loadChampionIconEager fetches and caches champion icon sources', async () => {
  const calls = [];
  const cache = new Map();
  const loader = createChampionIconLoader({
    cache,
    getChampionIcon: async (id) => {
      calls.push(id);
      return `icon-${id}.png`;
    },
    setTimeout: () => {}
  });
  const image = {
    dataset: {},
    removeAttribute() {}
  };

  loader.loadChampionIconEager(image, 22);
  await cache.get(22);

  assert.equal(image.dataset.championId, '22');
  assert.equal(image.src, 'icon-22.png');
  assert.deepEqual(calls, [22]);

  const secondImage = {
    dataset: {},
    removeAttribute() {}
  };
  loader.loadChampionIconEager(secondImage, 22);

  assert.equal(secondImage.src, 'icon-22.png');
  assert.deepEqual(calls, [22]);
});
