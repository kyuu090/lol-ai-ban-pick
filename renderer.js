const elements = {
  refreshButton: document.querySelector('#refreshButton'),
  collectRiotMatchesButton: document.querySelector('#collectRiotMatchesButton'),
  matchHistoryToast: document.querySelector('#matchHistoryToast'),
  matchHistoryToastPhase: document.querySelector('#matchHistoryToastPhase'),
  matchHistoryToastMessage: document.querySelector('#matchHistoryToastMessage'),
  matchDataCount: document.querySelector('#matchDataCount'),
  matchDataRange: document.querySelector('#matchDataRange'),
  tabButtons: document.querySelectorAll('.tab-button'),
  coachView: document.querySelector('#coachView'),
  championPoolView: document.querySelector('#championPoolView'),
  debugView: document.querySelector('#debugView'),
  settingsView: document.querySelector('#settingsView'),
  laneTabs: document.querySelector('#laneTabs'),
  championPoolSearchInput: document.querySelector('#championPoolSearchInput'),
  championPoolPickerGrid: document.querySelector('#championPoolPickerGrid'),
  championPoolPickerEmpty: document.querySelector('#championPoolPickerEmpty'),
  saveChampionPoolButton: document.querySelector('#saveChampionPoolButton'),
  championPoolListTitle: document.querySelector('#championPoolListTitle'),
  championPoolList: document.querySelector('#championPoolList'),
  championPoolEmpty: document.querySelector('#championPoolEmpty'),
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
  draftTimer: document.querySelector('#draftTimer'),
  currentAction: document.querySelector('#currentAction'),
  currentPick: document.querySelector('#currentPick'),
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
let championsById = {};
let championPool = {};
let matchHistoryChampionStats = [];
let championPoolDirty = false;
const championIconCache = new Map();
const championIconQueue = [];
const ICON_REQUEST_CONCURRENCY = 4;
let activeChampionIconRequests = 0;
const championIconObserver = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(handleChampionIconIntersections, { rootMargin: '180px' })
  : null;
let draftTimerDeadlineMs = null;
let draftTimerSignature = null;
let matchHistoryToastTimer = null;
let dismissedMatchHistoryToastKey = null;
const {
  collectBans,
  getActiveAction,
  getCoachPanelState,
  getPhase,
  getPendingLabel,
  getSummonerName,
  normalizeChampionPool,
  positionLabel,
  getTimerTimeLeftMs
} = window.DraftLogic;
const { CHAMPION_POOL_LANES } = window.DraftLogic;

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

function getChampionPoolDisplayStats(championId) {
  const id = Number(championId);
  return matchHistoryChampionStats.find((stats) => (
    Number(stats.championId) === id &&
    stats.queueGroup === 'all_sr_5v5'
  )) || null;
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toFixed(digits);
}

function createChampionStatsElement(stats) {
  const container = document.createElement('div');
  container.className = 'pool-champion-stats';

  if (!stats || !stats.games) {
    const empty = document.createElement('span');
    empty.className = 'pool-stat-line muted';
    empty.textContent = 'No games';
    container.append(empty);
    return container;
  }

  const wins = Number(stats.wins || 0);
  const losses = Number.isFinite(stats.losses) ? stats.losses : Math.max(0, Number(stats.games || 0) - wins);
  [
    `${stats.games}games`,
    `Ave KDA ${formatNumber(stats.avgKills)}/${formatNumber(stats.avgDeaths)}/${formatNumber(stats.avgAssists)}`,
    `${wins}W/${losses}L WR ${formatPercent(stats.winRate)}`
  ].forEach((text, index) => {
    const line = document.createElement('span');
    line.className = `pool-stat-line${index === 0 ? ' games' : ''}`;
    line.textContent = text;
    container.append(line);
  });

  return container;
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
  championsById = state.championsById || {};
  matchHistoryChampionStats = Array.isArray(state.matchHistoryChampionStats) ? state.matchHistoryChampionStats : [];
  if (!championPoolDirty) {
    championPool = normalizeChampionPool(state.championPool);
  }
  renderStatus(state);
  renderMatchHistoryStatus(state.matchHistoryStatus);
  renderMatchDataSummary(state.matchHistorySummary);
  renderSettings(state.settings);
  renderChampionPool();
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
  const toastKey = `${status?.phase || 'idle'}:${status?.updatedAt || ''}`;

  if (!status || status.phase === 'idle') {
    elements.matchHistoryToast.hidden = true;
    elements.collectRiotMatchesButton.disabled = false;
    return;
  }

  const activePhases = ['collecting', 'normalizing', 'aggregating', 'retrying'];
  const isActive = activePhases.includes(status.phase);

  if (matchHistoryToastTimer) {
    clearTimeout(matchHistoryToastTimer);
    matchHistoryToastTimer = null;
  }

  if (!isActive && dismissedMatchHistoryToastKey === toastKey) {
    elements.matchHistoryToast.hidden = true;
    elements.collectRiotMatchesButton.disabled = false;
    return;
  }

  elements.matchHistoryToast.hidden = false;
  elements.matchHistoryToast.dataset.phase = status.phase;
  elements.matchHistoryToastPhase.textContent = status.phase;
  elements.matchHistoryToastMessage.textContent = status.message || '';
  elements.collectRiotMatchesButton.disabled = isActive;

  if (!isActive) {
    const delayMs = status.phase === 'completed' ? 3000 : 5000;
    matchHistoryToastTimer = setTimeout(() => {
      elements.matchHistoryToast.hidden = true;
      dismissedMatchHistoryToastKey = toastKey;
    }, delayMs);
  }
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

    meta.append(name, createChampionStatsElement(getChampionPoolDisplayStats(championId)));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'pool-remove-button';
    removeButton.dataset.championId = String(championId);
    removeButton.textContent = '削除';
    removeButton.addEventListener('click', () => removeChampionFromPool(championId));

    item.append(portrait, meta, removeButton);
    return item;
  }));
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
    clearDraftTimer();
    elements.champSelectView.classList.remove('local-turn');
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
  const isLocalTurn = activeAction?.actorCellId === localCellId;

  elements.champSelectView.classList.toggle('local-turn', isLocalTurn);
  renderBanList(elements.allyBans, allyBans);
  renderBanList(elements.enemyBans, enemyBans);
  renderTeam(elements.allyTeam, allyTeam, 'ally', { activeAction, localCellId });
  renderTeam(elements.enemyTeam, enemyTeam, 'enemy', { activeAction, localCellId });
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
    const selected = Number(member.championId) > 0;
    const intendedChampionId = Number(member.championPickIntent);
    const hasIntent = !selected && intendedChampionId > 0;
    const portraitChampionId = selected ? Number(member.championId) : intendedChampionId;
    const isLocalMember = member.cellId === turnState.localCellId;
    const isActiveMember = member.cellId === turnState.activeAction?.actorCellId;
    const isLocalActiveMember = isLocalMember && isActiveMember;
    row.className = `pick-row ${side} ${selected ? 'selected' : hasIntent ? 'intent' : 'empty'}${isLocalMember ? ' local-player' : ''}${isActiveMember ? ' active-turn' : ''}${isLocalActiveMember ? ' local-active-turn' : ''}`;

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
    row.append(portrait, meta);
    return row;
  }));
}

