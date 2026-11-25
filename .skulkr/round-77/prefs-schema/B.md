# Audit round 77, prefs-schema, reviewer findings

## prefStatusAt disables an item's switch field that applyPrefConditions spares
- where: packages/prefs-schema/src/statusAt.ts:154 (statusInside, list/map branch); also statusAt.ts:132 (statusMatching drops `owner.entry` on a nested section)
- scenario: list `phases` whose `item` is an object with `enableIf: { all: [{ path: 'root.on' }, { from: 'item', path: 'on' }] }` and a field `on`, with `root.on` false. `applyPrefConditions` walks the item with `owner.entry = 'phases.*'` (status.ts `inside`), so `prefStatusIn` sees `phases.*.on` among the item's `from: 'item'` paths and spares the switch: `phases.*.on` is not in `disabled`. `prefStatusAt(schema, 'phases.2.on', holds)` (or `'phases.*.on'`) builds the item's owner as `{ node: { enableIf }, status: entry, above: status }` with no `entry`, so `prefStatusIn` never checks the `from: 'item'` paths and returns disabled. The two answer the same field's status two ways; it should be enabled in both. The fix is passing `entry: at` in that owner, and carrying `owner.entry` into the section owner `statusMatching` builds.
- evidence: read
- severity: medium

## An entry read with `from: 'item'` and the same value read by its root path give different answers when the entry is null
- where: packages/prefs-schema/src/judge.ts:35 (entryValue)
- scenario: map `m` whose item is a number leaf (default 5), with stored `{ m: { k: null } }`. A test `{ from: 'item', path: '' }` drawn for entry `m.k` reads `entryValue`: the entry is absent (`prefValueAbsent`), so it reads `item.default`, which is 5, and holds. A test `{ path: 'm.k' }` from the root reads `prefReader` → `fieldValue(map, value, 'k')` → `prefValueAt` gives `null`, which is not `undefined`, so it reads `null` and does not hold. entryValue also takes `item.default` where the root path uses `unsetValue` (auto `value`, `defaultScope`), so an item that starts auto reads its default from the entry and its auto value from the root.
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

<!-- done: 2 findings, files read: 31 -->
