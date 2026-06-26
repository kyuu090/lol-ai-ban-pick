# Phase 12: Docs and Closeout

目的は、TypeScript 移行の結果を後続エージェントが短時間で把握できるようにすること。

## 更新対象

- `docs/ts-magiration/README.md`
- `docs/ts-magiration/save-data/*.md`
- `docs/AGENTS_CONTEXT.md`
- `docs/development.md`
- 必要なら `README.md`
- 必要なら `docs/refactoring-for-ai-agents.md`

TypeScript 移行の詳細ログは `docs/ts-magiration/save-data/` 配下へ残す。従来の `docs/refactoring-for-ai-agents-save-data.md` には、必要な場合だけ TypeScript 移行ログの参照先を書く。

## 完了判定

TypeScript 移行全体の完了条件:

- `npm run typecheck` が安定して通る。
- `npm test` が安定して通る。
- Electron runtime が TypeScript emit 後のファイルで起動できる。
- `main` / `renderer` / `preload` / `main/` / `ui/` の主要 runtime ファイルが `.ts` または `// @ts-check` + JSDoc で型管理されている。
- `AppState`、IPC、`window.lcuApi`、Draft context、Match history、AI analysis response の型が明文化されている。
- `main.js` または `main.ts` は service 組み立てと lifecycle 中心になっている。
- `renderer.js` または `renderer.ts` は初期化と controller 接続中心になっている。
- 後続AIが、機能修正時に型定義と該当 module だけを読めば作業開始できる。
- TypeScript 移行の履歴が `docs/ts-magiration/save-data/` に残っている。

## 後続AIへの注意

- この計画は「一気にやる指示」ではない。安全な小さい単位に分けて進める。
- 既存挙動の維持を優先する。
- 型エラーを消すために runtime の意味を変えない。
- 不明な外部 response は `unknown` と normalize で扱う。
- LCU / Riot / BFF / AI analysis は副作用境界を壊さない。
- package / build / Electron entry を触ったら、必ず起動確認まで行う。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-12-docs-and-closeout-save-data.md` に追記する。

