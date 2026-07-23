const test = require('node:test');
const assert = require('node:assert/strict');
const { getDataDragonLocale, setLanguage, translate } = require('../ui/i18n');

const {
  applyThemeMode,
  describeThemeMode,
  normalizeThemeMode,
  renderSettings
} = require('../ui/settings-view');

test('theme mode helpers normalize and describe settings values', () => {
  setLanguage('en', { documentElement: {}, querySelectorAll: () => [] });
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('unknown'), 'system');
  assert.equal(describeThemeMode('light'), 'Light');
  assert.equal(describeThemeMode('dark'), 'Dark');
  assert.equal(describeThemeMode('system'), 'Matches your operating system appearance.');
});

test('language selection maps to the corresponding Data Dragon locale', () => {
  const doc = { documentElement: {}, querySelectorAll: () => [] };
  setLanguage('en', doc);
  assert.equal(getDataDragonLocale(), 'en_US');
  setLanguage('ja', doc);
  assert.equal(getDataDragonLocale(), 'ja_JP');
  setLanguage('en', doc);
});

test('translations use stable keys without legacy text replacement helpers', () => {
  const i18n = require('../ui/i18n');
  const doc = { documentElement: {}, querySelectorAll: () => [] };
  setLanguage('en', doc);
  assert.equal(translate('season.startDownload'), 'Start download');
  setLanguage('ja', doc);
  assert.equal(translate('season.startDownload'), '取得を開始');
  assert.equal('translateLegacyText' in i18n, false);
  assert.equal('localizeLegacyContent' in i18n, false);
  setLanguage('en', doc);
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
    themeModeStatus: { textContent: '' },
    languageSelect: { value: '' }
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
    themeMode: 'dark',
    language: 'en'
  }, { document: doc, elements });

  assert.equal(elements.lolInstallDirInput.value, 'C:/Riot Games/League of Legends');
  assert.equal(elements.themeModeSelect.value, 'dark');
  assert.equal(elements.themeModeStatus.textContent, 'Dark');
  assert.equal(elements.languageSelect.value, 'en');
  assert.equal(elements.riotRegionalRouteStatus.textContent, 'Server detected from LCU: JP1 / Match-V5 route: ASIA');
});
