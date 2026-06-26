# Refactoring Work Log

## 2026-06-26: Phase 1 renderer formatters split

- 実施内容:
  - `renderer.js` から日付・数値・勝率・平均KDAの表示整形関数を `ui/formatters.js` へ移動。
  - `index.html` で `ui/formatters.js` を `renderer.js` より前に読み込むよう追加。
  - Electron build の `files` に `ui/**/*` を追加。
  - `test/ui-formatters.test.js` を追加し、移動した整形関数の基本出力を確認。
- 変更した主なファイル:
  - `ui/formatters.js`
  - `renderer.js`
  - `index.html`
  - `package.json`
  - `test/ui-formatters.test.js`
- 確認:
  - 作業前 `npm test`: 63 tests pass。
  - 作業後 `npm test`: 64 tests pass。
- 注意:
  - `formatWinLoss` は `renderer.js` 内の `getLosses` に依存しているため、今回は移動していない。
  - 次の低リスク候補は `ui/dom-elements.js` への `elements` オブジェクト移動、または champion icon lazy loading 周辺の分離。

## 2026-06-26: Phase 1 renderer split completed

- 実施内容:
  - `renderer.js` 冒頭の `elements` オブジェクトを `ui/dom-elements.js` へ移動。
  - champion icon の cache / lazy loading / queue / missing retry 処理を `ui/champion-icons.js` へ移動。
  - `renderer.js` は `window.UiDomElements`、`window.UiFormatters`、`window.UiChampionIcons` から依存を受け取る形に変更。
  - `index.html` で `ui/dom-elements.js`、`ui/formatters.js`、`ui/champion-icons.js` を `renderer.js` より前に読み込むよう変更。
  - `test/ui-dom-elements.test.js`、`test/ui-champion-icons.test.js` を追加。
- 変更した主なファイル:
  - `ui/dom-elements.js`
  - `ui/formatters.js`
  - `ui/champion-icons.js`
  - `renderer.js`
  - `index.html`
  - `package.json`
  - `test/ui-dom-elements.test.js`
  - `test/ui-formatters.test.js`
  - `test/ui-champion-icons.test.js`
- 確認:
  - `npm test`: 66 tests pass。
  - `node --check renderer.js`: pass。
  - `node --check ui/dom-elements.js`: pass。
  - `node --check ui/formatters.js`: pass。
  - `node --check ui/champion-icons.js`: pass。
  - 作業後の `renderer.js`: 2884 行。
- 注意:
  - Phase 1 候補の `ui/dom-elements.js`、`ui/formatters.js`、`ui/champion-icons.js` は完了。
  - `package.json` の build files には `ui/**/*` を追加済み。
  - Electron の実起動確認は未実施。必要なら次に `npm start` で画面ロードと champion icon 表示を確認する。

## 2026-06-26: Phase 2 renderer view split started

- 実施内容:
  - `ui/settings-view.js` を追加し、テーマ正規化・テーマ適用・設定表示・Riot platform region select 描画を移動。
  - `ui/champion-pool-view.js` を追加し、Champion Pool の lane tab / picker / selected list 描画を factory 化して移動。
  - `ui/match-data-view.js` を追加し、ヘッダーの match data summary、match history status、progress、download menu state を移動。
  - `renderer.js` は各 view module を `window.UiSettingsView`、`window.UiChampionPoolView`、`window.UiMatchDataView` から受け取る形に変更。
  - `index.html` で新規 view module を `renderer.js` より前に読み込むよう変更。
  - `test/ui-settings-view.test.js`、`test/ui-champion-pool-view.test.js`、`test/ui-match-data-view.test.js` を追加。
- 変更した主なファイル:
  - `ui/settings-view.js`
  - `ui/champion-pool-view.js`
  - `ui/match-data-view.js`
  - `renderer.js`
  - `index.html`
  - `test/ui-settings-view.test.js`
  - `test/ui-champion-pool-view.test.js`
  - `test/ui-match-data-view.test.js`
- 確認:
  - `npm test`: 72 tests pass。
  - `node --check renderer.js`: pass。
  - `node --check ui/settings-view.js`: pass。
  - `node --check ui/champion-pool-view.js`: pass。
  - `node --check ui/match-data-view.js`: pass。
  - 作業後の `renderer.js`: 2562 行。
- 注意:
  - Champion Pool の保存・追加・削除など状態更新処理は、まだ `renderer.js` 側に残している。view 側は描画と lane helper を担当する。
  - Stats / Draft / In-game は未分割。次に進めるなら `ui/stats-view.js` が候補だが、依存が広いため `played stats` と `opponent stats` をさらに分けるか検討するとよい。
  - Electron の実起動確認は未実施。
