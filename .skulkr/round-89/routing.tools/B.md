## findConflicts merges non-transitive ties into one conflict, naming owners that never tie
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:84 (findConflictsKeyed → tieComponents)
- scenario: three bindings land in one bucket. A has `views: ['x']`, B has `views: ['x','y']`, C has `views: ['y']` (or phases that pair the same way). `tie(A,B)` and `tie(B,C)` hold, `tie(A,C)` does not. `tieComponents` takes the connected component, so one conflict comes out with `ownerIds` [A, B, C], which tells the reader that A and C collide when they are never live together. It should report the pairwise ties (A–B and B–C), or only the groups that really tie with each other. `viewsTie` and `phasesTie` are pairwise tests, so this has to be handled after them.
- evidence: read
- severity: low

## toolOptionsPrefs widens a shared option only for number, enum and string, so other leaf kinds repair against the first tool's bounds
- where: packages/routing/src/tools/toolOptionPrefs.ts:56 (widened)
- scenario: two tools share a key whose leaf is a `list` (or an `object`, `map`, `union`) and has different bounds, for example a `maxItems` of 2 on the first tool and 5 on the second. `widened` returns `held` unchanged. The store then repairs every value against the first tool's leaf, so a 4-item value the second tool writes gets cut down or reset when read back. The doc promises that the shared leaf keeps "what any tool may write". It should widen these kinds or throw on them, as it already throws on a kind mismatch.
- evidence: read (repairPrefValue in packages/prefs-schema/src/repair.ts repairs list/object/map/union against the leaf it is given)
- severity: low

## Files read
packages/routing/src/tools/defineTool.ts
packages/routing/src/tools/describeShortcuts.ts
packages/routing/src/tools/returnToModeDefault.ts
packages/routing/src/tools/routeTypes.ts
packages/routing/src/tools/routing/gestures.ts
packages/routing/src/tools/routing/index.ts
packages/routing/src/tools/routing/reflection/conflictKeys.ts
packages/routing/src/tools/routing/reflection/conflicts.ts
packages/routing/src/tools/routing/reflection/index.ts
packages/routing/src/tools/routing/reflection/registry.ts
packages/routing/src/tools/routing/routeGrammar.ts
packages/routing/src/tools/toolGaps.ts
packages/routing/src/tools/toolOptionPrefs.ts
packages/routing/src/tools/toolOptionSteps.ts
packages/routing/src/tools/toolOptions.ts
packages/routing/src/tools/toolSet.ts
packages/routing/src/tools/toolShortcuts.ts
packages/routing/src/tools/toolsScope.tsx
packages/routing/src/tools/tuneToolOptions.ts
packages/routing/src/tools/types.ts
packages/routing/src/tools/useModeDefaultTool.ts
packages/routing/src/tools/useToolLifecycle.ts
packages/routing/src/tools/useToolOptionValues.ts
packages/routing/src/tools/useToolShortcuts.ts
packages/routing/src/tools/useTools.ts

<!-- done: 2 findings, files read: 25 -->
