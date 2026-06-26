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

## 2026-06-26: Phase 2 stats table split

- 実施内容:
  - `ui/stats-view.js` を追加し、Stats 画面の played stats / opponent stats table、lane tabs、sort button state、展開 detail row を移動。
  - `renderer.js` は `window.UiStatsView.createStatsView()` を通じて `renderPlayedChampionStats`、`renderLaneOpponentStats`、`setStatsSort` を受け取る形に変更。
  - Stats の既存 state (`activePlayedStatsLane`、sort key、expanded row など) は `renderer.js` 側に残し、view module へ getter / setter として渡している。
  - 未使用だった `renderPlayedChampionStatsLegacy` / `renderLaneOpponentStatsLegacy` / `renderStatsTable` も削除。
  - `test/ui-stats-view.test.js` を追加し、stats table sort helper の基本挙動を確認。
- 変更した主なファイル:
  - `ui/stats-view.js`
  - `renderer.js`
  - `index.html`
  - `test/ui-stats-view.test.js`
- 確認:
  - `npm test`: 73 tests pass。
  - `node --check renderer.js`: pass。
  - `node --check ui/stats-view.js`: pass。
  - 作業後の `renderer.js`: 2193 行。
- 注意:
  - Weak / strong champion list と draft insight 用の stats chip 生成は、まだ `renderer.js` 側に残っている。
  - 次に進めるなら `ui/in-game-view.js` か `ui/draft-view.js` だが、AI analysis 表示と draft state が絡むため、まず `in-game self card` のような小さい部分から切るのが安全。

## 2026-06-26: Phase 2 in-game view split

- 実施内容:
  - `ui/in-game-view.js` を追加し、In-game 自己カード、最終構成分析表示、レーン対面分析表示、lane matchup rich text 表示を移動。
  - `renderer.js` は `window.UiInGameView.createInGameView()` から `renderInGame` と `renderInGameFinalCompositionAnalysis` を受け取る形に変更。
  - AI 分析リクエストと draft AI パネル表示は、まだ `renderer.js` 側に残している。
  - `test/ui-in-game-view.test.js` を追加し、lane matchup detail 正規化の基本挙動を確認。
- 変更した主なファイル:
  - `ui/in-game-view.js`
  - `renderer.js`
  - `index.html`
  - `test/ui-in-game-view.test.js`
- 確認:
  - `npm test`: 74 tests pass。
  - `node --check renderer.js`: pass。
  - `node --check ui/in-game-view.js`: pass。
  - 作業後の `renderer.js`: 1813 行。
- 注意:
  - `parseDraftAiAnalysisNotes` と `createDraftAiAnalysisStatus` は Draft 側でも使うため、現時点では `renderer.js` に残している。
  - 次は `ui/draft-view.js` を切る。`renderChampSelect` / ban list / team / draft focus / insights 表示が対象。

## 2026-06-26: Phase 2 draft view split completed

- 実施内容:
  - `ui/draft-view.js` を追加し、Champ Select 盤面、ban list、team rows、draft focus、draft self summary、draft AI analysis panel、ban / pick insight panel を移動。
  - `renderer.js` は `window.UiDraftView.createDraftView()` から `renderChampSelect` と `renderDraftAiAnalysis` を受け取る形に変更。
  - AI 分析リクエスト、AI response parsing、champion pool 保存などの副作用は `renderer.js` 側に残している。
  - `test/ui-draft-view.test.js` を追加し、draft AI analysis panel の基本表示を確認。
- 変更した主なファイル:
  - `ui/draft-view.js`
  - `renderer.js`
  - `index.html`
  - `test/ui-draft-view.test.js`
- 確認:
  - `npm test`: 76 tests pass。
  - `node --check renderer.js`: pass。
  - `node --check ui/draft-view.js`: pass。
  - 作業後の `renderer.js`: 1237 行。
- Phase 2 完了メモ:
  - `ui/champion-pool-view.js`: Champion Pool 表示。
  - `ui/stats-view.js`: Stats table / tabs / detail row。
  - `ui/draft-view.js`: Champ Select / draft insight 表示。
  - `ui/in-game-view.js`: In-game self card / AI analysis 表示。
  - `ui/settings-view.js`: Settings 表示。
  - 追加で `ui/match-data-view.js` もヘッダーの match data 表示として分離済み。
