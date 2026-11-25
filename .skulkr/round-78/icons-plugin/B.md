# icons-plugin — audit round 78 findings

## A package's declared (built) table overrides the source table beside the icons.gen a module imports, so a stale `dist/icons.table.json` wins
- where: packages/icons-plugin/src/catalog.ts:27 (tablesFrom), catalog.ts:67 (settle), catalog.ts:51 (add merge order); packages/icons-plugin/src/tables.ts:28 (declaredTable); packages/icons-plugin/src/index.ts:160 (dev transform)
- scenario: an app builds a workspace package from source (e.g. `packages/core/src/...` reached through an alias), and that package declares `weaselIcons.table: "./dist/icons.table.json"` (core, ui, editing, diagram, … all do) with a `dist` built before a glyph's body was edited. A module in `packages/core/src` imports `./icons.gen`, so `gens` holds the source gen and `pkg` is `packages/core`. `tablesFrom` returns `[...gens tables, ...pkg tables]`, and `add` merges `{ ...held.icons, ...table.icons }`, so the dist table, added second, replaces the source glyph bodies (and a glyph removed from source survives from dist). The build ships the old glyph; the same happens in dev, where `reachableTables` loads the source table first and the first transform of a module in that package then adds the dist table over it (and sends a full reload because it "changed"), and the next transform importing the source gen flips it back, reloading again. The order is also not the module-id order unruled.md (2026-11-11) rules for two disagreeing tables of one namespace and owner: a declared table always beats a gen table. `packageTables` (tables.ts:76) already prefers source for a linked package because "its built table can lag a glyph just added"; `declaredTable` answers the same question the other way. Expected: the source table beside the gen the module actually imports wins over the package's built one.
- evidence: read
- severity: medium

## Library mode under esbuild has no check that the `@icon` annotations survived, so a minified esbuild build ships unannotated refs silently
- where: packages/icons-plugin/src/index.ts:200-211 (plugin hooks), packages/icons-plugin/src/bundlers.ts:6
- scenario: `weaselIcons.esbuild({ mode: 'library' })` with esbuild `minify: true` (or `minifyWhitespace`). esbuild drops plain block comments when minifying, so `/* @icon */ "fx:ring"` becomes `"fx:ring"`. Under vite/rollup/rolldown the `generateBundle` hook runs `library.stripped(bundle)` and fails the build with a fix-it message, and `renderChunk` re-annotates; neither hook is wired for esbuild (only `vite`, `rollup`, `rolldown` keys get them), so the esbuild path neither restores nor reports. An app consuming that library then collects no ref from it and its trimmed `virtual:weasel-icons` misses those glyphs. The test (plugin.build.test.ts:210) only covers unminified esbuild output. Expected: the same guarantee on every bundler library mode admits — an `onEnd` check over the output, or refuse `minify` under esbuild.
- evidence: read (hook wiring); inference (esbuild's minifier dropping non-legal block comments)
- severity: medium

## `declaredTable`'s unbuilt fallback takes the first source table under `src` while dev's `packageTables` takes all of them
- where: packages/icons-plugin/src/tables.ts:30 (declaredTable)
- scenario: a workspace package declaring `weaselIcons.table` whose table is not yet built, with more than one icons.gen + icons.table.json under `src` (a second namespace, or a test fixture directory under `src`, which `sourceTablesUnder` only skips for this plugin's own fixtures). `sourceTablesUnder(...)[0]` returns whichever `readdirSync` order yields first, so the build (via `settle` → `tablesFrom` → `declaredTable`) gets one table, possibly the fixture's, and fails "no package in this build provides the icon namespace" for a ref to the other, or registers a fixture namespace; dev's `packageTables` (tables.ts:91) returns every source table for the same package. Two answers to "what tables does this package provide".
- evidence: read
- severity: low

## Identifiers in type positions outside `TSTypeAnnotation` are reported as non-call uses of `icon`
- where: packages/icons-plugin/src/scope.ts:85-94 (OPAQUE), scope.ts:127-130 (Identifier visit)
- scenario: `const x = y as typeof icon;`, `y satisfies typeof icon`, `<typeof icon>y`, `class A implements icon {}` — TSAsExpression/TSSatisfiesExpression/TSTypeAssertion hold their type as a bare TSType (TSTypeQuery → `exprName` Identifier), not under a TSTypeAnnotation, so the walk reaches the Identifier and calls `onOther`. Likewise a parameter named like the local in an overload signature or `declare function` (`TSDeclareFunction`, not in FUNCTIONS, so its params are visited as plain Identifiers), an abstract method's params, and a `TSEnumMember` whose id is that name. Each makes `rewriteIconCalls` warn "used other than as a direct call … their glyphs can miss a trimmed build" for something that is no runtime use at all.
- evidence: read
- severity: low

## A JSX element naming the imported `icon` binding is neither rewritten nor warned about
- where: packages/icons-plugin/src/scope.ts:127 (Identifier only)
- scenario: `import { icon as Icon } from './icons.gen'; … <Icon name="x" />` (or `<Icon />` passed anywhere) in a `.tsx` file. The element name is a `JSXIdentifier`, which the walk never treats as a reference, so `onOther` is not called and the "used other than as a direct call" warning (unruled.md 2026-11-20) is skipped for this form, while `list.map(icon)` and `const f = icon` get it.
- evidence: read
- severity: low

## `watchTables` reads the table's directory outside its `try`, so a table whose directory vanishes throws out of the watcher listener
- where: packages/icons-plugin/src/index.ts:73 (watchTables reread)
- scenario: a generator writes `icons.table.json` and its directory is removed (a clean step, a branch switch) before chokidar's `add`/`change` event is handled: `readdirSync(dirname(file))` throws ENOENT in the event listener, outside the `try` that turns a bad read into a logger warning, instead of being skipped or warned.
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

<!-- done: 6 findings, files read: 12 -->
