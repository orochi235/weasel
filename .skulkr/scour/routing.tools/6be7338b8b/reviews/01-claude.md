# routing.tools — blind review findings

## A conflict is lost when another tie among different bindings uses the same spec objects
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:131 (addConflict)
- scenario: the conflict key is built from the gesture, the target, and each member's `identityKeyOf(e.spec)` and modifiers. It has no owner and no binding identity in it. Bindings often share one spec object, such as a module constant like `{ kind: 'key', key: 'Escape' }` or `STEP_KEYS`. Two components in one bucket that don't tie with each other then get the same key. For example, gated actions A and B can hold together in mode M1, C and D in mode M2, A/B and C/D are exclusive, and all four bind the same spec constant. `tieComponents` yields [A,B] and [C,D]. The second reaches `conflicts.get(key)`, only adds its platform, and returns, so C–D is never reported. Both should be reported.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/routing/reflection/conflicts.ts
- size: line
- cause: conflict key omits owner/binding identity
- confidence: likely

## `ToolsApi.hotkeyEngaged` can name another canvas's tool
- where: packages/routing/src/tools/useTools.ts:211 (useTools)
- scenario: `hotkeyEngaged = ctx.hotkeyStack.at(-1)` reads the whole hotkey stack. That stack can sit in a provider shared by several canvases (useTools' own unmount comment says so, and `toolOptionSteps`/`tuneToolOptions` filter it with `liveTool(slot, among)` for this reason). Holding Space on canvas 2's hand tool makes canvas 1's `tools.hotkeyEngaged` read canvas 2's tool id, which is not in canvas 1's `registry`. A palette that does `registry[hotkeyEngaged]` or highlights that id shows the wrong thing. It should be the newest held id that this registry holds, the same answer `liveTool(…, among)` gives. Two answers to one question.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/useTools.ts
- size: line
- cause: hotkey stack not filtered to own registry
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
