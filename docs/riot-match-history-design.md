# Riot Match History Design

## 目的

この文書は、Riot API を使って自分の試合履歴を取得し、ChampionPool、非AIモード、AIモードに利用するための設計方針をまとめる。

LCU match history は API キー不要で便利だが、ローカル調査ではページングやキャッシュ挙動が不安定だった。そのため、自己戦績取得の本線は Riot API Match-V5 とする。

主な目的:

- 自分の直近90試合、または今シーズンの全試合を取得する
- match detail をローカルキャッシュする
- 自分が使った champion、勝敗、KDA、味方 champion、敵 champion を正規化する
- ChampionPool と照合し、得意 champion の実績を表示する
- 非AIモードの推薦スコアに利用する
- AIモードへ渡す小さな構造化コンテキストを作る

## 前提

- Riot API token が必要
- Settings で Riot API token と platform region を保存する
- token 本文は Renderer、Debug state、ログに出さない
- Match-V5 は regional routing value を使う
- 日本ユーザーでは基本的に `ASIA` routing を使う
- 429 が返った場合は `Retry-After` ヘッダを優先して待つ
- 取得済み match detail はキャッシュし、再取得しない

## Rate Limit

利用想定の rate limit:

```text
20 requests / 1 second
100 requests / 2 minutes
```

制限は routing value ごとに適用される。

例:

```text
asia
jp1
americas
euw1
```

今回の自己戦績取得では、主に `ASIA` に request が集まる。

## 取得モード

取得モードは2つ持つ。

```text
recent: 直近90試合
season: 今シーズン開始日時以降の全試合
```

`recent` は起動時・試合終了後の自動取得と、ヘッダーの `Download recent match` ボタンで使う。

`season` は `Download recent match` 右側のプルダウン、または取得済み正規化match数が1〜90件のときに表示されるヘッダー導線から手動実行する。match id 一覧を `count=100` でページングし、現在年の `1/1 00:00 JST` を `startTime` として使う。

season手動取得では、match id 一覧の取得までは自動で行い、対象試合数と未取得detail数が分かった時点で確認モーダルを表示する。モーダルでは「シーズン中の全試合データを取得します。この処理は試合数によって時間がかかるケースがあります。あなたの場合、N分程度かかります」という趣旨を表示する。概算時間は未取得detail数を `100 requests / 2 minutes` として粗く計算する。ユーザーがキャンセルした場合、match detail取得には進まず、取得状態はidleへ戻す。

`recent` の想定 request 数:

想定 request 数:

```text
Riot ID -> PUUID: 1 request
match ids取得: 1 request
match detail取得: 最大90 requests

合計: 最大92 requests
```

`100 requests / 2 minutes` に対して 8 requests の余白を残す。

`season` は件数が多くなり得るため、`100 requests / 2 minutes` の上限に近づくまでは高速に取得し、429 を受けたら `Retry-After` に従って待つ。RateLimit待機に入るタイミングでは、すでに取得済みの detail だけで一度正規化・集計・保存し、UIへ反映する。

キャッシュ済み match detail は再取得しないため、2回目以降の実 request 数は少なくなる。進捗表示の分母は、ローカルに存在する試合を除いた「実際に detail request する件数」とする。

例:

```text
match ids: 90取得
未キャッシュ detail: 12件
合計: 14 requests
```

## 統計対象フィルタ

統計に使う試合は **5v5 Summoner's Rift** のみに絞る。

Riot API から取得・キャッシュする match detail は90件分を対象にしてよいが、ChampionPool表示、非AI推薦、AI context に使う集計では次の条件を満たす試合だけを採用する。

```text
mapId === 11
gameMode === "CLASSIC"
queueId is allowed
participant count is 10
```

初期対象 queue group:

```text
ranked_solo: 420
ranked_flex: 440
normal_draft: 400
normal_blind: 430
normal_quickplay: 490
```

初期除外 queue / mode の例:

```text
450: ARAM
1700/1710/1750: Arena
Practice Tool
Custom / Tutorial / Event modes
```

queue ID は Riot 側で変わる可能性があるため、実装時には設定テーブルとして持ち、必要に応じて更新できるようにする。

### Ranked と Normal の分離

Ranked と Normal は同じ champion 実績として混ぜない。

集計では `queueType` と `queueGroup` を持たせる。

```text
queueType: ranked | normal
queueGroup: ranked_solo | ranked_flex | normal_draft | normal_blind | normal_quickplay
```

