# LoL AI Draft Coach - Agent Context

## Project Summary

ElectronでWindows向けのローカルアプリ「LoL AI Draft Coach」を開発している。

目的は、League of LegendsクライアントのローカルAPIであるLCU APIから、ロビー、チャンピオン選択、サモナー、gameflow phaseを取得し、プレイヤー向けUIにリアルタイム表示すること。

将来的にはOpenAI APIなどと連携し、ドラフト状況と自分の戦績をもとにおすすめピック、避けた方がいいピック、構成相性、レーン相性などを提示する予定。

現時点ではAI連携は未実装。MVPとして、LCU REST APIの初期取得とLCU WebSocketのリアルタイム監視まで実装済み。

試合履歴・自己戦績分析は Riot API Match-V5 を本線にする。LCU match history はページングやキャッシュ挙動が不安定だったため、fallback / 調査用として扱う。

LCU WebSocket event から作れるバンピック中・試合中・試合終了後インサイトの調査は `docs/lcu-event-insights-design.md` にまとめる。

外部 API の秘密鍵と課金防御は BFF で扱う方針。Riot API key と OpenAI API key は配布する Electron クライアントに同梱しない。BFF 全体設計は `docs/bff-design.md`、Riot API allowlist proxy の Phase 1 実装プロンプトは `docs/bff-phase1-prompt.md` にまとめる。

## Collaboration Persona

ユーザーが「服部平次」として話しかけ、エージェントを「工藤」または「工藤新一」と呼ぶことがある。その場合、エージェントは会話上の軽いロールプレイとして、東京生まれ東京育ちの高校生探偵風に、論理的で観察力のある相棒として応答する。

基本方針:

- ユーザーを必要に応じて「服部」と呼ぶ。
- 推理するように、根拠、仮説、次の一手を整理して話す。
- 口調は落ち着いた標準語寄りを基本にしつつ、ユーザーの関西弁のノリには軽く乗ってよい。
- 「真実はいつもひとつ」などの短い決め台詞風の表現は、場面に合えば軽く使ってよい。
- ロールプレイは作業効率と安心感のための会話スタイルに留める。技術判断、安全方針、事実確認、秘密情報保護、テスト実行方針を上書きしない。
- 実装や設計の結論では、キャラクター性よりも正確性、検証可能性、ユーザーにとっての実用性を優先する。

## Safety Policy

このアプリは情報表示と提案のみを行う。

実装してはいけないこと:

- 自動ピック
- 自動BAN
- 自動ドッジ
- ゲームプレイの自動操作
- メモリ読み取り
- LoLクライアントやゲーム本体の改ざん

プレイヤーの操作はすべて本人が手動で行う前提。

## Tech Stack

- Electron
- Node.js
- HTML/CSS/JavaScript
- Reactなし
- Windows環境想定
- `electron-log`
- `nodeIntegration: false`
- `contextIsolation: true`
- `preload.js` + `contextBridge` + `ipcRenderer/ipcMain`

## File Structure

```text
package.json
package-lock.json
main.js
preload.js
index.html
renderer.js
draft-logic.js
lcu-logic.js
styles/
logger.js
scripts/run-dev.js
test/
README.md
AGENTS_CONTEXT.md
.gitignore
```

## Current Implementation

### Electron

- `package.json` の `npm start` で `electron .` を起動する。
- `package.json` の `npm run dev` でDEBUGログ付き起動を行う。
- メインプロセスは `main.js`。
- Rendererは `index.html`, `renderer.js`, `draft-logic.js`, `styles/`。
- `main.js` はLCU接続まわりの純粋関数を `lcu-logic.js` から使う。
- RendererからNode.js APIを直接触らせず、`preload.js` で安全なAPIだけ公開している。

### Development Logging

開発用ログは `electron-log` を使う。

起動コマンド:

```bash
npm run dev
```

`scripts/run-dev.js` がElectronを起動し、次の環境変数を設定する。

```text
LOG_LEVEL=debug
LOG_TO_CWD=1
```

`logger.js` がログ設定を担当する。

- 通常のログレベル既定値は `info`
- `LOG_TO_CWD=1` のとき、実行ディレクトリ直下の `debug.log` に出力する
- `debug.log` は追記方式
- `electron-log` の既定により、ログファイルは一定サイズでローテーションされる
- `debug.log` は `.gitignore` 対象
- LCUのpasswordやBasic認証ヘッダはログに出さない

