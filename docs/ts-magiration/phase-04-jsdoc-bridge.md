# Phase 04: JSDoc Bridge for Existing JavaScript

目的は、`.ts` 変換前に、生成AIが関数単位で型を読める状態を作ること。大きなファイルへいきなり `checkJs` をかけず、小さいファイルから型情報を増やす。

## 作業

1. 小さい純粋関数ファイルから `// @ts-check` を追加する。
2. `@param` / `@returns` で責務に合う `types/domain/*.d.ts` の型を参照する。
   - settings: `types/domain/settings.d.ts`
   - champion data / ChampionPool: `types/domain/champion.d.ts`
   - LCU state / champ-select / gameflow: `types/domain/lcu.d.ts`
   - match history / stats: `types/domain/match-history.d.ts`
   - draft / in-game context: `types/domain/draft.d.ts`
   - AI analysis / lane matchup: `types/domain/ai-analysis.d.ts`
   - full app state: `types/domain/app-state.d.ts`
3. 型エラーを直す場合は挙動変更を避ける。
4. 必要なら helper 型を `types/` に追加する。

## 優先順

1. `match-history-workflow.js`
2. `ui/formatters.js`
3. `main/champion-pool-store.js`
4. `main/match-history-store.js`
5. `main/app-state.js`
6. `main/settings-store.js`
7. `draft-logic.js`
8. `lcu-logic.js`
9. `riot-api.js`
10. `riot-match-history.js`

## 注意

- `renderer.js` と `main.js` に `// @ts-check` を付けるのは後回し。
- DOM 依存が強い UI view も後回し。
- JSDoc が複雑になりすぎる場合は `.ts` 変換へ進む。

## 完了条件

- 小さいファイルに型付き JSDoc が入っている。
- `npm run typecheck` が通る。
- `npm test` が通る。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-04-jsdoc-bridge-save-data.md` に追記する。

