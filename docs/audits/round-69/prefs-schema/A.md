# Audit round 69: prefs-schema findings

## prefObjectBase takes an array (or any non-plain object) as the object, skipping `fromScalar`, where repair reads it as a scalar
- where: packages/prefs-schema/src/object.ts:4,12 (isObject, prefObjectBase); compare packages/prefs-schema/src/repair.ts:58-59
- scenario: an `object` leaf with `fromScalar` over a consumer field that may also be held as an array (padding `4 | [4, 8]`, a dash). `repairPrefValue` checks `isPlainObject`, finds the array is not one, and because `fromScalar` is set it passes the array through as a scalar to be lifted. A field edit then goes through `prefObjectWithField` → `prefObjectBase`, whose `isObject` is `typeof v === 'object' && v !== null`, so the array is returned as the base without being lifted, and `withField` spreads it: `{ 0: 4, 1: 8, top: 5 }` gets written in place of `fromScalar([4, 8])` with `top` set. The same happens with a class instance or a `Date`. The file answers "is this the object form" with `isObject` and repair answers it with `isPlainObject`, and the two answers differ. `prefObjectBase` should use `isPlainObject`, as repair does.
- evidence: read
- severity: medium

## applyPrefConditions keeps a group or section that starts out empty but drops one that conditions empty
- where: packages/prefs-schema/src/status.ts:197-198 (applyPrefConditions → group), packages/prefs-schema/src/status.ts:149-150 (leafWalk → section)
- scenario: with `keepEmpty` false, a non-root group whose `children` is `{}` has `changed === false`, so `group()` returns the node and it stays in `shown`. A group whose only leaf fails its `showIf` is returned as `null`. Sections behave the same way, through `kept === node.members` → `return node`. The doc says a group or section "that leaves with nothing to draw" is dropped unless `keepEmpty`, and an originally empty one has nothing to draw either, so a form draws a bare heading for it. `visiblePrefSubtree` (helpers.ts:187) does drop an empty group whatever made it empty, so the two pruning walks disagree about the same schema.
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
