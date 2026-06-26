# Phase 01: TypeScript Typecheck Setup

目的は、既存ビルドを壊さず、型チェックだけを導入すること。まだ `.js` から `.ts` へ大量変換しない。

## 作業

1. `typescript` を devDependency に追加する。
2. `tsconfig.json` を追加する。
3. `package.json` に `typecheck` script を追加する。
4. `types/` ディレクトリを追加する。
5. `npm test` と `npm run typecheck` を通す。

## 初期 tsconfig 例

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

## 注意

- `checkJs` は最初は `false` にする。既存 JavaScript 全体に一気に型エラーを出さない。
- `noEmit` で開始する。既存の Electron 起動や build の成果物生成を変えない。
- `module` は CommonJS のまま始める。
- `strict` は最初から `true` にして、追加する型定義側は厳密にする。

## 完了条件

- `npm run typecheck` が追加されている。
- `npm test` が通る。
- `npm run typecheck` が通る。
- この段階では挙動差分がない。

## 作業証跡

結果は `docs/ts-magiration/save-data/phase-01-typecheck-setup-save-data.md` に追記する。

