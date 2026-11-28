# routing.tools — blind review findings

## describeShortcuts lists a tool's own bindings without the binding overrides in force, so a rebound option-step key still reads as its default
- where: packages/routing/src/tools/describeShortcuts.ts:130 (toolBindingsByAction), used at :152 (describeShortcuts)
- scenario: a brush tool from `defineTool({ options: { size, … } })` binds `]`/`[` to `brush.grow`/`brush.shrink` as tool bindings (`Tool.bindings`, owner `brush`). The host rebinds `brush.grow.key` to `=` through `bindingOverrides`. The dispatcher assembles tool bindings through `overriddenBindings(entry.bindings, entry.id, overrides)` (contributions/assemble.ts:28), so `=` grows the brush and `]` does nothing. `ShortcutSheet` calls `describeShortcuts(registry.list(), { tools: tools.registry })`. `registry.list()` applies overrides only to the actions' own `defaultBinding`s. `toolBindingsByAction` reads `tool.bindings` raw, so the sheet's "Grow Brush" row shows `]`, and an unbound step key still shows up. The sheet's doc (ShortcutSheet.tsx:70) and this module's header both promise that "a rebound key reads rebound and an unbound one is gone".
- evidence: read (assemble.ts:28 and conflicts.ts:249 apply `overriddenBindings` to tool bindings; describeShortcuts has no overrides input)
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: tool bindings read before overrides are applied
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
