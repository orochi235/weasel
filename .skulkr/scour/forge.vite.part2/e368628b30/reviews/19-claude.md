## A story passed through `Object.defineProperty`, `defineProperties` or `setPrototypeOf` (or a computed `Object['freeze']`) reads as no story
- where: packages/forge/src/vite/nativeExports.ts:76 (PASS_THROUGH / objectCallSources), :120 (mayBeStory CallExpression)
- scenario: `export const Primary = Object.defineProperty(story({...}), 'x', { value: 1 })` — these `Object` methods hand back their first argument just as `freeze` does, but they are not in `PASS_THROUGH`, so the call falls to the MemberExpression rule, whose callee object `Object` is a global, and `mayBeStory` answers false: the export is dropped from the index. The same happens for `Object['freeze'](story(...))`, since `objectCallSources` rejects a computed property. Should count as a story when the first argument may be one.
- evidence: read
- severity: medium
- size: line
- cause: incomplete pass-through list; computed member not read
- confidence: sure

## `typedoc/index.ts` keeps its own `packageNameOf`, a second answer to the question `packageName.ts` answers
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` walks to the filesystem root with a private copy, while `apiTable.ts` and `history.ts` use `packageName.ts`'s `packageNameOf` (bounded by `top`, returns null). The two differ in their bound and their not-found value and will drift; one definition should serve all three callers.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## `packageNameOf`'s `top` bound is a string prefix, so a sibling directory sharing the prefix counts as under it
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `packageNameOf('/work/repo-old/pkg/a.ts', '/work/repo')`: `'/work/repo-old/pkg'.startsWith('/work/repo')` is true, so manifests in `/work/repo-old/pkg` and `/work/repo-old` are read although neither is at or under `top`. Should compare whole path segments (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: prefix test instead of path containment
- confidence: sure

## A type definition declared `export default interface` prints as `default interface …`
- where: packages/forge/src/vite/typeDefs.ts:69 (addTypeDef)
- scenario: a props type written `export default interface ButtonProps { … }` is printed, then `^(export\s+)?(declare\s+)?` strips only `export `, leaving `default interface ButtonProps { … }` in the API panel's definition. Should strip `default\s+` after `export` too.
- evidence: read
- severity: low
- size: line
- cause: regex misses `default` modifier
- confidence: sure

## `fileEventsArrive` leaks the watch when a `watch` option reports synchronously
- where: packages/forge/src/vite/watchProbe.ts:68 (fileEventsArrive)
- scenario: a caller's `WatchDir` that invokes `onEvent` before returning (or an `fs.watch` replacement that reports the existing directory at once) runs `settle` while `stop` is still undefined; `stop?.()` does nothing, then the returned stopper is assigned to `stop` and never called, so the watcher stays open. Should call the stopper when it arrives after settling.
- evidence: read
- severity: low
- size: line
- cause: stop assigned after callback may fire
- confidence: likely

## Overlapping `update` calls can store an older wrapper resolution over a newer one
- where: packages/forge/src/vite/storyIndex.ts:104 (settle)
- scenario: two quick saves to a project helper a story's meta is imported through fire two watcher events; `reindex` runs `update` for each without serializing them. Each `settle` awaits `decide`, which reads the source at its own moment; if the first (older text) finishes after the second, `wrappersOf.set(file, next)` writes the stale resolution last and `readInto` re-reads the story with it, so the index keeps the old meta/story reading until the next edit. Updates should be queued, or a resolution discarded when a newer settle for the file has started.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/storyIndex.ts, packages/forge/src/vite/plugin.ts
- size: function
- cause: unserialized async updates
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

<!-- done: 6 findings, files read: 26 -->