function renderDraftFocus(champSelect, activeAction = getActiveAction(champSelect)) {
  const localCellId = champSelect?.localPlayerCellId;
  const localMember = champSelect?.myTeam?.find((member) => member.cellId === localCellId);
  const timer = champSelect?.timer;

  syncDraftTimer(timer);

  if (activeAction) {
    const isLocalTurn = activeAction.actorCellId === localCellId;
    const actionLabel = activeAction.type === 'ban' ? 'BAN' : 'PICK';
    elements.currentAction.textContent = isLocalTurn ? `YOUR ${actionLabel}` : `${actionLabel} PHASE`;
    elements.currentPick.textContent = isLocalTurn
      ? activeAction.type === 'ban' ? 'あなたのBANです' : 'あなたのPICKです'
      : `Summoner ${(activeAction.actorCellId ?? 0) + 1} の操作待ちです`;
    return;
  }

  elements.currentAction.textContent = localMember?.championId ? championLabel(localMember.championId) : '待機中';
  elements.currentPick.textContent = 'チャンピオン選択情報を監視しています。';
}

function syncDraftTimer(timer) {
  const timeLeftMs = getTimerTimeLeftMs(timer);

  if (timeLeftMs === null) {
    clearDraftTimer();
    return;
  }

  const signature = [
    timer.phase,
    timer.adjustedTimeLeftInPhase,
    timer.timeLeftInPhase,
    timer.totalTimeInPhase
  ].join(':');

  if (signature !== draftTimerSignature) {
    draftTimerSignature = signature;
    draftTimerDeadlineMs = Date.now() + Math.max(0, timeLeftMs);
  }

  updateDraftTimerDisplay();
}

function clearDraftTimer() {
  draftTimerDeadlineMs = null;
  draftTimerSignature = null;
  elements.draftTimer.textContent = '-';
}

function updateDraftTimerDisplay() {
  if (draftTimerDeadlineMs === null || elements.champSelectView.hidden) return;

  const timeLeftMs = Math.max(0, draftTimerDeadlineMs - Date.now());
  elements.draftTimer.textContent = Math.ceil(timeLeftMs / 1000);
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

async function collectRiotMatchHistory() {
  elements.collectRiotMatchesButton.disabled = true;
  elements.collectRiotMatchesButton.textContent = 'Updating...';

  try {
    logDebug('Manual Riot match history collection requested');
    const summary = await window.lcuApi.collectRiotMatchHistory();
    logDebug('Manual Riot match history collection completed', summary);
  } catch (error) {
    logWarn('Manual Riot match history collection failed', { message: error.message, stack: error.stack });
  } finally {
    elements.collectRiotMatchesButton.textContent = 'Update match data';
    const status = await window.lcuApi.getState().then((state) => state.matchHistoryStatus);
    elements.collectRiotMatchesButton.disabled = ['collecting', 'normalizing', 'aggregating', 'retrying'].includes(status?.phase);
  }
}

window.lcuApi.onState(renderState);
elements.refreshButton.addEventListener('click', refresh);
elements.collectRiotMatchesButton.addEventListener('click', collectRiotMatchHistory);
elements.tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveView(button.dataset.view));
});
elements.chooseLolDirButton.addEventListener('click', chooseLolInstallDir);
elements.saveLolDirButton.addEventListener('click', saveLolInstallDir);
elements.saveRiotApiTokenButton.addEventListener('click', saveRiotApiToken);
elements.saveRiotPlatformRegionButton.addEventListener('click', saveRiotPlatformRegion);
elements.saveChampionPoolButton.addEventListener('click', saveChampionPool);
elements.championPoolSearchInput.addEventListener('input', renderChampionPool);

setActiveView(activeView);
setInterval(updateDraftTimerDisplay, 250);
window.lcuApi.getState().then(renderState);
window.lcuApi.getSettings().then(renderSettings);
window.lcuApi.getChampionPool().then((savedChampionPool) => {
  championPool = normalizeChampionPool(savedChampionPool);
  championPoolDirty = false;
  renderChampionPool();
});
