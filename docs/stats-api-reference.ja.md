# StatsAPI API Reference

`apps/stats-api` の現行実装に対応するAPIリファレンスです。データソースはClickHouseで、JSON APIは `/v1/stats/...` 配下にあります。

## エンドポイント

- `GET /health`
- `GET /metrics`
- `GET /v1/stats/meta`
- `GET /v1/stats/positions/{position}/champions`
- `GET /v1/stats/positions/{position}/champions/{championId}/matchups`
- `GET /v1/stats/positions/{position}/champions/{championId}/matchups/{opponentChampionId}`
- `GET /v1/stats/positions/{position}/champions/{championId}/timeline`
- `GET /v1/stats/positions/{position}/champions/{championId}/details`

## 共通フィルタ

チャンピオン統計・対面・詳細APIでは、以下のフィルタを使用します。

| パラメータ | 内容 |
| --- | --- |
| `patch` / `patches` | `major.minor` 形式。未指定時は最新patch。`latest` も利用可能。両者の同時指定は不可。 |
| `region` / `regions` | `KR`, `JP1`。`JP` は `JP1` に正規化。両者の同時指定は不可。未指定時は全region。 |
| `queueId` | 正の整数。既定値は `420`（Ranked Solo/Duo）。 |
| `rank` / `ranks` | `IRON` から `CHALLENGER`。両者の同時指定は不可。未指定時は全rank。 |
| `position` | パスで指定。`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`。 |

不正なフィルタは `400` と `{ "error": "invalid_filters", "issues": [...] }` を返します。`meta.filters` には正規化後に実際に使用された条件を返します。

統計APIの成功レスポンスは次の形です。

```json
{
  "data": {},
  "meta": {
    "filters": {},
    "dataset": {
      "latestPatch": "16.13",
      "watermark": "2026-07-16T00:00:00.000Z",
      "sampleMatches": 0,
      "sampleParticipants": 0
    },
    "cache": {
      "hit": false,
      "key": "...",
      "generatedAt": "2026-07-16T00:00:00.000Z",
      "expiresAt": "2026-07-16T00:05:00.000Z",
      "stale": false
    }
  }
}
```

## `GET /health`

ClickHouseへの接続状態を返します。

```json
{ "status": "ok", "clickhouse": "ok" }
```

ClickHouseに接続できない場合は `503` と `{ "status": "error", "clickhouse": "unreachable" }` を返します。

## `GET /metrics`

Prometheus text format（`text/plain; version=0.0.4; charset=utf-8`）で以下を返します。

- `lol_match_count_total`
- `lol_match_count_by_rank{rank="..."}`
- `lol_match_count_by_patch{patch="..."}`
- `lol_clickhouse_table_disk_usage_bytes{db="...",table="..."}`

## `GET /v1/stats/meta`

利用可能なデータ範囲を返します。フィルタはありません。

```json
{
  "data": {
    "latestPatch": "16.13",
    "patches": ["16.13"],
    "regions": ["JP1", "KR"],
    "queueIds": [420],
    "ranks": ["DIAMOND", "MASTER"],
    "positions": ["BOTTOM", "JUNGLE", "MIDDLE", "TOP", "UTILITY"],
    "watermark": "2026-07-16T00:00:00.000Z"
  }
}
```

`latestPatch` が `null` の場合は、`patch=latest` を利用できません。キャッシュは60秒間fresh、続く300秒間stale-while-revalidateです。

## `GET /v1/stats/positions/{position}/champions`

指定レーンのチャンピオン統計一覧を返します。

追加フィルタ:

- `championId`: 単一チャンピオンに絞る
- `minGames`: 最小出場試合数
- `minPickRate`, `maxPickRate`: 0から1の範囲
- `limit`: 1から200。既定値は200
- `sort`: `games`, `championId`, `winRate`, `pickRate`, `banRate`, `tierScore` の `field:asc|desc`

```http
GET /v1/stats/positions/MIDDLE/champions?patch=latest&ranks=DIAMOND,MASTER&minGames=100&sort=winRate:desc
```

```json
{
  "data": [{
    "championId": 103,
    "winRate": 0.52,
    "pickRate": 0.031,
    "banRate": 0.12,
    "tierScore": 54.63,
    "tier": "A",
    "games": 1234,
    "mostPlayedLane": "MIDDLE"
  }]
}
```

`winRate` は `wins / games`、`pickRate` と `banRate` の分母はフィルタ後の試合数です。キャッシュは5分間fresh、続く30分間stale-while-revalidateです。

## `GET /v1/stats/positions/{position}/champions/{championId}/matchups`

指定チャンピオンの対面別勝敗を返します。`games >= minGames` を満たすすべての対面を、`games` の降順（同数時は対面チャンピオンID昇順）で返します。

追加フィルタ:

- `minGames`: 最小対面試合数。既定値は `20`。`0` を指定すると、データのある全対面を返す

```http
GET /v1/stats/positions/MIDDLE/champions/103/matchups?patch=latest&minGames=20
```

```json
{
  "data": {
    "championId": 103,
    "baselineWinRate": 0.512,
    "matchups": [{
      "opponentChampionId": 238,
      "games": 220,
      "wins": 121,
      "winRateVsOpponent": 0.55
    }]
  }
}
```

