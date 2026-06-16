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

function getPhase(state) {
  return typeof state.gameflowPhase === 'string' ? state.gameflowPhase : null;
}

function hasUsableData(value) {
  return value && typeof value === 'object' && !value.error;
}

function getSummonerName(summoner) {
  if (!hasUsableData(summoner)) return '';
  return summoner.gameName || summoner.displayName || summoner.internalName || summoner.name || 'Summoner';
}

function championLabel(championId) {
  const id = Number(championId);
  return id > 0 ? `Champion ${id}` : '未選択';
}

function positionLabel(position) {
  return position ? position.toUpperCase() : '未確定';
}

function renderState(state) {
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
  const phase = getPhase(state);
  const champSelect = hasUsableData(state.champSelect) ? state.champSelect : null;
  const loggedIn = state.lcuStatus === 'connected' && hasUsableData(state.summoner);
  const inGame = ['InProgress', 'GameStart'].includes(phase);
  const inChampSelect = phase === 'ChampSelect' && Boolean(champSelect) && !inGame;

  showOnlyCoachPanel(loggedIn, inChampSelect, inGame);

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

  renderBanList(elements.allyBans, allyBans);
  renderBanList(elements.enemyBans, enemyBans);
  renderTeam(elements.allyTeam, allyTeam, 'ally');
  renderTeam(elements.enemyTeam, enemyTeam, 'enemy');
  renderDraftFocus(champSelect);
}

function collectBans(champSelect, allyTeam, enemyTeam) {
  const allyCellIds = new Set(allyTeam.map((member) => member.cellId));
  const enemyCellIds = new Set(enemyTeam.map((member) => member.cellId));
  const allyBans = normalizeChampionIds(champSelect?.bans?.myTeamBans);
  const enemyBans = normalizeChampionIds(champSelect?.bans?.theirTeamBans);
  const actions = Array.isArray(champSelect?.actions) ? champSelect.actions.flat() : [];

  actions
    .filter((action) => action?.type === 'ban' && Number(action.championId) > 0)
    .forEach((action) => {
      const championId = Number(action.championId);

      if (allyCellIds.has(action.actorCellId)) {
        allyBans.push(championId);
      } else if (enemyCellIds.has(action.actorCellId)) {
        enemyBans.push(championId);
      }
    });

  return {
    allyBans: uniqueChampionIds(allyBans),
    enemyBans: uniqueChampionIds(enemyBans)
  };
}

function normalizeChampionIds(value) {
  return Array.isArray(value)
    ? value.map(Number).filter((championId) => championId > 0)
    : [];
}

function uniqueChampionIds(championIds) {
  return [...new Set(championIds)];
}

function renderBanList(container, bans) {
  container.replaceChildren(...bans.slice(0, 5).map((championId) => {
    const item = document.createElement('span');
    item.className = 'ban-token';
    item.textContent = championLabel(championId);
    return item;
  }));

  if (bans.length === 0) {
    const item = document.createElement('span');
    item.className = 'ban-token empty';
    item.textContent = 'BANなし';
    container.append(item);
  }
}

function renderTeam(container, team, side) {
  const rows = Array.from({ length: 5 }, (_, index) => team[index] ?? { cellId: index, championId: 0 });

  container.replaceChildren(...rows.map((member, index) => {
    const row = document.createElement('article');
    const selected = Number(member.championId) > 0;
    row.className = `pick-row ${side} ${selected ? 'selected' : 'empty'}`;

    const portrait = document.createElement('div');
    portrait.className = 'champion-portrait';
    portrait.textContent = selected ? championLabel(member.championId).replace('Champion ', '#') : '?';

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

function renderDraftFocus(champSelect) {
  const actions = Array.isArray(champSelect?.actions) ? champSelect.actions.flat() : [];
  const activeAction = actions.find((action) => action?.isInProgress) || actions.find((action) => !action?.completed);
  const localCellId = champSelect?.localPlayerCellId;
  const localMember = champSelect?.myTeam?.find((member) => member.cellId === localCellId);
  const timer = champSelect?.timer;

  elements.draftTimer.textContent = typeof timer?.adjustedTimeLeftInPhase === 'number'
    ? Math.max(0, Math.ceil(timer.adjustedTimeLeftInPhase / 1000))
    : '-';

  if (activeAction) {
    elements.currentAction.textContent = activeAction.type === 'ban' ? 'BAN PHASE' : 'PICK PHASE';
    elements.currentPick.textContent = activeAction.actorCellId === localCellId
      ? 'あなたの操作待ちです'
      : `Summoner ${(activeAction.actorCellId ?? 0) + 1} の操作待ちです`;
    return;
  }

  elements.currentAction.textContent = localMember?.championId ? championLabel(localMember.championId) : '待機中';
  elements.currentPick.textContent = 'チャンピオン選択情報を監視しています。';
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
window.lcuApi.getState().then(renderState);
window.lcuApi.getSettings().then(renderSettings);
