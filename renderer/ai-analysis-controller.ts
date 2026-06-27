(function attachRendererAiAnalysisController(root: UiRoot) {
  interface AiAnalysisDeps {
    state: any;
    lcuApi: any;
    createPickPhaseDraftContext(args: any): any;
    createFinalCompositionDraftContext(args: any): any;
    championLabel(championId: number): string;
    logDebug(message: string, details?: any): void;
    renderDraftAiAnalysis(status: string): void;
    renderInGameFinalCompositionAnalysis(): void;
  }

  function createAiAnalysisController(deps: AiAnalysisDeps) {
    const { state } = deps;

    function resetDraftAiAnalysis(): void {
      state.draftAiAnalysisStatus = 'idle';
      state.draftAiAnalysisNotes = [];
      state.draftAiAnalysisRequestKey = null;
      state.draftAiAnalysisError = '';
      state.draftAiAnalysisPhase = null;
    }

    function resetFinalCompositionAnalysis(): void {
      state.finalCompositionAnalysisStatus = 'idle';
      state.finalCompositionAnalysisNotes = [];
      state.finalCompositionAnalysisRequestKey = null;
      state.finalCompositionAnalysisError = '';
    }

    function requestDraftAiAnalysisIfNeeded(champSelect: any, localMember: any, activeAction: any): void {
      const draftContext = deps.createPickPhaseDraftContext({
        champSelect,
        localMember,
        championPool: state.championPool,
        championLabel: deps.championLabel
      });
      requestDraftAiAnalysis(draftContext, activeAction);
    }

    function requestFinalCompositionAnalysisIfNeeded(champSelect: any, localMember: any): void {
      const draftContext = deps.createFinalCompositionDraftContext({
        champSelect,
        localMember,
        championLabel: deps.championLabel
      });
      requestDraftAiAnalysis(draftContext);
    }

    function requestDraftAiAnalysis(draftContext: any, activeAction: any = null): void {
      if (!draftContext) return;

      const requestPhase = draftContext.phase || null;
      const requestAnalysis = requestPhase === 'final_composition'
        ? deps.lcuApi?.requestFinalCompositionAnalysis
        : deps.lcuApi?.requestPickPhaseAnalysis;
      if (!requestAnalysis) return;

      const requestKey = createDraftAiAnalysisRequestKey(activeAction, draftContext);
      if (requestPhase === 'final_composition') {
        if (state.finalCompositionAnalysisStatus === 'requesting' && state.finalCompositionAnalysisRequestKey === requestKey) return;
        if (state.finalCompositionAnalysisStatus === 'ready' && state.finalCompositionAnalysisRequestKey === requestKey) return;
        if (state.finalCompositionAnalysisStatus === 'error' && state.finalCompositionAnalysisRequestKey === requestKey) return;
      } else if (state.draftAiAnalysisStatus === 'ready' && state.draftAiAnalysisPhase === requestPhase) {
        return;
      }

      if (state.draftAiAnalysisStatus === 'requesting' && state.draftAiAnalysisRequestKey === requestKey) return;
      if (state.draftAiAnalysisStatus === 'error' && state.draftAiAnalysisRequestKey === requestKey) return;

      if (requestPhase === 'final_composition') {
        state.finalCompositionAnalysisStatus = 'requesting';
        state.finalCompositionAnalysisNotes = [];
        state.finalCompositionAnalysisError = '';
        state.finalCompositionAnalysisRequestKey = requestKey;
        deps.renderInGameFinalCompositionAnalysis();
      }

      state.draftAiAnalysisStatus = 'requesting';
      state.draftAiAnalysisNotes = [];
      state.draftAiAnalysisError = '';
      state.draftAiAnalysisRequestKey = requestKey;
      state.draftAiAnalysisPhase = requestPhase;
      deps.logDebug('Draft AI analysis request started', { requestKey, draftContext });

      requestAnalysis(draftContext)
        .then((response: any) => {
          const notes = parseDraftAiAnalysisNotes(response);
          if (requestPhase === 'final_composition') {
            if (state.finalCompositionAnalysisRequestKey !== requestKey) return;
            state.finalCompositionAnalysisNotes = notes;
            state.finalCompositionAnalysisStatus = notes.length ? 'ready' : 'error';
            state.finalCompositionAnalysisError = notes.length ? '' : 'AI分析を表示できませんでした。';
            deps.renderInGameFinalCompositionAnalysis();
          }
          if (state.draftAiAnalysisRequestKey === requestKey) {
            state.draftAiAnalysisNotes = notes;
            state.draftAiAnalysisStatus = notes.length ? 'ready' : 'error';
            state.draftAiAnalysisError = notes.length ? '' : 'AI分析を表示できませんでした。';
            deps.renderDraftAiAnalysis(state.draftAiAnalysisStatus);
          }
          deps.logDebug('Draft AI analysis response received', { requestKey, notes: notes.length });
        })
        .catch((error: any) => {
          const errorMessage = createDraftAiAnalysisErrorMessage(error);
          if (requestPhase === 'final_composition' && state.finalCompositionAnalysisRequestKey === requestKey) {
            state.finalCompositionAnalysisStatus = 'error';
            state.finalCompositionAnalysisError = errorMessage;
            deps.renderInGameFinalCompositionAnalysis();
          }
          if (state.draftAiAnalysisRequestKey === requestKey) {
            state.draftAiAnalysisStatus = 'error';
            state.draftAiAnalysisError = errorMessage;
            deps.renderDraftAiAnalysis(state.draftAiAnalysisStatus);
          }
          deps.logDebug('Draft AI analysis request failed', {
            requestKey,
            error: error?.message || String(error)
          });
        });
    }

    function createDraftAiAnalysisRequestKey(activeAction: any, draftContext: any): string {
      return JSON.stringify({
        phase: draftContext?.phase ?? null,
        actionId: activeAction?.id ?? null,
        actorCellId: activeAction?.actorCellId ?? null,
        draftContext
      });
    }

    function createDraftAiAnalysisErrorMessage(error: any): string {
      const message = String(error?.message || '');
      if (message.includes('429')) return 'AI分析のリクエストが混み合っています。少し待ってから再度お試しください。';
      if (message.includes('400')) return 'AI分析に必要なドラフト情報が不足しています。';
      return 'AI分析を取得できませんでした。';
    }

    function parseDraftAiAnalysisNotes(response: any): Array<{ title: string; body: string }> {
      try {
        const parsed = typeof response === 'string' ? JSON.parse(response) : response;
        return (Array.isArray(parsed?.notes) ? parsed.notes : [])
          .filter((note: any) => note && typeof note === 'object')
          .slice(0, 3)
          .map((note: any) => ({
            title: String(note.title || '').trim(),
            body: String(note.body || '').trim()
          }))
          .filter((note: any) => note.title || note.body);
      } catch (error: any) {
        deps.logDebug('Failed to parse draft AI analysis response', { error: error?.message || String(error) });
        return [];
      }
    }

    return {
      createDraftAiAnalysisErrorMessage,
      createDraftAiAnalysisRequestKey,
      parseDraftAiAnalysisNotes,
      requestDraftAiAnalysis,
      requestDraftAiAnalysisIfNeeded,
      requestFinalCompositionAnalysisIfNeeded,
      resetDraftAiAnalysis,
      resetFinalCompositionAnalysis
    };
  }

  const api = { createAiAnalysisController };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.RendererAiAnalysisController = api;
})(typeof window !== 'undefined' ? window : globalThis);
