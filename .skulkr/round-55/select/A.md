## README usage example does not typecheck: reassigning `select`'s result to the inferred `state`
- where: packages/select/README.md (Usage) against packages/select/src/select.ts:62 (select)
- scenario: `let state = { ids: ['b'], anchor: 'b' }` infers `{ ids: string[]; anchor: string }`; `state = select(...)` assigns a `Selection<string>` (`ids: readonly string[]`, `anchor: string | null`), which TypeScript rejects twice (readonly array to mutable, `null` to `string`). A consumer pasting the example gets a compile error; it should declare `let state: Selection<string> = …`.
- evidence: read
- severity: low

## A `between` range can put the same id in the selection twice, which the store then disagrees with
- where: packages/select/src/select.ts:77 (rangeIn) / :71 (select)
- scenario: `context.between` returns a canvas hit list with an id repeated (e.g. a node found by two spatial buckets): `select` returns `ids: ['a','a','b']` unchanged. `createSelectionStore` dedupes on `setSelection`, so the caller's `Selection.ids` (length 3) and the store's (length 2) differ, and `settle` comparing the next press against the held state reports a change where the store reports none. `rangeOf` never repeats from a duplicate-free order; the `between` path should dedupe the same way the store does.
- evidence: read
- severity: low

## `createSelectionStore` keeps the caller's array itself, so a later mutation of it changes the selection silently
- where: packages/select/src/store.ts:15,19-22 (createSelectionStore / once)
- scenario: `const ids = ['a']; const s = createSelectionStore(ids); ids.push('b')` → `s.getSelection()` is now `['a','b']` with no listener told; the same holds for an array passed to `setSelection` with no repeats. The store's contract (a listener hears every change) is broken by aliasing; the store should copy (or freeze) what it adopts.
- evidence: read
- severity: low

## `SelectionMode`'s doc names a mode `multi` that no longer exists
- where: packages/select/src/select.ts:3 (SelectionMode)
- scenario: commit 97cce9db57 renamed the value to `'multiple'`, but the doc comment still says "`multi` lets a policy's keys toggle and range"; a reader writing `mode: 'multi'` from it gets a type error.
- evidence: read
- severity: low

## Files read
packages/select/src/index.ts
packages/select/src/pbt.fixture.ts
packages/select/src/same.ts
packages/select/src/select.ts
packages/select/src/store.ts
packages/select/src/tree.ts

<!-- done: 4 findings, files read: 6 -->