ChampionPool表示では、初期は両方を見せてもよいが、推薦スコアでは現在のキューに近い `queueGroup` を優先する。

例:

```text
現在のqueueが Ranked Solo/Duo:
  ranked_solo の自己戦績を優先
  ranked_flex / normal 系は参考値として弱く扱う

現在のqueueが Normal Draft:
  normal_draft の自己戦績を優先
  normal_blind / normal_quickplay / ranked 系は参考値として扱う
```

現在の champ select から queue が判定できない場合は、全 5v5 SR 対象をまとめた `all_sr_5v5` を fallback として使う。ただし、表示上は Ranked と Normal の件数・勝率を分けて見せる。

## Routing

Settings には platform routing value を保存する。

```text
JP1
NA1
KR
EUW1
```

Match-V5 では regional routing value を使うため、platform region から自動導出する。

例:

```text
JP1 -> ASIA
KR -> ASIA
NA1 -> AMERICAS
EUW1 -> EUROPE
SG2 -> SEA
```

`riot-api.js` の `createRiotApiHosts` を使って host を作る。

## API Flow

```text
1. Settings の Riot API token を確認
2. LCU current summoner から Riot ID / Tagline とローカル保存用 PUUID を取得
3. Account-V1 で Match-V5 用 PUUID を取得
4. Match-V5 で match id 一覧を取得
5. キャッシュ済み matchId を除外
6. season手動取得では、未取得detail数から概算時間を出して確認モーダルを表示する
7. 未取得 match detail を rate limit 制御下で取得
8. raw match cache に保存
9. match detail を正規化
10. champion ごとの自己戦績を集計
11. UI に反映
```

## Endpoint

Riot ID から PUUID:

```text
GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
```

match id 一覧:

```text
GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=90
```

season の match id 一覧:

```text
GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start={offset}&count=100&startTime={seasonStartUnixSeconds}
```

match detail:

```text
GET /lol/match/v5/matches/{matchId}
```

## Riot ID

初期実装では、LCU current summoner から `gameName` と `tagLine` を取得できる場合はそれを使う。

取得できない場合や手動で別アカウントを指定したい場合は、将来 Settings または Debug に Riot ID 入力欄を追加する。

LCU current summoner は Riot ID / Tagline の取得と、同一PCで複数アカウントを使う場合のローカル保存キーに使う。Match-V5 の `by-puuid` と正規化時の participant 特定には Account-V1 から取得した PUUID を使う。

## Rate Limit 制御

recent では、速度と安全性のバランスとして batch 制御を使う。

```text
matchesPerRun: 90
detailConcurrency: 5
batchDelayMs: 350
maxRequestsPerSecond: 20
maxRequestsPerTwoMinutes: 100
reserveRequestsPerTwoMinutes: 8
```

detail 取得:

```text
5件並列で投げる
350ms待つ
次の5件を投げる
```

概算:

```text
5 requests / 350ms = 約14.3 requests / second
```

`20 requests / 1 second` にかからない速度で、90件を数秒から十数秒程度で取得する。

`100 requests / 2 minutes` については、1回の取得で最大92 requestに抑えることで余白を残す。

season では `detailConcurrency: 5`、batch delay は 0 とし、429 までは高速に取得する。429 では `Retry-After` を待つ。

## 429 Handling

429 が返った場合:

```text
1. Retry-After ヘッダがあれば、その秒数を待つ
2. Retry-After がなければ、2分windowを疑って30〜60秒待つ
3. 連続429では指数バックオフする
```

リトライ中は `matchHistoryStatus.phase = "retrying"` とする。

表示例:

```text
RiotAPIのRateLimitを待機中... (次回取得まで17秒)
```

429 は最終失敗ではなく、基本的には待機して継続する。

ただし、最大リトライを超えた場合は `error` として扱う。

RateLimit 待機に入ったタイミングでは、取得済み detail だけで `match-history` を正規化・集計して保存し、UIへ反映する。detail 5件ごとの途中正規化は行わない。次の途中正規化は次回の RateLimit 待機時、または最終完了時に行う。

## 保存ファイル

保存先は Electron の `app.getPath('userData')` 配下とする。

```text
riot-match-cache/{localPuuid}.json
match-history/{localPuuid}.json
```

`riot-match-cache/{localPuuid}.json` は raw に近い Riot API response を match id 単位で保存する。

