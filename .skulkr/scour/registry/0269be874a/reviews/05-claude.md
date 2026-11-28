## deepEqual reads an array hole through the prototype chain
- where: packages/registry/src/deepEqual.ts:36 (step)
- scenario: `a = [ , ]`, `b = [undefined]` with `Array.prototype[0]` (or another realm's, or `Object.prototype['0']`) defined, say by polluted input: `todo.push([a[i], b[i]])` reads the hole as the inherited value, so the pair compares the inherited value against `undefined` and answers false. The PBT test states a hole reads as `undefined`. The same happens for every hole whose index the chain defines.
- evidence: read
- severity: low
- fix: packages/registry/src/deepEqual.ts
- size: line
- cause: bare index read on user data rather than `own(a, i)`
- confidence: sure

## createPart makes two parts for one owner when `make` reads the part re-entrantly
- where: packages/registry/src/part.ts:15 (createPart)
- scenario: `make(owner)` calls something that reads the same part reader for `owner` (for example a part whose construction subscribes a helper that looks the part up). The inner read finds nothing in `parts`, calls `make` again and stores part P2. The outer call then overwrites it with P1. The inner caller keeps P2, and every later read returns P1, which breaks "every later read of that owner returns the same part". It should either detect the recursion and throw, or return the part already stored.
- evidence: read
- severity: low
- fix: packages/registry/src/part.ts
- size: function
- cause: no guard against re-entry between has() and set()
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

<!-- done: 2 findings, files read: 25 -->
