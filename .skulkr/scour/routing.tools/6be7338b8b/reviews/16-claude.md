## describeShortcuts lists a tool's own key bindings as declared, ignoring binding overrides
- where: packages/routing/src/tools/describeShortcuts.ts:126 (toolBindingsByAction)
- scenario: a brush tool with `options.size` gets `brush.grow` bound to `]` on the tool (`opts.id: 'brush.grow.key'`). The user rebinds that id with `bindingOverrides` to `.`. The dispatcher applies the override to tool bindings (`contributions/assemble.ts:28`, `overriddenBindings(entry.bindings, entry.id, overrides)`), so `.` grows the brush and `]` does nothing. `describeShortcuts` merges `tool.bindings` raw into each action's bindings and has no overrides input, so the sheet (`ShortcutSheet.tsx:89` passes `tools.registry`) still shows "Grow brush ]", and an override that unbinds the key still shows it. The module doc promises "a rebound key reads rebound and an unbound one is gone"; that holds only for action `defaultBinding`s, which `registry.list()` has already overridden.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides applied to action bindings but not to tool bindings
- confidence: sure

## findScopedConflicts reports one self-collision twice when a group pass joins a third binding to it
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:285 (findScopedConflicts)
- scenario: ambient tool T has two bindings on the same tuple, and ambient tool U has a third. The self pass `findConflictsKeyed([T])` reports the conflict {T.b1, T.b2}. The ambient group pass then finds the component {T.b1, T.b2, U.b}, whose `addConflict` key holds three spec identities and whose ownerIds are [T, T, U], so the `seen` dedupe (key + ownerIds) does not match the first. Both get reported, and the [T, T] pair shows up twice in `reportRouteConflicts` output. The same thing happens in the hotkey group for two hotkey-capable registry tools.
- evidence: read
- severity: low
- size: function
- cause: dedupe keyed on the whole component, not on the pairs it contains
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
