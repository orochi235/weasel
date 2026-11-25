# Audit round 69 — prefs-schema findings

## `prefStatusAt` does not narrow an alias that is a field of an object/union leaf or a list/map item, where `applyPrefConditions` does
- where: packages/prefs-schema/src/statusAt.ts:175 (prefStatusAt)
- scenario: An `alias` leaf can be a child of an `object` leaf (`children: Record<string, PrefLeaf | PrefSection>`) or sit inside a list's `item`. `applyPrefConditions` walks those fields through `leafWalk.leaf`, which applies `prefAliasStatus` to every alias it meets (status.ts:82). So with `stroke.link = alias of 'view.grid'` and `view.grid` hidden, `applyPrefConditions` drops/hides `stroke.link`. `prefStatusAt(schema, 'stroke.link', holds)` instead looks the alias up with `prefLeafAt`, which returns `undefined` for any field inside an object leaf (helpers.ts:114), so the alias check is skipped and it answers `{ shown: true, enabled: true }`. Its doc says an alias answers "as `applyPrefConditions` has it". Two answers to one question; a surface that asks `prefStatusAt` for one row draws or enables an alias whose target is hidden or disabled.
- evidence: read
- severity: low

## `prefReader` reads a scoped leaf as its raw `PrefScope` (or `default`, ignoring `defaultScope`) and an auto leaf as `default`
- where: packages/prefs-schema/src/judge.ts:68 (prefReader)
- scenario: `prefReader` claims to read "the way a form over `schema` shows it". For a leaf with `scopes`, what is stored is a `{ $by, $in, $else }` object; `prefValueAt` returns that object, so a condition `{ path: 'view.gap', atLeast: 1 }` is false (not a number) and a bare `{ path: 'view.gap' }` is true (object with keys) whatever the selected option's value is. With nothing stored, it returns `leaf.default`, not the `defaultScope` value the leaf actually holds for the current option (schema.ts:111-116). Likewise a leaf with `auto: { on: true, value: 5 }` and `default: 0` reads 0 here, though `PrefBase.auto` says it reads its auto value "never its `default`" and that "a store and every surface honor it alike". A `showIf` over such a leaf, judged through `prefJudge(schema, prefReader(schema, values))`, answers differently from what the form shows. The mismatch is read from the code; how often a caller feeds this reader scoped/auto values is inference.
- evidence: read (code); impact on callers inferred
- severity: low

## `prefDisplayBounds` rounds `stops` to nearest under `places` while it rounds `min`/`max` inward, so a stop can land outside the shown range
- where: packages/prefs-schema/src/helpers.ts:42 (prefDisplayBounds)
- scenario: Linear unit `{ scale: 1, places: 2 }`, `max: 0.999`, `stops: [0.999]`. `max` goes through `shownBound(..., Math.floor)` → 0.99, but the stop goes through `toDisplay`, which is `Number(x.toFixed(2))` → 1.00. The slider is handed a stop at 1.00 on a track ending at 0.99, so the stop is drawn past the end, and a drag or key step that catches it stores a value past the leaf's `max` (later clamped back, so the value jumps off the stop). The same holds at `min` with `ceil`. Bounds and stops are both "points" per the doc, but the two are rounded by different rules.
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
