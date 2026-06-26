import type { AppState } from './domain/app-state';
import type { AiAnalysisResponse } from './domain/ai-analysis';
import type { ChampionPool, ChampionPoolLaneId, ChampionSummaryItem } from './domain/champion';
import type { ChampSelectSession, ChampSelectTeamMember, GameflowPhase, Summoner } from './domain/lcu';
import type {
  ChampionStats,
  EnemyChampionStats,
  LaneOpponentStats,
  MatchHistoryStatus,
  MatchHistorySummary,
  SelfVsLaneOpponentStats
} from './domain/match-history';
import type { PublicSettings, ThemeMode } from './domain/settings';

declare global {
  type UiAnyElement = any;
  type UiTimerHandle = ReturnType<typeof setTimeout>;
  type UiLaneId = ChampionPoolLaneId | string;
  type UiSortDirection = 'asc' | 'desc';
  type UiStatsSortKey = 'games' | 'winRate';
  type UiDraftAiAnalysisStatus = 'idle' | 'requesting' | 'ready' | 'error' | string;

  interface UiLane {
    id: UiLaneId;
    label: string;
  }

  type UiDomElements = Record<string, UiAnyElement>;

  interface UiDomElementsApi {
    elements?: UiDomElements;
    createDomElements(doc?: Document): UiDomElements;
  }

  interface ChampionIconLoader {
    loadChampionIcon(img: HTMLImageElement, championId: number | string): void;
    loadChampionIconEager(img: HTMLImageElement, championId: number | string): void;
  }

  interface ChampionIconLoaderOptions {
    root?: UiRoot;
    cache?: Map<number, string | Promise<string | null> | null>;
    requestConcurrency?: number;
    retryDelayMs?: number;
    getChampionIcon?: (id: number) => string | null | Promise<string | null>;
    setTimeout?: typeof setTimeout;
  }

  interface UiFormattersApi {
    formatAverageKda(stats: Partial<ChampionStats> | Partial<SelfVsLaneOpponentStats> | null | undefined): string;
    formatDate(value: string | number | Date | null | undefined): string;
    formatMatchDataDate(value: string | number | Date | null | undefined): string | null;
    formatNumber(value: number | string | null | undefined, digits?: number): string;
    formatPercent(value: number | string | null | undefined): string;
  }

  interface SettingsViewDeps {
    document?: Document;
    elements?: UiDomElements;
  }

  interface UiSettingsViewApi {
    applyThemeMode(themeMode: string, doc?: Document): void;
    describeThemeMode(themeMode: string): string;
    normalizeThemeMode(themeMode: unknown): ThemeMode;
    renderRiotPlatformRegions(settings: PublicSettings, deps?: SettingsViewDeps): void;
    renderSettings(settings: PublicSettings | null | undefined, deps?: SettingsViewDeps): void;
  }

  interface MatchDataViewDeps {
    elements: UiDomElements;
    formatMatchDataDate(value: string | number | Date | null | undefined): string | null;
    setTimeout?: typeof setTimeout;
    clearTimeout?: typeof clearTimeout;
  }

  interface ChampionPoolViewDeps {
    [key: string]: any;
    document?: Document;
    elements: UiDomElements;
    lanes: UiLane[];
    laneToPosition: Record<string, string>;
    normalizeChampionPool(pool: ChampionPool): ChampionPool;
    loadChampionIcon(img: HTMLImageElement, championId: number): void;
    championLabel(championId: number): string;
    championTitle(championId: number): string;
    getChampionsById(): Record<string | number, ChampionSummaryItem>;
    getChampionPool(): ChampionPool;
    setChampionPool(pool: ChampionPool): void;
    getActiveLaneId(): UiLaneId;
    setActiveLaneId(laneId: UiLaneId): void;
  }

  interface StatsViewDeps {
    [key: string]: any;
    document?: Document;
    elements: UiDomElements;
    lanes: UiLane[];
    championLabel(championId: number): string;
    formatPercent(value: number | string | null | undefined): string;
    formatAverageKda(stats: any): string;
  }

  interface InGameViewDeps {
    [key: string]: any;
    document?: Document;
    elements: UiDomElements;
    championLabel(championId: number): string;
    championTitle(championId: number): string;
    loadChampionIcon(img: HTMLImageElement, championId: number): void;
    loadChampionIconEager(img: HTMLImageElement, championId: number): void;
  }

  interface DraftViewDeps {
    [key: string]: any;
    document?: Document;
    elements: UiDomElements;
    championLabel(championId: number): string;
    championTitle(championId: number): string;
    loadChampionIcon(img: HTMLImageElement, championId: number): void;
  }

  interface UiRoot {
    document?: Document;
    setTimeout?: typeof setTimeout;
    clearTimeout?: typeof clearTimeout;
    IntersectionObserver?: typeof IntersectionObserver;
    lcuApi?: {
      getChampionIcon?(championId: number): Promise<string | null>;
    };
    UiDomElements?: UiDomElementsApi;
    UiFormatters?: UiFormattersApi;
    UiChampionIcons?: ChampionIconLoader & { createChampionIconLoader(options?: ChampionIconLoaderOptions): ChampionIconLoader };
    UiSettingsView?: UiSettingsViewApi;
    UiChampionPoolView?: { createChampionPoolView(deps: ChampionPoolViewDeps): any };
    UiMatchDataView?: { createMatchDataView(deps: MatchDataViewDeps): any };
    UiStatsView?: { createStatsView(deps: StatsViewDeps): any };
    UiInGameView?: { createInGameView(deps: InGameViewDeps): any };
    UiDraftView?: { createDraftView(deps: DraftViewDeps): any };
    RendererState?: any;
    RendererNavigation?: any;
    RendererStateSync?: any;
    RendererAiAnalysisController?: any;
    RendererChampionPoolController?: any;
    RendererMatchHistoryController?: any;
    RendererDraftController?: any;
    [key: string]: any;
  }

  interface Window extends UiRoot {}

  var module: { exports: any } | undefined;
}

export {};
