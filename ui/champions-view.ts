(function attachUiChampionsView(root: UiRoot) {
  const STATS_API_BASE_URL = 'https://db.banpick-ai.lol';
  const STATS_API_MIN_PICK_RATE = 0.005;
  const STATS_API_DEFAULT_RETRY_AFTER_SECONDS = 5;
  const STATS_API_LANES = [
    { id: 'TOP', label: 'TOP' },
    { id: 'JUNGLE', label: 'JG' },
    { id: 'MIDDLE', label: 'MID' },
    { id: 'BOTTOM', label: 'BOT' },
    { id: 'UTILITY', label: 'SUP' }
  ] as const;
  const KEYSTONE_LABELS: Record<number, string> = {
    8005: 'プレスアタック',
    8008: 'リーサルテンポ',
    8010: '征服者',
    8021: 'フリートフットワーク',
    8112: '電撃',
    8124: '捕食者',
    8128: 'ダークハーベスト',
    8214: 'エアリー',
    8229: '秘儀の彗星',
    8230: 'フェイズラッシュ',
    8437: '不死者の握撃',
    8439: 'アフターショック',
    8465: 'ガーディアン',
    9923: 'ヘイルブレード'
  };
  const RUNE_STYLE_LABELS: Record<number, string> = {
    8000: '栄華',
    8100: '覇道',
    8200: '魔道',
    8300: '天啓',
    8400: '不滅',
    8500: '栄華'
  };
  const SHARD_LABELS: Record<number, string> = {
    5001: 'スケーリング体力',
    5005: '攻撃速度',
    5007: 'スキルヘイスト',
    5008: 'アダプティブフォース',
    5010: '移動速度',
    5011: '体力',
    5013: '行動妨害耐性'
  };
  // Data Dragon's public rune JSON does not include stat shard ID -> icon mappings,
  // so we keep the known official StatMods asset paths in one place.
  const SHARD_ICON_PATHS: Record<number, string> = {
    5001: 'perk-images/StatMods/StatModsHealthPlusIcon.png',
    5005: 'perk-images/StatMods/StatModsAttackSpeedIcon.png',
    5007: 'perk-images/StatMods/StatModsCDRScalingIcon.png',
    5008: 'perk-images/StatMods/StatModsAdaptiveForceIcon.png',
    5010: 'perk-images/StatMods/StatModsMovementSpeedIcon.png',
    5011: 'perk-images/StatMods/StatModsHealthScalingIcon.png',
    5013: 'perk-images/StatMods/StatModsTenacityIcon.png'
  };
  const STATS_API_SHARD_ROWS = [
    [5008, 5005, 5007],
    [5008, 5010, 5001],
    [5011, 5013, 5001]
  ] as const;
  const SUMMONER_SPELL_LABELS: Record<number, string> = {
    1: 'クレンズ',
    3: 'イグゾースト',
    4: 'フラッシュ',
    6: 'ゴースト',
    7: 'ヒール',
    11: 'スマイト',
    12: 'テレポート',
    13: 'クラリティ',
    14: 'イグナイト',
    21: 'バリア',
    32: 'マーク'
  };
  const SUMMONER_SPELL_ICON_KEYS: Record<number, string> = {
    1: 'SummonerBoost',
    3: 'SummonerExhaust',
    4: 'SummonerFlash',
    6: 'SummonerHaste',
    7: 'SummonerHeal',
    11: 'SummonerSmite',
    12: 'SummonerTeleport',
    13: 'SummonerMana',
    14: 'SummonerDot',
    21: 'SummonerBarrier',
    32: 'SummonerSnowball'
  };
  type StatsApiLaneOption = (typeof STATS_API_LANES)[number];
  type StatsApiSortKey = 'champion' | 'lane' | 'games' | 'winRate' | 'pickRate' | 'banRate' | 'tierScore';

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
    tier?: string | null;
    tierScore?: number;
    winRate: number;
  }

  interface StatsApiFilters {
    patch?: string;
    position?: string;
    ranks?: string[];
  }

  interface StatsApiChampionDetailsFilters extends StatsApiFilters {
    championId?: number;
    opponentChampionId?: number;
  }

  interface StatsApiOpponentChampionOption {
    alias: string;
    championId: number;
    name: string;
    searchText: string;
    title: string;
  }

  interface StatsApiErrorInfo {
    message: string;
    retryAfterSeconds: number | null;
    status: number | null;
  }

  interface StatsApiChampionSummary {
    championId: number;
    games: number;
    wins: number;
    pickRate: number;
    winRate: number;
  }

  interface StatsApiOptionStat {
    games: number;
    wins: number;
    pickRate: number;
    winRate: number;
  }

  interface StatsApiRuneSet extends StatsApiOptionStat {
    primaryStyleId: number;
    primaryRuneIds: number[];
    secondaryStyleId: number;
    secondaryRuneIds: number[];
  }

  interface StatsApiStatShards extends StatsApiOptionStat {
    shardIds: number[];
  }

  interface StatsApiSummonerSpells extends StatsApiOptionStat {
    spellIds: number[];
  }

  interface StatsApiItemSet extends StatsApiOptionStat {
    itemIds: number[];
  }

  interface StatsApiSingleItem extends StatsApiOptionStat {
    itemId: number;
  }

  interface StatsApiSkillOpening extends StatsApiOptionStat {
    skillOrder: string[];
  }

  interface StatsApiSkillPriority extends StatsApiOptionStat {
    firstMaxSkill: string;
    secondMaxSkill: string;
    thirdMaxSkill: string;
  }

  interface StatsApiKeystoneDetails extends StatsApiOptionStat {
    keystoneId: number;
    runes?: StatsApiRuneSet[];
    statShards?: StatsApiStatShards[];
    summonerSpells?: StatsApiSummonerSpells[];
    startingItems?: StatsApiItemSet[];
    boots?: StatsApiSingleItem[];
    firstSecondCoreItems?: StatsApiItemSet[];
    thirdItems?: StatsApiSingleItem[];
    fourthItems?: StatsApiSingleItem[];
    fifthItems?: StatsApiSingleItem[];
    sixthItems?: StatsApiSingleItem[];
    skillOpenings?: StatsApiSkillOpening[];
    skillPriorities?: StatsApiSkillPriority[];
  }

  interface StatsApiChampionDetailsData {
    champion?: StatsApiChampionSummary | null;
    keystones?: StatsApiKeystoneDetails[];
  }

  interface DataDragonRunePerk {
    icon?: string;
    id?: number;
    key?: string;
    longDesc?: string;
    name?: string;
    shortDesc?: string;
  }

  interface DataDragonRuneStyle {
    icon?: string;
    id?: number;
    key?: string;
    name?: string;
    slots?: Array<{
      runes?: DataDragonRunePerk[];
    }>;
  }

  interface StatsApiRuneAssetEntry {
    iconPath?: string;
    id: number;
    name?: string;
    slots?: StatsApiRuneAssetEntry[][];
    styleId?: number;
  }

  interface StatsApiRuneAssetCatalog {
    perks?: Record<string, StatsApiRuneAssetEntry>;
    styles?: Record<string, StatsApiRuneAssetEntry>;
  }

  function normalizeStatsApiPosition(value: unknown): string {
    return String(value || '').trim().toUpperCase();
  }

  function normalizeStatsApiTier(value: unknown): string {
    return String(value || '').trim().toUpperCase();
  }

  function normalizeChampionId(value: unknown): number {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 0;
  }

  function normalizeStatsApiSearchText(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  function getStatsApiOpponentChampionOptions(championsById: Record<string | number, any> | null | undefined): StatsApiOpponentChampionOption[] {
    return Object.values(championsById || {})
      .map((champion: any) => {
        const championId = normalizeChampionId(champion?.id);
        const name = String(champion?.name || '').trim();
        const alias = String(champion?.alias || '').trim();
        const title = String(champion?.title || '').trim();
        if (!championId || !name) return null;
        return {
          alias,
          championId,
          name,
          searchText: normalizeStatsApiSearchText([name, alias, title].filter(Boolean).join(' ')),
          title
        };
      })
      .filter((champion): champion is StatsApiOpponentChampionOption => Boolean(champion))
      .sort((a, b) => (
        a.name.localeCompare(b.name, 'ja') ||
        a.alias.localeCompare(b.alias, 'en') ||
        a.championId - b.championId
      ));
  }

  function filterStatsApiOpponentChampionOptions(
    options: StatsApiOpponentChampionOption[],
    query: unknown
  ): StatsApiOpponentChampionOption[] {
    const normalizedQuery = normalizeStatsApiSearchText(query);
    if (!normalizedQuery) return options;
    return options.filter((option) => option.searchText.includes(normalizedQuery));
  }

  function getStatsApiShardRowIndex(shardId: unknown): number {
    const numericShardId = normalizeChampionId(shardId);
    return STATS_API_SHARD_ROWS.findIndex((rowShardIds) => rowShardIds.some((candidateId) => candidateId === numericShardId));
  }

  function getStatsApiShardRowIndexes(shardId: unknown): number[] {
    const numericShardId = normalizeChampionId(shardId);
    return STATS_API_SHARD_ROWS.flatMap((rowShardIds, rowIndex) => (
      rowShardIds.some((candidateId) => candidateId === numericShardId) ? [rowIndex] : []
    ));
  }

  function resolveStatsApiSelectedShardsByRow(shardIds: number[]): number[] {
    const selectedByRow = Array<number>(STATS_API_SHARD_ROWS.length).fill(0);
    const pending = shardIds
      .map((id) => ({
        id,
        rowIndexes: getStatsApiShardRowIndexes(id)
      }))
      .filter((entry) => entry.rowIndexes.length > 0);

    let changed = true;
    while (pending.length && changed) {
      changed = false;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const entry = pending[index];
        const availableRows = entry.rowIndexes.filter((rowIndex) => !selectedByRow[rowIndex]);
        if (availableRows.length === 1) {
          selectedByRow[availableRows[0]] = entry.id;
          pending.splice(index, 1);
          changed = true;
        }
      }
    }

    pending.forEach((entry) => {
      const rowIndex = entry.rowIndexes.find((candidateRow) => !selectedByRow[candidateRow]);
      if (rowIndex !== undefined) {
        selectedByRow[rowIndex] = entry.id;
      }
    });
    return selectedByRow;
  }

  function normalizeStatsApiSelectedShardIds(
    statShards: Array<{ shardIds?: number[] | unknown[] }> | undefined,
    preferredIndex = 0
  ): number[] {
    const shardEntries = (Array.isArray(statShards) ? statShards : [])
      .map((entry) => Array.isArray(entry?.shardIds)
        ? entry.shardIds.map((id) => normalizeChampionId(id)).filter(Boolean)
        : [])
      .filter((ids) => ids.length > 0);

    const preferredIds = shardEntries[preferredIndex] || shardEntries[0] || [];
    const preferredRows = preferredIds.map((id) => getStatsApiShardRowIndex(id));
    if (
      preferredIds.length === STATS_API_SHARD_ROWS.length &&
      preferredRows.every((rowIndex) => rowIndex >= 0)
    ) {
      const resolvedPreferredIds = resolveStatsApiSelectedShardsByRow(preferredIds);
      if (resolvedPreferredIds.every(Boolean)) {
        return resolvedPreferredIds;
      }
    }

    const selectedByRow = Array<number>(STATS_API_SHARD_ROWS.length).fill(0);
    shardEntries.forEach((ids) => {
      const resolvedIds = resolveStatsApiSelectedShardsByRow(ids);
      resolvedIds.forEach((id, rowIndex) => {
        if (id && !selectedByRow[rowIndex]) {
          selectedByRow[rowIndex] = id;
        }
      });
    });
    return selectedByRow;
  }

  function getStatsApiLaneLabel(position: unknown): string {
    const normalized = normalizeStatsApiPosition(position);
    if (!normalized) return '-';
    return STATS_API_LANES.find((lane) => lane.id === normalized)?.label || normalized || '-';
  }

  function getAvailableStatsApiLanes(positions: unknown): readonly StatsApiLaneOption[] {
    const availablePositions = Array.isArray(positions)
      ? positions
        .map((position) => normalizeStatsApiPosition(position))
        .filter(Boolean)
      : [];
    if (availablePositions.length === 0) {
      return STATS_API_LANES;
    }

    const availablePositionSet = new Set(availablePositions);
    return STATS_API_LANES.filter((lane) => availablePositionSet.has(lane.id));
  }

  function sortStatsApiChampionRows(
    statsList: StatsApiChampionStats[],
    sortKey: StatsApiSortKey,
    sortDirection: UiSortDirection = 'desc',
    championLabel: (championId: number) => string = (championId) => `Champion ${championId}`
  ): StatsApiChampionStats[] {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...statsList].sort((a, b) => {
      let primary = 0;
      if (sortKey === 'champion') {
        primary = championLabel(a.championId).localeCompare(championLabel(b.championId), 'en');
      } else if (sortKey === 'lane') {
        primary = getStatsApiLaneLabel(a.mostPlayedLane).localeCompare(getStatsApiLaneLabel(b.mostPlayedLane), 'en');
      } else {
        primary = Number(a[sortKey] || 0) - Number(b[sortKey] || 0);
      }
      if (primary !== 0) return primary * direction;

      const tierScoreFallback = Number(b.tierScore || 0) - Number(a.tierScore || 0);
      if (tierScoreFallback !== 0 && sortKey !== 'tierScore') return tierScoreFallback;

      const winRateFallback = Number(b.winRate || 0) - Number(a.winRate || 0);
      if (winRateFallback !== 0 && sortKey !== 'winRate') return winRateFallback;

      const gamesFallback = Number(b.games || 0) - Number(a.games || 0);
      if (gamesFallback !== 0 && sortKey !== 'games') return gamesFallback;

      const laneFallback = getStatsApiLaneLabel(a.mostPlayedLane).localeCompare(getStatsApiLaneLabel(b.mostPlayedLane), 'en');
      if (laneFallback !== 0 && sortKey !== 'lane') return laneFallback;

      return championLabel(a.championId).localeCompare(championLabel(b.championId), 'en');
    });
  }

  function buildStatsApiChampionsUrl(filters: StatsApiFilters, baseUrl = STATS_API_BASE_URL): string {
    const position = normalizeStatsApiPosition(filters.position);
    if (!position) {
      throw new Error('StatsAPI position is required.');
    }

    const url = new URL(`/v1/stats/positions/${encodeURIComponent(position)}/champions`, baseUrl);
    if (filters.patch) {
      url.searchParams.set('patch', filters.patch);
    }
    if (filters.ranks && filters.ranks.length > 0) {
      url.searchParams.set('ranks', filters.ranks.join(','));
    }
    url.searchParams.set('minPickRate', String(STATS_API_MIN_PICK_RATE));
    url.searchParams.set('limit', '200');
    url.searchParams.set('sort', 'tierScore:desc');
    return url.toString();
  }

  function buildStatsApiChampionDetailsUrl(filters: StatsApiChampionDetailsFilters, baseUrl = STATS_API_BASE_URL): string {
    const position = normalizeStatsApiPosition(filters.position);
    const championId = normalizeChampionId(filters.championId);
    if (!position) {
      throw new Error('StatsAPI position is required.');
    }
    if (!championId) {
      throw new Error('StatsAPI championId is required.');
    }

    const url = new URL(
      `/v1/stats/positions/${encodeURIComponent(position)}/champions/${championId}/details`,
      baseUrl
    );
    if (filters.patch) {
      url.searchParams.set('patch', filters.patch);
    }
    if (filters.ranks && filters.ranks.length > 0) {
      url.searchParams.set('ranks', filters.ranks.join(','));
    }
    const opponentChampionId = normalizeChampionId(filters.opponentChampionId);
    if (opponentChampionId) {
      url.searchParams.set('opponentChampionId', String(opponentChampionId));
    }
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

  function buildStatsApiRuneIconUrl(iconPath: unknown): string {
    const normalizedPath = String(iconPath || '').replace(/^\/+/, '');
    if (!normalizedPath) return '';
    return `https://ddragon.leagueoflegends.com/cdn/img/${normalizedPath}`;
  }

  function buildStatsApiRunesDataUrl(patch: unknown, locale = 'ja_JP'): string {
    const normalizedPatch = String(patch || '').trim();
    const version = /^\d+\.\d+\.\d+$/.test(normalizedPatch)
      ? normalizedPatch
      : /^\d+\.\d+$/.test(normalizedPatch)
        ? `${normalizedPatch}.1`
        : normalizedPatch;
    if (!version) {
      throw new Error('Data Dragon rune version is required.');
    }
    return `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/runesReforged.json`;
  }

  function normalizeStatsApiRuneCatalog(data: unknown): StatsApiRuneAssetCatalog {
    const catalog: StatsApiRuneAssetCatalog = {
      perks: {},
      styles: {}
    };
    const styles = Array.isArray(data) ? data as DataDragonRuneStyle[] : [];
    styles.forEach((style) => {
      const styleId = normalizeChampionId(style?.id);
      if (!styleId) return;
      const normalizedSlots: StatsApiRuneAssetEntry[][] = [];
      catalog.styles![String(styleId)] = {
        iconPath: String(style?.icon || ''),
        id: styleId,
        name: String(style?.name || ''),
        slots: normalizedSlots,
        styleId
      };
      const slots = Array.isArray(style?.slots) ? style.slots : [];
      slots.forEach((slot) => {
        const runes = Array.isArray(slot?.runes) ? slot.runes : [];
        const normalizedRunes: StatsApiRuneAssetEntry[] = [];
        runes.forEach((rune) => {
          const runeId = normalizeChampionId(rune?.id);
          if (!runeId) return;
          const normalizedRune = {
            iconPath: String(rune?.icon || ''),
            id: runeId,
            name: String(rune?.name || ''),
            styleId
          };
          catalog.perks![String(runeId)] = normalizedRune;
          normalizedRunes.push(normalizedRune);
        });
        if (normalizedRunes.length) {
          normalizedSlots.push(normalizedRunes);
        }
      });
    });
    return catalog;
  }

  function createChampionsView(deps: ChampionsViewDeps) {
    const elements = deps.elements;
    const doc = (deps.document || root.document) as Document;
    const requestStatsApiJson = deps.requestStatsApiJson || root.lcuApi?.requestStatsApiJson;
    const fetchImpl = deps.fetch || root.fetch?.bind(root);
    const detailsView = doc.querySelector<HTMLElement>('#statsApiDetailsView');
    const detailsBackButton = doc.querySelector<HTMLButtonElement>('#statsApiDetailsBackButton');
    const detailsTitle = doc.querySelector<HTMLElement>('#statsApiDetailsTitle');
    const detailsStatus = doc.querySelector<HTMLElement>('#statsApiDetailsStatus');
    const detailsContent = doc.querySelector<HTMLElement>('#statsApiDetailsContent');
    const listView = doc.querySelector<HTMLElement>('#statsApiChampionsListView');
    let statsApiMeta: StatsApiMetaData | null = null;
    let statsApiSelectedPatch = '';
    let statsApiSelectedPosition = '';
    let statsApiSelectedRanks = new Set<string>();
    let statsApiRequestId = 0;
    let statsApiDetailsRequestId = 0;
    let statsApiRankDropdownInitialized = false;
    let statsApiRetryTimer: UiTimerHandle | null = null;
    let statsApiSortButtonsInitialized = false;
    let statsApiSortKey: StatsApiSortKey = 'tierScore';
    let statsApiSortDirection: UiSortDirection = 'desc';
    let statsApiRankSelectionDirty = false;
    let selectedChampionId = 0;
    let selectedChampionStats: StatsApiChampionStats | null = null;
    let selectedOpponentChampionId = 0;
    let selectedKeystoneId = 0;
    let lastDetailsData: StatsApiChampionDetailsData | null = null;
    let statsApiRuneCatalog: StatsApiRuneAssetCatalog | null = null;
    let statsApiRuneCatalogUrl = '';
    let statsApiRuneCatalogPromise: Promise<StatsApiRuneAssetCatalog | null> | null = null;
    const statsApiFiltersBar = doc.querySelector<HTMLElement>('.stats-api-filters');
    let statsApiOpponentDropdownButton: HTMLButtonElement | null = null;
    let statsApiOpponentDropdownField: HTMLElement | null = null;
    let statsApiOpponentDropdownLabel: HTMLElement | null = null;
    let statsApiOpponentDropdownPanel: HTMLElement | null = null;
    let statsApiOpponentSearchInput: HTMLInputElement | null = null;
    let statsApiOpponentOptionsList: HTMLElement | null = null;

    function formatStatsApiRate(value: unknown): string {
      return `${(Number(value || 0) * 100).toFixed(1)}%`;
    }

    function formatStatsApiGames(value: unknown): string {
      return Number(value || 0).toLocaleString('ja-JP');
    }

    function setStatsApiStatus(message: string): void {
      if (elements.statsApiStatus) {
        elements.statsApiStatus.textContent = message;
      }
    }

    function setStatsApiDetailsStatus(message: string): void {
      if (detailsStatus) {
        detailsStatus.textContent = message;
        detailsStatus.hidden = !message;
      }
    }

    function setStatsApiLoading(isLoading: boolean): void {
      if (elements.statsApiRefreshButton) {
        elements.statsApiRefreshButton.disabled = isLoading;
        elements.statsApiRefreshButton.textContent = isLoading ? '取得中' : '更新';
      }
    }

    function setStatsApiDetailsVisible(isVisible: boolean): void {
      if (detailsView) detailsView.hidden = !isVisible;
      if (listView) listView.hidden = isVisible;
      if (detailsBackButton) detailsBackButton.hidden = !isVisible;
      if (statsApiOpponentDropdownField) {
        statsApiOpponentDropdownField.hidden = !isVisible;
      }
      if (!isVisible) {
        setStatsApiOpponentDropdownOpen(false);
      }
    }

    function clearStatsApiRetryTimer(): void {
      if (!statsApiRetryTimer) return;
      (deps.clearTimeout || root.clearTimeout || clearTimeout)(statsApiRetryTimer);
      statsApiRetryTimer = null;
    }

    function getStatsApiDataDragonVersion(patch: string): string {
      if (/^\d+\.\d+\.\d+$/.test(patch)) return patch;
      if (/^\d+\.\d+$/.test(patch)) return `${patch}.1`;
      return 'latest';
    }

    async function ensureStatsApiRuneCatalog(): Promise<StatsApiRuneAssetCatalog | null> {
      const patch = getStatsApiSelectedFilters().patch || statsApiMeta?.latestPatch || '';
      const runesDataUrl = buildStatsApiRunesDataUrl(getStatsApiDataDragonVersion(String(patch)));
      if (statsApiRuneCatalog && statsApiRuneCatalogUrl === runesDataUrl) {
        return statsApiRuneCatalog;
      }
      if (statsApiRuneCatalogPromise && statsApiRuneCatalogUrl === runesDataUrl) {
        return statsApiRuneCatalogPromise;
      }
      if (!fetchImpl) {
        return null;
      }

      statsApiRuneCatalogUrl = runesDataUrl;
      statsApiRuneCatalogPromise = fetchImpl(runesDataUrl)
        .then((response: Response) => {
          if (!response.ok) {
            throw new Error(`Failed to load rune asset catalog: ${response.status}`);
          }
          return response.json();
        })
        .then((catalog: unknown) => {
          statsApiRuneCatalog = normalizeStatsApiRuneCatalog(catalog);
          return statsApiRuneCatalog;
        })
        .catch(() => {
          statsApiRuneCatalog = null;
          return null;
        })
        .finally(() => {
          statsApiRuneCatalogPromise = null;
        });
      return statsApiRuneCatalogPromise;
    }

    function getItemIconUrl(itemId: unknown): string {
      const numericItemId = normalizeChampionId(itemId);
      if (!numericItemId) return '';
      const patch = getStatsApiSelectedFilters().patch || statsApiMeta?.latestPatch || 'latest';
      const version = getStatsApiDataDragonVersion(String(patch));
      return version === 'latest'
        ? `https://ddragon.leagueoflegends.com/cdn/img/item/${numericItemId}.png`
        : `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${numericItemId}.png`;
    }

    function getRuneAssetEntry(type: 'perks' | 'styles', runeId: unknown): StatsApiRuneAssetEntry | null {
      const numericRuneId = normalizeChampionId(runeId);
      if (!numericRuneId || !statsApiRuneCatalog?.[type]) return null;
      return statsApiRuneCatalog[type]?.[String(numericRuneId)] || null;
    }

    function getRuneIconUrl(runeId: unknown): string {
      return buildStatsApiRuneIconUrl(getRuneAssetEntry('perks', runeId)?.iconPath);
    }

    function getRuneStyleIconUrl(styleId: unknown): string {
      return buildStatsApiRuneIconUrl(getRuneAssetEntry('styles', styleId)?.iconPath);
    }

    function getKeystoneLabel(keystoneId: unknown): string {
      const numericKeystoneId = normalizeChampionId(keystoneId);
      const assetName = getRuneAssetEntry('perks', numericKeystoneId)?.name;
      return assetName || KEYSTONE_LABELS[numericKeystoneId] || `Keystone ${numericKeystoneId || '-'}`;
    }

    function getRuneStyleLabel(styleId: unknown): string {
      const numericStyleId = normalizeChampionId(styleId);
      const assetName = getRuneAssetEntry('styles', numericStyleId)?.name;
      return assetName || RUNE_STYLE_LABELS[numericStyleId] || `Style ${numericStyleId || '-'}`;
    }

    function getRuneLabel(runeId: unknown): string {
      const numericRuneId = normalizeChampionId(runeId);
      const assetName = getRuneAssetEntry('perks', numericRuneId)?.name;
      return assetName || `#${numericRuneId || '-'}`;
    }

    function getShardIconUrl(shardId: unknown): string {
      const numericShardId = normalizeChampionId(shardId);
      return buildStatsApiRuneIconUrl(SHARD_ICON_PATHS[numericShardId]);
    }

    function getShardLabel(shardId: unknown): string {
      const numericShardId = normalizeChampionId(shardId);
      return SHARD_LABELS[numericShardId] || `Shard ${numericShardId || '-'}`;
    }

    function getSummonerSpellLabel(spellId: unknown): string {
      const numericSpellId = normalizeChampionId(spellId);
      return SUMMONER_SPELL_LABELS[numericSpellId] || `Spell ${numericSpellId || '-'}`;
    }

    function getSummonerSpellIconUrl(spellId: unknown): string {
      const numericSpellId = normalizeChampionId(spellId);
      const iconKey = SUMMONER_SPELL_ICON_KEYS[numericSpellId];
      if (!iconKey) return '';
      const patch = getStatsApiSelectedFilters().patch || statsApiMeta?.latestPatch || 'latest';
      const version = getStatsApiDataDragonVersion(String(patch));
      return version === 'latest'
        ? `https://ddragon.leagueoflegends.com/cdn/img/spell/${iconKey}.png`
        : `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${iconKey}.png`;
    }

    function formatSkillLetter(skillId: unknown): string {
      const normalizedSkillId = String(skillId || '').trim();
      if (normalizedSkillId === '1') return 'Q';
      if (normalizedSkillId === '2') return 'W';
      if (normalizedSkillId === '3') return 'E';
      if (normalizedSkillId === '4') return 'R';
      return '-';
    }

    function createText(className: string, text: string, tagName = 'span'): HTMLElement {
      const element = doc.createElement(tagName);
      element.className = className;
      element.textContent = text;
      return element;
    }

    function getSelectedOpponentChampionOption(): StatsApiOpponentChampionOption | null {
      return getStatsApiOpponentChampionOptions(deps.getChampionsById?.())
        .find((option) => option.championId === selectedOpponentChampionId) || null;
    }

    function getStatsApiOpponentSummaryLabel(): string {
      const selectedOption = getSelectedOpponentChampionOption();
      return selectedOption ? selectedOption.name : '指定なし';
    }

    function updateStatsApiOpponentDropdownLabel(): void {
      if (!statsApiOpponentDropdownLabel) return;
      statsApiOpponentDropdownLabel.textContent = getStatsApiOpponentSummaryLabel();
    }

    function setStatsApiOpponentDropdownOpen(isOpen: boolean): void {
      if (!statsApiOpponentDropdownButton || !statsApiOpponentDropdownPanel) return;
      statsApiOpponentDropdownButton.setAttribute('aria-expanded', String(isOpen));
      statsApiOpponentDropdownPanel.hidden = !isOpen;
      if (isOpen) {
        if (statsApiOpponentSearchInput) {
          statsApiOpponentSearchInput.value = '';
        }
        renderStatsApiOpponentOptions('');
        statsApiOpponentSearchInput?.focus();
      }
    }

    function renderStatsApiOpponentOptions(query = ''): void {
      if (!statsApiOpponentOptionsList) return;
      const options = filterStatsApiOpponentChampionOptions(
        getStatsApiOpponentChampionOptions(deps.getChampionsById?.()),
        query
      );
      const nodes: HTMLElement[] = [];
      const clearButton = doc.createElement('button');
      clearButton.type = 'button';
      clearButton.className = `stats-api-opponent-option${selectedOpponentChampionId === 0 ? ' active' : ''}`;
      clearButton.setAttribute('aria-pressed', String(selectedOpponentChampionId === 0));
      clearButton.append(createText('stats-api-opponent-option-name', '指定なし'));
      clearButton.addEventListener('click', async () => {
        const changed = selectedOpponentChampionId !== 0;
        selectedOpponentChampionId = 0;
        updateStatsApiOpponentDropdownLabel();
        setStatsApiOpponentDropdownOpen(false);
        if (changed && selectedChampionId > 0 && !detailsView?.hidden) {
          await refreshSelectedChampionDetails();
        }
      });
      nodes.push(clearButton);

      options.forEach((option) => {
        const button = doc.createElement('button');
        button.type = 'button';
        const isActive = option.championId === selectedOpponentChampionId;
        button.className = `stats-api-opponent-option${isActive ? ' active' : ''}`;
        button.setAttribute('aria-pressed', String(isActive));
        button.append(
          deps.createInlineChampionName(option.championId, 'inline-champion-name stats-api-opponent-option-name')
        );
        button.addEventListener('click', async () => {
          const changed = selectedOpponentChampionId !== option.championId;
          selectedOpponentChampionId = option.championId;
          updateStatsApiOpponentDropdownLabel();
          setStatsApiOpponentDropdownOpen(false);
          if (changed && selectedChampionId > 0 && !detailsView?.hidden) {
            await refreshSelectedChampionDetails();
          }
        });
        nodes.push(button);
      });

      if (nodes.length === 1) {
        const empty = createText('stats-api-opponent-empty', '条件に合うチャンピオンがありません。', 'p');
        statsApiOpponentOptionsList.replaceChildren(clearButton, empty);
        return;
      }

      statsApiOpponentOptionsList.replaceChildren(...nodes);
    }

    function ensureStatsApiOpponentFilter(): void {
      if (statsApiOpponentDropdownField || !statsApiFiltersBar) return;

      statsApiOpponentDropdownField = doc.createElement('div');
      statsApiOpponentDropdownField.className = 'stats-api-field stats-api-opponent-filter';
      statsApiOpponentDropdownField.hidden = true;
      statsApiOpponentDropdownField.append(createText('stats-api-opponent-label', '対面チャンピオン'));

      const dropdown = doc.createElement('div');
      dropdown.className = 'stats-api-opponent-dropdown';

      statsApiOpponentDropdownButton = doc.createElement('button');
      statsApiOpponentDropdownButton.type = 'button';
      statsApiOpponentDropdownButton.className = 'stats-api-opponent-dropdown-button';
      statsApiOpponentDropdownButton.setAttribute('aria-expanded', 'false');
      statsApiOpponentDropdownLabel = createText('stats-api-opponent-dropdown-label', '指定なし');
      statsApiOpponentDropdownButton.append(statsApiOpponentDropdownLabel);
      statsApiOpponentDropdownButton.addEventListener('click', () => {
        const isOpen = statsApiOpponentDropdownButton?.getAttribute('aria-expanded') === 'true';
        setStatsApiOpponentDropdownOpen(!isOpen);
      });

      statsApiOpponentDropdownPanel = doc.createElement('div');
      statsApiOpponentDropdownPanel.className = 'stats-api-opponent-dropdown-panel';
      statsApiOpponentDropdownPanel.hidden = true;

      statsApiOpponentSearchInput = doc.createElement('input');
      statsApiOpponentSearchInput.type = 'search';
      statsApiOpponentSearchInput.className = 'stats-api-opponent-search-input';
      statsApiOpponentSearchInput.placeholder = '検索';
      statsApiOpponentSearchInput.setAttribute('aria-label', '対面チャンピオンを検索');
      statsApiOpponentSearchInput.addEventListener('input', () => {
        renderStatsApiOpponentOptions(statsApiOpponentSearchInput?.value || '');
      });
      statsApiOpponentSearchInput.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setStatsApiOpponentDropdownOpen(false);
        statsApiOpponentDropdownButton?.focus();
      });

      statsApiOpponentOptionsList = doc.createElement('div');
      statsApiOpponentOptionsList.className = 'stats-api-opponent-options';

      statsApiOpponentDropdownPanel.append(statsApiOpponentSearchInput, statsApiOpponentOptionsList);
      dropdown.append(statsApiOpponentDropdownButton, statsApiOpponentDropdownPanel);
      statsApiOpponentDropdownField.append(dropdown);
      statsApiFiltersBar.insertBefore(
        statsApiOpponentDropdownField,
        doc.querySelector('#statsApiDetailsBackButton')
      );

      doc.addEventListener('click', (event: MouseEvent) => {
        if (!statsApiOpponentDropdownField) return;
        const target = event.target as Node | null;
        if (target && statsApiOpponentDropdownField.contains(target)) return;
        setStatsApiOpponentDropdownOpen(false);
      });

      updateStatsApiOpponentDropdownLabel();
      renderStatsApiOpponentOptions('');
    }

    function createStatsApiSummaryChip(
      label: string,
      value: string,
      accent: boolean | 'negative' = false
    ): HTMLElement {
      const chip = doc.createElement('div');
      const accentClass = accent === 'negative'
        ? ' accent negative'
        : accent
          ? ' accent'
          : '';
      chip.className = `stats-api-summary-chip${accentClass}`;
      chip.append(
        createText('stats-api-summary-chip-label', label, 'small'),
        createText('stats-api-summary-chip-value', value, 'strong')
      );
      return chip;
    }

    function getStatsApiWinRateAccent(winRate: number | null | undefined): boolean | 'negative' {
      return Number(winRate || 0) < 0.5 ? 'negative' : true;
    }

    function createStatsApiSkillOpeningRow(entry: StatsApiSkillOpening): HTMLElement {
      const row = doc.createElement('div');
      row.className = 'stats-api-skill-order-row';
      row.append(
        createStatsApiSkillTagList(entry.skillOrder.map((skillId, level) => ({
          prefix: `Lv${level + 1} `,
          skillLetter: formatSkillLetter(skillId)
        })), 'stats-api-skill-order'),
        createStatsApiOptionMeta(entry)
      );
      return row;
    }

    function createStatsApiSkillPriorityRow(entry: StatsApiSkillPriority): HTMLElement {
      const row = doc.createElement('div');
      row.className = 'stats-api-skill-order-row';
      row.append(
        createStatsApiSkillTagList([
          { prefix: '1st ', skillLetter: formatSkillLetter(entry.firstMaxSkill) },
          { prefix: '2nd ', skillLetter: formatSkillLetter(entry.secondMaxSkill) },
          { prefix: '3rd ', skillLetter: formatSkillLetter(entry.thirdMaxSkill) }
        ], 'stats-api-skill-priority'),
        createStatsApiOptionMeta(entry)
      );
      return row;
    }

    function createStatsApiSkillSection(title: string, rows: HTMLElement[]): HTMLElement {
      const wrap = doc.createElement('section');
      wrap.className = 'stats-api-detail-subsection stats-api-skill-section';
      wrap.append(createText('stats-api-detail-subtitle', title, 'h4'));
      if (rows.length) {
        wrap.append(...rows);
      } else {
        wrap.append(createStatsApiEmptyState(`${title}候補がありません。`));
      }
      return wrap;
    }

    function createStatsApiOptionMeta(
      entry: StatsApiOptionStat,
      options: { hidePickRate?: boolean } = {}
    ): HTMLElement {
      const meta = doc.createElement('div');
      meta.className = 'stats-api-option-meta';
      if (!options.hidePickRate) {
        meta.append(createStatsApiSummaryChip('PR', formatStatsApiRate(entry.pickRate)));
      }
      meta.append(
        createStatsApiSummaryChip('WR', formatStatsApiRate(entry.winRate), getStatsApiWinRateAccent(entry.winRate)),
        createStatsApiSummaryChip('Games', formatStatsApiGames(entry.games))
      );
      return meta;
    }

    function createStatsApiRuneSetMeta(entry: StatsApiOptionStat): HTMLElement {
      const meta = doc.createElement('div');
      meta.className = 'stats-api-option-meta stats-api-rune-set-meta';
      meta.append(
        createStatsApiSummaryChip('WR', formatStatsApiRate(entry.winRate), getStatsApiWinRateAccent(entry.winRate)),
        createStatsApiSummaryChip('Games', formatStatsApiGames(entry.games))
      );
      return meta;
    }

    function createStatsApiTagList(items: string[], className = 'stats-api-tag-list'): HTMLElement {
      const container = doc.createElement('div');
      container.className = className;
      container.append(...items.map((item) => createText('stats-api-tag', item)));
      return container;
    }

    function createStatsApiSkillTagList(
      items: Array<{ prefix: string; skillLetter: string }>,
      className: string
    ): HTMLElement {
      const container = doc.createElement('div');
      container.className = className;
      container.append(...items.map(({ prefix, skillLetter }) => {
        const tag = doc.createElement('span');
        tag.className = 'stats-api-tag stats-api-skill-tag';
        tag.append(
          doc.createTextNode(prefix),
          createText(`stats-api-skill-letter skill-${String(skillLetter || '').toLowerCase()}`, skillLetter)
        );
        return tag;
      }));
      return container;
    }

    function createStatsApiRuneToken(label: string, iconUrl = '', className = 'stats-api-rune-token'): HTMLElement {
      const token = doc.createElement('span');
      token.className = className;
      if (iconUrl) {
        const image = doc.createElement('img');
        image.alt = '';
        image.className = 'stats-api-rune-icon';
        image.loading = 'lazy';
        image.src = iconUrl;
        token.append(image);
      }
      token.append(createText('stats-api-rune-token-label', label));
      return token;
    }

    function createStatsApiSummonerSpellToken(spellId: unknown): HTMLElement {
      return createStatsApiRuneToken(
        getSummonerSpellLabel(spellId),
        getSummonerSpellIconUrl(spellId),
        'stats-api-rune-token stats-api-summoner-spell-token'
      );
    }

    function createStatsApiRuneList(
      runeIds: unknown[],
      resolver: (runeId: unknown) => string,
      labelResolver: (runeId: unknown) => string,
      className = 'stats-api-tag-list'
    ): HTMLElement {
      const container = doc.createElement('div');
      container.className = className;
      container.append(...runeIds.map((runeId) => createStatsApiRuneToken(labelResolver(runeId), resolver(runeId))));
      return container;
    }

    function createStatsApiRuneStyleRow(styleId: unknown, runeIds: unknown[]): HTMLElement {
      const row = doc.createElement('div');
      row.className = 'stats-api-rune-style-row';
      row.append(
        createStatsApiRuneToken(getRuneStyleLabel(styleId), getRuneStyleIconUrl(styleId), 'stats-api-rune-token style'),
        createStatsApiRuneList(
          runeIds,
          (runeId) => getRuneIconUrl(runeId),
          (runeId) => getRuneLabel(runeId)
        )
      );
      return row;
    }

    function createStatsApiRuneStyleBadge(styleId: unknown): HTMLElement {
      return createStatsApiRuneToken(
        getRuneStyleLabel(styleId),
        getRuneStyleIconUrl(styleId),
        'stats-api-rune-token style stats-api-rune-style-badge'
      );
    }

    function createStatsApiRuneNode(
      runeEntry: StatsApiRuneAssetEntry,
      isSelected: boolean,
      options: { keystone?: boolean; secondary?: boolean } = {}
    ): HTMLElement {
      const node = doc.createElement('div');
      node.className = [
        'stats-api-rune-node',
        isSelected ? 'selected' : 'muted',
        options.keystone ? 'keystone' : '',
        options.secondary ? 'secondary' : ''
      ].filter(Boolean).join(' ');

      const image = doc.createElement('img');
      image.alt = runeEntry.name || `Rune ${runeEntry.id}`;
      image.className = 'stats-api-rune-node-icon';
      image.loading = 'lazy';
      image.src = buildStatsApiRuneIconUrl(runeEntry.iconPath);
      node.append(image);
      return node;
    }

    function createStatsApiShardNode(shardId: unknown, isSelected: boolean): HTMLElement {
      const node = doc.createElement('div');
      node.className = `stats-api-shard-node${isSelected ? ' selected' : ''}`;
      node.title = getShardLabel(shardId);
      node.setAttribute('aria-label', getShardLabel(shardId));
      const iconUrl = getShardIconUrl(shardId);
      if (iconUrl) {
        const image = doc.createElement('img');
        image.alt = '';
        image.className = 'stats-api-shard-node-icon';
        image.loading = 'lazy';
        image.src = iconUrl;
        node.append(image);
      } else {
        node.append(createText('stats-api-shard-node-label', getShardLabel(shardId)));
      }
      return node;
    }

    function createStatsApiShardTree(selectedShardIds: unknown[]): HTMLElement {
      const wrap = doc.createElement('div');
      wrap.className = 'stats-api-shard-tree';
      const normalizedSelectedIds = (Array.isArray(selectedShardIds) ? selectedShardIds : [])
        .map((id) => normalizeChampionId(id))
        .filter(Boolean);
      STATS_API_SHARD_ROWS.forEach((rowShardIds, rowIndex) => {
        const row = doc.createElement('div');
        row.className = 'stats-api-shard-row';
        const selectedShardId = normalizedSelectedIds[rowIndex] || 0;
        row.append(...rowShardIds.map((shardId) => createStatsApiShardNode(shardId, selectedShardId === shardId)));
        wrap.append(row);
      });
      return wrap;
    }

    function createStatsApiRuneStyleTree(
      styleId: unknown,
      selectedRuneIds: unknown[],
      options: { omitKeystone?: boolean; secondary?: boolean } = {}
    ): HTMLElement {
      const numericStyleId = normalizeChampionId(styleId);
      const styleEntry = getRuneAssetEntry('styles', numericStyleId);
      const selectedIds = new Set((Array.isArray(selectedRuneIds) ? selectedRuneIds : []).map((id) => normalizeChampionId(id)).filter(Boolean));
      const tree = doc.createElement('section');
      tree.className = `stats-api-rune-tree${options.secondary ? ' secondary' : ' primary'}`;
      tree.append(createStatsApiRuneStyleBadge(numericStyleId));

      const slotsWrap = doc.createElement('div');
      slotsWrap.className = 'stats-api-rune-tree-slots';
      const slots = Array.isArray(styleEntry?.slots) ? styleEntry.slots : [];
      slots.forEach((slotRunes, slotIndex) => {
        if (options.omitKeystone && slotIndex === 0) {
          return;
        }
        const row = doc.createElement('div');
        row.className = 'stats-api-rune-tree-row';
        row.append(...slotRunes.map((runeEntry) => createStatsApiRuneNode(
          runeEntry,
          selectedIds.has(runeEntry.id),
          {
            keystone: slotIndex === 0,
            secondary: options.secondary
          }
        )));
        slotsWrap.append(row);
      });
      if (!slots.length && selectedIds.size) {
        const fallbackRow = doc.createElement('div');
        fallbackRow.className = 'stats-api-rune-tree-row';
        fallbackRow.append(...[...selectedIds].map((runeId) => {
          const runeEntry = getRuneAssetEntry('perks', runeId) || { id: runeId, name: getRuneLabel(runeId) };
          return createStatsApiRuneNode(runeEntry, true, { secondary: options.secondary });
        }));
        slotsWrap.append(fallbackRow);
      }

      tree.append(slotsWrap);
      return tree;
    }

    function createStatsApiRunePage(runeSet: StatsApiRuneSet, selectedShardIds: unknown[] = []): HTMLElement {
      const page = doc.createElement('div');
      page.className = 'stats-api-rune-page';

      const primaryStyle = createStatsApiRuneStyleTree(runeSet.primaryStyleId, runeSet.primaryRuneIds, { omitKeystone: true });
      primaryStyle.classList.add('stats-api-rune-page-primary');

      const side = doc.createElement('div');
      side.className = 'stats-api-rune-page-secondary-row';
      side.append(
        createStatsApiRuneStyleTree(runeSet.secondaryStyleId, runeSet.secondaryRuneIds, { omitKeystone: true, secondary: true })
      );

      const shardBlock = doc.createElement('div');
      shardBlock.className = 'stats-api-rune-page-shards';
      const shardHeader = doc.createElement('div');
      shardHeader.className = 'stats-api-rune-page-shards-header';
      shardHeader.append(createStatsApiRuneSetMeta(runeSet));
      shardBlock.append(
        shardHeader,
        createStatsApiShardTree(selectedShardIds)
      );
      side.append(shardBlock);

      page.append(primaryStyle, side);
      return page;
    }

    function createStatsApiRuneTabs(
      runes: StatsApiRuneSet[] | undefined,
      statShards: StatsApiStatShards[] | undefined
    ): HTMLElement[] {
      const runeSets = Array.isArray(runes) ? runes : [];
      if (!runeSets.length) {
        return [createStatsApiEmptyState('ルーン候補がありません。')];
      }

      const tabWrap = doc.createElement('div');
      tabWrap.className = 'stats-api-rune-tabs';
      const tabList = doc.createElement('div');
      tabList.className = 'stats-api-rune-tab-list';
      tabList.setAttribute('role', 'tablist');
      tabList.setAttribute('aria-label', 'ルーンセット候補');
      const panels = doc.createElement('div');
      panels.className = 'stats-api-rune-tab-panels';

      const buttons: HTMLButtonElement[] = [];
      const panelNodes: HTMLElement[] = [];
      const setActiveTab = (activeIndex: number): void => {
        buttons.forEach((button, index) => {
          const isActive = index === activeIndex;
          button.classList.toggle('active', isActive);
          button.setAttribute('aria-selected', String(isActive));
          button.tabIndex = isActive ? 0 : -1;
          panelNodes[index].hidden = !isActive;
        });
      };

      runeSets.forEach((runeSet, index) => {
        const tabId = `stats-api-rune-tab-${index}`;
        const panelId = `stats-api-rune-panel-${index}`;
        const selectedShardIds = normalizeStatsApiSelectedShardIds(statShards, index);

        const button = doc.createElement('button');
        button.type = 'button';
        button.className = `stats-api-rune-tab${index === 0 ? ' active' : ''}`;
        button.id = tabId;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', panelId);
        button.setAttribute('aria-selected', String(index === 0));
        button.tabIndex = index === 0 ? 0 : -1;
        button.textContent = `Set${index + 1}`;
        button.addEventListener('click', () => setActiveTab(index));
        buttons.push(button);
        tabList.append(button);

        const panel = doc.createElement('article');
        panel.id = panelId;
        panel.className = 'stats-api-detail-option';
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabId);
        panel.hidden = index !== 0;
        panel.append(createStatsApiRunePage(runeSet, selectedShardIds));
        panelNodes.push(panel);
        panels.append(panel);
      });

      tabWrap.append(tabList, panels);
      return [tabWrap];
    }

    function createStatsApiEmptyState(message: string): HTMLElement {
      return createText('stats-api-detail-empty', message, 'p');
    }

    function createStatsApiItemToken(itemId: unknown, options: { iconOnly?: boolean } = {}): HTMLElement {
      const numericItemId = normalizeChampionId(itemId);
      const token = doc.createElement('div');
      token.className = `stats-api-item-token${options.iconOnly ? ' icon-only' : ''}`;
      token.title = `Item #${numericItemId || '-'}`;
      if (numericItemId) {
        const img = doc.createElement('img');
        img.alt = `Item ${numericItemId}`;
        img.className = 'stats-api-item-icon';
        img.loading = 'lazy';
        img.src = getItemIconUrl(numericItemId);
        token.append(img);
      }
      if (!options.iconOnly) {
        token.append(createText('stats-api-item-id', `#${numericItemId || '-'}`));
      }
      return token;
    }

    function createStatsApiItemSetRow(
      title: string,
      items: unknown[],
      entry: StatsApiOptionStat,
      options: { arrow?: boolean; hideTitle?: boolean; compact?: boolean; iconOnly?: boolean; hidePickRate?: boolean } = {}
    ): HTMLElement {
      const row = doc.createElement('article');
      row.className = `stats-api-item-set-row${options.compact ? ' compact' : ''}`;
      const body = doc.createElement('div');
      body.className = 'stats-api-item-set-body';
      const itemsWrap = doc.createElement('div');
      itemsWrap.className = 'stats-api-item-token-list';
      itemsWrap.append(...items.map((itemId, index) => {
        const fragment = doc.createDocumentFragment();
        if (options.arrow && index > 0) {
          fragment.append(createText('stats-api-item-arrow', '→'));
        }
        fragment.append(createStatsApiItemToken(itemId, { iconOnly: options.iconOnly }));
        return fragment;
      }));
      if (!options.hideTitle) {
        body.append(createText('stats-api-item-set-title', title, 'h4'));
      }
      body.append(itemsWrap);
      row.append(body, createStatsApiOptionMeta(entry, { hidePickRate: options.hidePickRate }));
      return row;
    }

    function createStatsApiSingleItemRows(
      title: string,
      entries: StatsApiSingleItem[] | undefined
    ): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'stats-api-detail-subsection';
      section.append(createText('stats-api-detail-subtitle', title, 'h4'));
      if (!entries?.length) {
        section.append(createStatsApiEmptyState('候補がありません。'));
        return section;
      }
      const list = doc.createElement('div');
      list.className = 'stats-api-item-set-list';
      list.append(...entries.map((entry) => createStatsApiItemSetRow(title, [entry.itemId], entry, {
        compact: true,
        hideTitle: true,
        hidePickRate: true,
        iconOnly: true
      })));
      section.append(list);
      return section;
    }

    function createStatsApiBuildStageSection(
      title: string,
      rows: HTMLElement[],
      emptyMessage = '候補がありません。'
    ): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'stats-api-detail-subsection stats-api-build-stage';
      section.append(createText('stats-api-detail-subtitle', title, 'h4'));
      if (!rows.length) {
        section.append(createStatsApiEmptyState(emptyMessage));
        return section;
      }
      const list = doc.createElement('div');
      list.className = 'stats-api-item-set-list';
      list.append(...rows);
      section.append(list);
      return section;
    }

    function createStatsApiBuildStageRowsFromSets(
      entries: StatsApiItemSet[] | undefined,
      options: { iconOnly?: boolean } = {}
    ): HTMLElement[] {
      return (entries || [])
        .map((entry) => {
          const itemIds = Array.isArray(entry.itemIds) ? entry.itemIds : [];
          if (!itemIds.length) return null;
          return createStatsApiItemSetRow('', itemIds, entry, {
            hideTitle: true,
            hidePickRate: true,
            iconOnly: options.iconOnly
          });
        })
        .filter((row): row is HTMLElement => Boolean(row));
    }

    function createStatsApiSummonerSpellSection(
      entries: StatsApiSummonerSpells[] | undefined,
      options: { hideTitle?: boolean } = {}
    ): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'stats-api-detail-subsection stats-api-rune-summoner-section';
      section.append(createText('stats-api-detail-subtitle', 'サモナースペル', 'h4'));
      if (!entries?.length) {
        section.append(createStatsApiEmptyState('サモナースペル候補がありません。'));
        return section;
      }
      const list = doc.createElement('div');
      list.className = 'stats-api-rune-summoner-list';
      list.append(...entries.map((entry) => {
        const node = doc.createElement('article');
        node.className = 'stats-api-detail-option';
        node.append(
          (() => {
            const wrap = doc.createElement('div');
            wrap.className = 'stats-api-tag-list stats-api-summoner-spell-list';
            wrap.append(...entry.spellIds.map((id) => createStatsApiSummonerSpellToken(id)));
            return wrap;
          })(),
          createStatsApiOptionMeta(entry)
        );
        return node;
      }));
      section.append(list);
      return section;
    }

    function createStatsApiDetailCard(
      title: string,
      subtitle: string,
      bodyChildren: HTMLElement[]
    ): HTMLElement {
      const card = doc.createElement('section');
      card.className = 'stats-api-detail-card';
      const header = doc.createElement('div');
      header.className = 'stats-api-detail-card-header';
      header.append(createText('stats-api-detail-card-title', title, 'h3'));
      if (subtitle.trim()) {
        header.append(createText('stats-api-detail-card-subtitle', subtitle, 'p'));
      }
      const body = doc.createElement('div');
      body.className = 'stats-api-detail-card-body';
      body.append(...bodyChildren);
      card.append(header, body);
      return card;
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

    function initializeStatsApiSortButtons(): void {
      if (statsApiSortButtonsInitialized) return;
      statsApiSortButtonsInitialized = true;

      doc.querySelectorAll<HTMLButtonElement>('[data-stats-api-sort-key]').forEach((button) => {
        button.addEventListener('click', () => {
          const sortKey = String(button.dataset.statsApiSortKey || '') as StatsApiSortKey;
          if (!sortKey) return;
          statsApiSortDirection = statsApiSortKey === sortKey && statsApiSortDirection === 'desc' ? 'asc' : 'desc';
          statsApiSortKey = sortKey;
          refreshStatsApiChampionList();
        });
      });
    }

    function initializeStatsApiDetailsActions(): void {
      detailsBackButton?.addEventListener('click', () => {
        selectedChampionId = 0;
        selectedChampionStats = null;
        selectedKeystoneId = 0;
        lastDetailsData = null;
        setStatsApiDetailsVisible(false);
        setStatsApiDetailsStatus('');
      });
    }

    function renderStatsApiSortButtons(): void {
      doc.querySelectorAll<HTMLButtonElement>('[data-stats-api-sort-key]').forEach((button) => {
        const sortKey = String(button.dataset.statsApiSortKey || '') as StatsApiSortKey;
        const active = sortKey === statsApiSortKey;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        button.dataset.sortDirection = active ? statsApiSortDirection : '';
        button.setAttribute('aria-sort', active ? (statsApiSortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
      });
    }

    function setStatsApiRankDropdownOpen(isOpen: boolean): void {
      if (!elements.statsApiRankDropdown || !elements.statsApiRankDropdownButton) return;
      const wasOpen = !elements.statsApiRankDropdown.hidden;
      elements.statsApiRankDropdown.hidden = !isOpen;
      elements.statsApiRankDropdownButton.setAttribute('aria-expanded', String(isOpen));
      if (wasOpen && !isOpen && statsApiRankSelectionDirty) {
        statsApiRankSelectionDirty = false;
        refreshStatsApiChampionList();
      }
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
      const availableLanes = getAvailableStatsApiLanes(statsApiMeta?.positions);
      const fallbackPosition = availableLanes[0]?.id || '';
      return {
        patch: elements.statsApiPatchSelect?.value || statsApiSelectedPatch || statsApiMeta?.latestPatch || undefined,
        position: statsApiSelectedPosition || fallbackPosition || undefined,
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
      ensureStatsApiOpponentFilter();
      initializeStatsApiRankDropdown();
      initializeStatsApiSortButtons();
      initializeStatsApiDetailsActions();
      setStatsApiLoading(true);
      setStatsApiStatus('StatsAPIのメタ情報を取得しています。');
      clearStatsApiChampionRows();
      try {
        const response = await fetchStatsApiJson('/v1/stats/meta');
        statsApiMeta = response?.data || {};
        statsApiSelectedPatch = statsApiMeta?.latestPatch || statsApiMeta?.patches?.[0] || '';
        statsApiSelectedPosition = getAvailableStatsApiLanes(statsApiMeta?.positions)[0]?.id || '';
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
      renderStatsApiLaneTabs(statsApiMeta?.positions || []);
      renderStatsApiRankOptions(statsApiMeta?.ranks || []);
      renderStatsApiSortButtons();
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

    function renderStatsApiLaneTabs(positions: string[]): void {
      if (!elements.statsApiLaneTabs) return;
      const availableLanes = getAvailableStatsApiLanes(positions);
      if (!availableLanes.some((lane) => lane.id === statsApiSelectedPosition)) {
        statsApiSelectedPosition = availableLanes[0]?.id || '';
      }
      const buttons = availableLanes
        .map((lane) => {
          const button = doc.createElement('button');
          button.type = 'button';
          button.dataset.lane = lane.id;
          button.textContent = lane.label;
          button.className = `lane-tab${lane.id === statsApiSelectedPosition ? ' active' : ''}`;
          button.addEventListener('click', () => {
            if (statsApiSelectedPosition === lane.id) return;
            statsApiSelectedPosition = lane.id;
            renderStatsApiLaneTabs(positions);
            refreshStatsApiChampionList();
          });
          return button;
        });
      elements.statsApiLaneTabs.replaceChildren(...buttons);
    }

    function clearStatsApiChampionRows(): void {
      elements.statsApiChampionsTableBody?.replaceChildren();
      if (elements.statsApiChampionsEmpty) {
        elements.statsApiChampionsEmpty.hidden = false;
      }
    }

    function renderStatsApiChampionTable(statsList: StatsApiChampionStats[]): void {
      const sortedStatsList = sortStatsApiChampionRows(
        statsList,
        statsApiSortKey,
        statsApiSortDirection,
        (championId) => deps.championLabel ? deps.championLabel(championId) : `Champion ${championId}`
      );
      const rows = sortedStatsList.map((stats) => createStatsApiChampionRow(stats));
      elements.statsApiChampionsTableBody?.replaceChildren(...rows);
      if (elements.statsApiChampionsEmpty) {
        elements.statsApiChampionsEmpty.hidden = sortedStatsList.length > 0;
        elements.statsApiChampionsEmpty.textContent = '条件に合うチャンピオンがありません。';
      }
      renderStatsApiSortButtons();
    }

    function createStatsApiChampionRow(stats: StatsApiChampionStats): HTMLTableRowElement {
      const row = doc.createElement('tr');
      row.className = 'stats-table-clickable-row';
      row.dataset.championId = String(normalizeChampionId(stats.championId));
      row.tabIndex = 0;
      row.classList.toggle('expanded', normalizeChampionId(stats.championId) === selectedChampionId && !detailsView?.hidden);

      const tierCell = doc.createElement('td');
      const tier = normalizeStatsApiTier(stats.tier);
      tierCell.textContent = tier || '-';
      tierCell.className = `stats-api-tier-cell${tier ? ` tier-${tier}` : ''}`;
      if (Number.isFinite(Number(stats.tierScore))) {
        tierCell.title = `Tier Score: ${Number(stats.tierScore).toFixed(2)}`;
      }

      const championCell = doc.createElement('th');
      championCell.scope = 'row';
      championCell.append(deps.createInlineChampionName(stats.championId, 'inline-champion-name stats-table-champion'));

      const laneCell = doc.createElement('td');
      laneCell.textContent = getStatsApiLaneLabel(stats.mostPlayedLane);

      const gamesCell = doc.createElement('td');
      gamesCell.textContent = String(Number(stats.games || 0));

      const winRateCell = doc.createElement('td');
      winRateCell.textContent = formatStatsApiRate(stats.winRate);

      const pickRateCell = doc.createElement('td');
      pickRateCell.textContent = formatStatsApiRate(stats.pickRate);

      const banRateCell = doc.createElement('td');
      banRateCell.textContent = formatStatsApiRate(stats.banRate);

      const openDetails = () => {
        selectedChampionId = normalizeChampionId(stats.championId);
        selectedChampionStats = stats;
        selectedOpponentChampionId = 0;
        selectedKeystoneId = 0;
        lastDetailsData = null;
        updateStatsApiOpponentDropdownLabel();
        setStatsApiDetailsVisible(true);
        refreshStatsApiChampionTableSelection();
        refreshSelectedChampionDetails();
      };
      row.addEventListener('click', openDetails);
      row.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDetails();
      });

      row.append(tierCell, championCell, laneCell, gamesCell, winRateCell, pickRateCell, banRateCell);
      return row;
    }

    function refreshStatsApiChampionTableSelection(): void {
      elements.statsApiChampionsTableBody?.querySelectorAll('tr').forEach((row: Element) => {
        const championId = normalizeChampionId((row as HTMLElement).dataset?.championId);
        row.classList.toggle('expanded', championId === selectedChampionId && !detailsView?.hidden);
      });
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
          statsApiRankSelectionDirty = true;
          updateStatsApiRankSummary();
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
      if (!filters.position) {
        clearStatsApiChampionRows();
        setStatsApiLoading(false);
        setStatsApiStatus('利用可能なLaneが取得できませんでした。');
        return;
      }
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
        if (selectedChampionId > 0) {
          selectedChampionStats = statsList.find((entry: StatsApiChampionStats) => normalizeChampionId(entry?.championId) === selectedChampionId) || selectedChampionStats;
        }
        renderStatsApiChampionTable(statsList);
        setStatsApiStatus('');
        if (selectedChampionId > 0 && !detailsView?.hidden) {
          await refreshSelectedChampionDetails();
        }
      } catch (error: any) {
        if (requestId !== statsApiRequestId) return;
        clearStatsApiChampionRows();
        if (!scheduleStatsApiRetry('champions', error)) {
          setStatsApiStatus(`チャンピオン一覧を取得できませんでした: ${formatStatsApiErrorMessage(error)}`);
          if (selectedChampionId > 0 && !detailsView?.hidden) {
            setStatsApiDetailsStatus(`詳細データを更新できませんでした: ${formatStatsApiErrorMessage(error)}`);
          }
        }
      } finally {
        if (requestId === statsApiRequestId) {
          setStatsApiLoading(false);
        }
      }
    }

    async function refreshSelectedChampionDetails(): Promise<void> {
      const championId = normalizeChampionId(selectedChampionId);
      const filters = getStatsApiSelectedFilters();
      if (!championId || !filters.position) return;
      const requestId = ++statsApiDetailsRequestId;
      setStatsApiDetailsStatus('チャンピオン詳細を取得しています。');
      if (detailsContent && !lastDetailsData) {
        detailsContent.replaceChildren(createStatsApiEmptyState('詳細データを読み込み中です。'));
      }
      try {
        await ensureStatsApiRuneCatalog();
        const response = await fetchStatsApiJson(buildStatsApiChampionDetailsUrl({
          ...filters,
          championId,
          opponentChampionId: selectedOpponentChampionId
        }));
        if (requestId !== statsApiDetailsRequestId) return;
        lastDetailsData = response?.data || null;
        renderSelectedChampionDetails(lastDetailsData);
      } catch (error: any) {
        if (requestId !== statsApiDetailsRequestId) return;
        lastDetailsData = null;
        renderSelectedChampionDetails(null);
        setStatsApiDetailsStatus(`チャンピオン詳細を取得できませんでした: ${formatStatsApiErrorMessage(error)}`);
      }
    }

    function renderSelectedChampionDetails(detailsData: StatsApiChampionDetailsData | null): void {
      const championId = normalizeChampionId(selectedChampionId || detailsData?.champion?.championId);
      const championName = deps.championLabel ? deps.championLabel(championId) : `Champion ${championId}`;
      if (detailsTitle) {
        detailsTitle.textContent = championName;
      }
      if (!detailsContent) return;
      if (!detailsData?.champion) {
        detailsContent.replaceChildren(createStatsApiEmptyState('この条件では詳細データがありません。'));
        return;
      }

      const champion = detailsData.champion;
      const keystones = Array.isArray(detailsData.keystones) ? detailsData.keystones : [];
      if (!selectedKeystoneId || !keystones.some((entry) => normalizeChampionId(entry.keystoneId) === selectedKeystoneId)) {
        selectedKeystoneId = normalizeChampionId(keystones[0]?.keystoneId);
      }
      const activeKeystone = keystones.find((entry) => normalizeChampionId(entry.keystoneId) === selectedKeystoneId) || keystones[0] || null;
      setStatsApiDetailsStatus('');
      const top = doc.createElement('section');
      top.className = 'stats-api-details-top';
      top.append(
        createStatsApiChampionHero(champion),
        createStatsApiKeystoneSelector(keystones)
      );
      detailsContent.replaceChildren(
        top,
        createStatsApiDetailGridV2(activeKeystone)
      );
    }

    function createStatsApiChampionHero(champion: StatsApiChampionSummary): HTMLElement {
      const hero = doc.createElement('section');
      hero.className = 'stats-api-champion-hero';

      const portraitWrap = doc.createElement('div');
      portraitWrap.className = 'stats-api-champion-portrait';
      if (deps.loadChampionIcon) {
        const portrait = doc.createElement('img');
        portrait.alt = deps.championLabel ? deps.championLabel(champion.championId) : `Champion ${champion.championId}`;
        portrait.className = 'stats-api-champion-portrait-image';
        deps.loadChampionIcon(portrait, champion.championId);
        portraitWrap.append(portrait);
      } else {
        portraitWrap.textContent = String(champion.championId);
      }

      const content = doc.createElement('div');
      content.className = 'stats-api-champion-hero-main';
      const heading = doc.createElement('div');
      heading.className = 'stats-api-champion-hero-heading';
      heading.append(
        createText('stats-api-champion-name', deps.championLabel ? deps.championLabel(champion.championId) : `Champion ${champion.championId}`, 'h2'),
        createText('stats-api-champion-subtitle', `${getStatsApiLaneLabel(getStatsApiSelectedFilters().position)} lane`, 'p')
      );
      const metrics = doc.createElement('div');
      metrics.className = 'stats-api-champion-hero-metrics';
      metrics.append(
        createStatsApiSummaryChip('PR', formatStatsApiRate(champion.pickRate)),
        createStatsApiSummaryChip('WR', formatStatsApiRate(champion.winRate), getStatsApiWinRateAccent(champion.winRate)),
        createStatsApiSummaryChip('Games', formatStatsApiGames(champion.games))
      );
      content.append(heading, metrics);
      hero.append(portraitWrap, content);
      return hero;
    }

    function createStatsApiKeystoneSelector(keystones: StatsApiKeystoneDetails[]): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'stats-api-keystone-panel';
      section.append(
        createText('stats-api-section-title', 'キーストーン', 'h3'),
        createText('stats-api-section-subtitle', 'キーストーンを選択してください', 'p')
      );
      if (!keystones.length) {
        section.append(createStatsApiEmptyState('キーストーン候補がありません。'));
        return section;
      }
      const list = doc.createElement('div');
      list.className = 'stats-api-keystone-list';
      list.append(...keystones.map((keystone) => {
        const button = doc.createElement('button');
        button.type = 'button';
        const isActive = normalizeChampionId(keystone.keystoneId) === selectedKeystoneId;
        button.className = `stats-api-keystone-card${isActive ? ' active' : ''}`;
        button.setAttribute('aria-pressed', String(isActive));
        const header = doc.createElement('div');
        header.className = 'stats-api-keystone-card-header';
        header.append(
          createStatsApiRuneToken(
            getKeystoneLabel(keystone.keystoneId),
            getRuneIconUrl(keystone.keystoneId),
            'stats-api-rune-token keystone'
          )
        );
        button.append(
          header,
          createStatsApiOptionMeta(keystone)
        );
        button.addEventListener('click', () => {
          selectedKeystoneId = normalizeChampionId(keystone.keystoneId);
          if (lastDetailsData) {
            renderSelectedChampionDetails(lastDetailsData);
          }
        });
        return button;
      }));
      section.append(list);
      return section;
    }

    function createStatsApiDetailGrid(activeKeystone: StatsApiKeystoneDetails | null): HTMLElement {
      const grid = doc.createElement('div');
      grid.className = 'stats-api-detail-grid';
      if (!activeKeystone) {
        grid.append(createStatsApiDetailCard('詳細', '候補がありません', [createStatsApiEmptyState('表示できるキーストーン詳細がありません。')]));
        return grid;
      }

      const runeBodies: HTMLElement[] = [];
      if (activeKeystone.runes?.length) {
        runeBodies.push(...activeKeystone.runes.map((runeSet, index) => {
          const entry = doc.createElement('article');
          entry.className = 'stats-api-detail-option';
          entry.append(
            createText('stats-api-detail-option-title', `${index + 1}位 ルーンセット`, 'h4'),
            createStatsApiRuneStyleRow(runeSet.primaryStyleId, runeSet.primaryRuneIds),
            createStatsApiRuneStyleRow(runeSet.secondaryStyleId, runeSet.secondaryRuneIds),
            createStatsApiOptionMeta(runeSet)
          );
          return entry;
        }));
      }
      if (activeKeystone.statShards?.length) {
        const shardSection = doc.createElement('section');
        shardSection.className = 'stats-api-detail-subsection';
        shardSection.append(createText('stats-api-detail-subtitle', 'ルーンシャード', 'h4'));
        const shardList = doc.createElement('div');
        shardList.className = 'stats-api-item-set-list';
        shardList.append(...activeKeystone.statShards.map((shards) => {
          const entry = doc.createElement('article');
          entry.className = 'stats-api-detail-option';
          entry.append(
            createStatsApiTagList(shards.shardIds.map((id) => getShardLabel(id))),
            createStatsApiOptionMeta(shards)
          );
          return entry;
        }));
        shardSection.append(shardList);
        runeBodies.push(shardSection);
      }

      const summonerBodies = activeKeystone.summonerSpells?.length
        ? activeKeystone.summonerSpells.map((entry, index) => {
          const node = doc.createElement('article');
          node.className = 'stats-api-detail-option';
          node.append(
            createText('stats-api-detail-option-title', `${index + 1}位 サモナースペル`, 'h4'),
            createStatsApiTagList(entry.spellIds.map((id) => getSummonerSpellLabel(id))),
            createStatsApiOptionMeta(entry)
          );
          return node;
        })
        : [createStatsApiEmptyState('サモナースペル候補がありません。')];

      const buildBodies: HTMLElement[] = [];
      if (activeKeystone.boots?.length) {
        buildBodies.push(createStatsApiSingleItemRows('ブーツ', activeKeystone.boots));
      }
      if (activeKeystone.startingItems?.length) {
        const wrap = doc.createElement('section');
        wrap.className = 'stats-api-detail-subsection';
        wrap.append(createText('stats-api-detail-subtitle', 'スタートアイテム', 'h4'));
        const list = doc.createElement('div');
        list.className = 'stats-api-item-set-list';
        list.append(...activeKeystone.startingItems.map((entry) => createStatsApiItemSetRow('開始', entry.itemIds, entry, {
          compact: true,
          hideTitle: true
        })));
        wrap.append(list);
        buildBodies.push(wrap);
      }
      if (activeKeystone.firstSecondCoreItems?.length) {
        const wrap = doc.createElement('section');
        wrap.className = 'stats-api-detail-subsection';
        wrap.append(createText('stats-api-detail-subtitle', '1st + 2nd コア', 'h4'));
        const list = doc.createElement('div');
        list.className = 'stats-api-item-set-list';
        list.append(...activeKeystone.firstSecondCoreItems.map((entry) => createStatsApiItemSetRow('コア', entry.itemIds, entry, {
          arrow: true,
          compact: true,
          hideTitle: true
        })));
        wrap.append(list);
        buildBodies.push(wrap);
      }
      buildBodies.push(
        createStatsApiSingleItemRows('3rd アイテム', activeKeystone.thirdItems),
        createStatsApiSingleItemRows('4th アイテム', activeKeystone.fourthItems),
        createStatsApiSingleItemRows('5th アイテム', activeKeystone.fifthItems),
        createStatsApiSingleItemRows('6th アイテム', activeKeystone.sixthItems)
      );

      const skillBodies: HTMLElement[] = [];
      if (activeKeystone.skillOpenings?.length) {
        skillBodies.push(createStatsApiSkillSection(
          'Lv1-6',
          activeKeystone.skillOpenings.map((entry) => createStatsApiSkillOpeningRow(entry))
        ));
      }
      if (activeKeystone.skillPriorities?.length) {
        skillBodies.push(createStatsApiSkillSection(
          '優先スキル',
          activeKeystone.skillPriorities.map((entry) => createStatsApiSkillPriorityRow(entry))
        ));
      }
      if (!skillBodies.length) {
        skillBodies.push(createStatsApiEmptyState('スキル候補がありません。'));
      }

      grid.append(
        createStatsApiDetailCard(
          'ルーンセット',
          'アクティブなキーストーンでよく使われる構成',
          runeBodies.length ? runeBodies : [createStatsApiEmptyState('ルーン候補がありません。')]
        ),
        createStatsApiDetailCard(
          'サモナースペル',
          'このキーストーンと一緒に使われる組み合わせ',
          summonerBodies
        ),
        createStatsApiDetailCard(
          'アイテムビルド',
          '開始から 6th までの代表候補',
          buildBodies
        ),
        createStatsApiDetailCard(
          'スキルオーダー',
          'Lv1-6 の取り方と優先して伸ばすスキル',
          skillBodies
        )
      );
      return grid;
    }

    function createStatsApiDetailGridV2(activeKeystone: StatsApiKeystoneDetails | null): HTMLElement {
      const grid = doc.createElement('div');
      grid.className = 'stats-api-detail-grid';
      if (!activeKeystone) {
        grid.append(createStatsApiDetailCard('詳細', '候補がありません', [createStatsApiEmptyState('表示できるキーストーン詳細がありません。')]));
        return grid;
      }

      const runeBodies = createStatsApiRuneTabs(activeKeystone.runes, activeKeystone.statShards);
      const summonerBodies = [createStatsApiSummonerSpellSection(activeKeystone.summonerSpells, { hideTitle: true })];

      const buildBodies: HTMLElement[] = [
        createStatsApiBuildStageSection(
          '開始',
          createStatsApiBuildStageRowsFromSets(activeKeystone.startingItems, { iconOnly: true })
        ),
        createStatsApiBuildStageSection(
          'ブーツ',
          (activeKeystone.boots || []).map((entry) => createStatsApiItemSetRow('', [entry.itemId], entry, {
            hideTitle: true,
            hidePickRate: true,
            iconOnly: true
          }))
        ),
        createStatsApiBuildStageSection(
          '1st + 2nd',
          createStatsApiBuildStageRowsFromSets(activeKeystone.firstSecondCoreItems, { iconOnly: true })
        ),
        createStatsApiBuildStageSection(
          '3rd',
          (activeKeystone.thirdItems || []).map((entry) => createStatsApiItemSetRow('', [entry.itemId], entry, {
            hideTitle: true,
            hidePickRate: true,
            iconOnly: true
          }))
        ),
        createStatsApiBuildStageSection(
          '4th',
          (activeKeystone.fourthItems || []).map((entry) => createStatsApiItemSetRow('', [entry.itemId], entry, {
            hideTitle: true,
            hidePickRate: true,
            iconOnly: true
          }))
        ),
        createStatsApiBuildStageSection(
          '5th',
          (activeKeystone.fifthItems || []).map((entry) => createStatsApiItemSetRow('', [entry.itemId], entry, {
            hideTitle: true,
            hidePickRate: true,
            iconOnly: true
          }))
        )
      ];

      const skillBodies: HTMLElement[] = [];
      if (activeKeystone.skillOpenings?.length) {
        skillBodies.push(createStatsApiSkillSection(
          'Lv1-6',
          activeKeystone.skillOpenings.map((entry) => createStatsApiSkillOpeningRow(entry))
        ));
      }
      if (activeKeystone.skillPriorities?.length) {
        skillBodies.push(createStatsApiSkillSection(
          '優先スキル',
          activeKeystone.skillPriorities.map((entry) => createStatsApiSkillPriorityRow(entry))
        ));
      }
      if (!skillBodies.length) {
        skillBodies.push(createStatsApiEmptyState('スキル候補がありません。'));
      }

      const runeCard = createStatsApiDetailCard(
        'ルーンセット',
        '',
        runeBodies.length ? runeBodies : [createStatsApiEmptyState('ルーン候補がありません。')]
      );
      runeCard.classList.add('stats-api-detail-card-compact', 'stats-api-detail-card-runes');

      const buildCard = createStatsApiDetailCard(
        'アイテムビルド',
        '',
        buildBodies
      );
      buildCard.classList.add('stats-api-detail-card-build');

      const summonerCard = createStatsApiDetailCard(
        '\u30b5\u30e2\u30ca\u30fc\u30b9\u30da\u30eb',
        '',
        summonerBodies
      );
      summonerCard.classList.add('stats-api-detail-card-summoners');

      const leftColumn = doc.createElement('div');
      leftColumn.className = 'stats-api-detail-column';
      leftColumn.append(runeCard, summonerCard);

      const skillCard = createStatsApiDetailCard(
        'スキルオーダー',
        '',
        skillBodies
      );
      skillCard.classList.add('stats-api-detail-card-skill');

      grid.append(leftColumn, buildCard, skillCard);
      return grid;
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

    return {
      buildStatsApiChampionDetailsUrl,
      initializeStatsApiChampionList,
      refreshStatsApiChampionList
    };
  }

  const api = {
    buildStatsApiChampionDetailsUrl,
    buildStatsApiChampionsUrl,
    createChampionsView,
    formatStatsApiErrorMessage,
    getStatsApiLaneLabel,
    getStatsApiShardRowIndex,
    normalizeStatsApiRuneCatalog,
    normalizeStatsApiSelectedShardIds,
    parseStatsApiErrorInfo,
    parseStatsApiRetryAfterSeconds,
    buildStatsApiRunesDataUrl,
    buildStatsApiRuneIconUrl,
    filterStatsApiOpponentChampionOptions,
    getStatsApiOpponentChampionOptions,
    normalizeStatsApiSearchText,
    sortStatsApiChampionRows
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiChampionsView = api;
})(typeof window !== 'undefined' ? window : globalThis);
