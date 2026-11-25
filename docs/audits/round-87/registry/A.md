# Audit round 87 — registry (blind reviewer)

## A child's held-through-parent registration is taken over by a same-tick release and re-register in the parent, and then stops following the parent
- where: packages/registry/src/extensionRegistry.ts:96 (createLeans → settle), :160 (take callback)
- scenario: child `c` registers value A that parent `p` already resolves `id` to, so `c` holds it as a lean. `p`'s owner re-runs its effect: release then `p.register(id, A)` in the same tick (the case `holdPlace: true` exists for). The release emits synchronously; `settle` reads `p.get(id) === undefined` (the store reads absent while holding its place) and calls `take`, copying A into `c`'s own store. The re-register lands a moment later, now shadowed by `c`'s copy. When `p` later replaces A with B, `c` keeps A. Per the 2026-11-25 ruling the child takes over "only if the parent drops it"; a same-tick release/re-register is not a drop (the store itself treats it as keeping its place). Should defer the takeover check to the microtask holdPlace already waits for, or re-check there.
- evidence: read
- severity: medium

## A child registry's listeners can hear an id it holds go absent for one notification when the parent drops it
- where: packages/registry/src/extensionRegistry.ts:198 (subscribe) with :111 (createLeans add → parent.subscribe(settle))
- scenario: child holds `id` as a lean, and its `subscribe` upstream (`parent.subscribe(notify)`) was registered on the parent before the leans' `settle` (first listener subscribed before the first lean registration). The parent releases `id`: its emitter calls the child's `notify` first, so the child's listeners read `child.get(id) === undefined` / `entries()` without it, then `settle` runs `take` and the store emits again with the id back. A listener reacting to absence (warning about a missing shader, tearing down a consumer) fires on a state the child never meant to be in. Should take the lean over before notifying, e.g. by running `settle` from the same upstream subscription ahead of `notify`.
- evidence: read
- severity: low

## `deepEqual` compares an Array subclass instance structurally, though its doc says a class instance equals only itself
- where: packages/registry/src/deepEqual.ts:22 (equal)
- scenario: `class Path extends Array {}`; `deepEqual(Path.from([1, 2]), [1, 2])` → `true`, since `Array.isArray` is true for subclass instances, whereas the doc says "every other value — a class instance … — equals only itself (`Object.is`)", and a plain object vs a class instance with the same fields compares `false`. The two containers answer the same "is this plain" question two ways; arrays should check the prototype is some realm's `Array.prototype` the way `isPlainPrototype` does for objects.
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
