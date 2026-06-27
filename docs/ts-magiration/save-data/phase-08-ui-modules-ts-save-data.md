# Phase 08 Save Data

このファイルに Phase 08 の作業証跡を追記する。

## 2026-06-26

- `ui/dom-elements.js` から `ui/dom-elements.ts` へ変換し、`UiDomElements` / `UiDomElementsApi` を `types/ui-globals.d.ts` に定義した。
- `ui/settings-view.js` / `ui/match-data-view.js` / `ui/champion-icons.js` を `.ts` 化し、`SettingsViewDeps` / `MatchDataViewDeps` / `ChampionIconLoader` を明示した。
- `ui/champion-pool-view.js` / `ui/stats-view.js` / `ui/in-game-view.js` / `ui/draft-view.js` を `.ts` 化し、各 `createXView(deps)` の deps 型を明示した。
- Browser script と CommonJS test の両方で既存の global module 公開を維持するため、UI 本体には runtime import を追加せず、global 型は `types/ui-globals.d.ts` に集約した。
- `npm run typecheck` 成功。
- `npm test` 成功。88 tests pass。
- `dist-app/main.js` を Electron で短時間起動し、Renderer bundle の smoke launch を確認した。

