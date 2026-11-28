## describeShortcuts lists a tool's bindings without the binding overrides in force, so a rebound tool key reads as its old key
- where: packages/routing/src/tools/describeShortcuts.ts:129 (toolBindingsByAction)
- scenario: a host rebinds a tool binding with `bindingOverrides` (say the brush's `[`/`]` step keys, which `defineTool` puts on `Tool.bindings` with ids `<tool>.grow.key` etc.). At runtime `assemble.ts:28` applies `overriddenBindings(entry.bindings, entry.id, overrides)`, so the new key fires. `describeShortcuts` reads `tool.bindings` raw: `DescribeShortcutsOptions` has no `overrides`, and `ShortcutSheet.tsx:89` passes `registered` tools as they are. The sheet shows `[`/`]` for a key that no longer does anything and leaves out the key that does. That contradicts the module's promise ("a rebound key reads rebound and an unbound one is gone"). Only `actions` (from `registry.list()`) carry overrides.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides applied to action bindings only, not tool bindings
- confidence: likely

## findConflicts merges bindings that tie only through a third binding into one conflict
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:153 (tieComponents)
- scenario: three bindings land in one bucket: A has `views: ['x']`, B has `views: ['x','y']` and C has `views: ['y']`. A ties B and B ties C, but A and C are never live in one view (`viewsTie` is false). `tieComponents` takes the transitive closure, so it reports a single conflict naming A, B and C, which says A and C collide when they never do. The same happens with phases (`phasesTie`) and with eligibility rules (`rulesCanHoldTogether`). The conflict should be reported pairwise, or as maximal cliques, and never through a third binding.
- evidence: read
- severity: low
- size: function
- cause: connected components used where the tie relation is not transitive
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
