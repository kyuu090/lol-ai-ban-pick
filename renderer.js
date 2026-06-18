const elements = {
  refreshButton: document.querySelector('#refreshButton'),
  collectRiotMatchesButton: document.querySelector('#collectRiotMatchesButton'),
  matchDataMenuButton: document.querySelector('#matchDataMenuButton'),
  matchDataMenu: document.querySelector('#matchDataMenu'),
  collectSeasonRiotMatchesButton: document.querySelector('#collectSeasonRiotMatchesButton'),
  matchDataCount: document.querySelector('#matchDataCount'),
  matchDataRange: document.querySelector('#matchDataRange'),
  matchDataProgress: document.querySelector('#matchDataProgress'),
  tabButtons: document.querySelectorAll('.tab-button'),
  coachView: document.querySelector('#coachView'),
  championPoolView: document.querySelector('#championPoolView'),
  countersView: document.querySelector('#countersView'),
  debugView: document.querySelector('#debugView'),
  settingsView: document.querySelector('#settingsView'),
  laneTabs: document.querySelector('#laneTabs'),
  counterLaneTabs: document.querySelector('#counterLaneTabs'),
  championPoolSearchInput: document.querySelector('#championPoolSearchInput'),
  championPoolPickerGrid: document.querySelector('#championPoolPickerGrid'),
  championPoolPickerEmpty: document.querySelector('#championPoolPickerEmpty'),
  saveChampionPoolButton: document.querySelector('#saveChampionPoolButton'),
  championPoolListTitle: document.querySelector('#championPoolListTitle'),
  championPoolList: document.querySelector('#championPoolList'),
  championPoolEmpty: document.querySelector('#championPoolEmpty'),
  weakChampionSampleSelect: document.querySelector('#weakChampionSampleSelect'),
  weakEnemyChampionList: document.querySelector('#weakEnemyChampionList'),
  weakEnemyChampionEmpty: document.querySelector('#weakEnemyChampionEmpty'),
  weakLaneChampionTitle: document.querySelector('#weakLaneChampionTitle'),
  weakLaneChampionList: document.querySelector('#weakLaneChampionList'),
  weakLaneChampionEmpty: document.querySelector('#weakLaneChampionEmpty'),
  championPoolMessage: document.querySelector('#championPoolMessage'),
  lolInstallDirInput: document.querySelector('#lolInstallDirInput'),
  riotApiTokenInput: document.querySelector('#riotApiTokenInput'),
  riotApiTokenStatus: document.querySelector('#riotApiTokenStatus'),
  riotPlatformRegionSelect: document.querySelector('#riotPlatformRegionSelect'),
  riotRegionalRouteStatus: document.querySelector('#riotRegionalRouteStatus'),
  chooseLolDirButton: document.querySelector('#chooseLolDirButton'),
  saveLolDirButton: document.querySelector('#saveLolDirButton'),
  saveRiotApiTokenButton: document.querySelector('#saveRiotApiTokenButton'),
  saveRiotPlatformRegionButton: document.querySelector('#saveRiotPlatformRegionButton'),
  settingsMessage: document.querySelector('#settingsMessage'),
  loggedOutView: document.querySelector('#loggedOutView'),
  loggedInView: document.querySelector('#loggedInView'),
  inGameView: document.querySelector('#inGameView'),
  champSelectView: document.querySelector('#champSelectView'),
  helloMessage: document.querySelector('#helloMessage'),
  allyBans: document.querySelector('#allyBans'),
  enemyBans: document.querySelector('#enemyBans'),
  allyTeam: document.querySelector('#allyTeam'),
  enemyTeam: document.querySelector('#enemyTeam'),
  currentAction: document.querySelector('#currentAction'),
  currentPick: document.querySelector('#currentPick'),
  banInsightPanel: document.querySelector('#banInsightPanel'),
  lcuStatus: document.querySelector('#lcuStatus'),
  websocketStatus: document.querySelector('#websocketStatus'),
  gameflowPhase: document.querySelector('#gameflowPhase'),
  updatedAt: document.querySelector('#updatedAt'),
  errorMessage: document.querySelector('#errorMessage'),
  summonerJson: document.querySelector('#summonerJson'),
  lobbyJson: document.querySelector('#lobbyJson'),
  champSelectJson: document.querySelector('#champSelectJson'),
  lastEventJson: document.querySelector('#lastEventJson'),
  stateJson: document.querySelector('#stateJson')
};

let activeView = 'coach';
let activeChampionPoolLane = 'top';
let activeCounterLane = 'top';
let weakChampionMinGames = 5;
let championsById = {};
let championPool = {};
let matchHistoryChampionStats = [];
let matchHistoryEnemyChampionStats = [];
let matchHistoryLaneOpponentStats = [];
let matchHistorySelfVsLaneOpponentStats = [];
let championPoolDirty = false;
let markedLaneOpponentCellId = null;
let lastRenderedState = null;
const championIconCache = new Map();
const championIconQueue = [];
const ICON_REQUEST_CONCURRENCY = 4;
let activeChampionIconRequests = 0;
const championIconObserver = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(handleChampionIconIntersections, { rootMargin: '180px' })
  : null;
let matchHistoryButtonTimer = null;
let dismissedMatchHistoryButtonKey = null;
let matchDataMenuOpen = false;
const {
  collectBans,
  getActiveAction,
  getBestIntoOpponentStats,
  getCoachPanelState,
  getPhase,
  getPendingLabel,
  getPlannedPickThreatStats,
  getSummonerName,
  normalizeChampionPool,
  positionLabel,
  collectUnavailableChampionReasons,
  sortPickPoolCandidates,
  sortWorstWinRateStats
} = window.DraftLogic;
const { CHAMPION_POOL_LANES } = window.DraftLogic;
const CHAMPION_POOL_LANE_TO_POSITION = {
  top: 'TOP',
  jungle: 'JUNGLE',
  middle: 'MIDDLE',
  bottom: 'BOTTOM',
  utility: 'UTILITY'
};
const RELIABLE_SAMPLE_GAMES = 5;
const PICK_POOL_CANDIDATE_LIMIT = 6;

function stringify(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function logDebug(message, details) {
  window.lcuApi?.log?.('debug', message, details);
}

function logWarn(message, details) {
  window.lcuApi?.log?.('warn', message, details);
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(value));
}

function formatMatchDataDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function championLabel(championId) {
  const id = Number(championId);
  if (id <= 0) return '未選択';

  return championsById[id]?.name || `Champion ${id}`;
}

function championTitle(championId) {
  const champion = championsById[Number(championId)];
  return champion?.title ? `${champion.name} - ${champion.title}` : championLabel(championId);
}

function createInlineChampionName(championId, className = 'inline-champion-name') {
  const id = Number(championId) || 0;
  const container = document.createElement('span');
  container.className = className;

  if (id > 0) {
    const icon = document.createElement('img');
    icon.alt = '';
    icon.className = 'inline-champion-icon';
    loadChampionIcon(icon, id);
    container.append(icon);
  }

  const label = document.createElement('span');
  label.textContent = championLabel(id);
  container.append(label);
  return container;
}

function getChampionRoleDisplayStats(championId, position) {
  const id = Number(championId);
  const normalizedPosition = String(position || '').toUpperCase();
  if (!id || !normalizedPosition) return null;

  return matchHistoryChampionStats.find((stats) => (
    Number(stats.championId) === id &&
    stats.queueGroup === 'all_sr_5v5' &&
    String(stats.position || '').toUpperCase() === normalizedPosition
  )) || null;
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

function formatAverageKda(stats) {
  return `${formatNumber(stats?.avgKills)}/${formatNumber(stats?.avgDeaths)}/${formatNumber(stats?.avgAssists)}`;
}

function appendLowSampleBadge(container, games) {
  const sampleGames = Number(games || 0);
  if (sampleGames <= 0 || sampleGames >= RELIABLE_SAMPLE_GAMES) return;

  const sample = document.createElement('em');
  sample.textContent = 'Low sample';
  container.append(sample);
}

function createChampionStatsElement(stats, className = 'pool-champion-stats') {
  const container = document.createElement('div');
  container.className = className;

  if (!stats || !stats.games) {
    container.append(createPickPoolStatChip('Games', 'No games'));
    return container;
  }

  const wins = Number(stats.wins || 0);
  const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
  [
    ['Games', `${stats.games}`],
    ['W-L', `${wins}-${losses}`],
    ['WR', formatPercent(stats.winRate)],
    ['KDA', formatAverageKda(stats)]
  ].forEach(([label, value]) => {
    container.append(createPickPoolStatChip(label, value));
  });

  return container;
}

function getWeakChampionMinGames() {
  const selectedGames = Number(elements.weakChampionSampleSelect?.value);
  return Number.isInteger(selectedGames) && selectedGames > 0 ? selectedGames : weakChampionMinGames;
}

function loadChampionIcon(img, championId) {
  const id = Number(championId);
  if (!id || !window.lcuApi?.getChampionIcon) return;

  img.dataset.championId = String(id);

  const cached = championIconCache.get(id);
  if (typeof cached === 'string') {
    img.src = cached;
    return;
  }

  if (cached === null) return;

  if (cached) {
    attachChampionIcon(img, id, cached);
    return;
  }

  if (championIconObserver) {
    championIconObserver.observe(img);
    return;
  }

  attachChampionIcon(img, id, enqueueChampionIconRequest(id));
}

function handleChampionIconIntersections(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    championIconObserver.unobserve(entry.target);
    const id = Number(entry.target.dataset.championId);
    if (!id) return;

    attachChampionIcon(entry.target, id, enqueueChampionIconRequest(id));
  });
}

function attachChampionIcon(img, id, iconPromise) {
  iconPromise.then((src) => {
    if (src && img.dataset.championId === String(id)) {
      img.src = src;
    }
  });
}

function enqueueChampionIconRequest(id) {
  const cached = championIconCache.get(id);
  if (cached) return cached;
  if (cached === null) return Promise.resolve(null);

  let resolveRequest;
  const iconPromise = new Promise((resolve) => {
    resolveRequest = resolve;
  });

  championIconCache.set(id, iconPromise);
  championIconQueue.push({ id, resolve: resolveRequest });
  processChampionIconQueue();

  return iconPromise;
}

function processChampionIconQueue() {
  while (activeChampionIconRequests < ICON_REQUEST_CONCURRENCY && championIconQueue.length > 0) {
    const { id, resolve } = championIconQueue.shift();
    activeChampionIconRequests += 1;

    window.lcuApi.getChampionIcon(id)
      .then((src) => {
        championIconCache.set(id, src || null);
        resolve(src || null);
      })
      .catch(() => {
        championIconCache.set(id, null);
        resolve(null);
      })
      .finally(() => {
        activeChampionIconRequests -= 1;
        processChampionIconQueue();
      });
  }
}

function renderState(state) {
  lastRenderedState = state;
  championsById = state.championsById || {};
  matchHistoryChampionStats = Array.isArray(state.matchHistoryChampionStats) ? state.matchHistoryChampionStats : [];
  matchHistoryEnemyChampionStats = Array.isArray(state.matchHistoryEnemyChampionStats) ? state.matchHistoryEnemyChampionStats : [];
  matchHistoryLaneOpponentStats = Array.isArray(state.matchHistoryLaneOpponentStats) ? state.matchHistoryLaneOpponentStats : [];
  matchHistorySelfVsLaneOpponentStats = Array.isArray(state.matchHistorySelfVsLaneOpponentStats) ? state.matchHistorySelfVsLaneOpponentStats : [];
  if (!championPoolDirty) {
    championPool = normalizeChampionPool(state.championPool);
  }
  renderStatus(state);
  renderMatchHistoryStatus(state.matchHistoryStatus);
  renderMatchDataSummary(state.matchHistorySummary);
  renderSettings(state.settings);
  renderChampionPool();
  renderCounters();
  renderCoach(state);
  renderDebug(state);
}

function renderMatchDataSummary(summary) {
  const matchCount = Number(summary?.normalizedMatches || 0);
  if (matchCount <= 0) {
    elements.matchDataCount.textContent = 'No data';
    elements.matchDataRange.textContent = 'Riot試合取得後に表示します';
    return;
  }

  const oldest = formatMatchDataDate(summary.oldestGameCreation);
  const newest = formatMatchDataDate(summary.newestGameCreation);
  elements.matchDataCount.textContent = `${matchCount} matches`;
  elements.matchDataRange.textContent = oldest && newest
    ? `${oldest} - ${newest}`
    : '期間不明';
}

