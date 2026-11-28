## describeShortcuts lists a tool's own bindings without the binding overrides in force, so a rebound or unbound tool key still reads as declared
- where: packages/routing/src/tools/describeShortcuts.ts:127 (toolBindingsByAction)
- scenario: a brush tool built by `defineTool` with `options.size` carries the binding `brush.grow.key` (`]`). A host rebinds it with `bindingOverrides` (or unbinds it). At runtime `scopeBindings` (`contributions/assemble.ts:28`) applies `overriddenBindings(entry.bindings, entry.id, overrides)` to every tool's bindings, so `]` no longer grows the brush. `ShortcutSheet` passes `tools.registry` (raw tools) to `describeShortcuts`, and `toolBindingsByAction` reads `tool.bindings` as authored, so the sheet still lists "Grow brush ]" and leaves out the new key. That contradicts both the module doc ("a rebound key reads rebound and an unbound one is gone") and ShortcutSheet's doc. Only the action-side bindings are correct, because `registry.list()` has already applied the overrides to them.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts (take `overrides` in `DescribeShortcutsOptions` and run each tool's bindings through `overriddenBindings(b, toolId, overrides)`), packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx (pass the overrides in force)
- size: function
- cause: overrides applied to action bindings only, not tool bindings
- confidence: likely

## toolOptionsPrefs silently ignores a host shared default whose key no tool names
- where: packages/routing/src/tools/toolOptionPrefs.ts:141 (toolOptionsPrefs)
- scenario: a host passes `shared: { fil: '#f00' }` (a typo for `fill`), or a key no mounted tool shares. The loop does `if (!leaf || !('kind' in leaf)) continue;`, so the default is dropped with no error. Every shape's `fill` then starts at the first tool's declared default. A default that a leaf rejects throws in the same function, so one bad host default is reported and the other is not.
- evidence: read
- severity: low
- size: line
- cause: unmatched shared key skipped silently
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

<!-- done: 2 findings, files read: 25 -->
