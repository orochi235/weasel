# Audit round 78 — prefs-schema — findings

## A condition on a field two levels into an object ignores the default of the field holding it
- where: packages/prefs-schema/src/judge.ts:131 (fieldValue)
- scenario: object leaf `style` stores `{}`. Its field `nib` is an object leaf with `default: { angle: 45 }`, and `nib.angle` is a number leaf with `default: 0`. `prefReader(schema, values)('style.nib')` reads `{ angle: 45 }`, because `fieldValue` falls back to `unsetValue(nib)`. But `('style.nib.angle')` reads `0`. `fieldValue` looks the whole of `rest` up in `held` (the `style` object). When that misses, it goes straight to the innermost leaf's default and never reads the default of the intermediate `nib`, which is what the form draws (`prefObjectBase(nib, undefined)` gives `nib.default`, so the row shows 45). A test `{ path: 'style.nib.angle', atLeast: 10 }` fails while the control shows 45. A union field inside an object is worse. With `style` at `{}` and `style.fill` a union whose default is `{ type: 'solid', width: 2 }`, `'style.fill'` reads that default. But `'style.fill.width'` reads `undefined`: the variant check reads `prefValueAt(held, 'fill')`, which is `undefined`, so no variant matches and `describes` is undefined. A list inside an object fails the same way (`'style.phases.0'` comes back UNSEEN, so `undefined`, while `'style.phases'` reads the list's default entries). It should read the value of each intermediate field the same way, its default where it is absent, before going one step further in, as `readAt` does for the top-level leaf.
- evidence: read
- severity: medium

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

<!-- done: 1 findings, files read: 31 -->
