# Electron UIキャプチャハーネス

## 目的

Electron固有のpreload/IPCを含む画面を自動で起動し、Codexが確認できるPNGとして保存する。通常ブラウザへの置き換えではなく、本番と同じ `preload.js` を読み込む `BrowserWindow` を使用する。

StatsAPIは既定で本番の `https://db.banpick-ai.lol` を使用する。LCU状態、設定、ChampionPoolはキャプチャ専用fixtureを使用するため、League Clientを起動する必要はない。

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
| `--output=<path>` | PNG出力先 |
| `--show` | 撮影時にElectronウィンドウを表示する |
| `--hold-ms=5000` | 撮影後にウィンドウを表示し続ける時間 |
| `--stats-source=production|fixture` | StatsAPIのデータ元。既定値は `production`。固定データでも全レーンを選択可能 |

`--show` を指定した場合、既定で撮影後5秒間ウィンドウを表示する。

## オフライン・CI確認

外部ネットワークを使えない場合は固定fixtureを指定する。

```powershell
npm run capture:ui -- --view=timeline --stats-source=fixture
```

fixtureは `scripts/ui-capture-fixtures.js` にあり、Meta、チャンピオン一覧、ビルド、マッチアップ一覧、特定マッチアップ推移、タイムライン分析をカバーする。

## Codexでの確認手順

1. `npm run capture:ui` を実行する。Electron起動と本番StatsAPI通信の許可が必要になる場合がある。
2. コマンドが返した `outputPath` のPNGを画像表示ツールで開く。
3. レイアウトを修正する。
4. 同じ `--view`、テーマ、画面サイズで再撮影して比較する。

生成された `.tmp-ui-captures/` はGit管理対象外である。
