(function attachUiChampionsView(root: UiRoot) {
  const STATS_API_BASE_URL = 'https://db.banpick-ai.lol';
  const STATS_API_MIN_PICK_RATE = 0.005;
  const STATS_API_DEFAULT_RETRY_AFTER_SECONDS = 5;

  interface StatsApiMetaData {
    latestPatch?: string | null;
    patches?: string[];
    positions?: string[];
    ranks?: string[];
  }

  interface StatsApiChampionStats {
    banRate: number;
    championId: number;
    games: number;
    mostPlayedLane?: string | null;
    pickRate: number;
    winRate: number;
  }

  interface StatsApiFilters {
    patch?: string;
    position?: string;
    ranks?: string[];
  }

  interface StatsApiErrorInfo {
    message: string;
    retryAfterSeconds: number | null;
    status: number | null;
  }

  function buildStatsApiChampionsUrl(filters: StatsApiFilters, baseUrl = STATS_API_BASE_URL): string {
    const url = new URL('/v1/stats/champions', baseUrl);
    if (filters.patch) {
      url.searchParams.set('patch', filters.patch);
    }
    if (filters.position) {
      url.searchParams.set('position', filters.position);
    }
    if (filters.ranks && filters.ranks.length > 0) {
      url.searchParams.set('ranks', filters.ranks.join(','));
    }
    url.searchParams.set('minPickRate', String(STATS_API_MIN_PICK_RATE));
    url.searchParams.set('limit', '200');
    url.searchParams.set('sort', 'games:desc');
    return url.toString();
  }

  function parseStatsApiRetryAfterSeconds(value: string | null | undefined, now = Date.now()): number | null {
    if (!value) return null;

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(1, Math.ceil(seconds));
    }

    const retryAt = Date.parse(value);
    if (Number.isFinite(retryAt)) {
      return Math.max(1, Math.ceil((retryAt - now) / 1000));
    }

    return null;
  }

  function createStatsApiHttpError(status: number, retryAfterHeader: string | null): Error {
    const retryAfterSeconds = parseStatsApiRetryAfterSeconds(retryAfterHeader) ||
      (status === 429 ? STATS_API_DEFAULT_RETRY_AFTER_SECONDS : null);
    const retryMessage = Number.isFinite(retryAfterSeconds)
      ? `; retryAfterSeconds=${retryAfterSeconds}`
      : '';
    const error = new Error(`StatsAPI request failed: ${status}${retryMessage}`) as Error & {
      retryAfterSeconds?: number | null;
      status?: number;
    };
    error.status = status;
    error.retryAfterSeconds = retryAfterSeconds;
    return error;
  }

  function parseStatsApiErrorInfo(error: any): StatsApiErrorInfo {
    const message = String(error?.message || error || 'unknown error');
    const status = Number.isFinite(Number(error?.status))
      ? Number(error.status)
      : Number(message.match(/StatsAPI request failed:\s*(\d+)/)?.[1] || NaN);
    const retryAfterSeconds = Number.isFinite(Number(error?.retryAfterSeconds))
      ? Number(error.retryAfterSeconds)
      : Number(message.match(/retryAfterSeconds=(\d+)/)?.[1] || NaN);

    return {
      message,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? Math.max(1, retryAfterSeconds) : null,
      status: Number.isFinite(status) ? status : null
    };
  }

  function formatStatsApiErrorMessage(error: any): string {
    const errorInfo = parseStatsApiErrorInfo(error);
    if (errorInfo.status === 429) {
      const retryAfter = errorInfo.retryAfterSeconds
        ? `${errorInfo.retryAfterSeconds}秒後に再試行できます。`
        : '少し待ってから再試行してください。';
      return `レート制限に達しました。${retryAfter}`;
    }
    if (errorInfo.status && errorInfo.status >= 500) {
      return `StatsAPIサーバーでエラーが発生しました (${errorInfo.status})。`;
    }
    return errorInfo.message;
  }

  function createChampionsView(deps: ChampionsViewDeps) {
    const elements = deps.elements;
    const doc = (deps.document || root.document) as Document;
    const requestStatsApiJson = deps.requestStatsApiJson || root.lcuApi?.requestStatsApiJson;
    const fetchImpl = deps.fetch || root.fetch?.bind(root);
    let statsApiMeta: StatsApiMetaData | null = null;
    let statsApiSelectedPatch = '';
    let statsApiSelectedRanks = new Set<string>();
    let statsApiRequestId = 0;
    let statsApiRankDropdownInitialized = false;
    let statsApiRetryTimer: UiTimerHandle | null = null;

    function formatStatsApiRate(value: unknown): string {
      return `${(Number(value || 0) * 100).toFixed(1)}%`;
    }

    function setStatsApiStatus(message: string): void {
      if (elements.statsApiStatus) {
        elements.statsApiStatus.textContent = message;
      }
    }

    function setStatsApiLoading(isLoading: boolean): void {
      if (elements.statsApiRefreshButton) {
        elements.statsApiRefreshButton.disabled = isLoading;
        elements.statsApiRefreshButton.textContent = isLoading ? '取得中' : '更新';
      }
    }

    function clearStatsApiRetryTimer(): void {
      if (!statsApiRetryTimer) return;
      (deps.clearTimeout || root.clearTimeout || clearTimeout)(statsApiRetryTimer);
      statsApiRetryTimer = null;
    }

    function initializeStatsApiRankDropdown(): void {
      if (statsApiRankDropdownInitialized || !elements.statsApiRankDropdownButton || !elements.statsApiRankDropdown) return;
      statsApiRankDropdownInitialized = true;

      elements.statsApiRankDropdownButton.addEventListener('click', () => {
        setStatsApiRankDropdownOpen(Boolean(elements.statsApiRankDropdown.hidden));
      });

      doc.addEventListener('click', (event: MouseEvent) => {
        const target = event.target as Node | null;
        if (!target) return;
        if (elements.statsApiRankDropdownButton.contains(target) || elements.statsApiRankDropdown.contains(target)) return;
        setStatsApiRankDropdownOpen(false);
      });
    }

    function setStatsApiRankDropdownOpen(isOpen: boolean): void {
      if (!elements.statsApiRankDropdown || !elements.statsApiRankDropdownButton) return;
      elements.statsApiRankDropdown.hidden = !isOpen;
      elements.statsApiRankDropdownButton.setAttribute('aria-expanded', String(isOpen));
    }

    function updateStatsApiRankSummary(): void {
      if (!elements.statsApiRankSummary) return;
      const allRanks = statsApiMeta?.ranks || [];
      const selectedRanks = getStatsApiSelectedRanks();
      if (selectedRanks.length === 0) {
        elements.statsApiRankSummary.textContent = 'No rank';
      } else if (selectedRanks.length >= allRanks.length) {
        elements.statsApiRankSummary.textContent = 'All rank';
      } else if (selectedRanks.length <= 2) {
        elements.statsApiRankSummary.textContent = selectedRanks.join(', ');
      } else {
        elements.statsApiRankSummary.textContent = `${selectedRanks.length} ranks`;
      }
    }

    function getStatsApiSelectedRanks(): string[] {
      if (!elements.statsApiRankOptions) return Array.from(statsApiSelectedRanks);
      const rankOptions = elements.statsApiRankOptions as HTMLElement;
      return Array.from(rankOptions.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'))
        .map((input: HTMLInputElement) => input.value)
        .filter(Boolean);
    }

    function getStatsApiSelectedFilters(): StatsApiFilters {
      const allRanks = statsApiMeta?.ranks || [];
      const selectedRanks = getStatsApiSelectedRanks();
      return {
        patch: elements.statsApiPatchSelect?.value || statsApiSelectedPatch || statsApiMeta?.latestPatch || undefined,
        position: elements.statsApiLaneSelect?.value || undefined,
        ranks: selectedRanks.length < allRanks.length ? selectedRanks : undefined
      };
    }

    async function fetchStatsApiJson(pathOrUrl: string): Promise<any> {
      if (requestStatsApiJson) {
        return requestStatsApiJson(pathOrUrl);
      }
      if (!fetchImpl) {
        throw new Error('この環境ではfetchを利用できません。');
      }
      const response = await fetchImpl(pathOrUrl);
      if (!response.ok) {
        throw createStatsApiHttpError(response.status, response.headers?.get?.('retry-after') || null);
      }
      return response.json();
    }

    async function initializeStatsApiChampionList(): Promise<void> {
      clearStatsApiRetryTimer();
      initializeStatsApiRankDropdown();
      setStatsApiLoading(true);
      setStatsApiStatus('StatsAPIのメタ情報を取得しています。');
      clearStatsApiChampionRows();
      try {
        const response = await fetchStatsApiJson('/v1/stats/meta');
        statsApiMeta = response?.data || {};
        statsApiSelectedPatch = statsApiMeta?.latestPatch || statsApiMeta?.patches?.[0] || '';
        statsApiSelectedRanks = new Set(statsApiMeta?.ranks || []);
        renderStatsApiFilters();
        updateStatsApiRankSummary();
        await refreshStatsApiChampionList();
      } catch (error: any) {
        if (!scheduleStatsApiRetry('meta', error)) {
          setStatsApiStatus(`StatsAPIを取得できませんでした: ${formatStatsApiErrorMessage(error)}`);
        }
      } finally {
        setStatsApiLoading(false);
      }
    }

    function renderStatsApiFilters(): void {
      renderStatsApiPatchOptions(statsApiMeta?.patches || []);
      renderStatsApiLaneOptions(statsApiMeta?.positions || []);
      renderStatsApiRankOptions(statsApiMeta?.ranks || []);
    }

    function renderStatsApiPatchOptions(patches: string[]): void {
      if (!elements.statsApiPatchSelect) return;
      const options = patches.map((patch) => {
        const option = doc.createElement('option');
        option.value = patch;
        option.textContent = patch;
        option.selected = patch === statsApiSelectedPatch;
        return option;
      });
      elements.statsApiPatchSelect.replaceChildren(...options);
    }

    function renderStatsApiLaneOptions(positions: string[]): void {
      if (!elements.statsApiLaneSelect) return;
      const allLaneOption = doc.createElement('option');
      allLaneOption.value = '';
      allLaneOption.textContent = 'All lane';
      const options = positions.map((position) => {
        const option = doc.createElement('option');
        option.value = position;
        option.textContent = position;
        return option;
      });
      elements.statsApiLaneSelect.replaceChildren(allLaneOption, ...options);
    }

    function renderStatsApiRankOptions(ranks: string[]): void {
      if (!elements.statsApiRankOptions) return;
      const options = ranks.map((rank) => {
        const label = doc.createElement('label');
        label.className = 'stats-api-rank-option';

        const checkbox = doc.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = rank;
        checkbox.checked = statsApiSelectedRanks.has(rank);
        checkbox.addEventListener('change', () => {
          statsApiSelectedRanks = new Set(getStatsApiSelectedRanks());
          updateStatsApiRankSummary();
          refreshStatsApiChampionList();
        });

        const text = doc.createElement('span');
        text.textContent = rank;
        label.append(checkbox, text);
        return label;
      });
      elements.statsApiRankOptions.replaceChildren(...options);
      updateStatsApiRankSummary();
    }

    async function refreshStatsApiChampionList(): Promise<void> {
      clearStatsApiRetryTimer();
      if (!statsApiMeta) return;
      const filters = getStatsApiSelectedFilters();
      if (filters.ranks && filters.ranks.length === 0) {
        clearStatsApiChampionRows();
        setStatsApiLoading(false);
        setStatsApiStatus('Rankを1つ以上選択してください。');
        return;
      }
      const requestId = ++statsApiRequestId;
      setStatsApiLoading(true);
      setStatsApiStatus('チャンピオン一覧を取得しています。');
      try {
        const response = await fetchStatsApiJson(buildStatsApiChampionsUrl(filters));
        if (requestId !== statsApiRequestId) return;
        const statsList = Array.isArray(response?.data) ? response.data : [];
        renderStatsApiChampionTable(statsList);
        setStatsApiStatus(createStatsApiStatusText(statsList.length, response?.meta?.dataset?.watermark));
      } catch (error: any) {
        if (requestId !== statsApiRequestId) return;
        clearStatsApiChampionRows();
        if (!scheduleStatsApiRetry('champions', error)) {
          setStatsApiStatus(`チャンピオン一覧を取得できませんでした: ${formatStatsApiErrorMessage(error)}`);
        }
      } finally {
        if (requestId === statsApiRequestId) {
          setStatsApiLoading(false);
        }
      }
    }

    function scheduleStatsApiRetry(target: 'meta' | 'champions', error: any): boolean {
      const errorInfo = parseStatsApiErrorInfo(error);
      if (errorInfo.status !== 429) return false;

      const retryAfterSeconds = errorInfo.retryAfterSeconds || STATS_API_DEFAULT_RETRY_AFTER_SECONDS;
      const targetLabel = target === 'meta' ? 'StatsAPIのメタ情報' : 'チャンピオン一覧';
      setStatsApiLoading(false);
      setStatsApiStatus(`${targetLabel}はレート制限中です。${retryAfterSeconds}秒後に自動再試行します。`);

      statsApiRetryTimer = (deps.setTimeout || root.setTimeout || setTimeout)(() => {
        statsApiRetryTimer = null;
        if (target === 'meta') {
          initializeStatsApiChampionList();
        } else {
          refreshStatsApiChampionList();
        }
      }, retryAfterSeconds * 1000);
      return true;
    }

    function createStatsApiStatusText(count: number, watermark: string | null | undefined): string {
      const filters = getStatsApiSelectedFilters();
      const rankText = filters.ranks?.length ? filters.ranks.join(', ') : 'All rank';
      const laneText = filters.position || 'All lane';
      const updated = watermark ? ` / data ${new Date(watermark).toLocaleDateString('ja-JP')}` : '';
      return `${count} champions / ${filters.patch || 'latest'} / ${laneText} / ${rankText}${updated}`;
    }

    function clearStatsApiChampionRows(): void {
      elements.statsApiChampionsTableBody?.replaceChildren();
      if (elements.statsApiChampionsEmpty) {
        elements.statsApiChampionsEmpty.hidden = false;
      }
    }

    function renderStatsApiChampionTable(statsList: StatsApiChampionStats[]): void {
      const rows = statsList.map((stats) => createStatsApiChampionRow(stats));
      elements.statsApiChampionsTableBody?.replaceChildren(...rows);
      if (elements.statsApiChampionsEmpty) {
        elements.statsApiChampionsEmpty.hidden = statsList.length > 0;
        elements.statsApiChampionsEmpty.textContent = '条件に合うチャンピオンがありません。';
      }
    }

    function createStatsApiChampionRow(stats: StatsApiChampionStats): HTMLTableRowElement {
      const row = doc.createElement('tr');

      const championCell = doc.createElement('th');
      championCell.scope = 'row';
      championCell.append(deps.createInlineChampionName(stats.championId, 'inline-champion-name stats-table-champion'));

      const laneCell = doc.createElement('td');
      laneCell.textContent = stats.mostPlayedLane || '-';

      const gamesCell = doc.createElement('td');
      gamesCell.textContent = String(Number(stats.games || 0));

      const winRateCell = doc.createElement('td');
      winRateCell.textContent = formatStatsApiRate(stats.winRate);

      const pickRateCell = doc.createElement('td');
      pickRateCell.textContent = formatStatsApiRate(stats.pickRate);

      const banRateCell = doc.createElement('td');
      banRateCell.textContent = formatStatsApiRate(stats.banRate);

      row.append(championCell, laneCell, gamesCell, winRateCell, pickRateCell, banRateCell);
      return row;
    }

    return {
      initializeStatsApiChampionList,
      refreshStatsApiChampionList
    };
  }

  const api = {
    buildStatsApiChampionsUrl,
    createChampionsView,
    formatStatsApiErrorMessage,
    parseStatsApiErrorInfo,
    parseStatsApiRetryAfterSeconds
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiChampionsView = api;
})(typeof window !== 'undefined' ? window : globalThis);
