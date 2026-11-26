# Audit round 89 — registry

## A held key's clash-warning memory grows without bound across distinct source pairs
- where: packages/registry/src/reflectable.ts:125 (createClashWarnings.warn)
- scenario: a key holds a long-lived base registrant (not a fallback) while overrides of the same rank come and go, each pushed with a source that embeds something minted per session (a plugin instance id, a document key). Each push adds a new `[under, over]` pair string to `warned.get(key)`. Pairs are dropped only by `forget(key)`, which runs only when the key's stack empties, or by `delete`/`clear`. While the base stays, the set keeps one entry per override ever pushed. It should stay bounded, as `createWarnOnce` does with its `cap`.
- evidence: read
- severity: low

## deepEqual recurses once per nesting level, so deeply nested input overflows the stack
- where: packages/registry/src/deepEqual.ts:20 (equal / sameKeys)
- scenario: comparing two values parsed from outside data that nest arrays or objects about 10k deep (`JSON.parse('['.repeat(1e4) + ']'.repeat(1e4))` against a copy of itself) throws `RangeError: Maximum call stack size exceeded`. `equal` → `sameKeys` → `equal` adds frames for every level, and `createValueStore(…, deepEqual)` would throw from `set`. It should answer `true` (or `false`) rather than throw for any acyclic input.
- evidence: read (reasoned from the recursion; not run)
- severity: low

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

<!-- done: 2 findings, files read: 25 -->
