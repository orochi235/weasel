## A followed `icon` used other than as a direct call is neither rewritten nor warned about, so its glyphs silently miss a trimmed build
- where: packages/icons-plugin/src/scope.ts:99 (unshadowedCalls), packages/icons-plugin/src/rewrite.ts:86 (rewriteIconCalls)
- scenario: `import { icon } from './icons.gen'; const refs = ['undo', 'redo'].map(icon);` or `const f = icon; f('undo')`, or ``icon`undo` `` or `icon!('undo')` (TS non-null: the callee is a TSNonNullExpression, not an Identifier). Each yields `core:undo` at run time, but `unshadowedCalls` only reports a `CallExpression` whose callee is the bare Identifier, so none is rewritten, none is counted in `dynamic`, and none gets the "computed name resolve only from a loaded variant" warning. `virtual:weasel-icons` then leaves out `core:undo`/`core:redo` without a word. The same file warns about a computed argument (`icon(name)`) and about re-exports of `icon`, both of which lose glyphs the same way. Any reference to a followed local that is not a direct callee should count as dynamic, or get the `unfollowed` warning.
- evidence: read
- severity: medium

## The shadowing walk skips two scopes: a `var` in a class `static {}` block and a declaration in a TS `namespace` body don't hide the import
- where: packages/icons-plugin/src/scope.ts:104-106 (unshadowedCalls; StaticBlock case, and no TSModuleBlock case)
- scenario: `class K { static { var icon = (n) => n; icon('x'); } }`: a static block is a var scope of its own, but the `StaticBlock` case adds only `lexicalNames`, and `varNames` never runs on it (VAR_BARRIERS stops at ClassBody, so the enclosing function doesn't count it either). The local call gets rewritten to `/* @icon */ 'core:x'`, which changes what the program does, and a ref to a glyph that may not exist lands in the build, so `settle` can fail. Likewise `namespace N { const icon = (n: string) => n; icon('x'); }`: the TSModuleDeclaration body is a `TSModuleBlock`, which goes through the default `children` path, so its `const`/`function`/`var` declarations never shadow the import and its calls are rewritten.
- evidence: read
- severity: low

## In dev, `virtual:weasel-icons` is never invalidated, so tables found later or glyphs added while serving are missing until a restart
- where: packages/icons-plugin/src/index.ts:123-135 (transform dev branch, load)
- scenario: under `vite serve`, `load` serializes `catalog.variant(...)` once and vite caches it. A table that `transform` adds to the catalog later (a gen outside `reachableTables`' walk, read through `tablesFrom(gens, fresh)`) never reaches the already-loaded module. A glyph regenerated into `icons.table.json` mid-session isn't seen either: the plugin has no `handleHotUpdate`/`hotUpdate`, no `addWatchFile` on the table files and no module invalidation, so `<Icon>` for the new glyph renders missing until the dev server restarts. The `catalog.add` in the dev branch therefore affects only modules loaded after it, which depends on transform order.
- evidence: read (grep for handleHotUpdate/addWatchFile/invalidate in src: none)
- severity: low

## `assertBundler` looks the mode up through the prototype chain
- where: packages/icons-plugin/src/bundlers.ts:11 (assertBundler)
- scenario: a JS (untyped) caller passes `weaselIcons.vite({ mode: 'toString' })` or `'constructor'`. `BUNDLERS[mode]` returns `Object.prototype.toString`, which is truthy, so the friendly "mode must be 'library' or 'app'" error is skipped and `allowed.includes` throws `TypeError: allowed.includes is not a function`. It needs `Object.hasOwn(BUNDLERS, mode)`.
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

<!-- done: 4 findings, files read: 12 -->
