(function attachRendererState(root: UiRoot) {
  interface RendererAiNote {
    title: string;
    body: string;
  }

  type RendererAiAnalysisStatus = 'idle' | 'requesting' | 'ready' | 'error';

  interface RendererState {
    activeView: string;
    activeStatsView: string;
    activeChampionPoolLane: string;
    activePlayedStatsLane: string;
    activeOpponentStatsLane: string;
    playedStatsMinGames: number;
    opponentStatsMinGames: number;
    playedStatsSortKey: UiStatsSortKey;
    opponentStatsSortKey: UiStatsSortKey;
    playedStatsSortDirection: UiSortDirection;
    opponentStatsSortDirection: UiSortDirection;
    expandedPlayedStatsChampionId: number | null;
    expandedOpponentStatsChampionId: number | null;
    shouldOpenFirstPlayedStatsRow: boolean;
    shouldOpenFirstOpponentStatsRow: boolean;
    banInsightMinGames: number;
    championsById: Record<string | number, any>;
    championPool: Record<string, number[]>;
    matchHistoryChampionStats: any[];
    matchHistoryEnemyChampionStats: any[];
    matchHistoryLaneOpponentStats: any[];
    matchHistorySelfVsLaneOpponentStats: any[];
    championPoolDirty: boolean;
    markedLaneOpponentCellId: number | null;
    lastRenderedState: any | null;
    lastChampSelectSnapshot: any | null;
    wasInChampSelect: boolean;
    draftAiAnalysisStatus: RendererAiAnalysisStatus;
    draftAiAnalysisNotes: RendererAiNote[];
    draftAiAnalysisRequestKey: string | null;
    draftAiAnalysisError: string;
    draftAiAnalysisPhase: string | null;
    finalCompositionAnalysisStatus: RendererAiAnalysisStatus;
    finalCompositionAnalysisNotes: RendererAiNote[];
    finalCompositionAnalysisRequestKey: string | null;
    finalCompositionAnalysisError: string;
  }

  function createRendererState(): RendererState {
    return {
      activeView: 'draft',
      activeStatsView: 'played',
      activeChampionPoolLane: 'top',
      activePlayedStatsLane: 'top',
      activeOpponentStatsLane: 'top',
      playedStatsMinGames: 5,
      opponentStatsMinGames: 5,
      playedStatsSortKey: 'winRate',
      opponentStatsSortKey: 'winRate',
      playedStatsSortDirection: 'desc',
      opponentStatsSortDirection: 'asc',
      expandedPlayedStatsChampionId: null,
      expandedOpponentStatsChampionId: null,
      shouldOpenFirstPlayedStatsRow: true,
      shouldOpenFirstOpponentStatsRow: true,
      banInsightMinGames: 5,
      championsById: {},
      championPool: {},
      matchHistoryChampionStats: [],
      matchHistoryEnemyChampionStats: [],
      matchHistoryLaneOpponentStats: [],
      matchHistorySelfVsLaneOpponentStats: [],
      championPoolDirty: false,
      markedLaneOpponentCellId: null,
      lastRenderedState: null,
      lastChampSelectSnapshot: null,
      wasInChampSelect: false,
      draftAiAnalysisStatus: 'idle',
      draftAiAnalysisNotes: [],
      draftAiAnalysisRequestKey: null,
      draftAiAnalysisError: '',
      draftAiAnalysisPhase: null,
      finalCompositionAnalysisStatus: 'idle',
      finalCompositionAnalysisNotes: [],
      finalCompositionAnalysisRequestKey: null,
      finalCompositionAnalysisError: ''
    };
  }

  const api = {
    createRendererState,
    state: createRendererState()
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.RendererState = api;
})(typeof window !== 'undefined' ? window : globalThis);
