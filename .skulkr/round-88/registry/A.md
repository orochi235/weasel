## `createValueStore`'s doc recommends `sameList` for rebuilt lists, but `sameList`'s default `===` disagrees with the store's own `Object.is` on NaN
- where: packages/registry/src/sameList.ts:10 (sameList default `same`); packages/registry/src/valueStore.ts:14 (doc)
- scenario: `createValueStore([NaN], sameList)` then `set([NaN])` → `sameList` reads `NaN === NaN` as false, so every write notifies, while the store's default (`Object.is`) states "a repeated `NaN` is no change". The same question (are two elements the same) is answered two ways, and the doc's suggested pairing reintroduces the churn the default avoids. `0`/`-0` flip the other way.
- evidence: read
- severity: low

## `deepEqual` ignores an array's own non-index keys, though its doc says it compares each own enumerable key
- where: packages/registry/src/deepEqual.ts:22-26 (equal, plain-array branch)
- scenario: `const a = [1]; a.tag = 'x'; deepEqual(a, [1])` → `true`; the array branch compares length and indices only, so an own enumerable `tag` (or symbol key) on a plain array is never read, where the doc promises "comparing each own enumerable key, symbols included" for plain arrays and objects alike. (Holes reading as `undefined` is ruled in docs/unruled.md; this is the non-index keys.)
- evidence: read
- severity: low

## `ExtensionRegistry.register` treats a registered `undefined` as no registration, so a later different value overwrites it without `replace`
- where: packages/registry/src/extensionRegistry.ts:236-248 (register)
- scenario: `reg.register('x', undefined)` then `reg.register('x', f)` → `have` is `undefined`, so no `ExtensionConflictError` is thrown and `f` silently replaces it; the first call's release then does nothing (its holding is displaced). The doc's "Explicit replacement" rule says a different value under a taken id throws unless `replace: true`. Same blind spot in `createLeans.settle`/`relean` (`theirs !== undefined`). `V` is unconstrained, so nothing stops `undefined` being registered.
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
