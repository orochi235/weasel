# routing.tools — blind review findings

## `liveTool` picks a held tool the active mode bars, so tool options and step keys follow a tool input does not route to
- where: packages/routing/src/tools/toolOptions.ts:116 (liveTool)
- scenario: brush is active, and a tool `eraser` with options is held on its key (`tool.offhand` pushes it onto the hotkey stack with no mode check, `toolOffhand.ts:86`) while the active mode's capabilities bar it. `useContributions`' `routedTool` skips the barred hold and routes input to brush. But `liveTool` returns `eraser`: `tuneToolOptions` tunes brush's action with nothing (its `active()` is false) and the panel shows eraser's options, and `[` / `]` run `enabledFor('brush')`, which declines because `liveFrom` says `eraser`. So while the hold lasts, the brush's options no longer reach its strokes and its size keys do nothing. Both should use the same rule: the newest hold the mode allows, else the active tool if allowed (`ToolsApi.routed`).
- evidence: read (toolOptions.ts liveTool, tuneToolOptions.ts live(), toolOptionSteps.ts liveFrom/enabledFor, useContributions.ts routedTool, toolOffhand.ts start)
- severity: medium
- fix: packages/routing/src/tools/toolOptions.ts, packages/routing/src/tools/tuneToolOptions.ts, packages/routing/src/tools/toolOptionSteps.ts, packages/routing/src/contributions/useContributions.ts
- size: design
- cause: two definitions of "the live tool", one ignoring mode eligibility
- confidence: likely

## `useToolOptionParams` hands `values.subscribe` to `useSyncExternalStore` unbound
- where: packages/routing/src/tools/useToolOptionValues.ts:33 (useToolOptionParams)
- scenario: a host implements `ToolOptionValues` as a class whose `subscribe` reads `this` (e.g. `this.listeners.add(l)`). That is valid against the public interface, but `useSyncExternalStore(values.subscribe, …)` calls it with `this` undefined, so the options row throws on mount. Every other call site goes through `values.get(...)` / `values.set(...)` as methods, so only this path breaks. Should pass `(l) => values.subscribe(l)`, memoized on `values`.
- evidence: read
- severity: low
- size: line
- cause: method extracted from interface object
- confidence: likely

## A conflict's `ownerIds` can name two bindings that never tie with each other
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:94 (findConflictsKeyed / tieComponents)
- scenario: three tools bind the same key: A with `views: ['x']`, B with `views: ['x','y']`, C with `views: ['y']`. A–B tie in view x and B–C tie in view y, but A and C are never live together (`viewsTie` is false). `tieComponents` takes the transitive closure, so one conflict reports `declared by A, B, C`, and `reportRouteConflicts` warns that "two bindings declare the same … tuple in the same scope". A host told A and C collide may change one of them for nothing. The same happens with `phasesTie` or exclusive `eligible` rules. Reporting the pairs (or maximal cliques) that really tie would be accurate.
- evidence: read
- severity: low
- size: function
- cause: transitive closure over a non-transitive tie relation
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

<!-- done: 3 findings, files read: 25 -->
