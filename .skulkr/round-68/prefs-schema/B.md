# Audit round 68 — prefs-schema findings

## prefDisplayBounds rounds a unit leaf's min and max to the nearest shown place, so the display range can reach past the stored bounds
- where: packages/prefs-schema/src/helpers.ts:27 (prefDisplayBounds)
- scenario: `lo`/`hi` go through `toDisplay`, which rounds to `places` with `toFixed` (nearest), not inward. Take a leaf `{ min: 0.5, unit: { scale: 10, suffix: 'cm', places: 0 } }`: `toDisplay(0.5)` is `0.05 → 0`, so the field's display min is 0. A person can then drag or type 0, `fromDisplay(0)` stores 0, which is below the leaf's `min` of 0.5, and the stored value is out of bounds until a later repair clamps it. The same goes for `max: 99.6` at `scale: 1, places: 0`: the display max rounds to 100 and stores 100. The step is rounded up deliberately (`displayStep`) so it always changes the shown value, but the bounds get no matching treatment: min should round up and max round down (with ends swapped for a decreasing conversion), or use `toDisplayExact`.
- evidence: read (helpers.ts:25-29, unit.ts:108-111; prefField.tsx:101-103 clamps to these bounds and then stores `unit.fromDisplay(clamp(n))`)
- severity: medium

## prefDisplayBounds swaps min/max for a decreasing unit but leaves `stops` in descending order
- where: packages/prefs-schema/src/helpers.ts:32 (prefDisplayBounds)
- scenario: when `toDisplayExact(1) < toDisplayExact(0)` (a negative `scale`), the function swaps `min`/`max` and flips `endless` so the display space reads low to high, but `stops: p.stops?.map(toDisplay)` keeps the stored order. Ascending stored stops `[0, 10, 20]` come out descending (`[0, -10, -20]`), while every other field was normalized to ascending display order. A slider that walks stops in order to find the next one a key step crosses gets them backwards. That last part is inferred, not traced into the slider.
- evidence: read (inference for the consumer effect)
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
