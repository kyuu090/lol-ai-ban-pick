# LoL AI Draft Coach - Agent Context

## Project Summary

ElectronでWindows向けのローカルアプリ「LoL AI Draft Coach」を開発している。

目的は、League of LegendsクライアントのローカルAPIであるLCU APIから、ロビー、チャンピオン選択、サモナー、gameflow phaseを取得し、プレイヤー向けUIにリアルタイム表示すること。

将来的にはOpenAI APIなどと連携し、ドラフト状況と自分の戦績をもとにおすすめピック、避けた方がいいピック、構成相性、レーン相性などを提示する予定。

現時点ではAI連携は未実装。MVPとして、LCU REST APIの初期取得とLCU WebSocketのリアルタイム監視まで実装済み。

試合履歴・自己戦績分析は Riot API Match-V5 を本線にする。LCU match history はページングやキャッシュ挙動が不安定だったため、fallback / 調査用として扱う。

LCU WebSocket event から作れるバンピック中・試合中・試合終了後インサイトの調査は `docs/lcu-event-insights-design.md` にまとめる。

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
style.css
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
- Rendererは `index.html`, `renderer.js`, `draft-logic.js`, `style.css`。
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
- Riot API連携用の開発者トークンを入力・保存できる
- Riot APIトークンを空欄で保存すると削除できる
- Riot APIトークン本文はRendererへ返さず、Debug画面のstateにも表示しない
- Riot APIのplatform regionを選択・保存できる
- Match-V5などで使うregional routeはplatform regionから自動導出する

現在のデータ取得方針では、Riot API設定は自己戦績取得の本線で使う。自分の戦績取得は Riot API Match-V5 を優先し、LCU match history は fallback / 調査用として扱う。

設定保存先:

```text
app.getPath('userData')/settings.json
```

保存している設定:

```json
{
  "lolInstallDir": "C:\\Riot Games\\League of Legends",
  "riotApiToken": "RGAPI-...",
  "riotPlatformRegion": "JP1"
}
```

RendererやDebug画面へ返す公開settingsは、`riotApiToken` 本文を含めず、`hasRiotApiToken`, `riotPlatformRegion`, `riotRegionalRoute` だけを含める。

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

- 一度に90試合を取得対象にする
- Riot ID -> PUUID、match ids、match details の順で取得する
- 1回の最大request数は 92 requests 程度に抑える
- `100 requests / 2 minutes` に対して 8 requests の余白を残す
- match detail は 5並列、350ms batch delay で取得する
- `20 requests / 1 second` にかからない速度にする
- 429では `Retry-After` ヘッダを優先して待つ
- 取得済み match detail はキャッシュし、再取得しない
- Riot APIから取得するmatch id一覧は直近90件
- `match-history.json` は、`riot-match-cache.json` 内に存在する5v5 SR対象試合を新しい順に並べ、その直近90件で再生成する
- 統計に使う試合は5v5 Summoner's Riftに限定する
- 初期統計対象は 5v5 Summoner's Rift の Ranked / Normal 系 queue
- Ranked と Normal は `queueType` を分けて集計する
- queueId は保持し、`queueGroup` で Ranked Solo/Duo、Ranked Flex、Normal Draft、Normal Blind、Quickplay などを分ける
- ヘッダーの `Update match data` ボタンで手動取得する
- 起動時と試合終了後に自動取得を試みる
- ChampSelect中に重い自動取得を走らせない
- raw responseはファイル保存してもログやDebug stateへ常時表示しない
- 取得中は同じ取得ボタンを押せない状態にする
- Riot API rate limit 時は retrying として扱う
- 取得状態はヘッダーの `Update match data` ボタン内テキストで表示する

保存候補:

```text
app.getPath('userData')/riot-match-cache.json
app.getPath('userData')/match-history.json
```

正規化済みデータから champion ごとの自己成績を集計し、ChampionPool表示、非AI推薦、AI説明用contextに使う。

現在の `match-history.json` は正規化済み `matches` と `championStats` を持つ。

`championStats` は次の粒度を持つ。

```text
championId + queueGroup + all positions
championId + all_sr_5v5 + all positions
championId + queueGroup + position
championId + all_sr_5v5 + position
```

`position === null` は全ロール合算。`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` はそのロールだけの実績。

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

取得状態はヘッダーの `Update match data` ボタン内に表示する。

```text
Update match data
Updating...
Saving...
Retrying...
Updated 3 matches data
Update failed
```

`completed` は3秒、`partial` と `error` は5秒で `Update match data` に戻す。完了時には取得件数ではなく `updatedMatches` を表示する。同じ完了状態を LCU state 更新のたびに再表示しない。

自動取得:

- 起動後、LCU接続に成功し、ログイン中、Riot API tokenあり、ChampSelect/試合中でなければ約2秒後
- gameflow phase が `GameStart` / `InProgress` から抜けた約20秒後
- token未設定、未ログイン、Riot ID未取得、ChampSelect/試合中、取得中は skip
- hover / pick intent / pick確定など、ChampSelect中の操作では Riot API 取得を走らせない

