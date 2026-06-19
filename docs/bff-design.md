# BFF Design

## 目的

BanPick-ai の Electron クライアントから、外部 API の秘密鍵と課金リスクを切り離すために BFF を置く。

クライアントは League Client のローカル状態を読み取り、必要な構造化 context だけを BFF へ送る。BFF は許可された用途だけを外部 API へ中継し、秘密鍵、rate limit、quota、cache、ログ、異常検知を一元管理する。

```text
Electron client
  -> BFF
    -> Riot API
    -> OpenAI API
```

## BFF が必要な理由

- Riot API key をクライアントから外す
- OpenAI API key をクライアントから外す
- OpenAI API の想定外課金を防ぐ
- ユーザー別 rate limit / quota を持つ
- draft context を検証し、raw state や秘密情報を弾く
- 同じ draft context を cache し、無駄な AI 実行を減らす
- model / max output tokens / endpoint をサーバー側で固定または制限する
- usage / estimated cost を記録し、異常検知できるようにする

クライアントに開発者側の API key を同梱しない。Electron アプリはローカルアプリだが、配布後は改造や解析を前提に考える。クライアント側の disabled button、cooldown、難読化だけでは課金防御にならない。

## Phase 方針

### Phase 1: Riot API allowlist proxy

DBなしの薄い allowlist proxy として始める。詳細な実装プロンプトは `docs/bff-phase1-prompt.md` に置く。

目的:

- Electron クライアントから Riot API key を取り除く
- Account-V1 と Match-V5 の必要 endpoint だけを許可する
- 自由 URL proxy を作らない

Phase 1 で許可する用途:

- Riot ID から PUUID を取得する
- Match-V5 の match id list を取得する
- Match-V5 の match detail を最大10件ずつ取得する

### Phase 2: AI Draft Brief / Game Plan

OpenAI API 連携は BFF 経由で行う。AI の役割は勝率予測ではなく、ドラフト状況の整理と説明役に限定する。

想定 endpoint:

```text
POST /api/ai/draft-brief
POST /api/ai/game-plan
```

`draft-brief` は PICK タイミングで使う。味方の予定 pick、味方の確定 pick、敵の確定 pick、BAN 済み champion、ChampionPool 候補、対面マークがある場合の同一ロール対面実績を整理して渡す。

`game-plan` は InProgress 開始時に使う。ChampSelect 終了時点の両チーム構成、自分の champion / role / 自己戦績、同一ロール対面が分かる場合の direct matchup 実績を渡し、ゲーム展開の要約を返す。

## 秘密情報の扱い

BFF の秘密情報:

```text
RIOT_API_KEY
OPENAI_API_KEY
```

扱い:

- 環境変数または Secret Manager から読む
- Git に入れない
- Docker image に焼き込まない
- レスポンスに含めない
- ログに出さない
- 例外 message に混ざらないよう sanitize する
- 漏洩が疑わしい場合は key を rotate する

Electron クライアント、Renderer、Debug state には BFF の秘密鍵を返さない。

## OpenAI 課金防御

OpenAI 側の月額 budget / usage limit は最後の保険として設定する。ただし、アプリ運用上の主な防御線は BFF に置く。

必須の防御:

- user 単位の rate limit
- user 単位の日次 / 月次 quota
- 全体の日次 / 月次 budget kill switch
- model と max output tokens のサーバー側固定
- request body size の上限
- context schema validation
- context hash cache
- in-flight lock
- timeout
- usage / estimated cost logging

例:

```text
1 user:
  10 requests / hour
  30 requests / day
  $0.20 / day
  $3.00 / month

global:
  $5 / day
  $50 / month
```

上限に到達した場合、BFF は OpenAI API を呼ばずに `429`, `402`, `403`, `503` のいずれかを用途に応じて返す。

## AI endpoint 制限

自由 prompt proxy を作らない。クライアントが任意の model、messages、temperature、max tokens を指定できる形にしない。

BFF 側で固定または制限する値:

- model
- max output tokens
- temperature
- response format
- system prompt
- endpoint 用途

クライアントから受け取るのは、許可された構造化 context だけにする。

## Context validation

`draft-brief` の context 上限例:

```text
body size: 16KB
allyIntendedPicks: max 5
allyLockedPicks: max 5
enemyLockedPicks: max 5
ally bans: max 5
enemy bans: max 5
candidatePicks: max 5
```

禁止:

- raw `appState` 全体
- raw Riot match detail
- Riot API token
- OpenAI API key
- LCU password
- Basic 認証ヘッダ
- debug.log の内容

## Context hash cache

同じ draft 状態では AI を再実行しない。

hash 入力例:

```text
endpoint
user id
phase
current role
local intended / locked champion
ally intended picks
ally locked picks
enemy locked picks
bans
candidate picks
marked opponent champion
```

TTL 例:

```text
draft-brief: 2〜5分
game-plan: 10〜30分
```

同じ hash の結果が cache にあれば OpenAI API を呼ばずに返す。

## In-flight lock

同じ user、endpoint、context hash の生成が進行中なら、後続 request は新しく OpenAI API を呼ばない。

対応案:

- 既存の生成結果を待つ
- `202 Accepted` として生成中を返す
- 短い retry after を返す

## Logging

記録するもの:

```text
user id
endpoint
model
input token count
output token count
estimated cost
context hash
cache hit
status
latency
```

記録しないもの:

- API key
- Authorization header
- LCU password
- raw prompt 全文
- raw match detail
- debug state 全体

prompt や context の全文保存が必要な場合は、明示的な開発モードに限定し、個人情報と秘密情報の sanitize を通す。

## Client 側の補助防御

クライアント側の防御は BFF の代替ではなく補助として扱う。

- AI 実行中はボタンを disabled にする
- 連打 cooldown を置く
- 自動実行は phase change、pick lock、InProgress 開始などの節目に限定する
- ChampSelect の細かい hover / intent event ごとに AI を呼ばない
- BFF から quota error が返ったら UI に分かりやすく表示する

## 実装順

1. `docs/bff-phase1-prompt.md` に沿って Riot API allowlist proxy を作る
2. BFF に user 識別、rate limit、quota の最小実装を入れる
3. Electron 側に AI Draft Brief / Game Plan の context builder を作る
4. BFF に `/api/ai/draft-brief` を追加する
5. context validation、context hash cache、in-flight lock を追加する
6. `/api/ai/game-plan` を追加する
7. usage / estimated cost logging と global kill switch を追加する

