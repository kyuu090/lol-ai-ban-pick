# Refactoring Plan for AI-Assisted Maintenance

この文書は、今後のリファクタリング作業を別エージェントへ引き継ぐための方針メモです。

主目的は「生成AIがコード修正するときに、必要な文脈を小さく読み込めて、変更コストと誤修正リスクを下げること」です。副次的に、人間にとっても読みやすく、レビューしやすい構成を目指します。

## 背景

現状は Electron / Node.js の CommonJS 構成で、アプリ本体の主要ファイルがかなり大きくなっています。

- `renderer.js`: 約 2600 行。画面描画、DOM 参照、イベント処理、統計表示、ドラフト表示、AI 分析表示、設定保存などが同居している。
- `style.css`: 約 2700 行。全画面・全コンポーネントのスタイルが単一ファイルにまとまっている。
- `main.js`: 約 1500 行。Electron ウィンドウ、IPC、設定保存、LCU 接続、WebSocket、Riot 試合履歴取得、BFF / AI リクエストなどが同居している。

既に `draft-logic.js`、`lcu-logic.js`、`riot-match-history.js`、`riot-api.js` などには純粋ロジックを切り出す流れがあるため、この方向性を伸ばす。

## ゴール

- 1 回の修正で AI が読む必要のあるファイル数と行数を減らす。
- 変更対象の責務がファイル名から推測できる状態にする。
- 副作用を持つ処理と純粋な計算・整形を分ける。
- 画面単位、サービス単位でテストを追加しやすくする。
- 大きな挙動変更を混ぜず、移動・分割を小さな単位で安全に進める。

## 非ゴール

- フレームワークの導入や TypeScript 化をこのリファクタリングの前提にしない。
- UI デザインや機能仕様を大きく変えない。
- CommonJS から ESM への移行を同時に行わない。
- ビルド構成を大きく変える必要がある分割は、初期段階では避ける。

## 基本方針

### 1. 入口ファイルを薄くする

`renderer.js` と `main.js` は、最終的には「初期化」「依存の組み立て」「主要モジュール呼び出し」だけを持つファイルに近づける。

入口ファイルに新しい業務ロジックや大きな DOM 生成処理を追加しない。

### 2. 機能単位で分割する

単に行数で機械的に切るのではなく、変更理由が同じものを同じファイルに置く。

良い分割単位の例:

- チャンピオンプール編集
- 統計画面
- ドラフト画面
- インゲーム画面
- 設定画面
- チャンピオンアイコン取得・キャッシュ
- LCU 接続
- Riot 試合履歴取得
- 設定・ユーザーデータ保存
- IPC ハンドラ登録

### 3. 純粋関数を優先して切り出す

最初から大きなクラスや抽象化を作らない。まずはテストしやすい純粋関数を切り出す。

対象例:

- 表示用フォーマット
- 統計のソート・フィルタ
- request key の生成
- readiness 判定
- API レスポンスの正規化
- ViewModel 作成

### 4. 副作用を閉じ込める

ファイル IO、IPC、HTTP、WebSocket、Electron API、DOM 操作は、呼び出し境界が分かる場所に寄せる。

純粋ロジックのファイルから直接 Electron API や DOM を触らない。

### 5. 挙動変更と移動を混ぜない

リファクタリング PR では、原則として「移動・分割」と「仕様変更」を分ける。必要な修正が見つかった場合も、可能なら別コミットまたは別 PR にする。

## 推奨ディレクトリ構成案

初期段階では CommonJS のまま、既存ビルドへの影響を小さくする。

```text
main.js
renderer.js
preload.js

main/
  app-state.js
  window.js
  ipc-handlers.js
  settings-store.js
  champion-pool-store.js
  match-history-store.js
  lcu-client.js
  lcu-watch.js
  riot-match-history-service.js
  ai-analysis-service.js

ui/
  dom-elements.js
  formatters.js
  champion-icons.js
  champion-pool-view.js
  stats-view.js
  draft-view.js
  in-game-view.js
  settings-view.js
  match-data-view.js

styles/
  base.css
  layout.css
  titlebar.css
  champion-pool.css
  stats.css
  draft.css
  in-game.css
  settings.css
  theme.css
```

この構成は最終形の目安であり、一度に全部作らない。

## 作業順序

### Phase 1: 低リスクな renderer 分割

目的: `renderer.js` の見通しを改善し、以後の UI 分割を進めやすくする。

候補:

1. `ui/dom-elements.js`
   - `document.querySelector` 群を移動する。
   - 既存の `elements` オブジェクト構造はできるだけ変えない。
2. `ui/formatters.js`
   - 日付、パーセント、数値、KDA、チャンピオン表示名などの整形関数を移動する。
3. `ui/champion-icons.js`
   - チャンピオンアイコンの lazy loading、queue、missing cache まわりを移動する。

この段階では UI の見た目や挙動を変えない。

### Phase 2: renderer の画面単位分割

目的: AI が特定画面だけを読んで修正できる状態にする。

候補:

1. `ui/champion-pool-view.js`
   - チャンピオンプール編集、レーンタブ、検索、保存ボタンまわり。
