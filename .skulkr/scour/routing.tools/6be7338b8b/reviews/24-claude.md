## describeShortcuts lists a tool's own bindings unrebound, so a rebound tool key reads as its declared key
- where: packages/routing/src/tools/describeShortcuts.ts:126 (toolBindingsByAction)
- scenario: a tool with options (a brush) carries `brush.grow` bound to `]` on the tool's own `bindings` (`brush.grow.key`). The host rebinds it with `bindingOverrides` (`brush.grow.key` → `.`). Assembly applies overrides to tool bindings by owner id (`contributions/assemble.ts:28`, `overriddenBindings(entry.bindings, entry.id, overrides)`), so `.` grows the brush; but `describeShortcuts` reads `tool.bindings` raw and has no `overrides` option, so `ShortcutSheet` (which passes `tools: tools.registry`) still lists `]` under "Grow brush", and an unbound one still shows. The module header promises "a rebound key reads rebound and an unbound one is gone". `describeKeymap` and `findScopedConflicts` both take `overrides` for exactly this; `describeShortcuts` answers the same question a second way.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides not applied to tool-declared bindings
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

<!-- done: 1 findings, files read: 25 -->
