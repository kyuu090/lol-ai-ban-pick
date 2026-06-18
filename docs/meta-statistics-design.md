# LoL Meta Statistics Design

## 目的

この文書は、LoL AI Draft Coach が ban/pick の判断材料として利用するメタ統計データの設計方針をまとめる。

最初から完全な統計基盤を作るのではなく、Riot API Match-V5 から取得できる自分の直近戦績と、必要に応じた静的 JSON/CSV から始める。将来的に外部集計データや独自集計基盤へ差し替えられる構造を目指す。

主な利用目的は次の通り。

- チャンピオン単体のメタ評価
- レーンごとのチャンピオン強度評価
- チャンピオン対チャンピオンの相性評価
- ユーザー本人の champion 別実績評価
- ユーザーのChampionPoolを踏まえた現実的な推薦候補の絞り込み
- 味方構成と敵構成を踏まえた ban/pick 推薦
- 統計値の信頼度を加味した安全なスコアリング

## 設計思想

### 統計値と判断スコアを分離する

保存するデータは、できるだけ事実に近い統計値に寄せる。

ban/pick のための推薦スコアは、統計値を直接保存するのではなく、アプリ側または集計バッチ側で計算する。

理由:

- スコア計算式を後から変更しやすい
- UI、AI プロンプト、検証バッチで同じ元データを使い回せる
- 「なぜこの champion を薦めたか」を説明しやすい

### 勝率そのものより差分を見る

チャンピオン相性では、単純な勝率よりも `delta_win_rate` を重視する。

例:

```text
Ahri mid overall win rate: 50.5%
Ahri mid vs Syndra mid win rate: 47.2%
delta_win_rate: -3.3%
```

この場合、Ahri は Syndra に対して通常より 3.3 ポイント勝率が落ちている、と解釈する。

相性評価では、チャンピオン自体の基礎勝率が高い/低いことと、特定の対面に強い/弱いことを分けて扱う。

### サンプル数による信頼度を必ず持つ

相性統計は組み合わせ数が多く、サンプル数が少ないデータが大量に出る。

そのため、`games` と `confidence` を必ず保持または計算できるようにする。

例:

```text
confidence = min(1.0, games / 300)
weighted_delta = delta_win_rate * confidence
```

少数試合で極端な勝率が出ても、判断スコアでは弱く扱う。

### パッチ、ロール、ランク帯を分離軸にする

LoL の統計はパッチで大きく変わる。

同じ champion でも role が違えば意味が変わり、rank tier によってもメタが変わる。

最低限、次の分離軸を持つ。

- `patch`
- `role`
- `rank_tier`
- `region`
- `queue_id`
- `queue_type`
- `queue_group`

最初の MVP では `patch` と `role` を最優先にし、`rank_tier` と `region` は `ALL` などの集約値から始めてもよい。

自己戦績では、統計対象を5v5 Summoner's Riftに限定し、Ranked と Normal を分けて扱う。

```text
queue_type: ranked | normal
queue_group: ranked_solo | ranked_flex | normal_draft | normal_blind | normal_quickplay
```

### 最初は同一ロール対面に限定する

初期実装では、相性統計を同一ロール対面に限定する。

- Top vs Top
- Jungle vs Jungle
- Mid vs Mid
- ADC vs ADC
- Support vs Support

Bot lane は本来 `ADC + Support` の 2v2 相性が重要だが、組み合わせ数が大きく増えるため後回しにする。

### 生データ、集計データ、推薦データを分ける

データは次のレイヤーに分ける。

- Raw data: Riot API Match-V5 などから取得した試合そのもの
- Normalized data: アプリで扱いやすい参加者・チーム・ピック情報
- Aggregated stats: champion_stats や matchup_stats
- User preference data: ChampionPool などユーザーが事前登録した利用可能champion情報
- Decision score: ban/pick 推薦用のスコア

Raw data を保存しておくと、集計ロジックを変えたときに再集計できる。

MVP では Riot API Match-V5 から正規化済み自己戦績を作り、外部メタ統計は省略または静的ファイルで持ってもよい。
User preference data は統計値ではないため、メタ統計JSONとは別ファイルに保存する。

## データ構造

### champion_stats

チャンピオン単体のメタ統計。