```js
{
  version: 1,
  source: "riot-api",
  updatedAt: "2026-06-17T...",
  matchesById: {
    "JP1_1234567890": {
      metadata: {},
      info: {}
    }
  }
}
```

`match-history/{localPuuid}.json` はアプリが通常利用する正規化済みデータ。

ログインしていない状態では試合データをロードしない。LCU接続時または `current-summoner` の更新時に、ログイン中アカウントの `{localPuuid}` に対応する history だけをロードする。LCU切断・ログアウト時は表示中の試合統計をリセットする。

recent 更新では、Riot APIへ問い合わせる match id は直近90件に限定する。ただし正規化・分析対象は「新しく確認した直近90ID + 既存 history の matchId」を重複排除して使う。これにより、一度 season で91件以上を取得した後に起動時の recent 自動取得が走っても、分析対象が90件へ縮まない。

season 更新では、シーズンの match id 全体を正規化・分析対象にする。

```text
riot-match-cache/{localPuuid}.json
  = 過去に取得した raw match detail を matchId 単位で蓄積するキャッシュ

match-history/{localPuuid}.json
  = ログイン中アカウントで使う正規化済み match records と集計データ
```

現時点では `riot-match-cache/{localPuuid}.json` の古い試合は削除しない。将来、`cachedAt` や上限件数/日数による掃除を追加してよい。

```js
{
  version: 1,
  source: "riot-api",
  updatedAt: "2026-06-17T...",
  puuid: "...",
  riotPuuid: "...",
  riotId: {
    gameName: "PlayerName",
    tagLine: "JP1"
  },
  matches: [],
  championStats: []
}
```

## データフロー

```text
Riot API Match-V5
  -> Riot Match Cache
  -> Normalized Match Records
  -> Player Champion Stats
  -> Draft Recommendation Inputs
  -> 非AIモード / AIモード
```

## 正規化済み Match Record

初期形:

```js
{
  matchId: "JP1_1234567890",
  gameCreation: 1710000000000,
  mapId: 11,
  queueId: 420,
  queueType: "ranked",
  queueGroup: "ranked_solo",
  gameMode: "CLASSIC",
  gameDuration: 1800,
  gameVersion: "16.12.1",

  self: {
    puuid: "...",
    championId: 103,
    championName: "Ahri",
    teamId: 100,
    position: "MIDDLE",
    lane: "MIDDLE",
    win: true,
    kills: 8,
    deaths: 2,
    assists: 9,
    kda: 8.5
  },

  allies: [
    { championId: 122, championName: "Darius", position: "TOP" },
    { championId: 64, championName: "Lee Sin", position: "JUNGLE" },
    { championId: 103, championName: "Ahri", position: "MIDDLE" },
    { championId: 202, championName: "Jhin", position: "BOTTOM" },
    { championId: 412, championName: "Thresh", position: "UTILITY" }
  ],

  enemies: [
    { championId: 24, championName: "Jax", position: "TOP" },
    { championId: 121, championName: "Kha'Zix", position: "JUNGLE" },
    { championId: 134, championName: "Syndra", position: "MIDDLE" },
    { championId: 145, championName: "Kai'Sa", position: "BOTTOM" },
    { championId: 111, championName: "Nautilus", position: "UTILITY" }
  ]
}
```

## 自分の Participant 特定

Match-V5 の `metadata.participants` と `info.participants` を使う。

基本は `info.participants[].puuid === targetPuuid` で自分を特定する。

自分が見つかったら:

```text
self.teamId と同じ participant -> allies
self.teamId と違う participant -> enemies
```

## Champion Stats

正規化済み match records から champion ごとに集計する。

現在の実装では、次の粒度で集計する。

```text
championId + queueGroup + all positions
championId + all_sr_5v5 + all positions
championId + queueGroup + position
championId + all_sr_5v5 + position
```

`position === null` は全ロール合算を表す。`position` に `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` などが入る場合は、そのロールで使った試合だけを表す。

```js
{
  championId: 103,
  championName: "Ahri",
  queueType: "ranked",
  queueGroup: "ranked_solo",
  position: "MIDDLE",
  games: 18,
  wins: 11,
  losses: 7,
  winRate: 0.611,
  avgKills: 6.2,
  avgDeaths: 3.8,
  avgAssists: 7.4,
  avgKda: 3.58,
  recentGames: 5,
  recentWins: 3,
  recentWinRate: 0.6,
  lastPlayedAt: 1710000000000,
  positions: {
    MIDDLE: 17,
    UTILITY: 1
  }
}
```

