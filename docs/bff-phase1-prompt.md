# Task: Create `lol-ai-banpick-bff`

新規Node.jsプロジェクトとして `lol-ai-banpick-bff` を作成してください。

この文書は Riot API allowlist proxy の Phase1 実装プロンプトである。BFF 全体の目的、OpenAI API 連携、課金防御、quota、cache、in-flight lock などの上位設計は `docs/bff-design.md` を参照する。

## 目的

League of Legends用Electronアプリ `lol-ai-banpick` からRiot APIキーを取り除くための、Phase1 BFFを実装する。

Phase1ではDBは使わない。薄いallowlist proxyとして動作させる。

Riot APIキーはサーバ側の環境変数 `RIOT_API_KEY` から読む。

自由URL proxyは絶対に作らない。

## 技術要件

- Node.js
- HTTP server frameworkは軽量でよい。ExpressでもFastifyでも可。
- package managerはnpm。
- テストを追加する。
- ローカル起動用READMEを書く。
- Cloud Runに載せやすい構成にする。
- Dockerfileを追加する。
- JSON APIのみ。
- 例外時もRiot APIキーをログ/レスポンスへ絶対に出さない。

## 実装するAPI

### 1. `GET /health`

レスポンス:

```json
{
  "ok": true
}
```

### 2. `GET /api/riot/:region/account/by-riot-id/:gameName/:tagLine`

動作:

- `region` は必須path param。
- `region` はRiot platform region。
- 許可されたRiot platform regionのみ受け付ける。
- `gameName` と `tagLine` をpath paramから受け取る。
- Riot Account-V1を呼ぶ。
- Account-V1は `region -> regional route` に変換してregional hostを使う。
- 例: `JP1 -> ASIA`, endpoint host `asia.api.riotgames.com`
- Riot API:
  - `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`

レスポンスはRiot APIのJSONをそのまま返す。

### 3. `GET /api/riot/:region/matches/by-puuid/:puuid/ids?start=0&count=90&startTime=...`

動作:

- `region` は必須path param。
- `region` はRiot platform region。
- 許可されたRiot platform regionのみ受け付ける。
- `start` 省略時は `0`。0以上の整数のみ。
- `count` 省略時は `90`。1〜100の整数のみ。
- `startTime` は任意。指定された場合はUnix秒の0以上整数のみ。
- 将来用に `endTime` も任意で許可してよい。指定された場合はUnix秒の0以上整数のみ。
- Match-V5のmatch id listを呼ぶ。
- Match-V5は `region -> regional route` に変換してregional hostを使う。
- Riot API:
  - `/lol/match/v5/matches/by-puuid/{puuid}/ids?start={start}&count={count}&startTime={startTime}&endTime={endTime}`

レスポンス:

```json
{
  "matchIds": ["JP1_..."]
}
```

### 4. `GET /api/riot/:region/matches/details?matchIds=JP1_1,JP1_2,JP1_3`

動作:

- `region` は必須path param。
- `region` はRiot platform region。
- 許可されたRiot platform regionのみ受け付ける。
- `matchIds` は必須query param。
- `matchIds` はカンマ区切り文字列。
- 1〜10件のみ許可。
- trimする。
- 空要素があれば400。
- 重複はdedupeしてよい。
- 各matchIdは `^[A-Z0-9]+_[0-9]+$` で検証する。
- Match-V5のmatch detailを複数取得する。
- Riot APIにはBFF内部で並列取得してよい。
- 並列数は3〜5程度。
- 一部失敗しても成功分は返す。
- 全部失敗でも、Riot APIキーは絶対に露出しない。
- Match-V5は `region -> regional route` に変換してregional hostを使う。
- Riot API:
  - `/lol/match/v5/matches/{matchId}`

レスポンス:

```json
{
  "matchesById": {
    "JP1_123": { "metadata": {}, "info": {} }
  },
  "failedMatchIds": ["JP1_456"]
}
```

## Riot region仕様

以下のplatform regionsを許可する。

```text
BR1, EUN1, EUW1, JP1, KR, LA1, LA2, NA1, OC1, TR1, RU, PH2, SG2, TH2, TW2, VN2
```

platform -> regional route:

```text
BR1, LA1, LA2, NA1 -> AMERICAS
EUN1, EUW1, TR1, RU -> EUROPE
JP1, KR -> ASIA
OC1, PH2, SG2, TH2, TW2, VN2 -> SEA
```

## HTTP/Riot client仕様

- Riot APIへは `X-Riot-Token: process.env.RIOT_API_KEY` を付ける。
- `Accept: application/json` を付ける。
- `RIOT_API_KEY` が未設定なら起動時またはリクエスト時に安全にエラーにする。
- Riot APIが429を返した場合、`Retry-After` を見て最大3回までリトライする。
- `Retry-After` がなければ短いbackoffを使う。
- Riot APIが2xx以外なら、BFFは適切なHTTP statusを返す。
- ただしレスポンス本文は安全に整形し、キーや内部詳細を出さない。
- 404などはなるべく元statusを保つ。
- 5xxやネットワークエラーは502などで返す。

## セキュリティ/制限

- 自由URLを受け取るproxyは作らない。
- host/pathをクライアントに指定させない。
- 許可された上記3種類のRiot API用途だけ実装する。
- region whitelistを必ず使う。
- `count` 上限100。
- `details` の `matchIds` 上限10。
- ログに `RIOT_API_KEY`, `X-Riot-Token`, `Authorization` 相当の値を出さない。
- CORSはPhase1では必要最小限。
- Electronから使う想定なので、デフォルト無効か環境変数で許可originを指定できる程度でよい。

## プロジェクト構成案

```text
src/
  server.js
  config.js
  riotRegions.js
  riotClient.js
  validators.js
  routes/
    health.js
    riot.js
test/
  riotRegions.test.js
  validators.test.js
  routes.test.js
Dockerfile
README.md
package.json
```

## テスト観点

- region normalize/validation
- platform -> regional route変換
- `count` / `start` / `startTime` validation
- `matchIds` csv parse:
  - `"JP1_1,JP1_2"` -> `["JP1_1", "JP1_2"]`
  - 空要素は400相当
  - 11件は400相当
  - 不正matchIdは400相当
  - 重複はdedupe
- Riot clientが `X-Riot-Token` を付ける
- APIキーがレスポンスに出ない
- `/health` がokを返す
- routesはRiot APIをmock/stubしてテストする

## READMEに書くこと

- `npm install`
- `RIOT_API_KEY=... npm run dev`
- `npm test`
- endpoint例
- Cloud Runデプロイ時は `RIOT_API_KEY` をSecret/環境変数で入れること
- Phase1はDBなし
- Phase2でDB cacheを追加予定

## 実装後

- `npm test` を実行して通す。
- 可能なら `npm start` または `npm run dev` で起動確認する。
