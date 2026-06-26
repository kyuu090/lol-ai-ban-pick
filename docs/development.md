# Development Guide

この文書は、LoL AI Draft Coach の開発者向けメモです。利用者向けの概要と使い方は `README.md` を参照してください。

## セットアップ

```bash
npm ci
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

## 開発フロー

通常の開発は、`main` から作業ブランチを作って Pull Request で取り込む流れにします。

```bash
git checkout main
git pull
git checkout -b feature/<topic>
```

実装中は、影響範囲に応じて `npm test` と `npm run build` を手元で確認します。小さなロジック変更であれば `npm test` を必須、Electron の起動・パッケージング・配布物に関わる変更であれば `npm run build` まで確認します。

Pull Request は `main` 向けに作成します。PR 作成・更新時には GitHub Actions で以下が実行されます。

- `Build`: `npm test`、Windows portable exe / NSIS installer のビルド、artifact 保存
- `Security Scan`: `npm audit` と CodeQL

CI がすべて通り、レビューで問題がなければ `main` に merge します。`main` への push 後にも `Build` と `Security Scan` が実行されるため、merge 後の状態も確認できます。

## GitHub Actions

`.github/workflows/` 配下に CI / Release 用 workflow を置きます。

- `build.yml`: PR、`main` push、手動実行でテストと Windows portable exe / NSIS installer のビルドを実行し、確認用 artifact として 3 日間保存します。
- `security-scan.yml`: PR、`main` push、週次、手動実行で依存関係と静的解析の脆弱性診断を実行します。
- `release.yml`: `v*` タグ push で Windows portable exe / NSIS installer をビルドし、GitHub Release に添付します。

GitHub Actions では lockfile を前提にするため、依存関係の復元は `npm ci` を使います。

## Windows ビルド

スタンドアロン実行できる portable exe と NSIS installer を作る場合は次を使います。

```bash
npm ci
npm run build
```

生成物:

```text
dist/BanPick-ai-0.1.3-portable.exe
dist/BanPick-ai-0.1.3-setup.exe
```

依存関係を `package-lock.json` どおりに復元してからビルドする一括コマンド:

```bash
npm run build:locked
```

展開済みアプリ一式を確認したい場合は次を使います。

```bash
npm run pack
```

生成物:

```text
dist/win-unpacked/LoL AI Draft Coach.exe
```

同じく lockfile どおりに復元してから pack する場合:

```bash
npm run pack:locked
```

このプロジェクトでは未署名ビルドでも Windows exe のリソース編集は有効にします。`win.icon` と `nsis.installerIcon` / `nsis.uninstallerIcon` に `assets/icon.ico` を指定し、portable exe、NSIS installer、インストール後のアプリ exe のアイコンを揃えます。

`signAndEditExecutable: false` を指定すると exe のリソース編集も無効になり、インストール後のアプリ exe やショートカットが Electron のデフォルトアイコンになることがあります。

## リリース手順

リリースは `main` に取り込まれた commit から行います。GitHub Release は `v*` タグを push したタイミングで自動作成します。

1. リリース対象の変更を PR 経由で `main` に merge します。
2. `package.json` の `version` を次のバージョンに更新します。
3. バージョン更新も PR 経由で `main` に merge します。
4. `main` を最新化し、リリースタグを作成して push します。

```bash
git checkout main
git pull
git tag v0.1.1
git push origin v0.1.1
```

タグ名は `package.json` の `version` と一致させます。例えば `version` が `0.1.1` の場合、タグは `v0.1.1` にします。

タグ push 後、`Release` workflow が次を実行します。

- `npm ci`
- `npm test`
- `npm run build`
- `dist/*.exe` を GitHub Release に添付
- GitHub の自動生成リリースノートを作成

成果物は `package.json` の `build.portable.artifactName` / `build.nsis.artifactName` に従い、`BanPick-ai-<version>-portable.exe` と `BanPick-ai-<version>-setup.exe` として生成されます。

リリース作成後は、GitHub Release の内容、添付された exe、リリースノートを確認します。未署名 exe のため、利用者環境では Windows SmartScreen の警告が出る可能性があります。

## Windows Defender / SmartScreen 対策

未署名の Windows exe / installer は、配布直後やダウンロード数が少ない間に Microsoft Defender、SmartScreen、Smart App Control で警告や誤検知の対象になる可能性があります。これは配布ファイルの内容だけでなく、署名、配布元、ダウンロード実績、ファイルの評判にも影響されます。

当面の方針:

- GitHub Release から配布し、配布元を固定します。
- リリースタグ、`package.json` の `version`、exe のファイル名を一致させます。
- Release note に変更内容を残し、利用者が出所と内容を確認できるようにします。
- Defender で実際に誤検知された場合のみ、Microsoft Security Intelligence の submission portal から `Incorrectly detected as malware/malicious` として申請します。
- CI/CD から submission portal へ毎ビルド自動申請する仕組みは、公式に安定した API と認証方式を確認できるまで入れません。

長期的には、配布用 exe へのコード署名を検討します。コード署名証明書を使うと、発行元の識別と評判の蓄積がしやすくなり、SmartScreen 警告を減らせる可能性があります。ただし証明書の費用、秘密鍵の保管、GitHub Actions での署名手順、更新時の運用が必要になります。

## 実装概要

- Electron のメインプロセスは `main.js` です。
- Renderer は `index.html`, `renderer.js`, `draft-logic.js`, `styles/` です。
- Renderer から Node.js API を直接触らないように、`preload.js` と `contextBridge` で必要な IPC だけ公開しています。
- `main.js` で LCU lockfile を読み、REST API 初期取得と `OnJsonApiEvent` の WebSocket 購読を行います。
- `main/settings-store.js` は settings の default / normalize / load / save / public settings 作成を担当します。
- `main/champion-pool-store.js` は ChampionPool の load / save を担当します。
- `main/match-history-store.js` は PUUID 別 match history / cache path と JSON read / write を担当します。
- `main/app-state.js` は initial state、match history status / summary、lane matchup analysis state、state patch を担当します。
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
- `docs/bff-design.md`: Riot API / OpenAI API の秘密鍵、課金防御、BFF 全体設計
- `docs/bff-phase1-prompt.md`: Riot API allowlist proxy の Phase 1 実装プロンプト

## 重要な実装メモ

- `fetch` に戻さないこと。LCU 自己署名証明書で REST 取得が壊れる可能性があります。
- `nodeIntegration` を有効化しないこと。
- Renderer に `ipcRenderer` を直接公開しないこと。
- LoL 未起動状態でもクラッシュさせないこと。
- ロビー未参加やチャンピオン選択外の `404/null` は正常系として扱うこと。
- gameflow phase が `ChampSelect` 以外になったら古い `champSelect` state を残さないこと。
- LCU への画像取得を一気に大量実行しないこと。
- Riot API token、LCU password、Basic 認証ヘッダをログ、Renderer、Debug state に出さないこと。
- 配布する Electron クライアントに開発者側の Riot API key / OpenAI API key を同梱しないこと。外部 API は BFF 経由にする。
- recent 自動取得で season 取得済みの `match-history/<account-puuid>.json` を 90 件に縮めないこと。
- match history の ID 結合は重複排除し、同一 matchId を二重集計しないこと。
