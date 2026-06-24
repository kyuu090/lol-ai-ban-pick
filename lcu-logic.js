function parseLockfile(raw) {
  const [processName, pid, port, password, protocol] = String(raw).trim().split(':');

  if (!port || !password || !protocol) {
    throw new Error('lockfileの形式を読み取れませんでした');
  }

  return { processName, pid, port, password, protocol };
}

function createAuthHeader(password) {
  return `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`;
}

function createChampionsById(championSummary) {
  const champions = Array.isArray(championSummary) ? championSummary : [];

  return champions.reduce((acc, champion) => {
    const championId = Number(champion.id);
    if (!Number.isInteger(championId) || championId <= 0) return acc;

    acc[championId] = {
      id: championId,
      name: champion.name,
      alias: champion.alias,
      title: champion.title,
      squarePortraitPath: champion.squarePortraitPath
    };
    return acc;
  }, {});
}

function normalizeGameflowSelectedPosition(position) {
  const normalized = String(position || '').trim().toUpperCase();
  if (normalized === 'JUNGLE') return 'JUNGLE';
  if (normalized === 'MIDDLE') return 'MIDDLE';
  if (normalized === 'BOTTOM') return 'BOTTOM';
  if (normalized === 'UTILITY' || normalized === 'SUPPORT') return 'UTILITY';
  if (normalized === 'TOP') return 'TOP';
  return '';
}

function createLaneMatchupAnalysisRequest({ gameflowSession, localPuuid, championsById = {} } = {}) {
  const phase = String(gameflowSession?.phase || '').trim();
  if (!['GameStart', 'InProgress'].includes(phase)) return null;

  const gameData = gameflowSession?.gameData;
  const teamOne = normalizeGameflowTeam(gameData?.teamOne);
  const teamTwo = normalizeGameflowTeam(gameData?.teamTwo);
  if (!teamOne.length || !teamTwo.length) return null;

  const localParticipant = findLocalParticipant({
    teamOne,
    teamTwo,
    playerChampionSelections: gameData?.playerChampionSelections,
    localPuuid
  });
  if (!localParticipant) return null;

  const localTeam = localParticipant.team === 'teamOne' ? teamOne : teamTwo;
  const enemyTeam = localParticipant.team === 'teamOne' ? teamTwo : teamOne;
  const localPosition = normalizeGameflowSelectedPosition(localParticipant.selectedPosition);
  if (!localParticipant.championId || !localPosition) return null;

  const gameId = gameData?.gameId ?? gameflowSession?.gameId ?? null;
  const championName = (championId) => getChampionName(championsById, championId);

  if (localPosition === 'BOTTOM' || localPosition === 'UTILITY') {
    const localBottom = findTeamParticipantByPosition(localTeam, 'BOTTOM');
    const localSupport = findTeamParticipantByPosition(localTeam, 'UTILITY');
    const enemyBottom = findTeamParticipantByPosition(enemyTeam, 'BOTTOM');
    const enemySupport = findTeamParticipantByPosition(enemyTeam, 'UTILITY');
    if (!localBottom || !localSupport || !enemyBottom || !enemySupport) return null;

    const payload = {
      myChampionName: `${championName(localBottom.championId)}/${championName(localSupport.championId)}`,
      myChampionId: `${localBottom.championId}/${localSupport.championId}`,
      lane: 'BOTTOM/SUPPORT',
      enemyChampionName: `${championName(enemyBottom.championId)}/${championName(enemySupport.championId)}`,
      enemyChampionId: `${enemyBottom.championId}/${enemySupport.championId}`
    };

    return {
      gameId,
      localPosition,
      opponentPosition: localPosition,
      localChampionIds: [localBottom.championId, localSupport.championId],
      enemyChampionIds: [enemyBottom.championId, enemySupport.championId],
      payload,
      requestKey: createLaneMatchupRequestKey({ gameId, payload })
    };
  }

  const enemyParticipant = findTeamParticipantByPosition(enemyTeam, localPosition);
  if (!enemyParticipant) return null;

  const payload = {
    myChampionName: championName(localParticipant.championId),
    myChampionId: localParticipant.championId,
    lane: getLaneMatchupLane(localPosition),
    enemyChampionName: championName(enemyParticipant.championId),
    enemyChampionId: enemyParticipant.championId
  };
  if (!payload.lane) return null;

  return {
    gameId,
    localPosition,
    opponentPosition: localPosition,
    localChampionIds: [localParticipant.championId],
    enemyChampionIds: [enemyParticipant.championId],
    payload,
    requestKey: createLaneMatchupRequestKey({ gameId, payload })
  };
}

function normalizeGameflowTeam(team) {
  return (Array.isArray(team) ? team : [])
    .map((participant) => ({
      ...participant,
      championId: normalizePositiveInteger(participant?.championId),
      selectedPosition: normalizeGameflowSelectedPosition(participant?.selectedPosition)
    }))
    .filter((participant) => participant.championId > 0);
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function findLocalParticipant({ teamOne, teamTwo, playerChampionSelections, localPuuid }) {
  const puuid = String(localPuuid || '').trim();
  if (!puuid) return null;

  const directMatch = [
    ...teamOne.map((participant) => ({ participant, team: 'teamOne' })),
    ...teamTwo.map((participant) => ({ participant, team: 'teamTwo' }))
  ].find(({ participant }) => getParticipantPuuid(participant) === puuid);
  if (directMatch) return { ...directMatch.participant, team: directMatch.team };

  const localSelection = (Array.isArray(playerChampionSelections) ? playerChampionSelections : [])
    .find((selection) => getParticipantPuuid(selection) === puuid);
  const championId = normalizePositiveInteger(localSelection?.championId);
  if (!championId) return null;

  const championMatch = [
    ...teamOne.map((participant) => ({ participant, team: 'teamOne' })),
    ...teamTwo.map((participant) => ({ participant, team: 'teamTwo' }))
  ].find(({ participant }) => participant.championId === championId);
  return championMatch ? { ...championMatch.participant, team: championMatch.team } : null;
}

function getParticipantPuuid(participant) {
  return String(participant?.puuid || participant?.playerPuuid || '').trim();
}

function findTeamParticipantByPosition(team, position) {
  const normalizedPosition = normalizeGameflowSelectedPosition(position);
  return team.find((participant) => (
    participant.championId > 0 &&
    normalizeGameflowSelectedPosition(participant.selectedPosition) === normalizedPosition
  )) || null;
}

function getLaneMatchupLane(position) {
  const normalizedPosition = normalizeGameflowSelectedPosition(position);
  if (normalizedPosition === 'TOP') return 'TOP';
  if (normalizedPosition === 'JUNGLE') return 'JG';
  if (normalizedPosition === 'MIDDLE') return 'MID';
  if (normalizedPosition === 'BOTTOM') return 'ADC';
  if (normalizedPosition === 'UTILITY') return 'SUP';
  return '';
}

function getChampionName(championsById, championId) {
  const id = normalizePositiveInteger(championId);
  const name = String(championsById?.[id]?.name || '').trim();
  return name || `Champion ${id}`;
}

function createLaneMatchupRequestKey({ gameId, payload }) {
  return JSON.stringify({
    gameId: gameId ?? null,
    myChampionName: payload.myChampionName,
    myChampionId: payload.myChampionId,
    lane: payload.lane,
    enemyChampionName: payload.enemyChampionName,
    enemyChampionId: payload.enemyChampionId
  });
}

module.exports = {
  parseLockfile,
  createAuthHeader,
  createChampionsById,
  createLaneMatchupAnalysisRequest,
  normalizeGameflowSelectedPosition
};
