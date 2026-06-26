# Phase 10 Save Data

このファイルに Phase 10 の作業証跡を追記する。

## 2026-06-27

### 実装

- `main.js` を削除し、入口を `main.ts` の `bootstrap()` 呼び出しだけに変更した。
- Electron lifecycle と service construction を `main/bootstrap.ts` に集約した。
- state publish / window broadcast を `main/state-publisher.ts` に分離した。
- LCU refresh / reconnect / gameflow update orchestration を `main/lcu-controller.ts` に分離した。
- Riot match history collect orchestration を `main/match-history-controller.ts` に分離した。
- lane matchup analysis readiness / request / retry / result apply を `main/lane-matchup-controller.ts` に分離した。
- smoke 起動時の GPU 無効化用に、`--disable-gpu` または `BANPICK_AI_DISABLE_GPU=1` が指定された場合のみ `app.disableHardwareAcceleration()` と関連 Chromium switch を適用するようにした。
- 破棄済み renderer への state publish で落ちないよう、`webContents.isDestroyed()` と送信例外ガードを追加した。

### 確認

- `npm run typecheck`: pass
- `npm test`: pass, 88 tests
- Electron 起動 smoke:
  - 通常起動はこの実行環境の Chromium GPU process 初期化で `GPU process isn't usable` により終了。
  - `BANPICK_AI_DISABLE_GPU=1` と `--no-sandbox --disable-gpu --disable-software-rasterizer --disable-gpu-compositing` 付きで起動し、8 秒生存を確認後に停止。

### 注意

- LCU lockfile retry と WebSocket reconnect timer は `main/lcu-watch.ts` に残し、`main/lcu-controller.ts` から既存の `createLcuWatch` を利用する構成にした。
- ChampSelect / GameStart / InProgress 中に Riot match history の auto collect を抑止する制約は `main/match-history-controller.ts` に移した。
- Riot API 429 時の partial save / UI reflection は `publishCurrentSnapshot` と retry handler を controller 内へ移して維持した。

