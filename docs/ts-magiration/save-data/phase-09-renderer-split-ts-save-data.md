# Phase 09 Save Data

このファイルに Phase 09 の作業証跡を追記する。

## 2026-06-26

- `renderer.js` を `renderer/init.ts` へ移動し、入口を DOM glue と controller 初期化中心に整理した。
- module-level state を `renderer/state.ts` の `RendererState.state` に集約し、入口側の mutable state 参照を `rendererState.*` へ寄せた。
- 以下の renderer controller を追加し、`index.html` の script 読み込み順を更新した。
  - `renderer/navigation.ts`: view tab / stats subtab 切り替え。
  - `renderer/state-sync.ts`: `window.lcuApi.onState` 受信後の state 同期と再描画 orchestration。
  - `renderer/ai-analysis-controller.ts`: pick phase / final composition analysis request、in-flight key、status、error、notes 管理。
  - `renderer/champion-pool-controller.ts`: ChampionPool 保存、dirty state、lane selection 経由の add/remove/toggle。
  - `renderer/match-history-controller.ts`: Match history collect button と menu state。
  - `renderer/draft-controller.ts`: Draft panel 表示、ChampSelect/InGame 切り替え、lane opponent marker。
- `tsconfig.json` に `renderer/**/*.ts` を追加し、`types/ui-globals.d.ts` に renderer controller の global API を追加した。
- 検証:
  - `npm run typecheck`: OK
  - `npm run compile`: OK
  - `npm test`: OK（88 tests）
  - `npm start` と `electron --disable-gpu dist-app/main.js` は `App ready` 後、この実行環境の GPU/cache 初期化エラー（`GPU process isn't usable` / cache access denied）で renderer frame が破棄され、画面操作確認までは未到達。

