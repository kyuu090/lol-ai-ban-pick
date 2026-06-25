const elements = {
  windowTitlebar: document.querySelector('#windowTitlebar'),
  windowMinimizeButton: document.querySelector('#windowMinimizeButton'),
  windowMaximizeButton: document.querySelector('#windowMaximizeButton'),
  windowCloseButton: document.querySelector('#windowCloseButton'),
  refreshButton: document.querySelector('#refreshButton'),
  collectRiotMatchesButton: document.querySelector('#collectRiotMatchesButton'),
  matchDataMenuButton: document.querySelector('#matchDataMenuButton'),
  matchDataMenu: document.querySelector('#matchDataMenu'),
  collectSeasonRiotMatchesButton: document.querySelector('#collectSeasonRiotMatchesButton'),
  matchDataCount: document.querySelector('#matchDataCount'),
  matchDataRange: document.querySelector('#matchDataRange'),
  matchDataSeasonHint: document.querySelector('#matchDataSeasonHint'),
  matchDataProgress: document.querySelector('#matchDataProgress'),
  tabButtons: document.querySelectorAll('.tab-button'),
  draftTabButton: document.querySelector('#draftTabButton'),
  draftView: document.querySelector('#draftView'),
  championPoolView: document.querySelector('#championPoolView'),
  statsView: document.querySelector('#statsView'),
  statsSubtabButtons: document.querySelectorAll('.stats-subtab'),
  playedStatsView: document.querySelector('#playedStatsView'),
  opponentStatsView: document.querySelector('#opponentStatsView'),
  debugView: document.querySelector('#debugView'),
  settingsView: document.querySelector('#settingsView'),
  laneTabs: document.querySelector('#laneTabs'),
  playedStatsLaneTabs: document.querySelector('#playedStatsLaneTabs'),
  opponentStatsLaneTabs: document.querySelector('#opponentStatsLaneTabs'),
  playedStatsSampleFilter: document.querySelector('#playedStatsSampleFilter'),
  opponentStatsSampleFilter: document.querySelector('#opponentStatsSampleFilter'),
  championPoolSearchInput: document.querySelector('#championPoolSearchInput'),
  championPoolPickerGrid: document.querySelector('#championPoolPickerGrid'),
  championPoolPickerEmpty: document.querySelector('#championPoolPickerEmpty'),
  saveChampionPoolButton: document.querySelector('#saveChampionPoolButton'),
  championPoolListTitle: document.querySelector('#championPoolListTitle'),
  championPoolList: document.querySelector('#championPoolList'),
  championPoolEmpty: document.querySelector('#championPoolEmpty'),
  playedStatsSampleSelect: document.querySelector('#playedStatsSampleSelect'),
  playedStatsSortGamesButton: document.querySelector('#playedStatsSortGamesButton'),
  playedStatsSortWinRateButton: document.querySelector('#playedStatsSortWinRateButton'),
  playedStatsTableBody: document.querySelector('#playedStatsTableBody'),
  playedStatsEmpty: document.querySelector('#playedStatsEmpty'),
  opponentStatsSampleSelect: document.querySelector('#opponentStatsSampleSelect'),
  opponentStatsSortGamesButton: document.querySelector('#opponentStatsSortGamesButton'),
  opponentStatsSortWinRateButton: document.querySelector('#opponentStatsSortWinRateButton'),
  opponentStatsTableBody: document.querySelector('#opponentStatsTableBody'),
  opponentStatsEmpty: document.querySelector('#opponentStatsEmpty'),
  championPoolMessage: document.querySelector('#championPoolMessage'),
  lolInstallDirInput: document.querySelector('#lolInstallDirInput'),
  riotPlatformRegionSelect: document.querySelector('#riotPlatformRegionSelect'),
  riotRegionalRouteStatus: document.querySelector('#riotRegionalRouteStatus'),
  themeModeSelect: document.querySelector('#themeModeSelect'),
  themeModeStatus: document.querySelector('#themeModeStatus'),
  chooseLolDirButton: document.querySelector('#chooseLolDirButton'),
  saveLolDirButton: document.querySelector('#saveLolDirButton'),
  saveRiotPlatformRegionButton: document.querySelector('#saveRiotPlatformRegionButton'),
  saveThemeModeButton: document.querySelector('#saveThemeModeButton'),
  settingsMessage: document.querySelector('#settingsMessage'),
  loggedOutView: document.querySelector('#loggedOutView'),
  loggedInView: document.querySelector('#loggedInView'),
  inGameView: document.querySelector('#inGameView'),
  inGameSelfPortrait: document.querySelector('#inGameSelfPortrait'),
  inGameChampionName: document.querySelector('#inGameChampionName'),
  inGameChampionDetail: document.querySelector('#inGameChampionDetail'),
  inGameSelfStats: document.querySelector('#inGameSelfStats'),
  inGameLaneMatchupAnalysis: document.querySelector('#inGameLaneMatchupAnalysis'),
  inGameFinalCompositionAnalysis: document.querySelector('#inGameFinalCompositionAnalysis'),
  champSelectView: document.querySelector('#champSelectView'),
  helloMessage: document.querySelector('#helloMessage'),
  allyBans: document.querySelector('#allyBans'),
  enemyBans: document.querySelector('#enemyBans'),
  allyTeam: document.querySelector('#allyTeam'),
  enemyTeam: document.querySelector('#enemyTeam'),
  currentAction: document.querySelector('#currentAction'),
  currentPick: document.querySelector('#currentPick'),
  draftSelfSummary: document.querySelector('#draftSelfSummary'),
  banInsightPanel: document.querySelector('#banInsightPanel'),
  draftAiAnalysisPanel: document.querySelector('#draftAiAnalysisPanel'),
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

let activeView = 'draft';
let activeStatsView = 'played';
let activeChampionPoolLane = 'top';
let activePlayedStatsLane = 'top';
let activeOpponentStatsLane = 'top';
let playedStatsMinGames = 5;
let opponentStatsMinGames = 5;
let playedStatsSortKey = 'winRate';
let opponentStatsSortKey = 'winRate';
let playedStatsSortDirection = 'desc';
let opponentStatsSortDirection = 'asc';
let expandedPlayedStatsChampionId = null;
let expandedOpponentStatsChampionId = null;
let shouldOpenFirstPlayedStatsRow = true;
let shouldOpenFirstOpponentStatsRow = true;
let banInsightMinGames = 5;
let championsById = {};
let championPool = {};
let matchHistoryChampionStats = [];
let matchHistoryEnemyChampionStats = [];
let matchHistoryLaneOpponentStats = [];
let matchHistorySelfVsLaneOpponentStats = [];
let championPoolDirty = false;
let lastChampionPickerRenderKey = '';
let lastChampionPoolListRenderKey = '';
let markedLaneOpponentCellId = null;
let lastRenderedState = null;
let lastChampSelectSnapshot = null;
let wasInChampSelect = false;
let draftAiAnalysisStatus = 'idle';
let draftAiAnalysisNotes = [];
let draftAiAnalysisRequestKey = null;
let draftAiAnalysisError = '';
let draftAiAnalysisPhase = null;
let finalCompositionAnalysisStatus = 'idle';
let finalCompositionAnalysisNotes = [];
let finalCompositionAnalysisRequestKey = null;
let finalCompositionAnalysisError = '';
const championIconCache = new Map();
const championIconQueue = [];
const ICON_REQUEST_CONCURRENCY = 4;
const CHAMPION_ICON_RETRY_DELAY_MS = 12000;
let activeChampionIconRequests = 0;
const championIconObserver = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(handleChampionIconIntersections, { rootMargin: '180px' })
  : null;
let matchHistoryButtonTimer = null;
let dismissedMatchHistoryButtonKey = null;
let matchDataMenuOpen = false;
const {
  collectBans,
  createFinalCompositionDraftContext,
  createInGameContext,
  createPickPhaseDraftContext,
  getActiveAction,
  getBestIntoOpponentStats,
  getDraftPanelState,
  getMemberChampionId,
  getPhase,
  getPendingLabel,
  getPlannedPickThreatStats,
  getSummonerName,
  isChampSelectFinalization,
  normalizePosition,
  normalizeChampionPool,
  positionLabel,
  collectUnavailableChampionReasons,
  sortPickPoolCandidates,
  sortBestWinRateStats,
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
const BAN_INSIGHT_LIMIT = 3;
const BAN_INSIGHT_SAMPLE_OPTIONS = [0, 3, 5, 10, 20];

function stringify(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function logDebug(message, details) {
  window.lcuApi?.log?.('debug', message, details);
}

function logWarn(message, details) {
  window.lcuApi?.log?.('warn', message, details);
}

function normalizeThemeMode(themeMode) {
  return ['system', 'light', 'dark'].includes(themeMode) ? themeMode : 'system';
}

function applyThemeMode(themeMode) {
  const normalizedThemeMode = normalizeThemeMode(themeMode);
  if (normalizedThemeMode === 'system') {
    document.documentElement.removeAttribute('data-theme');
    return;
  }

  document.documentElement.dataset.theme = normalizedThemeMode;
}

function describeThemeMode(themeMode) {
  const normalizedThemeMode = normalizeThemeMode(themeMode);
  if (normalizedThemeMode === 'light') return 'ライトモードを使用します。';
  if (normalizedThemeMode === 'dark') return 'ダークモードを使用します。';
  return 'OSの表示モードに合わせます。';
}

function renderWindowMaximizedState(isMaximized) {
  elements.windowMaximizeButton.textContent = isMaximized ? '❐' : '□';
  elements.windowMaximizeButton.setAttribute('aria-label', isMaximized ? '元に戻す' : '最大化');
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

function createChampionStatsElement(stats, className = 'pool-champion-stats', options = {}) {
  const container = document.createElement('div');
  container.className = className;
  const includeGames = options.includeGames !== false;

  if (!stats || !stats.games) {
    if (includeGames) {
      container.append(createPickPoolStatChip('Games', 'No games'));
    }
    return container;
  }

  const wins = Number(stats.wins || 0);
  const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
  [
    ...(includeGames ? [['Games', `${stats.games}`]] : []),
    ['W-L', `${wins}-${losses}`],
    ['WR', formatPercent(stats.winRate)],
    ['KDA', formatAverageKda(stats)]
  ].forEach(([label, value]) => {
    container.append(createPickPoolStatChip(label, value));
  });

  return container;
}

function getPlayedStatsMinGames() {
  const selectedGames = Number(elements.playedStatsSampleSelect?.value);
  return Number.isInteger(selectedGames) && selectedGames > 0 ? selectedGames : playedStatsMinGames;
}

function getOpponentStatsMinGames() {
  const selectedGames = Number(elements.opponentStatsSampleSelect?.value);
  return Number.isInteger(selectedGames) && selectedGames > 0 ? selectedGames : opponentStatsMinGames;
}

function loadChampionIcon(img, championId) {
  const id = Number(championId);
  if (!id || !window.lcuApi?.getChampionIcon) return;

  img.dataset.championId = String(id);

  const cached = championIconCache.get(id);
  if (typeof cached === 'string') {
    setChampionIconSrc(img, id, cached);
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

function loadChampionIconEager(img, championId) {
  const id = Number(championId);
  if (!id || !window.lcuApi?.getChampionIcon) return;

  img.dataset.championId = String(id);

  const cached = championIconCache.get(id);
  if (typeof cached === 'string') {
    setChampionIconSrc(img, id, cached);
    return;
  }

  if (cached === null) return;

  attachChampionIcon(img, id, cached || enqueueChampionIconRequest(id));
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
      setChampionIconSrc(img, id, src);
    }
  });
}

function setChampionIconSrc(img, id, src) {
  img.onerror = () => {
    if (img.dataset.championId !== String(id)) return;

    markChampionIconMissing(id);
    img.removeAttribute('src');
  };
  img.src = src;
}

function markChampionIconMissing(id) {
  championIconCache.set(id, null);
  setTimeout(() => {
    if (championIconCache.get(id) === null) {
      championIconCache.delete(id);
    }
  }, CHAMPION_ICON_RETRY_DELAY_MS);
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
        if (src) {
          championIconCache.set(id, src);
        } else {
          markChampionIconMissing(id);
        }
        resolve(src || null);
      })
      .catch(() => {
        markChampionIconMissing(id);
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
  syncDraftAutoFocus(state);
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
  renderMatchDataSummary(state.matchHistorySummary, state.settings);
  renderSettings(state.settings);
  renderChampionPool();
  renderPlayedChampionStats();
  renderLaneOpponentStats();
  renderDraft(state);
  renderDebug(state);
}

function syncDraftAutoFocus(state) {
  const { inChampSelect } = getDraftPanelState(state);
  elements.draftTabButton.classList.toggle('draft-live', inChampSelect);

  if (inChampSelect && !wasInChampSelect) {
    resetFinalCompositionAnalysis();
  }

  if (inChampSelect && !wasInChampSelect && activeView !== 'draft') {
    setActiveView('draft');
  }

  wasInChampSelect = inChampSelect;
}

function renderMatchDataSummary(summary, settings) {
  const matchCount = Number(summary?.normalizedMatches || 0);

  elements.matchDataRange.classList.remove('is-error');

  if (matchCount <= 0) {
    elements.matchDataCount.textContent = 'No data';
    elements.matchDataRange.textContent = '試合データが取得されていません';
    elements.matchDataSeasonHint.hidden = true;
    return;
  }

  const oldest = formatMatchDataDate(summary.oldestGameCreation);
  const newest = formatMatchDataDate(summary.newestGameCreation);
  elements.matchDataCount.textContent = `${matchCount} matches`;
  elements.matchDataRange.textContent = oldest && newest
    ? `${oldest} - ${newest}`
    : '期間不明';
  elements.matchDataSeasonHint.hidden = matchCount > 90;
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
    elements.matchDataSeasonHint.disabled = false;
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
    elements.matchDataSeasonHint.disabled = false;
    elements.collectRiotMatchesButton.textContent = 'Download recent match';
    renderMatchDataProgress(null);
    return;
  }

  elements.collectRiotMatchesButton.disabled = isActive;
  elements.matchDataMenuButton.disabled = isActive;
  elements.collectSeasonRiotMatchesButton.disabled = isActive;
  elements.matchDataSeasonHint.disabled = isActive;
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

  const themeMode = normalizeThemeMode(settings.themeMode);
  applyThemeMode(themeMode);

  if (settings.lolInstallDir && document.activeElement !== elements.lolInstallDirInput) {
    elements.lolInstallDirInput.value = settings.lolInstallDir;
  }

  renderRiotPlatformRegions(settings);
  if (document.activeElement !== elements.themeModeSelect) {
    elements.themeModeSelect.value = themeMode;
  }
  elements.themeModeStatus.textContent = describeThemeMode(themeMode);
  elements.riotRegionalRouteStatus.textContent = `ログイン先サーバ: ${settings.riotPlatformRegion || 'JP1'} / Match-V5 route: ${settings.riotRegionalRoute || 'ASIA'}`;
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

function createChampionOptionsRenderKey(options) {
  return options
    .map((champion) => [
      Number(champion.id) || 0,
      champion.name || '',
      champion.alias || '',
      champion.title || ''
    ].join(':'))
    .join('|');
}

function createChampionPoolStatsRenderKey(championIds, laneId) {
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

function updateChampionPickerSelection(selectedChampionIds) {
  elements.championPoolPickerGrid.querySelectorAll('.champion-picker-card').forEach((button) => {
    const championId = Number(button.dataset.championId);
    const selected = selectedChampionIds.has(championId);
    button.classList.toggle('selected', selected);
    button.title = selected ? `${championLabel(championId)} は登録済みです` : championTitle(championId);
  });
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

function renderPlayedStatsLaneTabs() {
  if (elements.playedStatsLaneTabs.childElementCount > 0) {
    elements.playedStatsLaneTabs.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.lane === activePlayedStatsLane);
    });
    return;
  }

  const buttons = CHAMPION_POOL_LANES.map((lane) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lane = lane.id;
    button.textContent = lane.label;
    button.className = `lane-tab${lane.id === activePlayedStatsLane ? ' active' : ''}`;
    button.addEventListener('click', () => {
      activePlayedStatsLane = lane.id;
      expandedPlayedStatsChampionId = null;
      shouldOpenFirstPlayedStatsRow = true;
      renderPlayedChampionStats();
    });
    return button;
  });

  elements.playedStatsLaneTabs.replaceChildren(...buttons);
}

function renderOpponentStatsLaneTabs() {
  if (elements.opponentStatsLaneTabs.childElementCount > 0) {
    elements.opponentStatsLaneTabs.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.lane === activeOpponentStatsLane);
    });
    return;
  }

  const buttons = CHAMPION_POOL_LANES.map((lane) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lane = lane.id;
    button.textContent = lane.label;
    button.className = `lane-tab${lane.id === activeOpponentStatsLane ? ' active' : ''}`;
    button.addEventListener('click', () => {
      activeOpponentStatsLane = lane.id;
      expandedOpponentStatsChampionId = null;
      shouldOpenFirstOpponentStatsRow = true;
      renderLaneOpponentStats();
    });
    return button;
  });

  elements.opponentStatsLaneTabs.replaceChildren(...buttons);
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

