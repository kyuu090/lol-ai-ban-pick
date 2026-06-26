import type { AiAnalysisResponse } from './domain/ai-analysis';
import type { AppState } from './domain/app-state';
import type { ChampionPool } from './domain/champion';
import type { FinalCompositionDraftContext, PickPhaseDraftContext } from './domain/draft';
import type { MatchHistoryMode, MatchHistorySource, MatchHistorySummary } from './domain/match-history';
import type { PublicSettings, RiotPlatformRegion, ThemeMode } from './domain/settings';

export interface CollectRiotMatchHistoryOptions {
  mode?: MatchHistoryMode;
  count?: number;
  source?: MatchHistorySource;
}

export interface CollectRiotMatchHistoryCanceledResult {
  canceled: true;
  requestedMatches: number;
  updatedMatches: number;
}

export type CollectRiotMatchHistoryResult =
  | MatchHistorySummary
  | CollectRiotMatchHistoryCanceledResult;

export interface IpcInvokeChannelMap {
  'lcu:get-state': {
    args: [];
    result: AppState;
  };
  'lcu:refresh': {
    args: [];
    result: AppState;
  };
  'lcu:get-champion-icon': {
    args: [championId: number];
    result: string | null;
  };
  'champion-pool:get': {
    args: [];
    result: ChampionPool;
  };
  'champion-pool:save': {
    args: [championPool: ChampionPool];
    result: ChampionPool;
  };
  'settings:get': {
    args: [];
    result: PublicSettings;
  };
  'settings:choose-lol-install-dir': {
    args: [];
    result: PublicSettings;
  };
  'settings:update-lol-install-dir': {
    args: [lolInstallDir: string];
    result: PublicSettings;
  };
  'settings:update-riot-platform-region': {
    args: [riotPlatformRegion: RiotPlatformRegion | string];
    result: PublicSettings;
  };
  'settings:update-theme-mode': {
    args: [themeMode: ThemeMode];
    result: PublicSettings;
  };
  'window:minimize': {
    args: [];
    result: void;
  };
  'window:toggle-maximize': {
    args: [];
    result: boolean;
  };
  'window:close': {
    args: [];
    result: void;
  };
  'riot-match-history:collect': {
    args: [options: CollectRiotMatchHistoryOptions];
    result: CollectRiotMatchHistoryResult;
  };
  'openai:pick-phase': {
    args: [draftContext: PickPhaseDraftContext];
    result: AiAnalysisResponse;
  };
  'openai:final-composition': {
    args: [draftContext: FinalCompositionDraftContext];
    result: AiAnalysisResponse;
  };
}

export interface IpcSendChannelMap {
  'log:renderer': {
    args: [level: string, message: string, details?: unknown];
    result: void;
  };
}

export interface IpcRendererEventChannelMap {
  'lcu:state': {
    args: [state: AppState];
  };
  'window:maximized': {
    args: [isMaximized: boolean];
  };
}

export type IpcInvokeChannel = keyof IpcInvokeChannelMap;
export type IpcSendChannel = keyof IpcSendChannelMap;
export type IpcRendererEventChannel = keyof IpcRendererEventChannelMap;
