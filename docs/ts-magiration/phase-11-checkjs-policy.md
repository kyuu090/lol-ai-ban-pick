# Phase 11: checkJs Policy

目的は、残った `.js` ファイルにも型チェックを広げるか判断すること。

## 選択肢

- 残り `.js` が少ないなら `.ts` 化を完了する。
- assets / scripts / tests など `.js` 維持が自然なものは JSDoc + `// @ts-check` にする。
- 全体に `checkJs: true` をかけるのは、主要 runtime ファイルの型移行後にする。

## 注意

- test files に過剰な型対応を入れすぎない。
- `node:test` の簡潔さを維持する。
- 開発補助 script は必要な範囲で型を付ける。

## 完了条件

- 型チェック対象と対象外の理由が明確になっている。
- `tsconfig.json` の include / exclude が整理されている。
- `npm run typecheck` が安定して通る。

## 決定

- `scripts/**/*.js` は `// @ts-check` と最小限の JSDoc を付け、TypeScript の確認対象にする。
- `preload.js` / `logger.js` は CommonJS の Electron runtime 境界として残し、`tsconfig.json` には明示的に含めるが、全体 `checkJs: true` はまだ有効化しない。
- `mock-lcu-api.js` は `index.html` から読むローカル表示確認用モックなので emit 対象には残すが、`// @ts-check` は付けず JS 型チェック対象外にする。
- `test/**/*.js` は `npm test` が `dist-app/test/*.test.js` を実行するため emit 対象には残すが、`node:test` の簡潔さを優先し、Phase 11 では `// @ts-check` を付けない。
- `main/**/*.js` / `ui/**/*.js` は TypeScript 化済みのため include から外す。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-11-checkjs-policy-save-data.md` に追記する。

