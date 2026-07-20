/**
 * User match Timeline を Stats DB の lane_matchup_timeline_5m と同じ定義で
 * 5 分スナップショットへ変換する。DB collector は別リポジトリのため、
 * renderer で使う最小限の同等実装をここに置く。
 */

type AnyRecord = Record<string, any>;
type LanePosition = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY';
type LaneType = 'TOP_LANE' | 'MID_LANE' | 'BOT_LANE';

interface UserLaneMatchupTimelinePoint {
  matchId: string;
  championId: number;
  opponentChampionId: number;
  position: LanePosition;
  minute: number;
  win: boolean;
  champion: AnyRecord;
  opponent: AnyRecord;
  difference: AnyRecord;
  laneFights: AnyRecord;
  laneObjectives: AnyRecord;
}

function lanePosition(value: unknown): LanePosition | null {
  return ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].includes(String(value))
    ? String(value) as LanePosition
    : null;
}

function laneType(position: LanePosition): LaneType | null {
  if (position === 'TOP') return 'TOP_LANE';
  if (position === 'MIDDLE') return 'MID_LANE';
  if (position === 'BOTTOM' || position === 'UTILITY') return 'BOT_LANE';
  return null;
}

function nonNegative(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) if (typeof value === 'number') return nonNegative(value);
  return 0;
}

function participantValues(frame: AnyRecord | undefined): AnyRecord {
  const laneCs = nonNegative(frame?.minionsKilled);
  const jungleCs = nonNegative(frame?.jungleMinionsKilled);
  const championStats = frame?.championStats || {};
  const damageStats = frame?.damageStats || {};
  return {
    avgGold: nonNegative(frame?.totalGold),
    avgXp: nonNegative(frame?.xp),
    avgCs: laneCs + jungleCs,
    avgLevel: nonNegative(frame?.level),
    avgDamageToChampions: firstNumber(damageStats.totalDamageDoneToChampions, damageStats.totalDamageToChampions, championStats.totalDamageDealtToChampions, championStats.damageDealtToChampions),
    avgDamageTaken: firstNumber(damageStats.totalDamageTaken, championStats.totalDamageTaken),
    avgTimeEnemyCcMs: firstNumber(frame?.timeEnemySpentControlled, frame?.timeEnemySpentControlledMillis, championStats.timeEnemySpentControlledMillis, championStats.timeEnemySpentControlled, typeof championStats.timeCCingOthers === 'number' ? championStats.timeCCingOthers * 1000 : undefined, typeof championStats.timeSpentCCingOthers === 'number' ? championStats.timeSpentCCingOthers * 1000 : undefined)
  };
}

function eventList(frames: AnyRecord[]): AnyRecord[] {
  return frames.flatMap((frame, frameIndex) => (Array.isArray(frame.events) ? frame.events : []).map((event: AnyRecord, eventIndex: number) => ({ ...event, timestamp: typeof event.timestamp === 'number' ? event.timestamp : frame.timestamp, order: frameIndex * 10000 + eventIndex })))
    .sort((left, right) => left.timestamp - right.timestamp || left.order - right.order);
}

function kdaAt(participantId: number, timestamp: number, kills: AnyRecord[]): AnyRecord {
  const result = { avgKills: 0, avgDeaths: 0, avgAssists: 0 };
  kills.forEach((event) => {
    if (event.timestamp > timestamp) return;
    if (event.killerId === participantId) result.avgKills += 1;
    if (event.victimId === participantId) result.avgDeaths += 1;
    if ((event.assistingParticipantIds || []).includes(participantId)) result.avgAssists += 1;
  });
  return result;
}

function laneFightAt(self: AnyRecord, contexts: Map<number, AnyRecord>, opponentId: number, timestamp: number, kills: AnyRecord[]): AnyRecord {
  const position = self.position as LanePosition;
  let isolated_kills_vs_lane = 0;
  let isolated_deaths_vs_lane = 0;
  let isolated_assists_vs_lane = 0;
  const relevant = kills.filter((event) => event.timestamp <= timestamp);
  if (position === 'BOTTOM' || position === 'UTILITY') {
    const allies = [...contexts.values()].filter((item) => item.teamId === self.teamId && (item.position === 'BOTTOM' || item.position === 'UTILITY')).map((item) => item.participantId);
    const enemies = [...contexts.values()].filter((item) => item.teamId !== self.teamId && (item.position === 'BOTTOM' || item.position === 'UTILITY')).map((item) => item.participantId);
    const permitted = new Set([...allies, ...enemies]);
    const partner = allies.find((id) => id !== self.participantId);
    relevant.forEach((event) => {
      const assists = event.assistingParticipantIds || [];
      if (assists.some((id: number) => !permitted.has(id))) return;
      if (event.killerId === self.participantId && enemies.includes(event.victimId)) isolated_kills_vs_lane += 1;
      if (event.victimId === self.participantId && enemies.includes(event.killerId)) isolated_deaths_vs_lane += 1;
      if (partner && event.killerId === partner && enemies.includes(event.victimId) && assists.includes(self.participantId)) isolated_assists_vs_lane += 1;
    });
  } else {
    relevant.forEach((event) => {
      if ((event.assistingParticipantIds || []).length) return;
      if (event.killerId === self.participantId && event.victimId === opponentId) isolated_kills_vs_lane += 1;
      if (event.killerId === opponentId && event.victimId === self.participantId) isolated_deaths_vs_lane += 1;
    });
  }
  const fight_occurred_rate = isolated_kills_vs_lane || isolated_deaths_vs_lane || isolated_assists_vs_lane ? 1 : 0;
  return { isolated_kills_vs_lane, isolated_deaths_vs_lane, isolated_assists_vs_lane, isolated_kills_vs_lane_occurred_rate: isolated_kills_vs_lane > 0 ? 1 : 0, isolated_deaths_vs_lane_occurred_rate: isolated_deaths_vs_lane > 0 ? 1 : 0, isolated_assists_vs_lane_occurred_rate: isolated_assists_vs_lane > 0 ? 1 : 0, fight_occurred_rate };
}

