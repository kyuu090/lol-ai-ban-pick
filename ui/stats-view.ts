(function attachUiStatsView(root: UiRoot) {
  function createStatsView(deps: StatsViewDeps) {
    const elements = deps.elements;
    const doc = (deps.document || root.document) as Document;
    const lanes = deps.lanes;

    function renderPlayedStatsLaneTabs(): void {
      const activeLaneId = deps.getActivePlayedLaneId();
      if (elements.playedStatsLaneTabs.childElementCount > 0) {
        elements.playedStatsLaneTabs.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
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
          deps.setActivePlayedLaneId(lane.id);
          deps.setExpandedPlayedStatsChampionId(null);
          deps.setShouldOpenFirstPlayedStatsRow(true);
          renderPlayedChampionStats();
        });
        return button;
      });

      elements.playedStatsLaneTabs.replaceChildren(...buttons);
    }

    function renderOpponentStatsLaneTabs(): void {
      const activeLaneId = deps.getActiveOpponentLaneId();
      if (elements.opponentStatsLaneTabs.childElementCount > 0) {
        elements.opponentStatsLaneTabs.querySelectorAll('button').forEach((button: HTMLButtonElement) => {
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
          deps.setActiveOpponentLaneId(lane.id);
          deps.setExpandedOpponentStatsChampionId(null);
          deps.setShouldOpenFirstOpponentStatsRow(true);
          renderLaneOpponentStats();
        });
        return button;
      });

      elements.opponentStatsLaneTabs.replaceChildren(...buttons);
    }

    function sortStatsTableRows(statsList: any[], sortKey: UiStatsSortKey, sortDirection: UiSortDirection = 'desc'): any[] {
      const direction = sortDirection === 'asc' ? 1 : -1;
      return [...statsList].sort((a, b) => {
        const primary = sortKey === 'winRate'
          ? Number(a.winRate || 0) - Number(b.winRate || 0)
          : Number(a.games || 0) - Number(b.games || 0);
        if (primary !== 0) return primary * direction;

        const secondary = sortKey === 'winRate'
          ? Number(a.games || 0) - Number(b.games || 0)
          : Number(a.winRate || 0) - Number(b.winRate || 0);
        if (secondary !== 0) return secondary * direction;

        return deps.championLabel(a.championId).localeCompare(deps.championLabel(b.championId), 'en');
      });
    }

    function createStatsTableRow(stats: any, championIdKey: string): HTMLTableRowElement {
      const row = doc.createElement('tr');

      const championCell = doc.createElement('th');
      championCell.scope = 'row';
      championCell.append(deps.createInlineChampionName(stats[championIdKey], 'inline-champion-name stats-table-champion'));

      const gamesCell = doc.createElement('td');
      gamesCell.textContent = String(Number(stats.games || 0));

      const winRateCell = doc.createElement('td');
      winRateCell.textContent = deps.formatPercent(stats.winRate);

      const kdaCell = doc.createElement('td');
      kdaCell.textContent = deps.formatAverageKda(stats);

      row.append(championCell, gamesCell, winRateCell, kdaCell);
      return row;
    }

    function renderStatsSortButtons(viewName: 'played' | 'opponents'): void {
      const sortKey = viewName === 'opponents' ? deps.getOpponentStatsSortKey() : deps.getPlayedStatsSortKey();
      const sortDirection = viewName === 'opponents' ? deps.getOpponentStatsSortDirection() : deps.getPlayedStatsSortDirection();
      const gamesButton = viewName === 'opponents'
        ? elements.opponentStatsSortGamesButton
        : elements.playedStatsSortGamesButton;
      const winRateButton = viewName === 'opponents'
        ? elements.opponentStatsSortWinRateButton
        : elements.playedStatsSortWinRateButton;

      [
        [gamesButton, 'games'],
        [winRateButton, 'winRate']
      ].forEach(([button, key]) => {
        if (!button) return;
        const active = sortKey === key;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        button.dataset.sortDirection = active ? sortDirection : '';
        button.setAttribute('aria-sort', active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
      });
    }

    function setStatsSort(viewName: 'played' | 'opponents', sortKey: UiStatsSortKey): void {
      if (viewName === 'opponents') {
        deps.setOpponentStatsSortDirection(deps.getOpponentStatsSortKey() === sortKey && deps.getOpponentStatsSortDirection() === 'desc'
          ? 'asc'
          : 'desc');
        deps.setOpponentStatsSortKey(sortKey);
        deps.setExpandedOpponentStatsChampionId(null);
        deps.setShouldOpenFirstOpponentStatsRow(true);
        renderLaneOpponentStats();
        return;
      }

      deps.setPlayedStatsSortDirection(deps.getPlayedStatsSortKey() === sortKey && deps.getPlayedStatsSortDirection() === 'desc'
        ? 'asc'
        : 'desc');
      deps.setPlayedStatsSortKey(sortKey);
      deps.setExpandedPlayedStatsChampionId(null);
      deps.setShouldOpenFirstPlayedStatsRow(true);
      renderPlayedChampionStats();
    }

    function renderLaneOpponentStats(): void {
      const lane = lanes.find((entry) => entry.id === deps.getActiveOpponentLaneId()) || lanes[0];
      const position = deps.getChampionPoolLanePosition(lane.id);
      const minGames = deps.getOpponentStatsMinGames();
      renderOpponentStatsLaneTabs();

      const statsList = sortStatsTableRows(deps.getMatchHistoryLaneOpponentStats().filter((stats: any) => (
        String(stats.position || '').toUpperCase() === position &&
        Number(stats.games || 0) >= minGames
      )), deps.getOpponentStatsSortKey(), deps.getOpponentStatsSortDirection());

      if (!statsList.some((stats) => Number(stats.championId) === deps.getExpandedOpponentStatsChampionId())) {
        deps.setExpandedOpponentStatsChampionId(null);
      }
      if (deps.getShouldOpenFirstOpponentStatsRow() && !deps.getExpandedOpponentStatsChampionId() && statsList.length > 0) {
        deps.setExpandedOpponentStatsChampionId(Number(statsList[0].championId));
      }
      deps.setShouldOpenFirstOpponentStatsRow(false);

      renderOpponentStatsTable(statsList, position);
      renderStatsSortButtons('opponents');
    }

    function renderOpponentStatsTable(statsList: any[], position: string): void {
      const rows: HTMLTableRowElement[] = [];
      statsList.forEach((stats) => {
        const championId = Number(stats.championId);
        const selected = championId === deps.getExpandedOpponentStatsChampionId();
        const row = createStatsTableRow(stats, 'championId');
        row.classList.add('stats-table-clickable-row');
        row.classList.toggle('expanded', selected);
        row.title = `${deps.championLabel(championId)} に対する自分ピックを表示`;
        row.addEventListener('click', () => {
          deps.setExpandedOpponentStatsChampionId(selected ? null : championId);
          renderLaneOpponentStats();
        });
        rows.push(row);

        if (selected) {
          rows.push(createOpponentPickBreakdownRow(championId, position));
        }
      });

      elements.opponentStatsTableBody.replaceChildren(...rows);
      elements.opponentStatsEmpty.hidden = statsList.length > 0;
      elements.opponentStatsEmpty.textContent = '条件に合う対面データがありません。';
    }

    function createOpponentPickBreakdownRow(opponentChampionId: number, position: string): HTMLTableRowElement {
      const row = doc.createElement('tr');
      row.className = 'stats-opponent-detail-row';

      const cell = doc.createElement('td');
      cell.colSpan = 4;
      cell.append(createOpponentPickBreakdown(opponentChampionId, position));

      row.append(cell);
      return row;
    }

    function createOpponentPickBreakdown(opponentChampionId: number, position: string): HTMLDivElement {
      const container = doc.createElement('div');
      container.className = 'stats-opponent-detail';

      const normalizedPosition = String(position || '').toUpperCase();
      const matchupStats = deps.getMatchHistorySelfVsLaneOpponentStats().filter((stats: any) => (
        Number(stats.opponentChampionId) === Number(opponentChampionId) &&
        String(stats.position || '').toUpperCase() === normalizedPosition &&
        Number(stats.games || 0) > 0
      ));

      const winning = matchupStats
        .filter((stats: any) => getWinMargin(stats) > 0)
        .sort(compareWinningMatchupStats)
        .slice(0, 3);
      const losing = matchupStats
        .filter((stats: any) => getLossMargin(stats) > 0)
        .sort(compareLosingMatchupStats)
        .slice(0, 3);

      container.append(
        createOpponentPickBreakdownGroup('勝ち越しが多い自分ピック', winning, 'won'),
        createOpponentPickBreakdownGroup('負け越しが多い自分ピック', losing, 'lost')
      );
      return container;
    }

    function createOpponentPickBreakdownGroup(title: string, statsList: any[], tone: string): HTMLElement {
      return createMatchupBreakdownGroup(title, statsList, tone, 'championId');
    }

    function createMatchupBreakdownGroup(title: string, statsList: any[], tone: string, championIdKey: string): HTMLElement {
      const group = doc.createElement('section');
      group.className = `stats-opponent-detail-group ${tone}`;

      const heading = doc.createElement('h4');
      heading.textContent = title;
      group.append(heading);

      if (!statsList.length) {
        const empty = doc.createElement('p');
        empty.className = 'stats-opponent-detail-empty';
        empty.textContent = '該当するピックはありません。';
        group.append(empty);
        return group;
      }

      const list = doc.createElement('div');
      list.className = 'stats-opponent-detail-picks';
      statsList.forEach((stats) => {
        list.append(createMatchupBreakdownToken(stats, Number(stats[championIdKey]), tone));
      });
      group.append(list);
      return group;
    }

    function createMatchupBreakdownToken(stats: any, championId: number, tone: string): HTMLSpanElement {
      const token = doc.createElement('span');
      token.className = `stats-opponent-detail-pick ${tone}`;

      const champion = deps.createInlineChampionName(championId, 'inline-champion-name weak-self-pick-name');
      const record = doc.createElement('b');
      record.textContent = deps.formatWinLoss(stats);

      const margin = doc.createElement('small');
      margin.textContent = tone === 'won' ? `+${getWinMargin(stats)}` : `-${getLossMargin(stats)}`;

      token.append(champion, record, margin);
      return token;
    }

    function getWinMargin(stats: any): number {
      return Number(stats?.wins || 0) - deps.getLosses(stats);
    }

    function getLossMargin(stats: any): number {
      return deps.getLosses(stats) - Number(stats?.wins || 0);
    }

    function compareWinningMatchupStats(a: any, b: any): number {
      return (
        (getWinMargin(b) - getWinMargin(a)) ||
        (Number(b.wins || 0) - Number(a.wins || 0)) ||
        (Number(b.games || 0) - Number(a.games || 0)) ||
        deps.championLabel(a.championId).localeCompare(deps.championLabel(b.championId), 'en')
      );
    }

    function compareLosingMatchupStats(a: any, b: any): number {
      return (
        (getLossMargin(b) - getLossMargin(a)) ||
        (deps.getLosses(b) - deps.getLosses(a)) ||
        (Number(b.games || 0) - Number(a.games || 0)) ||
        deps.championLabel(a.championId).localeCompare(deps.championLabel(b.championId), 'en')
      );
    }

    function renderPlayedChampionStats(): void {
      const lane = lanes.find((entry) => entry.id === deps.getActivePlayedLaneId()) || lanes[0];
      const position = deps.getChampionPoolLanePosition(lane.id);
      const minGames = deps.getPlayedStatsMinGames();
      renderPlayedStatsLaneTabs();

      const statsList = sortStatsTableRows(deps.getMatchHistoryChampionStats().filter((stats: any) => (
        stats.queueGroup === 'all_sr_5v5' &&
        String(stats.position || '').toUpperCase() === position &&
        Number(stats.games || 0) >= minGames
      )), deps.getPlayedStatsSortKey(), deps.getPlayedStatsSortDirection());

      if (!statsList.some((stats) => Number(stats.championId) === deps.getExpandedPlayedStatsChampionId())) {
        deps.setExpandedPlayedStatsChampionId(null);
      }
      if (deps.getShouldOpenFirstPlayedStatsRow() && !deps.getExpandedPlayedStatsChampionId() && statsList.length > 0) {
        deps.setExpandedPlayedStatsChampionId(Number(statsList[0].championId));
      }
      deps.setShouldOpenFirstPlayedStatsRow(false);

      renderPlayedStatsTable(statsList, position);
      renderStatsSortButtons('played');
    }

    function renderPlayedStatsTable(statsList: any[], position: string): void {
      const rows: HTMLTableRowElement[] = [];
      statsList.forEach((stats) => {
        const championId = Number(stats.championId);
        const selected = championId === deps.getExpandedPlayedStatsChampionId();
        const row = createStatsTableRow(stats, 'championId');
        row.classList.add('stats-table-clickable-row');
        row.classList.toggle('expanded', selected);
        row.title = `${deps.championLabel(championId)} の対面別成績を表示`;
        row.addEventListener('click', () => {
          deps.setExpandedPlayedStatsChampionId(selected ? null : championId);
          renderPlayedChampionStats();
        });
        rows.push(row);

        if (selected) {
          rows.push(createPlayedPickBreakdownRow(championId, position));
        }
      });

      elements.playedStatsTableBody.replaceChildren(...rows);
      elements.playedStatsEmpty.hidden = statsList.length > 0;
      elements.playedStatsEmpty.textContent = '条件に合うチャンピオン実績がありません。';
    }

    function createPlayedPickBreakdownRow(championId: number, position: string): HTMLTableRowElement {
      const row = doc.createElement('tr');
      row.className = 'stats-opponent-detail-row';

      const cell = doc.createElement('td');
      cell.colSpan = 4;
      cell.append(createPlayedPickBreakdown(championId, position));

      row.append(cell);
      return row;
    }

    function createPlayedPickBreakdown(championId: number, position: string): HTMLDivElement {
      const container = doc.createElement('div');
      container.className = 'stats-opponent-detail';

      const normalizedPosition = String(position || '').toUpperCase();
      const matchupStats = deps.getMatchHistorySelfVsLaneOpponentStats().filter((stats: any) => (
        Number(stats.championId) === Number(championId) &&
        String(stats.position || '').toUpperCase() === normalizedPosition &&
        Number(stats.games || 0) > 0
      ));

      const strongInto = matchupStats
        .filter((stats: any) => getWinMargin(stats) > 0)
        .sort(compareWinningMatchupStats)
        .slice(0, 3);
      const weakInto = matchupStats
        .filter((stats: any) => getLossMargin(stats) > 0)
        .sort(compareLosingMatchupStats)
        .slice(0, 3);

      container.append(
        createMatchupBreakdownGroup('得意な対面', strongInto, 'won', 'opponentChampionId'),
        createMatchupBreakdownGroup('苦手な対面', weakInto, 'lost', 'opponentChampionId')
      );
      return container;
    }

    return {
      renderLaneOpponentStats,
      renderPlayedChampionStats,
      setStatsSort,
      sortStatsTableRows
    };
  }

  const api = { createStatsView };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.UiStatsView = api;
})(typeof window !== 'undefined' ? window : globalThis);
