# Phase 08: Convert UI Modules to TypeScript

目的は、Renderer の各 view module が受け取る `deps` を型で固定すること。DOM 操作と view model 作成の境界を明確にする。

## ステータス

完了。作業証跡は `docs/ts-magiration/save-data/phase-08-ui-modules-ts-save-data.md` を参照。

## 推奨順

1. `ui/formatters.ts` は Phase 05 で完了済みならスキップ。
2. `ui/dom-elements.js`
3. `ui/settings-view.js`
4. `ui/match-data-view.js`
5. `ui/champion-icons.js`
6. `ui/champion-pool-view.js`
7. `ui/stats-view.js`
8. `ui/in-game-view.js`
9. `ui/draft-view.js`

## 作業

- `createXView(deps)` の `deps` 型を定義する。
- DOM element 型を必要に応じて `HTMLElement | null` で表現する。
- null check を明示する。
- ViewModel を作れる箇所は `createXViewModel` として分ける。
- DOM 書き換え関数と純粋な表示データ生成を分離する。

## 特に型を明示するもの

- `UiDomElements`
- `ChampionIconLoader`
- `ChampionPoolViewDeps`
- `StatsViewDeps`
- `DraftViewDeps`
- `InGameViewDeps`
- `SettingsViewDeps`
- `MatchDataViewDeps`

## 注意

- `ui/draft-view.js` は大きく依存が多いため最後にする。
- `window.DraftLogic`、`window.UiFormatters` などの global module 型を `types/preload.d.ts` または `types/ui-globals.d.ts` に定義する。
- DOM query 結果は存在しない可能性を型に含める。ただし既存挙動を変えない。
- UI の見た目変更を混ぜない。

## 完了条件

- 対象 UI module が `.ts` 化されている。
- `npm run typecheck` が通る。
- `npm test` が通る。
- DOM 表示に関わる変更では Electron 起動またはスクリーンショット確認を行う。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-08-ui-modules-ts-save-data.md` に追記する。

