## A switch leaf nested in a sub-section of the node whose `enableIf` reads it is disabled by that condition and can never be turned back on
- where: packages/prefs-schema/src/status.ts:142 (leafWalk `members` → `section`), packages/prefs-schema/src/statusAt.ts:173 (statusMatching)
- scenario: a section-root schema (or an `object` leaf) `{ enableIf: { path: 'visible' }, members: { look: { name: 'Look', members: { visible: boolean, opacity: number } } } }` with `visible` off. The root owner is disabled by its own `enableIf`; `section()` builds the `look` section's status under `owner.status` (disabled) and its owner has no `enableIf` of its own, so `disablesOwn(lookOwner)` is false and `prefStatusIn` returns the disabled status for `visible`. `visible` lands in `disabled`, so the switch that would re-enable everything is itself disabled. Sections add nothing to a path (`visible` is addressed exactly as a direct member would be), and the sparing rule exists precisely because "disabled by its own condition it could never be turned back on". Should: a section between an owner and its switch carries the owner's switch the way `switchOf` carries it through a leaf, so `visible` stays enabled and `opacity` stays disabled. `prefStatusAt` (statusMatching builds the same section owner) agrees with the walk, so both answer wrong together.
- evidence: read
- severity: medium
- fix: packages/prefs-schema/src/status.ts, packages/prefs-schema/src/statusAt.ts
- size: function
- cause: section owner drops the enclosing owner's switch
- confidence: likely

## An alias's drawn leaf takes the target's `disabledReason`, `showIf`, `enableIf` and `hidden`, dropping the alias's own
- where: packages/prefs-schema/src/alias.ts:51 (prefAliasedLeaf)
- scenario: `{ kind: 'alias', of: 'view.grid', name: '', description: '', default: undefined, enableIf: { path: 'pro' }, disabledReason: 'Needs Pro' }`. The status walk disables the alias by its own `enableIf`, but the leaf a surface draws (`prefAliasedLeaf`) is built from `...rest` of the target, so its `disabledReason` is the target's (or none) and the tooltip never says "Needs Pro". Its `showIf`/`enableIf` are the target's too, so any reader that checks the drawn leaf's own conditions (`prefIsEnabled(drawn, …)`) answers for the target, not the alias. Should: the alias's own `disabledReason` (and its own conditions) win where it gives them, as its name, description and access letter do.
- evidence: read
- severity: low
- size: line
- cause: target fields spread over the alias's own
- confidence: likely

## A condition read by root path into a list or map entry compares the stored form, not the shown one, for an encoded leaf
- where: packages/prefs-schema/src/holding.ts:66 (insideLeaf), packages/prefs-schema/src/shown.ts:37 (prefShownReader)
- scenario: list `styles` whose item is an object with a boolean `italic` carrying an `encoding` (stores `'italic'`). A test `{ path: 'styles.0.italic', is: true }`: `prefReader` (judge.ts `fieldValue` → `entryAt`) reads into the entry and returns `'italic'`, but `prefLeavesHolding` returns `UNSEEN` for anything inside a list/map, so `prefShownReader` hands back `'italic'` undecoded and `is: true` fails. The same value is decoded when read with `from: 'item'` (`prefLeavesHoldingIn`). Two readers answer "which leaf describes this path" differently: judge descends into entries, holding does not. Should: `insideLeaf` descends into `item` for list/map paths (first step an entry key) as `entryAt` does.
- evidence: read
- severity: low
- fix: packages/prefs-schema/src/holding.ts
- size: function
- cause: holding stops at list/map, judge does not
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
