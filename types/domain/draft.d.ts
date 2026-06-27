import type { GameflowPhase, ChampSelectSession } from './lcu';
import type { SelfVsLaneOpponentStats } from './match-history';

export interface DraftPanelState {
  phase: GameflowPhase | null;
  champSelect: ChampSelectSession | null;
  loggedIn: boolean;
  inGame: boolean;
  inChampSelect: boolean;
  supportedDraftGameMode: boolean;
  unsupportedGameMode: boolean;
}

export interface DraftChampionEntry {
  championId: number;
  championName: string;
}

export interface PickPhaseDraftContext {
  phase: 'own_pick';
  localPlayer: {
    intendedPick: DraftChampionEntry;
  };
  allyTeam: {
    intendedPicks: DraftChampionEntry[];
    lockedPicks: DraftChampionEntry[];
  };
  enemyTeam: {
    lockedPicks: DraftChampionEntry[];
  };
  ownChampionPool: DraftChampionEntry[];
}

export interface FinalCompositionDraftContext {
  phase: 'final_composition';
  localPlayer: {
    lockedPick: DraftChampionEntry;
  };
  allyTeam: {
    lockedPicks: DraftChampionEntry[];
  };
  enemyTeam: {
    lockedPicks: DraftChampionEntry[];
  };
}

export interface InGameContext {
  championId: number;
  position: string;
  summonerName: string;
  opponentChampionId: number;
  directMatchupStats: SelfVsLaneOpponentStats | null;
  allyChampionIds: number[];
  enemyChampionIds: number[];
}
