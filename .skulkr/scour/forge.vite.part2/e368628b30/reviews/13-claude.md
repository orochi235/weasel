## A story served before TypeDoc's JSON exists never picks up its docs once the JSON is written
- where: packages/forge/src/vite/propControls.ts:73 (storyExports)
- scenario: dev server starts with no `dist/typedoc.json`; a story is transformed and `typedoc.file` is not added to its watch files (`docs` is null). Running `typedoc --json` afterward writes the file, but nothing in the module graph links it to the story, so the story is never re-transformed and its API panel keeps showing the types-only reading until some unrelated edit touches the story or its sources. The `typedoc` option's doc says every component is read from types alone only "while there is no JSON".
- evidence: read
- severity: low
- fix: packages/forge/src/vite/propControls.ts, packages/forge/src/vite/plugin.ts
- size: function
- cause: watch link added only when the file already exists
- confidence: likely

## typedoc/index.ts carries its own copy of `packageNameOf`, beside the one in packageName.ts
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: two definitions answer "which package is this file in": packageName.ts's (null, bounded by `top`, takes a file) and typedoc's private one (undefined, unbounded, takes a dir). A fix to one (e.g. the prefix bound below, or a manifest-caching change) leaves the other answering differently, so `exportIn`'s package tie-break can disagree with `apiTable`'s package naming for the same file.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated lookup
- confidence: sure

## `packageNameOf` bounds the walk with a string prefix, so a sibling directory sharing `top`'s prefix counts as under it
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `top = /repo/pkg`, `file = /repo/pkg-extra/x.ts` (reachable from history.ts's `resolve(top, path)` when `path` is `../pkg-extra/x.ts`): `'/repo/pkg-extra'.startsWith('/repo/pkg')` is true, so the manifest of `pkg-extra` is read and returned although it is outside `top`. Should compare by path segment (`dir === top || dir.startsWith(top + sep)`).
- evidence: read
- severity: low
- size: line
- cause: prefix test without separator
- confidence: sure

## Wrapper tracing stops at a local alias, so a project helper re-exporting forge's `meta` under a `const` is not recognized
- where: packages/forge/src/vite/trace.ts:51 (declaring)
- scenario: helper module `import { meta } from '@weasel-js/forge'; export const defineMeta = meta;` and a story calling `defineMeta({...})`. `declaring` finds export `defineMeta` as `local`, finds no import named `defineMeta`, and returns `helper#defineMeta`, which is not forge's `meta` key, so the callee is not a wrapper and the story's meta reads as no meta at all. `export { meta as defineMeta }` works, the `const` alias spelling of the same thing does not. `moduleInfo` already records `refs`, but `declaring` never follows a binding whose initializer is a bare identifier.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/moduleInfo.ts
- size: function
- cause: identifier initializers not followed
- confidence: likely

## `fileEventsArrive` with a NaN `waitMs` never settles and rewrites its temp file forever
- where: packages/forge/src/vite/watchProbe.ts:83 (fileEventsArrive)
- scenario: `waitMs: NaN` (e.g. computed from an unset env var) on a machine whose watcher reports nothing: `NaN <= LONGEST_TIMER_MS` is false, so no deadline is set, the 250 ms rewrite interval runs for the life of the process and the temp directory is never removed. The doc only promises waiting forever past 2^31-1 and at Infinity; NaN (and negative values, which fire at once and report false) are not rejected the way `watchRecovery` rejects a bad `quietMs`.
- evidence: read
- severity: low
- size: line
- cause: unvalidated wait
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

<!-- done: 5 findings, files read: 26 -->
