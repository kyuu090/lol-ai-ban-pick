(function attachRendererChampionPoolController(root: UiRoot) {
  interface ChampionPoolControllerDeps {
    elements: UiDomElements;
    state: any;
    lcuApi: any;
    normalizeChampionPool(pool: any): any;
    getActiveChampionPoolLane(): UiLane;
    renderChampionPool(): void;
    logDebug(message: string, details?: any): void;
    logWarn(message: string, details?: any): void;
  }

  function createChampionPoolController(deps: ChampionPoolControllerDeps) {
    const { elements, state } = deps;

    function addChampionToPool(nextChampionId: number | string): void {
      const championId = Number(nextChampionId);
      if (!championId) return;

      state.championPool = deps.normalizeChampionPool(state.championPool);
      const lane = deps.getActiveChampionPoolLane();
      if ((state.championPool[lane.id] || []).includes(championId)) return;

      state.championPool[lane.id] = [...new Set([...(state.championPool[lane.id] || []), championId])];
      state.championPoolDirty = true;
      deps.logDebug('Champion added to pool', { lane: lane.id, championId });
      elements.championPoolMessage.textContent = '';
      deps.renderChampionPool();
    }

    function toggleChampionInPool(championId: number | string): void {
      state.championPool = deps.normalizeChampionPool(state.championPool);
      const lane = deps.getActiveChampionPoolLane();
      if ((state.championPool[lane.id] || []).includes(Number(championId))) {
        removeChampionFromPool(championId);
      } else {
        addChampionToPool(championId);
      }
    }

    function removeChampionFromPool(championId: number | string): void {
      state.championPool = deps.normalizeChampionPool(state.championPool);
      const lane = deps.getActiveChampionPoolLane();
      state.championPool[lane.id] = (state.championPool[lane.id] || []).filter((id: number) => id !== Number(championId));
      state.championPoolDirty = true;
      deps.logDebug('Champion removed from pool', { lane: lane.id, championId: Number(championId) });
      elements.championPoolMessage.textContent = '';
      deps.renderChampionPool();
    }

    async function saveChampionPool(): Promise<void> {
      elements.saveChampionPoolButton.disabled = true;
      elements.championPoolMessage.textContent = '';

      try {
        state.championPool = await deps.lcuApi.saveChampionPool(state.championPool);
        state.championPoolDirty = false;
        deps.renderChampionPool();
        deps.logDebug('Champion pool save completed', { championPool: state.championPool });
        elements.championPoolMessage.textContent = 'チャンピオンプールを保存しました。';
      } catch (error: any) {
        deps.logWarn('Champion pool save failed', { message: error.message, stack: error.stack });
        elements.championPoolMessage.textContent = `保存できませんでした: ${error.message}`;
      } finally {
        elements.saveChampionPoolButton.disabled = false;
      }
    }

    return {
      addChampionToPool,
      removeChampionFromPool,
      saveChampionPool,
      toggleChampionInPool
    };
  }

  const api = { createChampionPoolController };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.RendererChampionPoolController = api;
})(typeof window !== 'undefined' ? window : globalThis);
