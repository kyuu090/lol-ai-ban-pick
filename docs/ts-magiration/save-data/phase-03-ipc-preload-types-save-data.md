# Phase 03 Save Data

このファイルに Phase 03 の作業証跡を追記する。

## 2026-06-26

- `types/ipc.d.ts` を追加し、`main/ipc-handlers.js` に登録されている IPC channel の args/result 型を定義した。
- `types/preload.d.ts` を追加し、`window.lcuApi` の global 型と preload 公開 API の戻り値を定義した。
- 実装確認により以下は最小案から調整した。
  - `chooseLolInstallDir()` はキャンセル時も `PublicSettings` を返すため `Promise<PublicSettings>` とした。
  - `toggleMaximizeWindow()` は最大化後の状態を返すため `Promise<boolean>` とした。
  - `collectRiotMatchHistory()` は通常時 `MatchHistorySummary`、シーズン取得キャンセル時 `{ canceled: true, requestedMatches, updatedMatches }` を返す union とした。
- 検証:
  - `npm run typecheck` 成功。
  - `npm test` 成功（88 tests）。