function renderMatchHistoryStatus(status) {
  const statusKey = `${status?.phase || 'idle'}:${status?.updatedAt || ''}`;

  if (matchHistoryButtonTimer) {
    clearTimeout(matchHistoryButtonTimer);
    matchHistoryButtonTimer = null;
  }

  if (!status || status.phase === 'idle') {
    elements.collectRiotMatchesButton.disabled = false;
    elements.matchDataMenuButton.disabled = false;
    elements.collectSeasonRiotMatchesButton.disabled = false;
    elements.collectRiotMatchesButton.textContent = 'Download recent match';
    renderMatchDataProgress(null);
    dismissedMatchHistoryButtonKey = null;
    return;
  }

  const activePhases = ['collecting', 'normalizing', 'aggregating', 'retrying'];
  const isActive = activePhases.includes(status.phase);

  if (isActive) {
    dismissedMatchHistoryButtonKey = null;
  } else if (dismissedMatchHistoryButtonKey === statusKey) {
    elements.collectRiotMatchesButton.disabled = false;
    elements.matchDataMenuButton.disabled = false;
    elements.collectSeasonRiotMatchesButton.disabled = false;
    elements.collectRiotMatchesButton.textContent = 'Download recent match';
    renderMatchDataProgress(null);
    return;
  }

  elements.collectRiotMatchesButton.disabled = isActive;
  elements.matchDataMenuButton.disabled = isActive;
  elements.collectSeasonRiotMatchesButton.disabled = isActive;
  elements.collectRiotMatchesButton.textContent = getMatchHistoryButtonText(status);
  renderMatchDataProgress(status);

  if (!isActive) {
    const delayMs = status.phase === 'completed' ? 3000 : 5000;
    matchHistoryButtonTimer = setTimeout(() => {
      elements.collectRiotMatchesButton.textContent = 'Download recent match';
      renderMatchDataProgress(null);
      dismissedMatchHistoryButtonKey = statusKey;
    }, delayMs);
  }
}

function renderMatchDataProgress(status) {
  const message = status?.message || '';
  elements.matchDataProgress.hidden = !message;
  elements.matchDataProgress.textContent = message;
  elements.matchDataProgress.dataset.phase = status?.phase || '';
}

function getMatchHistoryButtonText(status) {
  if (!status) return 'Download recent match';

  if (status.phase === 'collecting') return status.mode === 'season' ? 'Downloading season...' : 'Downloading...';
  if (status.phase === 'normalizing' || status.phase === 'aggregating') return 'Saving...';
  if (status.phase === 'retrying') return 'Retrying...';
  if (status.phase === 'completed') return `Downloaded ${Number(status.updatedMatches || 0)} matches`;
  if (status.phase === 'partial') return `Downloaded ${Number(status.updatedMatches || 0)} matches`;
  if (status.phase === 'error') return 'Download failed';

  return 'Download recent match';
}

function renderSettings(settings) {
  if (!settings) return;

  if (settings.lolInstallDir && document.activeElement !== elements.lolInstallDirInput) {
    elements.lolInstallDirInput.value = settings.lolInstallDir;
  }

  elements.riotApiTokenStatus.textContent = settings.hasRiotApiToken
    ? '登録済みです。空欄で保存すると削除できます。'
    : '未登録';

  renderRiotPlatformRegions(settings);
  elements.riotRegionalRouteStatus.textContent = `Match-V5 route: ${settings.riotRegionalRoute || 'ASIA'}`;
}

function renderRiotPlatformRegions(settings) {
  const regions = Array.isArray(settings.riotPlatformRegions) ? settings.riotPlatformRegions : [];
  const selectedRegion = settings.riotPlatformRegion || 'JP1';

  if (elements.riotPlatformRegionSelect.childElementCount === 0 && regions.length > 0) {
    elements.riotPlatformRegionSelect.replaceChildren(...regions.map((region) => {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = region;
      return option;
    }));
  }

  if (document.activeElement !== elements.riotPlatformRegionSelect) {
    elements.riotPlatformRegionSelect.value = selectedRegion;
  }
}

function getActiveChampionPoolLane() {
  return CHAMPION_POOL_LANES.find((lane) => lane.id === activeChampionPoolLane) || CHAMPION_POOL_LANES[0];
}

function getChampionPoolLanePosition(laneId) {
  return CHAMPION_POOL_LANE_TO_POSITION[laneId] || null;
}

function getChampionPoolLaneByPosition(position) {
  const normalizedPosition = String(position || '').toUpperCase();
  return CHAMPION_POOL_LANES.find((lane) => CHAMPION_POOL_LANE_TO_POSITION[lane.id] === normalizedPosition) || null;
}

function getChampionOptions() {
  return Object.values(championsById)
    .filter((champion) => Number(champion.id) > 0 && champion.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function renderLaneTabs() {
  if (elements.laneTabs.childElementCount > 0) {
    elements.laneTabs.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.lane === activeChampionPoolLane);
    });
    return;
  }

  const buttons = CHAMPION_POOL_LANES.map((lane) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lane = lane.id;
    button.textContent = lane.label;
    button.className = `lane-tab${lane.id === activeChampionPoolLane ? ' active' : ''}`;
    button.addEventListener('click', () => {
      activeChampionPoolLane = lane.id;
      elements.championPoolMessage.textContent = '';
      renderChampionPool();
    });
    return button;
  });

  elements.laneTabs.replaceChildren(...buttons);
}

function renderCounterLaneTabs() {
  if (elements.counterLaneTabs.childElementCount > 0) {
    elements.counterLaneTabs.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.lane === activeCounterLane);
    });
    return;
  }

  const buttons = CHAMPION_POOL_LANES.map((lane) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lane = lane.id;
    button.textContent = lane.label;
    button.className = `lane-tab${lane.id === activeCounterLane ? ' active' : ''}`;
    button.addEventListener('click', () => {
      activeCounterLane = lane.id;
      renderCounters();
    });
    return button;
  });

  elements.counterLaneTabs.replaceChildren(...buttons);
}

