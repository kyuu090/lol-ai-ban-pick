# Phase 02 Save Data

このファイルに Phase 02 の作業証跡を追記する。

## 2026-06-26 domain types

- `types/domain.d.ts` を追加した。
- 主要な domain / state shape を export 型として定義した。
  - settings: `ThemeMode`, `RiotPlatformRegion`, `RiotRegionalRoute`, `PublicSettings`
  - champion data: `ChampionPoolLaneId`, `ChampionPool`, `ChampionSummaryItem`, `ChampionsById`
  - LCU state: `LcuStatus`, `WebSocketStatus`, `GameflowPhase`, `Summoner`, `Lobby`, `ChampSelectSession`, `ChampSelectAction`, `ChampSelectMember`
  - app state: `AppState`, `GameflowSession`, `LcuJsonApiEvent`, `LcuErrorPayload`
  - match history: `MatchHistoryStatus`, `MatchHistorySummary`, `ChampionStats`, `EnemyChampionStats`, `LaneOpponentStats`, `SelfVsLaneOpponentStats`
  - draft / in-game context: `DraftPanelState`, `PickPhaseDraftContext`, `FinalCompositionDraftContext`, `InGameContext`, `LaneMatchupAnalysisContext`
  - AI analysis: `AiAnalysisStatus`, `AiAnalysisNote`, `AiAnalysisResponse`, `LaneMatchupAnalysisState`
- LCU / BFF raw response に近い箇所は、既存コードが参照しているフィールドを中心に型化し、環境差分や未知 payload は `unknown` / index signature で許容した。
- `championId` は既存実装に合わせて number を基本にした。BOT/SUP の lane matchup BFF payload は `"id/id"` 文字列を送るため、`LaneMatchupAnalysisPayload.myChampionId` / `enemyChampionId` は `number | string` とした。
- 未選択 champion は既存コードに合わせて、メンバー上では `0` 相当の number として扱える optional number にし、state の欠落や LCU 404 は `null` / `LcuErrorPayload` で表現した。
- `.ts` 化したファイルはなし。
- runtime / build への影響はなし。型宣言ファイルの追加のみ。
- 確認したコマンド:
  - `npm run typecheck`: 成功。
  - `npm test`: 成功、88 tests pass。
- 未実施の確認:
  - Electron 起動での手動 UI 確認は未実施。型宣言のみのため今回は必須外と判断。
- 次の推奨作業:
  - Phase 03 で `types/ipc.d.ts` / `types/preload.d.ts` を追加し、`AppState` / `ChampionPool` を `window.lcuApi` と IPC channel の型から参照する。
- 注意点:
  - `GameflowPhase`, `queueType`, `queueGroup`, LCU の各 raw object は未知値 fallback を残している。後続 Phase で normalize 関数に JSDoc を付ける際も、外部入力を過剰に狭めない。

