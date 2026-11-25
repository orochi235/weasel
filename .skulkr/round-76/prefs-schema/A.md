# Findings: prefs-schema (round 76)

## prefReader reads a stored `null` as the value, where the control shows the default
- where: packages/prefs-schema/src/judge.ts:107 (shownValue), also judge.ts:34 (entryValue)
- scenario: a number leaf `n` with `default: 5` (not clearable) whose stored value is `null` (a JSON round-trip of a cleared value or a hand-edited record). `prefValueOrDefault` (leafValue.ts) treats `null` as absent for every kind but `paint`, so the row shows 5. `prefReader` only checks `held !== undefined`, so a condition reads `null`. `{ path: 'n', atLeast: 1 }` therefore fails, and `{ path: 'n' }` reads as not set, while the control shows 5. The same happens for an entry value of `null` in `entryValue`. Whether `null` counts as absent is answered two ways. It should use `prefValueAbsent(leaf, held)`.
- evidence: read
- severity: medium

## A condition on an omitted object field reads the default's field, which repair says the field does not have
- where: packages/prefs-schema/src/judge.ts:89 (prefReader), judge.ts:35 (entryValue)
- scenario: an object leaf `stroke` with `default: { width: 1, dash: [4, 2] }` stores `{ width: 2 }`. `repairFields` (repair.ts:79) keeps the omitted `dash` omitted ("absent is a state of its own (no dash, no shadow), and not the field at its default"), and the object's control shows no dash. `prefReader('stroke.dash')` falls back to `prefValueAt(shownValue(leaf, undefined), 'dash')`, which is `[4, 2]`. So `showIf: { path: 'stroke.dash' }` holds, and the leaf under that condition shows for a stroke drawn with no dash. `entryValue` makes the same fallback into `item.default` for a field an entry omits.
- evidence: read
- severity: medium

## An alias drawn under its own name keeps the target's `short` forms, so a narrow surface shows the target's abbreviation
- where: packages/prefs-schema/src/alias.ts:47 (prefAliasedLeaf)
- scenario: an alias `{ kind: 'alias', of: 'view.grid', name: 'Snap to grid' }` over a target `{ name: 'Grid', short: ['Grd'] }`. `prefAliasedLeaf` swaps in the alias's name but spreads the target's `short` (and `pair.label`, which defaults to that name) unchanged. A bar short of room shows `Grd` for the row that is named 'Snap to grid' everywhere else. The `short` forms should be dropped (or the alias's own used) when the alias gives a name.
- evidence: read
- severity: low

## prefDisplayBounds sorts and clamps `stops` under a unit and returns them raw without one
- where: packages/prefs-schema/src/helpers.ts:28 (prefDisplayBounds)
- scenario: a leaf with `stops: [50, 10, 200]` and `max: 100`. With no `unit`, the early return hands back `[50, 10, 200]`: unsorted, and with 200 outside the bounds. With `unit: { scale: 1 }`, which changes nothing, the same leaf gets `[10, 50, 100]`. A slider over the two leaves draws different stops for the same values, depending only on whether an identity unit is present.
- evidence: read
- severity: low

## A disabled owner's switch exemption never matches a field reading the entry itself (`from: 'item', path: ''`)
- where: packages/prefs-schema/src/statusAt.ts:77 (prefStatusIn)
- scenario: a list item's `enableIf: { from: 'item', path: '' }` (an empty path is the entry itself, as condition.ts documents) builds the path `${entry}.`, with a trailing dot. That never equals any path. The exemption is harmless here only because no leaf sits at the entry's own path. A test reading `{ from: 'item', path: '' }` on an object item whose leaf is the item itself is not exempted, where an equal root-path test would be.
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

<!-- done: 5 findings, files read: 31 -->
