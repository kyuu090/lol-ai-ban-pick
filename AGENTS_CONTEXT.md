# LoL AI Draft Coach MVP 要件定義

## 目的

ElectronでWindows向けのローカルアプリ「LoL AI Draft Coach」を作成する。

このアプリは、League of LegendsクライアントのローカルAPIであるLCU APIから、現在のロビー情報、チャンピオン選択情報、味方構成、敵構成、BAN情報、gameflow phaseなどを取得し、画面にリアルタイム表示する。

将来的にはOpenAI APIなどと連携し、現在のドラフト状況をもとにおすすめピックや避けるべきピック、構成相性、レーン相性などを提案する予定。

今回のMVPではAI連携は実装しない。

最優先は、LCU WebSocketでLoLクライアントの状態変化を受け取り、Electronの画面にリアルタイム表示するところまで。

---

## 安全性・規約リスクに関する方針

このアプリは情報表示と提案のみを行う。

実装してはいけないこと:

- 自動ピック
- 自動BAN
- 自動ドッジ
- ゲームプレイの自動操作
- メモリ読み取り
- LoLクライアントやゲーム本体の改ざん

プレイヤーの操作はすべて本人が手動で行う前提とする。

---

## 想定する動作フロー

1. LoLクライアントを起動する
2. Electronアプリを起動する
3. LoLのロビーまたはチャンピオン選択画面に入る
4. アプリがLCU APIから現在の状態を取得する
5. アプリがLCU WebSocketで状態変化をリアルタイム監視する
6. 味方チーム、敵チーム、BAN、現在選択中のチャンピオンなどを画面に表示する
7. 将来的には、その情報をOpenAI APIなどに渡す
8. AIが「おすすめピック」「避けた方がいいピック」「理由」「構成相性」「レーン相性」などを表示する

---

## MVPで実装する範囲

AI連携は不要。

今回作成するMVPでは、以下を実装する。

- Electronアプリとして起動できる
- LoLクライアントのlockfileを読む
- lockfileからLCU API接続情報を取得する
- LCU REST APIにBasic認証で接続する
- LCU WebSocketに接続する
- `OnJsonApiEvent` を購読する
- ロビーやチャンピオン選択の状態変化を受け取る
- 状態変化があったらElectron画面を自動更新する
- WebSocketが切れた場合は再接続する
- エラー時はクラッシュさせず、画面にエラーメッセージを表示する
- 手動再取得ボタンでREST APIから再取得できる

---

## 技術スタック

- Electron
- Node.js
- HTML
- CSS
- JavaScript
- Reactは使わない
- Windows環境を想定

セキュリティのため、rendererから直接Node.js APIを触らない。

Electronでは以下の構成を使う。

- `preload.js`
- `contextBridge`
- `ipcRenderer`
- `ipcMain`

---

## lockfile仕様

標準パス:

```text
C:\Riot Games\League of Legends\lockfile
```

lockfileが存在しない場合は、画面に以下のようなメッセージを表示する。

```text
LoLクライアントが起動していないか、ログインしていません
```

lockfileから以下のLCU接続情報を取得する。

- port
- password
- protocol

lockfileの形式は一般的に以下。

```text
processName:pid:port:password:protocol
```

---

## REST APIで初期取得する対象

アプリ起動時、および手動再取得ボタン押下時に以下を取得する。

- `/lol-lobby/v2/lobby`
- `/lol-champ-select/v1/session`
- `/lol-summoner/v1/current-summoner`
- `/lol-gameflow/v1/gameflow-phase`

---

## WebSocketで監視する対象

LCU WebSocketに接続し、`OnJsonApiEvent` を購読する。

WebSocket経由で受け取ったイベントをもとに、以下の状態を更新する。

- ロビー情報
- チャンピオン選択情報
- 現在のサモナー情報
- gameflow phase
- 最後に受信したWebSocketイベント

WebSocketが切断された場合は、一定時間後に再接続を試みる。

---

## LCU API接続仕様

LCU APIは自己署名証明書を使用するため、開発用途として証明書エラーを回避できる実装にする。

ただし、危険な処理やLoLの自動操作は実装しない。

REST API接続ではBasic認証を使用する。

ユーザー名は通常 `riot`、パスワードはlockfileから取得した値を使う。

---

## UI要件

画面には以下を表示する。

- アプリ名: `LoL AI Draft Coach`
- LCU接続状態
- WebSocket接続状態
- 現在のgameflow phase
- 現在のサモナー情報
- ロビー情報
- チャンピオン選択情報
- 最後に受信したWebSocketイベント
- JSON表示エリア
- 手動再取得ボタン

UIは実用性重視でよい。

---

## ファイル構成

以下のシンプルな構成で実装する。

```text
package.json
main.js
preload.js
index.html
renderer.js
style.css
README.md
```

---

## 各ファイルの役割

### package.json

- Electronアプリとして起動できる設定を書く
- `npm install` と `npm start` で起動できるようにする
- 必要な依存関係を定義する

### main.js

- Electronのメインプロセス
- BrowserWindowの作成
- lockfileの読み取り
- LCU REST API接続
- LCU WebSocket接続
- WebSocketイベント購読
- 再接続処理
- ipcMainによるrendererとの通信

### preload.js

- `contextBridge` を使ってrendererに安全なAPIだけを公開する
- `ipcRenderer` を直接rendererに露出させない

### index.html

- アプリの画面構造

### renderer.js

- preload経由でmainプロセスと通信する
- 取得した状態を画面に反映する
- 手動再取得ボタンのイベントを扱う

### style.css

- 画面のスタイル

### README.md

以下を記載する。

- セットアップ手順
- 起動方法
- LoLクライアントを起動してログインしてから使うこと
- LCU APIとlockfileについての簡単な説明
- このアプリが自動操作を行わないこと
- 開発用途で自己署名証明書を許容していること

---

## 期待する成果物

1. 以下のファイルを作成する

```text
package.json
main.js
preload.js
index.html
renderer.js
style.css
README.md
```

2. 以下のコマンドで起動できるようにする

```bash
npm install
npm start
```

3. READMEにセットアップ手順を書く

4. 実装のポイントを簡単にコメントで説明する

5. LCU APIの自己署名証明書でエラーが出る可能性があるため、開発用途として回避できる実装にする

6. 危険な処理やLoLの自動操作は入れない

---

## 実装上の重要ポイント

- rendererからNode.js APIを直接触らせない
- `nodeIntegration: false`
- `contextIsolation: true`
- `preload.js` 経由で必要なAPIだけを公開する
- lockfileがない場合でもクラッシュさせない
- LCU API接続エラー時もクラッシュさせない
- WebSocket切断時に再接続する
- REST初期取得とWebSocket更新の両方を実装する
- 受け取ったJSONは画面で確認しやすいように整形表示する
- 自動ピック、自動BAN、自動ドッジなどの操作系APIは実装しない

---

## 最優先ゴール

LCU WebSocketでLoLクライアントの状態変化を受け取り、Electronの画面にリアルタイム表示する。
