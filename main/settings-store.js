// @ts-check

const fs = require('node:fs/promises');
const path = require('node:path');
const {
  RIOT_PLATFORM_REGIONS,
  DEFAULT_RIOT_PLATFORM_REGION,
  createRiotApiHosts,
  normalizeRiotPlatformRegion
} = require('../riot-api');

const DEFAULT_LOL_INSTALL_DIR = 'C:\\Riot Games\\League of Legends';
const THEME_MODES = /** @type {readonly ThemeMode[]} */ (['system', 'light', 'dark']);

/**
 * @typedef {import('../types/domain/settings').PublicSettings} PublicSettings
 * @typedef {import('../types/domain/settings').RiotPlatformRegion} RiotPlatformRegion
 * @typedef {import('../types/domain/settings').RiotRegionalRoute} RiotRegionalRoute
 * @typedef {import('../types/domain/settings').ThemeMode} ThemeMode
 */

/**
 * @typedef {object} StoredSettings
 * @property {string} lolInstallDir
 * @property {RiotPlatformRegion} riotPlatformRegion
 * @property {ThemeMode} themeMode
 */

/**
 * @typedef {Partial<StoredSettings> & Record<string, unknown>} SettingsInput
 */

/**
 * @typedef {object} StoreLog
 * @property {(message: string, details?: unknown) => void} [debug]
 */

/**
 * @returns {StoredSettings}
 */
function createDefaultSettings() {
  return {
    lolInstallDir: DEFAULT_LOL_INSTALL_DIR,
    riotPlatformRegion: /** @type {RiotPlatformRegion} */ (DEFAULT_RIOT_PLATFORM_REGION),
    themeMode: 'system'
  };
}

/**
 * @param {unknown} themeMode
 * @returns {ThemeMode}
 */
function normalizeThemeMode(themeMode) {
  return THEME_MODES.includes(/** @type {ThemeMode} */ (themeMode)) ? /** @type {ThemeMode} */ (themeMode) : 'system';
}

/**
 * @param {SettingsInput} [sourceSettings]
 * @returns {StoredSettings}
 */
function normalizeSettings(sourceSettings = {}) {
  const defaults = createDefaultSettings();
  return {
    lolInstallDir: typeof sourceSettings.lolInstallDir === 'string' && sourceSettings.lolInstallDir.trim()
      ? sourceSettings.lolInstallDir
      : defaults.lolInstallDir,
    riotPlatformRegion: /** @type {RiotPlatformRegion} */ (normalizeRiotPlatformRegion(sourceSettings.riotPlatformRegion)),
    themeMode: normalizeThemeMode(sourceSettings.themeMode)
  };
}

/**
 * @param {SettingsInput} sourceSettings
 * @returns {PublicSettings}
 */
function createPublicSettings(sourceSettings) {
  const settings = normalizeSettings(sourceSettings);
  const riotPlatformRegion = /** @type {RiotPlatformRegion} */ (normalizeRiotPlatformRegion(settings.riotPlatformRegion));
  const riotHosts = /** @type {{ regionalRoute: RiotRegionalRoute }} */ (createRiotApiHosts(riotPlatformRegion));

  return {
    lolInstallDir: settings.lolInstallDir,
    riotPlatformRegion,
    riotRegionalRoute: riotHosts.regionalRoute,
    riotPlatformRegions: /** @type {readonly RiotPlatformRegion[]} */ (RIOT_PLATFORM_REGIONS),
    themeMode: normalizeThemeMode(settings.themeMode),
    themeModes: THEME_MODES
  };
}

/**
 * @param {string} userDataPath
 * @returns {string}
 */
function getSettingsPath(userDataPath) {
  return path.join(userDataPath, 'settings.json');
}

/**
 * @param {object} options
 * @param {string} options.userDataPath
 * @param {StoreLog} [options.log]
 * @returns {Promise<StoredSettings>}
 */
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

/**
 * @param {object} options
 * @param {string} options.userDataPath
 * @param {SettingsInput} options.currentSettings
 * @param {SettingsInput} options.nextSettings
 * @param {StoreLog} [options.log]
 * @returns {Promise<StoredSettings>}
 */
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
