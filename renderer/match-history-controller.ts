(function attachRendererMatchHistoryController(root: UiRoot) {
  interface MatchHistoryControllerDeps {
    elements: UiDomElements;
    lcuApi: any;
    setMatchDataMenuOpen(isOpen: boolean): void;
    renderMatchHistoryStatus(status: any): void;
    logDebug(message: string, details?: any): void;
    logWarn(message: string, details?: any): void;
  }

  function createMatchHistoryController(deps: MatchHistoryControllerDeps) {
    const { elements } = deps;

    async function collectRiotMatchHistory(mode: string = 'recent'): Promise<void> {
      deps.setMatchDataMenuOpen(false);
      elements.collectRiotMatchesButton.disabled = true;
      elements.matchDataMenuButton.disabled = true;
      elements.collectSeasonRiotMatchesButton.disabled = true;
      elements.matchDataSeasonHint.disabled = true;
      elements.collectRiotMatchesButton.textContent = mode === 'season' ? 'Downloading season...' : 'Downloading...';

      try {
        deps.logDebug('Manual Riot match history collection requested', { mode });
        const summary = await deps.lcuApi.collectRiotMatchHistory({ mode });
        deps.logDebug('Manual Riot match history collection completed', summary);
      } catch (error: any) {
        deps.logWarn('Manual Riot match history collection failed', { message: error.message, stack: error.stack });
      } finally {
        const state = await deps.lcuApi.getState();
        deps.renderMatchHistoryStatus(state.matchHistoryStatus);
      }
    }

    return {
      collectRiotMatchHistory
    };
  }

  const api = { createMatchHistoryController };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.RendererMatchHistoryController = api;
})(typeof window !== 'undefined' ? window : globalThis);
