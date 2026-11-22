# prefs-schema findings (round 68)

## A function unit's `step` is converted as the distance from 0, which is Infinity or meaningless for a nonlinear unit
- where: packages/prefs-schema/src/helpers.ts:29 (prefDisplayBounds)
- scenario: a number leaf with `step: 0.1` and a `PrefFunctionUnit` such as decibels (`toDisplay: (s) => 20 * Math.log10(s)`). `toDisplayExact(0)` is `-Infinity`, so the display step is `|toDisplayExact(0.1) - (-Infinity)|` = `Infinity` (no `places` on a function unit, so `displayStep` passes it through). The slider and field get `step: Infinity`, and every arrow key or drag snap jumps to an end or produces NaN. Even a nonlinear unit with a finite value at 0 gets a step equal to the display distance from 0 to `step`, which has nothing to do with the step anywhere else on the range. The comment justifies distance-from-zero by "a unit with an offset", which only holds for the linear form. Expected: for a function unit, leave `step` unconverted (or convert it at the leaf's `min`/`default`) rather than measuring from stored 0.
- evidence: read
- severity: medium

## In an entry's pass, the switch field of a disabled item gets hidden by the item's own `showIf`, which is never meant to be asked
- where: packages/prefs-schema/src/status.ts:236 (applyPrefEntryConditions) with packages/prefs-schema/src/statusAt.ts:70 (prefStatusIn)
- scenario: a list item `{ kind: 'object', showIf: { from: 'item', path: 'visible' }, enableIf: { from: 'item', path: 'on' }, children: { on: boolean, visible: boolean, x: number } }`, and an entry holding `on: false, visible: false`. `applyPrefEntryConditions` builds the item's owner as `{ node: item, … }`, so `prefStatusIn`, exempting the switch `on` from the failed `enableIf`, recomputes its status as `prefStatusUnder(ROOT, { showIf: item.showIf }, asked)`. `asked` answers the item's `showIf` because it reads the entry, so `on` comes back `shown: false`. It is dropped from `item` (or named in `hidden` with `keepHidden`), while `x` and `visible` stay shown (disabled), and the row can no longer be turned back on. The schema pass never asks an item's `showIf` ("An item is drawn with its entry, so its own `showIf` is not asked", status.ts:102), and `statusInside` in statusAt.ts:113 builds the item's owner as `{ enableIf }` only, so `prefStatusAt` answers the same field as shown. One question gets two answers. Expected: the entry pass's owner leaves out the item's `showIf`, as `statusInside` does.
- evidence: read
- severity: low

## `visiblePrefSubtree` leaves `hidden` fields in a union's variants and a list's or map's item
- where: packages/prefs-schema/src/helpers.ts:134 (visiblePrefSubtree)
- scenario: a `union` leaf whose variant `linear` has a child `{ kind: 'number', hidden: true, … }`, or a `list` whose `item` is an object with a hidden field. `visiblePrefSubtree(schema, false)` strips hidden fields only for `kind === 'object'`, so it returns the union and the list unchanged and a settings UI built from the result draws the hidden field. A variant is itself an object leaf (union.ts:9), so its hidden children are the same case as an object's. Expected: recurse into `variants[*].children` and into `item` the way `visibleFields` does for an object's `children`.
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

<!-- done: 3 findings, files read: 31 -->
