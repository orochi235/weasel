# Audit round 85 — registry (blind reviewer)

Known and already in `docs/unruled.md`, so left out: `deepEqual` on self-holding values (line 1113), `matchQuery`
lowercasing rather than case-folding (1112), array holes in `deepEqual` (1226), `freshId` RangeError (1235),
emitter dedup of one listener (2722).

## `ReflectedEntry.shadowed` is documented "oldest first" but is ordered by rank, then age
- where: packages/registry/src/reflectable.ts:21 (ReflectedEntry.shadowed), produced at :152 (entriesOf) from the stack `push` builds at :213-218
- scenario: `push(k, A, { rank: 1 })`, then `push(k, B)` (rank 0, goes under A), then `push(k, C, { rank: 2 })`. The stack is `[B, A, C]`, so `entries()[0].shadowed` is `[B, A]`, but A is older than B. A debug overlay or conflict report reading `shadowed[0]` as the first registrant names the wrong one. The doc should say "lowest tier first, then oldest", as `PushOptions.rank` describes, or the order should match the doc.
- evidence: read
- severity: low

## `deepEqual` ignores symbol-keyed properties
- where: packages/registry/src/deepEqual.ts:22-27 (deepEqual)
- scenario: `deepEqual({ [s]: 1 }, { [s]: 2 })` and `deepEqual({ [s]: 1 }, {})` both return `true`, because only `Object.keys` is compared. The doc promises structural equality over plain objects, and a value that differs from another in one own enumerable property is reported equal to it. Use `Reflect.ownKeys` filtered to enumerable keys, or say in the doc that symbol keys are skipped.
- evidence: read
- severity: low

## `createWarnOnce` with a `cap` that is not a positive integer either never forgets or never dedups
- where: packages/registry/src/warnOnce.ts:13 (createWarnOnce)
- scenario: `createWarnOnce(NaN)` (a cap computed from a missing setting): `said.size > NaN` is never true, so the set grows without bound, which is the leak the cap exists to stop. `createWarnOnce(0)` or a negative cap removes each key right after adding it, so every repeated message warns every time, so the function no longer warns once. The cap should be clamped (e.g. a non-finite value or one below 1 falls back to 256, or to 1), or the bad value refused.
- evidence: read
- severity: low

## An extension released and registered again in the same tick moves to the end of `entries()`
- where: packages/registry/src/extensionRegistry.ts:96-104 (createRelease) and :144 (register); the store is made without `holdPlace` at :79
- scenario: a React effect registers `op factory "x"` and re-runs: its cleanup releases, which deletes `since` and the store key, and the re-run registers again with a new `nextOrder` and a new Map slot. After any re-render that re-runs the effect, `x` lists after every id registered after it, so a reflection or debug overlay shows a registry whose order follows effect timing. `createReflectable` added `holdPlace` for exactly this sequence, but this registry does not use it, and `since` is dropped at once whatever the store does. That is the same "release then push in one tick" question answered two ways.
- evidence: read
- severity: low

## `isOneChar` reads a lone surrogate as one typed character
- where: packages/registry/src/codePoint.ts:11 (isOneChar)
- scenario: `isOneChar('\uD83D')`, which is half an emoji, for example from a `codePointFloor`-less slice or an IME's split event, returns `true`, since a lone surrogate spreads to one element. A caller that accepts the "character" inserts half a surrogate pair, which `xmlEscape` later writes as U+FFFD. Check that the one code point is not in the range 0xD800–0xDFFF.
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
packages/registry/src/warnOnce.ts
packages/registry/src/xmlEscape.ts

<!-- done: 5 findings, files read: 25 -->
