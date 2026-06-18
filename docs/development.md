# Development Guide

この文書は、LoL AI Draft Coach の開発者向けメモです。利用者向けの概要と使い方は `README.md` を参照してください。

## セットアップ

```bash
npm install
npm start
```

開発時に DEBUG ログを出しながら起動する場合は次を使います。

```bash
npm run dev
```

`npm run dev` はログレベルを DEBUG にして Electron を起動し、実行ディレクトリ直下の `debug.log` にログを追記します。`debug.log` は `.gitignore` 対象です。

## テスト

```bash
npm test
```

Node.js 標準の `node:test` で、LCU lockfile のパース、認証ヘッダ生成、チャンピオン一覧の正規化、ドラフト表示用の BAN 集計・ターン判定・表示状態判定、Riot API retry、試合履歴の正規化・集計、match history 更新時の ID 重複排除を確認します。

## 実装概要

- Electron のメインプロセスは `main.js` です。
- Renderer は `index.html`, `renderer.js`, `draft-logic.js`, `style.css` です。
- Renderer から Node.js API を直接触らないように、`preload.js` と `contextBridge` で必要な IPC だけ公開しています。
- `main.js` で LCU lockfile を読み、REST API 初期取得と `OnJsonApiEvent` の WebSocket 購読を行います。
- `lcu-logic.js` に LCU 接続用の純粋関数、`draft-logic.js` にドラフト表示用の純粋関数を切り出しています。
- `riot-api.js` は Riot API 用の request / retry 基盤です。
- `riot-match-history.js` は Match-V5 response の正規化と自己戦績集計を担当します。
- `match-history-workflow.js` は match history 更新時の ID 結合、重複排除、キャッシュ済み detail 判定を担当します。
- `logger.js` で `electron-log` を設定し、`npm run dev` では `debug.log` へ DEBUG ログを出します。

## 安全方針

このアプリは情報表示と提案のみを行います。

実装してはいけないこと:

- 自動ピック
- 自動 BAN
- 自動ドッジ
- ゲームプレイの自動操作
- メモリ読み取り
- LoL クライアントやゲーム本体の改ざん

プレイヤーの操作はすべて本人が手動で行う前提です。

## LCU lockfile

標準パスは次の場所です。

```text
C:\Riot Games\League of Legends\lockfile
```

lockfile には LCU API の接続に必要な port、password、protocol が含まれます。LoL クライアントが起動していない、またはログインしていない場合、このファイルが存在せず接続できません。

lockfile 形式:

```text
processName:pid:port:password:protocol
```

## LCU API の手動確認

PowerShell で lockfile から接続情報を読み取り、LCU API へ手動リクエストできます。

```powershell
$lockfile = "C:\Riot Games\League of Legends\lockfile"
$parts = (Get-Content $lockfile -Raw).Trim().Split(":")

$port = $parts[2]
$password = $parts[3]
$protocol = $parts[4]

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("riot:$password"))
$headers = @{
  Authorization = "Basic $auth"
}
```

PowerShell では `"$protocol://..."` のように書くと `:` が変数名の一部として解釈される場合があるため、`${protocol}` のように変数名を明示します。

```powershell
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-lobby/v2/lobby" -Headers $headers -SkipCertificateCheck
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-champ-select/v1/session" -Headers $headers -SkipCertificateCheck
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-summoner/v1/current-summoner" -Headers $headers -SkipCertificateCheck
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-gameflow/v1/gameflow-phase" -Headers $headers -SkipCertificateCheck
```

JSON として見やすく表示する例です。

```powershell
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-gameflow/v1/gameflow-phase" -Headers $headers -SkipCertificateCheck |
  ConvertTo-Json -Depth 20
```

PowerShell 5 系などで `-SkipCertificateCheck` が使えない場合は、`curl.exe` を使います。

```powershell
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-lobby/v2/lobby"
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-champ-select/v1/session"
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-summoner/v1/current-summoner"
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-gameflow/v1/gameflow-phase"
```

## LCU REST / WebSocket

起動時、手動再取得時、設定変更後に以下を REST で取得します。

```js
const LCU_ENDPOINTS = {
  lobby: '/lol-lobby/v2/lobby',
  champSelect: '/lol-champ-select/v1/session',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase',
  championSummary: '/lol-game-data/assets/v1/champion-summary.json'
};
```

