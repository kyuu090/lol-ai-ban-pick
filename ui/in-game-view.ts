(function attachUiInGameView(root: UiRoot) {
  function createInGameView(deps: InGameViewDeps) {
    const elements = deps.elements;
    const doc = (deps.document || root.document) as Document;
    const t = (key: string): string => root.UiI18n?.translate(key) || key;
    const getDataDragonLocale = (): 'en_US' | 'ja_JP' | 'ko_KR' => root.UiI18n?.getDataDragonLocale() || 'en_US';
    const rendererLog = (root as any).lcuApi?.log;
    const statsApiHelpers = (root.UiChampionsView || {}) as any;
    const buildStatsApiChampionDetailsUrl = typeof statsApiHelpers.buildStatsApiChampionDetailsUrl === 'function'
      ? statsApiHelpers.buildStatsApiChampionDetailsUrl
      : (filters: any, baseUrl = 'https://db.banpick-ai.lol') => {
        const position = String(filters?.position || '').trim().toUpperCase();
        const championId = Number(filters?.championId) || 0;
        if (!position || !championId) {
          throw new Error('StatsAPI champion detail filters are required.');
        }
        const url = new URL(`/v1/stats/positions/${encodeURIComponent(position)}/champions/${championId}/details`, baseUrl);
        const opponentChampionId = Number(filters?.opponentChampionId) || 0;
        if (opponentChampionId > 0) {
          url.searchParams.set('opponentChampionId', String(opponentChampionId));
        }
        const keystoneId = Number(filters?.keystoneId) || 0;
        if (keystoneId > 0) {
          url.searchParams.set('keystoneId', String(keystoneId));
        }
        return url.toString();
      };
    const formatStatsApiErrorMessage = typeof statsApiHelpers.formatStatsApiErrorMessage === 'function'
      ? statsApiHelpers.formatStatsApiErrorMessage
      : (error: any) => String(error?.message || error || t('common.statsApiLoadFailed'));
    const normalizeRuneCatalog = typeof statsApiHelpers.normalizeStatsApiRuneCatalog === 'function'
      ? statsApiHelpers.normalizeStatsApiRuneCatalog
      : null;
    const buildRunesDataUrl = typeof statsApiHelpers.buildStatsApiRunesDataUrl === 'function'
      ? statsApiHelpers.buildStatsApiRunesDataUrl
      : null;
    const buildChampionSpellDataUrl = typeof statsApiHelpers.buildStatsApiChampionSpellDataUrl === 'function'
      ? statsApiHelpers.buildStatsApiChampionSpellDataUrl
      : (patch: string, alias: string, locale = 'en_US') => {
        const normalizedAlias = String(alias || '').trim();
        const normalizedPatch = String(patch || '').trim();
        const version = /^\d+\.\d+\.\d+$/.test(normalizedPatch)
          ? normalizedPatch
          : /^\d+\.\d+$/.test(normalizedPatch)
            ? `${normalizedPatch}.1`
            : 'latest';
        if (!normalizedAlias) {
          throw new Error('Champion alias is required.');
        }
        return `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion/${encodeURIComponent(normalizedAlias)}.json`;
      };
    const buildRuneIconUrl = typeof statsApiHelpers.buildStatsApiRuneIconUrl === 'function'
      ? statsApiHelpers.buildStatsApiRuneIconUrl
      : (iconPath: string) => iconPath ? `https://ddragon.leagueoflegends.com/cdn/img/${String(iconPath).replace(/^\/+/, '')}` : '';
    const fetchImpl = typeof deps.fetch === 'function'
      ? deps.fetch.bind(root)
      : typeof root.fetch === 'function'
        ? root.fetch.bind(root)
        : null;
    const recommendationSlots = {
      general: createRecommendationSlotState(),
      matchup: createRecommendationSlotState()
    };
    let dataDragonVersion = 'latest';
    let dataDragonVersionPromise: Promise<string> | null = null;
    let runeCatalog: any = null;
    let runeCatalogPromise: Promise<any> | null = null;
    const championSpellCatalogs = new Map<string, Record<string, { iconUrl: string; key: string; label: string; name: string }> | null>();
    const championSpellCatalogPromises = new Map<string, Promise<Record<string, { iconUrl: string; key: string; label: string; name: string }> | null>>();
    let activeRecommendationTab: 'general' | 'matchup' = 'general';
    let lastRecommendationContext: any = null;
    let resolveStatsOpponentRequestId = 0;

    function logDebug(message: string, details?: any): void {
      if (typeof rendererLog !== 'function') return;
      rendererLog('debug', message, details);
    }

    function createRecommendationSlotState() {
      return {
        data: null as any,
        error: '',
        queryKey: '',
        requestId: 0,
        status: 'idle' as 'idle' | 'loading' | 'ready' | 'error'
      };
    }

    function normalizePositiveId(value: unknown): number {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 0;
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

    function formatSkillLetter(skillId: unknown): string {
      const normalizedSkillId = String(skillId || '').trim();
      if (normalizedSkillId === '1') return 'Q';
      if (normalizedSkillId === '2') return 'W';
      if (normalizedSkillId === '3') return 'E';
      if (normalizedSkillId === '4') return 'R';
      return '-';
    }

    function getChampionAlias(championId: unknown): string {
      const numericChampionId = normalizePositiveId(championId);
      if (!numericChampionId) return '';
      const championsById = deps.getChampionsById?.() || {};
      const champion = championsById[numericChampionId] || championsById[String(numericChampionId)] || null;
      return String(champion?.alias || '').trim();
    }

    function normalizeChampionSpellCatalog(payload: any): Record<string, { iconUrl: string; key: string; label: string; name: string }> {
      const data = payload?.data || {};
      const championData = Object.values(data)[0] as any;
      const spells = Array.isArray(championData?.spells) ? championData.spells as any[] : [];
      const skillKeys = ['Q', 'W', 'E', 'R'];
      const version = /^\d+\.\d+\.\d+$/.test(String(dataDragonVersion || '').trim())
        ? String(dataDragonVersion).trim()
        : 'latest';
      return spells.reduce((acc: Record<string, { iconUrl: string; key: string; label: string; name: string }>, spell: any, index: number) => {
        const key = skillKeys[index];
        const imageFull = String(spell?.image?.full || '').trim();
        if (!key || !imageFull) return acc;
        acc[key] = {
          iconUrl: version === 'latest'
            ? `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/spell/${imageFull}`
            : `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${imageFull}`,
          key,
          label: key,
          name: String(spell?.name || key)
        };
        return acc;
      }, {} as Record<string, { iconUrl: string; key: string; label: string; name: string }>);
    }

    async function ensureDataDragonVersion(): Promise<string> {
      if (/^\d+\.\d+\.\d+$/.test(String(dataDragonVersion || '').trim())) {
        return dataDragonVersion;
      }
      if (dataDragonVersionPromise) {
        return dataDragonVersionPromise;
      }
      if (!fetchImpl) {
        return dataDragonVersion;
      }
      const versionPromise: Promise<string> = fetchImpl('https://ddragon.leagueoflegends.com/api/versions.json')
        .then((response: Response) => {
          if (!response.ok) {
            throw new Error(`Failed to load Data Dragon versions: ${response.status}`);
          }
          return response.json();
        })
        .then((versions: unknown) => {
          const nextVersion = Array.isArray(versions) ? String(versions[0] || '').trim() : '';
          if (nextVersion) {
            dataDragonVersion = nextVersion;
          }
          return dataDragonVersion;
        })
        .catch(() => dataDragonVersion)
        .finally(() => {
          dataDragonVersionPromise = null;
        });
      dataDragonVersionPromise = versionPromise;
      return versionPromise;
    }

    async function ensureRuneCatalog(): Promise<any | null> {
      if (runeCatalog) return runeCatalog;
      if (runeCatalogPromise) return runeCatalogPromise;
      if (!fetchImpl) return null;
      const version = await ensureDataDragonVersion();
      const locale = getDataDragonLocale();
      const runesUrl = buildRunesDataUrl ? buildRunesDataUrl(version, locale) : `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/runesReforged.json`;
      runeCatalogPromise = fetchImpl(runesUrl)
        .then((response: Response) => {
          if (!response.ok) {
            throw new Error(`Failed to load rune catalog: ${response.status}`);
          }
          return response.json();
        })
        .then((payload: unknown) => {
          runeCatalog = normalizeRuneCatalog ? normalizeRuneCatalog(payload) : payload;
          return runeCatalog;
        })
        .catch(() => {
          runeCatalog = null;
          return null;
        })
        .finally(() => {
          runeCatalogPromise = null;
        });
      return runeCatalogPromise;
    }

    function getKeystoneAsset(keystoneId: unknown): { iconPath?: string; name?: string } | null {
      const numericKeystoneId = normalizePositiveId(keystoneId);
      if (!numericKeystoneId || !runeCatalog?.perks) return null;
      return runeCatalog.perks[String(numericKeystoneId)] || null;
    }

    async function ensureChampionSpellCatalog(championId: unknown): Promise<Record<string, { iconUrl: string; key: string; label: string; name: string }> | null> {
      const numericChampionId = normalizePositiveId(championId);
      const alias = getChampionAlias(numericChampionId);
      if (!numericChampionId || !alias || !fetchImpl) {
        return null;
      }
      const version = await ensureDataDragonVersion();
      const catalogUrl = buildChampionSpellDataUrl(version, alias, getDataDragonLocale());
      if (championSpellCatalogs.has(catalogUrl)) {
        return championSpellCatalogs.get(catalogUrl) || null;
      }
      const existingPromise = championSpellCatalogPromises.get(catalogUrl);
      if (existingPromise) {
        return existingPromise;
      }

      const promise = fetchImpl(catalogUrl)
        .then((response: Response) => {
          if (!response.ok) {
            throw new Error(`Failed to load champion spell catalog: ${response.status}`);
          }
          return response.json();
        })
        .then((payload: unknown) => {
          const catalog = normalizeChampionSpellCatalog(payload);
          championSpellCatalogs.set(catalogUrl, catalog);
          return catalog;
        })
        .catch(() => {
          championSpellCatalogs.set(catalogUrl, null);
          return null;
        })
        .finally(() => {
          championSpellCatalogPromises.delete(catalogUrl);
        });
      championSpellCatalogPromises.set(catalogUrl, promise);
      return promise;
    }

    function getChampionSpellAsset(skillLetter: unknown, championId: unknown): { iconUrl: string; key: string; label: string; name: string } | null {
      const normalizedSkillLetter = String(skillLetter || '').trim().toUpperCase();
      const alias = getChampionAlias(championId);
      if (!normalizedSkillLetter || !alias) return null;
      const catalogUrl = buildChampionSpellDataUrl(dataDragonVersion, alias, getDataDragonLocale());
      const catalog = championSpellCatalogs.get(catalogUrl);
      return catalog?.[normalizedSkillLetter] || null;
    }

    function getItemIconUrl(itemId: unknown): string {
      const numericItemId = normalizePositiveId(itemId);
      if (!numericItemId) return '';
      const version = /^\d+\.\d+\.\d+$/.test(String(dataDragonVersion || '').trim())
        ? String(dataDragonVersion).trim()
        : '15.1.1';
      return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${numericItemId}.png`;
    }

    function resetRecommendationSlotState(slotState: any): void {
      slotState.requestId += 1;
      slotState.queryKey = '';
      slotState.status = 'idle';
      slotState.error = '';
      slotState.data = null;
    }

    function buildRecommendationUrl(championId: number, position: string, opponentChampionId = 0, keystoneId = 0): string {
      return buildStatsApiChampionDetailsUrl({
        championId,
        keystoneId,
        position,
        opponentChampionId
      });
    }

    function createRecommendationContextKey(context: any): string {
      if (!context) return '';
      return JSON.stringify({
        championId: normalizePositiveId(context?.championId),
        keystoneId: normalizePositiveId(context?.keystoneId),
        opponentChampionId: normalizePositiveId(context?.opponentChampionId),
        position: String(context?.position || '').trim().toUpperCase()
      });
    }

    function getRecommendationContext(context: any): { championId: number; keystoneId: number; position: string; opponentChampionId: number } | null {
      const championId = normalizePositiveId(context?.championId);
      const keystoneId = normalizePositiveId(context?.keystoneId);
      const position = String(context?.position || '').trim().toUpperCase();
      if (!championId || !position) return null;
      return {
        championId,
        keystoneId,
        position,
        opponentChampionId: normalizePositiveId(context?.opponentChampionId)
      };
    }

    function createRecommendationSummaryChip(label: string, value: string): HTMLElement {
      const chip = doc.createElement('span');
      chip.className = 'stats-api-summary-chip';
      chip.append(
        createText('stats-api-summary-chip-label', label, 'small'),
        createText('stats-api-summary-chip-value', value, 'strong')
      );
      return chip;
    }

    function createRecommendationOptionMeta(entry: any, options: { hidePickRate?: boolean } = {}): HTMLElement {
      const meta = doc.createElement('div');
      meta.className = 'stats-api-option-meta';
      if (!options.hidePickRate) {
        meta.append(createRecommendationSummaryChip('PR', formatRate(entry?.pickRate)));
      }
      meta.append(
        createRecommendationSummaryChip('WR', formatRate(entry?.winRate)),
        createRecommendationSummaryChip('Games', formatGames(entry?.games))
      );
      return meta;
    }

    function createRecommendationModeSummary(slotKey: 'general' | 'matchup', entry: any): HTMLElement {
      const summary = doc.createElement('div');
      summary.className = 'stats-api-option-meta in-game-recommend-summary';
      summary.append(
        createRecommendationSummaryChip('Mode', slotKey === 'general' ? 'All' : 'Vs Lane'),
        createRecommendationSummaryChip('WR', formatRate(entry?.winRate)),
        createRecommendationSummaryChip('Games', formatGames(entry?.games))
      );
      return summary;
    }

    function createRecommendationTabMeta(slotKey: 'general' | 'matchup', context: any): HTMLElement {
      const meta = doc.createElement('span');
      meta.className = 'in-game-recommend-tab-meta';
      const entryState = resolveRecommendationEntry(slotKey, context);
      const winRateText = entryState.state === 'ready'
        ? formatRate(entryState.activeKeystone?.winRate)
        : '-';
      const gamesText = entryState.state === 'ready'
        ? formatGames(entryState.activeKeystone?.games)
        : '-';
      meta.append(
        createText('in-game-recommend-tab-metric', `WR ${winRateText}`, 'small'),
        createText('in-game-recommend-tab-metric', `G ${gamesText}`, 'small')
      );
      return meta;
    }

    function getRecommendationTabLabel(slotKey: 'general' | 'matchup', context: any): string {
      if (slotKey === 'general') {
        return 'vs All';
      }
      if (context?.opponentChampionId) {
        return `vs ${deps.championLabel(context.opponentChampionId)}`;
      }
      return 'vs -';
    }

    function createRecommendationItemToken(itemId: unknown, options: { iconOnly?: boolean } = {}): HTMLElement {
      const numericItemId = normalizePositiveId(itemId);
      const token = doc.createElement('div');
      token.className = `stats-api-item-token${options.iconOnly ? ' icon-only' : ''}`;
      token.title = numericItemId ? `Item #${numericItemId}` : 'Item -';
      if (numericItemId) {
        const image = doc.createElement('img');
        image.alt = `Item ${numericItemId}`;
        image.className = 'stats-api-item-icon';
        image.loading = 'lazy';
        image.src = getItemIconUrl(numericItemId);
        token.append(image);
      }
      if (!options.iconOnly) {
        token.append(createText('stats-api-item-id', `#${numericItemId || '-'}`));
      }
      return token;
    }

    function createRecommendationSkillTag(skillLetter: string): HTMLElement {
      return createText(
        `stats-api-tag stats-api-skill-tag stats-api-skill-priority-tag skill-${String(skillLetter || '').toLowerCase()}`,
        skillLetter || '-'
      );
    }

    function createRecommendationItemSetRow(title: string, itemIds: unknown[]): HTMLElement {
      return createRecommendationItemSetRowWithMeta(title, itemIds, null);
    }

    function createRecommendationItemSetRowWithMeta(title: string, itemIds: unknown[], entry: any): HTMLElement {
      const row = doc.createElement('article');
      row.className = 'stats-api-item-set-row';
      const body = doc.createElement('div');
      body.className = 'stats-api-item-set-body';
      const list = doc.createElement('div');
      list.className = 'stats-api-item-token-list';
      const ids = (Array.isArray(itemIds) ? itemIds : []).map((itemId) => normalizePositiveId(itemId)).filter(Boolean);
      if (ids.length) {
        list.append(...ids.map((itemId) => createRecommendationItemToken(itemId, { iconOnly: true })));
      } else {
        list.append(createText('stats-api-detail-empty', t('inGame.noCandidates'), 'span'));
      }
      body.append(createText('stats-api-item-set-title', title, 'h4'), list);
      row.append(body);
      if (entry) {
        row.append(createRecommendationOptionMeta(entry, { hidePickRate: true }));
      }
      return row;
    }

    function createRecommendationOpeningRow(entry: any, championId: unknown): HTMLElement {
      const row = doc.createElement('div');
      row.className = 'stats-api-skill-order-row';
      const table = doc.createElement('div');
      table.className = 'stats-api-skill-opening-table';
      const skillOrder = Array.isArray(entry?.skillOrder) ? entry.skillOrder : [];
      skillOrder.forEach((_: unknown, level: number) => {
        table.append(createText('stats-api-skill-opening-level', `Lv${level + 1}`));
      });
      if (skillOrder.length) {
        skillOrder.forEach((skillId: unknown) => {
          const skillLetter = formatSkillLetter(skillId);
          const cell = doc.createElement('div');
          cell.className = 'stats-api-skill-opening-skill';
          const skillAsset = getChampionSpellAsset(skillLetter, championId);
          if (skillAsset?.iconUrl) {
            const image = doc.createElement('img');
            image.alt = '';
            image.className = 'stats-api-skill-icon';
            image.loading = 'lazy';
            image.src = skillAsset.iconUrl;
            image.title = skillAsset.name;
            cell.append(image);
          }
          cell.append(createText(`stats-api-skill-letter skill-${String(skillLetter || '').toLowerCase()}`, skillLetter));
          table.append(cell);
        });
      } else {
        table.append(createText('stats-api-detail-empty', t('inGame.noCandidates'), 'span'));
      }
      row.append(table);
      if (entry) {
        row.append(createRecommendationOptionMeta(entry, { hidePickRate: true }));
      }
      return row;
    }

    function createRecommendationPriorityRow(entry: any, championId: unknown): HTMLElement {
      const row = doc.createElement('div');
      row.className = 'stats-api-skill-order-row';
      const priority = doc.createElement('div');
      priority.className = 'stats-api-skill-priority';
      const skillLetters = [
        formatSkillLetter(entry?.firstMaxSkill),
        formatSkillLetter(entry?.secondMaxSkill),
        formatSkillLetter(entry?.thirdMaxSkill)
      ].filter((skillLetter) => skillLetter && skillLetter !== '-');
      if (skillLetters.length) {
        skillLetters.forEach((skillLetter, index) => {
          if (index > 0) {
            priority.append(createText('stats-api-skill-priority-separator', '>'));
          }
          const tag = createRecommendationSkillTag(skillLetter);
          const skillAsset = getChampionSpellAsset(skillLetter, championId);
          if (skillAsset?.iconUrl) {
            const image = doc.createElement('img');
            image.alt = '';
            image.className = 'stats-api-skill-icon';
            image.loading = 'lazy';
            image.src = skillAsset.iconUrl;
            image.title = skillAsset.name;
            tag.prepend(image);
          }
          priority.append(tag);
        });
      } else {
        priority.append(createText('stats-api-detail-empty', t('inGame.noCandidates'), 'span'));
      }
      row.append(priority);
      if (entry) {
        row.append(createRecommendationOptionMeta(entry, { hidePickRate: true }));
      }
      return row;
    }

    function createRecommendationSection(title: string, rows: HTMLElement[]): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'stats-api-detail-subsection stats-api-skill-section';
      section.append(createText('stats-api-detail-subtitle', title, 'h4'));
      if (rows.length) {
        section.append(...rows);
      } else {
        section.append(createText('stats-api-detail-empty', t('inGame.noCandidates'), 'p'));
      }
      return section;
    }

    function createRecommendationBuildSection(title: string, rows: HTMLElement[]): HTMLElement {
      const section = doc.createElement('section');
      section.className = 'stats-api-detail-subsection stats-api-build-stage';
      section.append(createText('stats-api-detail-subtitle', title, 'h4'));
      if (rows.length) {
        const list = doc.createElement('div');
        list.className = 'stats-api-item-set-list';
        list.append(...rows);
        section.append(list);
      } else {
        section.append(createText('stats-api-detail-empty', t('inGame.noCandidates'), 'p'));
      }
      return section;
    }

    function createRecommendationDetailCard(title: string, bodyChildren: HTMLElement[], classNames: string[] = []): HTMLElement {
      const card = doc.createElement('section');
      card.className = ['stats-api-detail-card', ...classNames].join(' ');
      const body = doc.createElement('div');
      body.className = 'stats-api-detail-card-body';
      body.append(...bodyChildren);
      if (title) {
        const header = doc.createElement('div');
        header.className = 'stats-api-detail-card-header';
        header.append(createText('stats-api-detail-card-title', title, 'h3'));
        card.append(header);
      }
      card.append(body);
      return card;
    }

    function createRecommendationItemRowsFromSets(entries: any): HTMLElement[] {
      return (Array.isArray(entries) ? entries : []).map((entry) => createRecommendationItemSetRowWithMeta('', entry?.itemIds, entry));
    }

    function createRecommendationSingleItemRows(entries: any): HTMLElement[] {
      return (Array.isArray(entries) ? entries : []).map((entry) => createRecommendationItemSetRowWithMeta('', [entry?.itemId], entry));
    }

    function resolveRecommendationEntry(slotKey: 'general' | 'matchup', context: any): {
      state: 'empty' | 'waiting' | 'loading' | 'error' | 'ready';
      activeKeystone: any;
      message: string;
    } {
      if (!context) {
        return {
          state: 'empty',
          activeKeystone: null,
          message: t('inGame.recommendationPending')
        };
      }

      if (slotKey === 'matchup' && !context?.opponentChampionId) {
        return {
          state: 'waiting',
          activeKeystone: null,
          message: t('inGame.matchupPending')
        };
      }

      const slotState = recommendationSlots[slotKey];
      if (slotState.status === 'loading') {
        return {
          state: 'loading',
          activeKeystone: null,
          message: t('inGame.loadingRecommendations')
        };
      }

      if (slotState.status === 'error') {
        return {
          state: 'error',
          activeKeystone: null,
          message: slotState.error || t('inGame.recommendationsUnavailable')
        };
      }

      const keystones = Array.isArray(slotState.data?.keystones) ? slotState.data.keystones : [];
      const activeKeystone = keystones[0] || null;
      if (!activeKeystone) {
        return {
          state: 'empty',
          activeKeystone: null,
          message: t('inGame.noRecommendationData')
        };
      }

      return {
        state: 'ready',
        activeKeystone,
        message: ''
      };
    }

    function createRecommendationTabBar(context: any): HTMLElement {
      const tabList = doc.createElement('div');
      tabList.className = 'in-game-recommend-tab-list';
      tabList.setAttribute('role', 'tablist');
      tabList.setAttribute('aria-label', t('inGame.recommendationTabs'));

      const entries: Array<{ key: 'general' | 'matchup'; disabled?: boolean }> = [
        { key: 'general' },
        { key: 'matchup', disabled: !context?.opponentChampionId }
      ];

      entries.forEach((entry) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = `in-game-recommend-tab${activeRecommendationTab === entry.key ? ' active' : ''}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(activeRecommendationTab === entry.key));
        button.disabled = Boolean(entry.disabled);
        button.append(
          createText('in-game-recommend-tab-label', getRecommendationTabLabel(entry.key, context)),
          createRecommendationTabMeta(entry.key, context)
        );
        button.addEventListener('click', () => {
          if (entry.disabled) return;
          activeRecommendationTab = entry.key;
          renderInGameRecommendations(lastRecommendationContext);
        });
        tabList.append(button);
      });

      return tabList;
    }

    function createRecommendationItemCard(slotKey: 'general' | 'matchup', context: any): HTMLElement {
      const card = doc.createElement('section');
      card.className = `in-game-recommend-card ${slotKey}`;

      const entryState = resolveRecommendationEntry(slotKey, context);
      if (entryState.state !== 'ready') {
        card.append(createText('stats-api-detail-empty', entryState.message, 'p'));
        return card;
      }

      const activeKeystone = entryState.activeKeystone;
      const buildCard = createRecommendationDetailCard('', [
        createRecommendationBuildSection('Start', createRecommendationItemRowsFromSets(activeKeystone?.startingItems)),
        createRecommendationBuildSection('Boots', createRecommendationSingleItemRows(activeKeystone?.boots)),
        createRecommendationBuildSection('1st+2nd', createRecommendationItemRowsFromSets(activeKeystone?.firstSecondCoreItems)),
        createRecommendationBuildSection('3rd', createRecommendationSingleItemRows(activeKeystone?.thirdItems)),
        createRecommendationBuildSection('4th', createRecommendationSingleItemRows(activeKeystone?.fourthItems)),
        createRecommendationBuildSection('5th', createRecommendationSingleItemRows(activeKeystone?.fifthItems))
      ], ['stats-api-detail-card-build', 'in-game-stats-api-card']);
      card.append(buildCard);
      return card;
    }

    function createRecommendationSkillPanel(slotKey: 'general' | 'matchup', context: any): HTMLElement {
      const panel = doc.createElement('section');
      panel.className = `in-game-skill-panel ${slotKey}`;

      const entryState = resolveRecommendationEntry(slotKey, context);
      if (entryState.state !== 'ready') {
        panel.append(createText('in-game-empty-note', entryState.message, 'p'));
        return panel;
      }

      const activeKeystone = entryState.activeKeystone;
      const skillBody = doc.createElement('div');
      skillBody.className = 'in-game-skill-content';
      skillBody.append(
        createRecommendationSection(
          'Lv1-6',
          (Array.isArray(activeKeystone?.skillOpenings) ? activeKeystone.skillOpenings : []).map((entry: any) => createRecommendationOpeningRow(entry, context?.championId))
        ),
        createRecommendationSection(
          t('inGame.skillPriority'),
          (Array.isArray(activeKeystone?.skillPriorities) ? activeKeystone.skillPriorities : []).map((entry: any) => createRecommendationPriorityRow(entry, context?.championId))
        )
      );
      panel.append(skillBody);
      return panel;
    }

    function renderInGameRecommendations(context: any): void {
      const panel = elements.inGameRecommendations;
      if (!panel) return;

      const recommendationContext = getRecommendationContext(context);
      panel.replaceChildren();

      if (!recommendationContext) {
        panel.append(createText('in-game-empty-note', t('inGame.recommendationPending'), 'p'));
        return;
      }

      if (activeRecommendationTab === 'matchup' && !recommendationContext.opponentChampionId) {
        activeRecommendationTab = 'general';
      }

      panel.append(
        createRecommendationTabBar(recommendationContext),
        createRecommendationItemCard(activeRecommendationTab, recommendationContext)
      );
    }

    function renderInGameSkillOrder(context: any): void {
      const panel = elements.inGameSkillOrder;
      if (!panel) return;

      const recommendationContext = getRecommendationContext(context);
      panel.replaceChildren();

      if (!recommendationContext) {
        panel.append(createText('in-game-empty-note', t('inGame.skillPending'), 'p'));
        return;
      }

      panel.append(createRecommendationSkillPanel(activeRecommendationTab, recommendationContext));
    }

    async function fetchRecommendationSlot(slotKey: 'general' | 'matchup', url: string): Promise<void> {
      const slotState = recommendationSlots[slotKey];
      if (!deps.requestStatsApiJson) {
        slotState.status = 'error';
        slotState.error = t('common.statsApiUnavailable');
        slotState.data = null;
        renderInGameRecommendations(lastRecommendationContext);
        renderInGameSkillOrder(lastRecommendationContext);
        return;
      }

      if (slotState.queryKey === url && (slotState.status === 'loading' || slotState.status === 'ready')) {
        return;
      }

      slotState.queryKey = url;
      slotState.status = 'loading';
      slotState.error = '';
      slotState.data = null;
      const requestId = ++slotState.requestId;
      logDebug('In-game recommendation request started', {
        slotKey,
        requestId,
        url,
        context: lastRecommendationContext
      });
      renderInGameRecommendations(lastRecommendationContext);
      renderInGameSkillOrder(lastRecommendationContext);

      try {
        const response = await deps.requestStatsApiJson(url);
        if (requestId !== slotState.requestId || slotState.queryKey !== url) return;
        slotState.data = (response as any)?.data || null;
        slotState.status = 'ready';
        const returnedKeystones = Array.isArray(slotState.data?.keystones)
          ? slotState.data.keystones.map((entry: any) => normalizePositiveId(entry?.keystoneId)).filter(Boolean)
          : [];
        logDebug('In-game recommendation request completed', {
          slotKey,
          requestId,
          url,
          context: lastRecommendationContext,
          returnedKeystones,
          keystoneCount: returnedKeystones.length
        });
        renderInGameRecommendations(lastRecommendationContext);
        renderInGameSkillOrder(lastRecommendationContext);
      } catch (error: any) {
        if (requestId !== slotState.requestId || slotState.queryKey !== url) return;
        slotState.status = 'error';
        slotState.error = formatStatsApiErrorMessage(error);
        slotState.data = null;
        logDebug('In-game recommendation request failed', {
          slotKey,
          requestId,
          url,
          context: lastRecommendationContext,
          error: String(error?.message || error || '')
        });
        renderInGameRecommendations(lastRecommendationContext);
        renderInGameSkillOrder(lastRecommendationContext);
      }
    }

    function refreshInGameRecommendations(context: any): void {
      const recommendationContext = getRecommendationContext(context);
      lastRecommendationContext = recommendationContext;
      logDebug('In-game recommendation context resolved', {
        sourceContext: context,
        recommendationContext
      });

      if (!recommendationContext) {
        resetRecommendationSlotState(recommendationSlots.general);
        resetRecommendationSlotState(recommendationSlots.matchup);
        renderInGameRecommendations(null);
        renderInGameSkillOrder(null);
        return;
      }

      renderInGameRecommendations(recommendationContext);
      renderInGameSkillOrder(recommendationContext);
      void ensureChampionSpellCatalog(recommendationContext.championId).then(() => {
        if (lastRecommendationContext?.championId !== recommendationContext.championId) return;
        renderInGameRecommendations(lastRecommendationContext);
        renderInGameSkillOrder(lastRecommendationContext);
      });
      void fetchRecommendationSlot(
        'general',
        buildRecommendationUrl(
          recommendationContext.championId,
          recommendationContext.position,
          0,
          recommendationContext.keystoneId
        )
      );

      if (!recommendationContext.opponentChampionId) {
        resetRecommendationSlotState(recommendationSlots.matchup);
        renderInGameRecommendations(recommendationContext);
        renderInGameSkillOrder(recommendationContext);
        return;
      }

      void fetchRecommendationSlot(
        'matchup',
        buildRecommendationUrl(
          recommendationContext.championId,
          recommendationContext.position,
          recommendationContext.opponentChampionId,
          recommendationContext.keystoneId
        )
      );
    }

    async function refreshResolvedInGameOpponent(context: any): Promise<void> {
      if (typeof deps.resolveInGameStatsOpponent !== 'function') return;

      const baseContext = getRecommendationContext(context);
      if (!baseContext) return;

      const requestId = ++resolveStatsOpponentRequestId;
      try {
        const resolved = await deps.resolveInGameStatsOpponent();
        if (requestId !== resolveStatsOpponentRequestId) return;

        const resolvedOpponentChampionId = normalizePositiveId((resolved as any)?.opponentChampionId);
        const nextContext = {
          ...context,
          opponentChampionId: resolvedOpponentChampionId || normalizePositiveId(context?.opponentChampionId)
        };
        const nextRecommendationContext = getRecommendationContext(nextContext);
        if (!nextRecommendationContext) return;

        if (createRecommendationContextKey(nextRecommendationContext) === createRecommendationContextKey(lastRecommendationContext)) {
          return;
        }

        logDebug('In-game stats opponent resolved', {
          resolved,
          previousContext: baseContext,
          nextContext: nextRecommendationContext
        });
        refreshInGameRecommendations(nextContext);
      } catch (error: any) {
        if (requestId !== resolveStatsOpponentRequestId) return;
        logDebug('In-game stats opponent resolution failed', {
          context: baseContext,
          error: String(error?.message || error || '')
        });
      }
    }

    function renderInGame(state: any): void {
      const context = deps.createInGameContext({
        champSelect: deps.getLastChampSelectSnapshot(),
        perksCurrentPage: deps.getPerksCurrentPage?.(),
        summonerName: deps.getSummonerName(state.summoner),
        matchupStats: deps.getMatchHistorySelfVsLaneOpponentStats()
      });

      renderInGameSelfCard(context);
      void ensureDataDragonVersion().then(() => ensureRuneCatalog()).then(() => {
        renderInGameSelfCard(context);
      });
      refreshInGameRecommendations(context);
      void refreshResolvedInGameOpponent(context);
      renderInGameLaneMatchupAnalysis(state.laneMatchupAnalysis);
      renderInGameFinalCompositionAnalysis();
    }

    function renderInGameSelfCard({ championId, keystoneId, position, summonerName }: { championId: number; keystoneId?: number; position: string; summonerName: string }): void {
      elements.inGameSelfPortrait.replaceChildren();

      if (championId > 0) {
        const image = doc.createElement('img');
        image.alt = deps.championLabel(championId);
        deps.loadChampionIcon(image, championId);
        elements.inGameSelfPortrait.append(image);
      } else {
        elements.inGameSelfPortrait.textContent = '?';
      }

      elements.inGameChampionName.textContent = championId > 0 ? deps.championLabel(championId) : t('inGame.title');
      elements.inGameChampionDetail.textContent = championId > 0
        ? `${deps.positionLabel(position)} / ${summonerName || 'Summoner'}`
        : t('inGame.pickMemo');

      renderInGameKeystone(keystoneId);

      const stats = championId > 0 ? deps.getChampionRoleDisplayStats(championId, position) : null;
      elements.inGameSelfStats.replaceChildren();
      elements.inGameSelfStats.append(createInGameStatsSummary(stats, position));
    }

    function renderInGameKeystone(keystoneId: unknown): void {
      const container = elements.inGameKeystone;
      if (!container) return;
      container.replaceChildren();

      const numericKeystoneId = normalizePositiveId(keystoneId);
      if (!numericKeystoneId) return;

      const token = doc.createElement('div');
      token.className = 'stats-api-rune-token in-game-keystone-chip';
      const asset = getKeystoneAsset(numericKeystoneId);
      const iconUrl = buildRuneIconUrl(String(asset?.iconPath || ''));
      if (iconUrl) {
        const image = doc.createElement('img');
        image.alt = '';
        image.className = 'stats-api-rune-icon';
        image.loading = 'lazy';
        image.src = iconUrl;
        token.append(image);
      }
      token.append(createText('stats-api-rune-token-label', String(asset?.name || `Keystone ${numericKeystoneId}`)));
      container.append(token);
    }

    function createInGameStatsSummary(stats: any, position: string): HTMLDivElement {
      const container = doc.createElement('div');
      container.className = 'in-game-self-stats';

      if (!stats || !stats.games) {
        container.append(deps.createPickPoolStatChip('Games', `No ${deps.positionLabel(position)}`));
        container.append(deps.createPickPoolStatChip('Focus', 'Fresh run'));
        return container;
      }

      const wins = Number(stats.wins || 0);
      const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
      [
        ['Games', `${stats.games}`],
        ['W-L', `${wins}-${losses}`],
        ['WR', deps.formatPercent(stats.winRate)],
        ['KDA', deps.formatAverageKda(stats)]
      ].forEach(([label, value]) => {
        container.append(deps.createPickPoolStatChip(label, value));
      });

      return container;
    }

    function renderInGameFinalCompositionAnalysis(): void {
      const panel = elements.inGameFinalCompositionAnalysis;
      if (!panel) return;

      const status = deps.getFinalCompositionAnalysisStatus();
      const notes = deps.getFinalCompositionAnalysisNotes();
      const error = deps.getFinalCompositionAnalysisError();

      panel.replaceChildren();

      const header = doc.createElement('div');
      header.className = 'in-game-ai-analysis-header';
      header.append(createInGameAiHeaderTitle('AI Analysis'));
      panel.append(header);

      if (status === 'requesting') {
        panel.append(createDraftAiAnalysisStatus(t('inGame.final.loading')));
        return;
      }

      if (status === 'error') {
        panel.append(createDraftAiAnalysisStatus(error || t('inGame.final.unavailable')));
        return;
      }

      if (status !== 'ready') {
        panel.append(createDraftAiAnalysisStatus(t('inGame.final.waiting')));
        return;
      }

      if (!notes.length) {
        panel.append(createDraftAiAnalysisStatus(t('inGame.final.unavailable')));
        return;
      }

      const list = doc.createElement('div');
      list.className = 'in-game-ai-analysis-notes';
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

    function renderInGameLaneMatchupAnalysis(analysis: any): void {
      const panel = elements.inGameLaneMatchupAnalysis;
      if (!panel) return;

      panel.replaceChildren();

      const header = doc.createElement('div');
      header.className = 'in-game-ai-analysis-header';

      const status = analysis?.status || 'idle';
      const response = analysis?.response || {};
      header.append(createInGameAiHeaderTitle('AI Matchup'));
      panel.append(header);

      if (status === 'requesting') {
        panel.append(createDraftAiAnalysisStatus(t('inGame.lane.loading')));
        return;
      }

      if (status === 'error') {
        panel.append(createDraftAiAnalysisStatus(analysis?.error || t('inGame.lane.unavailable')));
        return;
      }

      if (status !== 'ready') {
        panel.append(createDraftAiAnalysisStatus(t('inGame.lane.waiting')));
        return;
      }

      const request = analysis?.request?.payload || {};
      const summary = response.laneSummary || {};
      const detail = normalizeLaneMatchupDetail(summary.detail);

      const goalCard = createLaneMatchupGoalCard({
        goal: summary.goal,
        championIds: analysis?.request?.enemyChampionIds,
        championName: String(request.enemyChampionName || '').trim(),
        difficulty: response.difficulty,
        laneStyle: response.laneStyle
      });
      if (goalCard) {
        panel.append(goalCard);
      }

      const detailCard = createLaneMatchupDetailCard(detail);
      if (detailCard) {
        panel.append(detailCard);
      }
    }

    function createLaneMatchupGoalCard({ goal, championIds, championName, difficulty, laneStyle }: any): HTMLElement | null {
      if (!hasLaneMatchupRichText(goal)) return null;

      const card = doc.createElement('article');
      card.className = 'draft-ai-analysis-note lane-matchup-goal';

      const header = doc.createElement('div');
      header.className = 'lane-matchup-card-header';

      const title = doc.createElement('strong');
      title.textContent = 'Lane Plan';

      const badges = doc.createElement('div');
      badges.className = 'lane-matchup-card-badges';
      [
        ['Difficulty', difficulty],
        ['Style', laneStyle]
      ].forEach(([label, value]) => {
        const badge = createLaneMatchupBadge(label, value);
        if (badge) badges.append(badge);
      });
      header.append(title);
      if (badges.children.length) {
        header.append(badges);
      }

      const body = doc.createElement('p');
      body.className = 'lane-matchup-goal-text';
      body.append(createLaneMatchupOpponentVisual({ championIds, championName }));
      body.append(doc.createTextNode(' '), createLaneMatchupRichText(goal));

      card.append(header, body);
      return card;
    }

    function createLaneMatchupDetailCard(detail: any): HTMLElement | null {
      const items = (Array.isArray(detail) ? detail : [])
        .filter(hasLaneMatchupRichText)
        .slice(0, 3);
      if (!items.length) return null;

      const card = doc.createElement('article');
      card.className = 'draft-ai-analysis-note lane-matchup-detail';

      const title = doc.createElement('strong');
      title.textContent = 'Detail';

      const list = doc.createElement('ul');
      list.className = 'lane-matchup-detail-list';
      items.forEach((richText) => {
        const item = doc.createElement('li');
        item.append(createLaneMatchupRichText(richText));
        list.append(item);
      });

      card.append(title, list);
      return card;
    }

    function normalizeLaneMatchupDetail(detail: any): any[] {
      return (Array.isArray(detail) ? detail : [])
        .map(normalizeLaneMatchupDetailItem)
        .filter(hasLaneMatchupRichText);
    }

    function normalizeLaneMatchupDetailItem(item: any): any {
      if (Array.isArray(item)) {
        return item.filter(isLaneMatchupRichTextToken);
      }

      if (item && typeof item === 'object') {
        const text = String(item.text || item.body || item.description || item.detail || '').trim();
        return isLaneMatchupStructuralFragment(text) ? '' : text;
      }

      const text = String(item || '').trim();
      return isLaneMatchupStructuralFragment(text) ? '' : text;
    }

    function isLaneMatchupRichTextToken(token: any): boolean {
      if (!token || typeof token !== 'object') return false;
      if (token.type === 'text') return !isLaneMatchupStructuralFragment(token.text);
      if (token.type === 'champion') return String(token.championName || '').trim().length > 0;
      return false;
    }

    function isLaneMatchupStructuralFragment(value: unknown): boolean {
      const text = String(value || '').trim();
      if (!text) return true;
      if (/^[{}\[\],]+$/.test(text)) return true;
      if (/^"?[A-Za-z0-9_-]+"?\s*:\s*[{\[]?$/.test(text)) return true;
      return false;
    }

    function createLaneMatchupBadge(label: string, value: unknown): HTMLSpanElement | null {
      const text = String(value || '').trim();
      if (!text) return null;

      const badge = doc.createElement('span');
      badge.className = 'lane-matchup-badge';

      const badgeLabel = doc.createElement('small');
      badgeLabel.textContent = label;

      const badgeValue = doc.createElement('b');
      badgeValue.textContent = text;

      badge.append(badgeLabel, badgeValue);
      return badge;
    }

    function hasLaneMatchupRichText(value: any): boolean {
      if (Array.isArray(value)) {
        return value.some(isLaneMatchupRichTextToken);
      }

      return !isLaneMatchupStructuralFragment(value);
    }

    function createLaneMatchupRichText(value: any): DocumentFragment {
      const fragment = doc.createDocumentFragment();

      if (!Array.isArray(value)) {
        fragment.append(doc.createTextNode(String(value || '').trim()));
        return fragment;
      }

      value.forEach((token) => {
        if (!token || typeof token !== 'object') return;

        if (token.type === 'text') {
          fragment.append(doc.createTextNode(String(token.text || '')));
          return;
        }

        if (token.type === 'champion') {
          const champion = createLaneMatchupInlineChampion(token);
          if (champion) fragment.append(champion);
        }
      });

      return fragment;
    }

    function createLaneMatchupInlineChampion(token: any): HTMLSpanElement | null {
      const championName = String(token?.championName || '').trim();
      if (!championName) return null;

      const championId = Number(token.championId);
      const container = doc.createElement('span');
      container.className = 'lane-matchup-inline-champion';
      container.title = championName;

      if (Number.isInteger(championId) && championId > 0) {
        const image = doc.createElement('img');
        image.alt = championName;
        image.title = deps.championTitle(championId);
        image.className = 'lane-matchup-inline-champion-icon';
        deps.loadChampionIconEager(image, championId);
        container.append(image);
      }

      const label = doc.createElement('span');
      label.textContent = championName;
      container.append(label);
      return container;
    }

    function createLaneMatchupOpponentVisual({ championIds, championName }: any): HTMLSpanElement {
      const container = doc.createElement('span');
      container.className = 'lane-matchup-title-opponent';
      container.title = championName ? `vs ${championName}` : t('inGame.opponent');

      const label = doc.createElement('span');
      label.textContent = 'vs';
      container.append(label);

      const ids = (Array.isArray(championIds) ? championIds : [])
        .map((championId) => Number(championId))
        .filter((championId) => Number.isInteger(championId) && championId > 0)
        .slice(0, 2);

      if (!ids.length) {
        const fallback = doc.createElement('span');
        fallback.textContent = championName || t('inGame.opponent');
        container.append(fallback);
        return container;
      }

      ids.forEach((championId) => {
        const image = doc.createElement('img');
        image.alt = deps.championLabel(championId);
        image.title = deps.championTitle(championId);
        image.className = 'lane-matchup-title-opponent-icon';
        deps.loadChampionIconEager(image, championId);
        container.append(image);
      });

      return container;
    }

    function createInGameAiHeaderTitle(text: string): HTMLParagraphElement {
      const title = doc.createElement('p');
      title.className = 'eyebrow';
      title.textContent = text;
      return title;
    }

    function createDraftAiAnalysisStatus(text: string): HTMLParagraphElement {
      const message = doc.createElement('p');
      message.className = 'draft-ai-analysis-status';
      message.textContent = text;
      return message;
    }

    return {
      hasLaneMatchupRichText,
      normalizeLaneMatchupDetail,
      renderInGame,
      renderInGameFinalCompositionAnalysis,
      renderInGameLaneMatchupAnalysis
    };
  }

  const api = { createInGameView };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiInGameView = api;
})(typeof window !== 'undefined' ? window : globalThis);
