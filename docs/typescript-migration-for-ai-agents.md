# TypeScript Migration Plan for AI-Assisted Maintenance

この文書は、後続の生成AIエージェントが TypeScript 化を安全に完了するための作業計画です。

目的は「生成AIが修正時に読む必要のある文脈を減らし、型情報から変更範囲を推測できる状態を作ること」です。単なる型安全化ではなく、AI が誤読しやすいデータ形状、IPC 境界、副作用境界を明示することを主目的にする。

## 前提

- このリポジトリの Markdown / docs は UTF-8 without BOM。
- PowerShell 5.1 で Markdown を読むときは必ず `Get-Content <file> -Encoding UTF8` を使う。
- 現在のアプリは Electron / Node.js / CommonJS / HTML / CSS / JavaScript。
- React や Vite などのフロントエンドフレームワークは使っていない。
- `nodeIntegration: false`、`contextIsolation: true`、`preload.js` + `contextBridge` 構成を維持する。
- 危険な LCU 操作、自動ピック、自動BAN、自動ドッジ、ゲーム操作自動化、メモリ読み取り、クライアント改ざんは実装しない。
- Riot API key / OpenAI API key / BFF secret は Electron クライアントに入れない。
- 既存の CommonJS 構成を最初から ESM へ変えない。

## 参照すべき既存ドキュメント

作業前に次を読む。

1. `AGENTS.md`
2. `docs/AGENTS_CONTEXT.md`
3. `docs/development.md`
4. `docs/refactoring-for-ai-agents.md`
5. `docs/refactoring-for-ai-agents-save-data.md`
6. この文書

特に `docs/refactoring-for-ai-agents-save-data.md` は、前回までのエージェント作業ログとして扱う。作業後は同ファイルへ TypeScript 移行作業の証跡を追記する。

## 最重要方針

- 一度に全ファイルを `.ts` 化しない。
- まず型定義を追加し、AI が型だけ読めばデータ形状を把握できる状態を作る。
- ビルド方式を変える前に `typecheck` を導入する。
- 挙動変更と型移行を混ぜない。
- CommonJS から ESM への移行は TypeScript 化の必須条件にしない。
- 大きなファイルほど最後に扱う。
- 入口ファイルである `main.js` と `renderer.js` は、型が揃ってから薄くする。
- 変換対象は、純粋関数、小さい store、service、UI view、入口ファイルの順に進める。
- 作業単位ごとに `npm test` と `npm run typecheck` を通す。

## TypeScript 化で解決したい問題

生成AIが現在つまずきやすい点:

- `appState` の shape を把握するために `main.js`、`main/app-state.js`、`renderer.js`、複数 UI view を読む必要がある。
- `window.lcuApi` の引数と返り値が `preload.js` と IPC handler を読まないと分からない。
- `champSelect`、`matchHistoryStatus`、`championStats`、`draftContext` の nullability がコード上から推測しづらい。
- Riot / LCU / BFF / AI analysis のレスポンス形状が暗黙的。
- Renderer の view module が受け取る `deps` の構造がファイルごとに違い、型がないと依存関係を追いづらい。
- `main.js` と `renderer.js` が orchestration を多く持ち、AI が小変更でも広く読んでしまう。

TypeScript 化後の理想:

- 状態 shape は `types/` または `src/types/` を見れば分かる。
- IPC channel の入力と出力は型で一覧できる。
- `window.lcuApi` の公開 API は型で固定される。
- `DraftContext`、`InGameContext`、`AiAnalysisResponse` は型だけで扱える。
- `main/` service の `deps` は factory 引数の型で読める。
- UI view は `createXView(deps)` の型から必要依存が分かる。

## 推奨される最終構成

最終形の目安。途中段階ではこの通りでなくてよい。

```text
package.json
tsconfig.json

types/
  domain.d.ts
  ipc.d.ts
  preload.d.ts
  electron.d.ts

main.ts または main.js
renderer.ts または renderer.js
preload.ts または preload.js

main/
  app-state.ts
  window.ts
  ipc-handlers.ts
  settings-store.ts
  champion-pool-store.ts
  match-history-store.ts
  ai-analysis-service.ts
  riot-match-history-service.ts
  lcu-client.ts
  lcu-watch.ts

ui/
  dom-elements.ts
  formatters.ts
  champion-icons.ts
  champion-pool-view.ts
  stats-view.ts
  draft-view.ts
  in-game-view.ts
  settings-view.ts
  match-data-view.ts
```