主なログ対象:

- Settings / ChampionPool の読み込みと保存
- LCU lockfile 読み込み
- LCU RESTリクエストの開始、終了、HTTP status、duration
- LCU WebSocketの接続、切断、イベント受信
- LCU再接続、lockfile retry
- Champion icon取得失敗
- Renderer側のタブ切り替え、ChampionPool編集、手動再取得、設定保存

Rendererは `preload.js` の `window.lcuApi.log(level, message, details)` から `log:renderer` IPCへ送る。メインプロセスで受け、`logger.js` の `logRendererMessage` が `[renderer]` prefix付きで記録する。

### LCU Lockfile

lockfileの標準ディレクトリは以下。

```text
C:\Riot Games\League of Legends
```

参照するlockfileは以下。

```text
<LoL install dir>\lockfile
```

lockfile形式:

```text
processName:pid:port:password:protocol
```

取得する値:

- port
- password
- protocol

### Settings

Settings画面を実装済み。

できること:

- LoLインストールディレクトリを入力できる
- `参照` ボタンでディレクトリ選択できる
- `保存` ボタンで設定を保存できる
- 保存後、既存WebSocketを閉じてLCUへ再接続する
- Riot API key はクライアントで扱わず、BFF経由で試合履歴を取得する
- BFF Base URL はクライアント設定として公開せず、内部定数として扱う
- ログイン先サーバとして Riot API のplatform regionを選択・保存できる
- Match-V5などで使うregional routeはplatform regionから自動導出する

現在のデータ取得方針では、BFF経由の Riot API Match-V5 を自己戦績取得の本線にする。LCU match history は fallback / 調査用として扱う。

設定保存先:

```text
app.getPath('userData')/settings.json
```

保存している設定:

```json
{
  "lolInstallDir": "C:\\Riot Games\\League of Legends",
  "riotPlatformRegion": "JP1"
}
```

RendererやDebug画面へ返す公開settingsは、`lolInstallDir`, `riotPlatformRegion`, `riotRegionalRoute`, `riotPlatformRegions` だけを含める。BFF Base URL や Riot API key は公開しない。

### Riot Match History

自分の試合履歴・自己戦績分析は Riot API Match-V5 から取得する方針。

詳細設計は `docs/riot-match-history-design.md` にまとめる。LCU match history の調査結果と fallback 方針は `docs/lcu-match-history-design.md` にまとめる。

初期対象:

- 自分の直近試合
- 自分の champion
- 勝敗
- kills / deaths / assists
- 味方 champion
- 敵 champion
- queue / queueGroup / mapId / game mode / gameId / gameCreation

現在の取得方針:

- 取得モードは `recent` と `season`
- `recent` は直近90試合を取得対象にする
- `season` は現在年の `1/1 00:00 JST` 以降のmatch idを、`count=100` でページング取得する
- LCU current summoner の PUUID はローカル保存キーとして使う
- Match-V5 の `by-puuid` と正規化時の自分participant特定には、Riot Account-V1で得た PUUID を使う
- match detail は recent では 5並列、350ms batch delay で取得する
- season では 5並列、batch delay なしで、RateLimitに当たるまで高速に取得する
- 429では `Retry-After` ヘッダを優先して待つ
- RateLimit待機中は `RiotAPIのRateLimitを待機中... (次回取得までN秒)` を表示する
- RateLimit待機に入るタイミングで、すでに取得済みのdetailを正規化・集計・保存・UI反映する
- detail 5件ごとの途中正規化は行わず、RateLimit時と最終完了時に正規化する
- 取得済み match detail はキャッシュし、再取得しない
- recent 更新では、Riotに問い合わせるmatch idは直近90件だけだが、正規化対象は「直近90ID + 既存historyのmatchId」を重複排除したものにする
- season 更新では、シーズンのmatch id全体を正規化対象にする
- 統計に使う試合は5v5 Summoner's Riftに限定する
- 初期統計対象は 5v5 Summoner's Rift の Ranked / Normal 系 queue
- Ranked と Normal は `queueType` を分けて集計する
- queueId は保持し、`queueGroup` で Ranked Solo/Duo、Ranked Flex、Normal Draft、Normal Blind、Quickplay などを分ける
- ヘッダーの `Download recent match` ボタンでrecent手動取得する
- `Download recent match` 右側のプルダウンからseason手動取得する
- 正規化済みmatch数が1〜90件の場合、ヘッダーに `シーズン中データの全取得でサンプル数を増やせる可能性があります` の導線を表示し、クリックでseason取得を開始する
- season手動取得では、match id一覧取得までは自動で行い、対象試合数と未取得detail数が分かった時点で確認モーダルを表示する
- season確認モーダルでは、未取得detail数を概算 `100 requests / 2分` で見積もり、`あなたの場合、N分程度かかります` と表示する
- 起動時、アプリ起動後のLoLログイン時、region保存後、試合終了後に自動取得を試みる
- ChampSelect中に重い自動取得を走らせない
- BFF疎通失敗や単発取得endpointの5XXでは `試合データ取得サービスへの接続を確認してください。` を進捗行に表示する
- raw responseはファイル保存してもログやDebug stateへ常時表示しない
- 取得中は同じ取得ボタンを押せない状態にする
- Riot API rate limit 時は retrying として扱う
- 取得状態はヘッダーの進捗行に表示し、ボタン内テキストも短く切り替える

