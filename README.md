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

Node.js 標準の `node:test` で、LCU lockfile のパース、認証ヘッダ生成、チャンピオン一覧の正規化、ドラフト表示用の BAN 集計・ターン判定・表示状態判定、Riot API retry、試合履歴の正規化・集計、match history 更新時のID重複排除を確認します。

## 使い方

1. League of Legendsクライアントを起動してログインします。
2. このアプリを `npm start` で起動します。
3. ロビーやチャンピオン選択画面に入ると、LCU REST APIとWebSocket経由で状態が表示されます。
4. `ChampionPool` タブで、レーンごとの得意チャンピオンを登録できます。
5. 必要に応じてヘッダーの `Download recent match` で直近試合を取得します。右側のプルダウンから今シーズンの試合データも取得できます。

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
riot-match-cache/<account-puuid>.json
match-history/<account-puuid>.json
```

`settings.json` にはLoLインストールディレクトリに加えて、Riot API連携用の開発者トークンとRegionを保存できます。トークン本文はDebug画面のstate表示には出しません。

試合履歴と自己戦績はRiot API Match-V5を優先して取得します。Regionは `JP1` などのplatform routing valueとして保存し、Match-V5などregional routingを使うAPIでは、保存したRegionから `ASIA` / `AMERICAS` / `EUROPE` / `SEA` を導出します。

Riot APIによる自己戦績取得には、直近90試合を取得する `recent` と、今シーズンの試合を取得する `season` があります。取得済みmatch detailはアカウント別にローカルキャッシュし、再取得しません。

同じPCで複数アカウントを使う場合、ログイン中アカウントの試合データだけを `userData` から読み込みます。未ログイン状態では試合データをロードしません。

Riot APIのRateLimitにかかった場合は `Retry-After` に従って待機し、待機中は取得済み分だけで正規化・集計したデータを利用できます。

統計に使う試合は5v5 Summoner's RiftのRanked / Normal系queueに絞り、Ranked と Normal の自己戦績は分けて扱います。

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