function renderChampionPicker(championIds) {
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

  elements.championPoolPickerGrid.replaceChildren(...filteredOptions.map((champion) => {
    const championId = Number(champion.id);
    const selected = selectedChampionIds.has(championId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `champion-picker-card${selected ? ' selected' : ''}`;
    button.title = selected ? `${champion.name} は登録済みです` : championTitle(championId);
    button.dataset.championId = String(championId);

    const portrait = document.createElement('div');
    portrait.className = 'champion-portrait';

    const image = document.createElement('img');
    image.alt = champion.name;
    loadChampionIcon(image, championId);
    portrait.append(image);

    const name = document.createElement('span');
    name.textContent = champion.name;

    button.append(portrait, name);
    button.addEventListener('click', () => addChampionToPool(championId));
    return button;
  }));

  elements.championPoolPickerEmpty.hidden = filteredOptions.length > 0;
  elements.championPoolPickerEmpty.textContent = options.length > 0
    ? '一致するチャンピオンがありません。'
    : 'LCU接続後にチャンピオン一覧を取得します。';
}

function renderChampionPool() {
  championPool = normalizeChampionPool(championPool);

  const lane = getActiveChampionPoolLane();
  const championIds = championPool[lane.id] || [];

  renderLaneTabs();
  renderChampionPicker(championIds);

  elements.championPoolListTitle.textContent = lane.label;
  elements.championPoolEmpty.hidden = championIds.length > 0;
  elements.championPoolList.replaceChildren(...championIds.map((championId) => {
    const item = document.createElement('article');
    item.className = 'pool-champion';
    item.title = championTitle(championId);

    const portrait = document.createElement('div');
    portrait.className = 'champion-portrait';

    const image = document.createElement('img');
    image.alt = championLabel(championId);
    loadChampionIcon(image, championId);
    portrait.append(image);

    const meta = document.createElement('div');
    meta.className = 'pool-champion-meta';

    const name = document.createElement('strong');
    name.textContent = championLabel(championId);

    meta.append(name, createChampionStatsElement(
      getChampionRoleDisplayStats(championId, getChampionPoolLanePosition(lane.id))
    ));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'pool-remove-button';
    removeButton.dataset.championId = String(championId);
    removeButton.title = `${championLabel(championId)} を削除`;
    removeButton.setAttribute('aria-label', `${championLabel(championId)} を削除`);
    const removeIcon = document.createElement('span');
    removeIcon.className = 'remove-x-icon';
    removeButton.append(removeIcon);
    removeButton.addEventListener('click', () => removeChampionFromPool(championId));

    item.append(portrait, meta, removeButton);
    return item;
  }));
}

function renderCounters() {
  const lane = CHAMPION_POOL_LANES.find((entry) => entry.id === activeCounterLane) || CHAMPION_POOL_LANES[0];
  renderCounterLaneTabs();
  renderWeakChampionLists(lane);
}

function renderWeakChampionLists(lane = getActiveChampionPoolLane()) {
  const minGames = getWeakChampionMinGames();
  const position = getChampionPoolLanePosition(lane.id);
  const enemyStats = sortWorstWinRateStats(matchHistoryEnemyChampionStats.filter((stats) => (
    Number(stats.games || 0) >= minGames &&
    Number(stats.winRate || 0) < 0.5
  ))).slice(0, 8);
  const laneStats = sortWorstWinRateStats(matchHistoryLaneOpponentStats.filter((stats) => (
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= minGames &&
    Number(stats.winRate || 0) < 0.5
  ))).slice(0, 8);

  elements.weakLaneChampionTitle.textContent = lane.label;
  renderWeakChampionList(
    elements.weakEnemyChampionList,
    elements.weakEnemyChampionEmpty,
    enemyStats,
    '条件に合う試合データがありません。'
  );
  renderWeakChampionList(
    elements.weakLaneChampionList,
    elements.weakLaneChampionEmpty,
    laneStats,
    '条件に合う対面データがありません。'
  );
}

function renderWeakChampionList(listElement, emptyElement, statsList, emptyText) {
  listElement.replaceChildren(...statsList.map(createWeakChampionItem));
  emptyElement.hidden = statsList.length > 0;
  emptyElement.textContent = emptyText;
}

function createWeakChampionItem(stats) {
  const item = document.createElement('li');
  item.className = 'weak-champion-item';

  const name = document.createElement('span');
  name.className = 'weak-champion-name';
  name.append(createInlineChampionName(stats.championId));

  const detail = createWinRateStatsElement(stats, { includeKda: true });

  item.append(name, detail);
  return item;
}

function renderStatus(state) {
  elements.lcuStatus.textContent = state.lcuStatus ?? '-';
  elements.websocketStatus.textContent = state.websocketStatus ?? '-';
  elements.gameflowPhase.textContent = getPhase(state) ?? (stringify(state.gameflowPhase).replace(/^"|"$/g, '') || '-');
  elements.updatedAt.textContent = formatDate(state.updatedAt);
  elements.errorMessage.textContent = state.error ?? '';
}

function renderCoach(state) {
  const { champSelect, loggedIn, inGame, inChampSelect } = getCoachPanelState(state);

  showOnlyCoachPanel(loggedIn, inChampSelect, inGame);

  if (!inChampSelect) {
    elements.champSelectView.classList.remove('local-turn');
    markedLaneOpponentCellId = null;
  }

  if (!loggedIn) return;

  elements.helloMessage.textContent = `こんにちは ${getSummonerName(state.summoner)}`;

  if (inChampSelect) {
    renderChampSelect(champSelect);
  }
}

function showOnlyCoachPanel(loggedIn, inChampSelect, inGame) {
  elements.loggedOutView.hidden = loggedIn;
  elements.loggedInView.hidden = !loggedIn || inChampSelect || inGame;
  elements.champSelectView.hidden = !loggedIn || !inChampSelect || inGame;
  elements.inGameView.hidden = !loggedIn || !inGame;
}

function renderChampSelect(champSelect) {
  const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
  const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
  const { allyBans, enemyBans } = collectBans(champSelect, allyTeam, enemyTeam);
  const activeAction = getActiveAction(champSelect);
  const localCellId = champSelect?.localPlayerCellId;
  const localMember = allyTeam.find((member) => member.cellId === localCellId);
  const isLocalTurn = activeAction?.actorCellId === localCellId;
  if (markedLaneOpponentCellId !== null && !enemyTeam.some((member) => member.cellId === markedLaneOpponentCellId)) {
    markedLaneOpponentCellId = null;
  }

  elements.champSelectView.classList.toggle('local-turn', isLocalTurn);
  renderBanList(elements.allyBans, allyBans);
  renderBanList(elements.enemyBans, enemyBans);
  renderTeam(elements.allyTeam, allyTeam, 'ally', { activeAction, localCellId });
  renderTeam(elements.enemyTeam, enemyTeam, 'enemy', {
    activeAction,
    localCellId,
    localAssignedPosition: localMember?.assignedPosition,
    markedLaneOpponentCellId
  });
  renderDraftFocus(champSelect, activeAction);
}

function renderBanList(container, bans) {
  container.replaceChildren(...bans.slice(0, 5).map((championId) => {
    const item = document.createElement('span');
    item.className = 'ban-token';
    item.title = championTitle(championId);

    const icon = document.createElement('img');
    icon.alt = '';
    icon.className = 'ban-token-icon';
    loadChampionIcon(icon, championId);

    const label = document.createElement('span');
    label.textContent = championLabel(championId);

    item.append(icon, label);
    return item;
  }));

  if (bans.length === 0) {
    const item = document.createElement('span');
    item.className = 'ban-token empty';
    item.textContent = 'BANなし';
    container.append(item);
  }
}

function renderTeam(container, team, side, turnState = {}) {
  const rows = Array.from({ length: 5 }, (_, index) => team[index] ?? { cellId: index, championId: 0 });

  container.replaceChildren(...rows.map((member, index) => {
    const row = document.createElement('article');
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
    if (isEnemyMember) {
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-pressed', String(isMarkedLaneOpponent));
      row.title = isMarkedLaneOpponent ? 'Click to unmark lane opponent' : 'Click to mark as lane opponent';
      row.addEventListener('click', () => toggleMarkedLaneOpponent(member.cellId));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleMarkedLaneOpponent(member.cellId);
        }
      });
    }

    const portrait = document.createElement('div');
    portrait.className = `champion-portrait ${hasIntent ? 'intent' : ''}`;
    portrait.title = portraitChampionId > 0 ? championTitle(portraitChampionId) : '';

    if (portraitChampionId > 0) {
      const image = document.createElement('img');
      image.alt = championLabel(portraitChampionId);
      loadChampionIcon(image, portraitChampionId);
      portrait.append(image);
    } else {
      portrait.textContent = '?';
    }

    const meta = document.createElement('div');
    meta.className = 'pick-meta';

    const champion = document.createElement('strong');
    champion.textContent = selected ? championLabel(member.championId) : getPendingLabel(member, championLabel);

    const detail = document.createElement('span');
    detail.textContent = `${positionLabel(member.assignedPosition)} / Summoner ${index + 1}`;

    meta.append(champion, detail);
    if (isMarkedLaneOpponent) {
      const marker = document.createElement('span');
      marker.className = 'lane-opponent-marker';
      marker.textContent = turnState.localAssignedPosition
        ? `${positionLabel(turnState.localAssignedPosition)} OPPONENT`
        : 'LANE OPPONENT';
      meta.append(marker);
    }
    if (side === 'ally' && isLocalMember && portraitChampionId > 0) {
      meta.append(createChampionStatsElement(
        getChampionRoleDisplayStats(portraitChampionId, member.assignedPosition),
        'draft-champion-stats'
      ));
    }
    row.append(portrait, meta);
    return row;
  }));
}

