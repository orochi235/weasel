# Audit round 85, area `registry`: findings

## A child `ExtensionRegistry` lists every inherited id before its own when its parent was not made by this module's `createExtensionRegistry`
- where: packages/registry/src/extensionRegistry.ts:80 and :113-115 (createExtensionRegistry, `entries`)
- scenario: the order is looked up in a module-level `orderOfRegistry` WeakMap, and `entries` sorts only when that lookup finds the parent (`if (parentOrder)`). A parent that is any other `ExtensionRegistry<V>` gets no sort: a hand-written implementation of the public interface, or one made by a second copy of `@weasel-js/registry` in the bundle, which has its own WeakMap. Say parent `a` is registered, then child `x`, then parent `b`. The child's `entries()` then returns `[a, b, x]` where it should return `[a, x, b]`, breaking `Reflection.entries`'s promise of "the order each key was first registered". With a parent from this copy of the module, the same calls give the documented order, so the same question gets two answers depending on where the parent came from.
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

<!-- done: 1 findings, files read: 25 -->