保存候補:

```text
app.getPath('userData')/riot-match-cache/{localPuuid}.json
app.getPath('userData')/match-history/{localPuuid}.json
```

正規化済みデータから champion ごとの自己成績を集計し、ChampionPool表示、非AI推薦、AI説明用contextに使う。

現在の `match-history/{localPuuid}.json` は正規化済み `matches` と `championStats` / `enemyChampionStats` / `laneOpponentStats` / `selfVsLaneOpponentStats` を持つ。

`championStats` は次の粒度を持つ。

```text
championId + queueGroup + all positions
championId + all_sr_5v5 + all positions
championId + queueGroup + position
championId + all_sr_5v5 + position
```

`position === null` は全ロール合算。`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` はそのロールだけの実績。

`selfVsLaneOpponentStats` は次の粒度で、自分 champion と同一ロール対面 champion の過去実績を持つ。

```text
selfPosition + self championId + opponent championId
```

この集計は、勝敗、勝率、平均 kills / deaths / assists / KDA を持つ。ChampSelect の対面別表示では、敵チーム全体ではなく、自分の `self.position` と同じ `enemy.position` の champion だけを対面として扱う。

統計対象フィルタ:

```text
mapId === 11
gameMode === "CLASSIC"
queueId is allowed 5v5 SR ranked/normal queue
participant count === 10
```

`queueType` / `queueGroup`:

```text
queueType: ranked | normal
queueGroup: ranked_solo | ranked_flex | normal_draft | normal_blind | normal_quickplay
all_sr_5v5: queue判定できない場合やfallback表示用
```

取得ステータスは `appState.matchHistoryStatus` として持つ想定。

```js
{
  phase: "idle",
  source: "manual",
  mode: "recent",
  requestedMatches: 90,
  fetchedMatches: 0,
  normalizedMatches: 0,
  updatedMatches: 0,
  failedRequests: 0,
  retryAttempt: 0,
  nextRetryAt: null,
  message: "",
  error: null,
  startedAt: null,
  updatedAt: null
}
```

`phase` は `idle`, `collecting`, `normalizing`, `aggregating`, `completed`, `partial`, `retrying`, `error` を使う。

取得状態はヘッダーの `Download recent match` split button と進捗行に表示する。

```text
Download recent match
Downloading...
Downloading season...
Saving...
Retrying...
Downloaded 3 matches
Download failed
```

進捗行の例:

```text
試合IDリスト取得中... 300 試合
試合データ収集中... 47/210 試合
RiotAPIのRateLimitを待機中... (次回取得まで34秒)
試合データを正規化しています
```

`completed` は3秒、`partial` と `error` は5秒で `Download recent match` に戻す。完了時には取得件数ではなく `updatedMatches` を表示する。同じ完了状態を LCU state 更新のたびに再表示しない。

自動取得:

- 起動後、LCU接続に成功し、ログイン中、Riot API tokenあり、ChampSelect/試合中でなければ約2秒後
- アプリ起動後にLoLへログインした場合、`current-summoner` 更新後に条件を満たせば約2秒後
- Riot API token または region 保存後、ログイン中で条件を満たせば約2秒後
- gameflow phase が `GameStart` / `InProgress` から抜けた約20秒後
- token未設定、未ログイン、Riot ID未取得、ChampSelect/試合中、取得中は skip
- hover / pick intent / pick確定など、ChampSelect中の操作では Riot API 取得を走らせない

