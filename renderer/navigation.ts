(function attachRendererNavigation(root: UiRoot) {
  interface NavigationDeps {
    elements: UiDomElements;
    state: {
      activeView: string;
      activeStatsView: string;
    };
    logDebug(message: string, details?: any): void;
    forceRenderChampionPool(): void;
  }

  function createNavigationController(deps: NavigationDeps) {
    const { elements, state } = deps;

    function setActiveView(viewName: string): void {
      state.activeView = viewName;
      deps.logDebug('Active view changed', { viewName });
      elements.draftView.hidden = state.activeView !== 'draft';
      elements.championPoolView.hidden = state.activeView !== 'championPool';
      elements.statsView.hidden = state.activeView !== 'stats';
      elements.debugView.hidden = state.activeView !== 'debug';
      elements.settingsView.hidden = state.activeView !== 'settings';

      elements.tabButtons.forEach((button: HTMLButtonElement) => {
        button.classList.toggle('active', button.dataset.view === state.activeView);
      });

      if (state.activeView === 'championPool') {
        deps.forceRenderChampionPool();
      }

      renderStatsSubtabs();
    }

    function setActiveStatsView(viewName: string): void {
      state.activeStatsView = viewName === 'opponents' ? 'opponents' : 'played';
      deps.logDebug('Active stats view changed', { viewName: state.activeStatsView });
      renderStatsSubtabs();
    }

    function renderStatsSubtabs(): void {
      elements.playedStatsView.hidden = state.activeStatsView !== 'played';
      elements.opponentStatsView.hidden = state.activeStatsView !== 'opponents';
      elements.playedStatsSampleFilter.hidden = state.activeStatsView !== 'played';
      elements.opponentStatsSampleFilter.hidden = state.activeStatsView !== 'opponents';

      elements.statsSubtabButtons.forEach((button: HTMLButtonElement) => {
        button.classList.toggle('active', button.dataset.statsView === state.activeStatsView);
      });
    }

    return {
      renderStatsSubtabs,
      setActiveStatsView,
      setActiveView
    };
  }

  const api = { createNavigationController };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.RendererNavigation = api;
})(typeof window !== 'undefined' ? window : globalThis);
