## A child registry's `entries()` keeps a stale order after a release and same-tick re-register through its parent
- where: packages/registry/src/extensionRegistry.ts:245 (register, lean branch) with :208 (entries cache)
- scenario: child C of parent P (both from `createExtensionRegistry`). C registers `a`=X while P lacks it (C's `since` = early order). P later registers `a`=X. C releases its own `a`: `store.release` bumps the version and notifies; a C listener reads `entries()`, which now orders `a` by P's order (held is gone, no lean) and caches it. In the same tick C registers `a`=X again (a React effect re-running): `have` comes from P, so it becomes a lean whose `order` is C's retained `since` (earlier). Adding a lean changes no store, so `getVersion()` is unchanged and `entries()` keeps returning the cached array with `a` at P's position, though `orderOf('a')` now answers the earlier one. The next unrelated change then moves `a` back, so the list jumps for no change to `a`. It should either keep `a` at P's order or advance the version so the cache is rebuilt.
- evidence: read
- severity: low
- fix: packages/registry/src/extensionRegistry.ts
- size: function
- cause: cache keyed on store+parent version; lean order change bumps neither
- confidence: likely

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
