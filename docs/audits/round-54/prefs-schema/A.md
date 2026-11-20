# Audit round 54 — prefs-schema findings

Note: the checkout's HEAD is 830b463cc1, not the brief's 608f35f5; lines cite the tree as read.

## prefDisplayBounds decides a unit's direction from rounded display values, so a decreasing linear unit with `places` returns min > max
- where: packages/prefs-schema/src/helpers.ts:26 (prefDisplayBounds)
- scenario: a number leaf `{ min: 0, max: 5000, unit: { scale: -1000, places: 0 } }`. `toDisplay` rounds to `places`, so `toDisplay(1)` is `Number((-0.001).toFixed(0))` = -0 and `toDisplay(0)` is 0; `-0 < 0` is false, so `backward` is false even though the conversion decreases. The bounds come back `{ min: 0, max: -5 }` (and an `endless` end is not flipped), so a slider/field over them has an inverted range and clamps every value. Any decreasing unit whose |scale| exceeds about 2·10^places hits it. `toDisplayExact` (already destructured on the line before) gives the right sign.
- evidence: read (traced unit.ts:108-111 toDisplay against helpers.ts:26-35)
- severity: low

## A union field described by one variant reads as UNSEEN when another variant reaches a list/map/paint/custom leaf at the same key, so its encoding is never applied
- where: packages/prefs-schema/src/holding.ts:52-56 (insideLeaf, union branch)
- scenario: union `u`, variant `p` has `x: object { y: boolean with encoding }`, variant `q` has `x: list`. `prefLeavesHolding(schema, 'u.x.y')` finds `y` under `p`, then `q` returns UNSEEN and the loop returns UNSEEN for the whole union, dropping `p`'s match (and if `q` comes first it returns before `p` is looked at). `prefShownReader` then hands a condition the stored form of `u.x.y` even while the value is variant `p`, so `{ path: 'u.x.y' }` compares the encoded string rather than the toggle's on/off. It should keep the variants that describe the field and skip the one that cannot, as it already does for a variant returning `undefined`.
- evidence: read
- severity: low

## prefReader resolves a section-schema path by the first key that prefixes it, where prefLeavesHolding prefers an exact key, so a condition's default and its decoding leaf can come from two different leaves
- where: packages/prefs-schema/src/judge.ts:75-78 (prefReader) vs packages/prefs-schema/src/holding.ts:35-39 (amongFields)
- scenario: a section schema with members `data` (object leaf, default `{ fill: 'a' }`) listed before `data.fill` (its own leaf, default `'b'`). With nothing stored, `prefReader(schema, {})('data.fill')` takes the `data` key first (`path.startsWith('data.')`) and returns `'a'`; `amongFields` checks every key for an exact match first and describes `data.fill` by its own leaf, default `'b'`. The same question — which leaf answers for `data.fill` — gets two answers depending on member order.
- evidence: read
- severity: low

## prefObjectBase calls `fromScalar(undefined)` when nothing is held, so an edit of one field of an unset object starts from the lifted `undefined` rather than the leaf's default
- where: packages/prefs-schema/src/object.ts:13 (prefObjectBase)
- scenario: object leaf `stroke` with `default: { width: 1, cap: 'butt' }` and `fromScalar: (w) => ({ width: w as number })`, nothing stored. Setting `cap` through `prefObjectWithField` calls `fromScalar(undefined)` → `{ width: undefined }`, which is not nullish, so the `?? default` fallback never runs and the write stores `{ width: undefined, cap: 'round' }` — the stroke loses its default width. Nothing held is not a scalar to lift; `held === undefined` should start from `default` as a leaf without `fromScalar` does.
- evidence: read (no in-repo `fromScalar` caller to confirm which a consumer writes)
- severity: low

## assignPrefValueAt throws when a shorter path already holds a primitive
- where: packages/prefs-schema/src/helpers.ts:183-186 (assignPrefValueAt, reached from nestPrefValues)
- scenario: `nestPrefValues({ a: 5, 'a.b': 1 })`. `a` is set to 5; for `a.b` the branch check only replaces a missing or null `cursor[part]`, so `cursor` becomes the number 5 and `setOwn` runs `Object.defineProperty(5, 'b', …)` → TypeError "Object.defineProperty called on non-object". A non-object branch should be replaced (or the entry skipped), as a null one is.
- evidence: read (setOwn is Object.defineProperty, packages/registry/src/setOwn.ts:4)
- severity: low

## Files read
packages/prefs-schema/src/action.ts
packages/prefs-schema/src/alias.ts
packages/prefs-schema/src/bounds.ts
packages/prefs-schema/src/build.ts
packages/prefs-schema/src/condition.ts
packages/prefs-schema/src/groupConditions.ts
packages/prefs-schema/src/groups.ts
packages/prefs-schema/src/helpers.ts
packages/prefs-schema/src/holding.ts
packages/prefs-schema/src/index.ts
packages/prefs-schema/src/internal.ts
packages/prefs-schema/src/judge.ts
packages/prefs-schema/src/label.ts
packages/prefs-schema/src/leafValue.ts
packages/prefs-schema/src/list.ts
packages/prefs-schema/src/map.ts
packages/prefs-schema/src/number.ts
packages/prefs-schema/src/object.ts
packages/prefs-schema/src/paths.ts
packages/prefs-schema/src/presets.ts
packages/prefs-schema/src/repair.ts
packages/prefs-schema/src/schema.ts
packages/prefs-schema/src/schemaIcon.typetest.ts
packages/prefs-schema/src/scope.ts
packages/prefs-schema/src/scopeSpec.ts
packages/prefs-schema/src/shown.ts
packages/prefs-schema/src/status.ts
packages/prefs-schema/src/statusAt.ts
packages/prefs-schema/src/testing/pbt.fixture.ts
packages/prefs-schema/src/union.ts
packages/prefs-schema/src/unit.ts

<!-- done: 5 findings, files read: 31 -->
