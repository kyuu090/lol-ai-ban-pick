# Phase 03: IPC and Preload Types

目的は、Renderer から見える API を型だけで理解できるようにすること。IPC channel の入出力を固定し、main / renderer 間の誤修正を減らす。

## 作業

1. `types/ipc.d.ts` を追加する。
2. `types/preload.d.ts` を追加する。
3. `window.lcuApi` の global 型を定義する。
4. `preload.js` の公開 API と型を一致させる。
5. `main/ipc-handlers.js` の channel 一覧と型を対応させる。

## 最低限定義する LcuApi

使用する domain 型は責務別ファイルから参照する。

```ts
import type { AppState } from './domain/app-state';
import type { AiAnalysisResponse } from './domain/ai-analysis';
import type { ChampionPool } from './domain/champion';
import type { FinalCompositionDraftContext, PickPhaseDraftContext } from './domain/draft';
import type { PublicSettings, ThemeMode } from './domain/settings';
```

```ts
interface LcuApi {
  getState(): Promise<AppState>;
  refresh(): Promise<AppState>;
  getChampionIcon(championId: number): Promise<string | null>;
  getChampionPool(): Promise<ChampionPool>;
  saveChampionPool(championPool: ChampionPool): Promise<ChampionPool>;
  log(level: string, message: string, details?: unknown): void;
  getSettings(): Promise<PublicSettings>;
  chooseLolInstallDir(): Promise<string | null>;
  updateLolInstallDir(lolInstallDir: string): Promise<PublicSettings>;
  updateRiotPlatformRegion(riotPlatformRegion: string): Promise<PublicSettings>;
  updateThemeMode(themeMode: ThemeMode): Promise<PublicSettings>;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  onWindowMaximized(callback: (isMaximized: boolean) => void): () => void;
  collectRiotMatchHistory(options: CollectRiotMatchHistoryOptions): Promise<unknown>;
  requestPickPhaseAnalysis(draftContext: PickPhaseDraftContext): Promise<AiAnalysisResponse>;
  requestFinalCompositionAnalysis(draftContext: FinalCompositionDraftContext): Promise<AiAnalysisResponse>;
  onState(callback: (state: AppState) => void): () => void;
}
```

## 注意

- 実際の戻り値が `void` ではない場合は既存実装に合わせる。
- `collectRiotMatchHistory` の戻り値は実装を確認してから型を絞る。
- `chooseLolInstallDir` はキャンセル時の shape を確認する。
- 型と実装が食い違った場合、挙動変更ではなく型を既存実装へ合わせる。

## 完了条件

- Renderer で `window.lcuApi` の型が解決できる。
- `preload.js` を読まなくても公開 API が分かる。
- `npm run typecheck` が通る。
- `npm test` が通る。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-03-ipc-preload-types-save-data.md` に追記する。

