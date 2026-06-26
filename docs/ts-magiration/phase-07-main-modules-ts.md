# Phase 07: Convert Main Modules to TypeScript

目的は、Electron main process の service / store / state を型で読めるようにすること。`main.js` の orchestration を薄くする準備をする。

## 推奨順

1. `main/settings-store.js`
2. `main/champion-pool-store.js`
3. `main/match-history-store.js`
4. `main/app-state.js`
5. `main/ai-analysis-service.js`
6. `main/riot-match-history-service.js`
7. `main/lcu-client.js`
8. `main/lcu-watch.js`
9. `main/window.js`
10. `main/ipc-handlers.js`

## 作業

- factory 引数の `deps` 型を定義する。
- 戻り値の service interface を定義する。
- file IO / network / Electron API の副作用境界を型で明示する。
- `unknown` を受け取る箇所は normalize 関数で domain 型に寄せる。

## 特に型を明示するもの

- `SettingsStore`
- `ChampionPoolStore`
- `MatchHistoryStore`
- `AppStatePatch`
- `LcuClient`
- `LcuWatch`
- `RiotMatchHistoryService`
- `AiAnalysisService`
- `IpcHandlers`

## 注意

- `main/lcu-client.js` は LCU password / Basic 認証ヘッダを扱うため、ログ出力に混ぜない。
- `main/lcu-watch.js` は timer / websocket reconnect を持つため、型移行時に lifecycle を変えない。
- `main/window.js` は Electron API 依存が強いため、テストでは syntax / typecheck 中心でよい。
- `main/ipc-handlers.js` は IPC channel 名を変えない。

## 完了条件

- 対象ファイルが `.ts` 化されている。
- `npm run typecheck` が通る。
- `npm test` が通る。
- Electron の起動確認が必要な変更では `npm start` または `npm run dev` を確認する。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-07-main-modules-ts-save-data.md` に追記する。