- 注意:
  - `renderer.js` はまだ 1000 行超。Phase 3 前にさらに薄くするなら、次はイベントバインドと副作用ハンドラを `ui/app-events.js` 的に分ける候補がある。ただし refactoring plan 上の Phase 2 対象画面分割は完了。
  - Electron の実起動確認は未実施。

## 2026-06-26: Phase 3 CSS split completed

- 実施内容:
  - 単一の `style.css` を `styles/` 配下の責務別 CSS に分割。
  - `index.html` は元の cascade order を保ったまま、複数の `styles/*.css` を読み込む形に変更。
  - Electron build の `files` を `style.css` から `styles/**/*` へ変更。
  - 旧 `style.css` を削除。
- 追加した CSS:
  - `styles/base.css`
  - `styles/titlebar.css`
  - `styles/forms.css`
  - `styles/app-shell.css`
  - `styles/match-data.css`
  - `styles/navigation.css`
  - `styles/layout.css`
  - `styles/stats.css`
  - `styles/champion-pool.css`
  - `styles/settings.css`
  - `styles/draft-state.css`
  - `styles/in-game.css`
  - `styles/draft.css`
  - `styles/debug.css`
  - `styles/theme.css`
  - `styles/responsive.css`
- 変更した主なファイル:
  - `styles/*.css`
  - `index.html`
  - `package.json`
  - `docs/AGENTS_CONTEXT.md`
  - `docs/development.md`
  - `docs/refactoring-for-ai-agents-save-data.md`
- 確認:
  - 分割後の CSS を `index.html` の読み込み順に結合すると、分割前の `style.css` と同一内容になることを確認。
  - `npm test`: 76 tests pass。
  - `index.html` の CSS link がすべて存在することを静的確認。
- 注意:
  - CSS は挙動変更を避けるため、既存順序を維持した機械的分割に留めている。
  - Electron の実起動確認は未実施。

## 2026-06-26: Phase 4 main save/state split completed

- 実施内容:
  - `main/settings-store.js` を追加し、settings の default / normalize / load / save / public settings 作成を移動。
  - `main/champion-pool-store.js` を追加し、ChampionPool の load / save を移動。
  - `main/match-history-store.js` を追加し、PUUID 別 match history / cache path と JSON read / write を移動。
  - `main/app-state.js` を追加し、initial state、match history status / summary、lane matchup analysis state、state patch を移動。
  - `main.js` は保存・設定系モジュールを呼び出し、読み込んだ値を既存 state に反映する形へ変更。
  - Electron build の `files` に `main/**/*` を追加。
  - `test/main-stores.test.js` を追加し、settings / ChampionPool / match history JSON / app state helper の基本挙動を確認。
- 変更した主なファイル:
  - `main/settings-store.js`
  - `main/champion-pool-store.js`
  - `main/match-history-store.js`
  - `main/app-state.js`
  - `main.js`
  - `package.json`
  - `test/main-stores.test.js`
  - `docs/AGENTS_CONTEXT.md`
  - `docs/development.md`
  - `docs/refactoring-for-ai-agents-save-data.md`
- 確認:
  - 作業前 `npm test`: 76 tests pass。
  - `node --check main.js`: pass。
  - `node --check main/settings-store.js`: pass。
  - `node --check main/champion-pool-store.js`: pass。
  - `node --check main/match-history-store.js`: pass。
  - `node --check main/app-state.js`: pass。
  - `node --check test/main-stores.test.js`: pass。
  - 作業後 `npm test`: 80 tests pass。
  - 作業後の `main.js`: 1428 行。
- Phase 4 完了メモ:
  - 保存ファイルの場所と JSON 形式は変更していない。
  - `main.js` の Electron lifecycle、IPC 登録順序、LCU / Riot / BFF 接続系の責務は維持している。
  - 後続で目指す `main/` 構造は `app-state.js`, `window.js`, `ipc-handlers.js`, `settings-store.js`, `champion-pool-store.js`, `match-history-store.js`, `lcu-client.js`, `lcu-watch.js`, `riot-match-history-service.js`, `ai-analysis-service.js`。
  - 推奨分割順は、まず `window.js` / `ipc-handlers.js`、次に `ai-analysis-service.js`、その後 `riot-match-history-service.js`、最後に `lcu-client.js` と `lcu-watch.js`。
  - `riot-match-history-service.js` と `lcu-watch.js` は state / timer / external connection 依存が大きいため、factory 形式で deps を渡す方針が安全。
- 注意:
  - Electron の実起動確認は未実施。
  - Phase 5 では LCU / Riot / BFF / AI 接続系を分ける候補がある。

