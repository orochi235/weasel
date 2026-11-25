# Audit round 87 — routing.tools (blind reviewer)

## Step actions and the options tuning answer "which tool is live" two ways
- where: packages/routing/src/tools/toolOptionSteps.ts:54 (enabledFor) vs packages/routing/src/tools/tuneToolOptions.ts:32 (live)
- scenario: `tuneToolOptions` picks the live tool with `liveTool(activeTool, ids)`, skipping held ids that are not among this canvas's tools. `enabledFor` calls `liveTool(deps.activeTool)` with no `among`, so any held id wins. `useTools` notes that the hotkey stack can sit in a provider above the canvas and be shared. So while an id this canvas's tools don't hold is on the stack (another canvas's hold), the tuning still feeds the active brush's options into its action, but `[` / `]` / Shift+wheel on that brush are disabled (NotApplicable). They should agree: both should pass the same `among` set, or neither should.
- evidence: read (shared-stack scenario inferred from the useTools comment)
- severity: low

## Whether a child's `toolOptionValues` beats the canvas's `values` prop depends on mount order
- where: packages/routing/src/tools/useToolOptionValues.ts:45 (useCanvasToolOptionValues), :17 (useToolOptionValues)
- scenario: the doc says a source a child publishes "registers later and wins". Dep sources stack by age (depNode.ts:38), and React runs child effects before parent effects. On first mount, the child's `useToolOptionValues` registers first and the canvas registers on top of it. The canvas source then returns `latest.current ?? below()`, so with `<SceneCanvas toolOptionValues={a}>` and a child publishing `b`, `a` wins. If that child remounts later (a keyed or conditional child), it lands on top and `b` wins. The same tree resolves the dep two ways depending on history, and the first-mount result contradicts the doc.
- evidence: inference from read code (effect order is React behavior, stacking per depNode.ts doc)
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

<!-- done: 2 findings, files read: 25 -->