### ChampionPool

ChampionPool画面を実装済み。

できること:

- DraftタブとSettingsタブの間に `ChampionPool` タブを表示する
- レーン別に `TOP / JG / MID / BOT / SUP` のタブを持つ
- 選択中レーンの登録済みチャンピオンを上部に表示する
- チャンピオン画像と名前のギャラリーからクリックで得意チャンピオンを追加する
- チャンピオン名、alias、titleで検索してギャラリーを絞り込む
- 登録済みチャンピオンを削除できる
- `保存` ボタンでローカルファイルに保存する
- 起動時に保存ファイルがあれば読み込む
- 登録済みチャンピオンには、選択中レーンに対応するロール別自己戦績を表示する
- 該当ロールで実績がなければ、全ロール合算にfallbackせず `No games` と表示する

保存先:

```text
app.getPath('userData')/champion-pool.json
```

保存形式:

```json
{
  "top": [122, 103],
  "jungle": [],
  "middle": [99],
  "bottom": [],
  "utility": []
}
```

レーン定義は `draft-logic.js` の `CHAMPION_POOL_LANES` にある。

```js
[
  { id: 'top', label: 'TOP' },
  { id: 'jungle', label: 'JG' },
  { id: 'middle', label: 'MID' },
  { id: 'bottom', label: 'BOT' },
  { id: 'utility', label: 'SUP' }
]
```

保存前後には `normalizeChampionPool` で次を保証する。

- 定義済みレーンだけを持つ
- 各レーンは正のchampion id配列
- 重複champion idを除去する

IPC:

- `champion-pool:get`
- `champion-pool:save`

Renderer公開API:

- `window.lcuApi.getChampionPool()`
- `window.lcuApi.saveChampionPool(championPool)`

### Champion Names and Icons

チャンピオン名はLCUの次のエンドポイントから取得する。

```text
/lol-game-data/assets/v1/champion-summary.json
```

`lcu-logic.js` の `createChampionsById` で `championsById` に正規化し、Rendererで `championLabel` / `championTitle` に使う。

チャンピオンアイコンは必要になった時点で次のエンドポイントから取得する。

```text
/lol-game-data/assets/v1/champion-icons/<championId>.png
```

ChampionPoolギャラリーでは全チャンピオン画像を一気に取得しない。

- `IntersectionObserver` で表示範囲に近い画像だけを取得する
- アイコン取得は最大4並列
- `championIconCache` で成功/失敗結果をキャッシュする
- LCU接続断などの一時エラーでは、最初の1回だけwarnログを出し、短時間の抑制を行う

### REST API

起動時、手動再取得時、設定変更後に以下をRESTで取得する。

```js
const LCU_ENDPOINTS = {
  lobby: '/lol-lobby/v2/lobby',
  champSelect: '/lol-champ-select/v1/session',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase',
  championSummary: '/lol-game-data/assets/v1/champion-summary.json'
};
```

REST通信は `fetch` ではなく `http.request` / `https.request` で実装している。

理由:

- Node/Electronのglobal `fetch(url, { agent })` では `https.Agent({ rejectUnauthorized: false })` が効かなかった。
- LCU APIは自己署名証明書なので、RESTだけ `fetch failed` になった。
- 現在は `https.request` のオプションに `rejectUnauthorized: false` を指定している。

Basic認証:

- username: `riot`
- password: lockfileから取得したpassword

404は `null` として扱う。ロビー未参加やチャンピオン選択外では、`lobby` や `champSelect` が `null` になることがある。

### WebSocket

LCU WebSocketは個別リソースURLではなく、単一接続先に接続する。

```text
wss://riot:<password>@127.0.0.1:<port>/
```

接続後、以下を送って購読する。

```js
[5, "OnJsonApiEvent"]
```

LCUのJSON APIイベントが流れてくるため、イベント内の `uri` を見て必要な状態だけ更新する。

イベント例:

```json
[
  8,
  "OnJsonApiEvent",
  {
    "uri": "/lol-gameflow/v1/gameflow-phase",
    "eventType": "Update",
    "data": "ChampSelect"
  }
]
```

