# prefs-schema findings

## A condition reads any value shaped like a scope as a split value, even on a leaf with no `scopes`
- where: packages/prefs-schema/src/judge.ts:150 (shownValue)
- scenario: a `map` leaf (keys nobody declared) holds `{ $by: 'mode', $in: { a: 1 } }`, two keys a person can type, or an `object` / app-defined leaf has fields `$by` (a string) and `$in` (an object). `isPrefScope(value)` is true, `prefScopesOf(leaf)` is empty, so the selection is empty and `prefScopeValue` returns the scope's `$else`, else `leaf.default`. A condition on that leaf (`{ path: 'tags' }`, `isSet`) then compares the default rather than the value stored: it reads "not set" while the map holds two keys. It should be read as a scope only when the leaf declares `scopes`.
- evidence: read
- severity: low
- fix: packages/prefs-schema/src/judge.ts
- size: line
- cause: scope shape tested without checking the leaf declares scopes
- confidence: likely

## A root-path condition into a list or map entry compares the stored form, not what the control shows
- where: packages/prefs-schema/src/holding.ts:69 (insideLeaf)
- scenario: list `phases` whose item is an object with a boolean field `italic` that has an `encoding` (stores `'italic'`). A test `{ path: 'phases.0.italic', is: true }` has no `from`, so it is read from the root. `prefReader` goes into the entry (`fieldValue` → `entryAt`) and returns `'italic'`, but `prefShownReader` asks `prefLeavesHolding`, which returns `UNSEEN` for anything under a `list`/`map`, so nothing gets decoded and the test fails while the toggle shows on. The same field read with `from: 'item'` is decoded through `prefLeavesHoldingIn`. So the same value is interpreted one way by the reader and another way by the decoder, depending on the path form. `prefStatusAt` documents entry paths with any key as supported.
- evidence: read
- severity: low
- fix: packages/prefs-schema/src/holding.ts
- size: function
- cause: holding stops at list/map, while the reader descends into entries
- confidence: likely

## An alias drawn through `prefAliasedLeaf` shows the target's `disabledReason`, and loses its own
- where: packages/prefs-schema/src/alias.ts:50 (prefAliasedLeaf)
- scenario: an alias with its own `enableIf` and `disabledReason: 'Turn on sync first'` points at a leaf whose `disabledReason` is something else, or is absent. The drawn leaf takes all of `...rest` from the target, so its `disabledReason` is the target's. While the alias is disabled by its own condition, its tooltip (prefs' `aliasTargets`, routing's `resolveMenu`) gives the target's reason or none. The alias's `meta` and `icon` are dropped the same way, even though the alias's name, description, short forms and access letter are carried over.
- evidence: read
- severity: low
- size: line
- cause: aliased leaf spreads target fields without overlaying the alias's own
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
