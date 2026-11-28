## describeShortcuts lists tool bindings as declared, ignoring binding overrides
- where: packages/routing/src/tools/describeShortcuts.ts:130 (toolBindingsByAction)
- scenario: a host rebinds a tool's own binding (e.g. a brush's `brush.grow.key`) through `bindingOverrides`. Assembly (`contributions/assemble.ts:28`) routes the tool's bindings through `overriddenBindings(entry.bindings, entry.id, overrides)`, and `findScopedConflicts` and `describeKeymap` apply overrides too, but `describeShortcuts` reads `tool.bindings` raw and has no `overrides` option. The shortcut sheet shows the old key (and still shows an unbound one), against the module doc's promise that "a rebound key reads rebound and an unbound one is gone". Only the action registry's own bindings are read as overridden.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides not applied to tool-owned bindings
- confidence: sure

## The live tool for options and step keys ignores the mode, unlike routing
- where: packages/routing/src/tools/toolOptions.ts:110 (liveTool)
- scenario: a tool is held on its hotkey in a mode that does not allow it. `routedTool` (useContributions.ts:147) skips a held entry the mode leaves out and routes input to the active brush, but `liveTool` takes the top of `hotkeyStack` with no mode check. While that tool is held, `tuneToolOptions` sees the held tool as live, so the brush's action gets `{}` instead of its option values and draws with defaults. `enabledFor` in toolOptionSteps.ts declines `brush.grow`/`brush.shrink`, so `[` `]` do nothing even though the brush receives the input. The doc comment says "Routing walks held tools the same way", but it does not.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/toolOptions.ts, packages/routing/src/tools/tuneToolOptions.ts, packages/routing/src/tools/toolOptionSteps.ts
- size: design
- cause: one decision (which tool is live) answered with and without the mode
- confidence: likely

## A conflict joins bindings that never tie with each other through a third binding
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:160 (tieComponents)
- scenario: three bindings on one tuple with `views` A=['x'], B=['x','y'], C=['y']. A ties B and B ties C, but A never ties C (`viewsTie`). `tieComponents` takes the transitive closure, so one conflict names A, B and C. That reads as a three-way tie when there are two separate pairwise ties. The same happens across phases (`phasesTie`) and across eligibility rules.
- evidence: read
- severity: low
- size: function
- cause: transitive closure taken over a relation that is not transitive
- confidence: sure

## withToolOptionDefault installs a caller's starting value without checking it against the leaf
- where: packages/routing/src/tools/toolOptions.ts:85 (withToolOptionDefault)
- scenario: a tool hook's caller passes a starting `size: 0` (or a string, or 500) for a leaf with `min: 1, max: 100`. The value becomes `leaf.default` unrepaired. `toolOptionParams` hands that default straight to the action while nothing is held, and `stepOption` starts stepping from it. Every held value goes through `readHeld`/`repairPrefValue`, so only the default path skips bounds and kind checks.
- evidence: read
- severity: low
- size: line
- cause: default not repaired against the leaf
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

<!-- done: 4 findings, files read: 25 -->
