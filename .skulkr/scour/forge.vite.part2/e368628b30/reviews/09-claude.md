# forge.vite.part2 findings

## `closeServer` is not a vite plugin hook, so the capture endpoint's Chromium is never closed with the dev server
- where: packages/forge/src/vite/plugin.ts:201 (forge, plugin object)
- scenario: open the workshop, take a capture (Chromium launches in `serveCapture`), then close or restart the dev server (`server.close()`, a config-file restart). Vite calls `buildEnd`/`closeBundle`/`closeWatcher` on close, never `closeServer`, so `capture.close()` never runs: the launched Chromium keeps running and the cache stays. Each restart that captured leaves another browser. Nothing else in `packages/forge/src/vite` hooks the server closing (grep for `httpServer`, `on('close'`, `closeBundle` finds only watchRecovery's `buildEnd`).
- evidence: read
- severity: medium
- fix: packages/forge/src/vite/plugin.ts
- size: line
- cause: hook name vite does not call
- confidence: likely

## Two `packageNameOf` implementations answer "which package is this file in" differently
- where: packages/forge/src/vite/typedoc/index.ts:107 (packageNameOf)
- scenario: `packageName.ts` exports `packageNameOf(file, top)`, bounded by `top` and returning null; `typedoc/index.ts` keeps a private copy taking a directory, unbounded, returning undefined. A fix to one (e.g. the prefix bound below) does not reach the other, and the two already differ in what bounds the climb.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## `packageNameOf`'s `top` bound is a string prefix, so a sibling directory sharing the prefix counts as under `top`
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `top = '/repo/app'`, file `/repo/app-other/src/x.ts` (outside top). `dir.startsWith(top)` is true for `/repo/app-other/src`, `/repo/app-other`, so a manifest there is returned although it is not at or under `top`. Should compare path segments (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: string prefix instead of path containment
- confidence: sure

## Destructuring a numeric key off a namespace import records a number as the imported name
- where: packages/forge/src/vite/moduleInfo.ts:53 (moduleInfo, declareStatement)
- scenario: `import * as ns from './m'; const { 0: zero } = ns;` — `p.key` is a NumericLiteral, cast to StringLiteral, so `imported` becomes the number `0`, not `'0'`. `trace.declaring` then does `mod.exports.get(0)`, which never matches the string-keyed export map. Should be `String(p.key.value)` or skip non-identifier/string keys.
- evidence: read
- severity: low
- size: line
- cause: unchecked cast of property key
- confidence: sure

## `export default interface` is read as a value default export
- where: packages/forge/src/vite/moduleInfo.ts:96 (moduleInfo, ExportDefaultDeclaration)
- scenario: `export default interface Props { … }` — `decl.type` is `TSInterfaceDeclaration`, not Function/Class/Identifier, so it falls to `declare(DEFAULT_LOCAL, decl)` and `exports.set('default', local)`, making a type-only export look like a value export that `declaring(..., 'default')` resolves to a binding. Type declarations (`TSInterfaceDeclaration`, `TSDeclareFunction`) should be skipped like `import type`.
- evidence: read
- severity: low
- size: line
- cause: type-only default not filtered
- confidence: likely

## A type definition declared `export default interface` prints with a stray `default` keyword
- where: packages/forge/src/vite/typeDefs.ts:71 (addTypeDef)
- scenario: a props type written `export default interface ButtonProps { … }` prints as `export default interface ButtonProps {…}`; the regex `^(export\s+)?(declare\s+)?` strips `export ` only, leaving `default interface ButtonProps {…}` in the API panel's type definition.
- evidence: read
- severity: low
- size: line
- cause: modifier regex misses `default`
- confidence: sure

## Files read
packages/forge/src/vite/moduleInfo.ts
packages/forge/src/vite/nativeExports.ts
packages/forge/src/vite/ownEntries.ts
packages/forge/src/vite/ownKeys.ts
packages/forge/src/vite/packageName.ts
packages/forge/src/vite/plugin.ts
packages/forge/src/vite/posixPath.ts
packages/forge/src/vite/propControls.ts
packages/forge/src/vite/propTypes.ts
packages/forge/src/vite/servePages.ts
packages/forge/src/vite/shellTitle.ts
packages/forge/src/vite/storyGlob.ts
packages/forge/src/vite/storyIndex.ts
packages/forge/src/vite/storybookShims.ts
packages/forge/src/vite/titleReport.ts
packages/forge/src/vite/trace.ts
packages/forge/src/vite/typeDefs.ts
packages/forge/src/vite/typedoc/index.ts
packages/forge/src/vite/typedoc/json.ts
packages/forge/src/vite/typedoc/print.ts
packages/forge/src/vite/virtualModules.ts
packages/forge/src/vite/warnOnce.ts
packages/forge/src/vite/watchProbe.ts
packages/forge/src/vite/watchRecovery.ts
packages/forge/src/vite/watchSettle.ts
packages/forge/src/vite/wrappers.ts

<!-- done: 6 findings, files read: 26 -->