function renderPlayedChampionStatsLegacy() {
  const lane = CHAMPION_POOL_LANES.find((entry) => entry.id === activePlayedStatsLane) || CHAMPION_POOL_LANES[0];
  const position = getChampionPoolLanePosition(lane.id);
  const minGames = getPlayedStatsMinGames();
  renderPlayedStatsLaneTabs();

  const statsList = sortStatsTableRows(matchHistoryChampionStats.filter((stats) => (
    stats.queueGroup === 'all_sr_5v5' &&
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= minGames
  )), playedStatsSortKey, playedStatsSortDirection);

  renderStatsTable(
    elements.playedStatsTableBody,
    elements.playedStatsEmpty,
    statsList,
    'championId',
    '条件に合うチャンピオン実績がありません。'
  );
  renderStatsSortButtons('played');
}

function renderLaneOpponentStatsLegacy() {
  const lane = CHAMPION_POOL_LANES.find((entry) => entry.id === activeOpponentStatsLane) || CHAMPION_POOL_LANES[0];
  const position = getChampionPoolLanePosition(lane.id);
  const minGames = getOpponentStatsMinGames();
  renderOpponentStatsLaneTabs();

  const statsList = sortStatsTableRows(matchHistoryLaneOpponentStats.filter((stats) => (
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= minGames
  )), opponentStatsSortKey, opponentStatsSortDirection);

  renderStatsTable(
    elements.opponentStatsTableBody,
    elements.opponentStatsEmpty,
    statsList,
    'championId',
    '条件に合う対面データがありません。'
  );
  renderStatsSortButtons('opponents');
}

