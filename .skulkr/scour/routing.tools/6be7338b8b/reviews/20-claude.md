## describeShortcuts lists tool-declared bindings without binding overrides, so a rebound or unbound tool key reads as declared
- where: packages/routing/src/tools/describeShortcuts.ts:126 (toolBindingsByAction), used at :146 (describeShortcuts)
- scenario: a brush tool with options gets `brush.grow` bound to `]` through its own `Tool.bindings` (`defineTool` adds the step bindings there, id `brush.grow.key`). The user rebinds `brush.grow.key` to `=` with `bindingOverrides`. Dispatch applies the override to tool bindings (`contributions/assemble.ts:28` runs `overriddenBindings(entry.bindings, entry.id, overrides)`), and so do `findScopedConflicts` and `describeKeymap`. But `describeShortcuts` merges `tool.bindings` raw, and `ShortcutSheet` passes `tools.registry` raw, so the sheet still shows `]` for "Grow brush" (and still lists a key the override unbound). The module doc and the ShortcutSheet doc both promise "a rebound key reads rebound and an unbound one is gone". It should take the resolved overrides (as `describeKeymap` does) and run each tool's bindings through `overriddenBindings(tool.bindings, toolId, overrides)`.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: tool bindings bypass overrides
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
