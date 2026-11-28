## packageNameOf's `top` bound is a string prefix, so it reads a sibling directory's manifest outside `top`
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `top = '/repo/pkg'`, `file = '/repo/pkg-other/src/x.ts'` (history.ts:128 passes a `top`). `'/repo/pkg-other/src'.startsWith('/repo/pkg')` is true, so the loop climbs to `/repo/pkg-other/package.json` and returns that package's name, where a file outside `top` should give null. The same holds for any `top` without a trailing separator.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/packageName.ts
- size: line
- cause: path containment tested with startsWith
- confidence: sure

## typedoc/index.ts keeps its own copy of packageNameOf instead of using packageName.ts
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: Two functions answer "the package this file belongs to". `typedoc/index.ts` has a private `packageNameOf(dir)` (starts at `dir`, returns undefined, no `top`), and `vite/packageName.ts` exports `packageNameOf(file, top)` (starts at `dirname(file)`, returns null). They differ in signature and in the null/undefined contract, so a fix to one, such as the prefix bound above, does not reach the other. `exportIn` could call `packageNameOf(file) ?? undefined` from packageName.ts.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## fileEventsArrive leaks the watcher when the watch reports before `watch()` returns
- where: packages/forge/src/vite/watchProbe.ts:74 (fileEventsArrive)
- scenario: An injected `watch` (the `FileEventsOptions.watch` option) whose `onEvent` fires synchronously during the call, or a platform watcher that reports the directory's creation at once. `settle` then runs while `stop` is still undefined, so `stop?.()` closes nothing. When `watch` returns, `stop` is assigned and never called, and the watcher stays open. `write()` then still runs into the directory `settle` already removed, and its throw is swallowed. Settle should close a `stop` assigned after it ran, and the code should skip `write()` once settled.
- evidence: read
- severity: low
- size: function
- cause: settle runs before stop is assigned
- confidence: likely

## A moduleInfo destructure with a numeric key records a number as the imported name
- where: packages/forge/src/vite/moduleInfo.ts:52 (moduleInfo / declareStatement)
- scenario: `import * as ns from './x'; const { 0: a } = ns;`. `p.key` is a NumericLiteral, and it is cast to StringLiteral, so `nameOf` returns the number `0`. `imports.get('a').imported` is then the number 0, breaking the `Import.imported: string` contract that trace's `mod.exports.get(imp.imported)` looks up by string key: the trace finds nothing. A non-Identifier, non-StringLiteral key should be skipped or turned into a string.
- evidence: read
- severity: low
- size: line
- cause: unchecked cast of property key
- confidence: sure

## propControls always appends an API export, even when the story has no component
- where: packages/forge/src/vite/propControls.ts:66 (storyExports)
- scenario: With `api` on and a story whose meta names no component (and no fallback), `read` is null and `table` is null. The code still appends `export const <API_EXPORT> = null;`, so `added.code` is never empty. Every story module is rewritten with `map: null`, and that drops the story's source map for a file with nothing to add. The early `if (!added.code) return undefined` can never fire while `api` is on.
- evidence: read
- severity: low
- size: line
- cause: null table still emitted
- confidence: likely

## watchRecovery's fileOfUrl map is never pruned when a file is unlinked
- where: packages/forge/src/vite/watchRecovery.ts:119 (watchRecovery / configureServer watcher listener)
- scenario: An `unlink` event deletes `stamps.get(file)`, but the `fileOfUrl` entries pointing at that file stay. A long session that creates and deletes many modules (generated files, renames) keeps every url → file mapping for good. It is harmless to correctness because `missed` finds no stamps, but nothing bounds the map.
- evidence: read
- severity: low
- size: line
- cause: unlink cleans only one of two maps
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