function sortStatsTableRows(statsList, sortKey, sortDirection = 'desc') {
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

    return championLabel(a.championId).localeCompare(championLabel(b.championId), 'en');
  });
}

function renderStatsTable(bodyElement, emptyElement, statsList, championIdKey, emptyText) {
  bodyElement.replaceChildren(...statsList.map((stats) => createStatsTableRow(stats, championIdKey)));
  emptyElement.hidden = statsList.length > 0;
  emptyElement.textContent = emptyText;
}

function createStatsTableRow(stats, championIdKey) {
  const row = document.createElement('tr');

  const championCell = document.createElement('th');
  championCell.scope = 'row';
  championCell.append(createInlineChampionName(stats[championIdKey], 'inline-champion-name stats-table-champion'));

  const gamesCell = document.createElement('td');
  gamesCell.textContent = String(Number(stats.games || 0));

  const winRateCell = document.createElement('td');
  winRateCell.textContent = formatPercent(stats.winRate);

  const kdaCell = document.createElement('td');
  kdaCell.textContent = formatAverageKda(stats);

  row.append(championCell, gamesCell, winRateCell, kdaCell);
  return row;
}

function renderStatsSortButtons(viewName) {
  const sortKey = viewName === 'opponents' ? opponentStatsSortKey : playedStatsSortKey;
  const sortDirection = viewName === 'opponents' ? opponentStatsSortDirection : playedStatsSortDirection;
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

function setStatsSort(viewName, sortKey) {
  if (viewName === 'opponents') {
    opponentStatsSortDirection = opponentStatsSortKey === sortKey && opponentStatsSortDirection === 'desc'
      ? 'asc'
      : 'desc';
    opponentStatsSortKey = sortKey;
    expandedOpponentStatsChampionId = null;
    shouldOpenFirstOpponentStatsRow = true;
    renderLaneOpponentStats();
    return;
  }

  playedStatsSortDirection = playedStatsSortKey === sortKey && playedStatsSortDirection === 'desc'
    ? 'asc'
    : 'desc';
  playedStatsSortKey = sortKey;
  expandedPlayedStatsChampionId = null;
  shouldOpenFirstPlayedStatsRow = true;
  renderPlayedChampionStats();
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
    '条件に合う対面データがありません。',
    { includeSelfPicks: true, position }
  );
}

function renderWeakChampionList(listElement, emptyElement, statsList, emptyText, options = {}) {
  listElement.replaceChildren(...statsList.map((stats) => createWeakChampionItem(stats, options)));
  emptyElement.hidden = statsList.length > 0;
  emptyElement.textContent = emptyText;
}

function createWeakChampionItem(stats, options = {}) {
  const item = document.createElement('li');
  item.className = `weak-champion-item${options.includeSelfPicks ? ' weak-lane-matchup-item' : ''}`;

  const name = document.createElement('span');
  name.className = 'weak-champion-name';
  name.append(createInlineChampionName(stats.championId));

  const detail = createWinRateStatsElement(stats, { includeKda: true });

  const main = document.createElement('div');
  main.className = 'weak-champion-main';
  if (options.includeSelfPicks) {
    main.append(createStatsSideBadge('ENEMY', 'enemy'));
  }
  main.append(name, detail);

  if (options.includeSelfPicks) {
    const selfPickSummary = createLaneSelfPickSummary(stats, options.position, { splitByWinRate: true });
    if (selfPickSummary) {
      item.append(selfPickSummary, main);
    } else {
      item.append(createStatsEmptySide('YOU', 'you', '自分のピック実績なし'), main);
    }
  } else {
    item.append(main);
  }
  return item;
}

function createLaneSelfPickSummary(opponentStats, position, options = {}) {
  const opponentChampionId = Number(opponentStats?.opponentChampionId || opponentStats?.championId) || 0;
  const normalizedPosition = String(position || opponentStats?.position || '').toUpperCase();
  if (!opponentChampionId || !normalizedPosition) return null;

  const matchupStats = matchHistorySelfVsLaneOpponentStats.filter((stats) => (
    Number(stats.opponentChampionId) === opponentChampionId &&
    String(stats.position || '').toUpperCase() === normalizedPosition &&
    Number(stats.games || 0) > 0
  ));
  if (!matchupStats.length) return null;

  const wonFirst = options.order === 'won-first';
  const splitByWinRate = options.splitByWinRate === true || wonFirst;
  const lostWith = matchupStats
    .filter((stats) => splitByWinRate ? Number(stats.winRate || 0) < 0.5 : getLosses(stats) > 0)
    .sort(compareWeakSelfPickStats)
    .slice(0, 2);
  const wonWith = matchupStats
    .filter((stats) => splitByWinRate ? Number(stats.winRate || 0) >= 0.5 : Number(stats.wins || 0) > 0)
    .sort(compareStrongSelfPickStats)
    .slice(0, 2);

  if (!lostWith.length && !wonWith.length) return null;

  const summary = document.createElement('div');
  summary.className = 'weak-self-pick-summary';
  summary.append(createStatsSideBadge('YOU', 'you'));

  if (wonFirst && wonWith.length) {
    summary.append(createWeakSelfPickRow('○', wonWith, 'won'));
  }
  if (lostWith.length) {
    summary.append(createWeakSelfPickRow('×', lostWith, 'lost'));
  }
  if (!wonFirst && wonWith.length) {
    summary.append(createWeakSelfPickRow('○', wonWith, 'won'));
  }

  return summary;
}

function compareWeakSelfPickStats(a, b) {
  return (
    (getLosses(b) - getLosses(a)) ||
    (Number(a.winRate || 0) - Number(b.winRate || 0)) ||
    (Number(b.games || 0) - Number(a.games || 0)) ||
    championLabel(a.championId).localeCompare(championLabel(b.championId), 'en')
  );
}

function compareStrongSelfPickStats(a, b) {
  return (
    (Number(b.wins || 0) - Number(a.wins || 0)) ||
    (Number(b.winRate || 0) - Number(a.winRate || 0)) ||
    (Number(b.games || 0) - Number(a.games || 0)) ||
    championLabel(a.championId).localeCompare(championLabel(b.championId), 'en')
  );
}

function getLosses(stats) {
  return Number.isFinite(stats?.losses)
    ? Number(stats.losses)
    : Math.max(0, Number(stats?.games || 0) - Number(stats?.wins || 0));
}

function createWeakSelfPickRow(symbol, statsList, tone) {
  const row = document.createElement('div');
  row.className = `weak-self-pick-row ${tone}`;

  const title = document.createElement('span');
  title.className = 'weak-self-pick-group-title';
  title.textContent = tone === 'lost' ? '苦手だったピック' : '勝てているピック';
  row.append(title);

  const tokens = document.createElement('div');
  tokens.className = 'weak-self-pick-group-tokens';
  statsList.forEach((stats) => {
    tokens.append(createWeakSelfPickToken(stats));
  });
  row.append(tokens);

  return row;
}

function createWeakSelfPickToken(stats) {
  const token = document.createElement('span');
  token.className = 'weak-self-pick-token';

  const champion = createInlineChampionName(stats.championId, 'inline-champion-name weak-self-pick-name');
  const record = document.createElement('b');
  record.textContent = formatWinLoss(stats);

  token.append(champion, record);
  return token;
}

function createStatsSideBadge(text, tone) {
  const badge = document.createElement('span');
  badge.className = `stats-side-badge ${tone}`;
  badge.textContent = text;
  return badge;
}

function createStatsEmptySide(text, tone, emptyText) {
  const side = document.createElement('div');
  side.className = 'weak-self-pick-summary stats-empty-side';
  side.append(createStatsSideBadge(text, tone));

  const note = document.createElement('span');
  note.className = 'stats-empty-side-note';
  note.textContent = emptyText;
  side.append(note);
  return side;
}

function formatWinLoss(stats) {
  const wins = Number(stats?.wins || 0);
  return `${wins}-${getLosses(stats)}`;
}

function renderStrengths() {
  const lane = CHAMPION_POOL_LANES.find((entry) => entry.id === activeStrengthLane) || CHAMPION_POOL_LANES[0];
  renderStrengthLaneTabs();
  renderStrongChampionLists(lane);
}

