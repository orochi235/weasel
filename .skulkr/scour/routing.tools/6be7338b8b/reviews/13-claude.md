## `ToolsApi.hotkeyEngaged` can name another canvas's tool
- where: packages/routing/src/tools/useTools.ts:206 (useTools)
- scenario: two canvases share one active-tool owner node (a shared `WeaselProvider`), so they share one `hotkeyStack` (`activeToolContext.tsx:88`). Canvas B holds its `hand` on Space; canvas A's `useTools` returns `hotkeyEngaged: 'hand'` even though `hand` is not in A's registry, and A's palette shows a held tool it does not have. Every other reader of the stack filters it to its own tools (`liveTool(…, ids)` in `tuneToolOptions.ts:30`, `entriesById.get` in `useToolLifecycle.ts:36`, the `LIVE_TOOL_PARAM` comment in `toolOptionSteps.ts:53`). It should be the newest entry of the stack this registry holds.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/useTools.ts
- size: line
- cause: shared stack read unfiltered
- confidence: likely

## A conflict can name bindings that never tie with each other
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:153 (tieComponents)
- scenario: three bindings share a bucket key with `opts.views` `['a']`, `['a','b']` and `['b']`. `viewsTie` says A–B and B–C tie, A–C do not. `tieComponents` takes the transitive closure, so one `Conflict` lists A, B and C, and `formatConflict` says all three "declare the same tuple in the same scope". A and C are never live in one view, so that report is wrong. The same happens with phases (`phasesTie`) or `eligible` rules that tie pairwise but not across all three. The report should list only bindings that actually tie, for example a clique or one conflict per tying pair.
- evidence: read
- severity: low
- size: function
- cause: transitive closure of a non-transitive relation
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
