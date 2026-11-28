## typedoc/index.ts keeps a private second `packageNameOf`, beside the one packageName.ts exports
- where: packages/forge/src/vite/typedoc/index.ts:102 (packageNameOf)
- scenario: the package a file belongs to is decided twice: packageName.ts (used by apiTable.ts and history.ts) checks `existsSync` and walks from `dirname(file)` with a `top` bound; typedoc/index.ts reimplements the walk with try/catch, no bound, and `undefined` instead of `null`. A fix to one (say, bounding the climb, or skipping a manifest whose name is not a string differently) does not reach the other, so apiTable's package label and typedoc's tie-break between two same-suffix exports can name different packages for one file.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/typedoc/index.ts
- size: function
- cause: duplicated helper
- confidence: sure

## A bare `return;` makes a function read as one that may return a story
- where: packages/forge/src/vite/nativeExports.ts:68 (returnsStory)
- scenario: `function make(x) { if (!x) return; return { title: 'x' }; }` then `export const A = make(1)`: `returnsStory` hands `stmt.argument ?? undefined` to `mayBeStory`, whose `!node` branch answers true ("cannot be read"), so `make` reads as returning a story and `A` stays in the loader's set. A missing argument is perfectly readable: it returns `undefined`, never a story; it should answer false.
- evidence: read
- severity: low
- size: line
- cause: absent return argument conflated with unreadable node
- confidence: sure

## `packageNameOf`'s `top` bound is a string prefix, not a directory bound
- where: packages/forge/src/vite/packageName.ts:6 (packageNameOf)
- scenario: `packageNameOf('/repo/pkg2/src/a.ts', '/repo/pkg')`: `'/repo/pkg2/src'.startsWith('/repo/pkg')` is true, so it reads `/repo/pkg2/src/package.json` and `/repo/pkg2/package.json`, outside `top`, and returns pkg2's name although the doc promises "at or under `top`". history.ts passes `resolve(top, path)`, which a `../pkg2/...` path from git puts outside `top`. Should test `dir === top || dir.startsWith(top + sep)`.
- evidence: read
- severity: low
- size: line
- cause: prefix match without separator
- confidence: sure

## A pending read taken by another environment's transform leaves the client module unstamped
- where: packages/forge/src/vite/watchRecovery.ts:160 (transform handler)
- scenario: `load` records a read only for the client environment, but the `transform` handler runs for every environment and `read.take(id)` is keyed by id alone. When an SSR (or other dev) environment transforms the same id between the client's load and its transform, it takes the client's entry, stamps its own module graph's module, and the client transform then finds nothing, so that client module carries no stamp and an unreported edit to it is never recovered through the stamp path. The transform should skip environments other than `client`, as `load` does.
- evidence: read
- severity: low
- size: line
- cause: env check on load but not on transform
- confidence: likely

## A type defined as `export default interface X` prints as `default interface X`
- where: packages/forge/src/vite/typeDefs.ts:72 (addTypeDef)
- scenario: a props type declared `export default interface Props { … }`: the printer emits `export default interface Props {…}`, and `/^(export\s+)?(declare\s+)?/` strips only `export `, so the API panel shows `default interface Props { … }`, which is not a valid declaration. The regex should also drop a following `default\s+`.
- evidence: read
- severity: low
- size: line
- cause: modifier strip misses `default`
- confidence: likely

## A failed prop reader is memoized as a rejected promise for the life of the root
- where: packages/forge/src/vite/propControls.ts:108 (propControls transform)
- scenario: `reader ??= createPropReader(...)` keeps whatever promise the first call returned. Only loading TypeScript is guarded inside `createPropReader`; a throw from `findConfigFile`/`readConfigFile`/`parseJsonConfigFileContent`/`createLanguageService` (a broken `extends` chain, a TypeScript build whose service throws on these options) rejects it, and every later story transform awaits the same rejection, so every story module fails to load until the config is resolved again, even after the tsconfig is fixed. Should fall back to `null` (no controls) on a throw, or clear `reader` on rejection.
- evidence: read
- severity: low
- fix: packages/forge/src/vite/propControls.ts, packages/forge/src/vite/propTypes.ts
- size: line
- cause: rejected promise memoized
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
