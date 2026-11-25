# prefs-schema findings (round 70)

## prefBoundedNumber can leave min above max, and prefClampNumber then returns a value below min
- where: packages/prefs-schema/src/bounds.ts:24 (prefBoundedNumber), :33 (prefClampNumber)
- scenario: a leaf declares `max: 10` and `minAt` reads a node's own minimum of 20 (or `maxAt` reads 2 under a declared `min: 5`). `prefBoundedNumber` folds each bound in separately and returns `{ min: 20, max: 10 }` without checking that they cross. `prefClampNumber` then raises 15 to 20 and lowers it to 10, so the value it returns is below the `min` the same leaf just stated. A slider handed these bounds gets an inverted range. The two bounds should be reconciled when they cross (for example, by keeping the declared bound or collapsing to one point), so the clamp's answer lies inside both.
- evidence: read
- severity: low

## repairPrefValue passes any non-object through unchecked for an object leaf with fromScalar
- where: packages/prefs-schema/src/repair.ts:59 (repairPrefValue, case 'object')
- scenario: an object leaf whose `fromScalar` lifts a number width (`(w) => ({ width: w })`) is stored as `"garbage"`, `[1, 2]`, `true` or `null`. Because `fromScalar` is declared, repair returns the stored value as it is: there is no repair for "invalid, read the default", and nothing ever checks the scalar. `prefObjectBase` later hands that value to `fromScalar` (`object.ts:13`, which also passes `null`), so a corrupt record turns into `{ width: "garbage" }`. Children are only repaired when the stored value is already a plain object. The scalar should be lifted and its fields repaired, or the default read when it cannot be lifted.
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
