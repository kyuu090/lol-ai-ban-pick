(function attachUiChampionPoolView(root: UiRoot) {
  function createChampionPoolView(deps: ChampionPoolViewDeps) {
    const elements = deps.elements;
    const doc = (deps.document || root.document) as Document;
    const lanes = deps.lanes;
    const laneToPosition = deps.laneToPosition;
    const normalizeChampionPool = deps.normalizeChampionPool;
    const loadChampionIcon = deps.loadChampionIcon;
    const championLabel = deps.championLabel;
    const championTitle = deps.championTitle;
    const getChampionRoleDisplayStats = deps.getChampionRoleDisplayStats;
    const createChampionStatsElement = deps.createChampionStatsElement;
    let lastChampionPickerRenderKey = '';
    let lastChampionPoolListRenderKey = '';

    function getActiveChampionPoolLane(): UiLane {
      return lanes.find((lane) => lane.id === deps.getActiveLaneId()) || lanes[0];
    }

    function getChampionPoolLanePosition(laneId: UiLaneId): string | null {
      return laneToPosition[laneId] || null;
    }

    function getChampionPoolLaneByPosition(position: string | null | undefined): UiLane | null {
      const normalizedPosition = String(position || '').toUpperCase();
      return lanes.find((lane) => laneToPosition[lane.id] === normalizedPosition) || null;
    }

    function getChampionOptions(): any[] {
      return Object.values(deps.getChampionsById())
        .filter((champion) => Number(champion.id) > 0 && champion.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    }

    function createChampionOptionsRenderKey(options: any[]): string {
      return options
        .map((champion) => [
          Number(champion.id) || 0,
          champion.name || '',
          champion.alias || '',
          champion.title || ''
        ].join(':'))
        .join('|');
    }

    function createChampionPoolStatsRenderKey(championIds: number[], laneId: UiLaneId): string {
      const position = getChampionPoolLanePosition(laneId);
      return championIds
        .map((championId) => {
          const stats = getChampionRoleDisplayStats(championId, position);
          return [
            Number(championId) || 0,
            championLabel(championId),
            championTitle(championId),
            Number(stats?.games || 0),
            Number(stats?.wins || 0),
            Number(stats?.winRate || 0),
            Number(stats?.kda || 0)
          ].join(':');
        })
        .join('|');
    }

    function updateChampionPickerSelection(selectedChampionIds: Set<number>): void {
      elements.championPoolPickerGrid.querySelectorAll('.champion-picker-card').forEach((button: HTMLElement) => {
        const championId = Number(button.dataset.championId);
        const selected = selectedChampionIds.has(championId);
        button.classList.toggle('selected', selected);
        button.title = selected ? `${championLabel(championId)} は登録済みです` : championTitle(championId);
      });
    }

    function normalizeSearchText(value: unknown): string {
      return String(value || '').trim().toLowerCase();
    }

    function renderLaneTabs(): void {
      const activeLaneId = deps.getActiveLaneId();
      if (elements.laneTabs.childElementCount > 0) {
        elements.laneTabs.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
          button.classList.toggle('active', button.dataset.lane === activeLaneId);
        });
        return;
      }

      const buttons = lanes.map((lane) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.dataset.lane = lane.id;
        button.textContent = lane.label;
        button.className = `lane-tab${lane.id === activeLaneId ? ' active' : ''}`;
        button.addEventListener('click', () => {
          deps.setActiveLaneId(lane.id);
          elements.championPoolMessage.textContent = '';
          renderChampionPool();
        });
        return button;
      });

      elements.laneTabs.replaceChildren(...buttons);
    }

    function renderChampionPicker(championIds: number[]): void {
      const options = getChampionOptions();
      const searchText = normalizeSearchText(elements.championPoolSearchInput.value);
      const selectedChampionIds = new Set(championIds);
      const filteredOptions = options.filter((champion) => {
        if (!searchText) return true;
        return [
          champion.name,
          champion.alias,
          champion.title
        ].some((value) => normalizeSearchText(value).includes(searchText));
      });
      const renderKey = [
        searchText,
        createChampionOptionsRenderKey(options),
        filteredOptions.map((champion) => Number(champion.id) || 0).join(',')
      ].join('::');

      if (renderKey === lastChampionPickerRenderKey) {
        updateChampionPickerSelection(selectedChampionIds);
        return;
      }
      lastChampionPickerRenderKey = renderKey;

      elements.championPoolPickerGrid.replaceChildren(...filteredOptions.map((champion) => {
        const championId = Number(champion.id);
        const selected = selectedChampionIds.has(championId);
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = `champion-picker-card${selected ? ' selected' : ''}`;
        button.title = selected ? `${champion.name} は登録済みです` : championTitle(championId);
        button.dataset.championId = String(championId);

        const portrait = doc.createElement('div');
        portrait.className = 'champion-portrait';

        const image = doc.createElement('img');
        image.alt = champion.name;
        loadChampionIcon(image, championId);
        portrait.append(image);

        const name = doc.createElement('span');
        name.textContent = champion.name;

        button.append(portrait, name);
        button.addEventListener('click', () => deps.toggleChampionInPool(championId));
        return button;
      }));

      elements.championPoolPickerEmpty.hidden = filteredOptions.length > 0;
      elements.championPoolPickerEmpty.textContent = options.length > 0
        ? '一致するチャンピオンがありません。'
        : 'LCU接続後にチャンピオン一覧を取得します。';
    }

    function renderChampionPool(): void {
      const normalizedChampionPool = normalizeChampionPool(deps.getChampionPool());
      deps.setChampionPool(normalizedChampionPool);

      const lane = getActiveChampionPoolLane();
      const championIds = (normalizedChampionPool as Record<string, number[]>)[lane.id] || [];
      const listRenderKey = [
        lane.id,
        championIds.join(','),
        createChampionPoolStatsRenderKey(championIds, lane.id)
      ].join('::');

      renderLaneTabs();
      renderChampionPicker(championIds);

      elements.championPoolListTitle.textContent = lane.label;
      elements.championPoolEmpty.hidden = championIds.length > 0;
      if (listRenderKey === lastChampionPoolListRenderKey) return;
      lastChampionPoolListRenderKey = listRenderKey;

      elements.championPoolList.replaceChildren(...championIds.map((championId: number) => {
        const item = doc.createElement('article');
        item.className = 'pool-champion';
        item.title = championTitle(championId);

        const portrait = doc.createElement('div');
        portrait.className = 'champion-portrait';

        const image = doc.createElement('img');
        image.alt = championLabel(championId);
        loadChampionIcon(image, championId);
        portrait.append(image);

        const meta = doc.createElement('div');
        meta.className = 'pool-champion-meta';

        const name = doc.createElement('strong');
        name.textContent = championLabel(championId);

        meta.append(name, createChampionStatsElement(
          getChampionRoleDisplayStats(championId, getChampionPoolLanePosition(lane.id))
        ));

        const removeButton = doc.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'pool-remove-button';
        removeButton.dataset.championId = String(championId);
        removeButton.title = `${championLabel(championId)} を削除`;
        removeButton.setAttribute('aria-label', `${championLabel(championId)} を削除`);
        const removeIcon = doc.createElement('span');
        removeIcon.className = 'remove-x-icon';
        removeButton.append(removeIcon);
        removeButton.addEventListener('click', () => deps.removeChampionFromPool(championId));

        item.append(portrait, meta, removeButton);
        return item;
      }));
    }

    function forceRenderChampionPool(): void {
      lastChampionPickerRenderKey = '';
      lastChampionPoolListRenderKey = '';
      renderChampionPool();
    }

    return {
      forceRenderChampionPool,
      getActiveChampionPoolLane,
      getChampionPoolLaneByPosition,
      getChampionPoolLanePosition,
      renderChampionPool
    };
  }

  const api = { createChampionPoolView };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiChampionPoolView = api;
})(typeof window !== 'undefined' ? window : globalThis);
