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

packaged build でもメインプロセスログは常時ローカルへ出力します。Windows では通常、次の場所です。

```text
C:\Users\<ユーザー名>\AppData\Roaming\banpick-ai\logs\debug.log
```

ログが約 5MB を超えると `debug.old.log` へローテーションします。

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
- `release.yml`: `v*` タグ push で Windows portable exe / NSIS installer をビルドし、GitHub Release に auto update 用の `latest.yml` / `setup.exe.blockmap` も添付します。

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
- `dist/*-portable.exe`
- `dist/*-setup.exe`
- `dist/*-setup.exe.blockmap`
- `dist/latest.yml`
- 以上を GitHub Release に添付
- GitHub の自動生成リリースノートを作成

成果物は `package.json` の `build.portable.artifactName` / `build.nsis.artifactName` に従い、`BanPick-ai-<version>-portable.exe` と `BanPick-ai-<version>-setup.exe` として生成されます。NSIS installer 向けには `latest.yml` と `BanPick-ai-<version>-setup.exe.blockmap` も生成され、auto update 配布物として GitHub Release に含めます。

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
- `main/window.js` は BrowserWindow 作成と window 操作 IPC handler を担当します。メインウィンドウは起動時に `minWidth` と同じ横幅で開き、現在は `1200px` を最小横幅として初期表示しています。
- packaged build では `main/window.js` が `dist-app/index.html` と `dist-app/splash.html` の絶対パスを使って読み込みます。相対パスの `index.html` を直接 `loadFile` しないこと。
- `main/auto-update-service.js` は起動前スプラッシュ上での更新確認、`latest.yml` 取得失敗時の通常起動フォールバック、更新ダイアログ、ダウンロード後の install を担当します。
- `main/ipc-handlers.js` は Renderer 向け IPC channel 登録を担当します。
- 起動時アップデート確認の配信先は `https://update.banpick-ai.lol/app` で固定です。packaged build の `resources/app-update.yml` も同じ URL を向く前提です。
- タブ列の上にあるクライアントバージョン表示は `package-lock.json` の `packages[""].version` を参照し、ビルド時に `dist-app/package-lock.json` へ同梱した値を preload 経由で Renderer に渡します。
- packaged build のクライアントバージョン表示は `app.getVersion()` を優先し、開発時だけ `dist-app/package-lock.json` を補助的に参照します。
- `main/ai-analysis-service.js` は OpenAI / BFF analysis request を担当します。
- `main/riot-match-history-service.js` は Riot BFF の match id / match detail 取得を担当します。
- `main/lcu-client.js` は lockfile 読み取り、LCU REST request、champion icon 取得を担当します。champion icon は通常 `/lol-game-data/assets/v1/champion-icons/<id>.png` を使い、LCU 未接続時や icon endpoint が一時的に失敗している間は Data Dragon へフォールバックします。champion 名も `championsById` が LCU から取れない場合は Data Dragon の champion catalog で補完します。
- `main/lcu-watch.js` は LCU WebSocket 接続、購読、再接続、lockfile retry timer を担当します。
- `lcu-logic.js` に LCU 接続用の純粋関数、`draft-logic.js` にドラフト表示用の純粋関数を切り出しています。
- `riot-api.js` は Riot API 用の request / retry 基盤です。
- `riot-match-history.js` は Match-V5 response の正規化と自己戦績集計を担当します。
- `ui/champions-view.ts` は StatsAPI のメタ情報 / チャンピオン一覧 / チャンピオン詳細画面を担当します。Champions タブでは上部フィルターを保持したまま、一覧行クリックで `/v1/stats/positions/{position}/champions/{championId}/details` を再取得して詳細表示します。詳細表示中は `Lane` の右に対面チャンピオンの単一選択プルダウンを表示し、日本語名と英語 alias の両方で検索できます。候補行だけでなくプルダウンの選択済み表示にもチャンピオンアイコンを出し、フィルタ上のアイコンは候補一覧より少し大きめに表示します。詳細を一覧から開くたび対面チャンピオンは `指定なし` にリセットされ、選択時は `opponentChampionId` を付けて detail API を再取得します。StatsAPI への通信中は `ロード中です` のような本文テキストを差し込まず、Champions パネル全体に中央が最も濃く外側に向かって透けていく黒い loading overlay と中央の `Now loading ...` 表示を出します。フィルタ下の status 行は通常は隠し、エラーや入力不足など補助メッセージがあるときだけ表示します。詳細画面でも通信中の補助テキストは差し込まず、取得済み内容をそのまま見せたまま更新します。直近 60 秒以内の同一クエリが renderer 側キャッシュにある場合は、この loading overlay を出さずにそのまま画面表示します。ルーン画像と日本語名は Data Dragon の `runesReforged.json` を `ja_JP` で取得し、keystone / rune / style の表示に使います。スキル画像は別系統として Data Dragon の champion spell metadata をチャンピオンごとに取得してキャッシュし、`Lv1-6` と `優先スキル` の両方で利用します。取得に失敗した場合は既存の `Q/W/E/R` 文字表示へフォールバックし、取得できた画像は大きめに表示します。`Lv1-6` はレベル行とスキル行をそろえた2段レイアウトで表示します。詳細画面のルーンセットはゲーム内ルーンページ寄せの2系統表示で、選択済みルーンのみ明るく、未選択はグレーアウトします。ルーンセットカードでは見出しと `Set1` / `Set2` タブを同じ行に置いて、カード上端の縦余白を増やさず候補切り替えできるようにしています。キーストーン自体は上部のキーストーン選択で見せるため、ルーンセットカード側では主系統・副系統どちらのツリーでもキーストーン行を省略し、サブルーン中心に表示します。カード、余白、アイコン、メトリクスは一覧より高密度な表示に調整しており、推奨アイテムビルドは `WR / Games` のみを残して `PR` を省略し、サモナースペルも `WR / Games` のみを表示します。アイテム行もアイコン中心で圧縮します。ビルドカードは `開始 / ブーツ / 1st + 2nd / 3rd...` の段階別カラムとして並べ、各段階ラベルは大きな見出しではなく小さめのピル状ラベルとして軽く表示しつつ、一覧性を損なわない文字サイズを確保しています。`firstSecondCoreItems` の 2 アイテムは同じボックスの組み合わせとして扱い、その組み合わせ単位で `WR / Games` を表示します。ブロック間の矢印は出しません。キーストーン候補は同じカード幅の中でアイコンと名前を大きめに見せ、詳細グリッドは `左上: ルーンセット / 左下: サモナースペル / 右側: アイテム / 下段全面: スキル` の配置にしています。スキルカードでは `skillOpenings` を `Lv1-6`、`skillPriorities` を `優先スキル` として分けて表示し、優先スキルは `Q > W > E` のような1行表記にしています。推奨アイテムビルドカードではセクション間隔と行の高さも個別に圧縮し、戻るボタンは詳細ヘッダーではなくフィルター行の右端に配置し、配色もテーマ色へ追従させています。
- `ui/draft-view.ts` は Champ Select の中央カードに、local player の pick 確定後だけ StatsAPI detail を使ったおすすめセットアップを表示します。取得先は Champions タブと同じ `/v1/stats/positions/{position}/champions/{championId}/details` で、返ってきた最大2件のキーストーン候補を中央で切り替えます。ルーンとサモナースペルのカードは、ドラフト専用の別見た目ではなく Champions 詳細画面と同じ `stats-api-*` のカード/タブ/トークン/ルーンツリー構造に寄せています。未確定時は従来どおり `YOUR PICK` / insight 表示を使い、確定後だけ recommendation mode に切り替えます。プレイヤーカードは丸い portrait を置かず、選択中または pick intent のチャンピオン画像をカード背景として使います。背景画像は Draft 画面のプレイヤーカードに限って `championsById` の alias から Data Dragon の `/cdn/img/champion/tiles/{alias}_0.jpg` を優先し、tile が使えない場合だけ `loadChampionIcon()` 経由の LCU `/lol-game-data/assets/v1/champion-icons/<id>.png` または Data Dragon `/cdn/{version}/img/champion/{alias}.png` にフォールバックします。その他の画面の通常アイコン表示は従来どおり `loadChampionIcon()` の LCU icon 取得を使います。`styles/base.css` の `.champion-portrait` は ChampionPool など Draft 以外の通常 portrait 用の共通土台で、Draft の tile 背景分岐とは分離して扱います。プレイヤーカードは縦に少し大きめを維持しつつ、左右カラム自体はさらに細くしています。チャンピオン名または予定表示はカードの縦方向中央に置き、味方は左寄せ、相手は右寄せを維持します。味方カードだけ role badge をカード左下の小さな chip として重ね、相手カードでは position 情報を表示しません。相手側で手動マークした対面カードの `OPPONENT` バッジは文言を固定しつつカード左上へ直接オーバーレイし、テーマ共通色の薄いピルに埋もれないよう専用の濃い塗りと明るい枠線で常に高コントラストを維持します。`YOU` と `OPPONENT` 系バッジはライト/ダーク両方で読める高コントラストのグラデーション pill にしています。ルーンページ内の main / sub / shard とサモナースペル候補は中央カードの横幅を広めに使い、キーストーン以外のルーンとサモナースペル画像も大きめに表示します。ドラフト側では `ルーン` / `サモナースペル` の見出しも CSS で隠しています。ドラフト画面の表示条件は queue 種別ではなく Champ Select の map 判定を優先し、Summoner's Rift (`mapId === 11`) であれば通常 queue / custom match を問わず表示対象にします。
- `match-history-workflow.js` は match history 更新時の ID 結合、重複排除、キャッシュ済み detail 判定を担当します。
- `logger.js` で `electron-log` を設定し、`npm run dev` では実行ディレクトリ直下の `debug.log` へ DEBUG ログを出します。packaged build でも `app.getPath('userData')/logs/debug.log` へ INFO 以上を常時出力し、約 5MB で `debug.old.log` へローテーションします。`render-process-gone`、`did-fail-load`、`preload-error` などの Electron 重要イベントも記録します。

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

REST 通信は `fetch` ではなく `http.request` / `https.request` で実装しています。LCU API は自己署名証明書を使うため、LCU へのローカル接続だけ証明書検証を緩和しています。接続先は lockfile 由来の `127.0.0.1:<port>` で、認証は lockfile の password を使う Basic 認証です。この用途に限定した既知の例外として、該当行には CodeQL の `js/disabling-certificate-validation` 抑制コメントを付けています。

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
C:\Users\<ユーザー名>\AppData\Roaming\banpick-ai\
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
- `docs/draft-locked-pick-mock.html`: ドラフト中に自分のpick確定後、中央へ StatsAPI おすすめを出す UI の静的モック
- `docs/auto-update-design.md`: 起動時アップデート確認と VPS 配信前提の自動更新設計
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
