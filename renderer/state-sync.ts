(function attachRendererStateSync(root: UiRoot) {
  interface StateSyncDeps {
    elements: UiDomElements;
    state: any;
    getDraftPanelState(state: any): any;
    normalizeChampionPool(pool: any): any;
    renderMatchHistoryStatus(status: any): void;
    renderMatchDataSummary(summary: any, settings: any): void;
    renderSettings(settings: any): void;
    renderChampionPool(): void;
    renderPlayedChampionStats(): void;
    renderLaneOpponentStats(): void;
    renderDraft(state: any): void;
    setActiveView(viewName: string): void;
    resetFinalCompositionAnalysis(): void;
  }

  function createStateSyncController(deps: StateSyncDeps) {
    const { elements, state } = deps;

    function renderState(nextState: any): void {
      state.lastRenderedState = nextState;
      syncDraftAutoFocus(nextState);
      state.championsById = nextState.championsById || {};
      state.matchHistoryChampionStats = Array.isArray(nextState.matchHistoryChampionStats) ? nextState.matchHistoryChampionStats : [];
      state.matchHistoryEnemyChampionStats = Array.isArray(nextState.matchHistoryEnemyChampionStats) ? nextState.matchHistoryEnemyChampionStats : [];
      state.matchHistoryLaneOpponentStats = Array.isArray(nextState.matchHistoryLaneOpponentStats) ? nextState.matchHistoryLaneOpponentStats : [];
      state.matchHistorySelfVsLaneOpponentStats = Array.isArray(nextState.matchHistorySelfVsLaneOpponentStats)
        ? nextState.matchHistorySelfVsLaneOpponentStats
        : [];
      state.matchHistoryLaneMatchupTimeline = Array.isArray(nextState.matchHistoryLaneMatchupTimeline)
        ? nextState.matchHistoryLaneMatchupTimeline
        : [];
      if (!state.championPoolDirty) {
        state.championPool = deps.normalizeChampionPool(nextState.championPool);
      }
      deps.renderMatchHistoryStatus(nextState.matchHistoryStatus);
      deps.renderMatchDataSummary(nextState.matchHistorySummary, nextState.settings);
      deps.renderSettings({
        ...nextState.settings,
        detectedRiotPlatformRegion: nextState.detectedRiotPlatformRegion,
        detectedRiotRegionalRoute: nextState.detectedRiotRegionalRoute
      });
      deps.renderChampionPool();
      deps.renderPlayedChampionStats();
      deps.renderLaneOpponentStats();
      deps.renderDraft(nextState);
    }

    function syncDraftAutoFocus(nextState: any): void {
      const { phase, inChampSelect, unsupportedGameMode } = deps.getDraftPanelState(nextState);
      const shouldAutoFocusDraft = inChampSelect || (unsupportedGameMode && phase === 'ChampSelect');
      elements.draftTabButton.classList.toggle('draft-live', inChampSelect);

      if (inChampSelect && !state.wasInChampSelect) {
        deps.resetFinalCompositionAnalysis();
      }

      if (shouldAutoFocusDraft && !state.wasInChampSelect && state.activeView !== 'draft') {
        deps.setActiveView('draft');
      }

      state.wasInChampSelect = shouldAutoFocusDraft;
    }

    return {
      renderState,
      syncDraftAutoFocus
    };
  }

  const api = { createStateSyncController };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.RendererStateSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
