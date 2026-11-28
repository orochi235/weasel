# routing.tools findings

## describeShortcuts lists tool-declared bindings without the binding overrides in force, so a rebound tool key reads as its default
- where: packages/routing/src/tools/describeShortcuts.ts:131 (toolBindingsByAction), used at :146 (describeShortcuts)
- scenario: a tool binds `]` to its `brush.grow` step action (`toolOptionSteps` adds `{ id: 'brush.grow.key' }` to `Tool.bindings`). The host rebinds that binding with `bindingOverrides`. Dispatch applies the override: `assemble.ts:28` runs `overriddenBindings(entry.bindings, entry.id, overrides)`. But `describeShortcuts` merges the raw `tool.bindings` into each action's bindings, and `DescribeShortcutsOptions` takes no overrides. `ShortcutSheet.tsx:89` passes `tools.registry` as given. So the sheet shows `]` for Grow Brush where the key is now something else, and still lists a binding that was unbound. That contradicts the module doc: "a rebound key reads rebound and an unbound one is gone". Action `defaultBinding`s are right only because `registry.list()` has already applied the overrides to them.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides applied to action bindings but not to tool bindings
- confidence: sure

## The conflict checker groups bindings that tie only through a third binding into one conflict, naming pairs that never tie
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:157 (tieComponents), called at :107 (findConflictsKeyed)
- scenario: three bindings share a bucket. A has `opts.views: ['x']`, B has `['x','y']` and C has `['y']`. `viewsTie` holds for A–B and B–C but not for A–C. `tieComponents` takes the transitive closure, so it reports one conflict with `ownerIds` [A, B, C], and `reportRouteConflicts` says these "declare the same … tuple in the same scope, so declaration order alone decides". A and C are never live in the same view. Phases (`phasesTie`) and exclusive `eligible` rules (`rulesCanHoldTogether`) produce the same chains. The report should name only pairs (or cliques) that actually tie.
- evidence: read
- severity: low
- size: function
- cause: transitive closure used for a non-transitive tie relation
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