function renderStrongChampionLists(lane = getActiveChampionPoolLane()) {
  const minGames = getStrongChampionMinGames();
  const position = getChampionPoolLanePosition(lane.id);
  const championStats = sortBestWinRateStats(matchHistoryChampionStats.filter((stats) => (
    stats.queueGroup === 'all_sr_5v5' &&
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= minGames &&
    Number(stats.winRate || 0) > 0.5
  ))).slice(0, 8);
  const matchupStats = getStrongLaneMatchupStats(position, minGames).slice(0, 8);

  elements.strongLaneMatchupTitle.textContent = lane.label;
  renderStrongChampionList(
    elements.strongChampionList,
    elements.strongChampionEmpty,
    championStats,
    createStrongChampionItem,
    '条件に合うチャンピオン実績がありません。'
  );
  renderStrongChampionList(
    elements.strongLaneMatchupList,
    elements.strongLaneMatchupEmpty,
    matchupStats,
    createStrongLaneMatchupItem,
    '条件に合う対面データがありません。'
  );
}

function getStrongLaneMatchupStats(position, minGames) {
  const normalizedPosition = String(position || '').toUpperCase();
  const bestByOpponent = new Map();

  matchHistorySelfVsLaneOpponentStats
    .filter((stats) => (
      String(stats.position || '').toUpperCase() === normalizedPosition &&
      Number(stats.games || 0) >= minGames &&
      Number(stats.winRate || 0) > 0.5 &&
      Number(stats.wins || 0) > 0
    ))
    .forEach((stats) => {
      const opponentChampionId = Number(stats.opponentChampionId) || 0;
      if (opponentChampionId <= 0) return;

      const current = bestByOpponent.get(opponentChampionId);
      if (!current || compareStrongMatchupStats(stats, current) < 0) {
        bestByOpponent.set(opponentChampionId, stats);
      }
    });

  return Array.from(bestByOpponent.values()).sort(compareStrongMatchupStats);
}

function compareStrongMatchupStats(a, b) {
  return (
    (Number(b.wins || 0) - Number(a.wins || 0)) ||
    (Number(b.winRate || 0) - Number(a.winRate || 0)) ||
    (Number(b.games || 0) - Number(a.games || 0)) ||
    championLabel(a.opponentChampionId).localeCompare(championLabel(b.opponentChampionId), 'en') ||
    championLabel(a.championId).localeCompare(championLabel(b.championId), 'en')
  );
}

function renderStrongChampionList(listElement, emptyElement, statsList, createItem, emptyText) {
  listElement.replaceChildren(...statsList.map(createItem));
  emptyElement.hidden = statsList.length > 0;
  emptyElement.textContent = emptyText;
}

function createStrongChampionItem(stats) {
  const item = document.createElement('li');
  item.className = 'strong-champion-item';

  const name = document.createElement('span');
  name.className = 'strong-champion-name';
  name.append(createInlineChampionName(stats.championId));

  const detail = createWinRateStatsElement(stats, { includeKda: true });

  item.append(name, detail);
  return item;
}

function createStrongLaneMatchupItem(stats) {
  const item = document.createElement('li');
  item.className = 'strong-champion-item strong-matchup-item strong-lane-matchup-item';

  const main = document.createElement('div');
  main.className = 'strong-champion-main';

  const selfPick = document.createElement('span');
  selfPick.className = 'strong-champion-name';
  selfPick.append(createInlineChampionName(stats.championId));

  const detail = createWinRateStatsElement(stats, { includeKda: true });
  main.append(createStatsSideBadge('YOU', 'you'), selfPick, detail);

  const opponent = document.createElement('div');
  opponent.className = 'weak-self-pick-summary strong-opponent-summary';
  opponent.append(createStatsSideBadge('ENEMY', 'enemy'));
  opponent.append(createWeakSelfPickToken({
    championId: stats.opponentChampionId,
    wins: stats.wins,
    losses: getLosses(stats)
  }));

  item.append(main, opponent);
  return item;
}

function renderLaneOpponentStats() {
  const lane = CHAMPION_POOL_LANES.find((entry) => entry.id === activeOpponentStatsLane) || CHAMPION_POOL_LANES[0];
  const position = getChampionPoolLanePosition(lane.id);
  const minGames = getOpponentStatsMinGames();
  renderOpponentStatsLaneTabs();

  const statsList = sortStatsTableRows(matchHistoryLaneOpponentStats.filter((stats) => (
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= minGames
  )), opponentStatsSortKey, opponentStatsSortDirection);

  if (!statsList.some((stats) => Number(stats.championId) === expandedOpponentStatsChampionId)) {
    expandedOpponentStatsChampionId = null;
  }
  if (shouldOpenFirstOpponentStatsRow && !expandedOpponentStatsChampionId && statsList.length > 0) {
    expandedOpponentStatsChampionId = Number(statsList[0].championId);
  }
  shouldOpenFirstOpponentStatsRow = false;

  renderOpponentStatsTable(statsList, position);
  renderStatsSortButtons('opponents');
}

