# TypeScript Migration Index for AI Agents

このディレクトリは、TypeScript 移行計画を生成AIへ渡しやすい単位に分割したものです。

長大な総合ドキュメントを毎回読ませない。作業エージェントには、原則として次だけ渡す。

1. `docs/ts-magiration/common.md`
2. 対象 phase の `docs/ts-magiration/phase-XX-*.md`
3. 対象 phase の作業証跡ファイル `docs/ts-magiration/save-data/phase-XX-*-save-data.md`

## Phase 一覧

- Phase 00: `phase-00-current-state.md`
- Phase 01: `phase-01-typecheck-setup.md`
- Phase 02: `phase-02-domain-types.md`
- Phase 03: `phase-03-ipc-preload-types.md`
- Phase 04: `phase-04-jsdoc-bridge.md`
- Phase 05: `phase-05-pure-logic-ts.md`
- Phase 06: `phase-06-ts-build.md`
- Phase 07: `phase-07-main-modules-ts.md`
- Phase 08: `phase-08-ui-modules-ts.md`
- Phase 09: `phase-09-renderer-split-ts.md`
- Phase 10: `phase-10-main-split-ts.md`
- Phase 11: `phase-11-checkjs-policy.md`
- Phase 12: `phase-12-docs-and-closeout.md`

## 作業証跡

TypeScript 移行の作業証跡は、従来の `docs/refactoring-for-ai-agents-save-data.md` ではなく、Phase ごとに以下へ残す。

```text
docs/ts-magiration/save-data/phase-XX-*-save-data.md
```

各 Phase の完了時は、対応する save-data ファイルへ以下を追記する。

- 実施日
- 変更した主なファイル
- 型定義した主な shape
- `.ts` 化したファイル
- runtime / build への影響
- 確認したコマンド
- 未実施の確認
- 次の推奨作業
- 注意点

