# Phase 05 Save Data

このファイルに Phase 05 の作業証跡を追記する。

## 2026-06-26

- `match-history-workflow.js` を `match-history-workflow.ts` に変更した。
  - JSDoc typedef を TypeScript の `type` / 引数型 / 戻り値型に移行。
  - CommonJS runtime 互換のため `export =` で emit 後も `require('../match-history-workflow')` から読み込める形を維持。
- `ui/formatters.js` を `ui/formatters.ts` に変更した。
  - formatter の入力型と KDA stats 型を TypeScript 化。
  - renderer の `<script>` 読み込みと Node test の `require` の両方で使える IIFE + `module.exports` 形を維持。
- Node test は `dist-app/test` に emit された JS を実行する方式に変更し、TS 化したファイルが runtime から読み込めることを確認した。
- 確認結果:
  - `npm run typecheck`: 成功。
  - `npm run compile`: 成功。
  - `npm test`: 成功。88 tests / 88 pass。

