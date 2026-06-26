# Phase 06: TypeScript Emit and Build

目的は、`.ts` ファイルを本格的に増やしても Electron が動く状態を作ること。

## 推奨方針

- `tsc` で CommonJS に emit する。
- `src/` への大移動は最初はしない。
- 出力先は `dist-app/` など、既存 `dist/` と衝突しない名前にする。
- `electron-builder` の `build.files` に出力先と必要 assets を含める。
- 開発起動 script は出力後に Electron を起動する。

## script 例

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "compile": "tsc",
    "start": "npm run compile && electron dist-app/main.js",
    "dev": "npm run compile && node scripts/run-dev.js"
  }
}
```

`scripts/run-dev.js` が `electron .` 前提の場合は、出力先 entry を受け取れるようにするか、`package.json` の `main` を切り替える。

## 注意

- `index.html`、`styles/`、`assets/`、`img/` のパス解決を壊さない。
- Renderer script の読み込みパスを出力先に合わせる必要がある。
- `preload.js` / `preload.ts` の path は BrowserWindow の `webPreferences.preload` と一致させる。
- Electron Builder の `files` に emitted JS が含まれることを確認する。
- `debug.log` などのログファイルを出力先に混ぜない。

## 完了条件

- `npm run compile` が通る。
- `npm test` が通る。
- `npm run typecheck` が通る。
- `npm start` または `npm run dev` で Electron が起動する。
- packaged build の対象ファイルが確認されている。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-06-ts-build-save-data.md` に追記する。

