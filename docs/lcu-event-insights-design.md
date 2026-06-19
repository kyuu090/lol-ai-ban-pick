# LCU Event Insights Design

## 目的

この文書は、`debug.old.log` の LCU WebSocket event から見えた endpoint と、それを使ってバンピック中・試合中・試合終了後に表示できそうなインサイトをまとめる。

Riot API Match-V5 は自己戦績の本線として使い、LCU event はリアルタイム状態の検知と UI 切り替えに使う。

このアプリは情報表示と提案のみを行い、自動ピック、自動BAN、自動ドッジ、ゲームプレイ操作には使わない。

## 調査ログ

対象:

```text
debug.old.log
```

確認できた主な event 件数:

```text
/lol-champ-select/v1/session                   120
/lol-champ-select/v1/summoners/{cellId}        250
/lol-gameflow/v1/session                        94
/lol-gameflow/v1/gameflow-phase                 38
/lol-matchmaking/v1/ready-check                 16
/lol-matchmaking/v1/search                      76
/lol-pre-end-of-game/v1/currentSequenceEvent    10
/lol-end-of-game/v1/eog-stats-block              6
/lol-lobby/v2/lobby/countdown                    6
```

ログは主に URI と eventType を出している。現在のログでは、各 event の `data` の要約が十分に残っていないため、今後は対象 endpoint に限って安全な要約ログを追加すると調査しやすい。

## Champion data と role 情報の調査

`debug.log` へ一時的に payload sample を出して、`/lol-game-data/assets/v1/champion-summary.json` の内容を確認した。

確認した `champion-summary.json` の root key:

```text
alias
contentId
description
id
name
roles
squarePortraitPath
```

サンプル:

```js
{
  id: 1,
  alias: 'Annie',
  roles: ['mage', 'support']
}

{
  id: 2,
  alias: 'Olaf',
  roles: ['fighter', 'tank']
}
```

結論:

- `champion-summary.json` には `roles` がある。
- この `roles` は `mage` / `support` / `fighter` / `tank` のようなチャンピオンクラス分類であり、`TOP` / `JUNGLE` / `MIDDLE` / `BOTTOM` / `UTILITY` のような主流レーン情報ではない。
- そのため、LCU の `champion-summary.json` だけでは「チャンピオンごとに主に使われているロール」は判定できない。
- 主流レーンを使う場合は Riot API Match-V5 の `teamPosition` / `individualPosition` から自前集計するか、外部メタ統計または静的マップを別途持つ必要がある。

`/lol-champ-select/v1/grid-champions/{championId}` についても一時ログを入れたが、確認時は `gameflowPhase: 'None'` かつ `/lol-champ-select/v1/session` が 404 で、追加後の `grid-champions` payload sample は取得できなかった。Champ Select 中に再調査する場合は、対象 endpoint の `data` を数件だけ要約ログに出す。

## 使えそうな endpoint

### `/lol-gameflow/v1/gameflow-phase`

現在のフェーズ判定に使う。

確認済み:

```text
Lobby
None
InProgress
```

用途:

- ChampSelect / InProgress / post-game への切り替え
- InProgress 中の試合中画面表示
- 試合終了後の Riot API 自動更新トリガー

### `/lol-gameflow/v1/session`

gameflow 全体の状態を持つ endpoint。phase だけで足りない場合の補助に使う。

用途:

- 試合開始・終了検知の補強
- post-game 遷移の判定
- phase event が欠けた場合の fallback

### `/lol-champ-select/v1/session`

バンピック全体の状態。

用途:

- 味方/敵チーム
- bans
- pick intent
- actions
- timer phase（表示用カウントダウンは出さない）
- localPlayerCellId
- 自分の操作待ち判定
- ChampionPool候補の BAN済み/選択済み除外

現行アプリでは Draft の ChampSelect UI で利用中。

### `/lol-champ-select/v1/summoners/{cellId}`

ChampSelect 中の各プレイヤー情報。

用途:

- cellId ごとの補助情報
- 将来的なプレイヤー単位表示
- summoner profile / icon / name などの補完

注意:

- 個人情報に近い情報を含む可能性があるため、Debug state やログに常時出さない。

### `/lol-matchmaking/v1/search`

キュー検索中の状態。

用途:

- Searching 表示
- 経過時間
- 推定待ち時間
- queue 情報

ログでは約1秒ごとに Update が来ていたため、UI反映では debounce / 必要フィールドだけの更新が望ましい。

### `/lol-matchmaking/v1/ready-check`

マッチ成立後の Ready Check 状態。

用途:

- Match found 表示
- 自分/全体の承認状態
- Ready Check が消えた後の ChampSelect 遷移補助

### `/lol-lobby/v2/lobby/countdown`

ロビー内カウントダウン。

用途:

- キュー開始前後の短いカウントダウン表示
- party / lobby 状態の補助

### `/lol-pre-end-of-game/v1/currentSequenceEvent`

試合終了直後の進行イベント。

