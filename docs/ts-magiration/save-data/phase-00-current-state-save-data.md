# Phase 00 Save Data

このファイルに Phase 00 の作業証跡を追記する。

## 2026-06-26 current state check

- 作業前の `git status --short`: 出力なし。未コミット変更なし。
- 作業前の `npm test`: 成功。`tests 88`, `pass 88`, `fail 0`。
- `package.json`:
  - `main`: `main.js`
  - scripts: `build`, `build:locked`, `pack`, `pack:locked`, `dev`, `start`, `test`
  - `build.files`: `assets/**/*`, `draft-logic.js`, `index.html`, `lcu-logic.js`, `logger.js`, `main/**/*`, `main.js`, `match-history-workflow.js`, `mock-lcu-api.js`, `preload.js`, `renderer.js`, `riot-api.js`, `riot-match-history.js`, `styles/**/*`, `ui/**/*`, `package.json`
- `index.html` script 読み込み順:
  1. `./draft-logic.js`
  2. `./mock-lcu-api.js`
  3. `./ui/dom-elements.js`
  4. `./ui/formatters.js`
  5. `./ui/champion-icons.js`
  6. `./ui/settings-view.js`
  7. `./ui/champion-pool-view.js`
  8. `./ui/match-data-view.js`
  9. `./ui/stats-view.js`
  10. `./ui/in-game-view.js`
  11. `./ui/draft-view.js`
  12. `./renderer.js`
- 主要ファイル行数:
  - `renderer.js`: 1237
  - `main.js`: 1161
  - `ui/draft-view.js`: 654
  - `draft-logic.js`: 541
  - `lcu-logic.js`: 467
  - `ui/stats-view.js`: 401
  - `ui/in-game-view.js`: 420
- 判定: 作業前テストは通過しており、次 Phase に進める既知リスクなし。