function toggleMarkedLaneOpponent(cellId) {
  const normalizedCellId = Number(cellId);
  if (!Number.isInteger(normalizedCellId)) return;

  markedLaneOpponentCellId = markedLaneOpponentCellId === normalizedCellId ? null : normalizedCellId;
  logDebug('Lane opponent marker changed', { markedLaneOpponentCellId });
  if (lastRenderedState) {
    renderCoach(lastRenderedState);
  }
}

function renderDraftFocus(champSelect, activeAction = getActiveAction(champSelect)) {
  const localCellId = champSelect?.localPlayerCellId;
  const localMember = champSelect?.myTeam?.find((member) => member.cellId === localCellId);
  const isDraftActionPhase = String(champSelect?.timer?.phase || '').toUpperCase() === 'BAN_PICK';
  renderDraftInsights(null, { champSelect, localMember });

  if (activeAction) {
    const isActionInProgress = Boolean(activeAction.isInProgress);
    const isLocalTurn = isDraftActionPhase && isActionInProgress && activeAction.actorCellId === localCellId;
    const actionLabel = activeAction.type === 'ban' ? 'BAN' : 'PICK';
    elements.currentAction.textContent = isLocalTurn ? `YOUR ${actionLabel}` : isDraftActionPhase && isActionInProgress ? `${actionLabel} PHASE` : 'Waiting';
    renderDraftInsights(isLocalTurn ? activeAction.type : null, { champSelect, localMember });
    elements.currentPick.textContent = isLocalTurn
      ? activeAction.type === 'ban' ? 'あなたのBANです' : 'あなたのPICKです'
      : isDraftActionPhase && isActionInProgress ? `Summoner ${(activeAction.actorCellId ?? 0) + 1} の操作待ちです` : 'チャンピオン選択情報を監視しています。';
    return;
  }

  elements.currentAction.textContent = localMember?.championId ? championLabel(localMember.championId) : '待機中';
  elements.currentPick.textContent = 'チャンピオン選択情報を監視しています。';
}

