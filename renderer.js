const elements = {
  refreshButton: document.querySelector('#refreshButton'),
  tabButtons: document.querySelectorAll('.tab-button'),
  coachView: document.querySelector('#coachView'),
  debugView: document.querySelector('#debugView'),
  settingsView: document.querySelector('#settingsView'),
  lolInstallDirInput: document.querySelector('#lolInstallDirInput'),
  chooseLolDirButton: document.querySelector('#chooseLolDirButton'),
  saveLolDirButton: document.querySelector('#saveLolDirButton'),
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
let championsById = {};
const championIconCache = new Map();
let draftTimerDeadlineMs = null;
let draftTimerSignature = null;
const {
  collectBans,
  getActiveAction,
  getCoachPanelState,
  getPhase,
  getSummonerName,
  getTimerTimeLeftMs
} = window.DraftLogic;
const { POSITION_LABELS } = window.DraftLogic;

function stringify(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'short',
    timeStyle: 'medium'
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

function loadChampionIcon(img, championId) {
  const id = Number(championId);
  if (!id || !window.lcuApi?.getChampionIcon) return;

  img.dataset.championId = String(id);

  const cached = championIconCache.get(id);
  if (typeof cached === 'string') {
    img.src = cached;
    return;
  }

  const iconPromise = cached || window.lcuApi.getChampionIcon(id)
    .then((src) => {
      if (src) championIconCache.set(id, src);
      return src;
    })
    .catch(() => null);

  championIconCache.set(id, iconPromise);

  iconPromise.then((src) => {
    if (src && img.dataset.championId === String(id)) {
      img.src = src;
    }
  });
}

function positionLabel(position) {
  return position ? POSITION_LABELS[position.toLowerCase()] || position.toUpperCase() : '未確定';
}

function renderState(state) {
  championsById = state.championsById || {};
  renderStatus(state);
  renderSettings(state.settings);
  renderCoach(state);
  renderDebug(state);
}

function renderSettings(settings) {
  if (!settings?.lolInstallDir || document.activeElement === elements.lolInstallDirInput) return;
  elements.lolInstallDirInput.value = settings.lolInstallDir;
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
    champion.textContent = selected ? championLabel(member.championId) : getPendingLabel(member);

    const detail = document.createElement('span');
    detail.textContent = `${positionLabel(member.assignedPosition)} / Summoner ${index + 1}`;

    meta.append(champion, detail);
    row.append(portrait, meta);
    return row;
  }));
}

function getPendingLabel(member) {
  if (member?.championPickIntent) {
    return `${championLabel(member.championPickIntent)} を予定`;
  }
  return 'PICKING NEXT';
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
  elements.coachView.hidden = activeView !== 'coach';
  elements.debugView.hidden = activeView !== 'debug';
  elements.settingsView.hidden = activeView !== 'settings';

  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === activeView);
  });
}

async function chooseLolInstallDir() {
  elements.chooseLolDirButton.disabled = true;
  elements.settingsMessage.textContent = '';

  try {
    const settings = await window.lcuApi.chooseLolInstallDir();
    elements.lolInstallDirInput.value = settings.lolInstallDir;
    elements.settingsMessage.textContent = '保存しました。接続状態を再確認しています。';
  } catch (error) {
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
    elements.settingsMessage.textContent = '保存しました。接続状態を再確認しています。';
  } catch (error) {
    elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
  } finally {
    elements.saveLolDirButton.disabled = false;
  }
}

async function refresh() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = '取得中...';

  try {
    const state = await window.lcuApi.refresh();
    renderState(state);
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = '手動再取得';
  }
}

window.lcuApi.onState(renderState);
elements.refreshButton.addEventListener('click', refresh);
elements.tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveView(button.dataset.view));
});
elements.chooseLolDirButton.addEventListener('click', chooseLolInstallDir);
elements.saveLolDirButton.addEventListener('click', saveLolInstallDir);

setActiveView(activeView);
setInterval(updateDraftTimerDisplay, 250);
window.lcuApi.getState().then(renderState);
window.lcuApi.getSettings().then(renderSettings);
