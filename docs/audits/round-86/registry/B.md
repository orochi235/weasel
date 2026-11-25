## Registering the value an id already resolves to through the parent is a change, not the no-op the contract promises
- where: packages/registry/src/extensionRegistry.ts:146 (register)
- scenario: parent holds `id → v`; `child.register(id, v)`. The idempotent branch needs an own `holding`, which the child lacks, so the call falls through to `store.set`: the child's version steps, its subscribers are notified, `entries()` now reports the child's `source` for `id`, and the child pins `v`, so a later `parent.register(id, w, { replace: true })` no longer reaches the child. The interface doc says "Registering the value an id already resolves to is no change". Either the doc should say that a same-value registration through a parent takes an own copy, or the branch should count it without writing the store.
- evidence: read
- severity: medium

## A child registry's clash check sees the parent, but a parent's later registration never checks its children
- where: packages/registry/src/extensionRegistry.ts:150 (register)
- scenario: child registers `id → a` (parent holds nothing). The parent then registers `id → b` with no `replace`: nothing throws, because the parent knows nothing of its children, and the child silently keeps shadowing `b` with `a`. In the other order (parent first, then child with `a`), the same pair throws `ExtensionConflictError`. Whether two values under one id conflict comes out two ways depending on which registered first, against the "Explicit replacement" rule in the interface doc.
- evidence: read
- severity: low

## Clash warnings dedupe on a source pair that cannot tell an unnamed registrant from source `''`
- where: packages/registry/src/reflectable.ts:154 (createClashWarnings.warn)
- scenario: the pair key is `${under.source ?? ''}\u0000${over.source ?? ''}`, so a push over an unnamed registrant and a push over one with `source: ''` share a key. The second clash is never warned, although the message would name the two differently ("an unnamed registrant" against `""`).
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
