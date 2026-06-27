# Phase 07 Save Data

このファイルに Phase 07 の作業証跡を追記する。

## 2026-06-26

- Electron main process 配下の対象 10 ファイルを `.js` から `.ts` に変換した。
  - `main/settings-store.ts`
  - `main/champion-pool-store.ts`
  - `main/match-history-store.ts`
  - `main/app-state.ts`
  - `main/ai-analysis-service.ts`
  - `main/riot-match-history-service.ts`
  - `main/lcu-client.ts`
  - `main/lcu-watch.ts`
  - `main/window.ts`
  - `main/ipc-handlers.ts`
- `tsconfig.json` の include に `main/**/*.ts` を追加した。
- store / service / watch / IPC の factory deps と戻り値 interface を追加し、file IO / network / Electron / WebSocket / IPC の副作用境界を型で明示した。
- BFF レスポンス、LCU WebSocket event、theme mode など unknown 入力を normalize / type guard で domain 型へ寄せた。
- LCU password / Basic 認証ヘッダはログへ出さない既存挙動を維持した。
- LCU watch の timer / websocket reconnect lifecycle と IPC channel 名は変更していない。

検証:

- `npm run typecheck`
- `npm test`