2. `ui/stats-view.js`
   - played stats、opponent stats、sort、sample filter、detail row まわり。
3. `ui/draft-view.js`
   - champ select、ban / pick 表示、ドラフト中の insight 表示。
4. `ui/in-game-view.js`
   - インゲーム自己カード、最終構成分析、レーン対面分析。
5. `ui/settings-view.js`
   - LoL install dir、Riot region、theme 設定。

各 view ファイルは可能なら次の形に寄せる。

```js
function renderX(state, deps) {}
function bindXEvents(deps) {}
function createXViewModel(state) {}
```

### Phase 3: CSS 分割

目的: UI 修正時に該当画面の CSS だけを読めるようにする。

初期段階では CSS bundler を入れず、`index.html` から複数 CSS を読み込む形でよい。

分割候補:

- `styles/base.css`: CSS variables、body、共通 typography。
- `styles/layout.css`: app shell、header、tabs、panel、grid。
- `styles/titlebar.css`: custom titlebar。
- `styles/champion-pool.css`: champion pool editor。
- `styles/stats.css`: stats table、weak / strong champion list。
- `styles/draft.css`: draft board、ban / pick、draft AI analysis。
- `styles/in-game.css`: in-game view、lane matchup analysis。
- `styles/settings.css`: settings form。
- `styles/theme.css`: dark theme、system dark media query。

CSS 分割時は visual regression が起きやすいので、起動確認またはスクリーンショット確認を優先する。

### Phase 4: main.js の保存・設定系分割

目的: 副作用の小さい領域から `main.js` を薄くする。

候補:

1. `main/settings-store.js`
   - settings の default、normalize、load、save、public settings 作成。
2. `main/champion-pool-store.js`
   - champion pool の load / save。
3. `main/match-history-store.js`
   - puuid 別 match history path、read / write、reset。
4. `main/app-state.js`
   - initial state、state patch、public state shape。

保存ファイルの場所や JSON 形式は変えない。

### Phase 5: main.js の外部接続系分割

目的: LCU / Riot / BFF / AI の境界を明確にする。

候補:

1. `main/lcu-client.js`
   - lockfile 読み取り、LCU fetch、champion icon 取得。
2. `main/lcu-watch.js`
   - WebSocket 接続、再接続、LCU state refresh。
3. `main/riot-match-history-service.js`
   - Riot match id / detail 取得、rate limit handling、snapshot publish。
4. `main/ai-analysis-service.js`
   - pick phase、final composition、lane matchup の BFF request。
5. `main/ipc-handlers.js`
   - IPC channel 登録を集約。

この段階は副作用が大きいため、既存テストに加えて手動起動確認を行う。

## ファイルサイズ目安

厳密なルールではないが、AI に読ませやすい目安として以下を意識する。

- 通常のロジックファイル: 300-600 行程度。
- UI view ファイル: 500-800 行程度まで。
- 入口ファイル: 200-400 行程度まで。
- 1000 行を超えるファイルは、責務分割の候補として扱う。

## テスト方針

- 既存の `npm test` を常に通す。
- 純粋関数を切り出した場合は、可能なら `node:test` で小さなテストを追加する。
- DOM / Electron に強く依存する処理は、初期段階では無理に単体テスト化しない。
- Riot / LCU / BFF など外部接続の挙動は、既存のインターフェースを変えないことを優先する。

## 後続エージェント向け作業ルール

- @docs/refactoring-for-ai-agents-save-data.md に、前回作業したエージェントの書いた証跡が残されている。作業前に読む。
- Markdown は UTF-8 without BOM 前提。PowerShell 5.1 で読むときは `Get-Content <file> -Encoding UTF8` を使う。
- まず `npm test` の現状を確認してから大きな分割に入る。
- 大規模移動前に `git status --short` で未コミット変更を確認する。
- ユーザーや他エージェントの未コミット変更を巻き戻さない。
- 1 PR / 1 作業単位では、原則として 1 つの phase または 1 つの画面に閉じる。
- ファイル移動後は `package.json` の `build.files` に新規ファイルが含まれるか確認する。
- `index.html` から読み込む JS / CSS を増やす場合は、Electron 起動時にパスが解決できることを確認する。
- CommonJS のまま進める場合、`module.exports` / `require` の循環参照に注意する。
- `renderer.js` の分割では、グローバル状態を不用意に複製しない。共有状態は deps として渡すか、入口側で組み立てる。
- `main.js` の分割では、Electron app lifecycle と IPC 登録順序を変えない。
- 作業した証跡を @docs/refactoring-for-ai-agents-save-data.md に残すこと。後続のエージェントが作業前に確認し手続きの作業をするため、エージェントが理解しやすい形で書く。

## 完了判定

リファクタリング全体の完了は一度に目指さない。各作業単位では次を満たせば完了とする。

- 対象責務が新しいファイルに移動している。
- 入口ファイルの行数または責務が明確に減っている。
- 既存挙動を変える意図しない差分がない。
- `npm test` が通る。
- 必要に応じて Electron の起動確認が済んでいる。
- 後続修正時に読むべきファイルが以前より明確になっている。