更新対象:

- `/lol-lobby/v2/lobby`
- `/lol-champ-select/v1/session`
- `/lol-summoner/v1/current-summoner`
- `/lol-gameflow/v1/gameflow-phase`

WebSocket切断時は3秒後に再接続する。

### Lockfile Retry

アプリをLoL起動前に起動しても、後からLoLを起動すれば自動接続する。

- lockfile未検出時は5秒ごとに再試行
- 接続成功後はlockfile再試行タイマーを停止
- WebSocket再接続タイマーとは別管理

定数:

```js
const LOCKFILE_RETRY_MS = 5000;
const WEBSOCKET_RECONNECT_MS = 3000;
```

### State Shape

`main.js` の `appState` は概ね以下。

```js
{
  settings,
  lcuStatus,
  websocketStatus,
  gameflowPhase,
  summoner,
  lobby,
  champSelect,
  championsById,
  championPool,
  matchHistoryStatus,
  matchHistorySummary,
  matchHistoryChampionStats,
  matchHistoryEnemyChampionStats,
  matchHistoryLaneOpponentStats,
  matchHistorySelfVsLaneOpponentStats,
  lastEvent,
  error,
  updatedAt
}
```

Rendererは `window.lcuApi.onState(callback)` で状態更新を受け取る。

### Shared Logic and Tests

- `lcu-logic.js` は lockfile パース、Basic 認証ヘッダ生成、チャンピオン summary の `championsById` 化を担当する。
- `draft-logic.js` は Renderer で使うドラフト表示用の純粋関数を持つ。主な対象は BAN 集計、進行中アクション判定、ログイン/ChampSelect/InGame の表示状態判定、ChampionPool正規化。
- `match-history-workflow.js` は match history 更新時のID結合、重複排除、キャッシュ済みdetail判定を担当する。
- `index.html` は `draft-logic.js` を `renderer.js` より先に読み込む。
- `npm test` で Node.js 標準の `node:test` を実行する。主なテストは `test/draft-logic.test.js`, `test/lcu-logic.test.js`, `test/riot-api.test.js`, `test/riot-match-history.test.js`, `test/match-history-workflow.test.js`。

## UI

画面切り替えタブは以下の順番。

```text
Draft / ChampionPool / Stats / Settings / Debug
```

### Draft

ユーザー向け画面。

表示切り替え:

- LoL未起動/未ログイン: `ログインしてません`
- LoLログイン後: `こんにちは <ユーザー名>`
- チャンピオン選択中: LoLのチャンピオン選択風UI
- 試合中: `試合中です`

チャンピオン選択画面:

- 左側: 自分のチーム
- 右側: 相手チーム
- 上部: 味方BAN / 敵BAN
- 中央: 現在のドラフト状態、自分の操作待ちかどうか
- 自分の pick intent / 確定 champion には、現在 assignedPosition + championId のロール別自己戦績を表示する
- 自分以外の味方や敵側には、自分の使用戦績を表示しない
- 敵プレイヤー行はクリック/キーボードで同レーンの対面想定としてマークできる

チャンピオン名変換は実装済み。LCUのchampion summaryを取得できていれば正式なチャンピオン名で表示し、取得できない場合は `Champion 122` のようなfallback表示を使う。

BAN表示:

- `champSelect.bans.myTeamBans`
- `champSelect.bans.theirTeamBans`
- `champSelect.actions` 内の `type === "ban"` かつ `championId > 0`

上記を統合して表示する。

古い `champSelect` が残ってバンピック画面に戻らないよう、gameflow phaseが `ChampSelect` 以外になったら `champSelect` を `null` にする。

バンピック開始時:

- どのタブを開いていても、gameflow phase が `ChampSelect` になり `champSelect` が有効なら Draft タブへ自動遷移する
- バンピック中だけ Draft タブに `draft-live` の視覚エフェクトを付ける
- バンピック終了後は Draft タブの表示を通常状態へ戻す

実装済みのバンピック中インサイト:

