# routing.tools findings

## `ToolsApi.hotkeyEngaged` reports another canvas's held tool when the hotkey stack is shared
- where: packages/routing/src/tools/useTools.ts:225 (useTools)
- scenario: two canvases under one `WeaselProvider` share the active-tool context. A tool held on canvas B's key (`toolOffhand` pushes `'b.lasso'`) sits on the shared `hotkeyStack`, and canvas A's `useTools` returns `hotkeyEngaged: 'b.lasso'`, an id not in A's registry and not in `has()`. A palette that highlights `hotkeyEngaged`, or calls `registry[hotkeyEngaged]`, reads a tool A doesn't have. Should be the newest stack entry in this registry, as `liveTool(slot, among)` already answers for the step actions and `tuneToolOptions`.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/useTools.ts
- size: line
- cause: top of shared stack read unfiltered
- confidence: likely

## `describeShortcuts` merges an action group named `other` into the ungrouped "Other" group
- where: packages/routing/src/tools/describeShortcuts.ts:150 (describeShortcuts)
- scenario: an action with `group: 'other'` is keyed `'other'`, the same key ungrouped actions use (`action.group ?? OTHER`). Its rows merge with the ungrouped rows under the heading "Other" and move to the end, instead of getting a group of their own (`groupTitle('other')`) in first-registered order. The tool-set side forbids the id `other` and throws, but the command side merges silently, so the two places answer the same reserved-id question in two different ways.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/describeShortcuts.ts
- size: line
- cause: reserved group id shared with user group ids
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

<!-- done: 2 findings, files read: 25 -->
