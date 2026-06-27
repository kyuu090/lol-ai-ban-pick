# Phase 10: Split and Convert Main Entry

目的は、`main.js` を Electron lifecycle と service 組み立てに近づけること。Match history orchestration、LCU orchestration、lane matchup state machine を独立させる。

## 分割候補

```text
main/
  bootstrap.ts
  lcu-controller.ts
  match-history-controller.ts
  lane-matchup-controller.ts
  state-publisher.ts
```

## 作業順

1. [x] state publish / window broadcast を `main/state-publisher.ts` へ移す。
2. [x] LCU refresh / reconnect / gameflow update orchestration を `main/lcu-controller.ts` へ移す。
3. [x] Riot match history collect orchestration を `main/match-history-controller.ts` へ移す。
4. [x] lane matchup analysis readiness / request / retry / result apply を `main/lane-matchup-controller.ts` へ移す。
5. [x] Electron app lifecycle と service construction を `main/bootstrap.ts` へ整理する。
6. [x] `main.ts` は bootstrap 呼び出しだけに近づける。

## 注意

- Electron app lifecycle を変えない。
- IPC 登録順序を変えない。
- LCU lockfile retry と websocket reconnect timer の動作を変えない。
- ChampSelect 中に重い Riot API 自動取得を走らせない制約を維持する。
- Riot API 429 時の partial save / UI reflection を維持する。
- raw match detail を Debug state やログへ常時表示しない。
- LCU password / Basic auth header をログへ出さない。

## 完了条件

- [x] `main` 入口が 200-400 行程度を目指して薄くなっている。
  - `main.ts`: 2 行。
  - `main/bootstrap.ts`: 327 行。
- [x] orchestration 単位の型が明示されている。
- [x] `npm run typecheck` が通る。
- [x] `npm test` が通る。
- [x] Electron 起動確認を行う。
  - この環境では通常起動が Chromium GPU process の初期化で終了したため、`BANPICK_AI_DISABLE_GPU=1` と Chromium GPU 無効化フラグ付きで 8 秒 smoke 起動を確認した。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-10-main-split-ts-save-data.md` に追記する。

