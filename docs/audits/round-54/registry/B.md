I couldn't save `.skulk/out/findings.md` because permission to write it was denied, so the full findings document is below.

## identityKeyOf gives two distinct symbols with the same description one key
- where: packages/registry/src/part.ts:27 (identityKeyOf)
- scenario: `identityKeyOf(Symbol('a'))` called on two different symbols returns `symbol:Symbol(a)` both times, and two `Symbol()` calls collide the same way. The doc promises that two values share a key only when they are equal primitives or the same object. Each symbol is a unique primitive, so each should get its own key, for example a serial as objects do. Two callers pass values through it: `core/src/canvas/SceneCanvas/presetBuild.ts:138` and routing's `conflictKeys.ts:115`. Both would treat two distinct symbol values as one memo or conflict key.
- evidence: read
- severity: medium

## ExtensionRegistry.subscribe's unsubscribe also removes the same listener's direct subscription to the parent
- where: packages/registry/src/extensionRegistry.ts:99 (subscribe)
- scenario: a caller runs `parent.subscribe(onChange)`, then `child.subscribe(onChange)`. The child calls `parent.subscribe(onChange)`, and the parent's emitter folds that into the existing subscription because it is the same function. When the caller then runs the child's unsubscribe, `offParent()` removes `onChange` from the parent. The caller's own subscription to the parent, which it still wants, stops firing. The same happens with `child.own.subscribe(fn)` followed by `child.subscribe(fn)`, since both go through the child's store emitter.
- evidence: read
- severity: low

## Reflectable.set drops the live registrant's rank, so a later lower-rank push goes live over a higher-rank one
- where: packages/registry/src/reflectable.ts:247 (set)
- scenario: the stack is `[A rank 3, O rank 5]`. `set(key, v)` replaces O with a registrant that has no rank (read as 0), giving `[A(3), S(0)]`. The stack is no longer sorted by rank, and `push` relies on that order. Then `push(key, B, { rank: 1 })` stops scanning at S (0 ≤ 1) and puts B on top, live over A's rank-3 override. Push's doc says a newer registrant goes under every one ranked higher.
- evidence: read
- severity: low

## The clash warning says the newer registrant is live when a higher-rank one sits above it
- where: packages/registry/src/reflectable.ts:240 (push), :141 (warn)
- scenario: the stack is `[A rank 0, O rank 5]`. `push(key, B)` at rank 0 goes under O, so `under` is A: same rank, not a fallback. In development this warns "The newer one is live", but O stays live and B does not.
- evidence: read
- severity: low

## KeyedEmitter.clear during an emit still calls the cleared listeners
- where: packages/registry/src/emitter.ts:91 (createKeyedEmitter.clear)
- scenario: key k holds listeners L1 and L2, and L1 calls `clear(k)` during `emit(k)`. `clear` only deletes the map entry, so the pass already running on the old emitter goes on to call L2. The Emitter contract, which KeyedEmitter claims, says a listener removed before its turn is not called.
- evidence: read
- severity: low

## ExtensionRegistry.entries lists inherited ids before its own, not in first-registration order
- where: packages/registry/src/extensionRegistry.ts:94 (entries)
- scenario: the child registers `a`, then the parent registers `b`. `child.entries()` returns `[b, a]`, but `Reflection.entries` promises "in the order each key was first registered".
- evidence: read
- severity: low

## hostile fixture's mutate throws when duplicating a field that holds undefined
- where: packages/registry/src/testing/hostile.fixture.ts:73, :76 (mutate)
- scenario: `pathsOf` walks the original `v`, but `mutate` edits a JSON clone of it. A field holding `undefined` still gets a path, but the clone has dropped that key. `duplicate` on that path then runs `clone(undefined)`, and `JSON.parse(undefined)` throws a SyntaxError. The property test fails for a reason that has nothing to do with the reader under test. A root `duplicate` of `undefined` (line 65) throws the same way.
- evidence: read
- severity: low

## prototypePolluted misses an overwritten Object.prototype member
- where: packages/registry/src/testing/hostile.fixture.ts:90 (prototypePolluted)
- scenario: a reader that runs `x.__proto__.toString = junk` changes `Object.prototype` without adding a new string name, so the check reports no pollution. Assigning any other existing member, or adding a symbol key, slips past it too. It only compares the set of own string names, not their values or symbol keys.
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

<!-- done: 8 findings, files read: 24 -->