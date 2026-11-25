## A child's own id re-registered in one tick moves in `entries()` when its parent also holds the same value
- where: packages/registry/src/extensionRegistry.ts:255 (register, same-value lean path) with :174 (orderOf)
- scenario: child registers X=V (own, `since` s1), then Y (s2), then the parent registers X=V (parent order p > s2). Child `entries()` reads [X, Y] (X at min(s1, p) = s1). A React effect in the child re-runs: release X, register X=V in the same tick. The release deletes `held` X (its `since` is kept for the tick), but the re-register finds `have` through the parent, so it takes the lean path with `order: orderOf(X)`, and `orderOf` ignores `since` once `held` lacks the id — the lean and the inherited entry are ordered at p. `entries()` now reads [Y, X]. `holdPlace` and the kept `since` exist to keep a release-and-re-register in one tick in place; this path loses it. Should: the lean's order (and the entry's position) take the kept `since` when the id was released this tick.
- evidence: read
- severity: low

## A parent's release-and-register of a different value in one tick leaves the child shadowing with the stale value
- where: packages/registry/src/extensionRegistry.ts:107 (createLeans settle / relean)
- scenario: child holds X through its parent (parent X=V). Parent's effect re-runs with a new value: release X, then register X=W in the same tick. The release emits, `settle` sees X gone and takes it over (child's own copy V); `relean` in the microtask finds `theirs` = W, not same as V, and returns. The child now resolves X to the stale V, shadowing W for good. The 2026-11-25 ruling says a child's hold follows the parent's replacement and is taken over only when the parent drops the id; relean's own comment treats a one-tick release-and-register as no drop, but only for the same value. Should: a one-tick release-and-register of a different value read as a replacement (untake, and drop the hold as a displaced registration does).
- evidence: read
- severity: medium

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
