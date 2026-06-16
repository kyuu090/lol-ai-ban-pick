# LoL AI Draft Coach

League of LegendsクライアントのローカルAPIであるLCU APIを読み取り、ロビー、チャンピオン選択、サモナー、gameflow phaseをElectron画面に表示するMVPです。

このアプリは情報表示のみを行います。自動ピック、自動BAN、自動ドッジ、ゲーム操作、メモリ読み取り、クライアント改ざんは行いません。

## セットアップ

```bash
npm install
npm start
```

## 使い方

1. League of Legendsクライアントを起動してログインします。
2. このアプリを `npm start` で起動します。
3. ロビーやチャンピオン選択画面に入ると、LCU REST APIとWebSocket経由で状態が表示されます。
4. 必要に応じて「手動再取得」を押してください。

## LCU lockfile

標準パスは次の場所です。

```text
C:\Riot Games\League of Legends\lockfile
```

lockfileにはLCU APIの接続に必要なport、password、protocolが含まれます。LoLクライアントが起動していない、またはログインしていない場合、このファイルが存在せず接続できません。

## 開発メモ

- rendererからNode.js APIを直接触らないように、`preload.js` と `contextBridge` で必要なIPCだけ公開しています。
- `main.js` でlockfileを読み、REST API初期取得と `OnJsonApiEvent` のWebSocket購読を行います。
- LCU APIは自己署名証明書を使うため、開発用途としてLCUへのローカル接続だけ証明書検証を緩和しています。
- WebSocketが切断された場合は3秒後に再接続を試みます。
