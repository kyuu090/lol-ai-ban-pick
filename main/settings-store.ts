const fs = require('node:fs/promises');
const path = require('node:path');
const {
  RIOT_PLATFORM_REGIONS,
  DEFAULT_RIOT_PLATFORM_REGION,
  createRiotApiHosts,
  normalizeRiotPlatformRegion
} = require('../riot-api');

import type { PublicSettings, RiotPlatformRegion, RiotRegionalRoute, ThemeMode } from '../types/domain/settings';

const DEFAULT_LOL_INSTALL_DIR = 'C:\\Riot Games\\League of Legends';
const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

interface StoredSettings {
  lolInstallDir: string;
  riotPlatformRegion: RiotPlatformRegion;
  themeMode: ThemeMode;
}

type SettingsInput = Partial<StoredSettings>;

interface StoreLog {
  debug?: (message: string, details?: unknown) => void;
}

interface StorePathDeps {
  userDataPath: string;
  log?: StoreLog;
}

interface SaveSettingsDeps extends StorePathDeps {
  currentSettings: SettingsInput;
  nextSettings: SettingsInput;
}

function createDefaultSettings(): StoredSettings {
  return {
    lolInstallDir: DEFAULT_LOL_INSTALL_DIR,
    riotPlatformRegion: DEFAULT_RIOT_PLATFORM_REGION as RiotPlatformRegion,
    themeMode: 'system'
  };
}

function normalizeThemeMode(themeMode: unknown): ThemeMode {
  return THEME_MODES.includes(themeMode as ThemeMode) ? themeMode as ThemeMode : 'system';
}

function normalizeSettings(sourceSettings: SettingsInput = {}): StoredSettings {
  const defaults = createDefaultSettings();
  return {
    lolInstallDir: typeof sourceSettings.lolInstallDir === 'string' && sourceSettings.lolInstallDir.trim()
      ? sourceSettings.lolInstallDir
      : defaults.lolInstallDir,
    riotPlatformRegion: normalizeRiotPlatformRegion(sourceSettings.riotPlatformRegion) as RiotPlatformRegion,
    themeMode: normalizeThemeMode(sourceSettings.themeMode)
  };
}

function createPublicSettings(sourceSettings: SettingsInput): PublicSettings {
  const settings = normalizeSettings(sourceSettings);
  const riotPlatformRegion = normalizeRiotPlatformRegion(settings.riotPlatformRegion) as RiotPlatformRegion;
  const riotHosts = createRiotApiHosts(riotPlatformRegion) as { regionalRoute: RiotRegionalRoute };

  return {
    lolInstallDir: settings.lolInstallDir,
    riotPlatformRegion,
    riotRegionalRoute: riotHosts.regionalRoute,
    riotPlatformRegions: RIOT_PLATFORM_REGIONS as readonly RiotPlatformRegion[],
    themeMode: normalizeThemeMode(settings.themeMode),
    themeModes: THEME_MODES
  };
}

function getSettingsPath(userDataPath: string): string {
  return path.join(userDataPath, 'settings.json');
}

async function loadSettings({ userDataPath, log }: StorePathDeps): Promise<StoredSettings> {
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

async function saveSettings({
  userDataPath,
  currentSettings,
  nextSettings,
  log
}: SaveSettingsDeps): Promise<StoredSettings> {
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

export = {
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
