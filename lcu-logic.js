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

function createLaneMatchupAnalysisRequest({ gameflowSession, localPuuid, championsById = {}, champSelectSession = null } = {}) {
  const phase = String(gameflowSession?.phase || '').trim();
  if (!['GameStart', 'InProgress'].includes(phase)) return null;

  const gameData = gameflowSession?.gameData;
  const playerChampionSelections = normalizePlayerChampionSelections(gameData?.playerChampionSelections);
  const allyCompletedTeams = inferMissingAllyParticipantsFromChampSelect({
    teamOne: normalizeGameflowTeam(gameData?.teamOne),
    teamTwo: normalizeGameflowTeam(gameData?.teamTwo),
    champSelectSession,
    localPuuid,
    playerChampionSelections
  });
  const inferredTeams = inferMissingGameflowParticipants({
    ...allyCompletedTeams,
    playerChampionSelections
  });
  const { teamOne, teamTwo } = inferredTeams;
  if (!teamOne.length || !teamTwo.length) return null;

  const localParticipant = findLocalParticipant({
    teamOne,
    teamTwo,
    playerChampionSelections,
    localPuuid,
    champSelectSession
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
      laneMatchupLane: 'BOTTOM/SUPPORT',
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
    enemyChampionName: championName(enemyParticipant.championId),
    enemyChampionId: enemyParticipant.championId
  };
  const laneMatchupLane = getLaneMatchupLane(localPosition);
  if (!laneMatchupLane) return null;
  payload.lane = laneMatchupLane;

  return {
    gameId,
    localPosition,
    opponentPosition: localPosition,
    laneMatchupLane,
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

function normalizePlayerChampionSelections(playerChampionSelections) {
  return (Array.isArray(playerChampionSelections) ? playerChampionSelections : [])
    .map((selection) => ({
      ...selection,
      championId: normalizePositiveInteger(selection?.championId)
    }))
    .filter((selection) => selection.championId > 0);
}

function inferMissingAllyParticipantsFromChampSelect({
  teamOne,
  teamTwo,
  champSelectSession,
  localPuuid,
  playerChampionSelections
}) {
  const localParticipant = findLocalParticipant({
    teamOne,
    teamTwo,
    playerChampionSelections,
    localPuuid,
    champSelectSession
  });
  const allyTeamName = localParticipant?.team || inferChampSelectAllyTeamName(teamOne, teamTwo, champSelectSession?.myTeam);
  if (!allyTeamName) return { teamOne, teamTwo };

  const allyTeam = allyTeamName === 'teamOne' ? teamOne : teamTwo;
  const enemyTeam = allyTeamName === 'teamOne' ? teamTwo : teamOne;
  const inferredAllyTeam = inferMissingTeamParticipantsFromChampSelect(allyTeam, enemyTeam, champSelectSession?.myTeam);

  return allyTeamName === 'teamOne'
    ? { teamOne: inferredAllyTeam, teamTwo }
    : { teamOne, teamTwo: inferredAllyTeam };
}

function inferMissingTeamParticipantsFromChampSelect(team, otherTeam, champSelectTeam) {
  if (!Array.isArray(champSelectTeam) || team.length >= 5 || otherTeam.length !== 5) return team;

  const knownChampionIds = new Set(team.map((participant) => participant.championId));
  const missingPositions = new Set(getMissingTeamPositions(team));
  const inferredParticipants = champSelectTeam
    .map(normalizeChampSelectMemberForGameflow)
    .filter((participant) => (
      participant.championId > 0 &&
      participant.selectedPosition &&
      missingPositions.has(participant.selectedPosition) &&
      !knownChampionIds.has(participant.championId)
    ));

  const additions = [];
  inferredParticipants.forEach((participant) => {
    if (!missingPositions.has(participant.selectedPosition)) return;

    additions.push(participant);
    missingPositions.delete(participant.selectedPosition);
    knownChampionIds.add(participant.championId);
  });

  return additions.length ? [...team, ...additions] : team;
}

function normalizeChampSelectMemberForGameflow(member) {
  const championId = normalizePositiveInteger(member?.championId) ||
    normalizePositiveInteger(member?.championPickIntent);

  return {
    championId,
    selectedPosition: normalizeGameflowSelectedPosition(member?.assignedPosition),
    puuid: getParticipantPuuid(member),
    inferredFromChampSelect: true
  };
}

function inferChampSelectAllyTeamName(teamOne, teamTwo, champSelectTeam) {
  const normalizedChampSelectTeam = (Array.isArray(champSelectTeam) ? champSelectTeam : [])
    .map(normalizeChampSelectMemberForGameflow)
    .filter((participant) => participant.championId > 0 || getParticipantPuuid(participant));
  if (!normalizedChampSelectTeam.length) return '';

  const teamOneScore = scoreTeamAgainstChampSelect(teamOne, normalizedChampSelectTeam);
  const teamTwoScore = scoreTeamAgainstChampSelect(teamTwo, normalizedChampSelectTeam);
  if (teamOneScore <= 0 && teamTwoScore <= 0) return '';
  if (teamOneScore === teamTwoScore) return '';
  return teamOneScore > teamTwoScore ? 'teamOne' : 'teamTwo';
}

function scoreTeamAgainstChampSelect(team, champSelectTeam) {
  const teamChampionIds = new Set(team.map((participant) => participant.championId));
  const teamPuuids = new Set(team.map(getParticipantPuuid).filter(Boolean));

  return champSelectTeam.reduce((score, participant) => {
    const championScore = teamChampionIds.has(participant.championId) ? 1 : 0;
    const puuid = getParticipantPuuid(participant);
    const puuidScore = puuid && teamPuuids.has(puuid) ? 2 : 0;
    return score + championScore + puuidScore;
  }, 0);
}

function inferMissingGameflowParticipants({ teamOne, teamTwo, playerChampionSelections }) {
  const knownChampionIds = new Set([
    ...teamOne.map((participant) => participant.championId),
    ...teamTwo.map((participant) => participant.championId)
  ]);
  const unassignedChampionIds = playerChampionSelections
    .map((selection) => selection.championId)
    .filter((championId) => championId > 0 && !knownChampionIds.has(championId));

  if (unassignedChampionIds.length !== 1) {
    return { teamOne, teamTwo };
  }

  const inferForTeam = (team, otherTeam) => {
    const missingPositions = getMissingTeamPositions(team);
    if (team.length !== 4 || otherTeam.length !== 5 || missingPositions.length !== 1) return team;

    return [
      ...team,
      {
        championId: unassignedChampionIds[0],
        selectedPosition: missingPositions[0],
        inferredFromPlayerChampionSelections: true
      }
    ];
  };

  return {
    teamOne: inferForTeam(teamOne, teamTwo),
    teamTwo: inferForTeam(teamTwo, teamOne)
  };
}

function getMissingTeamPositions(team) {
  const positions = new Set(team.map((participant) => normalizeGameflowSelectedPosition(participant.selectedPosition)));
  return ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].filter((position) => !positions.has(position));
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function findLocalParticipant({ teamOne, teamTwo, playerChampionSelections, localPuuid, champSelectSession = null }) {
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
  if (championId) {
    const championMatch = [
      ...teamOne.map((participant) => ({ participant, team: 'teamOne' })),
      ...teamTwo.map((participant) => ({ participant, team: 'teamTwo' }))
    ].find(({ participant }) => participant.championId === championId);
    if (championMatch) return { ...championMatch.participant, team: championMatch.team };
  }

  const champSelectMember = findLocalChampSelectMember(champSelectSession, puuid);
  const team = inferChampSelectAllyTeamName(teamOne, teamTwo, champSelectSession?.myTeam);
  if (!champSelectMember || !team) return null;

  return {
    ...normalizeChampSelectMemberForGameflow(champSelectMember),
    team
  };
}

function findLocalChampSelectMember(champSelectSession, localPuuid) {
  const allyTeam = Array.isArray(champSelectSession?.myTeam) ? champSelectSession.myTeam : [];
  const puuid = String(localPuuid || '').trim();
  const puuidMatch = allyTeam.find((member) => getParticipantPuuid(member) === puuid);
  if (puuidMatch) return puuidMatch;

  const localCellId = Number(champSelectSession?.localPlayerCellId);
  if (!Number.isInteger(localCellId)) return null;
  return allyTeam.find((member) => Number(member?.cellId) === localCellId) || null;
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
    enemyChampionName: payload.enemyChampionName,
    enemyChampionId: payload.enemyChampionId
  });
}

function describeLaneMatchupAnalysisReadiness({ gameflowSession, localPuuid, champSelectSession = null } = {}) {
  const phase = String(gameflowSession?.phase || '').trim();
  if (!gameflowSession) return { ready: false, reason: 'missing_session', phase };
  if (gameflowSession.error) return { ready: false, reason: 'session_error', phase, error: gameflowSession.error };
  if (!['GameStart', 'InProgress'].includes(phase)) {
    return { ready: false, reason: 'unsupported_phase', phase };
  }

  const gameData = gameflowSession?.gameData;
  const puuid = String(localPuuid || '').trim();
  const playerChampionSelections = normalizePlayerChampionSelections(gameData?.playerChampionSelections);
  const allyCompletedTeams = inferMissingAllyParticipantsFromChampSelect({
    teamOne: normalizeGameflowTeam(gameData?.teamOne),
    teamTwo: normalizeGameflowTeam(gameData?.teamTwo),
    champSelectSession,
    localPuuid: puuid,
    playerChampionSelections
  });
  const inferredTeams = inferMissingGameflowParticipants({
    ...allyCompletedTeams,
    playerChampionSelections
  });
  const { teamOne, teamTwo } = inferredTeams;
  const localParticipant = findLocalParticipant({
    teamOne,
    teamTwo,
    playerChampionSelections,
    localPuuid: puuid,
    champSelectSession
  });
  const localPosition = normalizeGameflowSelectedPosition(localParticipant?.selectedPosition);
  const summary = {
    ready: false,
    reason: '',
    phase,
    gameId: gameData?.gameId ?? gameflowSession?.gameId ?? null,
    hasLocalPuuid: Boolean(puuid),
    teamOneCount: teamOne.length,
    teamTwoCount: teamTwo.length,
    playerChampionSelectionsCount: playerChampionSelections.length,
    localParticipantFound: Boolean(localParticipant),
    localChampionId: localParticipant?.championId || 0,
    localPosition,
    teamOnePositions: summarizeTeamPositions(teamOne),
    teamTwoPositions: summarizeTeamPositions(teamTwo)
  };

  if (!teamOne.length || !teamTwo.length) return { ...summary, reason: 'missing_teams' };
  if (!puuid) return { ...summary, reason: 'missing_local_puuid' };
  if (!localParticipant) return { ...summary, reason: 'local_participant_not_found' };
  if (!localParticipant.championId) return { ...summary, reason: 'missing_local_champion' };
  if (!localPosition) return { ...summary, reason: 'missing_local_position' };

  const localTeam = localParticipant.team === 'teamOne' ? teamOne : teamTwo;
  const enemyTeam = localParticipant.team === 'teamOne' ? teamTwo : teamOne;

  if (localPosition === 'BOTTOM' || localPosition === 'UTILITY') {
    const localBottom = findTeamParticipantByPosition(localTeam, 'BOTTOM');
    const localSupport = findTeamParticipantByPosition(localTeam, 'UTILITY');
    const enemyBottom = findTeamParticipantByPosition(enemyTeam, 'BOTTOM');
    const enemySupport = findTeamParticipantByPosition(enemyTeam, 'UTILITY');
    if (!localBottom || !localSupport || !enemyBottom || !enemySupport) {
      return {
        ...summary,
        reason: 'missing_bot_lane_participants',
        hasLocalBottom: Boolean(localBottom),
        hasLocalSupport: Boolean(localSupport),
        hasEnemyBottom: Boolean(enemyBottom),
        hasEnemySupport: Boolean(enemySupport)
      };
    }

    return { ...summary, ready: true, reason: 'ready' };
  }

  const enemyParticipant = findTeamParticipantByPosition(enemyTeam, localPosition);
  if (!enemyParticipant) return { ...summary, reason: 'matching_enemy_not_found' };

  return {
    ...summary,
    ready: true,
    reason: 'ready',
    enemyChampionId: enemyParticipant.championId,
    enemyPosition: normalizeGameflowSelectedPosition(enemyParticipant.selectedPosition)
  };
}

function summarizeTeamPositions(team) {
  return team.map((participant) => ({
    championId: participant.championId,
    selectedPosition: normalizeGameflowSelectedPosition(participant.selectedPosition),
    hasPuuid: Boolean(getParticipantPuuid(participant)),
    inferredFromChampSelect: Boolean(participant.inferredFromChampSelect),
    inferred: Boolean(participant.inferredFromPlayerChampionSelections)
  }));
}

module.exports = {
  parseLockfile,
  createAuthHeader,
  createChampionsById,
  createLaneMatchupAnalysisRequest,
  describeLaneMatchupAnalysisReadiness,
  normalizeGameflowSelectedPosition
};
