const elements = {
  refreshButton: document.querySelector('#refreshButton'),
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

function renderState(state) {
  elements.lcuStatus.textContent = state.lcuStatus ?? '-';
  elements.websocketStatus.textContent = state.websocketStatus ?? '-';
  elements.gameflowPhase.textContent = stringify(state.gameflowPhase).replace(/^"|"$/g, '') || '-';
  elements.updatedAt.textContent = formatDate(state.updatedAt);
  elements.errorMessage.textContent = state.error ?? '';

  elements.summonerJson.textContent = stringify(state.summoner);
  elements.lobbyJson.textContent = stringify(state.lobby);
  elements.champSelectJson.textContent = stringify(state.champSelect);
  elements.lastEventJson.textContent = stringify(state.lastEvent);
  elements.stateJson.textContent = stringify(state);
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

window.lcuApi.getState().then(renderState);