REST 通信は `fetch` ではなく `http.request` / `https.request` で実装しています。LCU API は自己署名証明書を使うため、開発用途として LCU へのローカル接続だけ証明書検証を緩和しています。

404 は `null` として扱います。ロビー未参加やチャンピオン選択外では、`lobby` や `champSelect` が `null` になることがあります。

LCU WebSocket は単一接続先に接続します。

```text
wss://riot:<password>@127.0.0.1:<port>/
```

接続後、以下を送って購読します。

```js
[5, "OnJsonApiEvent"]
```

更新対象:

```text
/lol-lobby/v2/lobby
/lol-champ-select/v1/session
/lol-summoner/v1/current-summoner
/lol-gameflow/v1/gameflow-phase
```

WebSocket が切断された場合は 3 秒後に再接続を試みます。アプリを LoL 起動前に起動した場合も、lockfile 未検出時は 5 秒ごとに再試行します。

## 保存ファイル

設定と ChampionPool は Electron の `app.getPath('userData')` 配下に保存します。Windows では通常、次のような場所です。

```text
C:\Users\<ユーザー名>\AppData\Roaming\lol-ai-draft-coach\
```

保存ファイル:

```text
settings.json
champion-pool.json
riot-match-cache/<account-puuid>.json
match-history/<account-puuid>.json
```

`settings.json` には LoL インストールディレクトリに加えて、Riot API 連携用の開発者トークンと Region を保存できます。トークン本文は Debug 画面の state 表示やログには出しません。

## Riot API / Match History

試合履歴と自己戦績は Riot API Match-V5 を優先して取得します。Region は `JP1` などの platform routing value として保存し、Match-V5 など regional routing を使う API では、保存した Region から `ASIA` / `AMERICAS` / `EUROPE` / `SEA` を導出します。

取得モード:

```text
recent: 直近90試合
season: 今シーズン開始日時以降の全試合
```

取得済み match detail はアカウント別にローカルキャッシュし、再取得しません。統計に使う試合は 5v5 Summoner's Rift の Ranked / Normal 系 queue に絞り、Ranked と Normal の自己戦績は分けて扱います。

season 手動取得では、match id 一覧を取得したあと、未取得 detail 数から概算所要時間を出して確認モーダルを表示します。取得済み正規化 match 数が 1〜90 件の場合は、ヘッダーに season 全取得でサンプル数を増やせる可能性がある旨の導線を表示します。

Riot API の RateLimit にかかった場合は `Retry-After` に従って待機します。RateLimit 待機に入るタイミングで、すでに取得済みの detail を正規化・集計・保存・UI 反映します。

起動時だけでなく、アプリ起動後に LoL へログインした場合や Riot API token / region を保存した場合にも、条件を満たせば recent の自動取得を予約します。Riot API 認証失敗時は Settings タブで token を確認するよう進捗行に表示します。

LCU match history はページングやキャッシュ挙動が不安定だったため、推薦・自己戦績の本線には使いません。使う場合は fallback / 調査用に限定します。

## 関連設計ドキュメント

- `docs/AGENTS_CONTEXT.md`: 現在の実装状況とエージェント向けの作業文脈
- `docs/riot-match-history-design.md`: Riot API Match-V5 による自己戦績取得設計
- `docs/lcu-match-history-design.md`: LCU match history の調査結果と fallback 方針
- `docs/lcu-event-insights-design.md`: LCU WebSocket event から作れるインサイト案
- `docs/meta-statistics-design.md`: メタ統計と推薦スコアの設計方針

## 重要な実装メモ

- `fetch` に戻さないこと。LCU 自己署名証明書で REST 取得が壊れる可能性があります。
- `nodeIntegration` を有効化しないこと。
- Renderer に `ipcRenderer` を直接公開しないこと。
- LoL 未起動状態でもクラッシュさせないこと。
- ロビー未参加やチャンピオン選択外の `404/null` は正常系として扱うこと。
- gameflow phase が `ChampSelect` 以外になったら古い `champSelect` state を残さないこと。
- LCU への画像取得を一気に大量実行しないこと。
- Riot API token、LCU password、Basic 認証ヘッダをログ、Renderer、Debug state に出さないこと。
- recent 自動取得で season 取得済みの `match-history/<account-puuid>.json` を 90 件に縮めないこと。
- match history の ID 結合は重複排除し、同一 matchId を二重集計しないこと。
