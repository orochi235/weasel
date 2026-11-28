# prefs-schema findings

## An owner's switch inside a section is never spared, so the owner can never be turned back on
- where: packages/prefs-schema/src/status.ts:136 (leafWalk `members` → `section`)
- scenario: an `object` leaf `stroke` with `enableIf: { path: 'stroke.on' }`, whose field `on` sits under a section `edge` in `children` (a section adds nothing to the path, so `stroke.on` is directly a field of `stroke`). With `on` false: `stroke` is disabled and its owner `disablesOwn`. `members` calls `section(child, …, owner.status, …, owner.switchOf)`; the section's status is `prefStatusUnder(owner.status, …)` = disabled, and the section's own owner has `above.enabled === false`, so `disablesOwn` is false and `switchReads` is never asked about `stroke.on`. `on` comes out disabled with everything else, so the switch can never be flipped back on. The same holds for a section schema root, or any section, whose `enableIf` reads a member of a nested section. It should be spared the way a field sitting directly in `children` is. `statusMatching` in statusAt.ts:173 builds the section owner the same way, so `prefStatusAt` gives the same wrong answer.
- evidence: read (traced through prefOwner/disablesOwn/sparedIn)
- severity: medium
- fix: packages/prefs-schema/src/status.ts, packages/prefs-schema/src/statusAt.ts
- size: function
- cause: section owner drops the enclosing owner's switch (switchOf only passed through, never set to the disabling owner)
- confidence: sure

## prefAliasedLeaf draws the target's `disabledReason` and `hidden` in place of the alias's own
- where: packages/prefs-schema/src/alias.ts:51 (prefAliasedLeaf)
- scenario: an alias with its own `disabledReason: 'Turn on Snap first'` (it has its own `enableIf`, which status.ts honors) is drawn through `prefAliasedLeaf` by routing's `resolveMenu` and prefs' `aliasTargets`/`edit/aliases`. `...rest` is the target's fields, and the alias contributes only name/description/short/access/pair/heading/tags. So the tooltip shows the target's reason (or none), and a target marked `hidden` (shown on purpose only through an alias elsewhere) makes the drawn leaf `hidden: true`. The alias's own presentational fields should win where it gives them, as its name does.
- evidence: read (callers grepped; I did not trace which surface reads `disabledReason` off the drawn leaf)
- severity: low
- fix: packages/prefs-schema/src/alias.ts
- size: line
- cause: alias's own PrefBase fields not overlaid
- confidence: likely

## A root-path condition into a list or map entry compares the stored form, not the shown one
- where: packages/prefs-schema/src/holding.ts:68 (insideLeaf)
- scenario: a list `styles` whose item is an object with a boolean field `italic` carrying an `encoding` (stores `'italic'`). The condition `{ path: 'styles.0.italic', is: true }` is judged by `prefJudge`. `prefReader` reads through the item (`fieldValue` → `entryAt`), but `prefShownReader` asks `prefLeavesHolding`, which returns `UNSEEN` for any path into a `list`/`map`, so the value is never decoded and `'italic' === true` fails. Two pathways answer "which leaf describes this value" differently: the reader knows the item, the decoder does not. `insideLeaf` should descend into `item` for an entry step, as `prefLeavesHoldingIn` does for `from: 'item'`.
- evidence: read
- severity: low
- fix: packages/prefs-schema/src/holding.ts
- size: function
- cause: list/map treated as unseen though `item` describes entries
- confidence: likely

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
