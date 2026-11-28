# Findings: registry

## A child registry's `entries()` keeps a stale order when a release and re-register in one tick turn its own copy into a lean
- where: packages/registry/src/extensionRegistry.ts:255 (register, lean branch) and :213 (entries cache)
- scenario: child registers `a` = V before the parent does (child `since` = 1); the parent later registers `a` = V (parent order 5). A React effect in the child re-runs: its release drops the own copy (store emits; a `useSyncExternalStore` listener reads `entries()` and caches it at version N, with `a` inherited and sorted at the parent's order 5), then in the same tick it re-registers V, which finds the parent's V and adds a lean whose `order` is the still-held `since` 1. Adding a lean changes nothing `getVersion` counts, so `entries()` keeps returning the version-N array with `a` at position 5, and `a` jumps back to position 1 only on the next unrelated change. The same happens in reverse when the lean is released (order goes back to the parent's with no version step). `orderOf` depends on `leans`, but the cache key does not.
- evidence: read
- severity: low
- fix: packages/registry/src/extensionRegistry.ts
- size: function
- cause: cache keyed on store+parent version, ignores lean order changes
- confidence: likely

## The README's usage example draws the clash warning the library treats as a mistake
- where: packages/registry/README.md:20 (Usage)
- scenario: the example pushes `'pen'` = `'crosshair'` with source `'kit'`, then `'cell'` with source `'plugin'`, both at rank 0, on a store made without `layered: true` and with neither push a `fallback`. In development `push` calls `clashes.warn` (reflectable.ts:236), printing `weasel: "plugin" registered "pen" over "kit", which is not an engine default…`. The canonical example teaches a pattern the store warns about; it should push the kit one with `fallback: true` (or create with `layered: true`, or push the plugin at a higher rank).
- evidence: read
- severity: low
- fix: packages/registry/README.md
- size: line
- cause: example predates the clash warning
- confidence: sure

## README describes `shadowed` as "oldest first", but it is ordered by rank first
- where: packages/registry/README.md:44 (Exports)
- scenario: a key with a rank-1 registrant pushed first and a rank-0 one pushed later has `shadowed` = [rank-0 (newer), …], not oldest first; `ReflectedEntry.shadowed`'s own doc (reflectable.ts:21) says "lowest rank first, and oldest first within a rank". A reader of the README orders them wrongly.
- evidence: read
- severity: low
- fix: packages/registry/README.md
- size: line
- cause: README not updated when ranks landed
- confidence: sure

## Files read
packages/registry/src/after.ts
packages/registry/src/codePoint.ts
packages/registry/src/compositeKey.ts
packages/registry/src/deepEqual.ts
packages/registry/src/emitter.ts
packages/registry/src/extensionRegistry.ts
packages/registry/src/freshId.ts
packages/registry/src/getOwn.ts
packages/registry/src/grade.ts
packages/registry/src/index.ts
packages/registry/src/isDev.ts
packages/registry/src/isFiniteNumber.ts
packages/registry/src/isPlainObject.ts
packages/registry/src/latest.ts
packages/registry/src/match.ts
packages/registry/src/mixed.ts
packages/registry/src/part.ts
packages/registry/src/pbt.fixture.ts
packages/registry/src/reflectable.ts
packages/registry/src/sameList.ts
packages/registry/src/setOwn.ts
packages/registry/src/testing/hostile.fixture.ts
packages/registry/src/valueStore.ts
packages/registry/src/warnOnce.ts
packages/registry/src/xmlEscape.ts

<!-- done: 3 findings, files read: 25 -->
