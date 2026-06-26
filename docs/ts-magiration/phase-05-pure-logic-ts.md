# Phase 05: Convert Pure Logic to TypeScript

目的は、低リスクで型の恩恵が大きいロジックから TypeScript 化すること。テスト済みの関数を先に固める。

## 推奨順

1. `match-history-workflow.js` -> `match-history-workflow.ts`
2. `ui/formatters.js` -> `ui/formatters.ts`
3. `draft-logic.js` -> `draft-logic.ts`
4. `lcu-logic.js` -> `lcu-logic.ts`
5. `riot-api.js` -> `riot-api.ts`
6. `riot-match-history.js` -> `riot-match-history.ts`

## 作業

1. 対象ファイルを 1 つだけ `.ts` 化する。
2. require している側の import path / require path を確認する。
3. Node test から読み込めるか確認する。
4. Electron runtime が読み込める形式で出力されるか確認する。

## 重要

- `.ts` ファイルを Node / Electron が直接 require できない場合、ビルド手順が必要になる。
- 初期段階で `noEmit` のまま `.ts` 化すると runtime から読み込めない。
- `.ts` 化を始める前に、Phase 06 の build 方針を確定する。

選択肢:

- `tsc` で出力先へ CommonJS を emit し、Electron の entry を出力先へ切り替える。
- しばらく `.js` のまま JSDoc + `.d.ts` で運用し、実ファイルの `.ts` 化は後回しにする。

## 完了条件

- 対象ファイルが TypeScript として型チェックされる。
- runtime から読み込める。
- `npm test` が通る。
- `npm run typecheck` が通る。
- 必要なら `npm start` または `npm run dev` で起動確認する。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-05-pure-logic-ts-save-data.md` に追記する。

