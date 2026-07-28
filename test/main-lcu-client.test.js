const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDataDragonChampionIconUrl,
  createDataDragonChampionCatalog,
  createDataDragonChampionAliasMap,
  createLcuClient,
  isTransientIconFetchError
} = require('../main/lcu-client');

test('isTransientIconFetchError detects temporary LCU transport failures', () => {
  assert.equal(isTransientIconFetchError({ code: 'ECONNREFUSED' }), true);
  assert.equal(isTransientIconFetchError({ code: 'ECONNRESET' }), true);
  assert.equal(isTransientIconFetchError(new Error('LCU request timed out: https://127.0.0.1')), true);
  assert.equal(isTransientIconFetchError(new Error('HTTP 404')), false);
});

test('createDataDragonChampionAliasMap normalizes champion id to alias', () => {
  assert.deepEqual(
    createDataDragonChampionAliasMap({
      data: {
        Ahri: { key: '103', id: 'Ahri' },
        Aatrox: { key: '266', id: 'Aatrox' }
      }
    }),
    {
      103: 'Ahri',
      266: 'Aatrox'
    }
  );
});

test('createDataDragonChampionCatalog normalizes champion names and titles', () => {
  assert.deepEqual(
    createDataDragonChampionCatalog({
      data: {
        Ahri: { key: '103', id: 'Ahri', name: 'Ahri', title: 'the Nine-Tailed Fox' },
        Aatrox: { key: '266', id: 'Aatrox', name: 'Aatrox', title: 'the Darkin Blade' }
      }
    }),
    {
      103: { id: 103, name: 'Ahri', alias: 'Ahri', title: 'the Nine-Tailed Fox' },
      266: { id: 266, name: 'Aatrox', alias: 'Aatrox', title: 'the Darkin Blade' }
    }
  );
});

test('buildDataDragonChampionIconUrl builds CDN image path', () => {
  assert.equal(
    buildDataDragonChampionIconUrl('15.13.1', 'Ahri'),
    'https://ddragon.leagueoflegends.com/cdn/15.13.1/img/champion/Ahri.png'
  );
});

test('getChampionIcon falls back to Data Dragon when LCU is disconnected', async () => {
  const requestedUrls = [];
  const client = createLcuClient({
    getSettings: () => ({ lolInstallDir: 'C:\\Riot Games\\League of Legends' }),
    getConnection: () => null,
    getStatus: () => 'disconnected',
    getCachedChampionById: () => null,
    requestJsonFromUrl: async (url) => {
      requestedUrls.push(url);
      if (url.endsWith('/api/versions.json')) {
        return ['15.13.1'];
      }
      return {
        data: {
          Ahri: { key: '103', id: 'Ahri' }
        }
      };
    },
    setIconUnavailableUntil() {},
    getIconUnavailableUntil: () => 0,
    getIconUnavailableLogged: () => false,
    setIconUnavailableLogged() {},
    log: {
      debug() {},
      warn() {}
    },
    serializeForLog: (error) => error
  });

  const src = await client.getChampionIcon(null, 103);

  assert.equal(src, 'https://ddragon.leagueoflegends.com/cdn/15.13.1/img/champion/Ahri.png');
  assert.deepEqual(requestedUrls, [
    'https://ddragon.leagueoflegends.com/api/versions.json',
    'https://ddragon.leagueoflegends.com/cdn/15.13.1/data/en_US/champion.json'
  ]);
});

test('getChampionCatalog falls back to Data Dragon champion data', async () => {
  const client = createLcuClient({
    getSettings: () => ({ lolInstallDir: 'C:\\Riot Games\\League of Legends' }),
    getConnection: () => null,
    getStatus: () => 'disconnected',
    getCachedChampionById: () => null,
    requestJsonFromUrl: async (url) => {
      if (url.endsWith('/api/versions.json')) {
        return ['15.13.1'];
      }
      return {
        data: {
          Ahri: { key: '103', id: 'Ahri', name: 'Ahri', title: 'the Nine-Tailed Fox' }
        }
      };
    },
    setIconUnavailableUntil() {},
    getIconUnavailableUntil: () => 0,
    getIconUnavailableLogged: () => false,
    setIconUnavailableLogged() {},
    log: {
      debug() {},
      warn() {}
    },
    serializeForLog: (error) => error
  });

  const catalog = await client.getChampionCatalog();

  assert.deepEqual(catalog, {
    103: { id: 103, name: 'Ahri', alias: 'Ahri', title: 'the Nine-Tailed Fox' }
  });
});

test('getChampionCatalog requests Korean Data Dragon data for the kr application language', async () => {
  const requestedUrls = [];
  const client = createLcuClient({
    getSettings: () => ({ lolInstallDir: 'C:\\Riot Games\\League of Legends', language: 'kr' }),
    getConnection: () => null,
    getStatus: () => 'disconnected',
    getCachedChampionById: () => null,
    requestJsonFromUrl: async (url) => {
      requestedUrls.push(url);
      return url.endsWith('/api/versions.json') ? ['15.13.1'] : { data: {} };
    },
    setIconUnavailableUntil() {}, getIconUnavailableUntil: () => 0, getIconUnavailableLogged: () => false, setIconUnavailableLogged() {},
    log: { debug() {}, warn() {} }, serializeForLog: (error) => error
  });

  await client.getChampionCatalog();
  assert.ok(requestedUrls.includes('https://ddragon.leagueoflegends.com/cdn/15.13.1/data/ko_KR/champion.json'));
});
