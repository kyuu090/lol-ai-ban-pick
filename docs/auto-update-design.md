# Auto Update Design

## 目的

起動時に最新版を確認し、更新が必要な場合だけ次の二択を出す。

- `アップデートする`
- `アップデートせずに終了する`

更新不要なら、そのまま通常起動する。`latest.yml` が取得できない場合も、更新なしとして通常起動する。

## 結論

このリポジトリでは `electron-builder` ですでに `nsis` ターゲットを出しているため、Windows の自動更新対象は **NSIS インストーラー版** に寄せるのが最も安全。

`portable` exe は自己上書き更新と相性が悪く、起動中 exe の置き換え、展開先の自由度、ショートカット管理、ロールバックの扱いが面倒になる。よって次の方針を推奨する。

- 自動更新対象: `BanPick-ai-<version>-setup.exe` で導入したインストール版
- 手動配布対象: `BanPick-ai-<version>-portable.exe` は当面そのまま残してもよい
- アプリ内の更新チェック: インストール版でのみ有効化する

## 配信方式

VPS 上で static file 配信する。

想定 URL 例:

```text
https://download.example.com/banpick-ai/latest.yml
https://download.example.com/banpick-ai/BanPick-ai-0.6.1-setup.exe
https://download.example.com/banpick-ai/BanPick-ai-0.6.1-setup.exe.blockmap
```

`electron-updater` の generic provider を使うと、VPS 側は nginx / Caddy / Apache などで静的配信するだけでよい。

現在の実装では、この配信先は環境変数 `BANPICK_AI_UPDATE_BASE_URL` から与える。

## 採用案

`electron-updater` を使い、`autoDownload: false` で更新を自動取得させず、更新検知後に明示確認する。

期待する挙動:

1. アプリ起動
2. メインプロセスが `latest.yml` を確認
3. 更新不要なら通常起動
4. 更新必要ならダイアログ表示
5. `アップデートする` を選んだらダウンロード開始
6. ダウンロード完了後にインストーラーを適用
7. `アップデートせずに終了する` を選んだら `app.quit()`

## 起動フロー設計

更新確認は **メインウィンドウ生成前のスプラッシュウィンドウ上** で行う。

理由:

- ユーザー要件が「起動時に確認して、更新しないなら終了」だから
- 既存 UI を起動してから閉じるより自然
- 更新拒否時に LCU 接続や状態初期化を走らせずに済む

スプラッシュ要件:

- 最低 2 秒間は表示する
- アプリのライトモード背景に寄せた明るいグラデーションを使う
- 中央にブランドアイコンと `BanPick.ai` のロゴを大きく表示する
- 左下にクライアントバージョンを表示する
- 右下に 1 行のステータスログを表示し、更新確認や起動処理の進行を出す
- フォントは `Bahnschrift`, `Noto Sans JP`, `Segoe UI`, `Yu Gothic UI`, `sans-serif` の順を基本にする

想定フロー:

```text
app.whenReady()
  -> splash window 表示
  -> auto update check
     -> latest.yml 取得失敗: 更新なし扱い
     -> update not available: createWindow() して通常起動
     -> update available:
          -> dialog「アップデートする / アップデートせずに終了する」
             -> update: download -> install
             -> exit: app.quit()
```

## 実装責務

### 1. `package.json`

追加・変更候補:

- `dependencies` に `electron-updater`
- リリース時に `latest.yml` が生成される前提へ寄せる

URL はコードへ直書きせず、環境変数から注入する。

## 2. `main/auto-update-service.ts` を新設

責務:

- `electron-updater` の `autoUpdater` 初期化
- `checkForUpdates()` 実行
- 更新有無の判定
- 更新確認ダイアログ表示
- ダウンロード進捗ログ
- ダウンロード完了後の `quitAndInstall()`

返すインターフェース案:

```ts
type StartupUpdateResult =
  | { action: 'continue' }
  | { action: 'quit-for-update' }
  | { action: 'quit-no-update' };
```

実際には `quitAndInstall()` や `app.quit()` を内部で呼ぶ構成でもよいが、`bootstrap.ts` 側から分岐が見える形の方が保守しやすい。

## 3. `main/bootstrap.ts`

現在は `app.whenReady()` 後にそのまま `createWindow()` しているが、これをスプラッシュ経由へ変える。

ここを次の順に変更する。

