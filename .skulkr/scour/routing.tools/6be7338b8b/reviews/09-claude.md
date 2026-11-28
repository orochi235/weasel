# routing.tools findings

## describeShortcuts lists a tool's bindings without binding overrides, so a rebound or unbound tool key shows its declared key
- where: packages/routing/src/tools/describeShortcuts.ts:130 (toolBindingsByAction)
- scenario: a brush tool with `options.size` gets the `brush.grow` binding with id `brush.grow.key` (`]`). A host sets `bindingOverrides: { 'brush.grow.key': null }` (or rebinds it to `=`). Dispatch routes tool bindings through `overriddenBindings(entry.bindings, entry.id, overrides)` (`contributions/assemble.ts:28`), so `]` no longer fires; but `describeShortcuts` reads `tool.bindings` raw and takes no overrides, so `ShortcutSheet` (which passes `ToolsApi.registry` as `tools`) still lists "Grow Brush ]". The module doc promises "a rebound key reads rebound and an unbound one is gone"; that holds for action bindings (already overridden by `registry.list()`) but not for tool-declared ones.
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/describeShortcuts.ts, packages/ui/src/components/ShortcutSheet/ShortcutSheet.tsx
- size: function
- cause: overrides applied to action bindings only, not to tool bindings
- confidence: sure

## A binding duplicated with `mod` is folded away and never reported, while the same duplicate spelled with `ctrl` is
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:186 (foldPlatformCopies)
- scenario: one owner declares `{ kind: 'key', key: 'z', mods: { mod: true } }` to `history.undo` twice with equal params (or a tool declares the same `mod` binding twice). Both entries are `platformBound` and `sameOutcome`, so the fold keeps one and the bucket drops to 1 member; `addConflict` returns early and nothing is flagged on either platform. The same pair written with `ctrl: true` is not platform-bound, survives the fold, ties on both platforms and is flagged. `findConflicts`' doc says "The same pair tying on both platforms is a plain duplicate and is flagged." The fold is meant only for a `mod` copy against a `ctrl`/`meta` copy of one binding, i.e. pairs whose platform-boundness differs.
- evidence: read
- severity: low
- size: line
- cause: fold condition `platformBound(k) || platformBound(e)` should require exactly one to be bound
- confidence: likely

## Tie components are closed transitively, so a conflict can name owners that never tie with each other
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:168 (tieComponents)
- scenario: three bindings on the same key and modifiers: A with `views: ['a']`, B with `views: ['a','b']`, C with `views: ['b']`. A–B tie (view a), B–C tie (view b), A–C never tie (`viewsTie` false). `tieComponents` puts all three in one component and one Conflict reports `ownerIds: [A, B, C]`, claiming A and C collide; the same happens with phases or `eligible` rules that keep A and C apart. Each reported conflict should list only bindings that tie in one state (pairs, or maximal cliques).
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

<!-- done: 3 findings, files read: 25 -->