TypeScript 導入初期は `.d.ts` と `.js` の混在でよい。最終的に全変換できるなら `.ts` へ寄せる。

## Phase 0: 現状確認

作業前に必ず確認する。

```powershell
git status --short
npm test
```

確認すること:

- 未コミット変更がある場合、ユーザーまたは前エージェントの変更として扱い、勝手に戻さない。
- `npm test` の現在の通過件数を作業ログに残す。
- `package.json` の scripts、build.files、main entry を確認する。
- `index.html` の script 読み込み順を確認する。

現時点で大きい主要ファイルの目安:

- `renderer.js`
- `main.js`
- `ui/draft-view.js`
- `draft-logic.js`
- `lcu-logic.js`
- `ui/stats-view.js`
- `ui/in-game-view.js`

最新の行数は作業時に再確認すること。

## Phase 1: TypeScript をチェック専用で導入

目的:

- 既存ビルドを壊さず、型チェックだけを追加する。
- まだ `.js` から `.ts` へ大量変換しない。

作業:

1. `typescript` を devDependency に追加する。
2. `tsconfig.json` を追加する。
3. `package.json` に `typecheck` script を追加する。
4. `types/` ディレクトリを追加する。
5. `npm test` と `npm run typecheck` を通す。

初期 `tsconfig.json` の例:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "*.js",
    "main/**/*.js",
    "ui/**/*.js",
    "test/**/*.js",
    "types/**/*.d.ts"
  ]
}
```

注意:

- `checkJs` は最初は `false` にする。既存 JavaScript 全体に一気に型エラーを出さない。
- `noEmit` で開始する。既存の Electron 起動や build の成果物生成を変えない。
- `module` は CommonJS のまま始める。
- `strict` は最初から `true` にして、追加する型定義側は厳密にする。

完了条件:

- `npm run typecheck` が追加されている。
- `npm test` が通る。
- `npm run typecheck` が通る。
- この段階では挙動差分がない。

## Phase 2: 共有ドメイン型を追加

目的:

- 生成AIが最初に読む型の入口を作る。
- `main.js` / `renderer.js` を広く読まなくても state shape を把握できる状態にする。

作業:

1. `types/domain.d.ts` を追加する。
2. 既存コードの実データ shape に合わせて型を定義する。
3. 不確かな型には `unknown` を使い、推測で細かくしすぎない。
4. null になり得る値は明示的に `null` を含める。
5. 外部 API raw response は必要最小限だけ型にする。

優先して定義する型:

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

型設計の注意:

- LCU のレスポンスは実環境差分があり得る。最初から過剰に厳密にしない。
- `championId` は number。
- 未選択 champion は `0` または `null` が出る箇所を既存コードに合わせて確認する。
- `position` は Riot / LCU 由来の大文字値と ChampionPool lane id を混同しない。
- `queueGroup` と `queueType` は文字列 union にする候補。ただし未知値 fallback があるなら `string` を残す。
- API error や raw details は `unknown` を許容する。

完了条件:

- `types/domain.d.ts` に主要 state / domain 型が定義されている。
- 既存コードの shape と矛盾していない。
- `npm run typecheck` が通る。
- `npm test` が通る。

## Phase 3: IPC と preload の型を追加

目的:

- Renderer から見える API を型だけで理解できるようにする。
- IPC channel の入出力を固定し、main / renderer 間の誤修正を減らす。

作業:

1. `types/ipc.d.ts` を追加する。
2. `types/preload.d.ts` を追加する。
3. `window.lcuApi` の global 型を定義する。
4. `preload.js` の公開 API と型を一致させる。
5. `main/ipc-handlers.js` の channel 一覧と型を対応させる。

最低限定義する `window.lcuApi`:

```ts
interface LcuApi {
  getState(): Promise<AppState>;
  refresh(): Promise<AppState>;
  getChampionIcon(championId: number): Promise<string | null>;
  getChampionPool(): Promise<ChampionPool>;
  saveChampionPool(championPool: ChampionPool): Promise<ChampionPool>;
  log(level: string, message: string, details?: unknown): void;
  getSettings(): Promise<PublicSettings>;
  chooseLolInstallDir(): Promise<string | null>;
  updateLolInstallDir(lolInstallDir: string): Promise<PublicSettings>;
  updateRiotPlatformRegion(riotPlatformRegion: string): Promise<PublicSettings>;
  updateThemeMode(themeMode: ThemeMode): Promise<PublicSettings>;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  onWindowMaximized(callback: (isMaximized: boolean) => void): () => void;
  collectRiotMatchHistory(options: CollectRiotMatchHistoryOptions): Promise<unknown>;
  requestPickPhaseAnalysis(draftContext: PickPhaseDraftContext): Promise<AiAnalysisResponse>;
  requestFinalCompositionAnalysis(draftContext: FinalCompositionDraftContext): Promise<AiAnalysisResponse>;
  onState(callback: (state: AppState) => void): () => void;
}
```

注意:

- 実際の戻り値が `void` ではない場合は既存実装に合わせる。
- `collectRiotMatchHistory` の戻り値は実装を確認してから型を絞る。
- `chooseLolInstallDir` はキャンセル時の shape を確認する。
- 型と実装が食い違った場合、挙動変更ではなく型を既存実装へ合わせる。

完了条件:

- Renderer で `window.lcuApi` の型が解決できる。
- `preload.js` を読まなくても公開 API が分かる。
- `npm run typecheck` が通る。
- `npm test` が通る。

## Phase 4: JSDoc で既存 JavaScript に型を接続

目的:

- `.ts` 変換前に、AI が関数単位で型を読める状態を作る。
- 大きなファイルへいきなり `checkJs` をかけず、小さいファイルから型情報を増やす。

作業:

1. 小さい純粋関数ファイルから `// @ts-check` を追加する。
2. `@param` / `@returns` で `types/domain.d.ts` の型を参照する。
3. 型エラーを直す場合は挙動変更を避ける。
4. 必要なら helper 型を `types/` に追加する。

