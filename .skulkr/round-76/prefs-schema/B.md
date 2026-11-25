# Audit round 76 — prefs-schema findings

## A union's variants that share a field key share one status: a condition on one variant's field disables (or hides, or activates) the same-keyed field of every other variant
- where: packages/prefs-schema/src/status.ts:126 (leafWalk `inside`, union branch, via `members` at :139); packages/prefs-schema/src/statusAt.ts:139 (`statusInside`, union branch)
- scenario: union `fill` (`tag: 'type'`) with variants `linear` and `radial`, each with a field `angle`; only `linear.angle` has `enableIf: { path: 'lock', is: false }`. With `lock` true and the value held as `{ type: 'radial', angle: 0 }`, `applyPrefConditions` walks every variant with the same `path`, so `under('fill', 'angle')` = `'fill.angle'` lands in `disabled` from the linear variant, and the radial variant's unconditioned `angle`, the one actually drawn, reads as disabled. The same goes for `hidden` (with `keepHidden`), for `active` on same-keyed action fields, and for sections (`prefSectionPath('fill', key)`). `prefStatusAt(schema, 'fill.angle', …)` returns the status of the first variant declaring `angle` (linear), whichever variant is held. The field's status should come from the variant the value holds, or be kept apart per variant.
- evidence: read
- severity: medium

## A `minAt`/`maxAt` reading NaN wipes the declared bound it is folded into
- where: packages/prefs-schema/src/bounds.ts:22 (prefBoundedNumber)
- scenario: `minAt: (read) => (read('size') as number) / 2` on a holder with no `size` returns NaN. `within(NaN)` is NaN (Math.min/Math.max propagate it), so `min = Math.max(leaf.min, NaN)` = NaN, and with a `maxAt` too, `max = Math.max(NaN, …)` = NaN. The result is a leaf with `min: NaN` (and `max: NaN`). `prefClampNumber` then never clamps (`v < NaN` is false), so the declared `min: 0` stops holding, and `prefDisplayBounds` hands NaN bounds to the control. A non-finite bound read should be ignored like `undefined`, leaving the declared bound.
- evidence: read
- severity: low

## `prefReader` recurses without bound on a scoped leaf whose selector is scoped back by it
- where: packages/prefs-schema/src/judge.ts:107 (shownValue → read → shownValue)
- scenario: leaf `a` has `scopes: [{ selector: 'b' }]` and enum `b` has `scopes: [{ selector: 'a' }]` (or `a` names itself), and nothing is stored. Reading `a` makes `shownValue` call `read('b')`, which calls `read('a')`, and so on until the stack overflows (RangeError) instead of returning. That shape is a schema problem the store's checks report, but `prefReader` and `prefJudge` are public and are called on a schema that was never checked (a schema editor's draft). The walk should track selectors already being read, the way `prefAliasTarget` tracks passed aliases, and read a cycle as no selection.
- evidence: read
- severity: low

## The list of condition fields is defined twice, in `groupConditions.ts` and in `judge.ts`
- where: packages/prefs-schema/src/groupConditions.ts:8 (`CONDITIONS`); packages/prefs-schema/src/judge.ts:14 (`PREF_CONDITION_FIELDS`)
- scenario: both say which node fields hold a condition (`showIf`, `enableIf`, `activeIf`). If a field is added to `PREF_CONDITION_FIELDS`, the judge and the status walks ask about it, but `resolvePrefGroupConditions` never resolves its `from: 'group'` tests. Those tests then reach a reader unresolved: they are read from the root and `warnUnresolved` fires. `groupConditions.ts` should import `PREF_CONDITION_FIELDS`.
- evidence: read
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

<!-- done: 4 findings, files read: 31 -->
