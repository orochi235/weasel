# Findings: prefs-schema (audit round 54)

Read at HEAD 830b463cc1; the brief's commit 608f35f5 is not in this clone, and `packages/prefs-schema` has no
uncommitted changes.

## `repairPrefValue` never repairs an object leaf's dotted field (`'nib.angle'`)
- where: packages/prefs-schema/src/repair.ts:82 (repairFields)
- scenario: an `object` leaf whose `children` hold a dotted key, as core's stroke leaf does (`'nib.angle'`,
  `defaultNodeProperties.ts:186`), stores `{ nib: { angle: 'garbage' } }`. `repairFields` tests
  `Object.hasOwn(stored, 'nib.angle')`, which is false for the nested form that `prefObjectWithField` writes, so the
  field is skipped and `'garbage'` (or an out-of-range number) reads through unrepaired. It should read the field the
  way `prefObjectField` does (split on `.`) and write it back nested.
- evidence: read
- severity: medium

## `prefStatusAt` answers a dotted object field with the status of a sibling whose key is its prefix
- where: packages/prefs-schema/src/statusAt.ts:85 (statusAmong)
- scenario: core's stroke leaf declares `nib` (a boolean) before `'nib.angle'`, whose `showIf` is
  `{ path: 'data.stroke.nib' }` (`defaultNodeProperties.ts:185-186`). `prefStatusAt(schema, 'data.stroke.nib.angle', holds)`
  walks the children in order, takes `nib` because `'nib.angle'.startsWith('nib.')`, and returns `statusInside(nib, …)`,
  which for a boolean is `nib`'s own status: shown, with the nib off. `applyPrefConditions` hides the same field, so the
  two answer one question two ways. `holding.ts`'s `amongFields` already prefers an exact key before a prefix; this walk
  should do the same (or take the longest matching key).
- evidence: read
- severity: medium

## `PrefValueOf` types a `clearable` number as `number`, though it reads `undefined` once cleared
- where: packages/prefs-schema/src/paths.ts:52 (PrefValueOf)
- scenario: `{ kind: 'number', clearable: true, default: undefined, … }` (allowed by `PrefNumber`, `number.ts:71`,
  whose doc says a cleared field's value "is then `undefined`"). `PrefValuesOf<typeof schema>` gives that key
  `number`, so a consumer reading `values.view.limit.toFixed()` typechecks and throws at run time. The enum branch
  two lines down already answers `T | undefined` for `clearable: true`; the number branch should do the same.
- evidence: read
- severity: low

## `prefDisplayBounds` misses a decreasing unit when `places` rounds the unit step to zero
- where: packages/prefs-schema/src/helpers.ts:26 (prefDisplayBounds)
- scenario: a linear unit `{ scale: -1000, places: 0 }` on a leaf with `min: 0, max: 10000`. `backward` compares
  `toDisplay(1)` with `toDisplay(0)`, both rounded to `places`: `-0.001` rounds to `-0` and `-0 < 0` is false. So it
  is read as increasing, and the result is `{ min: -0, max: -10 }` (min above max), with `endless` unflipped. Any
  decreasing unit with |scale| over half of 10^places hits it. The direction test should use `toDisplayExact`,
  which this function already destructures.
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