優先順:

1. `match-history-workflow.js`
2. `ui/formatters.js`
3. `main/champion-pool-store.js`
4. `main/match-history-store.js`
5. `main/app-state.js`
6. `main/settings-store.js`
7. `draft-logic.js`
8. `lcu-logic.js`
9. `riot-api.js`
10. `riot-match-history.js`

注意:

- `renderer.js` と `main.js` に `// @ts-check` を付けるのは後回し。
- DOM 依存が強い UI view も後回し。
- JSDoc が複雑になりすぎる場合は `.ts` 変換へ進む。

完了条件:

- 小さいファイルに型付き JSDoc が入っている。
- `npm run typecheck` が通る。
- `npm test` が通る。

## Phase 5: 純粋ロジックを `.ts` 化

目的:

- 低リスクで型の恩恵が大きいロジックから TypeScript 化する。
- テスト済みの関数を先に固める。

推奨順:

1. `match-history-workflow.js` -> `match-history-workflow.ts`
2. `ui/formatters.js` -> `ui/formatters.ts`
3. `draft-logic.js` -> `draft-logic.ts`
4. `lcu-logic.js` -> `lcu-logic.ts`
5. `riot-api.js` -> `riot-api.ts`
6. `riot-match-history.js` -> `riot-match-history.ts`

作業:

1. 対象ファイルを 1 つだけ `.ts` 化する。
2. require している側の import path / require path を確認する。
3. Node test から読み込めるか確認する。
4. Electron runtime が読み込める形式で出力されるか確認する。

重要:

- `.ts` ファイルを Node / Electron が直接 require できない場合、ビルド手順が必要になる。
- 初期段階で `noEmit` のまま `.ts` 化すると runtime から読み込めない。
- `.ts` 化を始める前に、次のどちらかを選ぶ。

選択肢 A: `tsc` で `dist-js/` のような出力先へ CommonJS を emit し、Electron の entry を出力先へ切り替える。

選択肢 B: しばらく `.js` のまま JSDoc + `.d.ts` で運用し、実ファイルの `.ts` 化は後回しにする。

推奨:

- まず Phase 1-4 を完了する。
- 実 `.ts` 化に入る前に、最小のビルド方式を決める。
- Electron packaging へ影響が出るため、`.ts` 化 PR と build entry 変更 PR を分けるか、極小単位で進める。

完了条件:

- 対象ファイルが TypeScript として型チェックされる。
- runtime から読み込める。
- `npm test` が通る。
- `npm run typecheck` が通る。
- 必要なら `npm start` または `npm run dev` で起動確認する。

## Phase 6: TypeScript emit / build 方針を確定

目的:

- `.ts` ファイルを本格的に増やしても Electron が動く状態を作る。

推奨方針:

- `tsc` で CommonJS に emit する。
- `src/` への大移動は最初はしない。
- 出力先は `dist-app/` など、既存 `dist/` と衝突しない名前にする。
- `electron-builder` の `build.files` に出力先と必要 assets を含める。
- 開発起動 script は出力後に Electron を起動する。

例:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "compile": "tsc",
    "start": "npm run compile && electron dist-app/main.js",
    "dev": "npm run compile && node scripts/run-dev.js"
  }
}
```

ただし、`scripts/run-dev.js` が `electron .` 前提の場合は、出力先 entry を受け取れるようにするか、`package.json` の `main` を切り替える必要がある。

注意:

- `index.html`、`styles/`、`assets/`、`img/` のパス解決を壊さない。
- Renderer script の読み込みパスを出力先に合わせる必要がある。
- `preload.js` / `preload.ts` の path は BrowserWindow の `webPreferences.preload` と一致させる。
- Electron Builder の `files` に emitted JS が含まれることを確認する。
- `debug.log` などのログファイルを出力先に混ぜない。

完了条件:

- `npm run compile` が通る。
- `npm test` が通る。
- `npm run typecheck` が通る。
- `npm start` または `npm run dev` で Electron が起動する。
- packaged build の対象ファイルが確認されている。

## Phase 7: main 配下を `.ts` 化

目的:

- Electron main process の service / store / state を型で読めるようにする。
- `main.js` の orchestration を薄くする準備をする。

推奨順:

1. `main/settings-store.js`
2. `main/champion-pool-store.js`
3. `main/match-history-store.js`
4. `main/app-state.js`
5. `main/ai-analysis-service.js`
6. `main/riot-match-history-service.js`
7. `main/lcu-client.js`
8. `main/lcu-watch.js`
9. `main/window.js`
10. `main/ipc-handlers.js`

各ファイルでやること:

- factory 引数の `deps` 型を定義する。
- 戻り値の service interface を定義する。
- file IO / network / Electron API の副作用境界を型で明示する。
- `unknown` を受け取る箇所は normalize 関数で domain 型に寄せる。

特に型を明示するもの:

- `SettingsStore`
- `ChampionPoolStore`
- `MatchHistoryStore`
- `AppStatePatch`
- `LcuClient`
- `LcuWatch`
- `RiotMatchHistoryService`
- `AiAnalysisService`
- `IpcHandlers`

注意:

- `main/lcu-client.js` は LCU password / Basic 認証ヘッダを扱うため、ログ出力に混ぜない。
- `main/lcu-watch.js` は timer / websocket reconnect を持つため、型移行時に lifecycle を変えない。
- `main/window.js` は Electron API 依存が強いため、テストでは syntax / typecheck 中心でよい。
- `main/ipc-handlers.js` は IPC channel 名を変えない。

完了条件:

- 対象ファイルが `.ts` 化されている。
- `npm run typecheck` が通る。
- `npm test` が通る。
- Electron の起動確認が必要な変更では `npm start` または `npm run dev` を確認する。

## Phase 8: UI module を `.ts` 化

目的:

- Renderer の各 view module が受け取る `deps` を型で固定する。
- DOM 操作と view model 作成の境界を明確にする。

推奨順:

1. `ui/formatters.ts` は Phase 5 で完了済みならスキップ。
2. `ui/dom-elements.js`
3. `ui/settings-view.js`
4. `ui/match-data-view.js`
5. `ui/champion-icons.js`
6. `ui/champion-pool-view.js`
7. `ui/stats-view.js`
8. `ui/in-game-view.js`
9. `ui/draft-view.js`

各 view module でやること:

- `createXView(deps)` の `deps` 型を定義する。
- DOM element 型を必要に応じて `HTMLElement | null` で表現する。
- null check を明示する。
- ViewModel を作れる箇所は `createXViewModel` として分ける。
- DOM 書き換え関数と純粋な表示データ生成を分離する。

特に型を明示するもの:

- `UiDomElements`
- `ChampionIconLoader`
- `ChampionPoolViewDeps`
- `StatsViewDeps`
- `DraftViewDeps`
- `InGameViewDeps`
- `SettingsViewDeps`
- `MatchDataViewDeps`

注意:

- `ui/draft-view.js` は大きく依存が多いため最後にする。
- `window.DraftLogic`、`window.UiFormatters` などの global module 型を `types/preload.d.ts` または `types/ui-globals.d.ts` に定義する。
- DOM query 結果は存在しない可能性を型に含める。ただし既存挙動を変えない。
- UI の見た目変更を混ぜない。

完了条件:

- 対象 UI module が `.ts` 化されている。
- `npm run typecheck` が通る。
- `npm test` が通る。
- DOM 表示に関わる変更では Electron 起動またはスクリーンショット確認を行う。

## Phase 9: `renderer.js` を分解して `.ts` 化

目的:

- `renderer.js` を初期化、状態同期、イベントバインド、AI analysis orchestration に分ける。
- AI が画面修正時に `renderer` 全体を読まなくてよい状態にする。

分割候補:

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

作業順:

1. `renderer.js` 内の module-level state を `renderer/state.ts` に集約する。
2. タブ切り替え、active view、stats subtab を `renderer/navigation.ts` に移す。
3. `window.lcuApi.onState` 受信と再描画 orchestration を `renderer/state-sync.ts` に移す。
4. ChampionPool 保存 / dirty state / lane selection を `renderer/champion-pool-controller.ts` に移す。
5. Match history collect button / menu state を `renderer/match-history-controller.ts` に移す。
6. Pick phase / final composition / lane matchup analysis request を `renderer/ai-analysis-controller.ts` に移す。
7. Draft 固有の controller を `renderer/draft-controller.ts` に移す。
8. 最後に `renderer.ts` または `renderer/init.ts` を入口として薄くする。

注意:

- `renderer.js` の分割では global state を複製しない。
- 状態は 1 箇所に持ち、controller へ getter / setter または state object を渡す。
- AI request の in-flight key / status / error / notes を見失わない。
- ChampSelect への自動タブ遷移条件を変えない。
- ChampionPool の保存済み / dirty 表示を壊さない。
- `index.html` の script 読み込み順を必ず確認する。

完了条件:

- `renderer` 入口が初期化中心になっている。
- `renderer` 関連型が明示されている。
- `npm run typecheck` が通る。
- `npm test` が通る。
- Electron 起動で Draft / ChampionPool / Stats / Settings / Debug を確認する。

## Phase 10: `main.js` を分解して `.ts` 化

目的:

- `main.js` を Electron lifecycle と service 組み立てに近づける。
- Match history orchestration、LCU orchestration、lane matchup state machine を独立させる。

分割候補:

```text
main/
  bootstrap.ts
  lcu-controller.ts
  match-history-controller.ts
  lane-matchup-controller.ts
  state-publisher.ts
