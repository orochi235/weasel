## describeShortcuts lists a tool's bindings as declared, ignoring bindingOverrides
- where: packages/routing/src/tools/describeShortcuts.ts:126 (toolBindingsByAction), :147 (describeShortcuts)
- scenario: a brush tool with `options.size` gets `[`/`]` bindings on `Tool.bindings` (ids `brush.grow.key`, …). The host rebinds `brush.grow.key` to `=` via `bindingOverrides`. The dispatcher assembles tool bindings through `overriddenBindings(entry.bindings, entry.id, overrides)` (contributions/assemble.ts:28), so `=` grows the brush and `]` does nothing. `ShortcutSheet` passes `tools.registry` raw to `describeShortcuts`, which reads `tool.bindings` directly and takes no overrides, so the sheet still lists `]` under "Grow brush". An unbound tool key likewise stays listed. Only the actions' own bindings, which `registry.list()` has already overridden, read correctly. ShortcutSheet's doc says a key "rebound or unbound by `bindingOverrides` reads that way", and that holds only for action bindings.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: tool bindings read without overrides applied
- confidence: sure

## findConflicts merges bindings into one conflict when they only tie through a third binding
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:110 (findConflictsKeyed / tieComponents)
- scenario: three bindings land in one bucket: A has `views: ['x','y']`, B has `views: ['y','z']`, C has `views: ['z']`. `tie` holds for A–B and B–C but not A–C, since A and C share no view. `tieComponents` returns the transitive component {A,B,C}, and that becomes one Conflict whose `ownerIds` names A, B and C. The report says A and C declare the same tuple in the same scope, but they never compete. The same thing happens with eligibility rules: A and C exclusive, B compatible with both. The output should be two pairwise conflicts, A–B and B–C, or cliques. Instead the over-report names a pair the doc comment says is "intentionally NOT flagged".
- evidence: read
- severity: low
- size: function
- cause: transitive closure used where tie is not transitive
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
