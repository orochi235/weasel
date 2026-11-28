## describeShortcuts lists tool-declared bindings as authored, ignoring binding overrides
- where: packages/routing/src/tools/describeShortcuts.ts:130 (toolBindingsByAction), :151 (describeShortcuts)
- scenario: a tool binds `{ kind: 'key', key: 'x' }` to an action (e.g. a tool option step `brush.grow` on `]`), and the host rebinds or unbinds it through `bindingOverrides`. The dispatcher assembles tool bindings through `overriddenBindings(entry.bindings, entry.id, overrides)` (`contributions/assemble.ts:28`), and so do `describeKeymap` and `findScopedConflicts`, but `describeShortcuts` reads `tool.bindings` raw and takes no overrides option. The sheet shows `]` for a key that no longer does anything and omits the rebound key, contradicting its own header ("a rebound key reads rebound and an unbound one is gone"). `ShortcutSheet` (packages/ui) passes `registered` tools straight in, so the wrong sheet reaches users.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides not applied to tool bindings (two answers to "which keys are in force")
- confidence: likely

## A conflict's component joins bindings that never tie with each other
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:110 (findConflictsKeyed / tieComponents)
- scenario: three bindings on one bucket key, A `views: ['x']`, B `views: ['x','y']`, C `views: ['y']`. A–B tie (view x), B–C tie (view y), A–C never meet. `tieComponents` takes the transitive closure, so one Conflict is reported with `ownerIds` [A, B, C] and one warning line, naming A and C as colliding. The same happens with phases (`phasesTie`) or mutually exclusive `eligible` rules, which are pairwise and not transitive. Two pairwise conflicts (A,B) and (B,C) should be reported, or at least only owners that tie with someone in a shared state.
- evidence: read
- severity: low
- size: function
- cause: tie relation treated as transitive
- confidence: likely

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
