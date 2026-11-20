# icons-plugin findings (round 50)

## A `const`/`let`/`function`/`var` inside a TypeScript `namespace` does not shadow the imported `icon`
- where: packages/icons-plugin/src/scope.ts:81-125 (unshadowedCalls → visit)
- scenario: `import { icon } from './icons.gen'; namespace N { const icon = (s: string) => s; export const x = icon('local'); }` → visit has no case for `TSModuleDeclaration`/`TSModuleBlock`, so it descends through `children(node, hidden)` and never adds the block's own declarations. The inner call gets rewritten to `/* @icon */ 'core:local'`. That changes what the program does, and in app mode `settle` then fails the build on a glyph nobody asked for. The same happens with `var icon` or `function icon` in the namespace body. The module is inconsistent with itself here: `VAR_BARRIERS` already treats `TSModuleDeclaration` as a scope boundary, and `LEXICAL_DECLARATIONS` binds the namespace's name, but the body never gets its own scope. The call should be left alone, as it is for a `BlockStatement`.
- evidence: read
- severity: low

## A `var` inside a class `static { }` block does not shadow the imported `icon`
- where: packages/icons-plugin/src/scope.ts:104-106 (unshadowedCalls, `StaticBlock` case)
- scenario: `import { icon } from './icons.gen'; class K { static { var icon = String; K.v = icon('x'); } }` → a `var` in a static block is scoped to that block, but the `StaticBlock` case only passes `lexicalNames(node.body)`, which skips `var`. `varNames` also stops at `ClassBody`, so no enclosing function collects it either. The call is rewritten to `'core:x'`. It should be treated like a function body: `varNames` plus `lexicalNames`.
- evidence: read
- severity: low

## Using `icon` as a value (`const g = icon`, `list.map(icon)`) gives no warning, unlike re-exports and namespace/default imports
- where: packages/icons-plugin/src/rewrite.ts:76-96 (rewriteIconCalls)
- scenario: `import { icon } from './icons.gen'; const names = ['undo', 'redo'].map(icon);` or `const g = icon; g('undo')` → `unshadowedCalls` only visits `CallExpression`s whose callee is the local, so a reference that is not a call is neither rewritten nor counted in `dynamic`, and `unfollowed` is never called. In app mode `virtual:weasel-icons` is trimmed to the collected refs, so `core:undo` silently goes missing from the build. The plugin warns that glyphs "can miss a trimmed build" for every other way `icon` escapes (re-export, `export { icon as x }`, namespace import, default import, computed argument), but not this one. It should warn, or count the reference as dynamic.
- evidence: read
- severity: medium

## `vite build --mode test` runs the dev path: nothing trimmed, missing glyphs not checked
- where: packages/icons-plugin/src/index.ts:148 (configResolved)
- scenario: `dev = config.command === 'serve' || config.mode === 'test'`. Vitest already runs vite with `command: 'serve'`, so the `mode === 'test'` clause only changes behavior for a production build run as `vite build --mode test`, a common way to make a staging/test build. In that build, `transform` skips `catalog.record`, `load` writes every reachable table inline (`USED` returns all tables in dev), and `buildEnd` returns before `settle`. The app ships every glyph, and an `icon('typo')` no table holds builds without error, where a `--mode production` build of the same code fails. The `command` alone should decide.
- evidence: read
- severity: medium

## `icon()` calls in Vue/Svelte/Astro SFC script blocks are skipped without a warning
- where: packages/icons-plugin/src/index.ts:97 (transformInclude)
- scenario: vite serves a Vue SFC's script as `App.vue?vue&type=script&setup=true&lang.ts`. `transformInclude` strips the query and tests `App.vue` against `SOURCE`, which rejects it, so the TS that `import { icon } from './icons.gen'` lives in is never rewritten or collected, and its package dir is never recorded. In app mode those glyphs drop out of the trimmed `virtual:weasel-icons`, and the build gives no warning or error. The `lang.ts` query marks the request as script, so either test the full id against `SOURCE`, or at least warn.
- evidence: read
- severity: low

## The fallback scan in `collectIconRefs` drops refs, contrary to its docstring ("never drops one")
- where: packages/icons-plugin/src/collect.ts:5,43 (collectIconRefs, `ANNOTATED`)
- scenario: when a module does not parse, refs come from `ANNOTATED`, which only matches `'…'`/`"…"` and returns the raw source text. So `/* @icon */ \`core:x\`` (which the parsed path accepts through `stringLiterals`' TemplateLiteral case) is dropped. A ref with an escape, such as the `'core:\ud800'` that `rewriteIconCalls` itself writes for a lone surrogate, or a bundler's `"core:\xe9"`, comes back as the literal backslash text `core:\ud800`, so it names a ref no table holds. The two paths give different answers for the same annotated literal.
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
