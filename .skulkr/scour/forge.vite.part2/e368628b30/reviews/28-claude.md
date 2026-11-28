## A bare `return;` counts as a return that may hand back a story
- where: packages/forge/src/vite/nativeExports.ts:68 (returnsStory)
- scenario: `function make(x) { if (!x) return; return { a: 1 }; } export const S = make(true);` — `returnsStory` passes `stmt.argument ?? undefined` to `mayBeStory`, whose first line answers `true` for `!node`. A bare `return` hands back `undefined`, which the reader can see is not a story, yet `S` is kept as a possible story. It should be read as not a story, the same as `return undefined;` (an `Identifier`, which falls through to the foreign lookup) or a body with no `return` at all, which already reads as false.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/nativeExports.ts
- size: line
- cause: "missing argument" conflated with "unreadable"
- confidence: likely

## typedoc/index.ts finds a file's package name with its own copy of `packageNameOf`
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: `packages/forge/src/vite/packageName.ts` already exports `packageNameOf(file, top)`, which apiTable.ts and history.ts use; typedoc/index.ts declares a second, private `packageNameOf(dir)` under the same name, with a different signature (a directory rather than a file, `undefined` rather than `null`, no `top` bound). The question "which package does this file belong to" gets answered in two places, and a fix to one (bounding the climb, caching, how a nameless manifest is treated) won't reach the other. Should call the shared one: `packageNameOf(file) ?? undefined`.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## watchRecovery never recovers a deletion the OS didn't report, and stats the missing file on every sweep forever
- where: packages/forge/src/vite/watchRecovery.ts:69 (missed), packages/forge/src/vite/watchRecovery.ts:95 (sweep)
- scenario: The watcher is silent (the case this plugin exists for) and a served file is deleted. `missed` gets `mtimeOf(file) === undefined` and answers false, so no `unlink` is replayed: the page keeps the deleted module and vite's graph still holds it. The `stamps` entry is only removed by an `unlink` event, and that event is exactly what went missing, so the entry stays. Every `quietMs` after that, `sweep` calls `statSync` on the deleted file and the stat throws. A stamped file that no longer exists should be replayed as `unlink` (and its entries dropped).
- evidence: read
- severity: low
- fix: packages/forge/src/vite/watchRecovery.ts
- size: function
- cause: missing-file case treated as unchanged
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

<!-- done: 3 findings, files read: 26 -->