function renderDraftInsights(type, context = {}) {
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

function renderInsightPanel(visible, mode = '') {
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

function renderBanInsights(visible, champSelect, localMember) {
  const panel = renderInsightPanel(visible, 'ban-mode');
  if (!panel) return;

  const position = String(localMember?.assignedPosition || '').toUpperCase();
  const plannedPickThreatSection = createPlannedPickBanThreatSection(champSelect, localMember, position);
  const enemyStats = sortWorstWinRateStats(matchHistoryEnemyChampionStats).slice(0, 3);
  const reliableEnemyStats = sortWorstWinRateStats(matchHistoryEnemyChampionStats.filter((stats) => (
    Number(stats.games || 0) >= RELIABLE_SAMPLE_GAMES
  ))).slice(0, 3);
  const laneStats = sortWorstWinRateStats(matchHistoryLaneOpponentStats.filter((stats) => (
    String(stats.position || '').toUpperCase() === position
  ))).slice(0, 3);
  const reliableLaneStats = sortWorstWinRateStats(matchHistoryLaneOpponentStats.filter((stats) => (
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= RELIABLE_SAMPLE_GAMES
  ))).slice(0, 3);

  const sections = [
    createBanInsightSection('Worst enemy picks', enemyStats),
    createBanInsightSection(`Reliable enemy picks (${RELIABLE_SAMPLE_GAMES}+g)`, reliableEnemyStats),
    createBanInsightSection(`${positionLabel(position)} lane opponents`, laneStats),
    createBanInsightSection(`Reliable ${positionLabel(position)} opponents (${RELIABLE_SAMPLE_GAMES}+g)`, reliableLaneStats)
  ];
  if (plannedPickThreatSection) {
    sections.unshift(plannedPickThreatSection);
  }

  panel.replaceChildren(...sections);
}

function createPlannedPickBanThreatSection(champSelect, localMember, position) {
  const { plannedChampionId, statsList } = getPlannedPickThreatStats({
    stats: matchHistorySelfVsLaneOpponentStats,
    champSelect,
    localMember,
    limit: 3
  });
  if (!plannedChampionId || !position) return null;

  const section = document.createElement('section');
  section.className = 'ban-insight-section planned-pick-threat-section';

  const heading = document.createElement('h4');
  heading.append(
    'Threats for your ',
    createInlineChampionName(plannedChampionId, 'inline-champion-name heading-champion-name'),
    ` ${positionLabel(position)}`
  );
  section.append(heading);

  if (!statsList.length) {
    const empty = document.createElement('p');
    empty.className = 'ban-insight-empty';
    empty.textContent = 'No same-role matchup history';
    section.append(empty);
    return section;
  }

  const list = document.createElement('ol');
  statsList.forEach((stats) => {
    list.append(createPlannedPickBanThreatItem(stats));
  });
  section.append(list);
  return section;
}

function createPlannedPickBanThreatItem(stats) {
  const item = document.createElement('li');

  const nameBlock = document.createElement('span');
  nameBlock.className = 'ban-insight-name';
  nameBlock.append(createInlineChampionName(stats.opponentChampionId));

  const detail = createWinRateStatsElement(stats, { includeKda: true });

  item.append(nameBlock, detail);
  appendLowSampleBadge(nameBlock, stats.games);

  return item;
}

function renderPickPoolInsights(visible, champSelect, localMember) {
  const panel = renderInsightPanel(visible, 'pick-mode');
  if (!panel) return;

  championPool = normalizeChampionPool(championPool);
  const lane = getChampionPoolLaneByPosition(localMember?.assignedPosition);
  const position = String(localMember?.assignedPosition || '').toUpperCase();
  const championIds = lane ? championPool[lane.id] || [] : [];
  const unavailableReasons = collectUnavailableChampionReasons(champSelect);
  const candidates = championIds.map((championId) => {
    const stats = getChampionRoleDisplayStats(championId, position);
    const unavailableReason = unavailableReasons.get(Number(championId)) || '';

    return {
      championId,
      stats,
      unavailableReason,
      available: !unavailableReason
    };
  });
  const sortedCandidates = sortPickPoolCandidates(candidates, RELIABLE_SAMPLE_GAMES);
  const visibleCandidates = sortedCandidates.slice(0, PICK_POOL_CANDIDATE_LIMIT);

  const header = document.createElement('section');
  header.className = 'pick-pool-header';

  const title = document.createElement('h4');
  title.textContent = lane ? `Your ${lane.label} Pool` : 'Your Pool';

  const summary = document.createElement('p');
  summary.textContent = championIds.length > 0
    ? `${visibleCandidates.length}/${championIds.length} candidates`
    : 'No champions registered for this role';

  header.append(title, summary);

  if (!visibleCandidates.length) {
    const empty = document.createElement('p');
    empty.className = 'ban-insight-empty';
    empty.textContent = lane ? 'ChampionPool is empty' : 'Assigned role is unknown';
    panel.replaceChildren(
      ...createMarkedOpponentInsightElements(champSelect, localMember),
      header,
      empty
    );
    return;
  }

  const list = document.createElement('ol');
  list.className = 'pick-pool-list';
  visibleCandidates.forEach((candidate) => {
    list.append(createPickPoolCandidateItem(candidate, position));
  });

  panel.replaceChildren(
    ...createMarkedOpponentInsightElements(champSelect, localMember),
    header,
    list
  );
}

function renderMarkedOpponentPickInsights(visible, champSelect, localMember) {
  const panel = renderInsightPanel(visible, 'pick-mode marked-opponent-mode');
  if (!panel) return;

  const elements = createMarkedOpponentInsightElements(champSelect, localMember);
  if (!elements.length) {
    renderInsightPanel(false);
    return;
  }

  panel.replaceChildren(...elements);
}

function createMarkedOpponentInsightElements(champSelect, localMember) {
  const opponentChampionId = getMarkedLaneOpponentChampionId(champSelect);
  const position = String(localMember?.assignedPosition || '').toUpperCase();
  if (!opponentChampionId || !position) return [];

  const statsList = getBestIntoOpponentStats({
    stats: matchHistorySelfVsLaneOpponentStats,
    opponentChampionId,
    position,
    limit: 5
  });

  const section = document.createElement('section');
  section.className = 'marked-opponent-insight';

  const header = document.createElement('div');
  header.className = 'pick-pool-header';

  const title = document.createElement('h4');
  title.append('Best into ', createInlineChampionName(opponentChampionId, 'inline-champion-name heading-champion-name'));

  const summary = document.createElement('p');
  summary.textContent = `${positionLabel(position)} history`;

  header.append(title, summary);
  section.append(header);

  if (!statsList.length) {
    const empty = document.createElement('p');
    empty.className = 'ban-insight-empty';
    empty.textContent = 'No direct history';
    section.append(empty);
    return [section];
  }

  const list = document.createElement('ol');
  list.className = 'pick-pool-list marked-opponent-list';
  statsList.forEach((stats) => {
    list.append(createMarkedOpponentPickItem(stats));
  });
  section.append(list);

  return [section];
}

function getMarkedLaneOpponentChampionId(champSelect) {
  if (markedLaneOpponentCellId === null) return null;

  const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
  const member = enemyTeam.find((enemy) => enemy.cellId === markedLaneOpponentCellId);
  const championId = Number(member?.championId || member?.championPickIntent) || 0;
  return championId > 0 ? championId : null;
}

function createMarkedOpponentPickItem(stats) {
  const item = document.createElement('li');
  item.className = 'pick-pool-candidate marked-opponent-candidate';

  const name = createInlineChampionName(stats.championId);

  const detail = createWinRateStatsElement(stats, { includeGames: false, includeKda: true });
  item.append(name, detail);

  appendLowSampleBadge(item, stats.games);

  return item;
}

function createPickPoolCandidateItem(candidate, position) {
  const item = document.createElement('li');
  item.className = `pick-pool-candidate${candidate.available ? '' : ' unavailable'}`;

  const name = createInlineChampionName(candidate.championId);

  const detail = createPickPoolCandidateStatsElement(candidate.stats, position);

  item.append(name, detail);

  if (candidate.unavailableReason) {
    const status = document.createElement('em');
    status.textContent = candidate.unavailableReason;
    item.append(status);
  } else {
    appendLowSampleBadge(item, candidate.stats?.games);
  }

  return item;
}

function createPickPoolCandidateStatsElement(stats, position) {
  const container = document.createElement('span');
  container.className = 'pick-pool-stats';

  if (!stats || !stats.games) {
    container.append(createPickPoolStatChip('Games', `No ${positionLabel(position)}`));
    return container;
  }

  const wins = Number(stats.wins || 0);
  const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
  [
    ['W-L', `${wins}-${losses}`],
    ['WR', formatPercent(stats.winRate)],
    ['KDA', formatAverageKda(stats)]
  ].forEach(([label, value]) => {
    container.append(createPickPoolStatChip(label, value));
  });

  return container;
}

function createPickPoolStatChip(label, value) {
  const chip = document.createElement('span');
  chip.className = 'pick-pool-stat-chip';

  const labelElement = document.createElement('small');
  labelElement.textContent = label;

  const valueElement = document.createElement('b');
  valueElement.textContent = value;

  chip.append(labelElement, valueElement);
  return chip;
}

function createBanInsightSection(title, statsList) {
  const section = document.createElement('section');
  section.className = 'ban-insight-section';

  const heading = document.createElement('h4');
  heading.textContent = title;
  section.append(heading);

  if (!statsList.length) {
    const empty = document.createElement('p');
    empty.className = 'ban-insight-empty';
    empty.textContent = 'No match data';
    section.append(empty);
    return section;
  }

  const list = document.createElement('ol');
  statsList.forEach((stats) => {
    list.append(createBanInsightItem(stats));
  });
  section.append(list);
  return section;
}

function createBanInsightItem(stats) {
  const item = document.createElement('li');

  const nameBlock = document.createElement('span');
  nameBlock.className = 'ban-insight-name';
  nameBlock.append(createInlineChampionName(stats.championId));

  const detail = createWinRateStatsElement(stats);

  item.append(nameBlock, detail);
  appendLowSampleBadge(nameBlock, stats.games);

  return item;
}

function createWinRateStatsElement(stats, options = {}) {
  const includeGames = options.includeGames !== false;
  const includeKda = options.includeKda === true;
  const container = document.createElement('span');
  container.className = 'compact-stat-chips';

  const games = Number(stats.games || 0);
  const wins = Number(stats.wins || 0);
  const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, games - wins);
  const chips = [
    ['W-L', `${wins}-${losses}`],
    ['WR', formatPercent(stats.winRate)]
  ];
  if (includeGames) {
    chips.unshift(['Games', `${games}`]);
  }
  if (includeKda) {
    chips.push(['KDA', formatAverageKda(stats)]);
  }

  chips.forEach(([label, value]) => {
    container.append(createPickPoolStatChip(label, value));
  });

  return container;
}

function renderDebug(state) {
  elements.summonerJson.textContent = stringify(state.summoner);
  elements.lobbyJson.textContent = stringify(state.lobby);
  elements.champSelectJson.textContent = stringify(state.champSelect);
  elements.lastEventJson.textContent = stringify(state.lastEvent);
  elements.stateJson.textContent = stringify(state);
}

function setActiveView(viewName) {
  activeView = viewName;
  logDebug('Active view changed', { viewName });
  elements.coachView.hidden = activeView !== 'coach';
  elements.championPoolView.hidden = activeView !== 'championPool';
  elements.countersView.hidden = activeView !== 'counters';
  elements.debugView.hidden = activeView !== 'debug';
  elements.settingsView.hidden = activeView !== 'settings';

  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === activeView);
  });
}

