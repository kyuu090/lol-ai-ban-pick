const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDefaultChampionPool } = require('../draft-logic');
const {
  createPublicSettings,
  loadSettings,
  normalizeThemeMode,
  saveSettings
} = require('../main/settings-store');
const {
  loadChampionPool,
  saveChampionPool
} = require('../main/champion-pool-store');
const {
  getAccountDataKey,
  getMatchHistoryPath,
  readJsonFile,
  writeJsonFile
} = require('../main/match-history-store');
const {
  applyStatePatch,
  createInitialState,
  createLaneMatchupAnalysisState,
  createMatchHistoryStatus,
  createMatchHistorySummary
} = require('../main/app-state');

async function createTempUserData() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'banpick-store-test-'));
}

test('settings store normalizes, saves, loads, and exposes public settings', async () => {
  const userDataPath = await createTempUserData();

  const saved = await saveSettings({
    userDataPath,
    currentSettings: {},
    nextSettings: {
      lolInstallDir: 'D:\\League',
      riotPlatformRegion: 'kr',
      themeMode: 'dark'
    }
  });
  assert.deepEqual(saved, {
    lolInstallDir: 'D:\\League',
    riotPlatformRegion: 'KR',
    themeMode: 'dark'
  });

  const loaded = await loadSettings({ userDataPath });
  assert.deepEqual(loaded, saved);

  const publicSettings = createPublicSettings(loaded);
  assert.equal(publicSettings.riotPlatformRegion, 'KR');
  assert.equal(publicSettings.riotRegionalRoute, 'ASIA');
  assert.deepEqual(publicSettings.themeModes, ['system', 'light', 'dark']);
  assert.equal(normalizeThemeMode('unknown'), 'system');
});

test('champion pool store preserves normalized champion pool format', async () => {
  const userDataPath = await createTempUserData();

  assert.deepEqual(await loadChampionPool({ userDataPath }), createDefaultChampionPool());

  const saved = await saveChampionPool({
    userDataPath,
    nextChampionPool: {
      top: [122, 122, -1],
      middle: ['99'],
      unknown: [1]
    }
  });

  assert.deepEqual(saved.top, [122]);
  assert.deepEqual(saved.middle, [99]);
  assert.equal(saved.unknown, undefined);
  assert.deepEqual(await loadChampionPool({ userDataPath }), saved);
});

test('match history store builds account paths and reads/writes json', async () => {
  const userDataPath = await createTempUserData();
  const puuid = 'abc/def ghi';
  const filePath = getMatchHistoryPath(userDataPath, puuid);

  assert.equal(getAccountDataKey(puuid), 'abc%2Fdef%20ghi');
  assert.equal(await readJsonFile(filePath, null), null);

  await writeJsonFile(filePath, { ok: true });
  assert.deepEqual(await readJsonFile(filePath, null), { ok: true });
});

test('app state helpers create default public state and summaries', () => {
  const matchHistoryStatus = createMatchHistoryStatus({ defaultRequestedMatches: 90 });
  const state = createInitialState({
    settings: { lolInstallDir: 'C:\\Riot Games\\League of Legends' },
    championPool: createDefaultChampionPool(),
    matchHistoryStatus
  });

  assert.equal(state.lcuStatus, 'disconnected');
  assert.equal(state.matchHistoryStatus.requestedMatches, 90);
  assert.deepEqual(createLaneMatchupAnalysisState({ status: 'loading' }).status, 'loading');

  const patched = applyStatePatch(state, { lcuStatus: 'connected' }, new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(patched.lcuStatus, 'connected');
  assert.equal(patched.updatedAt, '2026-01-01T00:00:00.000Z');

  const summary = createMatchHistorySummary({
    matches: [
      { gameCreation: 20 },
      { gameCreation: 10 },
      { gameCreation: 'invalid' }
    ]
  });
  assert.equal(summary.normalizedMatches, 3);
  assert.equal(summary.oldestGameCreation, 10);
  assert.equal(summary.newestGameCreation, 20);
});
