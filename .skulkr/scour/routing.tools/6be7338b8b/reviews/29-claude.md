## describeShortcuts lists a tool's own bindings without the binding overrides in force
- where: packages/routing/src/tools/describeShortcuts.ts:130 (toolBindingsByAction), :150 (describeShortcuts)
- scenario: a tool's step binding (`brush.grow.key`, `]`) is rebound to `+` by `bindingOverrides`. Assembly applies the override to tool bindings (`contributions/assemble.ts:28`, `overriddenBindings(entry.bindings, entry.id, overrides)`), so `+` is what fires. But `describeShortcuts` reads `tool.bindings` raw from `opts.tools`, and `DescribeShortcutsOptions` takes no overrides, so the sheet still lists `]` for "Grow brush". An override that unbinds it still shows a key. The module doc promises "a rebound key reads rebound and an unbound one is gone". `findScopedConflicts` and `describeKeymap` both take overrides and apply them to owner bindings, so this is the one reader that answers differently. `ShortcutSheet.tsx:89` passes the raw tool registry.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides not applied to tool-owned bindings
- confidence: sure

## findConflicts merges bindings that tie only through a third binding into one conflict
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:110 (tieComponents), :99 (findConflictsKeyed)
- scenario: three bindings land in one bucket. A has `views: ['x']`, B has `views: ['x','y']`, C has `views: ['y']`. A ties B and B ties C, but A and C can never be live in the same view (`viewsTie` is false). `tieComponents` returns the connected component {A,B,C}, and the reported conflict names all three owners as if they shared one tuple. The same thing happens when an `eligible` rule or a phase keeps A and C apart. The report should give two pairwise conflicts (A,B) and (B,C), or a set in which every pair ties.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/routing/reflection/conflicts.ts
- size: function
- cause: transitive closure used where tie is not transitive
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