function addChampionToPool(nextChampionId) {
  const championId = Number(nextChampionId);
  if (!championId) return;

  championPool = normalizeChampionPool(championPool);
  const lane = getActiveChampionPoolLane();
  if ((championPool[lane.id] || []).includes(championId)) return;

  championPool[lane.id] = [...new Set([...(championPool[lane.id] || []), championId])];
  championPoolDirty = true;
  logDebug('Champion added to pool', { lane: lane.id, championId });
  elements.championPoolMessage.textContent = '';
  renderChampionPool();
}

function removeChampionFromPool(championId) {
  championPool = normalizeChampionPool(championPool);
  const lane = getActiveChampionPoolLane();
  championPool[lane.id] = (championPool[lane.id] || []).filter((id) => id !== Number(championId));
  championPoolDirty = true;
  logDebug('Champion removed from pool', { lane: lane.id, championId: Number(championId) });
  elements.championPoolMessage.textContent = '';
  renderChampionPool();
}

async function saveChampionPool() {
  elements.saveChampionPoolButton.disabled = true;
  elements.championPoolMessage.textContent = '';

  try {
    championPool = await window.lcuApi.saveChampionPool(championPool);
    championPoolDirty = false;
    renderChampionPool();
    logDebug('Champion pool save completed', { championPool });
    elements.championPoolMessage.textContent = 'チャンピオンプールを保存しました。';
  } catch (error) {
    logWarn('Champion pool save failed', { message: error.message, stack: error.stack });
    elements.championPoolMessage.textContent = `保存できませんでした: ${error.message}`;
  } finally {
    elements.saveChampionPoolButton.disabled = false;
  }
}