用途:

- 試合終了直後の post-game sequence 検知
- `Game ended. Match data will update shortly.` のような表示
- Riot API Match-V5 の自動更新を少し遅らせる判断材料

### `/lol-end-of-game/v1/eog-stats-block`

試合後統計ブロック。

用途:

- post-game stats 画面の検知
- 勝敗/KDAなどの終了後サマリ候補
- Riot API更新導線

注意:

- 現時点ではこの endpoint の data shape をアプリで正規化していない。
- Riot API Match-V5 の match detail と突き合わせる場合、match id / game id の対応を確認する必要がある。

### `/lol-honor-v2/...`

Honor 画面の状態。

確認できた例:

```text
/lol-honor-v2/v1/ballot
/lol-honor-v2/v1/recognition
/lol-honor-v2/v1/recipients
/lol-honor-v2/v1/latest-eligible-game
```

用途:

- post-game 中であることの補助判定
- Riot API 自動更新タイミングの遅延判断

## APIを使ったインサイト案

### 試合中の自分ピックカード

対象:

```text
/lol-gameflow/v1/gameflow-phase
/lol-gameflow/v1/session
/lol-champ-select/v1/session
Riot API Match-V5 正規化済み自己戦績
```

InProgress 中に、ドラフト時点で確定した自分の champion / role / 自己戦績を固定表示する。

例:

```text
Current Game
Lee Sin / JUNGLE
12games
Ave KDA 6.1/4.2/8.8
7W/5L WR 58%
```

リアルタイム戦闘情報ではないが、試合中に自分の得意度やサンプル数を見返せる。

### ドラフトメモ

対象:

```text
/lol-champ-select/v1/session
match-history/{localPuuid}.json
ChampionPool
```

ChampSelect で確定した味方/敵 champion を、InProgress 中も保持して表示する。

候補:

- 自分の champion のロール別自己戦績
- 敵同ロール champion への過去実績
- 味方 champion との同時ピック実績
- ChampionPool候補の中で、選ばなかった候補との比較

例:

```text
Draft notes
- Ahri vs Syndra: No games
- Ahri + Vi: 3games 67% WR
- Best pool alternative was Orianna: MID 12games WR 58%
```

注意:

- 直近90件では組み合わせ実績が薄いので、games 数と `Low sample` を必ず表示する。
- サンプルがない場合は推測しすぎない。

### キュー中ステータス

対象:

```text
/lol-matchmaking/v1/search
/lol-matchmaking/v1/ready-check
/lol-lobby/v2/lobby/countdown
```

キュー中・Ready Check 中に状態表示する。

例:

```text
Searching Ranked Solo
Elapsed 1:42
Estimated 2:10

Match found
Waiting for players
```

注意:

- `/lol-matchmaking/v1/search` は頻繁に Update が来るため、ログ出力や state 更新は抑制する。

### 試合終了後サマリ

対象:

```text
/lol-pre-end-of-game/v1/currentSequenceEvent
/lol-end-of-game/v1/eog-stats-block
/lol-honor-v2/...
Riot API Match-V5
```

試合終了直後に、試合データ更新待ちと簡易サマリを表示する。

例:

```text
Game ended
Match data will update shortly
```

Riot API Match-V5 の取得後に、今回の試合が `match-history/{localPuuid}.json` に入ったか確認し、ChampionPool / role別stats を更新する。

## 次の調査・実装候補

### 安全な event data 要約ログ

現在のログは URI と eventType が中心で、data の中身が見えにくい。

次の endpoint に限って、秘密情報や巨大payloadを避けた要約ログを追加するとよい。

```text
/lol-gameflow/v1/gameflow-phase
/lol-gameflow/v1/session
/lol-matchmaking/v1/search
/lol-matchmaking/v1/ready-check
/lol-champ-select/v1/session
/lol-pre-end-of-game/v1/currentSequenceEvent
/lol-end-of-game/v1/eog-stats-block
```

ログ例:

```js
{
  uri: "/lol-gameflow/v1/gameflow-phase",
  phase: "InProgress"
}

{
  uri: "/lol-champ-select/v1/session",
  localPlayerCellId: 3,
  myTeamCount: 5,
  theirTeamCount: 5,
  actionCount: 20,
  timerPhase: "BAN_PICK"
}
```

### InProgress画面

最初に実装するなら、InProgress 中に「今回の自分ピックカード」を表示するのが安全で効果が大きい。

理由:

- 既存の ChampSelect state と match-history stats だけで作れる
- Live Client Data API に踏み込まずに済む
- 自動操作に触れない

### Live Client Data API は別設計

リアルタイムの KDA / CS / level / items を出すなら、LCU ではなく次の Live Client Data API が候補になる。

```text
https://127.0.0.1:2999/liveclientdata/...
```

これは別APIであり、実装する場合は別途設計する。

注意:

- 表示専用に限定する
- ゲームプレイ操作や自動判断には使わない
- APIが使えない状態でもアプリを壊さない