- 自分のBANフェーズでは `YOUR BAN` とBAN候補インサイトを中央に表示する
- BAN候補インサイトは、中央パネル内の `Sample` フィルタで `0 / 3 / 5 / 10 / 20+ games` から最小サンプル数を変更できる。デフォルトは `5+ games`
- BAN候補インサイトは、`Threats for your ...` がある場合は最優先で表示し、次に同レーン対面で苦手な champion を最大3件表示する。敵チーム全体で苦手な champion は折りたたみ表示にする
- 自分のBANフェーズ中に自分の予定pickがある場合、`Threats for your {champion} {role}` を先頭に表示する
- `Threats for your ...` は、`self.championId === plannedChampionId` かつ `self.position === assignedPosition` の試合だけを対象にし、相手も同一ロール対面 champion だけを集計する。別ロールや敵チーム全体には fallback しない
- `Threats for your ...` には W-L / WR / KDA を表示し、少数サンプルには `Low sample` を付ける。対象履歴がない場合は `No same-role matchup history` を表示する
- 自分のPICKフェーズでは `YOUR PICK` と現在 assignedPosition の ChampionPool 候補を表示する
- ChampionPool候補はBAN済み/選択済みを unavailable 表示にし、戦績をチップ表示する
- 対面想定プレイヤーをマークしており、相手championが見えている場合は、その対面championに対して自分が過去に成績の良かったchampionを表示する
- 対面別の自分champion実績は ChampionPool 外のchampionも含め、W-L / WR / KDA を表示する
- `Best into ...`、`Threats for your ...`、BAN/PICK候補の champion 名には、小さい champion icon を帯同表示する

### ChampionPool

ユーザーの得意チャンピオンをレーン別に登録する画面。

- 上部: レーンタブ
- 中段: 選択中レーンの登録済みチャンピオン
- 下段: 検索欄とチャンピオンギャラリー
- ギャラリーはチャンピオン画像 + 名前のカード
- カードクリックで現在レーンのChampionPoolへ追加
- 登録済みカードは選択済み表示
- 登録済みチャンピオンのロール別戦績は `Games`, `W-L`, `WR`, `KDA` のチップで表示する
- 保存ボタンで `champion-pool.json` に保存

### Stats

自己戦績の統計情報を確認する画面。

- ChampionPoolの右に `Stats` タブを表示する
- Stats内に `Strengths` / `Counters` のサブタブを表示する
- デフォルトは `Strengths`

#### Counters

苦手チャンピオンを確認する画面。

- `Stats` タブ内の `Counters` サブタブで表示する
- サンプル数フィルタはデフォルト `5+ games`。`1 / 3 / 5 / 10 / 20+ games` から選べる
- 「相手にいると苦手」には、敵チームに含まれていた時の自分の勝率が50%未満のchampionだけを表示する
- 「{lane} 対面で苦手」には、選択レーンと同一ロール対面に来た時の自分の勝率が50%未満のchampionだけを表示する
- どちらもサンプル数条件を満たすデータだけを対象にし、W-L / WR / KDA を表示する
- レーン別対面は `laneOpponentStats`、敵チーム全体は `enemyChampionStats` を使う

#### Strengths

得意チャンピオンを確認する画面。

- `Stats` タブ内の `Strengths` サブタブで表示する
- サンプル数フィルタはデフォルト `5+ games`。`1 / 3 / 5 / 10 / 20+ games` から選べる
- 「あなたの得意なピック」には、選択レーンで自分が使った時の勝率が50%超のchampionだけを表示する
- 「{lane} 対面別の得意ピック」には、同一ロール対面 champion ごとに、自分がどのchampionで最も多く勝利したかを表示する
- 対面別の得意ピックは `selfVsLaneOpponentStats` を使い、同じ相手championに対して複数の自分champion実績がある場合は wins が最大のものを採用する
- 表示には対面champion、自分の最多勝利champion、W-L / WR / KDA を含める

### Settings

LoLインストールディレクトリとログイン先サーバ設定の画面。

- LoLインストールディレクトリ入力欄
- `参照` ボタン
- LoLインストールディレクトリ保存ボタン
- Riot API platform region の選択欄と保存ボタン（UI上はログイン先サーバ）
- 保存メッセージ

### Debug

開発者向け画面。

Debug画面にのみ表示するもの:

- 手動再取得ボタン
- LCU接続状態
- WebSocket接続状態
- gameflow phase
- 最終更新
- エラーメッセージ
- 現在のサモナー情報JSON
- ロビー情報JSON
- チャンピオン選択情報JSON
- 最後に受信したWebSocketイベントJSON
- 全体state JSON