### ChampionPool

ChampionPool画面を実装済み。

できること:

- CoachタブとSettingsタブの間に `ChampionPool` タブを表示する
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
  lastEvent,
  error,
  updatedAt
}
```

Rendererは `window.lcuApi.onState(callback)` で状態更新を受け取る。

### Shared Logic and Tests

- `lcu-logic.js` は lockfile パース、Basic 認証ヘッダ生成、チャンピオン summary の `championsById` 化を担当する。
- `draft-logic.js` は Renderer で使うドラフト表示用の純粋関数を持つ。主な対象は BAN 集計、進行中アクション判定、ログイン/ChampSelect/InGame の表示状態判定、タイマー残り時間の取得、ChampionPool正規化。
- `index.html` は `draft-logic.js` を `renderer.js` より先に読み込む。
- `npm test` で Node.js 標準の `node:test` を実行する。現在は `test/draft-logic.test.js` と `test/lcu-logic.test.js` がある。

## UI

画面切り替えタブは以下の順番。

```text
Coach / ChampionPool / Settings / Debug
```

### Coach

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
- 中央: 現在のドラフト状態、残り秒数、自分の操作待ちかどうか
- 自分の pick intent / 確定 champion には、現在 assignedPosition + championId のロール別自己戦績を表示する
- 自分以外の味方や敵側には、自分の使用戦績を表示しない

チャンピオン名変換は実装済み。LCUのchampion summaryを取得できていれば正式なチャンピオン名で表示し、取得できない場合は `Champion 122` のようなfallback表示を使う。

BAN表示:

- `champSelect.bans.myTeamBans`
- `champSelect.bans.theirTeamBans`
- `champSelect.actions` 内の `type === "ban"` かつ `championId > 0`

上記を統合して表示する。

古い `champSelect` が残ってバンピック画面に戻らないよう、gameflow phaseが `ChampSelect` 以外になったら `champSelect` を `null` にする。

今後の有力な次実装:

- バンピック中の自分用 ChampionPool 候補パネル
- 現在 assignedPosition の ChampionPool 候補を、BAN済み/選択済みを除いて表示
- 候補ごとにロール別 games / Ave KDA / WR / Low sample を表示
- 自分が pick 中のときだけ候補パネルを強調

### Settings

LoLインストールディレクトリ設定画面。

- 入力欄
- `参照` ボタン
- `保存` ボタン
- 保存メッセージ

### ChampionPool

ユーザーの得意チャンピオンをレーン別に登録する画面。

- 上部: レーンタブ
- 中段: 選択中レーンの登録済みチャンピオン
- 下段: 検索欄とチャンピオンギャラリー
- ギャラリーはチャンピオン画像 + 名前のカード
- カードクリックで現在レーンのChampionPoolへ追加
- 登録済みカードは選択済み表示
- 保存ボタンで `champion-pool.json` に保存

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

Riot API用の薄いクライアント基盤は `riot-api.js` に置く。

現在の試合履歴取得方針では Riot API が本線。自分の戦績は Riot API Match-V5 を優先し、LCU match history は fallback / 調査用として扱う。

- `riotPlatformRegion` は `JP1`, `NA1`, `KR` などのplatform routing value
- Match-V5のようなregional routing APIでは `createRiotApiHosts` で `ASIA`, `AMERICAS`, `EUROPE`, `SEA` を導出する
- HTTP 429が返った場合は `Retry-After` ヘッダを優先して待機し、ヘッダがなければ短いfallback delayでretryする
- Riot APIトークンは `X-Riot-Token` ヘッダにだけ入れ、ログに出さない
- 自己戦績取得では90試合を対象にし、想定最大request数を92件に抑える
- match detail は5並列、350ms batch delayを初期値にする
- 取得済み match detail は `riot-match-cache.json` から再利用する
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
- Riot API token をログ、Renderer、Debug stateに出さないこと。
- Riot API match detail はキャッシュし、取得済み matchId を再取得しないこと。
- 統計に使う試合は5v5 Summoner's Riftに限定すること。
- Ranked と Normal を同じ自己戦績として混ぜないこと。
- 自己戦績取得中は二重起動させないこと。初期実装では取得ボタンをdisabledにする。
- Riot API 429では `Retry-After` を優先して待つこと。
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

- ChampSelect中の自分用 ChampionPool 候補パネルを追加する
- BAN済み/選択済み champion を候補から除外または disabled 表示にする
- 候補ごとにロール別自己戦績、Low sample、No games を表示する
- ChampionPoolと自己戦績を使って、非AIモードの推薦候補ランキングを出す
- 非AI推薦結果と味方/敵構成をAI用の構造化データに変換する
- OpenAI API連携用の安全な設計を追加する
- Windows向けスタンドアロン配布用に `electron-builder` を追加する
