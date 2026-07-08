import type { AiAnalysisResponse } from './domain/ai-analysis';
import type { AppState } from './domain/app-state';
import type { ChampionPool } from './domain/champion';
import type { FinalCompositionDraftContext, PickPhaseDraftContext } from './domain/draft';
import type { PublicSettings, RiotPlatformRegion, ThemeMode } from './domain/settings';
import type {
  CollectRiotMatchHistoryOptions,
  CollectRiotMatchHistoryResult
} from './ipc';

export interface LcuApi {
  getState(): Promise<AppState>;
  refresh(): Promise<AppState>;
  getChampionIcon(championId: number): Promise<string | null>;
  getChampionPool(): Promise<ChampionPool>;
  saveChampionPool(championPool: ChampionPool): Promise<ChampionPool>;
  log(level: string, message: string, details?: unknown): void;
  getSettings(): Promise<PublicSettings>;
  chooseLolInstallDir(): Promise<PublicSettings>;
  updateLolInstallDir(lolInstallDir: string): Promise<PublicSettings>;
  updateRiotPlatformRegion(riotPlatformRegion: RiotPlatformRegion | string): Promise<PublicSettings>;
  updateThemeMode(themeMode: ThemeMode): Promise<PublicSettings>;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<boolean>;
  closeWindow(): Promise<void>;
  onWindowMaximized(callback: (isMaximized: boolean) => void): () => void;
  collectRiotMatchHistory(options: CollectRiotMatchHistoryOptions): Promise<CollectRiotMatchHistoryResult>;
  requestStatsApiJson(pathOrUrl: string): Promise<unknown>;
  requestPickPhaseAnalysis(draftContext: PickPhaseDraftContext): Promise<AiAnalysisResponse>;
  requestFinalCompositionAnalysis(draftContext: FinalCompositionDraftContext): Promise<AiAnalysisResponse>;
  onState(callback: (state: AppState) => void): () => void;
}

declare global {
  interface Window {
    lcuApi: LcuApi;
  }
}

export {};
