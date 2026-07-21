const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyThemeMode,
  describeThemeMode,
  normalizeThemeMode,
  renderSettings
} = require('../ui/settings-view');

test('theme mode helpers normalize and describe settings values', () => {
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('unknown'), 'system');
  assert.equal(describeThemeMode('light'), 'ライトモードを使用します。');
  assert.equal(describeThemeMode('dark'), 'ダークモードを使用します。');
  assert.equal(describeThemeMode('system'), 'OSの表示モードに合わせます。');
});

test('applyThemeMode writes and clears document theme state', () => {
  const doc = {
    documentElement: {
      dataset: {},
      removeAttribute(name) {
        if (name === 'data-theme') delete this.dataset.theme;
      }
    }
  };

  applyThemeMode('dark', doc);
  assert.equal(doc.documentElement.dataset.theme, 'dark');

  applyThemeMode('system', doc);
  assert.equal(doc.documentElement.dataset.theme, undefined);
});

test('renderSettings updates setting controls without overriding focused fields', () => {
  const elements = {
    lolInstallDirInput: { value: '' },
    riotRegionalRouteStatus: { textContent: '' },
    themeModeSelect: { value: '' },
    themeModeStatus: { textContent: '' }
  };
  const doc = {
    activeElement: null,
    documentElement: {
      dataset: {},
      removeAttribute() {}
    },
  };

  renderSettings({
    lolInstallDir: 'C:/Riot Games/League of Legends',
    detectedRiotPlatformRegion: 'JP1',
    detectedRiotRegionalRoute: 'ASIA',
    themeMode: 'dark'
  }, { document: doc, elements });

  assert.equal(elements.lolInstallDirInput.value, 'C:/Riot Games/League of Legends');
  assert.equal(elements.themeModeSelect.value, 'dark');
  assert.equal(elements.themeModeStatus.textContent, 'ダークモードを使用します。');
  assert.equal(elements.riotRegionalRouteStatus.textContent, 'LCUから自動検出したサーバ: JP1 / Match-V5 route: ASIA');
});
