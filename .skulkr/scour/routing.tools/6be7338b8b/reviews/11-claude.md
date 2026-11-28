# Findings: routing.tools

## describeShortcuts lists tools' own bindings as declared, ignoring binding overrides
- where: packages/routing/src/tools/describeShortcuts.ts:129 (toolBindingsByAction)
- scenario: a host rebinds a tool's binding through `bindingOverrides` (e.g. the brush's `brush.grow.key` from `]` to `.`, or unbinds it). The dispatcher and `findScopedConflicts` apply the override to tool bindings (`overriddenBindings(e.bindings, e.id, overrides)`, conflicts.ts:221), but `describeShortcuts` merges `tool.bindings` raw into each action's bindings, and `ShortcutSheet` passes `tools.registry` unmodified (packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx:89). The sheet shows `]` (and still lists an unbound key), contradicting the module doc "a rebound key reads rebound and an unbound one is gone". Should apply the overrides in force to each tool's bindings under the tool's id, or take an `overrides` option.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: tool bindings bypass overriddenBindings
- confidence: likely

## findConflicts groups bindings by transitive tie, naming owners that never tie with each other
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:96 (findConflictsKeyed / tieComponents)
- scenario: three ambient bindings on one key and modifier state with `views` A:['x'], B:['x','y'], C:['y']. A ties B (view x) and B ties C (view y), but A and C are never live in one view (`viewsTie` false). `tieComponents` takes the connected component, so one conflict is reported with ownerIds [A, B, C], claiming A and C tie. Same for phases or `eligible` rules that make a pair non-tying while each ties a third. Should report pairwise (or maximal cliques) rather than connected components.
- evidence: read
- severity: low
- size: function
- cause: connected components instead of pairwise ties
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
