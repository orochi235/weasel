## deepEqual reads a null-prototype array as a plain object, so it equals an index-keyed object
- where: packages/registry/src/deepEqual.ts:33 (step)
- scenario: `a = Object.setPrototypeOf([1, 2], null)`, `b = { 0: 1, 1: 2 }`. `isPlainArray(a)` is false (its prototype `null` is not an array), so neither side takes the array branch; `isPlainObject(a)` is true because `isPlainPrototype(null)` is true, and `keysOf` of both sides is `['0', '1']` (an array's `length` is not enumerable). `deepEqual(a, b)` answers true. Under the doc, an array that is not plain is "every other value" and should equal only itself; and an array should never equal a non-array.
- evidence: read
- severity: low
- fix: packages/registry/src/deepEqual.ts
- size: line
- cause: array check falls through to plain-object check
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
