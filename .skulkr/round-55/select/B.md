# Audit round 55, area `select`

Note: the brief names frozen commit bfc55709…, which is not in this repository (`git cat-file` reports a bad object). The tree read is HEAD 830b463cc1.

## `SelectionMode`'s doc still names the mode `multi`, which no longer exists
- where: packages/select/src/select.ts:3 (SelectionMode)
- scenario: 97cce9db57 renamed the mode to `'multiple'`, but the doc comment still says "`multi` lets a policy's keys toggle and range". A consumer who reads the hover doc and writes `mode: 'multi'` gets a type error. In untyped JS the policy then counts as multiple, since `intentOf` only checks for `'single'`, so the bug stays hidden.
- evidence: read
- severity: low

## The README's `range` row omits `between`, so its fallback condition is wrong for surfaces that pass one
- where: packages/select/README.md (intent table, `range` row); behavior in packages/select/src/select.ts:68 (rangeIn)
- scenario: the row says the range falls back to `[id]` "if there is no anchor or either end is outside `order`". With `context.between` given, `order` is never read. The range falls back only when `between` returns nothing that `forceSingle` lets through, and with `between` and no `order` at all, a range still selects. A canvas consumer reading the table would expect a box range to need an `order`.
- evidence: read
- severity: low

## Files read
packages/select/src/index.ts
packages/select/src/pbt.fixture.ts
packages/select/src/same.ts
packages/select/src/select.ts
packages/select/src/store.ts
packages/select/src/tree.ts

<!-- done: 2 findings, files read: 6 -->
