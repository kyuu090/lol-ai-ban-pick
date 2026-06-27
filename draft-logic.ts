type DraftAnyRecord = Record<string, any>;
type ChampionPool = Record<string, number[]>;
type ChampionLabel = (championId: number) => string;
type ChampSelectMemberRecord = DraftAnyRecord;
type ChampSelectSessionRecord = DraftAnyRecord;
type SortableStats = DraftAnyRecord;

(function attachDraftLogic(root: any, factory: () => DraftAnyRecord) {
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
  const CHAMPION_POOL_LANE_TO_POSITION = {
    top: 'TOP',
    jungle: 'JUNGLE',
    middle: 'MIDDLE',
    bottom: 'BOTTOM',
    utility: 'UTILITY'
  };
  const SUPPORTED_DRAFT_QUEUE_IDS = new Set([400, 420, 440]);
  const SUMMONERS_RIFT_MAP_ID = 11;

  function hasUsableData(value: any): value is DraftAnyRecord {
    return value && typeof value === 'object' && !value.error;
  }

  function getPhase(state: DraftAnyRecord | null | undefined): string | null {
    return typeof state?.gameflowPhase === 'string' ? state.gameflowPhase : null;
  }

  function getSummonerName(summoner: DraftAnyRecord | null | undefined): string {
    if (!hasUsableData(summoner)) return '';
    return summoner.gameName || summoner.displayName || summoner.internalName || summoner.name || 'Summoner';
  }

  function positionLabel(position: any): string {
    return position ? (POSITION_LABELS as Record<string, string>)[String(position).toLowerCase()] || String(position).toUpperCase() : '未確定';
  }

  function getPendingLabel(member: DraftAnyRecord | null | undefined, championLabel: ChampionLabel): string {
    if (member?.championPickIntent) {
      return `${championLabel(member.championPickIntent)} を予定`;
    }
    return 'PICKING NEXT';
  }

  function normalizeChampionIds(value: any): number[] {
    return Array.isArray(value)
      ? value.map(normalizeChampionId).filter((championId) => championId !== null)
      : [];
  }

  function normalizeChampionId(value: any): number | null {
    const championId = Number(value);
    return Number.isInteger(championId) && championId > 0 ? championId : null;
  }

  function uniqueChampionIds(championIds: number[]): number[] {
    return [...new Set(championIds)];
  }

  function createDefaultChampionPool(): ChampionPool {
    return CHAMPION_POOL_LANES.reduce((pool, lane) => {
      pool[lane.id] = [];
      return pool;
    }, {} as ChampionPool);
  }

  function normalizeChampionPool(value: any): ChampionPool {
    const source = value && typeof value === 'object' ? value : {};
    const pool = createDefaultChampionPool();

    CHAMPION_POOL_LANES.forEach((lane) => {
      pool[lane.id] = uniqueChampionIds(normalizeChampionIds(source[lane.id]));
    });

    return pool;
  }

  function collectBans(
    champSelect: ChampSelectSessionRecord | null | undefined,
    allyTeam: ChampSelectMemberRecord[] = [],
    enemyTeam: ChampSelectMemberRecord[] = []
  ) {
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

  function getActiveAction(champSelect: ChampSelectSessionRecord | null | undefined, preferredActorCellId: any = null): DraftAnyRecord | null {
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

  function normalizePosition(position: any): string {
    return String(position || '').toUpperCase();
  }

  function getPlannedPickChampionId(localMember: ChampSelectMemberRecord | null | undefined): number {
    return getMemberChampionId(localMember);
  }

  function getMemberChampionId(member: ChampSelectMemberRecord | null | undefined): number {
    const selectedChampionId = Number(member?.championId) || 0;
    if (selectedChampionId > 0) return selectedChampionId;

    const intendedChampionId = Number(member?.championPickIntent) || 0;
    return intendedChampionId > 0 ? intendedChampionId : 0;
  }

  function getLocalChampSelectMember(champSelect: ChampSelectSessionRecord | null | undefined): ChampSelectMemberRecord | null {
    const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
    const localCellId = champSelect?.localPlayerCellId;
    return allyTeam.find((member) => member.cellId === localCellId) || null;
  }

  function collectUnavailableChampionReasons(
    champSelect: ChampSelectSessionRecord | null | undefined,
    allyTeam: ChampSelectMemberRecord[] | undefined = champSelect?.myTeam,
    enemyTeam: ChampSelectMemberRecord[] | undefined = champSelect?.theirTeam
  ): Map<number, string> {
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

  function compareChampionName(a: SortableStats, b: SortableStats, championIdKey: string = 'championId'): number {
    const aName = a?.championName || a?.opponentChampionName || `Champion ${Number(a?.[championIdKey]) || 0}`;
    const bName = b?.championName || b?.opponentChampionName || `Champion ${Number(b?.[championIdKey]) || 0}`;
    return String(aName).localeCompare(String(bName), 'en');
  }

  function sortWorstWinRateStats(stats: any, championIdKey: string = 'championId'): SortableStats[] {
    return [...(Array.isArray(stats) ? stats : [])].sort((a, b) => (
      (Number(a?.winRate || 0) - Number(b?.winRate || 0)) ||
      (Number(b?.games || 0) - Number(a?.games || 0)) ||
      compareChampionName(a, b, championIdKey)
    ));
  }

  function sortBestWinRateStats(stats: any, championIdKey: string = 'championId'): SortableStats[] {
    return [...(Array.isArray(stats) ? stats : [])].sort((a, b) => (
      (Number(b?.winRate || 0) - Number(a?.winRate || 0)) ||
      (Number(b?.games || 0) - Number(a?.games || 0)) ||
      compareChampionName(a, b, championIdKey)
    ));
  }

  function getPlannedPickThreatStats({
    stats,
    champSelect,
    localMember,
    limit = 3
  }: {
    stats?: SortableStats[];
    champSelect?: ChampSelectSessionRecord | null;
    localMember?: ChampSelectMemberRecord | null;
    limit?: number;
  } = {}) {
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

  function getBestIntoOpponentStats({
    stats,
    opponentChampionId,
    position,
    limit = 5
  }: {
    stats?: SortableStats[];
    opponentChampionId?: any;
    position?: any;
    limit?: number;
  } = {}): SortableStats[] {
    const opponentId = Number(opponentChampionId) || 0;
    const normalizedPosition = normalizePosition(position);
    if (!opponentId || !normalizedPosition) return [];

    return sortBestWinRateStats((Array.isArray(stats) ? stats : []).filter((entry) => (
      Number(entry?.opponentChampionId) === opponentId &&
      normalizePosition(entry?.position) === normalizedPosition
    ))).slice(0, limit);
  }

  function sortPickPoolCandidates(candidates: any, reliableSampleGames: number = 5): DraftAnyRecord[] {
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

  function getDraftPanelState(state: DraftAnyRecord | null | undefined) {
    const currentState = state || {};
    const phase = getPhase(state);
    const champSelect = hasUsableData(currentState.champSelect) ? currentState.champSelect : null;
    const loggedIn = currentState.lcuStatus === 'connected' && hasUsableData(currentState.summoner);
    const inGame = ['InProgress', 'GameStart'].includes(String(phase));
    const supportedDraftGameMode = isSupportedDraftGameMode(state);
    const inChampSelect = phase === 'ChampSelect' && Boolean(champSelect) && !inGame && supportedDraftGameMode;
    const unsupportedGameMode = loggedIn &&
      ['ChampSelect', 'GameStart', 'InProgress'].includes(String(phase)) &&
      hasGameModeEvidence(state) &&
      !supportedDraftGameMode;

    return {
      phase,
      champSelect,
      loggedIn,
      inGame,
      inChampSelect,
      supportedDraftGameMode,
      unsupportedGameMode
    };
  }

  function isSupportedDraftGameMode(state: DraftAnyRecord | null | undefined): boolean {
    return collectGameModeCandidates(state).some(isSupportedDraftCandidate);
  }

  function hasGameModeEvidence(state: DraftAnyRecord | null | undefined): boolean {
    return collectGameModeCandidates(state).length > 0;
  }

  function collectGameModeCandidates(
    state: DraftAnyRecord | null | undefined
  ): Array<{ gameData: DraftAnyRecord; queue: DraftAnyRecord }> {
    const candidates: Array<{ gameData: DraftAnyRecord; queue: DraftAnyRecord }> = [];
    const gameflowSession = state?.gameflowSession;
    if (hasUsableData(gameflowSession)) {
      const gameData = gameflowSession.gameData || {};
      candidates.push({
        gameData,
        queue: gameData.queue || gameflowSession.queue || {}
      });
    }

    const lobby = state?.lobby;
    if (hasUsableData(lobby)) {
      const gameConfig = lobby.gameConfig || {};
      candidates.push({
        gameData: {
          mapId: gameConfig.mapId,
          gameMode: gameConfig.gameMode || gameConfig.gameModeName,
          queueId: gameConfig.queueId,
          isCustomGame: gameConfig.isCustom || gameConfig.isCustomGame
        },
        queue: {
          id: gameConfig.queueId,
          queueId: gameConfig.queueId,
          mapId: gameConfig.mapId,
          gameMode: gameConfig.gameMode,
          isCustom: gameConfig.isCustom,
          isRanked: gameConfig.isRanked,
          type: gameConfig.queueType,
          pickMode: gameConfig.pickMode
        }
      });
    }

    return candidates.filter(({ gameData, queue }) => hasQueueEvidence(gameData, queue));
  }

  function isSupportedDraftCandidate({ gameData, queue }: { gameData: DraftAnyRecord; queue: DraftAnyRecord }): boolean {
    const queueId = normalizeQueueId(queue.id ?? queue.queueId ?? gameData.queueId);
    if (SUPPORTED_DRAFT_QUEUE_IDS.has(queueId)) return true;

    if (!isSummonersRiftClassicGame(gameData, queue)) return false;

    const isRanked = queue.isRanked === true || String(queue.type || '').toUpperCase() === 'RANKED';
    if (isRanked && hasDraftPickMode(queue)) return true;

    const isCustom = queue.isCustom === true ||
      gameData.isCustomGame === true ||
      String(queue.type || '').toUpperCase() === 'CUSTOM';
    return isCustom && hasDraftPickMode(queue);
  }

  function hasQueueEvidence(gameData: DraftAnyRecord, queue: DraftAnyRecord): boolean {
    return Boolean(
      normalizeQueueId(queue?.id ?? queue?.queueId ?? gameData?.queueId) ||
      normalizeQueueId(queue?.mapId ?? gameData?.mapId ?? gameData?.map?.id) ||
      queue?.gameMode ||
      gameData?.gameMode ||
      gameData?.map?.gameMode ||
      queue?.pickMode ||
      queue?.type
    );
  }

  function isSummonersRiftClassicGame(gameData: DraftAnyRecord, queue: DraftAnyRecord): boolean {
    const mapId = normalizeQueueId(queue?.mapId ?? gameData?.mapId ?? gameData?.map?.id);
    const gameMode = String(queue?.gameMode || gameData?.gameMode || gameData?.map?.gameMode || '').toUpperCase();
    return mapId === SUMMONERS_RIFT_MAP_ID && gameMode === 'CLASSIC';
  }

  function normalizeQueueId(value: any): number {
    const queueId = Number(value);
    return Number.isInteger(queueId) ? queueId : 0;
  }

  function hasDraftPickMode(queue: DraftAnyRecord): boolean {
    const gameTypeConfig = queue?.gameTypeConfig || {};
    const text = [
      queue?.pickMode,
      gameTypeConfig.pickMode,
      gameTypeConfig.banMode,
      queue?.name,
      queue?.shortName,
      queue?.description,
      queue?.detailedDescription
    ].map((value) => String(value || '').toLowerCase()).join(' ');

    return text.includes('draft') ||
      text.includes('tournament') ||
      text.includes('ドラフト') ||
      text.includes('トーナメント');
  }

  function createInGameContext({
    champSelect,
    summonerName = '',
    matchupStats = []
  }: {
    champSelect?: ChampSelectSessionRecord | null;
    summonerName?: string;
    matchupStats?: SortableStats[];
  } = {}) {
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

  function createPickPhaseDraftContext({
    champSelect,
    localMember,
    championPool = {},
    championLabel = defaultChampionLabel
  }: {
    champSelect?: ChampSelectSessionRecord | null;
    localMember?: ChampSelectMemberRecord | null;
    championPool?: ChampionPool;
    championLabel?: ChampionLabel;
  } = {}) {
    const localRole = normalizePosition(localMember?.assignedPosition);
    if (!localRole) return null;

    const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
    const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];

    return {
      phase: 'own_pick',
      localPlayer: {
        intendedPick: createDraftChampionEntry(localMember, { preferIntent: true, championLabel })
      },
      allyTeam: {
        intendedPicks: allyTeam
          .filter((member) => member?.cellId !== localMember?.cellId && !(Number(member?.championId) > 0))
          .map((member) => createDraftChampionEntry(member, { preferIntent: true, championLabel }))
          .filter(Boolean),
        lockedPicks: allyTeam
          .filter((member) => member?.cellId !== localMember?.cellId)
          .map((member) => createDraftChampionEntry(member, { preferLocked: true, championLabel }))
          .filter(Boolean)
      },
      enemyTeam: {
        lockedPicks: enemyTeam
          .map((member) => createDraftChampionEntry(member, { preferLocked: true, championLabel }))
          .filter(Boolean)
      },
      ownChampionPool: createOwnChampionPoolEntries({ role: localRole, championPool, championLabel })
    };
  }

  function isChampSelectFinalization(champSelect: ChampSelectSessionRecord | null | undefined, gameflowPhase: any): boolean {
    if (gameflowPhase !== 'ChampSelect') return false;

    const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
    const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
    const allPlayersPicked = allyTeam.length >= 5 &&
      enemyTeam.length >= 5 &&
      [...allyTeam, ...enemyTeam].every((member) => getMemberChampionId(member) > 0);
    const timerPhase = String(champSelect?.timer?.phase || '').toUpperCase();
    if (timerPhase === 'FINALIZATION') return true;
    if (!allPlayersPicked) return false;

    const actions = Array.isArray(champSelect?.actions) ? champSelect.actions.flat() : [];
    const pickActions = actions.filter((action) => action?.type === 'pick');
    return pickActions.length > 0 && pickActions.every((action) => action?.completed && !action?.isInProgress);
  }

  function createFinalCompositionDraftContext({
    champSelect,
    localMember,
    championLabel = defaultChampionLabel
  }: {
    champSelect?: ChampSelectSessionRecord | null;
    localMember?: ChampSelectMemberRecord | null;
    championLabel?: ChampionLabel;
  } = {}) {
    const allyTeam = Array.isArray(champSelect?.myTeam) ? champSelect.myTeam : [];
    const enemyTeam = Array.isArray(champSelect?.theirTeam) ? champSelect.theirTeam : [];
    const localPlayer = localMember || getLocalChampSelectMember(champSelect);
    const localLockedPick = createDraftChampionEntry(localPlayer, { preferLocked: true, championLabel });
    if (!localLockedPick) return null;

    const allyLockedPicks = allyTeam
      .filter((member) => member?.cellId !== localPlayer?.cellId)
      .map((member) => createDraftChampionEntry(member, { preferLocked: true, championLabel }))
      .filter(Boolean);
    const enemyLockedPicks = enemyTeam
      .map((member) => createDraftChampionEntry(member, { preferLocked: true, championLabel }))
      .filter(Boolean);
    if (allyLockedPicks.length < 4 || enemyLockedPicks.length < 5) return null;

    return {
      phase: 'final_composition',
      localPlayer: {
        lockedPick: localLockedPick
      },
      allyTeam: {
        lockedPicks: allyLockedPicks
      },
      enemyTeam: {
        lockedPicks: enemyLockedPicks
      }
    };
  }

  function createDraftChampionEntry(
    member: ChampSelectMemberRecord | null | undefined,
    { preferIntent = false, preferLocked = false, championLabel = defaultChampionLabel }: {
      preferIntent?: boolean;
      preferLocked?: boolean;
      championLabel?: ChampionLabel;
    } = {}
  ) {
    const championId = preferLocked
      ? Number(member?.championId)
      : preferIntent
        ? Number(member?.championPickIntent)
        : getMemberChampionId(member);
    if (!Number.isInteger(championId) || championId <= 0) return null;

    return {
      championId,
      championName: championLabel(championId)
    };
  }

  function createOwnChampionPoolEntries({
    role,
    championPool = {},
    championLabel = defaultChampionLabel
  }: {
    role?: string;
    championPool?: ChampionPool;
    championLabel?: ChampionLabel;
  } = {}) {
    const lane = CHAMPION_POOL_LANES.find((entry) => (CHAMPION_POOL_LANE_TO_POSITION as Record<string, string>)[entry.id] === role);
    if (!lane) return [];

    return (championPool[lane.id] || [])
      .map((championId) => Number(championId))
      .filter((championId) => Number.isInteger(championId) && championId > 0)
      .map((championId) => ({
        championId,
        championName: championLabel(championId)
      }));
  }

  function defaultChampionLabel(championId: number): string {
    return `Champion ${championId}`;
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
    isSupportedDraftGameMode,
    hasGameModeEvidence,
    createInGameContext,
    createPickPhaseDraftContext,
    isChampSelectFinalization,
    createFinalCompositionDraftContext
  };
});