function objectivesAt(self: AnyRecord, timestamp: number, plates: AnyRecord[], towers: AnyRecord[]): AnyRecord {
  const targetLane = laneType(self.position);
  if (!targetLane) return { avgLaneOuterPlatesTaken: 0, avgLaneOuterPlatesLost: 0, laneOuterTowerTakenRate: 0, laneOuterTowerLostRate: 0 };
  const enemyTeamId = self.teamId === 100 ? 200 : 100;
  const destroyedBefore = (teamId: number, at: number) => towers.some((event) => event.timestamp < at && event.teamId === teamId && event.buildingType === 'TOWER_BUILDING' && event.towerType === 'OUTER_TURRET' && event.laneType === targetLane);
  let taken = 0;
  let lost = 0;
  plates.filter((event) => event.timestamp <= timestamp).forEach((event) => {
    if (event.laneType !== targetLane || (event.towerType && event.towerType !== 'OUTER_TURRET') || destroyedBefore(event.teamId, event.timestamp)) return;
    if (event.teamId === enemyTeamId) taken += 1;
    if (event.teamId === self.teamId) lost += 1;
  });
  const outerTowers = towers.filter((event) => event.timestamp <= timestamp && event.buildingType === 'TOWER_BUILDING' && event.towerType === 'OUTER_TURRET' && event.laneType === targetLane);
  return { avgLaneOuterPlatesTaken: taken, avgLaneOuterPlatesLost: lost, laneOuterTowerTakenRate: outerTowers.some((event) => event.teamId === enemyTeamId) ? 1 : 0, laneOuterTowerLostRate: outerTowers.some((event) => event.teamId === self.teamId) ? 1 : 0 };
}

/** DB collector と同じく 5, 10, ... 40 分だけを採用する。 */
function extractUserLaneMatchupTimeline(match: AnyRecord, timeline: AnyRecord, targetPuuid: string): UserLaneMatchupTimelinePoint[] {
  const info = match?.info;
  const frames = Array.isArray(timeline?.info?.frames) ? [...timeline.info.frames].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)) : [];
  const participants = Array.isArray(info?.participants) ? info.participants : [];
  if (!frames.length || !participants.length) return [];
  const selfParticipant = participants.find((participant: AnyRecord) => participant.puuid === targetPuuid);
  const position = lanePosition(selfParticipant?.teamPosition);
  if (!selfParticipant || !position) return [];
  const opponent = participants.filter((participant: AnyRecord) => participant.teamId !== selfParticipant.teamId && lanePosition(participant.teamPosition) === position);
  if (opponent.length !== 1) return [];
  const opponentParticipant = opponent[0];
  const contexts = new Map<number, AnyRecord>(participants.map((participant: AnyRecord): [number, AnyRecord] => [Number(participant.participantId), { participantId: Number(participant.participantId), teamId: Number(participant.teamId), position: lanePosition(participant.teamPosition) }]));
  const events = eventList(frames);
  const kills = events.filter((event) => event.type === 'CHAMPION_KILL');
  const plates = events.filter((event) => event.type === 'TURRET_PLATE_DESTROYED');
  const towers = events.filter((event) => event.type === 'BUILDING_KILL');
  const duration = Math.floor(Number(info.gameDuration || 0) / 60);
  const output: UserLaneMatchupTimelinePoint[] = [];
  for (let minute = 5; minute <= Math.min(40, duration); minute += 5) {
    const target = minute * 60 * 1000;
    const frame = frames.reduce((latest: AnyRecord, candidate: AnyRecord) => Number(candidate.timestamp) <= target ? candidate : latest, frames[0]);
    const selfValues = participantValues(frame.participantFrames?.[String(selfParticipant.participantId)]);
    const opponentValues = participantValues(frame.participantFrames?.[String(opponentParticipant.participantId)]);
    if (!frame.participantFrames?.[String(selfParticipant.participantId)] || !frame.participantFrames?.[String(opponentParticipant.participantId)]) continue;
    Object.assign(selfValues, kdaAt(selfParticipant.participantId, frame.timestamp, kills));
    Object.assign(opponentValues, kdaAt(opponentParticipant.participantId, frame.timestamp, kills));
    const difference = { avgGold: selfValues.avgGold - opponentValues.avgGold, avgXp: selfValues.avgXp - opponentValues.avgXp, avgCs: selfValues.avgCs - opponentValues.avgCs };
    Object.assign(difference, { goldLeadRate: difference.avgGold > 0 ? 1 : 0, xpLeadRate: difference.avgXp > 0 ? 1 : 0, csLeadRate: difference.avgCs > 0 ? 1 : 0 });
    const selfContext = contexts.get(selfParticipant.participantId);
    if (!selfContext) continue;
    output.push({ matchId: String(match.metadata?.matchId || ''), championId: Number(selfParticipant.championId), opponentChampionId: Number(opponentParticipant.championId), position, minute, win: Boolean(selfParticipant.win), champion: selfValues, opponent: opponentValues, difference, laneFights: laneFightAt(selfContext, contexts, opponentParticipant.participantId, frame.timestamp, kills), laneObjectives: objectivesAt(selfContext, frame.timestamp, plates, towers) });
  }
  return output;
}

export = { extractUserLaneMatchupTimeline };
