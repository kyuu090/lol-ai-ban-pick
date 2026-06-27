# Phase 11 Save Data

このファイルに Phase 11 の作業証跡を追記する。

## 2026-06-27

- `tsconfig.json` の include を整理し、残存 `.js` は `logger.js` / `mock-lcu-api.js` / `preload.js` / `scripts/**/*.js` / `test/**/*.js` を明示的に含める形にした。
- `main/**/*.js` / `ui/**/*.js` / ルートの包括的な `*.js` は include から外した。
- `scripts/run-dev.js` / `scripts/run-compiled-tests.js` / `scripts/copy-static-assets.js` に `// @ts-check` を追加し、必要な JSDoc を補った。
- `mock-lcu-api.js` はローカル表示確認用モック、`test/**/*.js` は `node:test` の簡潔さ維持のため Phase 11 では `// @ts-check` を付けず、JS 型チェック対象外とした。どちらも実行時に必要なため emit 対象には残した。
- `preload.js` / `logger.js` は Electron runtime 境界の CommonJS として残し、全体 `checkJs: true` は主要 runtime の残課題を別途解消してから判断する。