```text
champion_id
champion_key
champion_name
role
patch
rank_tier
region
queue_id
queue_type
queue_group
games
wins
win_rate
pick_count
pick_rate
ban_count
ban_rate
presence_rate
avg_kda
avg_gold_diff_15
avg_xp_diff_15
updated_at
```

主要な意味:

- `win_rate`: その条件下での勝率
- `pick_rate`: その条件下でのピック率
- `ban_rate`: その条件下での BAN 率
- `presence_rate`: `pick_rate + ban_rate`
- `avg_gold_diff_15`: 15分時点の平均ゴールド差。レーン強度の補助指標
- `avg_xp_diff_15`: 15分時点の平均経験値差。レーン強度の補助指標

最小構成では、次だけでもよい。

```text
champion_id
role
patch
rank_tier
games
wins
win_rate
pick_rate
ban_rate
```

### matchup_stats

チャンピオン対チャンピオンの相性統計。

```text
champion_id
champion_role
opponent_champion_id
opponent_role
patch
rank_tier
region
queue_id
queue_type
queue_group
games
wins
win_rate
baseline_win_rate
delta_win_rate
confidence
weighted_delta_win_rate
updated_at
```

主要な意味:

- `champion_id`: 評価対象の champion
- `opponent_champion_id`: 対面または比較対象の champion
- `win_rate`: 評価対象 champion が opponent に対して勝った割合
- `baseline_win_rate`: 同条件における評価対象 champion の通常勝率
- `delta_win_rate`: `win_rate - baseline_win_rate`
- `confidence`: サンプル数に基づく信頼度
- `weighted_delta_win_rate`: `delta_win_rate * confidence`

相性評価では `weighted_delta_win_rate` を中心に使う。

### duo_matchup_stats

Bot lane など、複数 champion の組み合わせを見るための将来拡張。

初期実装では必須ではない。

```text
ally_champion_1_id
ally_champion_2_id
ally_roles
enemy_champion_1_id
enemy_champion_2_id
enemy_roles
patch
rank_tier
region
queue_id
queue_type
queue_group
games
wins
win_rate
baseline_win_rate
delta_win_rate
confidence
weighted_delta_win_rate
updated_at
```

主な用途:

- ADC + Support vs ADC + Support
- Jungle + Mid vs Jungle + Mid
- Top + Jungle などの gank 相性

### team_synergy_stats

味方構成内の相性を扱うための将来拡張。

```text
champion_id
ally_champion_id
champion_role
ally_role
patch
rank_tier
region
queue_id
queue_type
queue_group
games
wins
win_rate
baseline_win_rate
delta_win_rate
confidence
weighted_delta_win_rate
updated_at
```

主な用途:

- ADC と Support の相性
- Mid と Jungle の相性
- Engage 構成、poke 構成、scaling 構成などの補助評価

### champion_tags

統計だけでは表現しにくい性質を持つ静的マスタ。

```text
champion_id
role
damage_type
range_type
scaling_type
engage
disengage
poke
wave_clear
lane_bully
teamfight
split_push
cc_score
mobility_score
difficulty_score
```

AI に説明させる場合や、統計の薄い champion を補完する場合に使う。

例:

- チームに engage が不足している
- AP damage が不足している
- frontline が不足している
- scaling に寄りすぎて序盤が弱い

### user_champion_pool

ユーザーが事前登録した得意チャンピオン。

これはメタ統計ではなく、推薦候補を現実的な範囲に絞るためのユーザー設定として扱う。

現在のアプリでは次のローカルファイルに保存する。

```text
app.getPath('userData')/champion-pool.json
```

形式:

```json
{
  "top": [122, 103],
  "jungle": [64, 234],
  "middle": [99],
  "bottom": [202],
  "utility": [412]
}
```

意味:

- key: アプリ内のレーンID
- value: そのレーンでユーザーが使える、または得意なchampion id配列

レーンID:

```text
top
jungle
middle
bottom
utility
```

統計データ側の `role` と突き合わせる場合は、必要に応じて次のように変換する。

```text
top -> TOP
jungle -> JUNGLE
middle -> MIDDLE
bottom -> BOTTOM
utility -> UTILITY
```

注意:

- ChampionPoolはユーザーの主観的・実用的な制約であり、勝率やpick率のような統計値ではない
- ChampionPoolに未登録のchampionを完全除外するか、低優先度候補として残すかはUI設定や推薦モードで切り替えられる余地がある
- BAN候補では、ユーザーChampionPoolに強く当たる敵championを優先するための入力として使える

