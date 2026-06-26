(function attachRendererDraftController(root: UiRoot) {
  interface DraftControllerDeps {
    elements: UiDomElements;
    state: any;
    getDraftPanelState(state: any): any;
    getPhase(state: any): string | null | undefined;
    getSummonerName(summoner: any): string;
    stringify(value: any): string;
    formatDate(value: any): string;
    renderChampSelect(champSelect: any, gameflowPhase: any): void;
    renderInGame(state: any): void;
    resetDraftAiAnalysis(): void;
    resetFinalCompositionAnalysis(): void;
    logDebug(message: string, details?: any): void;
  }

  function createDraftController(deps: DraftControllerDeps) {
    const { elements, state } = deps;

    function renderStatus(nextState: any): void {
      elements.lcuStatus.textContent = nextState.lcuStatus ?? '-';
      elements.websocketStatus.textContent = nextState.websocketStatus ?? '-';
      elements.gameflowPhase.textContent = deps.getPhase(nextState) ?? (deps.stringify(nextState.gameflowPhase).replace(/^"|"$/g, '') || '-');
      elements.updatedAt.textContent = deps.formatDate(nextState.updatedAt);
      elements.errorMessage.textContent = nextState.error ?? '';
    }

    function renderDraft(nextState: any): void {
      const { champSelect, loggedIn, inGame, inChampSelect, unsupportedGameMode } = deps.getDraftPanelState(nextState);
      showOnlyDraftPanel(loggedIn, inChampSelect, inGame, unsupportedGameMode);

      if (!inChampSelect || unsupportedGameMode) {
        elements.champSelectView.classList.remove('local-turn');
        state.markedLaneOpponentCellId = null;
        deps.resetDraftAiAnalysis();
      }

      if (unsupportedGameMode) {
        deps.resetFinalCompositionAnalysis();
        return;
      }

      if (!loggedIn) return;

      elements.helloMessage.textContent = `こんにちは ${deps.getSummonerName(nextState.summoner)}`;

      if (inChampSelect) {
        state.lastChampSelectSnapshot = champSelect;
        deps.renderChampSelect(champSelect, nextState.gameflowPhase);
      } else if (inGame) {
        deps.renderInGame(nextState);
      }
    }

    function showOnlyDraftPanel(loggedIn: boolean, inChampSelect: boolean, inGame: boolean, unsupportedGameMode: boolean = false): void {
      elements.loggedOutView.hidden = loggedIn;
      elements.loggedInView.hidden = !loggedIn || inChampSelect || inGame || unsupportedGameMode;
      elements.unsupportedGameModeView.hidden = !loggedIn || !unsupportedGameMode;
      elements.champSelectView.hidden = !loggedIn || !inChampSelect || inGame || unsupportedGameMode;
      elements.inGameView.hidden = !loggedIn || !inGame || unsupportedGameMode;
    }

    function toggleMarkedLaneOpponent(cellId: number | string): void {
      const normalizedCellId = Number(cellId);
      if (!Number.isInteger(normalizedCellId)) return;

      state.markedLaneOpponentCellId = state.markedLaneOpponentCellId === normalizedCellId ? null : normalizedCellId;
      deps.logDebug('Lane opponent marker changed', { markedLaneOpponentCellId: state.markedLaneOpponentCellId });
      if (state.lastRenderedState) {
        renderDraft(state.lastRenderedState);
      }
    }

    return {
      renderDraft,
      renderStatus,
      showOnlyDraftPanel,
      toggleMarkedLaneOpponent
    };
  }

  const api = { createDraftController };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.RendererDraftController = api;
})(typeof window !== 'undefined' ? window : globalThis);
