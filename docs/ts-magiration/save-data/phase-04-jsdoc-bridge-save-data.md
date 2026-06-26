# Phase 04 Save Data

このファイルに Phase 04 の作業証跡を追記する。

## 2026-06-26

- 小さい既存 JS ファイルに `// @ts-check` と型付き JSDoc を追加した。
  - `match-history-workflow.js`
  - `ui/formatters.js`
  - `main/champion-pool-store.js`
  - `main/match-history-store.js`
  - `main/app-state.js`
  - `main/settings-store.js`
- domain 型を JSDoc import で参照し、Match history / ChampionPool / AppState / Settings の関数入出力を型だけで追えるようにした。
- 挙動変更を避けるため、未変換 JS 境界では局所的な型補助に留めた。
  - `draft-logic.js` の `createDefaultChampionPool()` / `normalizeChampionPool()` 戻り値は `ChampionPool` として局所キャスト。
  - `riot-api.js` の region 関連戻り値と定数は `settings-store.js` 側で domain 型へ局所キャスト。
  - JSON 読み込みやキャッシュ detail は外部入力として扱い、アクセス直前に必要な shape だけ補助。
- 検証:
  - `npm run typecheck` 成功。
  - `npm test` 成功（88 tests）。