async function chooseLolInstallDir() {
  elements.chooseLolDirButton.disabled = true;
  elements.settingsMessage.textContent = '';

  try {
    const settings = await window.lcuApi.chooseLolInstallDir();
    elements.lolInstallDirInput.value = settings.lolInstallDir;
    logDebug('LoL install directory selected', { lolInstallDir: settings.lolInstallDir });
    elements.settingsMessage.textContent = '保存しました。接続状態を再確認しています。';
  } catch (error) {
    logWarn('LoL install directory selection failed', { message: error.message, stack: error.stack });
    elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
  } finally {
    elements.chooseLolDirButton.disabled = false;
  }
}

async function saveLolInstallDir() {
  const lolInstallDir = elements.lolInstallDirInput.value.trim();
  elements.saveLolDirButton.disabled = true;
  elements.settingsMessage.textContent = '';

  try {
    const settings = await window.lcuApi.updateLolInstallDir(lolInstallDir);
    elements.lolInstallDirInput.value = settings.lolInstallDir;
    logDebug('LoL install directory saved', { lolInstallDir: settings.lolInstallDir });
    elements.settingsMessage.textContent = '保存しました。接続状態を再確認しています。';
  } catch (error) {
    logWarn('LoL install directory save failed', { message: error.message, stack: error.stack });
    elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
  } finally {
    elements.saveLolDirButton.disabled = false;
  }
}

async function saveRiotApiToken() {
  const riotApiToken = elements.riotApiTokenInput.value.trim();
  elements.saveRiotApiTokenButton.disabled = true;
  elements.settingsMessage.textContent = '';

  try {
    const settings = await window.lcuApi.updateRiotApiToken(riotApiToken);
    elements.riotApiTokenInput.value = '';
    renderSettings(settings);
    logDebug('Riot API token saved', { hasRiotApiToken: settings.hasRiotApiToken });
    elements.settingsMessage.textContent = settings.hasRiotApiToken
      ? 'Riot APIトークンを保存しました。'
      : 'Riot APIトークンを削除しました。';
  } catch (error) {
    logWarn('Riot API token save failed', { message: error.message, stack: error.stack });
    elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
  } finally {
    elements.saveRiotApiTokenButton.disabled = false;
  }
}

async function saveRiotPlatformRegion() {
  const riotPlatformRegion = elements.riotPlatformRegionSelect.value;
  elements.saveRiotPlatformRegionButton.disabled = true;
  elements.settingsMessage.textContent = '';

  try {
    const settings = await window.lcuApi.updateRiotPlatformRegion(riotPlatformRegion);
    renderSettings(settings);
    logDebug('Riot platform region saved', {
      riotPlatformRegion: settings.riotPlatformRegion,
      riotRegionalRoute: settings.riotRegionalRoute
    });
    elements.settingsMessage.textContent = `Regionを${settings.riotPlatformRegion}に保存しました。`;
  } catch (error) {
    logWarn('Riot platform region save failed', { message: error.message, stack: error.stack });
    elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
  } finally {
    elements.saveRiotPlatformRegionButton.disabled = false;
  }
}

async function refresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = '取得中...';

  try {
    logDebug('Manual LCU refresh requested');
    const state = await window.lcuApi.refresh();
    renderState(state);
    logDebug('Manual LCU refresh completed', { lcuStatus: state.lcuStatus, websocketStatus: state.websocketStatus });
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = '手動再取得';
  }
}

function setMatchDataMenuOpen(open) {
  matchDataMenuOpen = Boolean(open);
  elements.matchDataMenu.hidden = !matchDataMenuOpen;
  elements.matchDataMenuButton.setAttribute('aria-expanded', String(matchDataMenuOpen));
}

function toggleMatchDataMenu() {
  setMatchDataMenuOpen(!matchDataMenuOpen);
}

async function collectRiotMatchHistory(mode = 'recent') {
  setMatchDataMenuOpen(false);
  elements.collectRiotMatchesButton.disabled = true;
  elements.matchDataMenuButton.disabled = true;
  elements.collectSeasonRiotMatchesButton.disabled = true;
  elements.collectRiotMatchesButton.textContent = mode === 'season' ? 'Downloading season...' : 'Downloading...';

  try {
    logDebug('Manual Riot match history collection requested', { mode });
    const summary = await window.lcuApi.collectRiotMatchHistory({ mode });
    logDebug('Manual Riot match history collection completed', summary);
  } catch (error) {
    logWarn('Manual Riot match history collection failed', { message: error.message, stack: error.stack });
  } finally {
    const state = await window.lcuApi.getState();
    renderMatchHistoryStatus(state.matchHistoryStatus);
  }
}

window.lcuApi.onState(renderState);
elements.refreshButton.addEventListener('click', refresh);
elements.collectRiotMatchesButton.addEventListener('click', () => collectRiotMatchHistory('recent'));
elements.matchDataMenuButton.addEventListener('click', toggleMatchDataMenu);
elements.collectSeasonRiotMatchesButton.addEventListener('click', () => collectRiotMatchHistory('season'));
document.addEventListener('click', (event) => {
  if (!matchDataMenuOpen) return;
  if (event.target === elements.matchDataMenuButton || elements.matchDataMenu.contains(event.target)) return;
  setMatchDataMenuOpen(false);
});
elements.tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveView(button.dataset.view));
});
elements.chooseLolDirButton.addEventListener('click', chooseLolInstallDir);
elements.saveLolDirButton.addEventListener('click', saveLolInstallDir);
elements.saveRiotApiTokenButton.addEventListener('click', saveRiotApiToken);
elements.saveRiotPlatformRegionButton.addEventListener('click', saveRiotPlatformRegion);
elements.saveChampionPoolButton.addEventListener('click', saveChampionPool);
elements.championPoolSearchInput.addEventListener('input', renderChampionPool);
elements.weakChampionSampleSelect.addEventListener('change', () => {
  weakChampionMinGames = getWeakChampionMinGames();
  logDebug('Weak champion sample filter changed', { minGames: weakChampionMinGames });
  renderCounters();
});

setActiveView(activeView);
window.lcuApi.getState().then(renderState);
window.lcuApi.getSettings().then(renderSettings);
window.lcuApi.getChampionPool().then((savedChampionPool) => {
  championPool = normalizeChampionPool(savedChampionPool);
  championPoolDirty = false;
  renderChampionPool();
});
