# Electron UIキャプチャハーネス

## 目的

Electron固有のpreload/IPCを含む画面を自動で起動し、Codexが確認できるPNGとして保存する。通常ブラウザへの置き換えではなく、本番と同じ `preload.js` を読み込む `BrowserWindow` を使用する。

StatsAPIは既定で本番の `https://db.banpick-ai.lol` を使用する。LCU状態、設定、ChampionPoolはキャプチャ専用fixtureを使用するため、League Clientを起動する必要はない。

キャプチャfixtureの既定言語は英語であり、チャンピオン名も英語（例: `Ahri`、`Zed`）で表示する。

## 基本コマンド

タイムライン分析画面をライトテーマ、1440×900で撮影する。

```powershell
npm run capture:ui -- --view=timeline
```

出力先:

```text
.tmp-ui-captures/timeline-light.png
```

キャプチャ処理は次の操作を自動で行う。

1. TypeScriptをコンパイルする。
2. Electron `BrowserWindow` を起動する。通常は画面外に配置し、Windowsの描画更新を維持する。
3. 本番の `preload.js` とキャプチャ用IPCを接続する。
4. Champions画面を開く。
5. 分析画面ではMIDへ切り替え、Ahriが一覧にあればAhri、なければ先頭チャンピオンを選択する。
6. 指定された分析画面へ遷移する。
7. ローディング完了をDOMで確認してからPNGを保存する。

## 撮影対象

`--view` には次を指定できる。

| 値 | 撮影画面 |
| --- | --- |
| `champions` | チャンピオン一覧 |
| `build` | チャンピオンのビルド詳細 |
| `matchups` | 対面一覧 |
| `matchup` | 対面一覧の先頭対面を開いた時間推移 |
| `timeline` | 全対面を含む時間推移。既定値 |
| `draft-ban` | BAN予定チャンピオンに対するStatsAPIカウンター候補のモック |
| `draft-pick` | 指定した対面に対するStatsAPI有利候補とChampionPoolのモック |
| `draft-pick-pool` | 対面未指定時の通常戦績を表示するChampionPoolのモック |
| `in-game` | 試合開始後のおすすめアイテム、スキルオーダー、対面AI分析のモック |

例:

```powershell
npm run capture:ui -- --view=matchup --theme=dark
```

## オプション

| オプション | 内容 |
| --- | --- |
| `--theme=light|dark` | テーマ。既定値は `light` |
| `--lane=TOP|JUNGLE|MIDDLE|BOTTOM|UTILITY` | 分析対象レーン。既定値は `MIDDLE` |
| `--width=1440` | BrowserWindowの幅 |
| `--height=900` | BrowserWindowの高さ |
| `--scroll=top|bottom` | 分析領域の撮影位置。既定値は `top` |
| `--hover=<CSS selector>` | 撮影直前に対象要素へマウスホバーを再現する。独自ツールチップの表示確認に使用する |
| `--output=<path>` | PNG出力先 |
| `--show` | 撮影時にElectronウィンドウを表示する |
| `--hold-ms=5000` | 撮影後にウィンドウを表示し続ける時間 |
| `--stats-source=production|fixture` | StatsAPIのデータ元。既定値は `production`。固定データでも全レーンを選択可能 |
| `--ai-source=fixture|production` | `in-game` の対面AI分析データ元。既定値は `fixture`。`production` は実BFFを呼び出す |

`--show` を指定した場合、既定で撮影後5秒間ウィンドウを表示する。

## オフライン・CI確認

外部ネットワークを使えない場合は固定fixtureを指定する。

```powershell
npm run capture:ui -- --view=timeline --stats-source=fixture
```

fixtureは `scripts/ui-capture-fixtures.js` にあり、Meta、チャンピオン一覧、ビルド、マッチアップ一覧、特定マッチアップ推移、タイムライン分析をカバーする。

ドラフト画面はLeague Clientなしで次のように確認できる。`draft-pick` はfixture内のゼドを対面指定する操作も自動で行う。

```powershell
npm run capture:ui -- --view=draft-ban --stats-source=fixture
npm run capture:ui -- --view=draft-pick --stats-source=fixture
npm run capture:ui -- --view=draft-pick-pool --stats-source=fixture
```

試合開始後の画面は、まず完了済みのチャンプ選択状態をレンダラーへ渡し、その後に `GameStart` 状態へ遷移する。これにより、本番と同じく直前のピック、現在のルーン、同レーン対面を使っておすすめアイテム・スキルオーダー・対面AI分析を表示する。

```powershell
npm run capture:ui -- --view=in-game --stats-source=fixture --show --hold-ms=60000
```

対面AI分析も実際のBFFレスポンスで確認する場合は、明示的に `--ai-source=production` を指定する。この指定では `/api/openai/lane-matchup` へ、通常のアプリと同じ英語の Ahri 対 Zed のfixtureコンテキストをPOSTする。OpenAI利用枠を消費しうるため、既定値は `fixture` とする。

```powershell
npm run capture:ui -- --view=in-game --stats-source=fixture --ai-source=production --show --hold-ms=60000
```

タイムライングラフのツールチップを撮影する例:

```powershell
npm run capture:ui -- --view=timeline --stats-source=fixture --hover=".metric-gold .stats-api-timeline-hover-target"
```

## Codexでの確認手順

1. `npm run capture:ui` を実行する。Electron起動と本番StatsAPI通信の許可が必要になる場合がある。
2. コマンドが返した `outputPath` のPNGを画像表示ツールで開く。
3. レイアウトを修正する。
4. 同じ `--view`、テーマ、画面サイズで再撮影して比較する。

生成された `.tmp-ui-captures/` はGit管理対象外である。