### user_champion_stats

Riot API Match-V5 から作る、ユーザー本人の champion 別実績。

これは全体メタ統計ではなく、ユーザー個人の実績データとして扱う。

```text
champion_id
champion_name
queue_type
queue_group
role
games
wins
losses
win_rate
avg_kills
avg_deaths
avg_assists
avg_kda
recent_games
recent_wins
recent_win_rate
last_played_at
positions
updated_at
```

主な用途:

- ChampionPool内の champion に実績を添えて表示する
- 非AIモードの候補ランキングに使う
- AIモードへ渡す説明用contextに使う
- ChampionPool外だがよく使っている champion を発見する

現在の実装では Riot API から直近90試合、または今シーズンの全試合を取得対象にできる。raw match detail は `app.getPath('userData')/riot-match-cache/{localPuuid}.json` に保存し、正規化済み match records は `app.getPath('userData')/match-history/{localPuuid}.json` に保存する。ログイン中アカウントのデータだけをロードし、未ログイン状態では試合データをロードしない。

集計に使う試合は5v5 Summoner's Riftに限定する。

```text
mapId === 11
gameMode === "CLASSIC"
queue is allowed 5v5 SR ranked/normal queue
participant count === 10
```

Ranked と Normal は混ぜず、`queue_type` 別に集計する。queueId は保持し、`queue_group` で Ranked Solo/Duo、Ranked Flex、Normal Draft、Normal Blind、Quickplay などを分ける。

現在の実装では、ChampionPool と ChampSelect の表示に使うため、`champion_id + queue_group + role` および `champion_id + all_sr_5v5 + role` のロール別集計も作る。`role` がない集計は全ロール合算として扱う。

ChampionPool画面では、選択中レーンに対応する role の自己戦績だけを表示する。該当 role のサンプルがない場合、全ロール合算に fallback せず `No games` と表示する。

ChampSelect中は、自分の行だけ `assignedPosition + championId` の自己戦績を表示する。味方全員や敵側には、自分の戦績を表示しない。

表示例:

```text
Games 4
W-L 3-1
WR 75%
KDA 5.2/4.0/8.1
```

## 推薦スコアの考え方

## ChampSelect 中に表示すると嬉しい情報

現状のアプリが持っている LCU state、ChampionPool、Riot API Match-V5 の正規化済み自己戦績だけでも、バンピック中に次の情報を表示できる。

### すぐ出せる情報

- 自分の現在ロール + hover / pick intent / 確定 champion のロール別自己戦績
- 現在ロールの ChampionPool 候補一覧
- 候補ごとのロール別 games / Ave KDA / WR
- BAN済み / 選択済み champion の候補除外またはグレーアウト
- 自分のターン中だけ候補パネルを強調
- ロール別サンプルがない候補への `No games` 表示
- 少数サンプル候補への `Low sample` 表示

### 正規化済み match-history から作れる情報

- 最近使った ChampionPool 内 champion
- 最近勝っている ChampionPool 内 champion
- ロール別に実績がない ChampionPool champion
- 自分の champion と味方 champion の同時ピック実績
- 自分の champion と敵 champion の対戦実績
- 自分が負けがちな敵 champion の注意表示

同時ピック実績や対敵実績は、直近90件ではサンプルが薄くなりやすい。表示する場合は `Low sample` や games 数を必ず添え、推薦スコアでは弱く扱う。

### 次に実装したい候補パネル

最優先の次実装候補は、バンピック中の自分用 ChampionPool 候補パネル。

```text
Your MID Pool
Ahri        MID 12games  WR 58%  Ave KDA 5.1/3.0/7.2
Syndra      MID 4games   WR 75%  Low sample
Orianna     No MID games
```

仕様案:

- `champSelect.localPlayerCellId` から自分の assignedPosition を取る
- assignedPosition を ChampionPool lane に変換し、そのレーンの登録 champion を候補にする
- BAN済み、味方/敵が確定済みの champion は除外または disabled 表示にする
- 自分が pick 中のときだけ候補パネルを強調する
- 候補はロール別自己戦績を優先して並べる
- ロール別サンプルがない場合は fallback せず `No games`
- サンプルが少ない場合は勝率を強調しすぎず `Low sample` を表示する

