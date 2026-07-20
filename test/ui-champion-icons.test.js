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

test('intersection callbacks can reuse a resolved champion icon cache entry', async () => {
  let intersectionCallback = () => {};
  class FakeIntersectionObserver {
    constructor(callback) {
      intersectionCallback = callback;
    }
    observe() {}
    unobserve() {}
  }
  const cache = new Map();
  const loader = createChampionIconLoader({
    cache,
    root: {
      IntersectionObserver: FakeIntersectionObserver,
      setTimeout
    },
    getChampionIcon: async (id) => `icon-${id}.png`,
    setTimeout: () => {}
  });
  const image = {
    dataset: {},
    removeAttribute() {}
  };

  loader.loadChampionIcon(image, 22);
  intersectionCallback([{ isIntersecting: true, target: image }]);
  await cache.get(22);

  assert.doesNotThrow(() => {
    intersectionCallback([{ isIntersecting: true, target: image }]);
  });
  await Promise.resolve();
  assert.equal(image.src, 'icon-22.png');
});