```

作業順:

1. state publish / window broadcast を `main/state-publisher.ts` へ移す。
2. LCU refresh / reconnect / gameflow update orchestration を `main/lcu-controller.ts` へ移す。
3. Riot match history collect orchestration を `main/match-history-controller.ts` へ移す。
4. lane matchup analysis readiness / request / retry / result apply を `main/lane-matchup-controller.ts` へ移す。
5. Electron app lifecycle と service construction を `main/bootstrap.ts` へ整理する。
6. `main.ts` は bootstrap 呼び出しだけに近づける。

注意:

- Electron app lifecycle を変えない。
- IPC 登録順序を変えない。
- LCU lockfile retry と websocket reconnect timer の動作を変えない。
- ChampSelect 中に重い Riot API 自動取得を走らせない制約を維持する。
- Riot API 429 時の partial save / UI reflection を維持する。
- raw match detail を Debug state やログへ常時表示しない。
- LCU password / Basic auth header をログへ出さない。

完了条件:

- `main` 入口が 200-400 行程度を目指して薄くなっている。
- orchestration 単位の型が明示されている。
- `npm run typecheck` が通る。
- `npm test` が通る。
- Electron 起動確認を行う。

## Phase 11: `checkJs` の扱いを決める

目的:

- 残った `.js` ファイルにも型チェックを広げるか判断する。

選択肢:

- 残り `.js` が少ないなら `.ts` 化を完了する。
- assets / scripts / tests など `.js` 維持が自然なものは JSDoc + `// @ts-check` にする。
- 全体に `checkJs: true` をかけるのは、主要 runtime ファイルの型移行後にする。

注意:

- test files に過剰な型対応を入れすぎない。
- `node:test` の簡潔さを維持する。
- 開発補助 script は必要な範囲で型を付ける。

完了条件:

- 型チェック対象と対象外の理由が明確になっている。
- `tsconfig.json` の include / exclude が整理されている。
- `npm run typecheck` が安定して通る。

## Phase 12: ドキュメント更新

TypeScript 移行の各作業後に更新するもの:

- `docs/refactoring-for-ai-agents-save-data.md`
- `docs/AGENTS_CONTEXT.md`
- `docs/development.md`
- 必要なら `README.md`
- 必要なら `docs/refactoring-for-ai-agents.md`