この候補パネルは、AI 推薦に進む前の deterministic な非AIモードとして扱う。

### Champion strength score

チャンピオン単体の強さ。

```text
champion_strength_score =
  win_rate_delta
  + pick_rate_score
  + ban_rate_score
  + presence_score
```

`win_rate_delta` は 50% からの差分、または同ロール平均からの差分として扱う。

### Candidate eligibility

ピック推薦では、まずユーザーが現実的に使える候補かどうかを判定する。

```text
is_candidate =
  champion_id is in user_champion_pool[current_role]
  and champion_id is not already picked
  and champion_id is not banned
```

初期実装では、ChampionPoolに登録されているchampionを優先して推薦対象にする。

ChampionPoolが空の場合は、次のどちらかの扱いにする。

- 推薦候補なしとして登録を促す
- 全championを候補にする fallback を使う

AIに説明させる場合は、ChampionPoolによる制約を明示する。

例:

```text
ユーザーのMID ChampionPool: Ahri, Viktor, Orianna
敵MID: Syndra
候補はユーザーChampionPool内に限定
```

### Personal performance score

Riot API Match-V5 から得た自己戦績を使う。

```text
personal_performance_score =
  win_rate_score
  + games_confidence
  + recent_win_rate_score
  + kda_score
  - inactivity_penalty
```

自己戦績はサンプル数が少なくなりやすいため、`games_confidence` を必ず加味する。

例:

```text
games_confidence = min(1.0, games / 10)
```

2戦2勝の champion を過大評価せず、20戦12勝の champion をより安定した実績として扱う。

### Counter score

敵チャンピオンへの相性。

```text
counter_score =
  matchup_weighted_delta_vs_lane_opponent
  + matchup_weighted_delta_vs_enemy_team
```

初期実装では、同一ロールの対面だけを見る。

将来的には敵チーム全体に対する相性も足す。

### Team fit score

味方構成との噛み合い。

```text
team_fit_score =
  synergy_with_allies
  + composition_balance
  + missing_role_utility
```

例:

- 味方に engage がないなら engage champion を加点
- 味方が AD に偏っているなら AP champion を加点
- 味方が序盤寄りなら scaling を少し加点

### Ban priority score

BAN 候補の優先度。

```text
ban_priority_score =
  enemy_champion_strength
  + threat_to_our_hovered_or_picked_champions
  + enemy_likely_pick_score
  + meta_presence_score
```

主な考え方:

- 敵に取られると強い champion
- 味方予定 pick に強く当たる champion
- ユーザーChampionPool内の候補に強く当たる champion
- 現メタで pick/ban 率が高い champion
- 敵のロール状況から選ばれそうな champion

## JSON 形式の初期案

静的ファイルで始める場合、以下のような形にする。

```json
{
  "version": 1,
  "source": "manual",
  "patch": "25.12",
  "rankTier": "EMERALD_PLUS",
  "region": "ALL",
  "queueId": 420,
  "championStats": [
    {
      "championId": 103,
      "championKey": "Ahri",
      "championName": "Ahri",
      "role": "MIDDLE",
      "games": 12000,
      "wins": 6060,
      "winRate": 0.505,
      "pickRate": 0.082,
      "banRate": 0.041
    }
  ],
  "matchupStats": [
    {
      "championId": 103,
      "championRole": "MIDDLE",
      "opponentChampionId": 134,
      "opponentRole": "MIDDLE",
      "games": 850,
      "wins": 401,
      "winRate": 0.472,
      "baselineWinRate": 0.505,
      "deltaWinRate": -0.033,
      "confidence": 1.0,
      "weightedDeltaWinRate": -0.033
    }
  ]
}
```

## SQLite 形式の初期案

実データを集め始める場合は SQLite から始める。

### matches

```text
match_id primary key
region
queue_id
game_version
patch
game_start_at
duration_seconds
created_at
```

### participants

```text
match_id
participant_id
team_id
puuid
summoner_id
champion_id
champion_name
role
lane
win
kills
deaths
assists
gold_earned
total_damage_dealt_to_champions
vision_score
gold_diff_15
xp_diff_15
```

### champion_stats

集計結果。

```text
champion_id
role
patch
rank_tier
region
queue_id
games
wins
win_rate
pick_count
pick_rate
ban_count
ban_rate
presence_rate
updated_at
```

