# LCU Match History Design

## 目的

この文書は、Riot API を使わずに LCU API から自分の試合履歴を取得し、ChampionPool やドラフト推薦に利用するための設計方針をまとめる。

初期方針は **LCU-first** とする。Riot API は将来の任意拡張とし、最初の戦績取得・分析・表示は LoL クライアントが起動している状態で LCU から取得できる情報だけで成立させる。

主な目的:

- 自分の直近試合履歴を取得する
- 自分が使った champion、勝敗、KDA、味方 champion、敵 champion を正規化する
- ChampionPool と照合し、得意 champion の実績を表示する
- 非AIモードの推薦スコアに利用する
- AIモードへ渡す小さな構造化コンテキストを作る

## 前提

LCU は Riot の公開 Web API ではなく、LoL クライアント内部向けのローカル API である。

そのため、次の前提で扱う。

- LoL クライアント起動中、ログイン中のみ利用できる
- API キーは不要
- Riot API の公開レートリミットとは別物
- 仕様変更の可能性があるため、防御的な正規化を行う
- 一度に大量取得せず、少数ページを手動または明示操作で取得する
- 取得した raw response をログに出さない

## 取得対象

初期実装では自分の履歴だけを対象にする。

取得したい情報:

- `gameId`
- 試合開始時刻
- queue / game mode
- 自分の champion
- 自分の role / lane
- 勝敗
- kills / deaths / assists
- 味方 champion
- 敵 champion

リッチなタイムライン、ビルド詳細、ダメージ詳細、ゴールド差などは初期対象外とする。

## LCU Endpoint 候補

試合履歴一覧:

```text
/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=20
```

PUUID が必要な場合の候補:

```text
/lol-match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex=20
```

試合詳細が一覧レスポンスだけでは足りない場合の候補:

```text
/lol-match-history/v1/games/{gameId}
```

実装時には Debug 画面または専用の取得ボタンで実レスポンス形状を確認し、正規化関数をレスポンスに合わせる。

## 取得戦略

20 件ずつページング取得する。

```text
begIndex=0, endIndex=20
begIndex=20, endIndex=40
begIndex=40, endIndex=60
```

初期の最大取得数:

```text
100 matches
```

停止条件:

- 返却件数が 0
- LCU エラー
- 重複 `gameId` を検出
- 最大取得数に到達
- LoL クライアント未起動または未ログイン

ChampSelect 中に重い取得を自動実行しない。初期実装では Debug または ChampionPool の明示ボタンから手動取得する。

手動取得中は、同じ取得ボタンを押せない状態にする。初期実装では既存処理のキャンセルや再開始は行わない。

将来自動更新を追加する場合も、手動取得と自動取得が同時に走らないようにする。

## 取得ステータスと通知

試合履歴の取得、正規化、集計中は、画面上部にかぶる一時的なステータス通知を表示する。

通知はモーダルではない。ユーザー操作をブロックせず、Coach / ChampionPool / Settings / Debug のどの画面でも同じ位置に表示する。

表示位置:

```text
画面上部中央
既存UIの上に少しかぶる
z-index高め
中程度の横幅
```

通知は手動取得だけでなく、将来の自動更新でも同じものを使う。

### status shape

`appState` に `matchHistoryStatus` を持たせる想定。

```js
{
  phase: "idle",
  source: "manual",
  requestedMatches: 100,
  fetchedMatches: 0,
  normalizedMatches: 0,
  updatedMatches: 0,
  failedPages: 0,
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

### phase の意味

```text
idle:
  非表示

collecting:
  LCU match history を取得中

normalizing:
  raw response を正規化中

aggregating:
  champion 別自己戦績を集計中

completed:
  取得、正規化、集計が完了

partial:
  一部ページまたは一部試合の処理に失敗したが、利用可能なデータは更新済み

retrying:
  LCU接続失敗などの一時エラー後、指数バックオフで再試行待ち

error:
  最大リトライ到達、または継続不能なエラー
