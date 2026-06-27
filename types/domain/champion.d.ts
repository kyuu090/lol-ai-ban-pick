export type ChampionPoolLaneId = 'top' | 'jungle' | 'middle' | 'bottom' | 'utility';

export type ChampionPool = Record<ChampionPoolLaneId, number[]>;

export interface ChampionSummaryItem {
  id: number;
  name: string;
  alias?: string;
  title?: string;
  squarePortraitPath?: string;
}

export type ChampionsById = Record<number, ChampionSummaryItem>;
