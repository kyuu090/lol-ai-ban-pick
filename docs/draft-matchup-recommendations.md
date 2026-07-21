# ドラフト対面候補UI

## 概要

ドラフト中央パネルでは、担当ポジションと選択状況に応じてStatsAPIの対面統計を表示する。

- BANフェーズ: 自分の確定またはピック予定チャンピオンを基準に、勝率が低い対面を5体表示する。
- PICKフェーズ: 敵チームのカードで指定した対面を基準に、相手側の勝率を反転して有利な候補を5体表示する。
- API: `GET /v1/stats/positions/{position}/champions/{championId}/matchups?minGames={selected}`

レスポンスは画面内でキャッシュし、同じ条件の再描画では再取得しない。条件が切り替わった後に古いレスポンスが完了しても、現在の候補を上書きしない。

## 除外条件

BAN候補では、味方の確定ピックと `championPickIntent` を除外する。PICK候補では、両チームの確定ピックと両チームのBANを除外する。

## 表示

候補は5列の画像カードで表示する。カード左上にチャンピオン名、下部に勝率と試合数を置く。ChampionPoolは対面未指定なら本人のローカル試合履歴の通常勝率、対面指定中なら本人の「自チャンピオン × 指定対面」のローカル戦績を表示し、それぞれ勝率の高い順に並べる。StatsAPIの取得中もPoolカードとローカル履歴のレーン対面は先に表示する。利用不可の候補はグレースケールと状態バッジで示す。

カード背景はData Dragonのタイル画像を優先する。タイル画像を実際にプリロードして、読み込みエラー時だけLCU／Data Dragonの正方形アイコンへフォールバックする。成功した画像要素と採用URLはRenderer終了までメモリに保持し、同じチャンピオンの再描画では再判定しない。

BAN画面の `Min. games` 指定はローカル履歴のレーン対面だけに適用されるため、`Your lowest-win-rate MID matchups` の見出し行に配置する。レーン対面も同じ画像カードで表示する。

StatsAPI候補には独立した `MIN. GAMES` プルダウンを設け、`All / 20+ / 40+ / 60+ / 100+` から選択する。初期値は `40+`。変更時は選択値をAPIの `minGames` とキャッシュキーへ反映して再取得する。

PICK画面では対面指定中にPool見出しを `Your MID Pool vs <champion>` とし、表示中の直接対面戦績が誰に対するものかを明示する。

ChampionPoolは登録チャンピオンをすべて表示する。利用可能な候補を優先したうえで勝率順に並べ、5列を超える分は複数行にする。Poolカード領域には最大高を設け、それを超える場合は領域内を縦スクロールする。見出しの `N/N candidates` で表示数と登録総数を示す。

## モック確認

League Clientや実戦のチャンピオン選択を使わず、固定fixtureで確認できる。

```powershell
npm run capture:ui -- --view=draft-ban --stats-source=fixture
npm run capture:ui -- --view=draft-pick --stats-source=fixture
npm run capture:ui -- --view=draft-pick-pool --stats-source=fixture
```

出力先は `.tmp-ui-captures/draft-ban-light.png`、`.tmp-ui-captures/draft-pick-light.png`、`.tmp-ui-captures/draft-pick-pool-light.png`。`--theme=dark` も利用できる。
