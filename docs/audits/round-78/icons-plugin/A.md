# Audit round 78 — icons-plugin (blind reviewer)

## A compiled (non-source) module that stops naming icons keeps its old refs through watch rebuilds
- where: packages/icons-plugin/src/index.ts:166 (`compiled.transform`)
- scenario: under `vite build --watch` or rollup watch in app mode, a `.vue` file once held `icon('undo')`, so its transform recorded `refs: ['core:undo']` in `catalog.uses` (or `library.moduleRefs` in library mode). The file is edited so it no longer contains `icons.gen` or `@icon`. `compiled.transform` now returns `null` without calling `transform`, so `catalog.record` / `library.record` never runs for that id, and `keep(live)` keeps the entry because the module is still live. The stale ref stays in `refs`: `virtual:weasel-icons` keeps shipping the glyph, and if the glyph was also removed from its table, `settle` fails the rebuild with `icon "core:undo" is not in …'s table (named in x.vue)`. The main (`SOURCE`) path always reaches `record`, so the two paths disagree. It should record an empty use whenever it skips a module it may have recorded before.
- evidence: read
- severity: medium

## A build lets a package's built table override its source table, which dev explicitly avoids
- where: packages/icons-plugin/src/catalog.ts:72 (`settle`), with catalog.ts:27 (`tablesFrom`) and tables.ts:27 (`declaredTable`)
- scenario: an app builds a workspace package from source, so the package's own `src/*.ts` modules are in the build. Each such module's `pkg` is the package directory, and its `gens` include `src/icons.gen.ts`. `tablesFrom` returns the source tables (`tableBeside` on gens) first and the declared tables (`declaredTable(pkg)`, the built `dist` table whenever it exists) last. `add` merges same-owner tables with the later one winning (`{ ...held.icons, ...table.icons }`). So a glyph whose body was edited in source, with the package not rebuilt, ships with its stale `dist` body, and a glyph deleted from source is kept. `packageTables` (tables.ts:84) makes the opposite call for dev ("A linked package's code is served from source, so its built table can lag a glyph just added") and prefers the source tables. So the same question gets two different answers in two places.
- evidence: read (the ordering and merge are read; that weasel's own app builds resolve packages to source is inferred)
- severity: medium

## A namespace named `all` cannot be loaded as `virtual:weasel-icons/<namespace>`, and nothing says so
- where: packages/icons-plugin/src/catalog.ts:83 (`variant`), catalog.ts:44 (`add`)
- scenario: a package's table has namespace `all`. `virtual:weasel-icons/all` returns every table, not that namespace. `add` refuses a custom variant that collides with a namespace, but it does not refuse a namespace that collides with the reserved variant `all`, so the clash goes unreported. It should fail the way the custom-variant clash does.
- evidence: read
- severity: low

## An extensionless `./icons.gen` import is not followed when the generated file is `.tsx`, `.jsx`, `.mts` or `.mjs`
- where: packages/icons-plugin/src/tables.ts:134 (`genFile`); index.ts:44 (`genFiles` resolves through the bundler only for non-relative specifiers)
- scenario: `import { icon } from './icons.gen'` sits beside `icons.gen.tsx` (or `.mjs`). `genFile` tries only `base.ts`, `base.js`, `base` and the `.js`→`.ts` swap, so it finds nothing. Because the specifier is relative, `genFiles` never asks the bundler. `rewriteIconCalls` then warns that the import "names no icons.gen module this build can read" and leaves the calls unrewritten. Yet `GEN` / `GEN_FILE` (tables.ts:51, index.ts:56) and `ICONS_GEN` (rewrite.ts:6) all accept those extensions as icons.gen modules, so two places answer "is this an icons.gen" differently.
- evidence: read
- severity: low

## Identifiers in TS type and declaration positions count as "other uses" of `icon`, and `import icon = …` does not shadow
- where: packages/icons-plugin/src/scope.ts:85 (`OPAQUE`), scope.ts:48 (`lexicalNames`)
- scenario: four cases.
  - `x as typeof icon` and `y satisfies typeof icon`: the type there is a bare `TSTypeQuery`, not wrapped in `TSTypeAnnotation`, so its `exprName` Identifier `icon` reaches `onOther`.
  - `enum E { icon }`: the `TSEnumMember` id reaches `onOther`.
  - `function f(icon: string): void;`, an overload, and `declare function f(icon: string)`: both are `TSDeclareFunction`, which `FUNCTIONS` does not list, so the params are visited as references.
  
  In each case `rewriteIconCalls` warns "used other than as a direct call in N place(s)" for code that never uses the value. Separately, `namespace N { import icon = Other.fn; icon('x'); }` binds a local `icon` that `lexicalNames` does not list. That call gets rewritten into `/* @icon */ 'core:x'` even though it calls `Other.fn`.
- evidence: read (the node shapes follow ESTree-TS and are not run)
- severity: low

## The dev table watcher can throw out of a chokidar listener
- where: packages/icons-plugin/src/index.ts:76 (`watchTables`, `reread`)
- scenario: `readdirSync(dirname(file))` runs in the guard, before the `try`. When an `icons.table.json` change or add event arrives and its directory is already gone (a branch switch, or a generator that writes into a temp directory and renames it away), `readdirSync` throws ENOENT. The throw comes from the watcher's event emit, not as a logged warning like the JSON read failure below it. The guard should sit inside the `try`, or check that the directory exists.
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
