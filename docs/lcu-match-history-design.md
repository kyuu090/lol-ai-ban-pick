# LCU Match History Notes

## 位置づけ

この文書は、LCU match history の調査結果と fallback 方針をまとめる。

自己戦績取得の本線は Riot API Match-V5 とする。詳細設計は `docs/riot-match-history-design.md` を参照する。

LCU match history は API キー不要で利用できるが、ローカル調査ではページングやキャッシュ挙動が不安定だった。そのため、初期実装では推薦・自己戦績の本線には使わない。

## 調査で確認できたこと

LoL クライアント起動中、ログイン中であれば次の endpoint は取得できた。

試合履歴一覧:

```text
/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=20
```

PUUID 指定版:

```text
/lol-match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex=20
```

試合詳細:

```text
/lol-match-history/v1/games/{gameId}
```

調査時点の観測:

```text
一覧取得件数: 21
詳細取得成功: 21/21
self特定成功: 21/21
KDA取得成功: 21/21
味方/敵を構築できる試合: 18/21
```

参加者数の内訳:

```text
1人: Practice Tool など
10人: CLASSIC 系
18人: CHERRY / Arena 系
```

## 重要な制約

### ページングが不安定

`begIndex` / `endIndex` を変えても、同じ直近21件が返ることがあった。

一方で、ユーザー側の追加調査では、時間を空けると `begIndex` / `endIndex` が効くように見えるケースもあった。

そのため、LCU match history は内部キャッシュの影響を受けている可能性がある。

設計上は次のように扱う。

```text
LCU match history pagination is best-effort.
```

### 一覧レスポンスは自分中心

一覧 endpoint の `participants` は、自分1人分だけになるケースがあった。

味方 champion / 敵 champion を取得するには、`gameId` ごとに詳細 endpoint を叩く必要がある。

```text
match history list
  -> gameId一覧
  -> /lol-match-history/v1/games/{gameId}
  -> participants / participantIdentities を正規化
```

## 自分の participant 特定

LCU detail では、`participants` に `puuid` が直接ないケースがある。

そのため、`participantIdentities[].player` から自分の `participantId` を特定し、`participants[]` に対応させる。

優先順:

```text
identity.player.puuid === currentSummoner.puuid
identity.player.summonerId === currentSummoner.summonerId
identity.player.accountId === currentSummoner.accountId
identity.player.currentAccountId === currentSummoner.accountId
```

その後:

```text
participant.participantId === selfIdentity.participantId
```

自分が見つかったら:

```text
self.teamId と同じ participant -> allies
self.teamId と違う participant -> enemies
```

## fallback として使う場合

Riot API token が未設定、または Riot API が一時的に使えない場合の軽い fallback としては利用できる可能性がある。

ただし、取得できる件数は安定保証しない。

fallback で使う場合の方針:

- 直近一覧を1ページ取得する
- `gameId` で dedupe する
- 必要な `gameId` だけ detail を取得する
- 取得できたユニーク試合だけ正規化する
- ページングは best-effort として扱う
- 同一ページが返り続けたら停止する
- 結果は `partial` として扱う

## 保存ファイル

fallback / 調査で保存する場合:

```text
lcu-match-history-raw.json
lcu-match-history-normalized.json
```

本線の Riot API では次を使う。

```text
riot-match-cache/{localPuuid}.json
match-history/{localPuuid}.json
```

## 注意点

- LCU match history を本線の自己戦績取得に使わない
- LCU match history の大量自動取得は避ける
- ChampSelect 中に重い取得処理を走らせない
- raw response を Debug state に常時出さない
- LCU password や Basic 認証ヘッダをログに出さない
- 自動ピック、自動BAN、自動ドッジには使わない

## 将来拡張

- Riot API token 未設定時の簡易 fallback
- LCU Swagger / OpenAPI による endpoint 仕様確認
- LCU のキャッシュ挙動の追加調査