KDA:

```text
kda = deaths === 0 ? kills + assists : (kills + assists) / deaths
```

## 対面別自己実績

正規化済み match records から、自分 champion と同一ロール対面 champion の組み合わせ実績も集計する。

`selfVsLaneOpponentStats` の粒度:

```text
self.position + self.championId + opponentChampionId
```

対面 champion は `record.enemies` のうち、`enemy.position === self.position` の champion だけを採用する。敵チーム全体や別ロール champion は混ぜない。

```js
{
  championId: 103,
  championName: "Ahri",
  opponentChampionId: 134,
  opponentChampionName: "Syndra",
  position: "MIDDLE",
  games: 8,
  wins: 2,
  losses: 6,
  winRate: 0.25,
  avgKills: 5.2,
  avgDeaths: 4.1,
  avgAssists: 7.0,
  avgKda: 2.98
}
```

ChampSelect 中に対面想定プレイヤーをマークした場合は、`opponentChampionId + assignedPosition` でこの集計を絞り込み、勝率の高い自分 champion を `Best into ...` として表示する。表示には W-L / WR / KDA を含める。

BANフェーズ中に自分の予定pickがある場合は、`self.championId === plannedChampionId` かつ `self.position === assignedPosition` に該当する `selfVsLaneOpponentStats` だけを使い、勝率の低い同一ロール対面 champion を `Threats for your ...` として表示する。ここでも敵チーム全体や別ロールには fallback しない。

## ChampionPool との照合

ChampionPool はユーザーが使える champion の主観的制約として扱う。

現在の ChampionPool 表示では、選択中レーンを Riot API の `position` に変換し、その `assignedPosition + championId` に該当するロール別自己戦績だけを表示する。該当ロールのサンプルがない場合、全ロール合算へ fallback せず `No games` と表示する。

```text
top -> TOP
jungle -> JUNGLE
middle -> MIDDLE
bottom -> BOTTOM
utility -> UTILITY
```

表示例:

```text
Games 4
W-L 3-1
WR 75%
KDA 5.2/4.0/8.1
```

ChampionPool画面とバンピック中の候補表示では、戦績はチップで表示する。

ChampSelect 中も、自分の行だけ現在の `assignedPosition + championId` のロール別戦績を表示する。味方全員や敵側には、自分の使用戦績を表示しない。

ChampSelect 中の候補名、`Best into ...`、`Threats for your ...` などの champion 名には、LCU champion icon を小さく帯同表示する。画像取得は既存の icon cache / queue を使い、一度に大量取得しない。

表示・推薦では次を判定する。

- ChampionPool 内で使用実績がある
- ChampionPool 内だが最近使っていない
- ChampionPool 内で勝率が高い
- ChampionPool 外だが実際にはよく使っている
- サンプルが少ないため信頼度が低い

## 非AIモード

非AIモードは、正規化済みデータと集計値を使って deterministic に表示・推薦する。

候補条件:

```text
champion_id is in ChampionPool[currentRole]
champion_id is not picked
champion_id is not banned
```

初期スコア:

```text
score =
  win_rate_score
  + games_confidence
  + recent_win_rate_score
  + kda_score
  - inactivity_penalty
```

表示例:

```text
Ahri
18戦 61% / 平均KDA 3.6 / 直近5戦 3勝2敗
```

## AIモード

AIモードは raw match detail を直接渡さない。

アプリ側で候補を絞り、集計済みの小さな context だけを渡す。

```js
{
  currentRole: "MIDDLE",
  championPoolCandidates: [
    {
      championId: 103,
      name: "Ahri",
      games: 18,
      winRate: 0.611,
      avgKda: 3.58,
      recentWinRate: 0.6,
      score: 82
    }
  ],
  currentDraft: {
    allyChampionIds: [122, 64],
    enemyChampionIds: [134],
    bannedChampionIds: [99, 55]
  }
}
```

AIモードの初期役割は、推薦そのものではなく説明役とする。

## 取得ステータスと表示

試合履歴の取得、正規化、集計中は、ヘッダーの `Download recent match` split button を disabled にし、ヘッダー内の進捗行に `matchHistoryStatus.message` を表示する。

