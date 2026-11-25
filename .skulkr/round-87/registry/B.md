# Audit round 87, area `registry`

## A child's hold through its parent turns into a stale own copy when the parent releases and re-registers the id in one tick
- where: packages/registry/src/extensionRegistry.ts:96 (createLeans → settle) and :151 (the `take` callback)
- scenario: parent P holds `op` = A; child C calls `C.register('op', A)`, which becomes a lean held through P. P's owner re-runs a React effect: it calls the release (P's store, `holdPlace: true`, leaves an empty stack and emits), then registers `op` = A again in the same tick. P's release emits synchronously, so C's `settle` runs while `P.get('op')` is `undefined` and calls `take`, giving C its own copy of A. When P re-registers, C's copy now shadows it. Later `P.register('op', B, { replace: true })` is invisible through C, which keeps answering A. The ruling in docs/unruled.md (2026-11-25) says the child follows the parent's replacement and takes the id over only if the parent *drops* it. A release that the parent's own `holdPlace` treats as no drop (a release and re-register in one tick, which is exactly what `holdPlace` is for) still counts as a drop here. `settle` should wait out the tick, as `since` already does with `queueMicrotask`, before calling `take`.
- evidence: read
- severity: medium

## `Reflectable.set` drops the `fallback` mark of the registrant it replaces, so a later same-rank push warns as a clash
- where: packages/registry/src/reflectable.ts:252 (set)
- scenario: `push('k', a, { fallback: true })`, then `set('k', a2)` (a newer version of the engine default), then a plugin calls `push('k', b)` at rank 0. `set` carries over only the live registrant's `rank`, not its `fallback`. The registrant under `b` is no longer a fallback, so in development the push warns "which is not an engine default", even though it overrides what is still the engine default. `set` is documented as replacing in place ("a newer version"), so it should keep `fallback` the same way it keeps `rank`.
- evidence: read (inference that `set` over a fallback is a real sequence; no test covers it)
- severity: low

## `prototypePolluted` misses a member of `Object.prototype` redefined with different attributes
- where: packages/registry/src/testing/hostile.fixture.ts:92 (sameMember)
- scenario: a reader runs `Object.defineProperty(Object.prototype, 'toString', { value: Object.prototype.toString, enumerable: true })`. Every `for…in` over every object now lists `toString`. `sameMember` compares only `value`, `get` and `set`, so `prototypePolluted()` returns false and a hostile-input property test passes over a reader that changed `Object.prototype`. It should compare `enumerable`, `writable` and `configurable` too.
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