`docs/refactoring-for-ai-agents-save-data.md` に残す内容:

- 実施日
- phase 名
- 変更した主なファイル
- 型定義した主な shape
- `.ts` 化したファイル
- runtime / build への影響
- 確認したコマンド
- 未実施の確認
- 次の推奨作業
- 注意点

## 型定義の粒度ガイド

良い型:

- 既存データ shape を忠実に表す。
- nullability が明示されている。
- 外部入力は normalize 前に `unknown` を許容する。
- 内部で使う正規化後データは union / interface で明確。
- IPC の戻り値が Promise か sync か分かる。

避ける型:

- 実装を読まずに推測で作った細かすぎる型。
- LCU raw response を過剰に厳密化した型。
- `any` だらけの型。
- 1 つの巨大な `AppState` だけに全部を押し込む設計。
- Renderer 専用型と Main 専用型を混ぜすぎる設計。

`any` の扱い:

- 新規型では原則使わない。
- 外部 API raw response や Electron API mock で必要なら局所的に使う。
- `any` を使ったら、コメントで理由を書くか、後続 TODO として作業ログに残す。
- 迷う場合は `unknown` を使い、normalize 関数で絞る。

## 命名ガイド

- domain 型は名詞: `AppState`, `ChampionPool`, `MatchHistoryStatus`
- options は `XOptions`
- deps は `XDeps`
- service interface は `XService`
- normalized data は `NormalizedX`
- raw external data は `RawX`
- IPC map は `IpcInvokeChannels`, `IpcSendChannels`
- Renderer global は `LcuApi`

## テスト方針

各 phase で原則実行:

```powershell
npm test
npm run typecheck
```

`.ts` emit や Electron entry に触った場合:

```powershell
npm run compile
npm start
```

必要に応じて:

```powershell
node --check <file>
```

ただし `.ts` ファイルには `node --check` は使えない。TypeScript ファイルは `npm run typecheck` または `npm run compile` で確認する。

UI 表示や CSS / DOM / script 読み込み順に触った場合:

- Electron 起動確認を行う。
- 少なくとも Draft / ChampionPool / Stats / Settings / Debug の初期表示を確認する。
- Champion icon lazy loading に触った場合は、LCU 未接続時にクラッシュしないことも確認する。

外部接続系に触った場合:

- LCU 未起動時にクラッシュしない。
- lockfile 未検出 retry が続く。
- LCU password / Basic auth header がログに出ない。
- Riot API / BFF error 時に UI が壊れない。
- 429 handling の挙動を維持する。

## 作業単位の推奨コミット

1. `chore add typescript typecheck`
2. `types add shared domain shapes`
3. `types add preload and ipc contracts`
4. `types annotate pure js modules`
5. `refactor convert workflow helpers to typescript`
6. `refactor convert draft and lcu logic to typescript`
7. `build compile typescript for electron runtime`
8. `refactor convert main stores to typescript`
9. `refactor convert main services to typescript`
10. `refactor convert ui utility modules to typescript`
11. `refactor convert ui views to typescript`
12. `refactor split renderer controllers`
13. `refactor split main controllers`

実際のコミット名はユーザーの運用に合わせる。

## 完了判定

TypeScript 移行全体の完了条件:

- `npm run typecheck` が安定して通る。
- `npm test` が安定して通る。
- Electron runtime が TypeScript emit 後のファイルで起動できる。
- `main` / `renderer` / `preload` / `main/` / `ui/` の主要 runtime ファイルが `.ts` または `// @ts-check` + JSDoc で型管理されている。
- `AppState`、IPC、`window.lcuApi`、Draft context、Match history、AI analysis response の型が明文化されている。
- `main.js` または `main.ts` は service 組み立てと lifecycle 中心になっている。
- `renderer.js` または `renderer.ts` は初期化と controller 接続中心になっている。
- 後続AIが、機能修正時に型定義と該当 module だけを読めば作業開始できる。
- TypeScript 移行の履歴が `docs/refactoring-for-ai-agents-save-data.md` に残っている。

## 後続AIへの注意

- この計画は「一気にやる指示」ではない。安全な小さい単位に分けて進める。
- 既存挙動の維持を優先する。
- 型エラーを消すために runtime の意味を変えない。
- 不明な外部 response は `unknown` と normalize で扱う。
- LCU / Riot / BFF / AI analysis は副作用境界を壊さない。
- package / build / Electron entry を触ったら、必ず起動確認まで行う。
- 作業後は必ず作業ログを残す。
