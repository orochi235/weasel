## describeShortcuts lists tool-declared bindings without the binding overrides the dispatcher applies to them
- where: packages/routing/src/tools/describeShortcuts.ts:131 (toolBindingsByAction), :151 (describeShortcuts)
- scenario: a brush tool built with `options.size` gets `brush.grow` bound to `]` on the tool's own `bindings` (owner = tool id `brush`). The host rebinds or unbinds that binding through `bindingOverrides` (keyed by owner `brush`). The dispatcher routes the override (`contributions/assemble.ts:28` runs `overriddenBindings(entry.bindings, entry.id, overrides)`), but `describeShortcuts` reads `tool.bindings` raw. So `<ShortcutSheet>` (which passes `tools.registry` as given) still shows `]` for "Grow brush", and still shows it after the key is unbound. The module doc ("a rebound key reads rebound and an unbound one is gone") and ShortcutSheet's doc both promise the opposite. `DescribeShortcutsOptions` takes no overrides, so a caller can't fix this from outside. `findScopedConflicts` does apply them (`conflicts.ts:249`), so the two reflection paths disagree.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: tool-owned bindings never pass through overriddenBindings
- confidence: sure

## findScopedConflicts groups bindings transitively, so one conflict names owners that never tie with each other
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:105 (findConflictsKeyed / tieComponents)
- scenario: three ambient bindings in one bucket (same key, modifiers and target). A has `views: ['a']`, C has `views: ['b']`, B has `views: ['a','b']`. `viewsTie` holds for A–B and B–C but not for A–C. `tieComponents` takes the connected component, so `addConflict` reports one conflict with `ownerIds [A, B, C]`, and `reportRouteConflicts` warns that all three declare the same tuple in the same scope. A and C can never be live in one view. The same thing happens through `phasesTie` or exclusive `eligible` rules: a pair the doc says is "intentionally NOT flagged" is named together because of a third binding. The `yields` excuse is also checked only per pair, so a yielding A is still listed beside C through B.
- evidence: read
- severity: low
- size: function
- cause: connected components used where ties aren't transitive
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
