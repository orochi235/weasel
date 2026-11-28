## repairPrefValue throws on a `list` or `map` leaf that holds no `item`
- where: packages/prefs-schema/src/repair.ts:118 (repairList), packages/prefs-schema/src/repair.ts:104 (repairMap)
- scenario: an app draws its own renderer under a built-in kind, `{ kind: 'list', name: 'Tags', description: '', default: [] }` with no `item` (status.ts:105 calls this out as a real shape: "A leaf an app's renderer draws under a built-in's kind may hold no item"). A stored `['a']` goes through `repairPrefValue(leaf, ['a'])` → `repairList` maps each entry through `repairPrefValue(leaf.item, entry)` → `leaf.kind` on `undefined` throws a TypeError, so the store's read of that value throws. A map with a non-empty stored record throws the same way. Every other walk guards this case (`visibleInside`, `entryAt`, `insideLeaf`, `statusInside`, `leafWalk.inside`); repair should pass the entries through (or the array whole) when there is no item.
- evidence: read
- severity: medium
- size: line
- cause: missing `item === undefined` guard
- confidence: sure

## A condition reads a cleared `clearable` number as its `default`, where the form shows it empty
- where: packages/prefs-schema/src/judge.ts:164 (unsetValue)
- fix: packages/prefs-schema/src/judge.ts, packages/prefs-schema/src/leafValue.ts
- scenario: `{ kind: 'number', name: 'Limit', clearable: true, default: 5 }` (PrefNumber allows a clearable leaf a numeric default: "its default may be too"), held as `undefined` after the person empties the field. `prefValueOrDefault` (leafValue.ts:16) says a clearable leaf holding nothing "is cleared, and shows nothing", so the row draws an empty field. `prefReader`/`prefJudge` read the same path through `unsetValue`, which returns `leaf.default` = 5, so `{ path: 'limit' }` holds and `{ path: 'limit', is: null }` fails while the field visibly holds nothing. `prefJudge` promises to compare "each value as the control over its leaf ... shows it". The same applies to a clearable field of an object or a list entry (`fieldValue`, `entryValue`). Two answers to "what does a leaf holding nothing show"; `unsetValue` should answer `undefined` for a clearable leaf, as `prefValueOrDefault` does.
- evidence: read
- severity: medium
- size: line
- cause: clearable ignored in the condition reader's absent-value fallback
- confidence: likely

## An owner's switch inside a nested section is never spared, so it stays disabled for good
- where: packages/prefs-schema/src/status.ts:173 (leafWalk.section), packages/prefs-schema/src/statusAt.ts:162 (statusMatching)
- scenario: an object leaf `stroke` with `enableIf: { path: 'stroke.on' }` whose `children` put `on` under a section (`{ basic: { name: 'Basic', members: { on: boolean } }, width: number }`), or a section schema root with `enableIf: { path: 'on' }` and `on` inside a nested section. With `on` false, `members` hands the section `owner.status` (disabled) as its `above` and `owner.switchOf` (not the owner itself), so the section's own `PrefOwner` has `above.enabled === false` and no `enableIf`; `disablesOwn` is false and `prefStatusIn` leaves `stroke.on` disabled. The same field without the section around it is spared. A section adds nothing to a path, so wrapping the switch in a heading turns the object into one that can never be re-enabled; applyPrefConditions and prefStatusAt both do it, so the two agree on the wrong answer. The section's owner should carry the outer owner as its `switchOf` (or sparing should look through sections).
- evidence: read (traced `members` → `section` → `members` → `prefStatusIn` → `sparedIn` → `disablesOwn`)
- severity: medium
- fix: packages/prefs-schema/src/status.ts, packages/prefs-schema/src/statusAt.ts
- size: function
- cause: section owner drops the enclosing owner's switch
- confidence: sure

## A condition path into a list or map entry from the root is not decoded, though the reader and status walk descend into it
- where: packages/prefs-schema/src/holding.ts:66 (insideLeaf)
- scenario: a list `styles` whose item is an object with a boolean `italic` carrying an `encoding` (stores `'italic'`), and a test `{ path: 'styles.0.italic', is: true }`. `prefReader` reads the stored `'italic'` through `entryAt` (judge.ts:143). `prefShownReader` asks `prefLeavesHolding(schema, 'styles.0.italic')`, which for a `list` leaf returns `UNSEEN` instead of descending into `item`, so the value is never decoded and the test compares `'italic' === true` and fails while the toggle shows on. `prefStatusAt` documents entry paths with any key as supported, and the reader resolves them; only the decoding step stops at the list.
- evidence: read
- severity: low
- size: function
- cause: insideLeaf does not descend into a list's or map's item
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

<!-- done: 4 findings, files read: 31 -->
