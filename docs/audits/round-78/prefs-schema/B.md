## prefObjectBase calls `fromScalar` unguarded, where repair treats a throw from it as an invalid value
- where: packages/prefs-schema/src/object.ts:11 (prefObjectBase); reached from packages/prefs-schema/src/judge.ts:138 (fieldValue) and object.ts:33 (prefObjectWithField)
- scenario: an `object` leaf whose `fromScalar` throws on a scalar it does not recognize (e.g. a string where it expects a number), and a held value that is such a scalar (a scene node's raw value, or any values handed to `prefReader` without repair). `repairScalar` (repair.ts:89-95) catches the throw and reads the default, so the package has already decided that a throwing `fromScalar` means "invalid". But a condition reading a field of that leaf (`{ path: 'stroke.width', ... }`) goes `prefReader` → `fieldValue` → `prefObjectBase` → throws out of `prefConditionHolds`, taking down the whole status walk (`applyPrefConditions`/`prefStatusAt`) for the surface. An edit to one field (`prefObjectWithField`) throws the same way. Expected: the same answer repair gives, i.e. start from the leaf's `default`.
- evidence: read (repair.ts wraps `fromScalar` in try/catch; object.ts does not)
- severity: medium

## An alias's drawn leaf keeps the target's `pair`, whose `with` names the target's partners, not leaves beside the alias
- where: packages/prefs-schema/src/alias.ts:49 (prefAliasedLeaf)
- scenario: target `view.x` has `pair: { with: 'view.y' }`, and an alias of it sits on another page at `quick.x`. `prefAliasedLeaf` spreads `...rest` from the target, so the drawn leaf carries `pair.with: 'view.y'`. A surface that runs `prefPairRows` over rows including the aliased leaf (routing's `resolveMenu`, prefs' `aliasTargets` both draw through `prefAliasedLeaf`) gets the alias claiming a row partner that is not drawn beside it; when the alias comes first in the walk, `view.y` is put on the alias's row key (`rows.set(partner, row)` skips only paths already set), so the target's real pairing breaks. `heading: true` carries over likewise, putting the alias's control into the heading of the alias's own group. Expected: the alias drops placement fields that are meaningful only at the target's position (`pair`, `heading`), as it already drops `short`/`access` when renamed.
- evidence: inference (read alias.ts and schema.ts prefPairRows; did not trace a consumer end to end)
- severity: low

## The once-per-path warning set in prefConditionHolds grows without bound and is never cleared
- where: packages/prefs-schema/src/condition.ts:132 (`warned`, warnUnresolved)
- scenario: an app that builds schemas at run time (paths with generated keys, such as per-node or per-entry groups) and evaluates their `from: 'group'` tests through an unresolved path adds one module-level string per distinct path, forever. Nothing bounds or prunes the set. Expected: a cap (or a WeakSet keyed by the condition object) so the dedupe cannot leak.
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
