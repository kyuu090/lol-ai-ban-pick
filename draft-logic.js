(function attachDraftLogic(root, factory) {
  const logic = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = logic;
  }

  if (root) {
    root.DraftLogic = logic;
  }
})(typeof globalThis !== 'undefined' ? globalThis : null, function createDraftLogic() {
  const POSITION_LABELS = {
    top: 'TOP',
    jungle: 'JG',
    middle: 'MID',
    bottom: 'BOT',
    utility: 'SUP'
  };
  const CHAMPION_POOL_LANES = [
    { id: 'top', label: 'TOP' },
    { id: 'jungle', label: 'JG' },
    { id: 'middle', label: 'MID' },
    { id: 'bottom', label: 'BOT' },
    { id: 'utility', label: 'SUP' }
  ];

  function hasUsableData(value) {
    return value && typeof value === 'object' && !value.error;
  }

  function getPhase(state) {
    return typeof state?.gameflowPhase === 'string' ? state.gameflowPhase : null;
  }

  function getSummonerName(summoner) {
    if (!hasUsableData(summoner)) return '';
    return summoner.gameName || summoner.displayName || summoner.internalName || summoner.name || 'Summoner';
  }

  function positionLabel(position) {
    return position ? POSITION_LABELS[position.toLowerCase()] || position.toUpperCase() : '譛ｪ遒ｺ螳・';
  }

  function getPendingLabel(member, championLabel) {
    if (member?.championPickIntent) {
      return `${championLabel(member.championPickIntent)} 繧剃ｺ亥ｮ啻`;
    }
    return 'PICKING NEXT';
  }

  function normalizeChampionIds(value) {
    return Array.isArray(value)
      ? value.map(Number).filter((championId) => Number.isInteger(championId) && championId > 0)
      : [];
  }

  function uniqueChampionIds(championIds) {
    return [...new Set(championIds)];
  }

  function createDefaultChampionPool() {
    return CHAMPION_POOL_LANES.reduce((pool, lane) => {
      pool[lane.id] = [];
      return pool;
    }, {});
  }

  function normalizeChampionPool(value) {
    const source = value && typeof value === 'object' ? value : {};
    const pool = createDefaultChampionPool();

    CHAMPION_POOL_LANES.forEach((lane) => {
      pool[lane.id] = uniqueChampionIds(normalizeChampionIds(source[lane.id]));
    });

    return pool;
  }

  function collectBans(champSelect, allyTeam = [], enemyTeam = []) {
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

  function getActiveAction(champSelect) {
    const actions = Array.isArray(champSelect?.actions) ? champSelect.actions.flat() : [];
    return actions.find((action) => action?.isInProgress) || actions.find((action) => !action?.completed) || null;
  }

  function getTimerTimeLeftMs(timer) {
    if (typeof timer?.adjustedTimeLeftInPhase === 'number') {
      return timer.adjustedTimeLeftInPhase;
    }

    if (typeof timer?.timeLeftInPhase === 'number') {
      return timer.timeLeftInPhase;
    }

    return null;
  }

  function getCoachPanelState(state) {
    const phase = getPhase(state);
    const champSelect = hasUsableData(state?.champSelect) ? state.champSelect : null;
    const loggedIn = state?.lcuStatus === 'connected' && hasUsableData(state?.summoner);
    const inGame = ['InProgress', 'GameStart'].includes(phase);
    const inChampSelect = phase === 'ChampSelect' && Boolean(champSelect) && !inGame;

    return {
      phase,
      champSelect,
      loggedIn,
      inGame,
      inChampSelect
    };
  }

  return {
    POSITION_LABELS,
    CHAMPION_POOL_LANES,
    hasUsableData,
    getPhase,
    getSummonerName,
    positionLabel,
    getPendingLabel,
    normalizeChampionIds,
    uniqueChampionIds,
    createDefaultChampionPool,
    normalizeChampionPool,
    collectBans,
    getActiveAction,
    getTimerTimeLeftMs,
    getCoachPanelState
  };
});
