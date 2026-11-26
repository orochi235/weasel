## Tool options treat a held tool the active mode disallows as live, while routing skips it
- where: packages/routing/src/tools/toolOptions.ts:110 (liveTool); used by packages/routing/src/tools/tuneToolOptions.ts:29 and packages/routing/src/tools/toolOptionSteps.ts:57 (liveFrom)
- scenario: a tool with options (a brush) is the active tool, and a second tool with options is held on its hotkey in a mode whose eligibility rules leave that held tool not live. `routedTool` (contributions/useContributions.ts:147) routes input to the active brush, since it takes a held entry only when `liveScope(...) === 'hotkey'`. `liveTool` walks the hotkey stack with no mode check and picks the held tool, so `tuneToolOptions` stops tuning the brush's action with the brush's options (`active()` is false for it), the options panel's `form` shows the held tool's prefs, and `[` / `]` step the held tool's size (`enabledFor` passes only for the held tool) while the strokes come from the brush. `liveTool`'s doc says "Routing walks held tools the same way", but routing also filters by mode: one decision, answered two ways. Should follow `ToolsApi.routed`.
- evidence: read
- severity: medium

## A wheel reversal is not seen as a new burst when the burst's leftover travel is exactly 0
- where: packages/routing/src/tools/toolOptionSteps.ts:114 (wheelSizeAction run)
- scenario: the condition `burst.travel !== 0 && Math.sign(burst.travel) !== Math.sign(d)` only spots a reversal while travel is non-zero. After a fresh event (which sets travel to 0), or after travel comes down to exactly a multiple of WHEEL_SIZE_STEP_PX, a trackpad turned the other way within 150 ms is treated as part of the same burst. It has to build up 60 px in the new direction before it steps, instead of stepping on its first event the way the code means a reversal to. Example: Shift+scroll up with deltas that hit exactly 60 (a size step, travel back to 0), then reverse with deltas of 10: six events go by with no step.
- evidence: read
- severity: low

## ToolsScope remounts its whole subtree when `isolate` changes or an outer scope appears or disappears
- where: packages/routing/src/tools/toolsScope.tsx:52 (ToolsScope)
- scenario: the component returns `<>{children}</>` when an outer slot is in scope and `isolate` is false, and returns `<ToolsSlotContext.Provider>` otherwise. When `isolate` flips, or an outer `ToolsScope` is added above it, the element type at that position changes and React unmounts and remounts `children`. Every canvas below loses its state (scene, tools, undo) and runs its unmount teardown. Always rendering the Provider, with `value={outer && !isolate ? outer : own}`, keeps the tree stable.
- evidence: read
- severity: low

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