正規化済みmatch数が1〜90件のときは、ヘッダーに `シーズン中データの全取得でサンプル数を増やせる可能性があります` のボタンを表示する。このボタンはseason手動取得を開始する導線で、取得中はdisabledにする。0件、または91件以上では表示しない。

Riot API認証失敗（HTTP 401/403）やトークン未設定で手動取得した場合は、進捗行に `Riot API Tokenが正しく設定されているか確認してください。Settingsタブから確認できます。` を表示する。

`appState` に `matchHistoryStatus` を持たせる想定。

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

`source`:

```text
manual
auto
```

`phase`:

```text
idle
collecting
normalizing
aggregating
completed
partial
retrying
error
```

表示例:

```text
Download recent match
Downloading...
Downloading season...
Saving...
Retrying...
Downloaded 3 matches
Download failed
```

進捗行の表示例:

```text
試合IDリスト取得中... 300 試合
試合データ収集中... 47/210 試合
RiotAPIのRateLimitを待機中... (次回取得まで34秒)
試合データを正規化しています
```

完了/一部完了/エラー時の短い文言は一定時間だけ表示し、その後 `Download recent match` に戻す。同じ完了状態を LCU state 更新のたびに再表示しない。

```text
completed: 3秒後に Download recent match へ戻す
partial: 5秒後に Download recent match へ戻す
error: 5秒後に Download recent match へ戻す
collecting / normalizing / aggregating: 処理中は disabled のまま表示し続ける
retrying: 次の状態へ遷移するまで disabled のまま表示し続ける
```

完了通知では、取得件数ではなく更新件数を表示する。

```text
updatedMatches
```

## 二重起動防止

手動取得中は、同じ取得ボタンを押せない状態にする。

初期実装では既存処理のキャンセルや再開始は行わない。

自動更新でも、手動取得と同じ `matchHistoryInProgress` を使って二重起動を防ぐ。

## 自動更新

現在の実装では、次のタイミングで自動取得を試みる。

```text
起動後、LCU接続に成功してログイン中、Riot API tokenあり、ChampSelect/試合中でなければ約2秒後
アプリ起動後にLoLへログインし、current-summoner更新後に条件を満たせば約2秒後
Riot API token または platform region 保存後、ログイン中で条件を満たせば約2秒後
gameflow phase が GameStart / InProgress から抜けた約20秒後
```

次の条件では自動取得を静かに skip する。

```text
Riot API token 未設定
未ログイン
LCU current summoner から Riot ID を取得できない
ChampSelect / GameStart / InProgress 中
手動または自動取得がすでに進行中
```

ChampSelect 中の LCU WebSocket event、hover、pick intent、pick確定などの操作では Riot API 取得を走らせない。

## 初期実装順

1. `riot-api.js` の request/retry 基盤を使う
2. Riot ID / tagLine から PUUID を取得する
3. recent では match id を90件取得し、season ではシーズン開始以降の match id をページング取得する
4. `riot-match-cache/{localPuuid}.json` を読み込む
5. 未キャッシュ match detail だけを抽出する
6. season手動取得では、ID一覧取得後に対象試合数・未取得detail数・概算所要時間をモーダル表示して確認する
7. recent は 5並列 / 350ms batch delay、season は 5並列 / batch delay なしで detail を取得する
8. 429 では `Retry-After` を優先して待ち、待機開始時に取得済み分を正規化する
9. raw cache を更新する
10. 正規化して `match-history/{localPuuid}.json` に保存する
11. champion ごとの集計関数を作る
12. ChampionPool 表示に戦績を追加する
13. Draft の ChampSelect に非AI候補ランキングを追加する
14. AIモード用 context builder を追加する

## 注意点

- Riot API token をログに出さない
- Riot API token を Renderer や Debug state に返さない
- 取得済み match detail は再取得しない
- recent の取得対象は90試合にする
- season では今シーズンの全match idを取得対象にする
- recent 自動取得で season 取得済みの history を90件へ縮めない
- 統計に使う試合は5v5 Summoner's Riftに限定する
- Ranked と Normal は別の `queueType` として集計する
- queueId は保持し、`queueGroup` で Ranked Solo/Duo、Ranked Flex、Normal Draft、Normal Blind、Quickplay などを分ける
- 429では `Retry-After` を優先する
- 1試合単位の正規化失敗は全体失敗にせず `partial` として扱う
- 自動ピック、自動BAN、自動ドッジには使わない
