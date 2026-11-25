# icons-plugin findings, audit round 79

## esbuild library guard refuses a minified bundle whose format defaults to IIFE
- where: packages/icons-plugin/src/index.ts:101 (guardEsbuild)
- scenario: `esbuild.build({ bundle: true, minify: true, plugins: [weaselIcons.esbuild({ mode: 'library' })] })` with no `format` and the default `platform: 'browser'`. esbuild writes an IIFE here, because with bundling on and a browser platform its default format is `iife`. The guard compares `format !== 'iife'` against the raw `initialOptions.format`, which is `undefined`, so it fails the build with MINIFIED. The same build with `format: 'iife'` written out is let through. The exemption should key on the format esbuild actually emits: `format ?? (bundle && platform !== 'node' && platform !== 'neutral' ? 'iife' : undefined)`.
- evidence: read (the code). The esbuild default format is from esbuild's documented behavior, not a run.
- severity: low

## A `declare function` in a namespace does not shadow the imported `icon`
- where: packages/icons-plugin/src/scope.ts:23 (LEXICAL_DECLARATIONS, used by lexicalNames)
- scenario: a TS module imports `{ icon }` from `./icons.gen` and contains `namespace N { declare function icon(n: string): string; export const a = icon('x'); }`. Inside N, `icon` resolves to N's own ambient declaration. `lexicalNames` only collects `ClassDeclaration`, `FunctionDeclaration`, enums, namespaces and import-equals, so a `TSDeclareFunction` declares no name. The TSModuleBlock scope therefore leaves `icon` unhidden, and `rewriteIconCalls` replaces N's call with `/* @icon */ 'core:x'`. That changes the program (the call to N's function is gone) and adds a ref the module never named. `TSDeclareFunction` is listed in FUNCTIONS but missing from LEXICAL_DECLARATIONS.
- evidence: read
- severity: low

## Files read
packages/icons-plugin/src/annotate.ts
packages/icons-plugin/src/bundlers.ts
packages/icons-plugin/src/catalog.ts
packages/icons-plugin/src/collect.ts
packages/icons-plugin/src/index.ts
packages/icons-plugin/src/parse.ts
packages/icons-plugin/src/pbt.fixture.ts
packages/icons-plugin/src/rewrite.ts
packages/icons-plugin/src/scope.ts
packages/icons-plugin/src/tables.ts
packages/icons-plugin/src/virtual.ts
packages/icons-plugin/src/walk.ts

<!-- done: 2 findings, files read: 12 -->
