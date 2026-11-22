# prefs-schema findings (round 70, blind)

## A group's own `from: 'group'` test reads its parent group, so a mounted group cannot be switched by its own leaf
- where: packages/prefs-schema/src/groupConditions.ts:34-50 (resolveNode)
- scenario: `view: { children: { feature: pref.group('Feature', { on: pref.boolean('On', false), axis: … }, { enableIf: { from: 'group', path: 'on' } }) } }`. The group's own conditions are resolved with `group` = the path of the group it sits in (`view`), so its `enableIf` becomes `{ path: 'view.on' }`. It should read the `on` leaf beside `axis`, which is the switch pattern `PrefGroup.enableIf` describes ("a leaf directly in it that this reads… the group's switch"). The only way to reach its own switch is `path: 'feature.on'`, which bakes in the key the mounter picked. That breaks the "a group can be mounted anywhere" claim in `condition.ts:17-19` for the group-level switch, the case where mounting matters most. Leaves, sections, object fields and items resolve against the group that holds them. A group's own conditions are the one place where "the group it is declared in" and "its own group" disagree, and no test covers it (`groupConditions.test.ts` only tests leaf conditions).
- evidence: read (resolveNode passes `group` for the node's own CONDITIONS, and `path` only to its children)
- severity: medium

## `applyPrefConditions` never hands back the schema itself when it holds a group test, though its docs promise it does
- where: packages/prefs-schema/src/status.ts:177,201-205 (applyPrefConditions)
- scenario: a schema anywhere holding `{ from: 'group', … }` is replaced by `resolvePrefGroupConditions(schema)` at line 177, and the walk then compares against the resolved nodes. With every node shown, `shown` is the resolved copy and not `schema`, and every node on the path to a resolved test is a copy too. `PrefConditionsApplied.shown` promises "The schema itself when that is all of it", and the closing doc line promises "Parts with nothing dropped come back as the objects they were". A caller that keys by node identity (`shown === schema` to skip work, a Map from schema node to row state, or memoization on the returned subtree) misses every time for such a schema.
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