function renderOpponentStatsTable(statsList, position) {
  const rows = [];
  statsList.forEach((stats) => {
    const championId = Number(stats.championId);
    const selected = championId === expandedOpponentStatsChampionId;
    const row = createStatsTableRow(stats, 'championId');
    row.classList.add('stats-table-clickable-row');
    row.classList.toggle('expanded', selected);
    row.title = `${championLabel(championId)} に対する自分ピックを表示`;
    row.addEventListener('click', () => {
      expandedOpponentStatsChampionId = selected ? null : championId;
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

function createOpponentPickBreakdownRow(opponentChampionId, position) {
  const row = document.createElement('tr');
  row.className = 'stats-opponent-detail-row';

  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.append(createOpponentPickBreakdown(opponentChampionId, position));

  row.append(cell);
  return row;
}

function createOpponentPickBreakdown(opponentChampionId, position) {
  const container = document.createElement('div');
  container.className = 'stats-opponent-detail';

  const normalizedPosition = String(position || '').toUpperCase();
  const matchupStats = matchHistorySelfVsLaneOpponentStats.filter((stats) => (
    Number(stats.opponentChampionId) === Number(opponentChampionId) &&
    String(stats.position || '').toUpperCase() === normalizedPosition &&
    Number(stats.games || 0) > 0
  ));

  const winning = matchupStats
    .filter((stats) => getWinMargin(stats) > 0)
    .sort(compareWinningMatchupStats)
    .slice(0, 3);
  const losing = matchupStats
    .filter((stats) => getLossMargin(stats) > 0)
    .sort(compareLosingMatchupStats)
    .slice(0, 3);

  container.append(
    createOpponentPickBreakdownGroup('勝ち越しが多い自分ピック', winning, 'won'),
    createOpponentPickBreakdownGroup('負け越しが多い自分ピック', losing, 'lost')
  );
  return container;
}

function createOpponentPickBreakdownGroup(title, statsList, tone) {
  return createMatchupBreakdownGroup(title, statsList, tone, 'championId');
}

function createMatchupBreakdownGroup(title, statsList, tone, championIdKey) {
  const group = document.createElement('section');
  group.className = `stats-opponent-detail-group ${tone}`;

  const heading = document.createElement('h4');
  heading.textContent = title;
  group.append(heading);

  if (!statsList.length) {
    const empty = document.createElement('p');
    empty.className = 'stats-opponent-detail-empty';
    empty.textContent = '該当するピックはありません。';
    group.append(empty);
    return group;
  }

  const list = document.createElement('div');
  list.className = 'stats-opponent-detail-picks';
  statsList.forEach((stats) => {
    list.append(createMatchupBreakdownToken(stats, Number(stats[championIdKey]), tone));
  });
  group.append(list);
  return group;
}

function createOpponentPickBreakdownToken(stats, tone) {
  return createMatchupBreakdownToken(stats, Number(stats.championId), tone);
}

function createMatchupBreakdownToken(stats, championId, tone) {
  const token = document.createElement('span');
  token.className = `stats-opponent-detail-pick ${tone}`;

  const champion = createInlineChampionName(championId, 'inline-champion-name weak-self-pick-name');
  const record = document.createElement('b');
  record.textContent = formatWinLoss(stats);

  const margin = document.createElement('small');
  margin.textContent = tone === 'won' ? `+${getWinMargin(stats)}` : `-${getLossMargin(stats)}`;

  token.append(champion, record, margin);
  return token;
}

function getWinMargin(stats) {
  return Number(stats?.wins || 0) - getLosses(stats);
}

function getLossMargin(stats) {
  return getLosses(stats) - Number(stats?.wins || 0);
}

function compareWinningMatchupStats(a, b) {
  return (
    (getWinMargin(b) - getWinMargin(a)) ||
    (Number(b.wins || 0) - Number(a.wins || 0)) ||
    (Number(b.games || 0) - Number(a.games || 0)) ||
    championLabel(a.championId).localeCompare(championLabel(b.championId), 'en')
  );
}

function compareLosingMatchupStats(a, b) {
  return (
    (getLossMargin(b) - getLossMargin(a)) ||
    (getLosses(b) - getLosses(a)) ||
    (Number(b.games || 0) - Number(a.games || 0)) ||
    championLabel(a.championId).localeCompare(championLabel(b.championId), 'en')
  );
}

function renderPlayedChampionStats() {
  const lane = CHAMPION_POOL_LANES.find((entry) => entry.id === activePlayedStatsLane) || CHAMPION_POOL_LANES[0];
  const position = getChampionPoolLanePosition(lane.id);
  const minGames = getPlayedStatsMinGames();
  renderPlayedStatsLaneTabs();

  const statsList = sortStatsTableRows(matchHistoryChampionStats.filter((stats) => (
    stats.queueGroup === 'all_sr_5v5' &&
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= minGames
  )), playedStatsSortKey, playedStatsSortDirection);

  if (!statsList.some((stats) => Number(stats.championId) === expandedPlayedStatsChampionId)) {
    expandedPlayedStatsChampionId = null;
  }
  if (shouldOpenFirstPlayedStatsRow && !expandedPlayedStatsChampionId && statsList.length > 0) {
    expandedPlayedStatsChampionId = Number(statsList[0].championId);
  }
  shouldOpenFirstPlayedStatsRow = false;

  renderPlayedStatsTable(statsList, position);
  renderStatsSortButtons('played');
}

function renderPlayedStatsTable(statsList, position) {
  const rows = [];
  statsList.forEach((stats) => {
    const championId = Number(stats.championId);
    const selected = championId === expandedPlayedStatsChampionId;
    const row = createStatsTableRow(stats, 'championId');
    row.classList.add('stats-table-clickable-row');
    row.classList.toggle('expanded', selected);
    row.title = `${championLabel(championId)} の対面別成績を表示`;
    row.addEventListener('click', () => {
      expandedPlayedStatsChampionId = selected ? null : championId;
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

function createPlayedPickBreakdownRow(championId, position) {
  const row = document.createElement('tr');
  row.className = 'stats-opponent-detail-row';

  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.append(createPlayedPickBreakdown(championId, position));

  row.append(cell);
  return row;
}

function createPlayedPickBreakdown(championId, position) {
  const container = document.createElement('div');
  container.className = 'stats-opponent-detail';

  const normalizedPosition = String(position || '').toUpperCase();
  const matchupStats = matchHistorySelfVsLaneOpponentStats.filter((stats) => (
    Number(stats.championId) === Number(championId) &&
    String(stats.position || '').toUpperCase() === normalizedPosition &&
    Number(stats.games || 0) > 0
  ));

  const strongInto = matchupStats
    .filter((stats) => getWinMargin(stats) > 0)
    .sort(compareWinningMatchupStats)
    .slice(0, 3);
  const weakInto = matchupStats
    .filter((stats) => getLossMargin(stats) > 0)
    .sort(compareLosingMatchupStats)
    .slice(0, 3);

  container.append(
    createMatchupBreakdownGroup('得意な対面', strongInto, 'won', 'opponentChampionId'),
    createMatchupBreakdownGroup('苦手な対面', weakInto, 'lost', 'opponentChampionId')
  );
  return container;
}

function renderStatus(state) {
  elements.lcuStatus.textContent = state.lcuStatus ?? '-';
  elements.websocketStatus.textContent = state.websocketStatus ?? '-';
  elements.gameflowPhase.textContent = getPhase(state) ?? (stringify(state.gameflowPhase).replace(/^"|"$/g, '') || '-');
  elements.updatedAt.textContent = formatDate(state.updatedAt);
  elements.errorMessage.textContent = state.error ?? '';
}

function renderDraft(state) {
  const { champSelect, loggedIn, inGame, inChampSelect } = getDraftPanelState(state);

  showOnlyDraftPanel(loggedIn, inChampSelect, inGame);

  if (!inChampSelect) {
    elements.champSelectView.classList.remove('local-turn');
    markedLaneOpponentCellId = null;
    resetDraftAiAnalysis();
  }

  if (!loggedIn) return;

  elements.helloMessage.textContent = `こんにちは ${getSummonerName(state.summoner)}`;

  if (inChampSelect) {
    lastChampSelectSnapshot = champSelect;
    renderChampSelect(champSelect, state.gameflowPhase);
  } else if (inGame) {
    renderInGame(state);
  }
}

function showOnlyDraftPanel(loggedIn, inChampSelect, inGame) {
  elements.loggedOutView.hidden = loggedIn;
  elements.loggedInView.hidden = !loggedIn || inChampSelect || inGame;
  elements.champSelectView.hidden = !loggedIn || !inChampSelect || inGame;
  elements.inGameView.hidden = !loggedIn || !inGame;
}

function renderInGame(state) {
  const context = createInGameContext({
    champSelect: lastChampSelectSnapshot,
    summonerName: getSummonerName(state.summoner),
    matchupStats: matchHistorySelfVsLaneOpponentStats
  });

  renderInGameSelfCard(context);
  renderInGameLaneMatchupAnalysis(state.laneMatchupAnalysis);
  renderInGameFinalCompositionAnalysis();
}

function renderInGameSelfCard({ championId, position, summonerName }) {
  elements.inGameSelfPortrait.replaceChildren();

  if (championId > 0) {
    const image = document.createElement('img');
    image.alt = championLabel(championId);
    loadChampionIcon(image, championId);
    elements.inGameSelfPortrait.append(image);
  } else {
    elements.inGameSelfPortrait.textContent = '?';
  }

  elements.inGameChampionName.textContent = championId > 0 ? championLabel(championId) : '試合中です';
  elements.inGameChampionDetail.textContent = championId > 0
    ? `${positionLabel(position)} / ${summonerName || 'Summoner'}`
    : 'ドラフト情報が取得できた試合では、ここに今回のピックメモを表示します。';

  const stats = championId > 0 ? getChampionRoleDisplayStats(championId, position) : null;
  elements.inGameSelfStats.replaceChildren();
  elements.inGameSelfStats.append(createInGameStatsSummary(stats, position));
}

function createInGameStatsSummary(stats, position) {
  const container = document.createElement('div');
  container.className = 'in-game-self-stats';

  if (!stats || !stats.games) {
    container.append(createPickPoolStatChip('Games', `No ${positionLabel(position)}`));
    container.append(createPickPoolStatChip('Focus', 'Fresh run'));
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

function renderChampSelect(champSelect, gameflowPhase) {
  const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
  const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
  const { allyBans, enemyBans } = collectBans(champSelect, allyTeam, enemyTeam);
  const localCellId = champSelect?.localPlayerCellId;
  const activeAction = getActiveAction(champSelect, localCellId);
  const localMember = allyTeam.find((member) => member.cellId === localCellId);
  const isLocalTurn = activeAction?.actorCellId === localCellId;
  const isDraftActionPhase = String(champSelect?.timer?.phase || '').toUpperCase() === 'BAN_PICK';
  const isLocalPickTurn = isDraftActionPhase && Boolean(activeAction?.isInProgress) && isLocalTurn && activeAction?.type === 'pick';
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
  if (isLocalPickTurn) {
    requestDraftAiAnalysisIfNeeded(champSelect, localMember, activeAction);
  }
  if (isChampSelectFinalization(champSelect, gameflowPhase)) {
    requestFinalCompositionAnalysisIfNeeded(champSelect, localMember);
  }
  renderDraftAiAnalysis(draftAiAnalysisStatus);
}

function resetDraftAiAnalysis() {
  draftAiAnalysisStatus = 'idle';
  draftAiAnalysisNotes = [];
  draftAiAnalysisRequestKey = null;
  draftAiAnalysisError = '';
  draftAiAnalysisPhase = null;
}

function resetFinalCompositionAnalysis() {
  finalCompositionAnalysisStatus = 'idle';
  finalCompositionAnalysisNotes = [];
  finalCompositionAnalysisRequestKey = null;
  finalCompositionAnalysisError = '';
}

function requestDraftAiAnalysisIfNeeded(champSelect, localMember, activeAction) {
  const draftContext = createPickPhaseDraftContext({
    champSelect,
    localMember,
    championPool,
    championLabel
  });
  requestDraftAiAnalysis(draftContext, activeAction);
}

function requestFinalCompositionAnalysisIfNeeded(champSelect, localMember) {
  const draftContext = createFinalCompositionDraftContext({
    champSelect,
    localMember,
    championLabel
  });
  requestDraftAiAnalysis(draftContext);
}

function requestDraftAiAnalysis(draftContext, activeAction = null) {
  if (!draftContext) return;

  const requestPhase = draftContext.phase || null;
  const requestAnalysis = requestPhase === 'final_composition'
    ? window.lcuApi?.requestFinalCompositionAnalysis
    : window.lcuApi?.requestPickPhaseAnalysis;
  if (!requestAnalysis) return;

  const requestKey = createDraftAiAnalysisRequestKey(activeAction, draftContext);
  if (requestPhase === 'final_composition') {
    if (finalCompositionAnalysisStatus === 'requesting' && finalCompositionAnalysisRequestKey === requestKey) return;
    if (finalCompositionAnalysisStatus === 'ready' && finalCompositionAnalysisRequestKey === requestKey) return;
    if (finalCompositionAnalysisStatus === 'error' && finalCompositionAnalysisRequestKey === requestKey) return;
  } else if (draftAiAnalysisStatus === 'ready' && draftAiAnalysisPhase === requestPhase) {
    return;
  }

  if (draftAiAnalysisStatus === 'requesting' && draftAiAnalysisRequestKey === requestKey) return;
  if (draftAiAnalysisStatus === 'error' && draftAiAnalysisRequestKey === requestKey) return;

  if (requestPhase === 'final_composition') {
    finalCompositionAnalysisStatus = 'requesting';
    finalCompositionAnalysisNotes = [];
    finalCompositionAnalysisError = '';
    finalCompositionAnalysisRequestKey = requestKey;
    renderInGameFinalCompositionAnalysis();
  }

  draftAiAnalysisStatus = 'requesting';
  draftAiAnalysisNotes = [];
  draftAiAnalysisError = '';
  draftAiAnalysisRequestKey = requestKey;
  draftAiAnalysisPhase = requestPhase;
  logDebug('Draft AI analysis request started', { requestKey, draftContext });

  requestAnalysis(draftContext)
    .then((response) => {
      const notes = parseDraftAiAnalysisNotes(response);
      if (requestPhase === 'final_composition') {
        if (finalCompositionAnalysisRequestKey !== requestKey) return;
        finalCompositionAnalysisNotes = notes;
        finalCompositionAnalysisStatus = notes.length ? 'ready' : 'error';
        finalCompositionAnalysisError = notes.length ? '' : 'AI分析を表示できませんでした。';
        renderInGameFinalCompositionAnalysis();
      }
      if (draftAiAnalysisRequestKey === requestKey) {
        draftAiAnalysisNotes = notes;
        draftAiAnalysisStatus = notes.length ? 'ready' : 'error';
        draftAiAnalysisError = notes.length ? '' : 'AI分析を表示できませんでした。';
        renderDraftAiAnalysis(draftAiAnalysisStatus);
      }
      logDebug('Draft AI analysis response received', { requestKey, notes: notes.length });
    })
    .catch((error) => {
      const errorMessage = createDraftAiAnalysisErrorMessage(error);
      if (requestPhase === 'final_composition' && finalCompositionAnalysisRequestKey === requestKey) {
        finalCompositionAnalysisStatus = 'error';
        finalCompositionAnalysisError = errorMessage;
        renderInGameFinalCompositionAnalysis();
      }
      if (draftAiAnalysisRequestKey === requestKey) {
        draftAiAnalysisStatus = 'error';
        draftAiAnalysisError = errorMessage;
        renderDraftAiAnalysis(draftAiAnalysisStatus);
      }
      logDebug('Draft AI analysis request failed', {
        requestKey,
        error: error?.message || String(error)
      });
    });
}

function createDraftAiAnalysisRequestKey(activeAction, draftContext) {
  return JSON.stringify({
    phase: draftContext?.phase ?? null,
    actionId: activeAction?.id ?? null,
    actorCellId: activeAction?.actorCellId ?? null,
    draftContext
  });
}

function createDraftAiAnalysisErrorMessage(error) {
  const message = String(error?.message || '');
  if (message.includes('429')) return 'AI分析のリクエストが混み合っています。少し待ってから再度お試しください。';
  if (message.includes('400')) return 'AI分析に必要なドラフト情報が不足しています。';
  return 'AI分析を取得できませんでした。';
}

function renderDraftAiAnalysis(status) {
  if (!elements.draftAiAnalysisPanel) return;

  const panel = elements.draftAiAnalysisPanel;
  panel.replaceChildren();

  const header = document.createElement('div');
  header.className = 'draft-ai-analysis-header';

  const titleBlock = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'AI Analysis';
  const title = document.createElement('h3');
  title.textContent = draftAiAnalysisPhase === 'final_composition' ? '最終構成分析' : 'バンピック分析';
  titleBlock.append(eyebrow, title);

  const badge = document.createElement('span');
  badge.className = `draft-ai-analysis-badge ${status}`;
  badge.textContent = status === 'ready' ? 'DONE' : status === 'requesting' ? 'ASKING' : status === 'error' ? 'ERROR' : 'WAITING';
  header.append(titleBlock, badge);
  panel.append(header);

  if (status === 'requesting') {
    panel.append(createDraftAiAnalysisStatus(draftAiAnalysisPhase === 'final_composition'
      ? 'AIに最終構成を分析依頼中・・'
      : 'AIに分析を依頼中・・'));
    return;
  }

  if (status === 'error') {
    panel.append(createDraftAiAnalysisStatus(draftAiAnalysisError || 'AI分析を取得できませんでした。'));
    return;
  }

  if (status !== 'ready') {
    panel.append(createDraftAiAnalysisStatus('AI分析を待機中・・'));
    return;
  }

  const notes = draftAiAnalysisNotes;
  if (!notes.length) {
    panel.append(createDraftAiAnalysisStatus('AI分析を表示できませんでした。'));
    return;
  }

  const list = document.createElement('div');
  list.className = 'draft-ai-analysis-notes';
  notes.forEach((note) => {
    const item = document.createElement('article');
    item.className = 'draft-ai-analysis-note';

    const noteTitle = document.createElement('strong');
    noteTitle.textContent = note.title;

    const body = document.createElement('p');
    body.textContent = note.body;

    item.append(noteTitle, body);
    list.append(item);
  });
  panel.append(list);
}

function renderInGameFinalCompositionAnalysis() {
  const panel = elements.inGameFinalCompositionAnalysis;
  if (!panel) return;

  panel.replaceChildren();

  const header = document.createElement('div');
  header.className = 'in-game-ai-analysis-header';

  const titleBlock = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'AI Analysis';
  const title = document.createElement('h4');
  title.textContent = '最終構成分析';
  titleBlock.append(eyebrow, title);

  const badge = document.createElement('span');
  badge.className = `draft-ai-analysis-badge ${finalCompositionAnalysisStatus}`;
  badge.textContent = finalCompositionAnalysisStatus === 'ready'
    ? 'DONE'
    : finalCompositionAnalysisStatus === 'requesting'
      ? 'ASKING'
      : finalCompositionAnalysisStatus === 'error'
        ? 'ERROR'
        : 'WAITING';
  header.append(createInGameAiHeaderTitle('AI Analysis'), badge);
  panel.append(header);

  if (finalCompositionAnalysisStatus === 'requesting') {
    panel.append(createDraftAiAnalysisStatus('AIに最終構成を分析依頼中・・'));
    return;
  }

  if (finalCompositionAnalysisStatus === 'error') {
    panel.append(createDraftAiAnalysisStatus(finalCompositionAnalysisError || 'AI分析を取得できませんでした。'));
    return;
  }

  if (finalCompositionAnalysisStatus !== 'ready') {
    panel.append(createDraftAiAnalysisStatus('最終構成分析を待機中・・'));
    return;
  }

  if (!finalCompositionAnalysisNotes.length) {
    panel.append(createDraftAiAnalysisStatus('AI分析を表示できませんでした。'));
    return;
  }

  const list = document.createElement('div');
  list.className = 'in-game-ai-analysis-notes';
  finalCompositionAnalysisNotes.forEach((note) => {
    const item = document.createElement('article');
    item.className = 'draft-ai-analysis-note';

    const noteTitle = document.createElement('strong');
    noteTitle.textContent = note.title;

    const body = document.createElement('p');
    body.textContent = note.body;

    item.append(noteTitle, body);
    list.append(item);
  });
  panel.append(list);
}

function renderInGameLaneMatchupAnalysis(analysis) {
  const panel = elements.inGameLaneMatchupAnalysis;
  if (!panel) return;

  panel.replaceChildren();

  const header = document.createElement('div');
  header.className = 'in-game-ai-analysis-header';

  const titleBlock = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'AI Matchup';
  const title = document.createElement('h4');
  title.textContent = 'レーン対面分析';
  titleBlock.append(eyebrow, title);

  const badge = document.createElement('span');
  const status = analysis?.status || 'idle';
  badge.className = `draft-ai-analysis-badge ${status}`;
  badge.textContent = status === 'ready'
    ? 'DONE'
    : status === 'requesting'
      ? 'ASKING'
      : status === 'error'
        ? 'ERROR'
        : 'WAITING';
  const response = analysis?.response || {};
  const headerMeta = document.createElement('div');
  headerMeta.className = 'in-game-ai-analysis-header-meta';
  headerMeta.append(badge);

  header.append(createInGameAiHeaderTitle('AI Matchup'), headerMeta);
  panel.append(header);

  if (status === 'requesting') {
    panel.append(createDraftAiAnalysisStatus('AIにレーン対面分析を依頼中...'));
    return;
  }

  if (status === 'error') {
    panel.append(createDraftAiAnalysisStatus(analysis?.error || 'AI対面分析を取得できませんでした。'));
    return;
  }

  if (status !== 'ready') {
    panel.append(createDraftAiAnalysisStatus('GameStart / InProgress の対面情報を待っています。'));
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

function createLaneMatchupGoalCard({ goal, championIds, championName, difficulty, laneStyle }) {
  if (!hasLaneMatchupRichText(goal)) return null;

  const card = document.createElement('article');
  card.className = 'draft-ai-analysis-note lane-matchup-goal';

  const header = document.createElement('div');
  header.className = 'lane-matchup-card-header';

  const title = document.createElement('strong');
  title.textContent = 'Lane Plan';

  const badges = document.createElement('div');
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

  const body = document.createElement('p');
  body.className = 'lane-matchup-goal-text';
  body.append(createLaneMatchupOpponentVisual({ championIds, championName }));
  body.append(document.createTextNode(' '), createLaneMatchupRichText(goal));

  card.append(header, body);
  return card;
}

function createLaneMatchupDetailCard(detail) {
  const items = (Array.isArray(detail) ? detail : [])
    .filter(hasLaneMatchupRichText)
    .slice(0, 3);
  if (!items.length) return null;

  const card = document.createElement('article');
  card.className = 'draft-ai-analysis-note lane-matchup-detail';

  const title = document.createElement('strong');
  title.textContent = 'Detail';

  const list = document.createElement('ul');
  list.className = 'lane-matchup-detail-list';
  items.forEach((richText) => {
    const item = document.createElement('li');
    item.append(createLaneMatchupRichText(richText));
    list.append(item);
  });

  card.append(title, list);
  return card;
}

function normalizeLaneMatchupDetail(detail) {
  return (Array.isArray(detail) ? detail : [])
    .map(normalizeLaneMatchupDetailItem)
    .filter(hasLaneMatchupRichText);
}

function normalizeLaneMatchupDetailItem(item) {
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

function isLaneMatchupRichTextToken(token) {
  if (!token || typeof token !== 'object') return false;
  if (token.type === 'text') return !isLaneMatchupStructuralFragment(token.text);
  if (token.type === 'champion') return String(token.championName || '').trim().length > 0;
  return false;
}

function isLaneMatchupStructuralFragment(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  if (/^[{}\[\],]+$/.test(text)) return true;
  if (/^"?[A-Za-z0-9_-]+"?\s*:\s*[{\[]?$/.test(text)) return true;
  return false;
}

function createLaneMatchupBadge(label, value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const badge = document.createElement('span');
  badge.className = 'lane-matchup-badge';

  const badgeLabel = document.createElement('small');
  badgeLabel.textContent = label;

  const badgeValue = document.createElement('b');
  badgeValue.textContent = text;

  badge.append(badgeLabel, badgeValue);
  return badge;
}

function hasLaneMatchupRichText(value) {
  if (Array.isArray(value)) {
    return value.some(isLaneMatchupRichTextToken);
  }

  return !isLaneMatchupStructuralFragment(value);
}

function createLaneMatchupRichText(value) {
  const fragment = document.createDocumentFragment();

  if (!Array.isArray(value)) {
    fragment.append(document.createTextNode(String(value || '').trim()));
    return fragment;
  }

  value.forEach((token) => {
    if (!token || typeof token !== 'object') return;

    if (token.type === 'text') {
      fragment.append(document.createTextNode(String(token.text || '')));
      return;
    }

    if (token.type === 'champion') {
      const champion = createLaneMatchupInlineChampion(token);
      if (champion) fragment.append(champion);
    }
  });

  return fragment;
}

function createLaneMatchupInlineChampion(token) {
  const championName = String(token?.championName || '').trim();
  if (!championName) return null;

  const championId = Number(token.championId);
  const container = document.createElement('span');
  container.className = 'lane-matchup-inline-champion';
  container.title = championName;

  if (Number.isInteger(championId) && championId > 0) {
    const image = document.createElement('img');
    image.alt = championName;
    image.title = championTitle(championId);
    image.className = 'lane-matchup-inline-champion-icon';
    loadChampionIconEager(image, championId);
    container.append(image);
  }

  const label = document.createElement('span');
  label.textContent = championName;
  container.append(label);
  return container;
}

function createLaneMatchupOpponentVisual({ championIds, championName }) {
  const container = document.createElement('span');
  container.className = 'lane-matchup-title-opponent';
  container.title = championName ? `vs ${championName}` : 'vs 相手';

  const label = document.createElement('span');
  label.textContent = 'vs';
  container.append(label);

  const ids = (Array.isArray(championIds) ? championIds : [])
    .map((championId) => Number(championId))
    .filter((championId) => Number.isInteger(championId) && championId > 0)
    .slice(0, 2);

  if (!ids.length) {
    const fallback = document.createElement('span');
    fallback.textContent = championName || '相手';
    container.append(fallback);
    return container;
  }

  ids.forEach((championId) => {
    const image = document.createElement('img');
    image.alt = championLabel(championId);
    image.title = championTitle(championId);
    image.className = 'lane-matchup-title-opponent-icon';
    loadChampionIconEager(image, championId);
    container.append(image);
  });

  return container;
}

function createInGameAiHeaderTitle(text) {
  const title = document.createElement('p');
  title.className = 'eyebrow';
  title.textContent = text;
  return title;
}

function createDraftAiAnalysisStatus(text) {
  const message = document.createElement('p');
  message.className = 'draft-ai-analysis-status';
  message.textContent = text;
  return message;
}

function parseDraftAiAnalysisNotes(response) {
  try {
    const parsed = typeof response === 'string' ? JSON.parse(response) : response;
    return (Array.isArray(parsed?.notes) ? parsed.notes : [])
      .filter((note) => note && typeof note === 'object')
      .slice(0, 3)
      .map((note) => ({
        title: String(note.title || '').trim(),
        body: String(note.body || '').trim()
      }))
      .filter((note) => note.title || note.body);
  } catch (error) {
    logDebug('Failed to parse draft AI analysis response', { error: error?.message || String(error) });
    return [];
  }
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

    const portraitStack = document.createElement('div');
    portraitStack.className = 'pick-portrait-stack';

    const roleBadge = document.createElement('span');
    roleBadge.className = 'pick-role-badge';
    roleBadge.textContent = positionLabel(member.assignedPosition);

    portraitStack.append(portrait, roleBadge);

    const meta = document.createElement('div');
    meta.className = 'pick-meta';

    const champion = document.createElement('strong');
    champion.textContent = selected ? championLabel(member.championId) : getPendingLabel(member, championLabel);

    meta.append(champion);
    if (isMarkedLaneOpponent) {
      const marker = document.createElement('span');
      marker.className = 'lane-opponent-marker';
      marker.textContent = turnState.localAssignedPosition
        ? `${positionLabel(turnState.localAssignedPosition)} OPPONENT`
        : 'LANE OPPONENT';
      meta.append(marker);
    }
    row.append(portraitStack, meta);
    return row;
  }));
}

function toggleMarkedLaneOpponent(cellId) {
  const normalizedCellId = Number(cellId);
  if (!Number.isInteger(normalizedCellId)) return;

  markedLaneOpponentCellId = markedLaneOpponentCellId === normalizedCellId ? null : normalizedCellId;
  logDebug('Lane opponent marker changed', { markedLaneOpponentCellId });
  if (lastRenderedState) {
    renderDraft(lastRenderedState);
  }
}

function renderDraftFocus(champSelect, activeAction = getActiveAction(champSelect)) {
  const localCellId = champSelect?.localPlayerCellId;
  const localMember = champSelect?.myTeam?.find((member) => member.cellId === localCellId);
  const isDraftActionPhase = String(champSelect?.timer?.phase || '').toUpperCase() === 'BAN_PICK';
  renderDraftSelfSummary(localMember);
  renderDraftInsights(null, { champSelect, localMember });

  if (activeAction) {
    const isActionInProgress = Boolean(activeAction.isInProgress);
    const isLocalTurn = isDraftActionPhase && isActionInProgress && activeAction.actorCellId === localCellId;
    const insightType = isDraftActionPhase && isActionInProgress ? activeAction.type : null;
    const actionLabel = activeAction.type === 'ban' ? 'BAN' : 'PICK';
    elements.currentAction.textContent = isLocalTurn ? `YOUR ${actionLabel}` : isDraftActionPhase && isActionInProgress ? `${actionLabel} PHASE` : 'Waiting';
    renderDraftInsights(insightType, { champSelect, localMember });
    elements.currentPick.textContent = isLocalTurn
      ? activeAction.type === 'ban' ? 'あなたのBANです' : 'あなたのPICKです'
      : isDraftActionPhase && isActionInProgress ? `Summoner ${(activeAction.actorCellId ?? 0) + 1} の操作待ちです` : 'チャンピオン選択情報を監視しています。';
    return;
  }

  elements.currentAction.textContent = localMember?.championId ? championLabel(localMember.championId) : '待機中';
  elements.currentPick.textContent = 'チャンピオン選択情報を監視しています。';
}

function renderDraftSelfSummary(localMember) {
  if (!elements.draftSelfSummary) return;

  const championId = getMemberChampionId(localMember);
  elements.draftSelfSummary.replaceChildren();
  elements.draftSelfSummary.hidden = !championId;
  if (!championId) return;

  const header = document.createElement('div');
  header.className = 'draft-self-summary-header';

  const label = document.createElement('span');
  label.className = 'draft-self-summary-label';
  label.textContent = 'Your';

  const champion = createInlineChampionName(championId, 'inline-champion-name draft-self-summary-name');
  header.append(label, champion);

  const stats = createChampionStatsElement(
    getChampionRoleDisplayStats(championId, localMember?.assignedPosition),
    'draft-self-summary-stats',
    { includeGames: false }
  );

  elements.draftSelfSummary.append(header, stats);
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
  const minGames = getBanInsightMinGames();
  const plannedPickThreatSection = createPlannedPickBanThreatSection(champSelect, localMember, position, minGames);
  const laneStats = sortWorstWinRateStats(matchHistoryLaneOpponentStats.filter((stats) => (
    String(stats.position || '').toUpperCase() === position &&
    Number(stats.games || 0) >= minGames
  ))).slice(0, BAN_INSIGHT_LIMIT);
  const enemyStats = sortWorstWinRateStats(matchHistoryEnemyChampionStats.filter((stats) => (
    Number(stats.games || 0) >= minGames
  ))).slice(0, BAN_INSIGHT_LIMIT);

  const sections = [
    createBanInsightSampleControl(champSelect, localMember),
    createBanInsightSection(`${positionLabel(position)} lane opponents`, laneStats)
  ];
  if (plannedPickThreatSection) {
    sections.splice(1, 0, plannedPickThreatSection);
  }
  sections.push(createCollapsedBanInsightSection('Worst enemy picks', enemyStats));

  panel.replaceChildren(...sections);
}

function getBanInsightMinGames() {
  return BAN_INSIGHT_SAMPLE_OPTIONS.includes(banInsightMinGames) ? banInsightMinGames : 5;
}

function createBanInsightSampleControl(champSelect, localMember) {
  const control = document.createElement('div');
  control.className = 'ban-insight-control';

  const label = document.createElement('label');
  label.className = 'ban-insight-sample-filter';

  const text = document.createElement('span');
  text.textContent = 'Sample';

  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Ban insight sample filter');
  BAN_INSIGHT_SAMPLE_OPTIONS.forEach((games) => {
    const option = document.createElement('option');
    option.value = String(games);
    option.textContent = `${games}+ games`;
    select.append(option);
  });
  select.value = String(getBanInsightMinGames());
  select.addEventListener('change', () => {
    banInsightMinGames = Number(select.value);
    logDebug('Ban insight sample filter changed', { minGames: banInsightMinGames });
    renderBanInsights(true, champSelect, localMember);
  });

  label.append(text, select);
  control.append(label);
  return control;
}

function createPlannedPickBanThreatSection(champSelect, localMember, position, minGames) {
  const { plannedChampionId, statsList } = getPlannedPickThreatStats({
    stats: matchHistorySelfVsLaneOpponentStats.filter((stats) => (
      Number(stats.games || 0) >= minGames &&
      Number(stats.winRate || 0) < 0.5
    )),
    champSelect,
    localMember,
    limit: BAN_INSIGHT_LIMIT
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
    empty.textContent = 'No losing same-role matchup history';
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

function createCollapsedBanInsightSection(title, statsList) {
  const details = document.createElement('details');
  details.className = 'ban-insight-details';

  const summary = document.createElement('summary');
  summary.textContent = title;
  details.append(summary);

  const section = createBanInsightSection(title, statsList);
  section.querySelector('h4')?.remove();
  details.append(section);
  return details;
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
  elements.draftView.hidden = activeView !== 'draft';
  elements.championPoolView.hidden = activeView !== 'championPool';
  elements.statsView.hidden = activeView !== 'stats';
  elements.debugView.hidden = activeView !== 'debug';
  elements.settingsView.hidden = activeView !== 'settings';

  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === activeView);
  });

  renderStatsSubtabs();
}

function setActiveStatsView(viewName) {
  activeStatsView = viewName === 'opponents' ? 'opponents' : 'played';
  logDebug('Active stats view changed', { viewName: activeStatsView });
  renderStatsSubtabs();
}

function renderStatsSubtabs() {
  elements.playedStatsView.hidden = activeStatsView !== 'played';
  elements.opponentStatsView.hidden = activeStatsView !== 'opponents';
  elements.playedStatsSampleFilter.hidden = activeStatsView !== 'played';
  elements.opponentStatsSampleFilter.hidden = activeStatsView !== 'opponents';

  elements.statsSubtabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.statsView === activeStatsView);
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

async function saveThemeMode() {
  const themeMode = normalizeThemeMode(elements.themeModeSelect.value);
  elements.saveThemeModeButton.disabled = true;
  elements.settingsMessage.textContent = '';

  try {
    const settings = await window.lcuApi.updateThemeMode(themeMode);
    renderSettings(settings);
    logDebug('Theme mode saved', { themeMode: settings.themeMode });
    elements.settingsMessage.textContent = '表示テーマを保存しました。';
  } catch (error) {
    logWarn('Theme mode save failed', { message: error.message, stack: error.stack });
    elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
  } finally {
    elements.saveThemeModeButton.disabled = false;
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
  elements.matchDataSeasonHint.disabled = true;
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
elements.windowMinimizeButton.addEventListener('click', () => window.lcuApi.minimizeWindow());
elements.windowMaximizeButton.addEventListener('click', async () => {
  const isMaximized = await window.lcuApi.toggleMaximizeWindow();
  renderWindowMaximizedState(isMaximized);
});
elements.windowCloseButton.addEventListener('click', () => window.lcuApi.closeWindow());
elements.windowTitlebar.addEventListener('dblclick', (event) => {
  if (event.target.closest('.window-titlebar-controls')) return;
  window.lcuApi.toggleMaximizeWindow().then(renderWindowMaximizedState);
});
elements.collectRiotMatchesButton.addEventListener('click', () => collectRiotMatchHistory('recent'));
elements.matchDataMenuButton.addEventListener('click', toggleMatchDataMenu);
elements.collectSeasonRiotMatchesButton.addEventListener('click', () => collectRiotMatchHistory('season'));
elements.matchDataSeasonHint.addEventListener('click', () => collectRiotMatchHistory('season'));
document.addEventListener('click', (event) => {
  if (!matchDataMenuOpen) return;
  if (event.target === elements.matchDataMenuButton || elements.matchDataMenu.contains(event.target)) return;
  setMatchDataMenuOpen(false);
});
elements.tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveView(button.dataset.view));
});
elements.statsSubtabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveStatsView(button.dataset.statsView));
});
elements.chooseLolDirButton.addEventListener('click', chooseLolInstallDir);
elements.saveLolDirButton.addEventListener('click', saveLolInstallDir);
elements.saveRiotPlatformRegionButton.addEventListener('click', saveRiotPlatformRegion);
elements.saveThemeModeButton.addEventListener('click', saveThemeMode);
elements.saveChampionPoolButton.addEventListener('click', saveChampionPool);
elements.championPoolSearchInput.addEventListener('input', renderChampionPool);
elements.playedStatsSampleSelect.addEventListener('change', () => {
  playedStatsMinGames = getPlayedStatsMinGames();
  expandedPlayedStatsChampionId = null;
  shouldOpenFirstPlayedStatsRow = true;
  logDebug('Played champion stats sample filter changed', { minGames: playedStatsMinGames });
  renderPlayedChampionStats();
});
elements.opponentStatsSampleSelect.addEventListener('change', () => {
  opponentStatsMinGames = getOpponentStatsMinGames();
  expandedOpponentStatsChampionId = null;
  shouldOpenFirstOpponentStatsRow = true;
  logDebug('Lane opponent stats sample filter changed', { minGames: opponentStatsMinGames });
  renderLaneOpponentStats();
});
elements.playedStatsSortGamesButton.addEventListener('click', () => {
  setStatsSort('played', 'games');
});
elements.playedStatsSortWinRateButton.addEventListener('click', () => {
  setStatsSort('played', 'winRate');
});
elements.opponentStatsSortGamesButton.addEventListener('click', () => {
  setStatsSort('opponents', 'games');
});
elements.opponentStatsSortWinRateButton.addEventListener('click', () => {
  setStatsSort('opponents', 'winRate');
});

setActiveView(activeView);
window.lcuApi.getState().then(renderState);
window.lcuApi.getSettings().then(renderSettings);
window.lcuApi.onWindowMaximized(renderWindowMaximizedState);
window.lcuApi.getChampionPool().then((savedChampionPool) => {
  championPool = normalizeChampionPool(savedChampionPool);
  championPoolDirty = false;
  renderChampionPool();
});
