## `closeServer` is not a vite plugin hook, so the capture endpoint (and its headless Chromium) is never closed
- where: packages/forge/src/vite/plugin.ts:201 (forge, plugin object)
- scenario: start a dev server, request a capture (launches Chromium through `serveCapture`), then `server.close()` or restart the server on a config edit. Vite's server close runs the plugin container's `buildEnd`/`closeBundle`, never a `closeServer` property, so `capture.close()` never runs: the browser and its contexts outlive the server. A restart leaks one per restart. Should close from `buildEnd`/`closeBundle` (as watchRecovery does with `buildEnd`) or from `server.httpServer`'s `close` event inside `configureServer`.
- evidence: read (no `closeServer` in vite's Plugin hooks; grep found no other caller)
- severity: medium
- fix: packages/forge/src/vite/plugin.ts
- size: line
- cause: nonexistent hook name
- confidence: likely

## `mayBeStory` resolves a name inside a function against the file's top-level bindings, ignoring parameters and locals that shadow it
- where: packages/forge/src/vite/nativeExports.ts:118 (mayBeStory, Identifier case; reached via mayReturnStory/returnsStory)
- scenario: `const s = { a: 1 }; const keep = (s) => s; export const Primary = keep(story(...));` — the call resolves `keep`, its body returns `s`, and `s` is looked up in `scope.bindings` (top level) → `{ a: 1 }` → an object with no spread → false. A real story export is judged not a story and dropped from the loader. Same with a `const` declared inside the function body that shares a top-level name. A name a function binds itself should read as unknown (true), as an unresolved name does.
- evidence: read
- severity: low
- size: function
- cause: no scope tracking inside function bodies
- confidence: likely

## Two copies of "the nearest package.json name" that answer differently
- where: packages/forge/src/vite/typedoc/index.ts:116 (packageNameOf)
- scenario: `packageName.ts` exports `packageNameOf(file, top)`; typedoc/index.ts has its own private `packageNameOf(dir)` that walks the same way but returns `undefined` rather than `null`, takes a directory rather than a file, and has no upper bound. One decision, two pathways that can drift (the shared one was changed this week; this copy was not).
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated helper
- confidence: sure

## `packageNameOf`'s `top` bound is a string prefix, so a sibling directory sharing the prefix counts as under it
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `packageNameOf('/repo/pkg-extra/src/a.ts', '/repo/pkg')`: `'/repo/pkg-extra/src'.startsWith('/repo/pkg')` is true, so the walk reads `/repo/pkg-extra/src/package.json` and `/repo/pkg-extra/package.json` and can return a package outside `top`. Should compare by path segment (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: prefix test without separator
- confidence: sure

## A numeric key in a namespace destructure is recorded as a number, not a string import name
- where: packages/forge/src/vite/moduleInfo.ts:53 (moduleInfo, declareStatement)
- scenario: `import * as ns from './x'; const { 0: zero } = ns;` — `p.key` is a NumericLiteral, cast to StringLiteral, and `nameOf` returns its numeric `value`, so `imports.get('zero').imported` is the number `0`, breaking the `Import.imported: string` contract and `mod.exports.get(0)` lookups in trace (finds nothing where `'0'` is the export). Should `String()` it or skip non-identifier/string keys.
- evidence: read
- severity: low
- size: line
- cause: unchecked cast of key node
- confidence: sure

## `fileEventsArrive` leaks the watcher when an injected `watch` reports synchronously
- where: packages/forge/src/vite/watchProbe.ts:68 (fileEventsArrive)
- scenario: a `watch` option whose `onEvent` fires before it returns (or the default `write()` triggering a synchronous callback in a test double): `settle` runs while `stop` is still undefined, so `stop?.()` does nothing; then `watch` returns its stopper, which is assigned but never called — the watcher stays open. Should call `stop` after assignment when already settled.
- evidence: read
- severity: low
- size: line
- cause: stopper assigned after settle can run
- confidence: likely

## Config modules and frame styles are written as platform paths while every other id is posix
- where: packages/forge/src/vite/virtualModules.ts:42 (virtualModules, configModule/frameStyles)
- scenario: on Windows, `resolve(src.root(), path)` yields `C:\\proj\\forge.config.ts`; story files, watch paths and module ids all go through `posixResolve`. The virtual module then imports a backslash path that does not match vite's id for the same file, so an edit to the config file may not be matched to the imported module (duplicate module / no HMR). Same in plugin.ts's `optimizeDeps.entries` (`resolve(at, path)`).
- evidence: read
- severity: low
- fix: packages/forge/src/vite/virtualModules.ts, packages/forge/src/vite/plugin.ts
- size: line
- cause: resolve instead of posixResolve
- confidence: likely

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

<!-- done: 7 findings, files read: 26 -->
