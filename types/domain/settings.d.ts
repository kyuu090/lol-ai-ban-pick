export type ThemeMode = 'system' | 'light' | 'dark';

export type RiotPlatformRegion =
  | 'BR1'
  | 'EUN1'
  | 'EUW1'
  | 'JP1'
  | 'KR'
  | 'LA1'
  | 'LA2'
  | 'NA1'
  | 'OC1'
  | 'TR1'
  | 'RU'
  | 'PH2'
  | 'SG2'
  | 'TH2'
  | 'TW2'
  | 'VN2';

export type RiotRegionalRoute = 'AMERICAS' | 'EUROPE' | 'ASIA' | 'SEA';

export interface PublicSettings {
  lolInstallDir: string;
  riotPlatformRegion: RiotPlatformRegion;
  riotRegionalRoute: RiotRegionalRoute;
  riotPlatformRegions: readonly RiotPlatformRegion[];
  themeMode: ThemeMode;
  themeModes: readonly ThemeMode[];
}
