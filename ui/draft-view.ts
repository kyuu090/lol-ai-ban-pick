(function attachUiDraftView(root: UiRoot) {
  function createDraftView(deps: DraftViewDeps) {
    const elements = deps.elements;
    const doc = (deps.document || root.document) as Document;
    const statsApiHelpers = (root.UiChampionsView || {}) as any;
    const buildStatsApiChampionDetailsUrl = typeof statsApiHelpers.buildStatsApiChampionDetailsUrl === 'function'
      ? statsApiHelpers.buildStatsApiChampionDetailsUrl
      : (filters: any, baseUrl = 'https://db.banpick-ai.lol') => {
        const position = String(filters?.position || '').trim().toUpperCase();
        const championId = Number(filters?.championId) || 0;
        if (!position || !championId) {
          throw new Error('StatsAPI champion detail filters are required.');
        }
        return new URL(`/v1/stats/positions/${encodeURIComponent(position)}/champions/${championId}/details`, baseUrl).toString();
      };
    const formatStatsApiErrorMessage = typeof statsApiHelpers.formatStatsApiErrorMessage === 'function'
      ? statsApiHelpers.formatStatsApiErrorMessage
      : (error: any) => String(error?.message || error || 'StatsAPIを取得できませんでした。');
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
    let draftRecommendationRequestId = 0;
    let draftRecommendationQueryKey = '';
    let draftRecommendationStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    let draftRecommendationError = '';
    let draftRecommendationData: any = null;
    let selectedRecommendationKeystoneId = 0;
    let draftRecommendationOpponentChampionId = 0;
    const draftRecommendationResponseCache = new Map<string, any>();
    interface DraftRuneAssetEntry {
      iconPath?: string;
      id: number;
      name?: string;
      slots?: DraftRuneAssetEntry[][];
      styleId?: number;
    }
    type DraftRuneCatalog = { perks: Record<string, DraftRuneAssetEntry>; styles: Record<string, DraftRuneAssetEntry> };
    let draftRuneCatalog: DraftRuneCatalog | null = null;
    let draftRuneCatalogPromise: Promise<DraftRuneCatalog> | null = null;
    let draftDataDragonVersion = 'latest';

    function normalizePositiveId(value: unknown): number {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 0;
    }

    function getChampionBackgroundUrl(championId: unknown): string {
      const numericChampionId = normalizePositiveId(championId);
      if (!numericChampionId) return '';
      const championsById = deps.getChampionsById?.() || {};
      const champion = championsById[numericChampionId] || championsById[String(numericChampionId)] || null;
      const alias = String(champion?.alias || '').trim();
      return alias ? `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${encodeURIComponent(alias)}_0.jpg` : '';
    }

    function getKeystoneLabel(keystoneId: unknown): string {
      const numericKeystoneId = normalizePositiveId(keystoneId);
      return getRuneAssetEntry('perks', numericKeystoneId)?.name || KEYSTONE_LABELS[numericKeystoneId] || getRuneLabel(numericKeystoneId) || `Keystone ${numericKeystoneId || '-'}`;
    }

    function getRuneStyleLabel(styleId: unknown): string {
      const numericStyleId = normalizePositiveId(styleId);
      return getRuneAssetEntry('styles', numericStyleId)?.name || RUNE_STYLE_LABELS[numericStyleId] || `Style ${numericStyleId || '-'}`;
    }

    function getRuneLabel(runeId: unknown): string {
      const numericRuneId = normalizePositiveId(runeId);
      return getRuneAssetEntry('perks', numericRuneId)?.name || SHARD_LABELS[numericRuneId] || `Rune ${numericRuneId || '-'}`;
    }

    function getSummonerSpellLabel(spellId: unknown): string {
      const numericSpellId = normalizePositiveId(spellId);
      return SUMMONER_SPELL_LABELS[numericSpellId] || `Spell ${numericSpellId || '-'}`;
    }

    function createText(className: string, text: string, tagName = 'span'): HTMLElement {
      const node = doc.createElement(tagName);
      node.className = className;
      node.textContent = text;
      return node;
    }

    function formatRate(value: unknown): string {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? deps.formatPercent(numericValue) : '-';
    }

    function formatGames(value: unknown): string {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0 ? String(Math.round(numericValue)) : '-';
    }

    function getLockedRecommendationContext(localMember: any): { championId: number; position: string } | null {
      const championId = normalizePositiveId(localMember?.championId);
      const position = String(localMember?.assignedPosition || '').trim().toUpperCase();
      if (!championId || !position) return null;
      return { championId, position };
    }

    function getDraftRecommendationOpponentChampionId(champSelect: any): number {
      return getMarkedLaneOpponentChampionId(champSelect) || 0;
    }

    function buildDraftRecommendationRequestUrl(localMember: any, champSelect: any): string | null {
      const context = getLockedRecommendationContext(localMember);
      if (!context) return null;
      return buildStatsApiChampionDetailsUrl({
        championId: context.championId,
        position: context.position,
        opponentChampionId: getDraftRecommendationOpponentChampionId(champSelect)
      });
    }

    function applyDraftRecommendationResponse(response: any): void {
      draftRecommendationData = (response as any)?.data || null;
      const keystones = Array.isArray(draftRecommendationData?.keystones) ? draftRecommendationData.keystones : [];
      selectedRecommendationKeystoneId = normalizePositiveId(keystones[0]?.keystoneId);
    }

    function resetDraftRecommendationState(): void {
      draftRecommendationRequestId += 1;
      draftRecommendationQueryKey = '';
      draftRecommendationStatus = 'idle';
      draftRecommendationError = '';
      draftRecommendationData = null;
      selectedRecommendationKeystoneId = 0;
      draftRecommendationOpponentChampionId = 0;
      draftRecommendationResponseCache.clear();
      setDraftRecommendationVisibility(false);
    }

    function ensureDraftRecommendationPanel(): HTMLElement | null {
      const focus = elements.banInsightPanel?.closest('.champion-focus') as HTMLElement | null;
      if (!focus) return null;
      let panel = focus.querySelector('.draft-recommend-panel') as HTMLElement | null;
      if (!panel) {
        panel = doc.createElement('section');
        panel.className = 'draft-recommend-panel';
        if (elements.banInsightPanel?.parentNode === focus) {
          focus.insertBefore(panel, elements.banInsightPanel);
        } else {
          focus.append(panel);
        }
      }
      return panel;
    }

    function setDraftRecommendationVisibility(visible: boolean): HTMLElement | null {
      const focus = elements.banInsightPanel?.closest('.champion-focus') as HTMLElement | null;
      const panel = ensureDraftRecommendationPanel();
      if (!focus || !panel) return null;
      focus.classList.toggle('recommendation-mode', visible);
      panel.hidden = !visible;
      if (!visible) {
        panel.replaceChildren();
      }
      if (elements.currentAction) {
        elements.currentAction.hidden = visible;
      }
      if (elements.currentPick) {
        elements.currentPick.hidden = visible;
      }
      const eyebrow = focus.querySelector('.eyebrow') as HTMLElement | null;
      if (eyebrow) {
        eyebrow.hidden = visible;
      }
      return panel;
    }

    function buildStatsApiRuneIconUrl(iconPath: unknown): string {
      const normalizedPath = String(iconPath || '').replace(/^\/+/, '');
      if (!normalizedPath) return '';
      return `https://ddragon.leagueoflegends.com/cdn/img/${normalizedPath}`;
    }

    function getRuneAssetEntry(type: 'perks' | 'styles', runeId: unknown): DraftRuneAssetEntry | null {
      const numericRuneId = normalizePositiveId(runeId);
      if (!numericRuneId || !draftRuneCatalog?.[type]) return null;
      return draftRuneCatalog[type]?.[String(numericRuneId)] || null;
    }

    function getRuneIconUrl(runeId: unknown): string {
      return buildStatsApiRuneIconUrl(getRuneAssetEntry('perks', runeId)?.iconPath);
    }

    function getRuneStyleIconUrl(styleId: unknown): string {
      return buildStatsApiRuneIconUrl(getRuneAssetEntry('styles', styleId)?.iconPath);
    }

    function getShardIconUrl(shardId: unknown): string {
      const numericShardId = normalizePositiveId(shardId);
      return buildStatsApiRuneIconUrl(SHARD_ICON_PATHS[numericShardId]);
    }

    function getSummonerSpellIconUrl(spellId: unknown): string {
      const numericSpellId = normalizePositiveId(spellId);
      const iconKey = SUMMONER_SPELL_ICON_KEYS[numericSpellId];
      if (!iconKey) return '';
      return draftDataDragonVersion === 'latest'
        ? `https://ddragon.leagueoflegends.com/cdn/img/spell/${iconKey}.png`
        : `https://ddragon.leagueoflegends.com/cdn/${draftDataDragonVersion}/img/spell/${iconKey}.png`;
    }

    function createStatsApiSummaryChip(label: string, value: string, className = ''): HTMLElement {
      const chip = doc.createElement('span');
      chip.className = `stats-api-summary-chip${className ? ` ${className}` : ''}`;
      chip.append(
        createText('stats-api-summary-chip-label', label),
        createText('stats-api-summary-chip-value', value)
      );
      return chip;
    }

    function createStatsApiOptionMeta(entry: any, options: { hidePickRate?: boolean } = {}): HTMLElement {
      const meta = doc.createElement('div');
      meta.className = 'stats-api-option-meta';
      if (!options.hidePickRate) {
        meta.append(createStatsApiSummaryChip('PR', formatRate(entry?.pickRate)));
      }
      meta.append(
        createStatsApiSummaryChip('WR', formatRate(entry?.winRate)),
        createStatsApiSummaryChip('Games', formatGames(entry?.games))
      );
      return meta;
    }

    function createStatsApiRuneSetMeta(entry: any): HTMLElement {
      const meta = doc.createElement('div');
      meta.className = 'stats-api-option-meta stats-api-rune-set-meta';
      meta.append(
        createStatsApiSummaryChip('WR', formatRate(entry?.winRate)),
        createStatsApiSummaryChip('Games', formatGames(entry?.games))
      );
      return meta;
    }

    function createStatsApiSummonerSpellMeta(entry: any): HTMLElement {
      const meta = doc.createElement('div');
      meta.className = 'stats-api-option-meta stats-api-summoner-spell-meta';
      meta.append(
        createStatsApiSummaryChip('Games', formatGames(entry?.games)),
        createStatsApiSummaryChip('WR', formatRate(entry?.winRate))
      );
      return meta;
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

    function createStatsApiRuneStyleBadge(styleId: unknown): HTMLElement {
      return createStatsApiRuneToken(
        getRuneStyleLabel(styleId),
        getRuneStyleIconUrl(styleId),
        'stats-api-rune-token style stats-api-rune-style-badge'
      );
    }

    function createStatsApiRuneNode(
      runeEntry: DraftRuneAssetEntry,
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
      node.title = SHARD_LABELS[normalizePositiveId(shardId)] || getRuneLabel(shardId);
      node.setAttribute('aria-label', node.title);
      const iconUrl = getShardIconUrl(shardId);
      if (iconUrl) {
        const image = doc.createElement('img');
        image.alt = '';
        image.className = 'stats-api-shard-node-icon';
        image.loading = 'lazy';
        image.src = iconUrl;
        node.append(image);
      } else {
        node.append(createText('stats-api-shard-node-label', node.title));
      }
      return node;
    }

    function getStatsApiShardRowIndex(shardId: unknown): number {
      const numericShardId = normalizePositiveId(shardId);
      return STATS_API_SHARD_ROWS.findIndex((rowShardIds) => rowShardIds.some((candidateId) => candidateId === numericShardId));
    }

    function getStatsApiShardRowIndexes(shardId: unknown): number[] {
      const numericShardId = normalizePositiveId(shardId);
      return STATS_API_SHARD_ROWS.flatMap((rowShardIds, rowIndex) => (
        rowShardIds.some((candidateId) => candidateId === numericShardId) ? [rowIndex] : []
      ));
    }

    function resolveSelectedShardsByRow(shardIds: number[]): number[] {
      const selectedByRow = Array<number>(STATS_API_SHARD_ROWS.length).fill(0);
      const pending = shardIds
        .map((id) => ({ id, rowIndexes: getStatsApiShardRowIndexes(id) }))
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

    function normalizeSelectedShardIds(
      statShards: Array<{ shardIds?: number[] | unknown[] }> | undefined,
      preferredIndex = 0
    ): number[] {
      const shardEntries = (Array.isArray(statShards) ? statShards : [])
        .map((entry) => Array.isArray(entry?.shardIds)
          ? entry.shardIds.map((id) => normalizePositiveId(id)).filter(Boolean)
          : [])
        .filter((ids) => ids.length > 0);
      const preferredIds = shardEntries[preferredIndex] || shardEntries[0] || [];
      const preferredRows = preferredIds.map((id) => getStatsApiShardRowIndex(id));
      if (
        preferredIds.length === STATS_API_SHARD_ROWS.length &&
        preferredRows.every((rowIndex) => rowIndex >= 0)
      ) {
        const resolvedPreferredIds = resolveSelectedShardsByRow(preferredIds);
        if (resolvedPreferredIds.every(Boolean)) {
          return resolvedPreferredIds;
        }
      }
      const selectedByRow = Array<number>(STATS_API_SHARD_ROWS.length).fill(0);
      shardEntries.forEach((ids) => {
        const resolvedIds = resolveSelectedShardsByRow(ids);
        resolvedIds.forEach((id, rowIndex) => {
          if (id && !selectedByRow[rowIndex]) {
            selectedByRow[rowIndex] = id;
          }
        });
      });
      return selectedByRow;
    }

    function createStatsApiShardTree(selectedShardIds: unknown[]): HTMLElement {
      const wrap = doc.createElement('div');
      wrap.className = 'stats-api-shard-tree';
      const normalizedSelectedIds = (Array.isArray(selectedShardIds) ? selectedShardIds : [])
        .map((id) => normalizePositiveId(id))
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
      const numericStyleId = normalizePositiveId(styleId);
      const styleEntry = getRuneAssetEntry('styles', numericStyleId);
      const selectedIds = new Set((Array.isArray(selectedRuneIds) ? selectedRuneIds : []).map((id) => normalizePositiveId(id)).filter(Boolean));
      const tree = doc.createElement('section');
      tree.className = `stats-api-rune-tree${options.secondary ? ' secondary' : ' primary'}`;
      tree.append(createStatsApiRuneStyleBadge(numericStyleId));
      const slotsWrap = doc.createElement('div');
      slotsWrap.className = 'stats-api-rune-tree-slots';
      const slots = Array.isArray(styleEntry?.slots) ? styleEntry.slots : [];
      slots.forEach((slotRunes, slotIndex) => {
        if (options.omitKeystone && slotIndex === 0) return;
        const row = doc.createElement('div');
        row.className = 'stats-api-rune-tree-row';
        row.append(...slotRunes.map((runeEntry) => createStatsApiRuneNode(
          runeEntry,
          selectedIds.has(runeEntry.id),
          { keystone: slotIndex === 0, secondary: options.secondary }
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

    function createStatsApiRunePage(runeSet: any, selectedShardIds: unknown[] = []): HTMLElement {
      const page = doc.createElement('div');
      page.className = 'stats-api-rune-page';
      const primaryStyle = createStatsApiRuneStyleTree(runeSet.primaryStyleId, runeSet.primaryRuneIds, { omitKeystone: true });
      primaryStyle.classList.add('stats-api-rune-page-primary');
      const side = doc.createElement('div');
      side.className = 'stats-api-rune-page-secondary-row';
      side.append(createStatsApiRuneStyleTree(runeSet.secondaryStyleId, runeSet.secondaryRuneIds, { omitKeystone: true, secondary: true }));
      const shardBlock = doc.createElement('div');
      shardBlock.className = 'stats-api-rune-page-shards';
      const shardHeader = doc.createElement('div');
      shardHeader.className = 'stats-api-rune-page-shards-header';
      shardHeader.append(createStatsApiRuneSetMeta(runeSet));
      shardBlock.append(shardHeader, createStatsApiShardTree(selectedShardIds));
      side.append(shardBlock);
      page.append(primaryStyle, side);
      return page;
    }

    function createStatsApiRuneTabs(runes: any[] | undefined, statShards: any[] | undefined): HTMLElement[] {
      const runeSets = Array.isArray(runes) ? runes : [];
      if (!runeSets.length) {
        return [createText('stats-api-detail-empty', 'ルーン候補がありません。', 'p')];
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
        const tabId = `draft-stats-api-rune-tab-${index}`;
        const panelId = `draft-stats-api-rune-panel-${index}`;
        const selectedShardIds = normalizeSelectedShardIds(statShards, index);
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

    function createStatsApiSummonerSpellToken(spellId: unknown): HTMLElement {
      return createStatsApiRuneToken(
        getSummonerSpellLabel(spellId),
        getSummonerSpellIconUrl(spellId),
        'stats-api-rune-token stats-api-summoner-spell-token'
      );
    }

    function createStatsApiSummonerSpellSection(entries: any[] | undefined): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'stats-api-detail-subsection stats-api-rune-summoner-section';
      section.append(createText('stats-api-detail-subtitle', 'サモナースペル', 'h4'));
      if (!entries?.length) {
        section.append(createText('stats-api-detail-empty', 'サモナースペル候補がありません。', 'p'));
        return section;
      }
      const list = doc.createElement('div');
      list.className = 'stats-api-rune-summoner-list';
      list.append(...entries.map((entry) => {
        const node = doc.createElement('article');
        node.className = 'stats-api-detail-option';
        const wrap = doc.createElement('div');
        wrap.className = 'stats-api-tag-list stats-api-summoner-spell-list';
        wrap.append(...(Array.isArray(entry?.spellIds) ? entry.spellIds : []).map((id: unknown) => createStatsApiSummonerSpellToken(id)));
        node.append(wrap, createStatsApiSummonerSpellMeta(entry));
        return node;
      }));
      section.append(list);
      return section;
    }

    function createStatsApiDetailCard(title: string, bodyChildren: HTMLElement[]): HTMLElement {
      const card = doc.createElement('section');
      card.className = 'stats-api-detail-card';
      const header = doc.createElement('div');
      header.className = 'stats-api-detail-card-header';
      header.append(createText('stats-api-detail-card-title', title, 'h3'));
      const body = doc.createElement('div');
      body.className = 'stats-api-detail-card-body';
      body.append(...bodyChildren);
      card.append(header, body);
      return card;
    }

    async function ensureDraftRuneCatalog(): Promise<void> {
      if (draftRuneCatalog) return;
      if (draftRuneCatalogPromise) {
        await draftRuneCatalogPromise;
        return;
      }
      if (!deps.fetch) return;
      draftRuneCatalogPromise = deps.fetch('https://ddragon.leagueoflegends.com/api/versions.json')
        .then((response) => response.json())
        .then((versions) => Array.isArray(versions) ? String(versions[0] || '') : '')
        .then((version) => {
          if (!version) {
            throw new Error('Data Dragon version is unavailable.');
          }
          draftDataDragonVersion = version;
          return deps.fetch!(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ja_JP/runesReforged.json`);
        })
        .then((response) => response.json())
        .then((payload) => {
          const catalog: DraftRuneCatalog = { perks: {}, styles: {} };
          (Array.isArray(payload) ? payload : []).forEach((style: any) => {
            const styleId = normalizePositiveId(style?.id);
            if (styleId) {
              const normalizedSlots: DraftRuneAssetEntry[][] = [];
              catalog.styles[String(styleId)] = {
                iconPath: String(style?.icon || ''),
                id: styleId,
                name: String(style?.name || RUNE_STYLE_LABELS[styleId] || `Style ${styleId}`),
                slots: normalizedSlots,
                styleId
              };
            }
            (Array.isArray(style?.slots) ? style.slots : []).forEach((slot: any) => {
              const normalizedRunes: DraftRuneAssetEntry[] = [];
              (Array.isArray(slot?.runes) ? slot.runes : []).forEach((rune: any) => {
                const runeId = normalizePositiveId(rune?.id);
                if (!runeId) return;
                const normalizedRune = {
                  iconPath: String(rune?.icon || ''),
                  id: runeId,
                  name: String(rune?.name || `Rune ${runeId}`),
                  styleId
                };
                catalog.perks[String(runeId)] = normalizedRune;
                normalizedRunes.push(normalizedRune);
              });
              if (normalizedRunes.length && styleId) {
                catalog.styles[String(styleId)]?.slots?.push(normalizedRunes);
              }
            });
          });
          draftRuneCatalog = catalog;
          return catalog;
        })
        .catch(() => {
          draftDataDragonVersion = 'latest';
          draftRuneCatalog = { perks: {}, styles: {} };
          return draftRuneCatalog;
        })
        .finally(() => {
          draftRuneCatalogPromise = null;
        });
      await draftRuneCatalogPromise;
    }

    async function refreshDraftRecommendations(localMember: any, champSelect: any): Promise<void> {
      const detailsUrl = buildDraftRecommendationRequestUrl(localMember, champSelect);
      if (!detailsUrl) {
        draftRecommendationQueryKey = '';
        draftRecommendationStatus = 'idle';
        draftRecommendationError = '';
        draftRecommendationData = null;
        selectedRecommendationKeystoneId = 0;
        draftRecommendationOpponentChampionId = 0;
        renderDraftRecommendation(localMember);
        return;
      }

      const queryKey = detailsUrl;
      draftRecommendationOpponentChampionId = getDraftRecommendationOpponentChampionId(champSelect);
      if (
        draftRecommendationQueryKey === queryKey &&
        (draftRecommendationStatus === 'loading' || draftRecommendationStatus === 'ready')
      ) {
        renderDraftRecommendation(localMember);
        return;
      }

      draftRecommendationQueryKey = queryKey;
      draftRecommendationStatus = 'loading';
      draftRecommendationError = '';
      draftRecommendationData = null;
      selectedRecommendationKeystoneId = 0;
      renderDraftRecommendation(localMember);

      if (!deps.requestStatsApiJson) {
        draftRecommendationStatus = 'error';
        draftRecommendationError = 'StatsAPI request helper が利用できません。';
        renderDraftRecommendation(localMember);
        return;
      }

      const requestId = ++draftRecommendationRequestId;
      try {
        await ensureDraftRuneCatalog();
        const cachedResponse = draftRecommendationResponseCache.get(queryKey);
        if (cachedResponse) {
          if (requestId !== draftRecommendationRequestId || draftRecommendationQueryKey !== queryKey) return;
          applyDraftRecommendationResponse(cachedResponse);
          draftRecommendationStatus = 'ready';
          renderDraftRecommendation(localMember);
          return;
        }
        const response = await deps.requestStatsApiJson(detailsUrl);
        if (requestId !== draftRecommendationRequestId || draftRecommendationQueryKey !== queryKey) return;
        draftRecommendationResponseCache.set(queryKey, response);
        applyDraftRecommendationResponse(response);
        draftRecommendationStatus = 'ready';
        renderDraftRecommendation(localMember);
      } catch (error: any) {
        if (requestId !== draftRecommendationRequestId || draftRecommendationQueryKey !== queryKey) return;
        draftRecommendationStatus = 'error';
        draftRecommendationError = formatStatsApiErrorMessage(error);
        draftRecommendationData = null;
        selectedRecommendationKeystoneId = 0;
        renderDraftRecommendation(localMember);
      }
    }

    function renderDraftRecommendation(localMember: any): boolean {
      const context = getLockedRecommendationContext(localMember);
      const panel = setDraftRecommendationVisibility(Boolean(context));
      if (!context || !panel) return false;

      if (draftRecommendationStatus === 'loading') {
        panel.replaceChildren(createText('draft-recommend-empty', 'StatsAPI からおすすめを取得中です。', 'p'));
        return true;
      }

      if (draftRecommendationStatus === 'error') {
        panel.replaceChildren(createText('draft-recommend-empty', draftRecommendationError || 'おすすめを取得できませんでした。', 'p'));
        return true;
      }

      const keystones = Array.isArray(draftRecommendationData?.keystones) ? draftRecommendationData.keystones : [];
      if (!keystones.length) {
        panel.replaceChildren(createText('draft-recommend-empty', 'おすすめデータがありません。', 'p'));
        return true;
      }

      if (!selectedRecommendationKeystoneId || !keystones.some((entry: any) => normalizePositiveId(entry?.keystoneId) === selectedRecommendationKeystoneId)) {
        selectedRecommendationKeystoneId = normalizePositiveId(keystones[0]?.keystoneId);
      }
      const activeKeystone = keystones.find((entry: any) => normalizePositiveId(entry?.keystoneId) === selectedRecommendationKeystoneId) || keystones[0];
      const shell = doc.createElement('div');
      shell.className = 'draft-recommend-shell';

      const top = doc.createElement('section');
      top.className = 'stats-api-details-top';
      if (draftRecommendationOpponentChampionId) {
        const heading = doc.createElement('div');
        heading.className = 'draft-recommend-heading';
        heading.append(
          createText('draft-recommend-heading-prefix', 'vs '),
          deps.createInlineChampionName(
            draftRecommendationOpponentChampionId,
            'inline-champion-name draft-recommend-heading-opponent'
          )
        );
        top.append(heading);
      }
      const keystonePanel = doc.createElement('section');
      keystonePanel.className = 'stats-api-keystone-panel';
      const keystoneList = doc.createElement('div');
      keystoneList.className = 'stats-api-keystone-list';
      keystoneList.append(...keystones.map((keystone: any) => {
        const button = doc.createElement('button');
        button.type = 'button';
        const isActive = normalizePositiveId(keystone?.keystoneId) === selectedRecommendationKeystoneId;
        button.className = `stats-api-keystone-card${isActive ? ' active' : ''}`;
        button.setAttribute('aria-pressed', String(isActive));
        const header = doc.createElement('div');
        header.className = 'stats-api-keystone-card-header';
        header.append(
          createStatsApiRuneToken(
            getKeystoneLabel(keystone?.keystoneId),
            getRuneIconUrl(keystone?.keystoneId),
            'stats-api-rune-token keystone'
          )
        );
        button.append(header, createStatsApiOptionMeta(keystone));
        button.addEventListener('click', () => {
          selectedRecommendationKeystoneId = normalizePositiveId(keystone?.keystoneId);
          renderDraftRecommendation(localMember);
        });
        return button;
      }));
      keystonePanel.append(keystoneList);
      top.append(keystonePanel);

      const grid = doc.createElement('div');
      grid.className = 'stats-api-detail-grid draft-recommend-grid';
      const leftColumn = doc.createElement('div');
      leftColumn.className = 'stats-api-detail-column';

      const runeBodies = createStatsApiRuneTabs(activeKeystone?.runes, activeKeystone?.statShards);
      const runeCard = createStatsApiDetailCard(
        'ルーン',
        runeBodies.length ? runeBodies : [createText('stats-api-detail-empty', 'ルーン候補がありません。', 'p')]
      );
      runeCard.classList.add('stats-api-detail-card-compact', 'stats-api-detail-card-runes');
      const runeHeader = runeCard.querySelector('.stats-api-detail-card-header');
      const runeTabList = runeCard.querySelector('.stats-api-rune-tab-list');
      if (runeHeader && runeTabList) {
        runeHeader.append(runeTabList);
      }

      const summonerCard = createStatsApiDetailCard(
        'サモナースペル',
        [createStatsApiSummonerSpellSection(activeKeystone?.summonerSpells)]
      );
      summonerCard.classList.add('stats-api-detail-card-summoners');

      leftColumn.append(runeCard, summonerCard);
      grid.append(leftColumn);
      shell.append(top, grid);
      panel.replaceChildren(shell);
      return true;
    }

    function applyPickCardBackground(row: HTMLElement, championId: number, options: { selected?: boolean; intent?: boolean } = {}): void {
      if (!championId) return;
      const setBackground = (src: string) => {
        if (!src) return;
        row.style.setProperty('--pick-card-image', `url("${src}")`);
        row.style.setProperty('--pick-card-image-opacity', options.selected ? '0.98' : options.intent ? '0.82' : '0.9');
        row.classList.add('has-champion-background');
      };
      const backgroundUrl = getChampionBackgroundUrl(championId);
      if (backgroundUrl) {
        setBackground(backgroundUrl);
        return;
      }

      const image = doc.createElement('img');
      const applyBackground = () => {
        const src = String((image as HTMLImageElement).src || '');
        setBackground(src);
      };
      image.addEventListener('load', applyBackground);
      deps.loadChampionIcon(image as HTMLImageElement, championId);
      applyBackground();
    }

    function renderChampSelect(champSelect: any, gameflowPhase: any): void {
      const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
      const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
      const { allyBans, enemyBans } = deps.collectBans(champSelect, allyTeam, enemyTeam);
      const localCellId = champSelect?.localPlayerCellId;
      const activeAction = deps.getActiveAction(champSelect, localCellId);
      const localMember = allyTeam.find((member: any) => member.cellId === localCellId);
      const isLocalTurn = activeAction?.actorCellId === localCellId;
      const isDraftActionPhase = String(champSelect?.timer?.phase || '').toUpperCase() === 'BAN_PICK';
      const isLocalPickTurn = isDraftActionPhase && Boolean(activeAction?.isInProgress) && isLocalTurn && activeAction?.type === 'pick';
      if (deps.getMarkedLaneOpponentCellId() !== null && !enemyTeam.some((member: any) => member.cellId === deps.getMarkedLaneOpponentCellId())) {
        deps.setMarkedLaneOpponentCellId(null);
      }

      elements.champSelectView.classList.toggle('local-turn', isLocalTurn);
      renderBanList(elements.allyBans, allyBans);
      renderBanList(elements.enemyBans, enemyBans);
      renderTeam(elements.allyTeam, allyTeam, 'ally', { activeAction, localCellId });
      renderTeam(elements.enemyTeam, enemyTeam, 'enemy', {
        activeAction,
        localCellId,
        localAssignedPosition: localMember?.assignedPosition,
        markedLaneOpponentCellId: deps.getMarkedLaneOpponentCellId()
      });
      void refreshDraftRecommendations(localMember, champSelect);
      renderDraftFocus(champSelect, activeAction);
      if (isLocalPickTurn) {
        deps.requestDraftAiAnalysisIfNeeded(champSelect, localMember, activeAction);
      }
      if (deps.isChampSelectFinalization(champSelect, gameflowPhase)) {
        deps.requestFinalCompositionAnalysisIfNeeded(champSelect, localMember);
      }
      renderDraftAiAnalysis(deps.getDraftAiAnalysisStatus());
    }

    function renderDraftAiAnalysis(status: UiDraftAiAnalysisStatus): void {
      if (!elements.draftAiAnalysisPanel) return;

      const panel = elements.draftAiAnalysisPanel;
      panel.replaceChildren();

      const header = doc.createElement('div');
      header.className = 'draft-ai-analysis-header';

      const titleBlock = doc.createElement('div');
      const eyebrow = doc.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = 'AI Analysis';
      const title = doc.createElement('h3');
      title.textContent = deps.getDraftAiAnalysisPhase() === 'final_composition' ? '最終構成分析' : 'バンピック分析';
      titleBlock.append(eyebrow, title);

      const badge = doc.createElement('span');
      badge.className = `draft-ai-analysis-badge ${status}`;
      badge.textContent = status === 'ready' ? 'DONE' : status === 'requesting' ? 'ASKING' : status === 'error' ? 'ERROR' : 'WAITING';
      header.append(titleBlock, badge);
      panel.append(header);

      if (status === 'requesting') {
        panel.append(createDraftAiAnalysisStatus(deps.getDraftAiAnalysisPhase() === 'final_composition'
          ? 'AIに最終構成を分析依頼中・・'
          : 'AIに分析を依頼中・・'));
        return;
      }

      if (status === 'error') {
        panel.append(createDraftAiAnalysisStatus(deps.getDraftAiAnalysisError() || 'AI分析を取得できませんでした。'));
        return;
      }

      if (status !== 'ready') {
        panel.append(createDraftAiAnalysisStatus('AI分析を待機中・・'));
        return;
      }

      const notes = deps.getDraftAiAnalysisNotes();
      if (!notes.length) {
        panel.append(createDraftAiAnalysisStatus('AI分析を表示できませんでした。'));
        return;
      }

      const list = doc.createElement('div');
      list.className = 'draft-ai-analysis-notes';
      notes.forEach((note: any) => {
        const item = doc.createElement('article');
        item.className = 'draft-ai-analysis-note';

        const noteTitle = doc.createElement('strong');
        noteTitle.textContent = note.title;

        const body = doc.createElement('p');
        body.textContent = note.body;

        item.append(noteTitle, body);
        list.append(item);
      });
      panel.append(list);
    }

    function createDraftAiAnalysisStatus(text: string): HTMLParagraphElement {
      const message = doc.createElement('p');
      message.className = 'draft-ai-analysis-status';
      message.textContent = text;
      return message;
    }

    function renderBanList(container: HTMLElement, bans: number[]): void {
      container.replaceChildren(...bans.slice(0, 5).map((championId) => {
        const item = doc.createElement('span');
        item.className = 'ban-token';
        item.title = deps.championTitle(championId);

        const icon = doc.createElement('img');
        icon.alt = '';
        icon.className = 'ban-token-icon';
        deps.loadChampionIcon(icon, championId);

        const label = doc.createElement('span');
        label.textContent = deps.championLabel(championId);

        item.append(icon, label);
        return item;
      }));

      if (bans.length === 0) {
        const item = doc.createElement('span');
        item.className = 'ban-token empty';
        item.textContent = 'BANなし';
        container.append(item);
      }
    }

    function renderTeam(container: HTMLElement, team: any[], side: string, turnState: any = {}): void {
      const rows = Array.from({ length: 5 }, (_, index) => team[index] ?? { cellId: index, championId: 0 });

      container.replaceChildren(...rows.map((member) => {
        const row = doc.createElement('article');
        const isRealMember = team.includes(member);
        const selected = Number(member.championId) > 0;
        const intendedChampionId = Number(member.championPickIntent);
        const hasIntent = !selected && intendedChampionId > 0;
        const portraitChampionId = selected ? Number(member.championId) : intendedChampionId;
        const isLocalMember = member.cellId === turnState.localCellId;
        const isActiveMember = member.cellId === turnState.activeAction?.actorCellId;
        const isLocalActiveMember = isLocalMember && isActiveMember;
        const isEnemyMember = side === 'enemy' && isRealMember;
        const isMarkedLaneOpponent = isEnemyMember && member.cellId === turnState.markedLaneOpponentCellId;
        row.className = `pick-row ${side} ${selected ? 'selected' : hasIntent ? 'intent' : 'empty'}${isLocalMember ? ' local-player' : ''}${isActiveMember ? ' active-turn' : ''}${isLocalActiveMember ? ' local-active-turn' : ''}${isEnemyMember ? ' lane-opponent-target' : ''}${isMarkedLaneOpponent ? ' marked-lane-opponent' : ''}`;
        if (portraitChampionId > 0) {
          applyPickCardBackground(row, portraitChampionId, { selected, intent: hasIntent });
        }
        if (isEnemyMember) {
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-pressed', String(isMarkedLaneOpponent));
          row.title = isMarkedLaneOpponent ? 'Click to unmark lane opponent' : 'Click to mark as lane opponent';
          row.addEventListener('click', () => deps.toggleMarkedLaneOpponent(member.cellId));
          row.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              deps.toggleMarkedLaneOpponent(member.cellId);
            }
          });
        }

        const roleBadge = doc.createElement('span');
        roleBadge.className = 'pick-role-badge';
        roleBadge.textContent = deps.positionLabel(member.assignedPosition);

        const meta = doc.createElement('div');
        meta.className = 'pick-meta';

        const champion = doc.createElement('strong');
        champion.textContent = selected ? deps.championLabel(member.championId) : deps.getPendingLabel(member, deps.championLabel);

        meta.append(champion);
        if (side !== 'enemy') {
          row.append(roleBadge);
        }
        row.append(meta);
        if (isMarkedLaneOpponent) {
          const marker = doc.createElement('span');
          marker.className = 'lane-opponent-marker';
          marker.textContent = 'OPPONENT';
          row.append(marker);
        }
        return row;
      }));
    }

    function renderDraftFocus(champSelect: any, activeAction: any = deps.getActiveAction(champSelect)): void {
      const localCellId = champSelect?.localPlayerCellId;
      const localMember = champSelect?.myTeam?.find((member: any) => member.cellId === localCellId);
      const isDraftActionPhase = String(champSelect?.timer?.phase || '').toUpperCase() === 'BAN_PICK';
      renderDraftSelfSummary(localMember);
      if (renderDraftRecommendation(localMember)) {
        renderInsightPanel(false);
      } else {
        renderDraftInsights(null, { champSelect, localMember });
      }

      if (activeAction) {
        const isActionInProgress = Boolean(activeAction.isInProgress);
        const isLocalTurn = isDraftActionPhase && isActionInProgress && activeAction.actorCellId === localCellId;
        const insightType = isDraftActionPhase && isActionInProgress ? activeAction.type : null;
        const actionLabel = activeAction.type === 'ban' ? 'BAN' : 'PICK';
        elements.currentAction.textContent = isLocalTurn ? `YOUR ${actionLabel}` : isDraftActionPhase && isActionInProgress ? `${actionLabel} PHASE` : 'Waiting';
        if (!renderDraftRecommendation(localMember)) {
          renderDraftInsights(insightType, { champSelect, localMember });
        }
        elements.currentPick.textContent = isLocalTurn
          ? activeAction.type === 'ban' ? 'あなたのBANです' : 'あなたのPICKです'
          : isDraftActionPhase && isActionInProgress ? `Summoner ${(activeAction.actorCellId ?? 0) + 1} の操作待ちです` : 'チャンピオン選択情報を監視しています。';
        return;
      }

      elements.currentAction.textContent = localMember?.championId ? deps.championLabel(localMember.championId) : '待機中';
      elements.currentPick.textContent = 'チャンピオン選択情報を監視しています。';
    }

    function renderDraftSelfSummary(localMember: any): void {
      if (!elements.draftSelfSummary) return;

      const championId = deps.getMemberChampionId(localMember);
      elements.draftSelfSummary.replaceChildren();
      elements.draftSelfSummary.hidden = !championId;
      if (!championId) return;

      const header = doc.createElement('div');
      header.className = 'draft-self-summary-header';

      const label = doc.createElement('span');
      label.className = 'draft-self-summary-label';
      label.textContent = 'Your';

      const champion = deps.createInlineChampionName(championId, 'inline-champion-name draft-self-summary-name');
      header.append(label, champion);

      const stats = deps.createChampionStatsElement(
        deps.getChampionRoleDisplayStats(championId, localMember?.assignedPosition),
        'draft-self-summary-stats',
        { includeGames: false }
      );

      elements.draftSelfSummary.append(header, stats);
    }

    function renderDraftInsights(type: string | null, context: any = {}): void {
      if (type === 'ban') {
        renderBanInsights(true, context.champSelect, context.localMember);
      } else if (type === 'pick') {
        renderPickPoolInsights(true, context.champSelect, context.localMember);
      } else if (context.champSelect && context.localMember && getMarkedLaneOpponentChampionId(context.champSelect)) {
        renderMarkedOpponentPickInsights(true, context.champSelect, context.localMember);
      } else {
        renderInsightPanel(false);
      }
    }

    function renderInsightPanel(visible: boolean, mode = ''): HTMLElement | null {
      const focus = elements.banInsightPanel?.closest('.champion-focus');
      if (!elements.banInsightPanel || !focus) return null;

      elements.banInsightPanel.hidden = !visible;
      elements.banInsightPanel.className = `ban-insight-panel${mode ? ` ${mode}` : ''}`;
      focus.classList.toggle('has-ban-insights', visible);
      focus.classList.toggle('insight-only', visible);
      if (!visible) {
        elements.banInsightPanel.replaceChildren();
        return null;
      }

      return elements.banInsightPanel;
    }

    function renderBanInsights(visible: boolean, champSelect: any, localMember: any): void {
      const panel = renderInsightPanel(visible, 'ban-mode');
      if (!panel) return;

      const position = String(localMember?.assignedPosition || '').toUpperCase();
      const minGames = getBanInsightMinGames();
      const plannedPickThreatSection = createPlannedPickBanThreatSection(champSelect, localMember, position, minGames);
      const laneStats = deps.sortWorstWinRateStats(deps.getMatchHistoryLaneOpponentStats().filter((stats: any) => (
        String(stats.position || '').toUpperCase() === position &&
        Number(stats.games || 0) >= minGames
      ))).slice(0, deps.BAN_INSIGHT_LIMIT);
      const enemyStats = deps.sortWorstWinRateStats(deps.getMatchHistoryEnemyChampionStats().filter((stats: any) => (
        Number(stats.games || 0) >= minGames
      ))).slice(0, deps.BAN_INSIGHT_LIMIT);

      const sections = [
        createBanInsightSampleControl(champSelect, localMember),
        createBanInsightSection(`${deps.positionLabel(position)} lane opponents`, laneStats)
      ];
      if (plannedPickThreatSection) {
        sections.splice(1, 0, plannedPickThreatSection);
      }
      sections.push(createCollapsedBanInsightSection('Worst enemy picks', enemyStats));

      panel.replaceChildren(...sections);
    }

    function getBanInsightMinGames(): number {
      return deps.BAN_INSIGHT_SAMPLE_OPTIONS.includes(deps.getBanInsightMinGames()) ? deps.getBanInsightMinGames() : 5;
    }

    function createBanInsightSampleControl(champSelect: any, localMember: any): HTMLDivElement {
      const control = doc.createElement('div');
      control.className = 'ban-insight-control';

      const label = doc.createElement('label');
      label.className = 'ban-insight-sample-filter';

      const text = doc.createElement('span');
      text.textContent = 'Sample';

      const select = doc.createElement('select');
      select.setAttribute('aria-label', 'Ban insight sample filter');
      deps.BAN_INSIGHT_SAMPLE_OPTIONS.forEach((games: number) => {
        const option = doc.createElement('option');
        option.value = String(games);
        option.textContent = `${games}+ games`;
        select.append(option);
      });
      select.value = String(getBanInsightMinGames());
      select.addEventListener('change', () => {
        deps.setBanInsightMinGames(Number(select.value));
        deps.logDebug('Ban insight sample filter changed', { minGames: deps.getBanInsightMinGames() });
        renderBanInsights(true, champSelect, localMember);
      });

      label.append(text, select);
      control.append(label);
      return control;
    }

    function createPlannedPickBanThreatSection(champSelect: any, localMember: any, position: string, minGames: number): HTMLElement | null {
      const { plannedChampionId, statsList } = deps.getPlannedPickThreatStats({
        stats: deps.getMatchHistorySelfVsLaneOpponentStats().filter((stats: any) => (
          Number(stats.games || 0) >= minGames &&
          Number(stats.winRate || 0) < 0.5
        )),
        champSelect,
        localMember,
        limit: deps.BAN_INSIGHT_LIMIT
      });
      if (!plannedChampionId || !position) return null;

      const section = doc.createElement('section');
      section.className = 'ban-insight-section planned-pick-threat-section';

      const heading = doc.createElement('h4');
      heading.append(
        'Threats for your ',
        deps.createInlineChampionName(plannedChampionId, 'inline-champion-name heading-champion-name'),
        ` ${deps.positionLabel(position)}`
      );
      section.append(heading);

      if (!statsList.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = 'No losing same-role matchup history';
        section.append(empty);
        return section;
      }

      const list = doc.createElement('ol');
      statsList.forEach((stats: any) => {
        list.append(createPlannedPickBanThreatItem(stats));
      });
      section.append(list);
      return section;
    }

    function createPlannedPickBanThreatItem(stats: any): HTMLLIElement {
      const item = doc.createElement('li');

      const nameBlock = doc.createElement('span');
      nameBlock.className = 'ban-insight-name';
      nameBlock.append(deps.createInlineChampionName(stats.opponentChampionId));

      const detail = deps.createWinRateStatsElement(stats, { includeKda: true });

      item.append(nameBlock, detail);
      deps.appendLowSampleBadge(nameBlock, stats.games);

      return item;
    }

    function renderPickPoolInsights(visible: boolean, champSelect: any, localMember: any): void {
      const panel = renderInsightPanel(visible, 'pick-mode');
      if (!panel) return;

      const normalizedChampionPool = deps.normalizeChampionPool(deps.getChampionPool());
      deps.setChampionPool(normalizedChampionPool);
      const lane = deps.getChampionPoolLaneByPosition(localMember?.assignedPosition);
      const position = String(localMember?.assignedPosition || '').toUpperCase();
      const championIds = lane ? normalizedChampionPool[lane.id] || [] : [];
      const unavailableReasons = deps.collectUnavailableChampionReasons(champSelect);
      const candidates = championIds.map((championId: number) => {
        const stats = deps.getChampionRoleDisplayStats(championId, position);
        const unavailableReason = unavailableReasons.get(Number(championId)) || '';

        return {
          championId,
          stats,
          unavailableReason,
          available: !unavailableReason
        };
      });
      const sortedCandidates = deps.sortPickPoolCandidates(candidates, deps.RELIABLE_SAMPLE_GAMES);
      const visibleCandidates = sortedCandidates.slice(0, deps.PICK_POOL_CANDIDATE_LIMIT);

      const header = doc.createElement('section');
      header.className = 'pick-pool-header';

      const title = doc.createElement('h4');
      title.textContent = lane ? `Your ${lane.label} Pool` : 'Your Pool';

      const summary = doc.createElement('p');
      summary.textContent = championIds.length > 0
        ? `${visibleCandidates.length}/${championIds.length} candidates`
        : 'No champions registered for this role';

      header.append(title, summary);

      if (!visibleCandidates.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = lane ? 'ChampionPool is empty' : 'Assigned role is unknown';
        panel.replaceChildren(
          ...createMarkedOpponentInsightElements(champSelect, localMember),
          header,
          empty
        );
        return;
      }

      const list = doc.createElement('ol');
      list.className = 'pick-pool-list';
      visibleCandidates.forEach((candidate: any) => {
        list.append(createPickPoolCandidateItem(candidate, position));
      });

      panel.replaceChildren(
        ...createMarkedOpponentInsightElements(champSelect, localMember),
        header,
        list
      );
    }

    function renderMarkedOpponentPickInsights(visible: boolean, champSelect: any, localMember: any): void {
      const panel = renderInsightPanel(visible, 'pick-mode marked-opponent-mode');
      if (!panel) return;

      const insightElements = createMarkedOpponentInsightElements(champSelect, localMember);
      if (!insightElements.length) {
        renderInsightPanel(false);
        return;
      }

      panel.replaceChildren(...insightElements);
    }

    function createMarkedOpponentInsightElements(champSelect: any, localMember: any): HTMLElement[] {
      const opponentChampionId = getMarkedLaneOpponentChampionId(champSelect);
      const position = String(localMember?.assignedPosition || '').toUpperCase();
      if (!opponentChampionId || !position) return [];

      const statsList = deps.getBestIntoOpponentStats({
        stats: deps.getMatchHistorySelfVsLaneOpponentStats(),
        opponentChampionId,
        position,
        limit: 5
      });

      const section = doc.createElement('section');
      section.className = 'marked-opponent-insight';

      const header = doc.createElement('div');
      header.className = 'pick-pool-header';

      const title = doc.createElement('h4');
      title.append('Best into ', deps.createInlineChampionName(opponentChampionId, 'inline-champion-name heading-champion-name'));

      const summary = doc.createElement('p');
      summary.textContent = `${deps.positionLabel(position)} history`;

      header.append(title, summary);
      section.append(header);

      if (!statsList.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = 'No direct history';
        section.append(empty);
        return [section];
      }

      const list = doc.createElement('ol');
      list.className = 'pick-pool-list marked-opponent-list';
      statsList.forEach((stats: any) => {
        list.append(createMarkedOpponentPickItem(stats));
      });
      section.append(list);

      return [section];
    }

    function getMarkedLaneOpponentChampionId(champSelect: any): number | null {
      if (deps.getMarkedLaneOpponentCellId() === null) return null;

      const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
      const member = enemyTeam.find((enemy: any) => enemy.cellId === deps.getMarkedLaneOpponentCellId());
      const championId = Number(member?.championId || member?.championPickIntent) || 0;
      return championId > 0 ? championId : null;
    }

    function createMarkedOpponentPickItem(stats: any): HTMLLIElement {
      const item = doc.createElement('li');
      item.className = 'pick-pool-candidate marked-opponent-candidate';

      const name = deps.createInlineChampionName(stats.championId);

      const detail = deps.createWinRateStatsElement(stats, { includeGames: false, includeKda: true });
      item.append(name, detail);

      deps.appendLowSampleBadge(item, stats.games);

      return item;
    }

    function createPickPoolCandidateItem(candidate: any, position: string): HTMLLIElement {
      const item = doc.createElement('li');
      item.className = `pick-pool-candidate${candidate.available ? '' : ' unavailable'}`;

      const name = deps.createInlineChampionName(candidate.championId);

      const detail = createPickPoolCandidateStatsElement(candidate.stats, position);

      item.append(name, detail);

      if (candidate.unavailableReason) {
        const status = doc.createElement('em');
        status.textContent = candidate.unavailableReason;
        item.append(status);
      } else {
        deps.appendLowSampleBadge(item, candidate.stats?.games);
      }

      return item;
    }

    function createPickPoolCandidateStatsElement(stats: any, position: string): HTMLSpanElement {
      const container = doc.createElement('span');
      container.className = 'pick-pool-stats';

      if (!stats || !stats.games) {
        container.append(deps.createPickPoolStatChip('Games', `No ${deps.positionLabel(position)}`));
        return container;
      }

      const wins = Number(stats.wins || 0);
      const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
      [
        ['W-L', `${wins}-${losses}`],
        ['WR', deps.formatPercent(stats.winRate)],
        ['KDA', deps.formatAverageKda(stats)]
      ].forEach(([label, value]) => {
        container.append(deps.createPickPoolStatChip(label, value));
      });

      return container;
    }

    function createBanInsightSection(title: string, statsList: any[]): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'ban-insight-section';

      const heading = doc.createElement('h4');
      heading.textContent = title;
      section.append(heading);

      if (!statsList.length) {
        const empty = doc.createElement('p');
        empty.className = 'ban-insight-empty';
        empty.textContent = 'No match data';
        section.append(empty);
        return section;
      }

      const list = doc.createElement('ol');
      statsList.forEach((stats) => {
        list.append(createBanInsightItem(stats));
      });
      section.append(list);
      return section;
    }

    function createCollapsedBanInsightSection(title: string, statsList: any[]): HTMLDetailsElement {
      const details = doc.createElement('details');
      details.className = 'ban-insight-details';

      const summary = doc.createElement('summary');
      summary.textContent = title;
      details.append(summary);

      const section = createBanInsightSection(title, statsList);
      section.querySelector('h4')?.remove();
      details.append(section);
      return details;
    }

    function createBanInsightItem(stats: any): HTMLLIElement {
      const item = doc.createElement('li');

      const nameBlock = doc.createElement('span');
      nameBlock.className = 'ban-insight-name';
      nameBlock.append(deps.createInlineChampionName(stats.championId));

      const detail = deps.createWinRateStatsElement(stats);

      item.append(nameBlock, detail);
      deps.appendLowSampleBadge(nameBlock, stats.games);

      return item;
    }

    return {
      renderChampSelect,
      renderDraftAiAnalysis,
      resetDraftRecommendationState
    };
  }

  const api = { createDraftView };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiDraftView = api;
})(typeof window !== 'undefined' ? window : globalThis);
