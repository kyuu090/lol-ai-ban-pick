# Phase 00: Current State Check

目的は、TypeScript 移行前の状態を記録し、既存の未コミット変更やテスト状態を把握すること。

## 作業

1. 作業前に `git status --short` を確認する。
2. 未コミット変更がある場合、ユーザーまたは前エージェントの変更として扱い、勝手に戻さない。
3. `npm test` を実行し、現在の通過件数を記録する。
4. `package.json` の scripts、build.files、main entry を確認する。
5. `index.html` の script 読み込み順を確認する。
6. 主要ファイルの行数を確認する。

## 確認対象

大きい主要ファイル:

- `renderer.js`
- `main.js`
- `ui/draft-view.js`
- `draft-logic.js`
- `lcu-logic.js`
- `ui/stats-view.js`
- `ui/in-game-view.js`

最新の行数は作業時に再確認する。

## 完了条件

- 作業前の `git status --short` が記録されている。
- 作業前の `npm test` 結果が記録されている。
- TypeScript 移行前の主要ファイル状態が記録されている。
- 次 Phase に進めるリスクがない。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-00-current-state-save-data.md` に追記する。

