## typedoc/index.ts keeps its own copy of packageNameOf, answering "which package is this file in" apart from packageName.ts
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `exportIn` picks between two same-suffix exports by the file's package, using a private walk-up with no `top` bound and different error handling than `packageName.ts`'s `packageNameOf`, which `apiTable.ts` and `history.ts` use. A fix to one (e.g. bounding the walk, or treating an unreadable manifest differently) leaves the other answering differently for the same file.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts, packages/forge/src/vite/packageName.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## packageNameOf bounds the walk with a string prefix, so a sibling directory sharing `top`'s prefix is searched
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `top = '/repo/pkg'`, `file = '/repo/pkg-extra/src/a.ts'` (reachable from `history.ts`'s `resolve(top, path)` with a `../` path): `'/repo/pkg-extra/src'.startsWith('/repo/pkg')` is true, so manifests outside `top` are read and their name returned, where the doc promises "at or under `top`" and the answer should be null.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/packageName.ts
- size: line
- cause: path prefix tested as a string
- confidence: sure

## fileEventsArrive leaks the watcher when the watch reports during `watch()` itself
- where: packages/forge/src/vite/watchProbe.ts:73 (fileEventsArrive)
- scenario: a `watch` option (`FileEventsOptions.watch`) whose callback fires synchronously, before it returns its stopper: `settle` runs while `stop` is still undefined, so `stop?.()` does nothing, and the stopper returned afterward is never called. The watch on the deleted temp dir stays open.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/watchProbe.ts
- size: line
- cause: stopper assigned after the callback can settle
- confidence: likely

## The recovering warning promises a sweep "within seconds" that a `quietMs` past one timer never runs
- where: packages/forge/src/vite/watchProbe.ts:91 (RECOVERING / warnWhenWatchIsSilent)
- scenario: `watchRecovery({ quietMs: Infinity })` beside a silent watcher: `warnWhenWatchIsSilent` sees the plugin by name and logs that edits are found "within seconds once the watcher is quiet", but `watchRecovery` starts no interval past `LONGEST_TIMER_MS`, so edits are only found on request.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/watchProbe.ts, packages/forge/src/vite/watchRecovery.ts
- size: function
- cause: message ignores the plugin's option
- confidence: sure

## A name two `export *` modules both export resolves to the first, where ES modules export neither
- where: packages/forge/src/vite/trace.ts:61 (declaring)
- scenario: `export * from './a'; export * from './b'` with both declaring `story`: the ambiguous binding is not exported by the module (importing it is a SyntaxError), but `declaring` returns `a`'s, so a callee can be taken for forge's `story`/`meta` through a module that does not export it.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/trace.ts
- size: function
- cause: star exports searched first-match
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

<!-- done: 5 findings, files read: 26 -->