### matchup_stats

集計結果。

```text
champion_id
champion_role
opponent_champion_id
opponent_role
patch
rank_tier
region
queue_id
games
wins
win_rate
baseline_win_rate
delta_win_rate
confidence
weighted_delta_win_rate
updated_at
```

## 集計方針

### champion_stats の集計

同じ `patch`, `role`, `rank_tier`, `region`, `queue_id`, `queue_type`, `queue_group` の単位で集計する。

```text
games = participant count
wins = participant wins
win_rate = wins / games
pick_count = games
pick_rate = pick_count / total_role_games
```

BAN 率は match-v5 の通常 match data だけでは取りにくいため、初期は手動データまたは外部データで補う。

### matchup_stats の集計

同じ試合内で、同一ロールの敵 participant を対面として扱う。

```text
champion = participant champion
opponent = enemy participant with same role
games += 1
wins += participant.win ? 1 : 0
```

その後、同条件の champion_stats から `baseline_win_rate` を引いて `delta_win_rate` を出す。

```text
delta_win_rate = matchup_win_rate - baseline_win_rate
confidence = min(1.0, games / min_reliable_games)
weighted_delta_win_rate = delta_win_rate * confidence
```

初期値:

```text
min_reliable_games = 300
```

## MVP の現実的な順序

1. ChampionPoolを登録できるUIとローカル保存を用意する
2. Riot API Match-V5 から自分の直近90試合、または今シーズンの試合を取得する
3. raw match detail を `riot-match-cache/{localPuuid}.json` に保存する
4. match history を正規化して `match-history/{localPuuid}.json` に保存する
5. 5v5 Summoner's RiftのRanked / Normal系queueに絞り込む
6. champion ごとの自己戦績 `user_champion_stats` を `queue_type` / `queue_group` 別に集計する
7. ChampionPoolに自己戦績を表示する
8. 現在の champ select 状態から、味方 pick、敵 pick、ban 済み champion を抽出する
9. 現在ロールのChampionPoolから候補 champion を抽出する
10. 候補 champion に対して `personal_performance_score` を計算する
11. UI に推薦理由として、自己戦績、直近成績、サンプル数、ChampionPool内候補であることを表示する
12. 後から静的 `meta_stats.json` や外部統計を追加し、`champion_strength_score` と `counter_score` を足す

## 注意点

### BAN 率の取得は難しい

通常の Match-V5 データだけでは、ranked solo queue 全体の ban rate を簡単に集計するには多くの試合データが必要になる。

そのため、BAN 率は最初から完全性を求めず、以下のどれかで扱う。

- 手動入力
- 外部統計の参考値
- 収集できる範囲だけでの簡易集計
- いったん `null` として扱う

### role 判定は完全ではない

Riot API の lane/role 情報は常に完璧ではない。

特に off-meta pick や lane swap ではズレる可能性がある。

初期実装では Riot API の判定を信じ、後から補正ロジックを追加する。

### 古いパッチを混ぜすぎない

統計量を増やすために古いパッチを混ぜると、現在のメタ判断が鈍る。

基本は最新パッチを優先し、サンプル数が少ない場合のみ近いパッチを減衰重み付きで混ぜる。

例:

```text
current_patch_weight = 1.0
previous_patch_weight = 0.5
two_patches_ago_weight = 0.25
```

### AI には生の巨大統計を渡さない

OpenAI API などに渡す場合は、全 champion の全 matchup をそのまま渡さない。

アプリ側で候補を絞り、上位理由だけを渡す。

例:

```text
候補: Ahri mid
単体評価: win rate +0.5pt, pick rate 8.2%
敵 mid Syndra への相性: -3.3pt, 850 games
味方 jungle Vi との相性: +1.8pt, 420 games
```

## 将来拡張

- Champion icon/name mapping を Data Dragon から取得する
- Patch ごとの統計を自動更新する
- Rank tier ごとに統計を分離する
- LCU match history fallback を追加する
- Bot lane の 2v2 matchup を追加する
- Team composition tags を整備する
- ChampionPoolごとの得意度、練習中、封印中などの重みを追加する
- 敵プレイヤーの champion pool 推定を追加する
- 推薦結果に説明可能性スコアを付ける
- 統計の鮮度と信頼度を UI に表示する
