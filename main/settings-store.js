const fs = require('node:fs/promises');
const path = require('node:path');
const {
  RIOT_PLATFORM_REGIONS,
  DEFAULT_RIOT_PLATFORM_REGION,
  createRiotApiHosts,
  normalizeRiotPlatformRegion
} = require('../riot-api');

const DEFAULT_LOL_INSTALL_DIR = 'C:\\Riot Games\\League of Legends';
const THEME_MODES = ['system', 'light', 'dark'];

function createDefaultSettings() {
  return {
    lolInstallDir: DEFAULT_LOL_INSTALL_DIR,
    riotPlatformRegion: DEFAULT_RIOT_PLATFORM_REGION,
    themeMode: 'system'
  };
}

function normalizeThemeMode(themeMode) {
  return THEME_MODES.includes(themeMode) ? themeMode : 'system';
}

function normalizeSettings(sourceSettings = {}) {
  const defaults = createDefaultSettings();
  return {
    lolInstallDir: typeof sourceSettings.lolInstallDir === 'string' && sourceSettings.lolInstallDir.trim()
      ? sourceSettings.lolInstallDir
      : defaults.lolInstallDir,
    riotPlatformRegion: normalizeRiotPlatformRegion(sourceSettings.riotPlatformRegion),
    themeMode: normalizeThemeMode(sourceSettings.themeMode)
  };
}

function createPublicSettings(sourceSettings) {
  const settings = normalizeSettings(sourceSettings);
  const riotPlatformRegion = normalizeRiotPlatformRegion(settings.riotPlatformRegion);
  const riotHosts = createRiotApiHosts(riotPlatformRegion);

  return {
    lolInstallDir: settings.lolInstallDir,
    riotPlatformRegion,
    riotRegionalRoute: riotHosts.regionalRoute,
    riotPlatformRegions: RIOT_PLATFORM_REGIONS,
    themeMode: normalizeThemeMode(settings.themeMode),
    themeModes: THEME_MODES
  };
}

function getSettingsPath(userDataPath) {
  return path.join(userDataPath, 'settings.json');
}

async function loadSettings({ userDataPath, log }) {
  const settingsPath = getSettingsPath(userDataPath);
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const settings = normalizeSettings(JSON.parse(raw));
    log?.debug?.('Settings loaded', { path: settingsPath, settings: createPublicSettings(settings) });
    return settings;
  } catch {
    const settings = createDefaultSettings();
    log?.debug?.('Settings file not found or invalid; using defaults', {
      path: settingsPath,
      settings: createPublicSettings(settings)
    });
    return settings;
  }
}

async function saveSettings({ userDataPath, currentSettings, nextSettings, log }) {
  const settingsPath = getSettingsPath(userDataPath);
  const settings = normalizeSettings({
    ...normalizeSettings(currentSettings),
    ...nextSettings
  });

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  log?.debug?.('Settings saved', { path: settingsPath, settings: createPublicSettings(settings) });
  return settings;
}

module.exports = {
  DEFAULT_LOL_INSTALL_DIR,
  THEME_MODES,
  createDefaultSettings,
  createPublicSettings,
  getSettingsPath,
  loadSettings,
  normalizeSettings,
  normalizeThemeMode,
  saveSettings
};
