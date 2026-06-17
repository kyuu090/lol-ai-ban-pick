# LoL AI Draft Coach

League of LegendsクライアントのローカルAPIであるLCU APIを読み取り、ロビー、チャンピオン選択、サモナー、gameflow phaseをElectron画面に表示するMVPです。

このアプリは情報表示のみを行います。自動ピック、自動BAN、自動ドッジ、ゲーム操作、メモリ読み取り、クライアント改ざんは行いません。

## セットアップ

```bash
npm install
npm start
```

開発時にDEBUGログを出しながら起動する場合は次を使います。

```bash
npm run dev
```

`npm run dev` はログレベルをDEBUGにしてElectronを起動し、実行ディレクトリ直下の `debug.log` にログを追記します。`debug.log` は `.gitignore` 対象です。

## テスト

```bash
npm test
```

Node.js 標準の `node:test` で、LCU lockfile のパース、認証ヘッダ生成、チャンピオン一覧の正規化、ドラフト表示用の BAN 集計・ターン判定・表示状態判定を確認します。

## 使い方

1. League of Legendsクライアントを起動してログインします。
2. このアプリを `npm start` で起動します。
3. ロビーやチャンピオン選択画面に入ると、LCU REST APIとWebSocket経由で状態が表示されます。
4. `ChampionPool` タブで、レーンごとの得意チャンピオンを登録できます。
5. 必要に応じてDebug画面の「手動再取得」を押してください。

## ChampionPool

`ChampionPool` タブでは、レーン別に自分の得意チャンピオンを登録できます。

- レーンは `TOP / JG / MID / BOT / SUP` のタブで切り替えます。
- チャンピオン画像と名前のギャラリーからクリックで追加します。
- チャンピオン名、alias、titleで検索して候補を絞り込めます。
- 登録済みチャンピオンは上部に表示され、削除できます。
- `保存` ボタンでローカルファイルに保存します。

チャンピオン一覧とアイコンはLCUの `champion-summary` と `champion-icons` から取得します。アイコン取得は表示中の画像を中心に少数並列で行い、LCUへ大量リクエストを投げないようにしています。

## 保存ファイル

設定とChampionPoolはElectronの `app.getPath('userData')` 配下に保存します。Windowsでは通常、次のような場所です。

```text
C:\Users\<ユーザー名>\AppData\Roaming\lol-ai-draft-coach\
```

保存ファイル:

```text
settings.json
champion-pool.json
```

`settings.json` にはLoLインストールディレクトリに加えて、将来のRiot API連携用の開発者トークンとRegionを保存できます。トークン本文はDebug画面のstate表示には出しません。

当面の試合履歴取得はRiot APIではなくLCU match historyを優先します。Riot APIのRegionは `JP1` などのplatform routing valueとして保存し、将来Match-V5などregional routingを使うAPIでは、保存したRegionから `ASIA` / `AMERICAS` / `EUROPE` / `SEA` を導出します。

## LCU lockfile

標準パスは次の場所です。

```text
C:\Riot Games\League of Legends\lockfile
```

lockfileにはLCU APIの接続に必要なport、password、protocolが含まれます。LoLクライアントが起動していない、またはログインしていない場合、このファイルが存在せず接続できません。

## LCU APIの手動確認

PowerShellでlockfileから接続情報を読み取り、LCU APIへ手動リクエストできます。

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

PowerShellでは `"$protocol://..."` のように書くと `:` が変数名の一部として解釈される場合があるため、`${protocol}` のように変数名を明示します。

```powershell
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-lobby/v2/lobby" -Headers $headers -SkipCertificateCheck
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-champ-select/v1/session" -Headers $headers -SkipCertificateCheck
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-summoner/v1/current-summoner" -Headers $headers -SkipCertificateCheck
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-gameflow/v1/gameflow-phase" -Headers $headers -SkipCertificateCheck
```

JSONとして見やすく表示する例です。

```powershell
Invoke-RestMethod "${protocol}://127.0.0.1:${port}/lol-gameflow/v1/gameflow-phase" -Headers $headers -SkipCertificateCheck |
  ConvertTo-Json -Depth 20
```

PowerShell 5系などで `-SkipCertificateCheck` が使えない場合は、`curl.exe` を使います。

```powershell
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-lobby/v2/lobby"
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-champ-select/v1/session"
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-summoner/v1/current-summoner"
curl.exe -k -u "riot:$password" "${protocol}://127.0.0.1:${port}/lol-gameflow/v1/gameflow-phase"
```

## 開発メモ

- rendererからNode.js APIを直接触らないように、`preload.js` と `contextBridge` で必要なIPCだけ公開しています。
- `main.js` でlockfileを読み、REST API初期取得と `OnJsonApiEvent` のWebSocket購読を行います。
- `lcu-logic.js` にLCU接続用の純粋関数、`draft-logic.js` にドラフト表示用の純粋関数を切り出しています。
- `logger.js` で `electron-log` を設定し、`npm run dev` では `debug.log` へDEBUGログを出します。
- LCU APIは自己署名証明書を使うため、開発用途としてLCUへのローカル接続だけ証明書検証を緩和しています。
- WebSocketが切断された場合は3秒後に再接続を試みます。
