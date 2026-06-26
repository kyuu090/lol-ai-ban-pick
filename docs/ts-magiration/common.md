# Common Rules for TypeScript Migration

この文書は、TypeScript 移行の全 Phase に共通するルールです。

## 目的

TypeScript 化の主目的は、生成AIが修正時に読む必要のある文脈を減らすこと。

型安全化そのものよりも、次を明示することを優先する。

- `AppState` の shape
- `window.lcuApi` の公開 API
- IPC channel の入力と返り値
- Draft / InGame / AI analysis context
- Match history / champion stats の shape
- main service と UI view の deps
- 副作用境界

## 前提

- Markdown / docs は UTF-8 without BOM。
- PowerShell 5.1 で Markdown を読むときは `Get-Content <file> -Encoding UTF8` を使う。
- 現在のアプリは Electron / Node.js / CommonJS / HTML / CSS / JavaScript。
- TypeScript は段階的に導入する。
- React / Vite / ESM 移行を TypeScript 化と同時に行わない。
- `nodeIntegration: false`、`contextIsolation: true`、`preload.js` + `contextBridge` を維持する。
- Riot API key / OpenAI API key / BFF secret は Electron クライアントに入れない。
- 自動ピック、自動BAN、自動ドッジ、ゲーム操作自動化、メモリ読み取り、クライアント改ざんは実装しない。

## 作業前に読むもの

最低限:

1. `AGENTS.md`
2. `docs/AGENTS_CONTEXT.md`
3. `docs/ts-magiration/common.md`
4. 対象 Phase の `docs/ts-magiration/phase-XX-*.md`
5. 対象 Phase の `docs/ts-magiration/save-data/phase-XX-*-save-data.md`

必要に応じて:

- `docs/development.md`
- `docs/refactoring-for-ai-agents.md`
- `docs/refactoring-for-ai-agents-save-data.md`

## 進め方

- 一度に全ファイルを `.ts` 化しない。
- 挙動変更と型移行を混ぜない。
- CommonJS から ESM への移行は TypeScript 化の必須条件にしない。
- 大きなファイルほど最後に扱う。
- `main.js` と `renderer.js` は、型が揃ってから薄くする。
- 変換対象は、純粋関数、小さい store、service、UI view、入口ファイルの順に進める。
- 作業単位ごとに `npm test` と `npm run typecheck` を通す。

## 型設計

良い型:

- 既存データ shape を忠実に表す。
- nullability が明示されている。
- 外部入力は normalize 前に `unknown` を許容する。
- 内部で使う正規化後データは union / interface で明確。
- IPC の戻り値が Promise か sync か分かる。

避ける型:

- 実装を読まずに推測で作った細かすぎる型。
- LCU raw response を過剰に厳密化した型。
- `any` だらけの型。
- 1 つの巨大な `AppState` だけに全部を押し込む設計。
- Renderer 専用型と Main 専用型を混ぜすぎる設計。

`any` は原則避ける。外部 API raw response や Electron API mock で必要なら局所化し、理由を作業証跡へ残す。迷う場合は `unknown` を使い、normalize 関数で絞る。

## 命名

- domain 型: `AppState`, `ChampionPool`, `MatchHistoryStatus`
- options: `XOptions`
- deps: `XDeps`
- service interface: `XService`
- normalized data: `NormalizedX`
- raw external data: `RawX`
- IPC map: `IpcInvokeChannels`, `IpcSendChannels`
- Renderer global: `LcuApi`

## 確認コマンド

原則:

```powershell
npm test
npm run typecheck
```

`.ts` emit や Electron entry に触った場合:

```powershell
npm run compile
npm start
```

`.js` ファイルの syntax 確認:

```powershell
node --check <file>
```

`.ts` ファイルには `node --check` を使わない。TypeScript ファイルは `npm run typecheck` または `npm run compile` で確認する。

## 作業証跡

各 Phase の証跡は `docs/ts-magiration/save-data/` 配下の対応ファイルへ追記する。

従来の `docs/refactoring-for-ai-agents-save-data.md` へ TypeScript 移行の詳細ログを増やさない。必要な場合だけ、そこから `docs/ts-magiration/README.md` を参照させる。

