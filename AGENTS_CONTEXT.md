# LoL AI Draft Coach - Agent Context

## Project Summary

ElectronでWindows向けのローカルアプリ「LoL AI Draft Coach」を開発している。

目的は、League of LegendsクライアントのローカルAPIであるLCU APIから、ロビー、チャンピオン選択、サモナー、gameflow phaseを取得し、プレイヤー向けUIにリアルタイム表示すること。

将来的にはOpenAI APIなどと連携し、ドラフト状況をもとにおすすめピック、避けた方がいいピック、構成相性、レーン相性などを提示する予定。

現時点ではAI連携は未実装。MVPとして、LCU REST APIの初期取得とLCU WebSocketのリアルタイム監視まで実装済み。

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
style.css
README.md
AGENTS_CONTEXT.md
.gitignore
```

## Current Implementation

### Electron

- `package.json` の `npm start` で `electron .` を起動する。
- メインプロセスは `main.js`。
- Rendererは `index.html`, `renderer.js`, `style.css`。
- RendererからNode.js APIを直接触らせず、`preload.js` で安全なAPIだけ公開している。

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

設定保存先:

```text
app.getPath('userData')/settings.json
```

保存している設定:

```json
{
  "lolInstallDir": "C:\\Riot Games\\League of Legends"
}
```

### REST API

起動時、手動再取得時、設定変更後に以下をRESTで取得する。

```js
const LCU_ENDPOINTS = {
  lobby: '/lol-lobby/v2/lobby',
  champSelect: '/lol-champ-select/v1/session',
  summoner: '/lol-summoner/v1/current-summoner',
  gameflowPhase: '/lol-gameflow/v1/gameflow-phase'
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
  lastEvent,
  error,
  updatedAt
}
```

Rendererは `window.lcuApi.onState(callback)` で状態更新を受け取る。

## UI

画面切り替えタブは以下の順番。

```text
Coach / Settings / Debug
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

チャンピオン名変換は未実装。現在は `Champion 122` のような文字列で表示する。

BAN表示:

- `champSelect.bans.myTeamBans`
- `champSelect.bans.theirTeamBans`
- `champSelect.actions` 内の `type === "ban"` かつ `championId > 0`

上記を統合して表示する。

古い `champSelect` が残ってバンピック画面に戻らないよう、gameflow phaseが `ChampSelect` 以外になったら `champSelect` を `null` にする。

### Settings

LoLインストールディレクトリ設定画面。

- 入力欄
- `参照` ボタン
- `保存` ボタン
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

## Important Implementation Notes

- `fetch` に戻さないこと。LCU自己署名証明書でREST取得が壊れる可能性がある。
- `nodeIntegration` を有効化しないこと。
- Rendererに `ipcRenderer` を直接公開しないこと。
- LoL未起動状態でもクラッシュさせないこと。
- ロビー未参加やチャンピオン選択外の `404/null` は正常系として扱うこと。
- `champSelect` の古いstateに引っ張られて、試合終了後にバンピック画面へ戻らないよう注意すること。
- 危険な操作系LCU APIは実装しないこと。

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

- Data DragonからチャンピオンIDと名前の対応表を取得/キャッシュする
- `Champion 122` 表示を正式なチャンピオン名へ変換する
- チャンピオンアイコン画像を表示する
- 自分のターンをより目立たせる
- 味方/敵構成をAI用の構造化データに変換する
- OpenAI API連携用の安全な設計を追加する
- Windows向けスタンドアロン配布用に `electron-builder` を追加する