1. `createSplashWindow()`
2. 更新チェック
3. 続行可のときだけ local settings 読み込み
4. IPC 登録と `createWindow()`
5. main window 表示直前に splash を閉じる
6. その後 `lcuController.refreshLcuState()`

ポイント:

- 更新しない選択時は `createWindow()` しない
- 更新中や終了分岐では LCU 接続処理へ進まない
- `latest.yml` 取得失敗は通常起動する
- スプラッシュは最低 2 秒表示してから遷移する

推奨は **更新確認失敗時は通常起動**。配信障害で全ユーザーが起動不能になるのを避けるため。

## 4. ログ

`electron-log` に次を出す。

- 更新確認開始
- 現在バージョン
- 最新版検知
- ユーザー選択
- ダウンロード開始 / 完了
- 更新確認失敗

秘密情報は持たないが、VPS URL をログに出しすぎないようにはしてよい。

## ダイアログ仕様

タイトル例:

`アップデートがあります`

本文例:

`新しいバージョン 0.6.1 が利用できます。アップデートしますか？`

ボタン:

- `アップデートする`
- `アップデートせずに終了する`

補足:

- 閉じるボタンや Esc の扱いも `終了` に寄せる
- `cancelId` は `アップデートせずに終了する` に設定する
- `defaultId` は `アップデートする`

## VPS 側の構成

最低限必要なもの:

- `latest.yml`
- 最新版の `setup.exe`
- `setup.exe.blockmap`

サーバー要件:

- HTTPS
- `GET /banpick-ai/latest.yml` がそのまま読める
- `Content-Type` は厳密でなくてもよいが、`yml` と `exe` を普通に配信できること
- 大きい exe を配るので range request を有効にしておくと安定しやすい

nginx 例:

```nginx
location /banpick-ai/ {
  alias /srv/downloads/banpick-ai/;
  autoindex off;
}
```

## リリース運用

GitHub Actions でビルドした成果物を、そのまま GitHub Release へ置くだけでは generic provider の参照先が GitHub になる。VPS 配信に寄せるなら、次のどちらかにする。

- `release.yml` でビルド後に VPS へ `latest.yml` と `*.exe` を同期する
- いったん GitHub Actions artifact を取得して、人手または別ジョブで VPS へ配置する

推奨は自動同期。

現在の repository 側 `release.yml` では、GitHub Release にも次を添付する前提にする。

- `*-portable.exe`
- `*-setup.exe`
- `*-setup.exe.blockmap`
- `latest.yml`

配置単位:

- 常に最新版だけを `/banpick-ai/` 直下へ置く
- 旧版 exe は `/banpick-ai/archive/` へ退避してもよい

## 失敗時ポリシー

### 更新確認失敗

- タイムアウト、DNS 失敗、`latest.yml` 取得失敗、署名検証失敗など
- 推奨挙動: ログだけ残して通常起動

理由:

- VPS 障害だけでアプリ全体が使えなくなるのを防ぐ

### ダウンロード失敗

- エラーダイアログを表示し、`終了` する
- 再試行を付けるのは後回しでもよい

理由:

- 今回の要件は二択であり、分岐を増やさない方がシンプル

## 実装ステップ

### Phase 1

- `electron-updater` 導入
- NSIS インストール版だけ更新チェック有効化
- 起動時確認ダイアログ
- `アップデートする / アップデートせずに終了する` の二択
- VPS 上の `latest.yml` 読み取り

### Phase 2

- GitHub Actions から VPS への自動同期
- ダウンロード進捗ログ改善
- 更新失敗時メッセージ改善

### Phase 3

- 署名済み配布への移行
- 必要なら staged rollout や channel 分離

## このリポジトリでの変更候補ファイル

- `package.json`
- `main/bootstrap.ts`
- `main/auto-update-service.ts` 新規
- `docs/development.md`
- 必要なら `README.md`

## 注意点

- `portable` 版を自動更新の対象にしない
- 更新 URL や provider 情報を Renderer へ公開しない
- 更新確認が長引くと体感起動が悪くなるため、タイムアウトは短めにする
- `autoUpdater.quitAndInstall()` 実行前に必要ならログ flush を考慮する
- 未署名 exe は SmartScreen 警告が出やすいので、将来的にはコード署名を検討する

## 推奨実装順

1. `NSIS` インストール版のみを更新対象に決める
2. VPS に `latest.yml` と `setup.exe` を置けるようにする
3. `electron-updater` を組み込み、起動前チェックを実装する
4. `release.yml` から VPS への自動配置を整える
5. その後にコード署名や運用改善を進める
