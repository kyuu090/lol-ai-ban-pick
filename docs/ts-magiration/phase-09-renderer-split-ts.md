# Phase 09: Split and Convert Renderer

目的は、`renderer.js` を初期化、状態同期、イベントバインド、AI analysis orchestration に分けること。画面修正時に `renderer` 全体を読まなくてよい状態を作る。

## 分割候補

```text
renderer/
  state.ts
  navigation.ts
  state-sync.ts
  champion-pool-controller.ts
  match-history-controller.ts
  ai-analysis-controller.ts
  draft-controller.ts
  init.ts
```

## 作業順

1. `renderer.js` 内の module-level state を `renderer/state.ts` に集約する。
2. タブ切り替え、active view、stats subtab を `renderer/navigation.ts` に移す。
3. `window.lcuApi.onState` 受信と再描画 orchestration を `renderer/state-sync.ts` に移す。
4. ChampionPool 保存 / dirty state / lane selection を `renderer/champion-pool-controller.ts` に移す。
5. Match history collect button / menu state を `renderer/match-history-controller.ts` に移す。
6. Pick phase / final composition / lane matchup analysis request を `renderer/ai-analysis-controller.ts` に移す。
7. Draft 固有の controller を `renderer/draft-controller.ts` に移す。
8. 最後に `renderer.ts` または `renderer/init.ts` を入口として薄くする。

## 注意

- `renderer.js` の分割では global state を複製しない。
- 状態は 1 箇所に持ち、controller へ getter / setter または state object を渡す。
- AI request の in-flight key / status / error / notes を見失わない。
- ChampSelect への自動タブ遷移条件を変えない。
- ChampionPool の保存済み / dirty 表示を壊さない。
- `index.html` の script 読み込み順を必ず確認する。

## 完了条件

- `renderer` 入口が初期化中心になっている。
- `renderer` 関連型が明示されている。
- `npm run typecheck` が通る。
- `npm test` が通る。
- Electron 起動で Draft / ChampionPool / Stats / Settings / Debug を確認する。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-09-renderer-split-ts-save-data.md` に追記する。

