# Findings: routing.tools

## describeShortcuts lists the keys tools declare without the binding overrides in force
- where: packages/routing/src/tools/describeShortcuts.ts:131 (toolBindingsByAction)
- scenario: a tool with size options gets `[`/`]` bindings to `brush.grow`/`brush.shrink` on `Tool.bindings` (toolOptionSteps). A host rebinds `brush.grow.key` to `=` with `bindingOverrides`. The dispatcher assembles tool bindings through `overriddenBindings(entry.bindings, entry.id, overrides)` (contributions/assemble.ts:28), so `=` fires and `]` does not. `describeShortcuts` merges `tool.bindings` raw into each action's bindings, so `<ShortcutSheet>` (which passes `tools.registry`) still lists `]` for "Grow brush". An unbound tool key also still shows. The module doc ("a rebound key reads rebound and an unbound one is gone") and ShortcutSheet's doc both promise otherwise; only the actions' own bindings arrive overridden through `registry.list()`. `describeKeymap` and `findScopedConflicts` both take `overrides` for this reason; `describeShortcuts` takes none.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: tool bindings read without overrides
- confidence: sure

## Two separate conflicts that reuse one spec object collapse into one report
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:146 (addConflict)
- scenario: the conflict key is built from gesture, target and each member's `identityKeyOf(spec)` plus its modifiers. It leaves out owner ids. Take gated actions A and B, which both hold in mode X, and C and D, which both hold in mode Y, all bound with one shared `const ESC = { kind: 'key', key: 'Escape' }`. They fall in one bucket, and `tieComponents` splits it into {A,B} and {C,D}, since X's and Y's rules are exclusive. Both components produce the same key, so the second one only adds its platform to the first (`found.platforms.add`), and the C/D conflict is never reported. A shared spec object is the normal case for kit constants: `toolOptionSteps`' `STEP_KEYS` gives every optioned tool the same spec objects.
- evidence: read
- severity: low
- size: line
- cause: conflict key omits owner ids
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