- `baselineWinRate`: 同一フィルタ・同一レーンでの対象チャンピオンの全対面込み勝率
- `winRateVsOpponent`: 対面別の `wins / games`

キャッシュは5分間fresh、続く30分間stale-while-revalidateです。

## `GET /v1/stats/positions/{position}/champions/{championId}/matchups/{opponentChampionId}`

特定対面のレーン推移を返します。`5, 10, ..., 40` 分の通常スナップショットだけを対象にするため、試合終了時だけのfinal snapshotは含みません。各時点の `games` は、その時点まで継続し、本人・対面の両方のスナップショットが揃った試合数です。

```http
GET /v1/stats/positions/MIDDLE/champions/103/matchups/238?patch=latest&rank=MASTER
```

```json
{
  "data": {
    "championId": 103,
    "opponentChampionId": 238,
    "games": 220,
    "wins": 121,
    "winRateVsOpponent": 0.55,
    "timeline": [{
      "minute": 10,
      "games": 205,
      "champion": { "avgGold": 5180, "avgXp": 4120, "avgCs": 78.1, "avgLevel": 8.2 },
      "opponent": { "avgGold": 4950, "avgXp": 3990, "avgCs": 73.4, "avgLevel": 8.0 },
      "difference": {
        "avgGold": 230, "avgXp": 130, "avgCs": 4.7,
        "goldLeadRate": 0.56, "xpLeadRate": 0.54, "csLeadRate": 0.58
      },
      "laneFights": {
        "isolated_kills_vs_lane": 0.18,
        "isolated_deaths_vs_lane": 0.11,
        "isolated_assists_vs_lane": 0.02,
        "isolated_kills_vs_lane_occurred_rate": 0.15,
        "isolated_deaths_vs_lane_occurred_rate": 0.10,
        "isolated_assists_vs_lane_occurred_rate": 0.02,
        "fight_occurred_rate": 0.22
      }
    }]
  }
}
```

- `champion` / `opponent`: 対象側・対面側の平均総ゴールド、経験値、総CS、レベル
- `difference`: 対象側から見た平均との差と、値が正の試合割合
- `laneFights.isolated_kills_vs_lane`, `isolated_deaths_vs_lane`, `isolated_assists_vs_lane`: その時点までの累積値の試合平均。保存列名をそのまま使用
- `*_occurred_rate`: 対応する累積値が1以上の試合割合
- `fight_occurred_rate`: kill / death / assist のいずれかが1以上の試合割合

TOP/MIDDLE/JUNGLE の `isolated_*_vs_lane` は1v1、BOTTOM/UTILITYはduo laneの2v2基準です。キャッシュは5分間fresh、続く30分間stale-while-revalidateです。

## `GET /v1/stats/positions/{position}/champions/{championId}/timeline`

対面を指定せず、対象チャンピオン・レーンの全試合を母数にして、対面詳細APIと同じ5〜40分のタイムライン統計を返します。

```http
GET /v1/stats/positions/MIDDLE/champions/103/timeline?patch=latest&rank=MASTER
```

`data` は `championId`, `games`, `wins`, `winRate`, `timeline` を持ちます。`timeline` の各要素の構造と、`champion` / `opponent` / `difference` / `laneFights` の意味は対面詳細APIと同一です。各時点の `games` は、その時点まで継続し、本人・レーン対面双方の通常スナップショットがある試合数です。

キャッシュは5分間fresh、続く30分間stale-while-revalidateです。

## `GET /v1/stats/positions/{position}/champions/{championId}/details`

指定チャンピオンの推奨ビルドプロファイルを返します。推奨はキーストーンごとに、ルーン、ステータスシャード、サモナースペル、開始アイテム、靴、コア・後続アイテム、スキル取得順・優先度を含みます。

追加フィルタ:

- `opponentChampionId`: 指定すると、その対面に限定した推奨にする
- `keystoneId`: 指定すると、そのキーストーンに限定した候補を集計する

```http
GET /v1/stats/positions/MIDDLE/champions/103/details?opponentChampionId=238&rank=MASTER
```

```json
{
  "data": {
    "champion": {
      "championId": 103,
      "games": 1234,
      "wins": 642,
      "pickRate": 0.0312,
      "winRate": 0.5203
    },
    "keystones": [{
      "keystoneId": 8112,
      "games": 614,
      "wins": 326,
      "pickRate": 0.4976,
      "winRate": 0.5309,
      "runes": [],
      "statShards": [],
      "summonerSpells": [],
      "startingItems": [],
      "boots": [],
      "firstSecondCoreItems": [],
      "thirdItems": [],
      "fourthItems": [],
      "fifthItems": [],
      "sixthItems": [],
      "skillOpenings": [],
      "skillPriorities": []
    }]
  }
}
```

候補要素は共通して `games`, `wins`, `pickRate`, `winRate` を持ちます。アイテム候補は `itemId` または `itemIds`、ルーン候補はルーンID、スキル候補はスキルスロット順を返します。キャッシュは15分間fresh、続く120分間stale-while-revalidateです。

## 利用時の注意

- チャンピオン、アイテム、ルーン、スペルの名称や画像は返しません。IDをData Dragonなどの外部マスターデータと対応付けてください。
- `BOTTOM` と `UTILITY` の対面情報は、レーン対面として収集されたチャンピオンIDに基づきます。
- 対面別の結果は試合数を併記します。少数サンプルの勝率は参考値として扱ってください。
