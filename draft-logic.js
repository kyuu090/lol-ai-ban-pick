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
    return position ? POSITION_LABELS[position.toLowerCase()] || position.toUpperCase() : '未確定';
  }

  function getPendingLabel(member, championLabel) {
    if (member?.championPickIntent) {
      return `${championLabel(member.championPickIntent)} を予定`;
    }
    return 'PICKING NEXT';
  }

  function normalizeChampionIds(value) {
    return Array.isArray(value)
      ? value.map(normalizeChampionId).filter((championId) => championId !== null)
      : [];
  }

  function normalizeChampionId(value) {
    const championId = Number(value);
    return Number.isInteger(championId) && championId > 0 ? championId : null;
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
      .filter((action) => action?.type === 'ban')
      .forEach((action) => {
        const championId = normalizeChampionId(action.championId);
        if (championId === null) return;

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

  function getActiveAction(champSelect, preferredActorCellId = null) {
    const actions = Array.isArray(champSelect?.actions) ? champSelect.actions.flat() : [];
    const preferredCellId = Number(preferredActorCellId);
    if (Number.isInteger(preferredCellId)) {
      const preferredAction = actions.find((action) => (
        action?.isInProgress &&
        action.actorCellId === preferredCellId
      ));
      if (preferredAction) return preferredAction;
    }

    return actions.find((action) => action?.isInProgress) || actions.find((action) => !action?.completed) || null;
  }

  function normalizePosition(position) {
    return String(position || '').toUpperCase();
  }

  function getPlannedPickChampionId(localMember) {
    return getMemberChampionId(localMember);
  }

  function getMemberChampionId(member) {
    const selectedChampionId = Number(member?.championId) || 0;
    if (selectedChampionId > 0) return selectedChampionId;

    const intendedChampionId = Number(member?.championPickIntent) || 0;
    return intendedChampionId > 0 ? intendedChampionId : 0;
  }

  function getLocalChampSelectMember(champSelect) {
    const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
    const localCellId = champSelect?.localPlayerCellId;
    return allyTeam.find((member) => member.cellId === localCellId) || null;
  }

  function collectUnavailableChampionReasons(champSelect, allyTeam = champSelect?.myTeam, enemyTeam = champSelect?.theirTeam) {
    const allies = Array.isArray(allyTeam) ? allyTeam : [];
    const enemies = Array.isArray(enemyTeam) ? enemyTeam : [];
    const { allyBans, enemyBans } = collectBans(champSelect, allies, enemies);
    const reasons = new Map();

    [...allyBans, ...enemyBans].forEach((championId) => {
      reasons.set(Number(championId), 'Banned');
    });

    [...allies, ...enemies].forEach((member) => {
      const championId = Number(member?.championId) || 0;
      if (championId > 0 && !reasons.has(championId)) {
        reasons.set(championId, 'Picked');
      }
    });

    return reasons;
  }

  function compareChampionName(a, b, championIdKey = 'championId') {
    const aName = a?.championName || a?.opponentChampionName || `Champion ${Number(a?.[championIdKey]) || 0}`;
    const bName = b?.championName || b?.opponentChampionName || `Champion ${Number(b?.[championIdKey]) || 0}`;
    return String(aName).localeCompare(String(bName), 'en');
  }

  function sortWorstWinRateStats(stats, championIdKey = 'championId') {
    return [...(Array.isArray(stats) ? stats : [])].sort((a, b) => (
      (Number(a?.winRate || 0) - Number(b?.winRate || 0)) ||
      (Number(b?.games || 0) - Number(a?.games || 0)) ||
      compareChampionName(a, b, championIdKey)
    ));
  }

  function sortBestWinRateStats(stats, championIdKey = 'championId') {
    return [...(Array.isArray(stats) ? stats : [])].sort((a, b) => (
      (Number(b?.winRate || 0) - Number(a?.winRate || 0)) ||
      (Number(b?.games || 0) - Number(a?.games || 0)) ||
      compareChampionName(a, b, championIdKey)
    ));
  }

  function getPlannedPickThreatStats({ stats, champSelect, localMember, limit = 3 } = {}) {
    const plannedChampionId = getPlannedPickChampionId(localMember);
    const position = normalizePosition(localMember?.assignedPosition);
    if (!plannedChampionId || !position) {
      return { plannedChampionId, position, statsList: [] };
    }

    const unavailableReasons = collectUnavailableChampionReasons(champSelect);
    const statsList = sortWorstWinRateStats((Array.isArray(stats) ? stats : []).filter((entry) => (
      Number(entry?.championId) === plannedChampionId &&
      normalizePosition(entry?.position) === position &&
      !unavailableReasons.has(Number(entry?.opponentChampionId))
    )), 'opponentChampionId').slice(0, limit);

    return { plannedChampionId, position, statsList };
  }

  function getBestIntoOpponentStats({ stats, opponentChampionId, position, limit = 5 } = {}) {
    const opponentId = Number(opponentChampionId) || 0;
    const normalizedPosition = normalizePosition(position);
    if (!opponentId || !normalizedPosition) return [];

    return sortBestWinRateStats((Array.isArray(stats) ? stats : []).filter((entry) => (
      Number(entry?.opponentChampionId) === opponentId &&
      normalizePosition(entry?.position) === normalizedPosition
    ))).slice(0, limit);
  }

  function sortPickPoolCandidates(candidates, reliableSampleGames = 5) {
    return [...(Array.isArray(candidates) ? candidates : [])].sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;

      const aGames = Number(a.stats?.games || 0);
      const bGames = Number(b.stats?.games || 0);
      if (Boolean(aGames) !== Boolean(bGames)) return aGames > 0 ? -1 : 1;

      const aReliable = aGames >= reliableSampleGames;
      const bReliable = bGames >= reliableSampleGames;
      if (aReliable !== bReliable) return aReliable ? -1 : 1;

      return (
        (Number(b.stats?.winRate || 0) - Number(a.stats?.winRate || 0)) ||
        (bGames - aGames) ||
        (Number(a.championId) - Number(b.championId))
      );
    });
  }

  function getDraftPanelState(state) {
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

  function createInGameContext({ champSelect, summonerName = '', matchupStats = [] } = {}) {
    const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
    const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
    const localMember = getLocalChampSelectMember(champSelect);
    const championId = getMemberChampionId(localMember);
    const position = normalizePosition(localMember?.assignedPosition);
    const opponent = enemyTeam.find((member) => (
      normalizePosition(member?.assignedPosition) === position &&
      getMemberChampionId(member) > 0
    )) || null;
    const opponentChampionId = getMemberChampionId(opponent);
    const directMatchupStats = championId > 0 && opponentChampionId > 0 && position
      ? (Array.isArray(matchupStats) ? matchupStats : []).find((stats) => (
        Number(stats?.championId) === championId &&
        Number(stats?.opponentChampionId) === opponentChampionId &&
        normalizePosition(stats?.position) === position
      )) || null
      : null;

    return {
      championId,
      position,
      summonerName,
      opponentChampionId,
      directMatchupStats,
      allyChampionIds: allyTeam.map(getMemberChampionId).filter((id) => id > 0).slice(0, 5),
      enemyChampionIds: enemyTeam.map(getMemberChampionId).filter((id) => id > 0).slice(0, 5)
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
    normalizeChampionId,
    normalizeChampionIds,
    uniqueChampionIds,
    createDefaultChampionPool,
    normalizeChampionPool,
    collectBans,
    getActiveAction,
    normalizePosition,
    getPlannedPickChampionId,
    getMemberChampionId,
    getLocalChampSelectMember,
    collectUnavailableChampionReasons,
    sortWorstWinRateStats,
    sortBestWinRateStats,
    getPlannedPickThreatStats,
    getBestIntoOpponentStats,
    sortPickPoolCandidates,
    getDraftPanelState,
    createInGameContext
  };
});
