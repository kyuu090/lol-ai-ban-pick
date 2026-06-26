# Phase 02: Shared Domain Types

目的は、生成AIが最初に読む型の入口を作ること。`main.js` / `renderer.js` を広く読まなくても state shape を把握できる状態にする。

## 作業

1. `types/domain.d.ts` を追加する。
2. 既存コードの実データ shape に合わせて型を定義する。
3. 不確かな型には `unknown` を使い、推測で細かくしすぎない。
4. null になり得る値は明示的に `null` を含める。
5. 外部 API raw response は必要最小限だけ型にする。

## 優先して定義する型

- `ThemeMode`
- `RiotPlatformRegion`
- `RiotRegionalRoute`
- `PublicSettings`
- `ChampionPoolLaneId`
- `ChampionPool`
- `ChampionSummaryItem`
- `ChampionsById`
- `LcuStatus`
- `WebSocketStatus`
- `GameflowPhase`
- `Summoner`
- `Lobby`
- `ChampSelectSession`
- `ChampSelectAction`
- `ChampSelectMember`
- `AppState`
- `MatchHistoryStatus`
- `MatchHistorySummary`
- `ChampionStats`
- `EnemyChampionStats`
- `LaneOpponentStats`
- `SelfVsLaneOpponentStats`
- `DraftPanelState`
- `PickPhaseDraftContext`
- `FinalCompositionDraftContext`
- `InGameContext`
- `LaneMatchupAnalysisContext`
- `AiAnalysisStatus`
- `AiAnalysisNote`
- `AiAnalysisResponse`

## 注意

- LCU のレスポンスは実環境差分があり得る。最初から過剰に厳密にしない。
- `championId` は number。
- 未選択 champion は `0` または `null` が出る箇所を既存コードに合わせて確認する。
- `position` は Riot / LCU 由来の大文字値と ChampionPool lane id を混同しない。
- `queueGroup` と `queueType` は文字列 union にする候補。ただし未知値 fallback があるなら `string` を残す。
- API error や raw details は `unknown` を許容する。

## 完了条件

- `types/domain.d.ts` に主要 state / domain 型が定義されている。
- 既存コードの shape と矛盾していない。
- `npm run typecheck` が通る。
- `npm test` が通る。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-02-domain-types-save-data.md` に追記する。