## Manual LCU API Check

READMEにPowerShell/curlでの手動確認手順を記載済み。

PowerShellでは `"$protocol://..."` が変数展開エラーになるため、`${protocol}` のように書く。

例:

```powershell
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-gameflow/v1/gameflow-phase" -Headers $headers -SkipCertificateCheck
```

## Riot API Client

BFF用の薄いクライアント基盤は `riot-api.js` に置く。

現在の試合履歴取得方針では BFF 経由の Riot API Match-V5 が本線。LCU match history は fallback / 調査用として扱う。

- `riotPlatformRegion` は `JP1`, `NA1`, `KR` などのplatform routing value
- Match-V5のようなregional routing APIでは `createRiotApiHosts` で `ASIA`, `AMERICAS`, `EUROPE`, `SEA` を導出する
- HTTP 429が返った場合は `Retry-After` ヘッダを優先して待機し、ヘッダがなければ短いfallback delayでretryする
- Riot API key はクライアントで扱わず、BFF側で管理する
- 自己戦績取得は recent 90 と season 全件の2モード
- recent の match detail は5並列、350ms batch delay
- season の match detail は5並列、batch delayなしで、429までは高速取得する
- 取得済み match detail は `riot-match-cache/{localPuuid}.json` から再利用する
- 統計利用時は5v5 Summoner's RiftのRanked / Normal系queueに絞る
- Ranked と Normal は混ぜず、`queueType` 別に集計する

## Important Implementation Notes

- `fetch` に戻さないこと。LCU自己署名証明書でREST取得が壊れる可能性がある。
- `nodeIntegration` を有効化しないこと。
- Rendererに `ipcRenderer` を直接公開しないこと。
- LoL未起動状態でもクラッシュさせないこと。
- ロビー未参加やチャンピオン選択外の `404/null` は正常系として扱うこと。
- `champSelect` の古いstateに引っ張られて、試合終了後にバンピック画面へ戻らないよう注意すること。
- 危険な操作系LCU APIは実装しないこと。
- LCUへの画像取得を一気に大量実行しないこと。ChampionPoolギャラリーではIntersectionObserverと少数並列キューを使う。
- Riot API key と BFF Base URL をログ、Renderer、Debug stateに出さないこと。
- Riot API match detail はキャッシュし、取得済み matchId を再取得しないこと。
- recent 自動取得で season 取得済みの `match-history/{localPuuid}.json` を90件に縮めないこと。
- match history のID結合は重複排除し、同一matchIdを二重集計しないこと。
- 統計に使う試合は5v5 Summoner's Riftに限定すること。
- Ranked と Normal を同じ自己戦績として混ぜないこと。
- 自己戦績取得中は二重起動させないこと。初期実装では取得ボタンをdisabledにする。
- Riot API 429では `Retry-After` を優先して待つこと。
- Riot API 429待機に入ったら、取得済みdetailで途中正規化・集計・保存・UI反映すること。
- raw match detail はログや常時表示のDebug stateに出さないこと。
- LCU match history は本線にしないこと。使う場合は fallback / 調査用に限定する。
- ログにはLCU password、Basic認証ヘッダ、秘密情報を出さないこと。

## Known Environment Note

この環境ではNode.js v24.16.0でElectronのzip展開が壊れた。

現象:

- `npm install` 後に `node_modules/electron/dist/electron.exe` が存在しない
- Electron postinstallで使う `extract-zip` がElectron zipの1件目だけ展開して止まる

回避:

- Node.js v24.14.0を使用している

現在:

```text
node v24.14.0
npm 11.9.0
```

## Next Likely Tasks

- ChampionPoolと自己戦績を使って、非AIモードの推薦候補ランキングを出す
- BAN/PICKインサイトの並び順や表示件数を、queueGroup / sample size / recent performance で調整する
- AI Draft Brief用の構造化context builderを追加する
- 味方の予定pick、味方の確定pick、敵の確定pick、BAN済みchampion、ChampionPool候補をAI contextへ分離して入れる
- InProgress開始時のAI Game Plan用context builderを追加する
- BFF Phase 1として Riot API allowlist proxy を実装する
- BFF Phase 2として OpenAI API 用の課金防御、context validation、cache、in-flight lock を実装する
- Windows向けスタンドアロン配布用に `electron-builder` を追加する
