# routing.tools findings

## describeShortcuts lists tools' bindings without applying binding overrides, so a rebound or unbound tool key reads as its default
- where: packages/routing/src/tools/describeShortcuts.ts:130 (toolBindingsByAction), used at :147 (describeShortcuts)
- scenario: a tool with options gets `[`/`]` step bindings from `defineTool` (ids `<tool>.grow.key` etc.). A host rebinds `brush.grow.key` to `=` (or unbinds it) with `bindingOverrides`. At runtime `assemble.ts:28` routes the tool's bindings through `overriddenBindings(entry.bindings, entry.id, overrides)`, so `=` grows the brush and `]` does nothing. `describeShortcuts` reads `tool.bindings` raw and merges them into each action's bindings, so the shortcut sheet still shows `]` for "Grow Brush". The module's own header says "a rebound key reads rebound and an unbound one is gone", and `findScopedConflicts` and `describeKeymap` both apply overrides to entry bindings. Only the action's own `defaultBinding`s, which `registry.list()` has already overridden, come out right.
- evidence: read (describeShortcuts.ts:130-136, 147; assemble.ts:28; conflicts.ts:249; ShortcutSheet.tsx:89 passes no overrides)
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides not applied to tool-declared bindings (two paths answer "which keys are bound")
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
