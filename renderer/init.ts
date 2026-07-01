// @ts-nocheck
// Thin renderer bootstrap retained as DOM glue while renderer controllers move to strict TypeScript modules.
const elements = window.UiDomElements.elements;
const rendererState = window.RendererState.state;
let aiAnalysisController = null;
let championPoolController = null;
let matchHistoryController = null;
let draftController = null;
const { collectBans, createFinalCompositionDraftContext, createInGameContext, createPickPhaseDraftContext, getActiveAction, getBestIntoOpponentStats, getDraftPanelState, getMemberChampionId, getPhase, getPendingLabel, getPlannedPickThreatStats, getSummonerName, isChampSelectFinalization, normalizePosition, normalizeChampionPool, positionLabel, collectUnavailableChampionReasons, sortPickPoolCandidates, sortBestWinRateStats, sortWorstWinRateStats } = window.DraftLogic;
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
const { formatAverageKda, formatDate, formatMatchDataDate, formatNumber, formatPercent } = window.UiFormatters;
const { loadChampionIcon, loadChampionIconEager } = window.UiChampionIcons;
const { normalizeThemeMode, renderSettings } = window.UiSettingsView;
const { createChampionPoolView } = window.UiChampionPoolView;
const { createMatchDataView } = window.UiMatchDataView;
const { createChampionsView } = window.UiChampionsView;
const { createStatsView } = window.UiStatsView;
const { createInGameView } = window.UiInGameView;
const { createDraftView } = window.UiDraftView;
const championPoolView = createChampionPoolView({
    elements,
    document,
    lanes: CHAMPION_POOL_LANES,
    laneToPosition: CHAMPION_POOL_LANE_TO_POSITION,
    normalizeChampionPool,
    loadChampionIcon,
    championLabel,
    championTitle,
    getChampionRoleDisplayStats,
    createChampionStatsElement,
    getActiveLaneId: () => rendererState.activeChampionPoolLane,
    setActiveLaneId: (laneId) => {
        rendererState.activeChampionPoolLane = laneId;
    },
    getChampionsById: () => rendererState.championsById,
    getChampionPool: () => rendererState.championPool,
    setChampionPool: (nextChampionPool) => {
        rendererState.championPool = nextChampionPool;
    },
    toggleChampionInPool,
    removeChampionFromPool
});
const { forceRenderChampionPool, getActiveChampionPoolLane, getChampionPoolLaneByPosition, getChampionPoolLanePosition, renderChampionPool } = championPoolView;
championPoolController = window.RendererChampionPoolController.createChampionPoolController({
    elements,
    state: rendererState,
    lcuApi: window.lcuApi,
    normalizeChampionPool,
    getActiveChampionPoolLane,
    renderChampionPool,
    logDebug,
    logWarn
});
const { isMatchDataMenuOpen, renderMatchDataSummary, renderMatchHistoryStatus, setMatchDataMenuOpen, toggleMatchDataMenu } = createMatchDataView({
    elements,
    formatMatchDataDate
});
matchHistoryController = window.RendererMatchHistoryController.createMatchHistoryController({
    elements,
    lcuApi: window.lcuApi,
    setMatchDataMenuOpen,
    renderMatchHistoryStatus,
    logDebug,
    logWarn
});
const { initializeStatsApiChampionList, refreshStatsApiChampionList } = createChampionsView({
    elements,
    document,
    createInlineChampionName,
    requestStatsApiJson: window.lcuApi.requestStatsApiJson,
    fetch: window.fetch?.bind(window)
});
const { renderLaneOpponentStats, renderPlayedChampionStats, setStatsSort } = createStatsView({
    elements,
    document,
    lanes: CHAMPION_POOL_LANES,
    getChampionPoolLanePosition,
    createInlineChampionName,
    formatPercent,
    formatAverageKda,
    championLabel,
    formatWinLoss,
    getLosses,
    getPlayedStatsMinGames,
    getOpponentStatsMinGames,
    getMatchHistoryChampionStats: () => rendererState.matchHistoryChampionStats,
    getMatchHistoryLaneOpponentStats: () => rendererState.matchHistoryLaneOpponentStats,
    getMatchHistorySelfVsLaneOpponentStats: () => rendererState.matchHistorySelfVsLaneOpponentStats,
    getActivePlayedLaneId: () => rendererState.activePlayedStatsLane,
    setActivePlayedLaneId: (laneId) => {
        rendererState.activePlayedStatsLane = laneId;
    },
    getActiveOpponentLaneId: () => rendererState.activeOpponentStatsLane,
    setActiveOpponentLaneId: (laneId) => {
        rendererState.activeOpponentStatsLane = laneId;
    },
    getPlayedStatsSortKey: () => rendererState.playedStatsSortKey,
    setPlayedStatsSortKey: (sortKey) => {
        rendererState.playedStatsSortKey = sortKey;
    },
    getOpponentStatsSortKey: () => rendererState.opponentStatsSortKey,
    setOpponentStatsSortKey: (sortKey) => {
        rendererState.opponentStatsSortKey = sortKey;
    },
    getPlayedStatsSortDirection: () => rendererState.playedStatsSortDirection,
    setPlayedStatsSortDirection: (sortDirection) => {
        rendererState.playedStatsSortDirection = sortDirection;
    },
    getOpponentStatsSortDirection: () => rendererState.opponentStatsSortDirection,
    setOpponentStatsSortDirection: (sortDirection) => {
        rendererState.opponentStatsSortDirection = sortDirection;
    },
    getExpandedPlayedStatsChampionId: () => rendererState.expandedPlayedStatsChampionId,
    setExpandedPlayedStatsChampionId: (championId) => {
        rendererState.expandedPlayedStatsChampionId = championId;
    },
    getExpandedOpponentStatsChampionId: () => rendererState.expandedOpponentStatsChampionId,
    setExpandedOpponentStatsChampionId: (championId) => {
        rendererState.expandedOpponentStatsChampionId = championId;
    },
    getShouldOpenFirstPlayedStatsRow: () => rendererState.shouldOpenFirstPlayedStatsRow,
    setShouldOpenFirstPlayedStatsRow: (shouldOpen) => {
        rendererState.shouldOpenFirstPlayedStatsRow = shouldOpen;
    },
    getShouldOpenFirstOpponentStatsRow: () => rendererState.shouldOpenFirstOpponentStatsRow,
    setShouldOpenFirstOpponentStatsRow: (shouldOpen) => {
        rendererState.shouldOpenFirstOpponentStatsRow = shouldOpen;
    }
});
const { renderInGame, renderInGameFinalCompositionAnalysis } = createInGameView({
    elements,
    document,
    createInGameContext,
    getLastChampSelectSnapshot: () => rendererState.lastChampSelectSnapshot,
    getSummonerName,
    getMatchHistorySelfVsLaneOpponentStats: () => rendererState.matchHistorySelfVsLaneOpponentStats,
    championLabel,
    championTitle,
    positionLabel,
    loadChampionIcon,
    loadChampionIconEager,
    getChampionRoleDisplayStats,
    createPickPoolStatChip,
    formatPercent,
    formatAverageKda,
    getFinalCompositionAnalysisStatus: () => rendererState.finalCompositionAnalysisStatus,
    getFinalCompositionAnalysisNotes: () => rendererState.finalCompositionAnalysisNotes,
    getFinalCompositionAnalysisError: () => rendererState.finalCompositionAnalysisError
});
const { renderChampSelect, renderDraftAiAnalysis } = createDraftView({
    elements,
    document,
    collectBans,
    getActiveAction,
    isChampSelectFinalization,
    championLabel,
    championTitle,
    positionLabel,
    getPendingLabel,
    getMemberChampionId,
    loadChampionIcon,
    createInlineChampionName,
    createChampionStatsElement,
    getChampionRoleDisplayStats,
    getMarkedLaneOpponentCellId: () => rendererState.markedLaneOpponentCellId,
    setMarkedLaneOpponentCellId: (cellId) => {
        rendererState.markedLaneOpponentCellId = cellId;
    },
    toggleMarkedLaneOpponent,
    requestDraftAiAnalysisIfNeeded,
    requestFinalCompositionAnalysisIfNeeded,
    normalizeChampionPool,
    getChampionPool: () => rendererState.championPool,
    setChampionPool: (nextChampionPool) => {
        rendererState.championPool = nextChampionPool;
    },
    getChampionPoolLaneByPosition,
    collectUnavailableChampionReasons,
    sortPickPoolCandidates,
    sortWorstWinRateStats,
    getPlannedPickThreatStats,
    getBestIntoOpponentStats,
    getMatchHistoryLaneOpponentStats: () => rendererState.matchHistoryLaneOpponentStats,
    getMatchHistoryEnemyChampionStats: () => rendererState.matchHistoryEnemyChampionStats,
    getMatchHistorySelfVsLaneOpponentStats: () => rendererState.matchHistorySelfVsLaneOpponentStats,
    getBanInsightMinGames: () => rendererState.banInsightMinGames,
    setBanInsightMinGames: (minGames) => {
        rendererState.banInsightMinGames = minGames;
    },
    logDebug,
    appendLowSampleBadge,
    createWinRateStatsElement,
    createPickPoolStatChip,
    formatPercent,
    formatAverageKda,
    RELIABLE_SAMPLE_GAMES,
    PICK_POOL_CANDIDATE_LIMIT,
    BAN_INSIGHT_LIMIT,
    BAN_INSIGHT_SAMPLE_OPTIONS,
    getDraftAiAnalysisStatus: () => rendererState.draftAiAnalysisStatus,
    getDraftAiAnalysisPhase: () => rendererState.draftAiAnalysisPhase,
    getDraftAiAnalysisError: () => rendererState.draftAiAnalysisError,
    getDraftAiAnalysisNotes: () => rendererState.draftAiAnalysisNotes
});
const { renderStatsSubtabs, setActiveStatsView, setActiveView } = window.RendererNavigation.createNavigationController({
    elements,
    state: rendererState,
    logDebug,
    forceRenderChampionPool
});
aiAnalysisController = window.RendererAiAnalysisController.createAiAnalysisController({
    state: rendererState,
    lcuApi: window.lcuApi,
    createPickPhaseDraftContext,
    createFinalCompositionDraftContext,
    championLabel,
    logDebug,
    renderDraftAiAnalysis,
    renderInGameFinalCompositionAnalysis
});
draftController = window.RendererDraftController.createDraftController({
    elements,
    state: rendererState,
    getDraftPanelState,
    getPhase,
    getSummonerName,
    stringify,
    formatDate,
    renderChampSelect,
    renderInGame,
    resetDraftAiAnalysis,
    resetFinalCompositionAnalysis,
    logDebug
});
function stringify(value) {
    return JSON.stringify(value ?? null, null, 2);
}
function logDebug(message, details) {
    window.lcuApi?.log?.('debug', message, details);
}
function logWarn(message, details) {
    window.lcuApi?.log?.('warn', message, details);
}
function renderWindowMaximizedState(isMaximized) {
    elements.windowMaximizeButton.textContent = isMaximized ? '❐' : '□';
    elements.windowMaximizeButton.setAttribute('aria-label', isMaximized ? '元に戻す' : '最大化');
}
function championLabel(championId) {
    const id = Number(championId);
    if (id <= 0)
        return '未選択';
    return rendererState.championsById[id]?.name || `Champion ${id}`;
}
function championTitle(championId) {
    const champion = rendererState.championsById[Number(championId)];
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
    if (!id || !normalizedPosition)
        return null;
    return rendererState.matchHistoryChampionStats.find((stats) => (Number(stats.championId) === id &&
        stats.queueGroup === 'all_sr_5v5' &&
        String(stats.position || '').toUpperCase() === normalizedPosition)) || null;
}
function appendLowSampleBadge(container, games) {
    const sampleGames = Number(games || 0);
    if (sampleGames <= 0 || sampleGames >= RELIABLE_SAMPLE_GAMES)
        return;
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
    return Number.isInteger(selectedGames) && selectedGames > 0 ? selectedGames : rendererState.playedStatsMinGames;
}
function getOpponentStatsMinGames() {
    const selectedGames = Number(elements.opponentStatsSampleSelect?.value);
    return Number.isInteger(selectedGames) && selectedGames > 0 ? selectedGames : rendererState.opponentStatsMinGames;
}
const { renderDebug, renderState, syncDraftAutoFocus } = window.RendererStateSync.createStateSyncController({
    elements,
    state: rendererState,
    getDraftPanelState,
    normalizeChampionPool,
    renderStatus,
    renderMatchHistoryStatus,
    renderMatchDataSummary,
    renderSettings,
    renderChampionPool,
    renderPlayedChampionStats,
    renderLaneOpponentStats,
    renderDraft,
    setActiveView,
    stringify,
    resetFinalCompositionAnalysis
});
function renderCounters() {
    const lane = CHAMPION_POOL_LANES.find((entry) => entry.id === activeCounterLane) || CHAMPION_POOL_LANES[0];
    renderCounterLaneTabs();
    renderWeakChampionLists(lane);
}
function renderWeakChampionLists(lane = getActiveChampionPoolLane()) {
    const minGames = getWeakChampionMinGames();
    const position = getChampionPoolLanePosition(lane.id);
    const enemyStats = sortWorstWinRateStats(rendererState.matchHistoryEnemyChampionStats.filter((stats) => (Number(stats.games || 0) >= minGames &&
        Number(stats.winRate || 0) < 0.5))).slice(0, 8);
    const laneStats = sortWorstWinRateStats(rendererState.matchHistoryLaneOpponentStats.filter((stats) => (String(stats.position || '').toUpperCase() === position &&
        Number(stats.games || 0) >= minGames &&
        Number(stats.winRate || 0) < 0.5))).slice(0, 8);
    elements.weakLaneChampionTitle.textContent = lane.label;
    renderWeakChampionList(elements.weakEnemyChampionList, elements.weakEnemyChampionEmpty, enemyStats, '条件に合う試合データがありません。');
    renderWeakChampionList(elements.weakLaneChampionList, elements.weakLaneChampionEmpty, laneStats, '条件に合う対面データがありません。', { includeSelfPicks: true, position });
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
        }
        else {
            item.append(createStatsEmptySide('YOU', 'you', '自分のピック実績なし'), main);
        }
    }
    else {
        item.append(main);
    }
    return item;
}
function createLaneSelfPickSummary(opponentStats, position, options = {}) {
    const opponentChampionId = Number(opponentStats?.opponentChampionId || opponentStats?.championId) || 0;
    const normalizedPosition = String(position || opponentStats?.position || '').toUpperCase();
    if (!opponentChampionId || !normalizedPosition)
        return null;
    const matchupStats = rendererState.matchHistorySelfVsLaneOpponentStats.filter((stats) => (Number(stats.opponentChampionId) === opponentChampionId &&
        String(stats.position || '').toUpperCase() === normalizedPosition &&
        Number(stats.games || 0) > 0));
    if (!matchupStats.length)
        return null;
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
    if (!lostWith.length && !wonWith.length)
        return null;
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
    return ((getLosses(b) - getLosses(a)) ||
        (Number(a.winRate || 0) - Number(b.winRate || 0)) ||
        (Number(b.games || 0) - Number(a.games || 0)) ||
        championLabel(a.championId).localeCompare(championLabel(b.championId), 'en'));
}
function compareStrongSelfPickStats(a, b) {
    return ((Number(b.wins || 0) - Number(a.wins || 0)) ||
        (Number(b.winRate || 0) - Number(a.winRate || 0)) ||
        (Number(b.games || 0) - Number(a.games || 0)) ||
        championLabel(a.championId).localeCompare(championLabel(b.championId), 'en'));
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
    const championStats = sortBestWinRateStats(rendererState.matchHistoryChampionStats.filter((stats) => (stats.queueGroup === 'all_sr_5v5' &&
        String(stats.position || '').toUpperCase() === position &&
        Number(stats.games || 0) >= minGames &&
        Number(stats.winRate || 0) > 0.5))).slice(0, 8);
    const matchupStats = getStrongLaneMatchupStats(position, minGames).slice(0, 8);
    elements.strongLaneMatchupTitle.textContent = lane.label;
    renderStrongChampionList(elements.strongChampionList, elements.strongChampionEmpty, championStats, createStrongChampionItem, '条件に合うチャンピオン実績がありません。');
    renderStrongChampionList(elements.strongLaneMatchupList, elements.strongLaneMatchupEmpty, matchupStats, createStrongLaneMatchupItem, '条件に合う対面データがありません。');
}
function getStrongLaneMatchupStats(position, minGames) {
    const normalizedPosition = String(position || '').toUpperCase();
    const bestByOpponent = new Map();
    rendererState.matchHistorySelfVsLaneOpponentStats.filter((stats) => (String(stats.position || '').toUpperCase() === normalizedPosition &&
        Number(stats.games || 0) >= minGames &&
        Number(stats.winRate || 0) > 0.5 &&
        Number(stats.wins || 0) > 0))
        .forEach((stats) => {
        const opponentChampionId = Number(stats.opponentChampionId) || 0;
        if (opponentChampionId <= 0)
            return;
        const current = bestByOpponent.get(opponentChampionId);
        if (!current || compareStrongMatchupStats(stats, current) < 0) {
            bestByOpponent.set(opponentChampionId, stats);
        }
    });
    return Array.from(bestByOpponent.values()).sort(compareStrongMatchupStats);
}
function compareStrongMatchupStats(a, b) {
    return ((Number(b.wins || 0) - Number(a.wins || 0)) ||
        (Number(b.winRate || 0) - Number(a.winRate || 0)) ||
        (Number(b.games || 0) - Number(a.games || 0)) ||
        championLabel(a.opponentChampionId).localeCompare(championLabel(b.opponentChampionId), 'en') ||
        championLabel(a.championId).localeCompare(championLabel(b.championId), 'en'));
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
function renderStatus(state) {
    draftController?.renderStatus(state);
}
function renderDraft(state) {
    draftController?.renderDraft(state);
}
function showOnlyDraftPanel(loggedIn, inChampSelect, inGame, unsupportedGameMode = false) {
    draftController?.showOnlyDraftPanel(loggedIn, inChampSelect, inGame, unsupportedGameMode);
}
function resetDraftAiAnalysis() {
    aiAnalysisController?.resetDraftAiAnalysis();
}
function resetFinalCompositionAnalysis() {
    aiAnalysisController?.resetFinalCompositionAnalysis();
}
function requestDraftAiAnalysisIfNeeded(champSelect, localMember, activeAction) {
    aiAnalysisController?.requestDraftAiAnalysisIfNeeded(champSelect, localMember, activeAction);
}
function requestFinalCompositionAnalysisIfNeeded(champSelect, localMember) {
    aiAnalysisController?.requestFinalCompositionAnalysisIfNeeded(champSelect, localMember);
}
function requestDraftAiAnalysis(draftContext, activeAction = null) {
    aiAnalysisController?.requestDraftAiAnalysis(draftContext, activeAction);
}
function createDraftAiAnalysisRequestKey(activeAction, draftContext) {
    return aiAnalysisController?.createDraftAiAnalysisRequestKey(activeAction, draftContext) || '';
}
function createDraftAiAnalysisErrorMessage(error) {
    return aiAnalysisController?.createDraftAiAnalysisErrorMessage(error) || 'AI分析を取得できませんでした。';
}
function parseDraftAiAnalysisNotes(response) {
    return aiAnalysisController?.parseDraftAiAnalysisNotes(response) || [];
}
function toggleMarkedLaneOpponent(cellId) {
    draftController?.toggleMarkedLaneOpponent(cellId);
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
function addChampionToPool(nextChampionId) {
    championPoolController?.addChampionToPool(nextChampionId);
}
function toggleChampionInPool(championId) {
    championPoolController?.toggleChampionInPool(championId);
}
function removeChampionFromPool(championId) {
    championPoolController?.removeChampionFromPool(championId);
}
async function saveChampionPool() {
    await championPoolController?.saveChampionPool();
}
async function chooseLolInstallDir() {
    elements.chooseLolDirButton.disabled = true;
    elements.settingsMessage.textContent = '';
    try {
        const settings = await window.lcuApi.chooseLolInstallDir();
        elements.lolInstallDirInput.value = settings.lolInstallDir;
        logDebug('LoL install directory selected', { lolInstallDir: settings.lolInstallDir });
        elements.settingsMessage.textContent = '保存しました。接続状態を再確認しています。';
    }
    catch (error) {
        logWarn('LoL install directory selection failed', { message: error.message, stack: error.stack });
        elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
    }
    finally {
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
    }
    catch (error) {
        logWarn('LoL install directory save failed', { message: error.message, stack: error.stack });
        elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
    }
    finally {
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
    }
    catch (error) {
        logWarn('Riot platform region save failed', { message: error.message, stack: error.stack });
        elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
    }
    finally {
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
    }
    catch (error) {
        logWarn('Theme mode save failed', { message: error.message, stack: error.stack });
        elements.settingsMessage.textContent = `保存できませんでした: ${error.message}`;
    }
    finally {
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
    }
    finally {
        elements.refreshButton.disabled = false;
        elements.refreshButton.textContent = '手動再取得';
    }
}
async function collectRiotMatchHistory(mode = 'recent') {
    await matchHistoryController?.collectRiotMatchHistory(mode);
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
    if (event.target.closest('.window-titlebar-controls'))
        return;
    window.lcuApi.toggleMaximizeWindow().then(renderWindowMaximizedState);
});
elements.collectRiotMatchesButton.addEventListener('click', () => collectRiotMatchHistory('recent'));
elements.matchDataMenuButton.addEventListener('click', toggleMatchDataMenu);
elements.collectSeasonRiotMatchesButton.addEventListener('click', () => collectRiotMatchHistory('season'));
elements.matchDataSeasonHint.addEventListener('click', () => collectRiotMatchHistory('season'));
document.addEventListener('click', (event) => {
    if (!isMatchDataMenuOpen())
        return;
    if (event.target === elements.matchDataMenuButton || elements.matchDataMenu.contains(event.target))
        return;
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
    rendererState.playedStatsMinGames = getPlayedStatsMinGames();
    rendererState.expandedPlayedStatsChampionId = null;
    rendererState.shouldOpenFirstPlayedStatsRow = true;
    logDebug('Played champion stats sample filter changed', { minGames: rendererState.playedStatsMinGames });
    renderPlayedChampionStats();
});
elements.opponentStatsSampleSelect.addEventListener('change', () => {
    rendererState.opponentStatsMinGames = getOpponentStatsMinGames();
    rendererState.expandedOpponentStatsChampionId = null;
    rendererState.shouldOpenFirstOpponentStatsRow = true;
    logDebug('Lane opponent stats sample filter changed', { minGames: rendererState.opponentStatsMinGames });
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
elements.statsApiPatchSelect.addEventListener('change', () => {
    refreshStatsApiChampionList();
});
elements.statsApiLaneSelect.addEventListener('change', () => {
    refreshStatsApiChampionList();
});
elements.statsApiRefreshButton.addEventListener('click', () => {
    refreshStatsApiChampionList();
});
setActiveView(rendererState.activeView);
initializeStatsApiChampionList();
window.lcuApi.getState().then(renderState);
window.lcuApi.getSettings().then(renderSettings);
window.lcuApi.onWindowMaximized(renderWindowMaximizedState);
window.lcuApi.getChampionPool().then((savedChampionPool) => {
    rendererState.championPool = normalizeChampionPool(savedChampionPool);
    rendererState.championPoolDirty = false;
    renderChampionPool();
});