## 2026-06-26: Phase 4.5 main window / IPC split completed

- 実施内容:
  - `main/window.js` を追加し、BrowserWindow 作成、activate 時の window 有無判定、window minimize / maximize / close handler を移動。
  - `main/ipc-handlers.js` を追加し、Renderer 向け IPC channel 登録を `registerIpcHandlers` に集約。
  - `main.js` は `createMainWindow` と `registerIpcHandlers` を呼び出す形に変更。
  - `test/main-ipc-handlers.test.js` を追加し、IPC channel と handler の対応を確認。
- 変更した主なファイル:
  - `main/window.js`
  - `main/ipc-handlers.js`
  - `main.js`
  - `test/main-ipc-handlers.test.js`
  - `docs/AGENTS_CONTEXT.md`
  - `docs/development.md`
  - `docs/refactoring-for-ai-agents-save-data.md`
  - `docs/refactoring-for-ai-agents.md`
- 確認:
  - `node --check main.js`: pass。
  - `node --check main/window.js`: pass。
  - `node --check main/ipc-handlers.js`: pass。
  - `node --check test/main-ipc-handlers.test.js`: pass。
  - `npm test`: 81 tests pass。
  - 作業後の `main.js`: 1407 行。
- Phase 4.5 完了メモ:
  - Electron lifecycle と IPC channel 名は変更していない。
  - `main/window.js` は Electron の `BrowserWindow` に依存するため、現時点では単体テストではなく syntax check に留めている。
- 注意:
  - Electron の実起動確認は未実施。
  - Phase 5 では、Phase 4.5 に含まれていた `ipc-handlers.js` を先行済みとして扱い、残りの外部接続系を分ける。

## 2026-06-26: Phase 5 main external service split completed

- 実施内容:
  - `main/ai-analysis-service.js` を追加し、OpenAI / BFF analysis request と Riot BFF path builder を移動。
  - `main/riot-match-history-service.js` を追加し、Riot BFF の health / account / match id / match detail request と detail response 適用 helper を移動。
  - `main/lcu-client.js` を追加し、lockfile 読み取り、LCU REST request、champion icon 取得、icon transient error 判定を移動。
  - `main/lcu-watch.js` を追加し、LCU WebSocket 接続、WAMP subscribe、message event apply、close / error handling、再接続、lockfile retry timer を移動。
  - `main.js` は各 service を factory で組み立て、state 更新と高レベル orchestration を担当する形へ整理。
  - Phase 4.5 で先行分割した `main/ipc-handlers.js` は Phase 5 の候補に含まれていたため、Phase 5 では先行済みとして扱った。
  - `test/main-ai-analysis-service.test.js`、`test/main-riot-match-history-service.test.js`、`test/main-lcu-client.test.js`、`test/main-lcu-watch.test.js` を追加。
- 変更した主なファイル:
  - `main/ai-analysis-service.js`
  - `main/riot-match-history-service.js`
  - `main/lcu-client.js`
  - `main/lcu-watch.js`
  - `main.js`
  - `test/main-ai-analysis-service.test.js`
  - `test/main-riot-match-history-service.test.js`
  - `test/main-lcu-client.test.js`
  - `test/main-lcu-watch.test.js`
  - `docs/AGENTS_CONTEXT.md`
  - `docs/development.md`
  - `docs/refactoring-for-ai-agents.md`
  - `docs/refactoring-for-ai-agents-save-data.md`
- 確認:
  - `node --check main.js`: pass。
  - `node --check main/ai-analysis-service.js`: pass。
  - `node --check main/riot-match-history-service.js`: pass。
  - `node --check main/lcu-client.js`: pass。
  - `node --check main/lcu-watch.js`: pass。
  - `npm test`: 88 tests pass。
  - 作業後の `main.js`: 1046 行。
- Phase 5 完了メモ:
  - `main.js` には、外部接続結果を既存 state に反映する orchestration と、lane matchup / match history の状態管理がまだ残っている。
  - 保存ファイル形式、IPC channel 名、LCU endpoint、WebSocket subscribe payload は変更していない。
  - `main/lcu-watch.js` と `main/lcu-client.js` は Electron / network 依存があるため、現時点では pure helper の単体テストと syntax check を中心に確認している。
- 注意:
  - Electron の実起動確認は未実施。
  - 次にさらに薄くするなら、match history orchestration または lane matchup analysis state machine を service 側へ寄せる候補がある。
