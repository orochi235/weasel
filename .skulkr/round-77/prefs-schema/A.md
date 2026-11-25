# Audit round 77 — prefs-schema — blind reviewer findings

## A root-path read into a list or map entry finds no item-field default, where the same field read `from: 'item'` gets one
- where: packages/prefs-schema/src/judge.ts:110 (fieldValue), via packages/prefs-schema/src/holding.ts:66 (insideLeaf)
- scenario: list leaf `phases` whose item is an object with field `hold` (default `true`), stored `[{}]`. `prefReader(schema, values)('phases.0.hold')` → `fieldValue(list, [{}], '0.hold')` → `prefValueAt` misses → `prefLeavesHoldingIn(list, '0.hold')` → `insideLeaf` returns `UNSEEN` for every `list`/`map` → `undefined`. The same entry read as `{ from: 'item', path: 'hold' }` goes through `entryValue` → `fieldValue(item, {}, 'hold')` → `true`. So `{ path: 'phases.0.hold' }` and `{ from: 'item', path: 'hold' }` disagree for one entry. The same miss reaches `prefHeldVariants` in `statusInside` (statusAt.ts), which tests a concrete entry's union tag by its root path (`phases.2.fill.type`): an entry whose union value omits fields reads `undefined` beside the item's defaults, so `prefStatusAt` falls back to "every variant". Should descend into the item for a concrete entry key, as `entryValue` does.
- evidence: read
- severity: medium

## `prefDisplayBounds` decides a unit's direction from stored 0 and 1 only, so a decreasing unit undefined there comes out with min above max
- where: packages/prefs-schema/src/helpers.ts:30 (prefDisplayBounds)
- scenario: a function unit `toDisplay: (s) => -Math.log(s - 10)` on a leaf `min: 20, max: 100`. `toDisplayExact(1)` and `(0)` are both NaN, so `backward` is false; `lo = -2.30`, `hi = -4.50`, giving `min = -2.30 > max = -4.50`. The "narrower than one place" fallback swaps back to `[low, high]`, the same inverted pair. Any decreasing nonlinear unit that is not finite at stored 0 or 1 (a log over offset ranges, a reciprocal) gets inverted bounds, and `endless` and `stops` stay unflipped. Direction should be measured at the leaf's own bounds or default, as `nonlinearStep` does for the step.
- evidence: read
- severity: low

## A group's switch that is a field of an object leaf in the group is disabled by the group's own `enableIf`
- where: packages/prefs-schema/src/statusAt.ts:72 (prefStatusIn)
- scenario: group `feature` with `enableIf: { path: 'feature.opts.on' }`, where `feature.opts` is an `object` leaf directly in it holding field `on`. `prefStatusIn` spares a leaf only if `prefConditionPaths(enableIf).includes(path)`. `'feature.opts'` is not `'feature.opts.on'`, so the object is disabled, and so is its field `on`, since the object's owner has no `enableIf` of its own to spare it. The switch the group reads can never be turned back on. `PrefGroup.enableIf`'s doc says a leaf directly in the group "that this reads" stays live; this one reads through it. The same check in `applyPrefConditions` (status.ts) goes through `prefStatusIn` too, so both disagree with the doc.
- evidence: read
- severity: low

## `prefAliasedLeaf` drops the target's short forms when the alias names itself, but keeps the target's access letter
- where: packages/prefs-schema/src/alias.ts:50 (prefAliasedLeaf)
- scenario: target `{ name: 'Grid', access: 'G', short: ['Gr'] }`, alias `{ name: 'Show lattice', of: 'view.grid' }` and no `access`. `short` is dropped because it abbreviates the target's name, but `access: 'G'` comes through `...rest`, so the alias's menu row is picked by a letter its own name ("Show lattice") does not have. Both are tied to the name, and the decision goes two ways.
- evidence: read
- severity: low

## The pbt fixture's `leaf()` says it excludes `paint`, but its scalar arm yields paint leaves
- where: packages/prefs-schema/src/testing/pbt.fixture.ts:142 (leaf / scalarLeaf)
- scenario: the doc reads "A leaf of any value-holding built-in kind but `paint`", but `scalarLeaf` includes `fc.constant<PrefPaint>(...)`. A property test written against the doc, one assuming no paint leaf, gets paint leaves (`default: { color }`, `null` admitted) and fails, or is wrongly trusted.
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
