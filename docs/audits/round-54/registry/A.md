## identityKeyOf gives two distinct symbols with the same description one key
- where: packages/registry/src/part.ts:28 (identityKeyOf)
- scenario: `identityKeyOf(Symbol('x'))` and `identityKeyOf(Symbol('x'))` both answer `'symbol:Symbol(x)'`, because a symbol is treated as a primitive and written through `String(v)`. The doc promises "two values share a key only when they are equal primitives or the same object", and two `Symbol('x')` are not equal. A memo keyed this way (`presetBuild.ts:138` keys option values through it; routing's `conflictKeys`/`conflicts` key specs and predicates) hands one symbol's cached result to a different symbol. It should give each symbol its own serial, the way objects get one (a Map from symbol to serial, or WeakMap for non-registered symbols), or at least not collapse unequal symbols.
- evidence: read
- severity: medium

## Reflectable.set drops the live registrant's rank, so a later push goes over a higher-ranked registrant
- where: packages/registry/src/reflectable.ts:248 (set), with push's placement at :238
- scenario: on stack `[A rank 5, B rank 10]`, `set(key, C)` replaces B with a registrant that has no rank, so the stack is `[A r5, C r0]` and is no longer ordered by rank. Then `push(key, D, { rank: 3 })` walks down from the top only while `rank > 3`. It stops at once on C (rank 0), so D is placed on top and goes live over A (rank 5). The `PushOptions.rank` contract says a newer registrant goes "under every one ranked higher". `set` should keep the displaced live registrant's rank (or put C where its own rank belongs), so the stack stays ordered.
- evidence: read
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
packages/registry/src/xmlEscape.ts

<!-- done: 2 findings, files read: 24 -->
