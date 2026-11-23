## Library mode exempts a minified IIFE from the stripped-annotation refusal under esbuild only; vite, rollup and rolldown still fail it
- where: packages/icons-plugin/src/index.ts:100 (guardEsbuild) vs packages/icons-plugin/src/annotate.ts:47 (libraryAnnotations.stripped), called from index.ts:155 (generateBundle)
- scenario: `weaselIcons.esbuild({ mode: 'library' })` with `format: 'iife', minify: true` builds, on the stated grounds that an IIFE is a finished script nobody bundles again (commit 496a55768c). The same library built by `weaselIcons.vite({ mode: 'library' })` with `build.lib.formats: ['iife']` (or `umd`), or rolldown with `output.format: 'iife', minify: true`, fails in `generateBundle`, because `stripped` checks every chunk and never looks at the output format. The question "does an IIFE's lost annotation matter" gets two answers depending on the bundler. Either the exemption belongs in `stripped` too (it would need the output options' `format`), or esbuild's exemption is wrong.
- evidence: read
- severity: medium

## guardEsbuild refuses an IIFE build that leaves `format` unset
- where: packages/icons-plugin/src/index.ts:101-102 (guardEsbuild)
- scenario: esbuild picks `iife` as the default format when `bundle: true` and `platform` is `browser` (also the default). `build({ bundle: true, minify: true, plugins: [weaselIcons.esbuild({ mode: 'library' })] })` writes an IIFE, but `initialOptions.format` is `undefined`, so `format !== 'iife'` holds and the build fails with MINIFIED. The same build with `format: 'iife'` written out passes. The check should read the format esbuild will actually use: `format ?? (bundle && (platform ?? 'browser') === 'browser' ? 'iife' : …)`.
- evidence: read (esbuild's default-format rule is from its documented behavior, not run here)
- severity: low

## Whether a package's declared table enters an app build depends on the file extension of the modules that came from it
- where: packages/icons-plugin/src/index.ts:122-126 (compiledPlugin.transform) and index.ts:159-162 (forget), against index.ts:184-187 (transform)
- scenario: every SOURCE module (`.ts`, `.js`, …) is recorded with `pkg: packageDir(file)` whether or not it names an icon, so `settle` reads that package's `weaselIcons.table` and puts it in `virtual:weasel-icons/all`, `/<namespace>` and the custom variants, and checks it for namespace collisions. A module that `compiledPlugin` handles (`.vue`, `.svelte`, `.mdx`) and holds neither `icons.gen` nor `@icon` is instead `forget`-ed and never recorded. A dependency made only of `.vue` components that do not name icons themselves therefore leaves its table out of `/all`, while the same package written in `.ts` puts it in. The two plugin halves answer "does this module bring its package's table" differently.
- evidence: read
- severity: low

## Dev and build disagree on which tables a package with a `weaselIcons` field but no built table provides
- where: packages/icons-plugin/src/tables.ts:85-87 (packageTables) vs tables.ts:23-31 (declaredTables), which catalog.ts:33 (tablesFrom) uses for a build
- scenario: a package whose `package.json` has `"weaselIcons": {}` (no `table`), or whose declared `table` is not built and which has no `src/` directory, with `icons.gen.ts` + `icons.table.json` at its root. In dev, `packageTables` sees `"weaselIcons"` in the manifest and falls back to `sources()`, which scans the package root, so its glyphs load. In a build, `settle` reads the package through `declaredTables`, which returns `[]` when `table` is absent and scans only `<pkg>/src` otherwise. A ref into that namespace works under `vite serve` and fails `vite build` with "no package in this build provides the icon namespace".
- evidence: read
- severity: low

## The module-level export check warns on `export { type icon }`, which the import-side checks skip
- where: packages/icons-plugin/src/rewrite.ts:80-86 (rewriteIconCalls, second pass over `program.body`)
- scenario: `import { icon } from './icons.gen'; export { type icon };` (allowed under `isolatedModules`) re-exports only the type. The first pass skips `exportKind === 'type'` specifiers (line 60), but the second pass's `node.specifiers.some((e) => locals.has(nameOf(e.local)))` has no such check, so `unfollowed('re-export')` warns that calls "can miss a trimmed build" for a re-export that carries no value. One file answers "does a type-only specifier count as a re-export" both ways.
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

<!-- done: 5 findings, files read: 12 -->
