# チャンピオン分析画面

## 目的

StatsAPI の対面・タイムライン統計を、ドラフト進行中ではなく事前研究で参照できる画面として提供する。

## 画面への動線

1. メインナビゲーションから「チャンピオン」を開く。
2. Patch、Rank、Lane を選択する。
3. チャンピオン一覧の行を選択する。
4. チャンピオン詳細上部のタブで次の表示を切り替える。

- 「ビルド」: 既存のルーン、サモナースペル、アイテム、スキル情報
- 「対面分析」: 対面チャンピオン別の勝率一覧
- 「全体推移」: 対面を限定しない5〜40分の平均推移

ドラフト画面にはこの分析画面への導線を追加しない。

## 使用API

### 対面分析

`GET /v1/stats/positions/{position}/champions/{championId}/matchups`

- APIの `baselineWinRate` を「基準勝率」として表示する。
- 各対面は試合数、対面勝率、`winRateVsOpponent - baselineWinRate` のポイント差を表示する。
- 最小試合数は、制限なし、20、50、100試合から選べる。初期値は20試合。
- 対面行を選択すると、その対面の時間推移へ進む。

### 特定対面の時間推移

`GET /v1/stats/positions/{position}/champions/{championId}/matchups/{opponentChampionId}`

- 対面勝率と試合数を表示する。
- Gold差、XP差、CS差を切り替えられる折れ線グラフを表示する。
- 表では各時点のGold・XP・CSの差とリード率、レーン戦発生率、平均K/D/Aを併記する。
- 「対面一覧に戻る」で対面一覧へ戻る。

### 全体の時間推移

`GET /v1/stats/positions/{position}/champions/{championId}/timeline`

- 特定対面の時間推移と同じグラフ・表を使う。
- 全対面を母数にした傾向であることを説明文で明示する。

## フィルタと再取得

Patch、Rank、Lane は、チャンピオン一覧・ビルド・対面分析・時間推移で共通に使用する。詳細画面を開いたままフィルタを変更した場合は、現在表示しているタブのAPIを同じ条件で再取得する。

ビルド画面の「対面チャンピオン」フィルタはビルドAPI専用であり、「対面分析」「全体推移」では非表示にする。

## 表示上の注意

- 勝率には必ず試合数を併記する。
- 時点別の試合数は、その時点まで継続し、本人と対面の通常スナップショットが揃った試合数である。
- リード率は、対象チャンピオンの値が対面を上回った試合の割合である。
- TOP、MIDDLE、JUNGLE のレーン戦指標は1v1、BOTTOM、UTILITYはduo laneの2v2基準である。

## 実装箇所

- `ui/champions-view.ts`: URL生成、状態管理、API取得、分析表示
- `stats-db-api.ts`: Rendererから呼び出せるStatsAPIパスの許可
- `styles/stats.css`: 分析タブ、対面表、タイムライングラフ
- `styles/responsive.css`: 狭い画面での分析タブ・ヘッダー配置
- `test/ui-champions-view.test.js`: 分析API URL生成のテスト
- `test/stats-db-api.test.js`: 許可パスのテスト
