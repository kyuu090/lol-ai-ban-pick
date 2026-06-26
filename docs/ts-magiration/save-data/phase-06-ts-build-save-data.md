# Phase 06 Save Data

このファイルに Phase 06 の作業証跡を追記する。

## 2026-06-26

- Phase 05 の TS 化を runtime から読み込めるようにするため、CommonJS emit 方針を実装した。
- `tsconfig.build.json` を追加し、`tsc -p tsconfig.build.json` で `dist-app/` に JS を出力するようにした。
- `scripts/copy-static-assets.js` を追加し、`index.html`、`styles/`、`assets/`、`img/` を `dist-app/` にコピーするようにした。
- `package.json` を更新した。
  - `main`: `dist-app/main.js`
  - `compile`: `dist-app` を作り直して `tsc` emit と静的ファイルコピーを実行。
  - `build` / `pack`: electron-builder 実行前に `compile` を実行。
  - `test`: compile 後に `scripts/run-compiled-tests.js` で `dist-app/test/*.test.js` を実行。
  - `start` / `dev`: compile 後に `dist-app/main.js` を Electron entry として起動。
  - `build.files`: packaged app には `dist-app/**/*` と `package.json` を含める。
- `scripts/run-dev.js` を entry path 引数に対応させた。
- `dist-app/` は生成物として `.gitignore` に追加した。
- 確認結果:
  - `npm run typecheck`: 成功。
  - `npm run compile`: 成功。
  - `npm test`: 成功。88 tests / 88 pass。
  - `npm run pack`: 成功。初回は sandbox のネットワーク制限で Electron artifact 取得が `connect EACCES 20.27.177.113:443` になったため、権限付きで再実行して `dist/win-unpacked` を生成した。
  - `dist/win-unpacked/resources/app.asar` に `\dist-app\main.js`、`\dist-app\index.html`、`\dist-app\preload.js`、`\dist-app\ui\formatters.js`、`\package.json` が含まれることを確認した。
  - `npm run dev`: 約 29 秒の起動スモークで即時終了や stack trace が出ないことを確認した。確認後に残った Electron process は停止した。
- Phase 06 完了時点の注意:
  - `npm run dev` は GUI アプリとして起動継続するため、自動確認では timeout を起動維持の確認として扱った。
  - `debug.log` は `dist-app/` へコピーされない。