```

### 表示文言

処理中:

```text
試合データ収集中... 40/100 試合
試合データ整理中...
試合データ集計中...
```

完了:

```text
試合データ収集完了 84試合を更新しました
```

部分成功:

```text
一部の試合データを収集しました 72試合を更新 / 2ページ失敗
```

リトライ中:

```text
LCUに接続できません。10秒後に再試行します
```

最終エラー:

```text
試合データ収集に失敗しました LCUに接続できません
```

### 自動クローズ

```text
completed: 3秒後に自動で閉じる
partial: 5秒後に自動で閉じる
error: 5秒後に自動で閉じる
collecting / normalizing / aggregating: 処理中は表示し続ける
retrying: 次の状態へ遷移するまで表示し続ける
```

エラーも自動で閉じる。閉じたあとも、必要な詳細は Debug 画面やログで確認できるようにする。

### 完了時の件数

完了通知では、取得件数ではなく更新件数を表示する。

```text
updatedMatches
```

同じ `gameId` が既にキャッシュ済みで内容が変わっていない場合、更新件数には含めない。

## LCU 接続失敗時のリトライ

LCU に接続できない場合は、指数バックオフでリトライする。

初期値:

```text
baseDelayMs: 3000
maxDelayMs: 60000
maxAttempts: 5
jitter: 0.8 - 1.2
```

待機時間:

```text
delay = min(maxDelayMs, baseDelayMs * 2 ** retryAttempt) * jitter
```

例:

```text
1回目: 約3秒後
2回目: 約6秒後
3回目: 約12秒後
4回目: 約24秒後
5回目: 約48秒後
```

リトライ中は `matchHistoryStatus.phase = "retrying"` にし、`nextRetryAt` を設定する。

最大リトライに到達したら `phase = "error"` にし、5秒後に通知を閉じる。

### リトライ対象

```text
lockfileなし
LCU接続情報なし
ECONNREFUSED
ECONNRESET
ETIMEDOUT
EPIPE
LCU request timed out
HTTP 5xx
```

### リトライ対象外

```text
正規化ロジックのバグ
JSON parse失敗が継続する
ユーザーがキャンセルした
想定外レスポンスで処理継続できない
```

ただし、1試合単位の正規化失敗は全体失敗にしない。該当試合をスキップし、`partial` として扱う。

## 保存ファイル

保存先は Electron の `app.getPath('userData')` 配下とする。

```text
lcu-match-history-raw.json
match-history.json
```

`lcu-match-history-raw.json` は開発・調査用の短期キャッシュ。ログには出さない。

`match-history.json` はアプリが通常利用する正規化済みデータ。

## データフロー

```text
LCU Match History
  -> Raw Match History Cache
  -> Normalized Match Records
  -> Player Champion Stats
  -> Draft Recommendation Inputs
  -> 非AIモード / AIモード
```

## 正規化済み Match Record

初期形:

```js
{
  gameId: 1234567890,
  gameCreation: 1710000000000,
  queueId: 420,
  gameMode: "CLASSIC",
  gameDuration: 1800,
  gameVersion: "16.12.1",

  self: {
    puuid: "...",
    summonerId: 12345,
    championId: 103,
    championName: "Ahri",
    teamId: 100,
    position: "MIDDLE",
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

LCU のレスポンス形状差分に備えて、複数キーで自分を探す。

優先順:

```text
participant.puuid === currentSummoner.puuid
participant.summonerId === currentSummoner.summonerId
participant.accountId === currentSummoner.accountId
```

自分が見つからない試合は、正規化失敗としてスキップし、件数だけ記録する。

自分が見つかったら:

```text
self.teamId と同じ participant -> allies
self.teamId と違う participant -> enemies
```

## 防御的なフィールド抽出

LCU の match history は公開 API ほど安定していないため、正規化関数では複数候補を見る。

例:

```js
const kills =
  participant.stats?.kills ??
  participant.kills ??
  0;
```

対象:

- champion id
- champion name
- team id
- position / lane / role
- win
- kills
- deaths
- assists
- game creation
- queue id

## Champion Stats

正規化済み match records から champion ごとに集計する。

```js
{
  championId: 103,
  championName: "Ahri",
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

## ChampionPool との照合

ChampionPool はユーザーが使える champion の主観的制約として扱う。

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

Viktor
4戦 50% / 平均KDA 2.1 / サンプル少
```

非AIモードは速く、安く、再現性がある。AIモードを使わない場合でも、これだけで実用的な推薦を成立させる。

## AIモード

AIモードは raw match history を直接渡さない。

アプリ側で候補を絞り、集計済みの小さな context だけを渡す。

例:

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

非AIモードが出した候補・スコア・根拠を、ユーザーに分かりやすい言葉へ変換する。

## UI 方針

### ChampionPool

登録済み champion に戦績情報を添える。

```text
Ahri
18戦 61% / 平均KDA 3.6 / 直近5戦 3勝2敗
```

### Coach

ChampSelect 中に候補ランキングを表示する。

```text
おすすめ候補
1. Ahri 18戦 61% KDA 3.6
2. Viktor 4戦 50% KDA 2.1
3. Orianna 2戦 100% サンプル少
```

AIモードでは同じ候補を使い、短い説明文を追加する。

## 初期実装順

1. Debug に `自分の戦績を取得` ボタンを追加する
2. `lcu-match-history.js` を作る
3. LCU match history を 20 件ずつ取得する
4. raw response を `lcu-match-history-raw.json` に保存する
5. 正規化関数を作る
6. `match-history.json` に正規化済みデータを保存する
7. champion ごとの集計関数を作る
8. ChampionPool 表示に戦績を追加する
9. Coach の ChampSelect に非AI候補ランキングを追加する
10. AIモード用 context builder を追加する

## 注意点

- LCU match history の大量自動取得は避ける
- ChampSelect 中に重い取得処理を走らせない
- raw response を Debug state に常時出さない
- LCU password や Basic 認証ヘッダをログに出さない
- 自動ピック、自動BAN、自動ドッジには使わない
- 自分以外のプレイヤー履歴取得は初期対象外

## 将来拡張

- Riot API Match-V5 fallback
- LoL未起動時の履歴取得
- より長期のローカルキャッシュ
- パッチ別の自己成績
- role 別の自己成績
- ChampionPool の得意度、練習中、封印中フラグ
- AIモードの比較説明
