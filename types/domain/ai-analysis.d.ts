export type LaneMatchupLane = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP' | 'BOTTOM/SUPPORT';

export interface LaneMatchupAnalysisPayload {
  myChampionName: string;
  myChampionId: number | string;
  lane?: LaneMatchupLane;
  enemyChampionName: string;
  enemyChampionId: number | string;
}

export interface LaneMatchupAnalysisContext {
  gameId: number | string | null;
  localPosition: string;
  opponentPosition: string;
  laneMatchupLane: LaneMatchupLane;
  localChampionIds: number[];
  enemyChampionIds: number[];
  payload: LaneMatchupAnalysisPayload;
  requestKey: string;
}

export type AiAnalysisStatus = 'idle' | 'requesting' | 'ready' | 'error';

export interface AiAnalysisNote {
  title: string;
  body: string;
}

export type AiAnalysisRichTextToken =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'champion';
      championName: string;
      championId?: number;
    };

export type AiAnalysisRichText = string | AiAnalysisRichTextToken[];

export interface AiAnalysisResponse {
  notes?: AiAnalysisNote[];
  difficulty?: string;
  laneStyle?: string;
  laneSummary?: {
    goal?: AiAnalysisRichText;
    detail?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LaneMatchupAnalysisState {
  status: AiAnalysisStatus;
  requestKey: string | null;
  request: LaneMatchupAnalysisContext | null;
  response: AiAnalysisResponse | null;
  error: string | null;
  updatedAt: string | null;
}
