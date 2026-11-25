# Audit round 86 — registry — findings

## Registering the value a parent already resolves to is not "no change": the child mints its own copy that later shadows the parent
- where: packages/registry/src/extensionRegistry.ts:139 (register)
- scenario: parent registry holds `'move' → f`; a child made with `parent` calls `register('move', f)`. `have` is `f` (from the parent) and `same(have, value)` is true, but `held.get('move')` is undefined because the child holds nothing itself, so the idempotent branch is skipped and the call falls through to `store.set`. The child's store now holds its own `f`: its version bumps, its listeners are notified, `own.entries()` lists `'move'`. Then the parent replaces `'move'` with `g` (`replace: true`): the child still resolves `f`, because its own copy shadows the parent. The interface doc says "Registering the value an id already resolves to is no change". It should either count the hold against the parent's resolution or not shadow it, so the child keeps following the parent's replacement.
- evidence: read
- severity: medium

## A cached `entries()` keeps an order that its next recompute changes, with no change to that key
- where: packages/registry/src/extensionRegistry.ts:104 (createRelease, the `since` microtask) and :117 (entries cache)
- scenario: the child registers `'x'` (its `since` is early), then the parent registers `'x'` later. The child releases its own `'x'`. `entries()` is read in the same tick: the version has moved, so it recomputes and sorts `'x'` by `min(mine, theirs)`, which is still the child's early `since`. The microtask then deletes `since['x']` without bumping any version, so the cache keeps serving that order. The next unrelated change recomputes, and `'x'` jumps to the parent's later position. Subscribers see a key move between snapshots with nothing about it having changed. The order a snapshot reports depends on whether it was read before or after a microtask.
- evidence: read
- severity: low

## `deepEqual` overflows the stack on a cyclic value
- where: packages/registry/src/deepEqual.ts:15 (deepEqual)
- scenario: `const a = {}; a.self = a; const b = {}; b.self = b; deepEqual(a, b)` recurses through `self` without end and throws `RangeError: Maximum call stack size exceeded`. A `createValueStore(x, deepEqual)` holding cyclic data throws from `set`. The doc promises structural equality over plain objects and arrays with no stated restriction to acyclic values. There is no seen-pair guard.
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

<!-- done: 3 findings, files read: 25 -->
