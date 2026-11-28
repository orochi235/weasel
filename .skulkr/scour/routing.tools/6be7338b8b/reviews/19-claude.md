## describeShortcuts lists a tool's own bindings as authored, ignoring binding overrides
- where: packages/routing/src/tools/describeShortcuts.ts:131 (toolBindingsByAction), used at :146
- scenario: a host rebinds a tool binding through `bindingOverrides` — say a brush tool's `brush.grow.key` from `]` to `.`, or unbinds it with `null`. The dispatcher assembles tool bindings through `overriddenBindings(entry.bindings, entry.id, overrides)` (contributions/assemble.ts:28), so `.` grows the brush and `]` does nothing. `ShortcutSheet` calls `describeShortcuts(registry.list(), { tools: tools.registry })` (ui ShortcutSheet.tsx:89). `list()` applies overrides to action bindings only, and `toolBindingsByAction` reads `tool.bindings` raw, so the sheet still lists "Grow Brush ]", and an unbound key still shows. The file's own header says "a rebound key reads rebound and an unbound one is gone". It should read the tool bindings under the overrides in force, as `findScopedConflicts` (`asBound`) and `describeKeymap` do.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides never applied to tool bindings
- confidence: sure

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

<!-- done: 1 findings, files read: 25 -->
