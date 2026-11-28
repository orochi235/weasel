## Conflicts whose bindings share spec objects merge into one, dropping the second
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:146 (addConflict)
- scenario: The conflict key is built from the gesture, the target, and each member's `identityKeyOf(spec)` plus its modifiers. It leaves out owners and bindings. Take four ambient actions A, B, C and D that reuse one spec constant (`const DEL = { kind: 'key', key: 'Delete' }`). A and B are bound with `views: ['a']`, C and D with `views: ['b']`. All four land in one bucket, and `tieComponents` splits it into [A,B] and [C,D]. Both components get the same key, so the second one only adds a platform to the first and is never reported. Two separate conflicts should be reported. The built-in step keys (`STEP_KEYS`) are one spec object shared by every tool with options, so this pattern exists in the tree.
- evidence: read
- severity: low
- size: line
- cause: dedupe key built from spec identity, not binding identity
- confidence: likely

## Shadow pass misses hotkey-tier actions that outrank a tool at a different specificity or target
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:302 (findScopedConflicts, shadow loop)
- scenario: The shadow check reuses `findConflictsKeyed`, whose buckets include the specificity `rank`, the exact `targetKey`, and the required-modifier count. The dispatcher ranks tier before specificity. So a hotkey-tier action with an untargeted `click` takes every click from a tool's `click` on `empty`, and an action on bare `x` takes Shift+x from a tool whose binding has `mods: { shift: 'optional' }`. Neither case is reported as `shadows`, although the tool's binding fires only when the action declines. Only exact rank and target matches are reported.
- evidence: read
- severity: low
- size: function
- cause: within-scope tie keys reused for a cross-tier comparison
- confidence: likely

## ToolsApi.hotkeyEngaged reports a tool held for another canvas
- where: packages/routing/src/tools/useTools.ts:198 (useTools)
- scenario: Two canvases sit under one `WeaselProvider` and share the active-tool context. A tool held on a key for canvas B, an id not in canvas A's registry, sits on the shared `hotkeyStack`, and canvas A's `tools.hotkeyEngaged` returns that id. It should name only a tool in A's registry. `liveTool(…, among)` and `tuneToolOptions` already filter the stack by their own ids for this reason (toolOptionSteps.ts calls it "a hotkey stack shared with another canvas").
- evidence: read
- severity: low
- size: line
- cause: shared stack top read without filtering by this registry
- confidence: likely

## withoutTools gives an unlabeled set the heading "<Id> without"
- where: packages/routing/src/tools/toolSet.ts:77 (withoutTools)
- scenario: A set with no `label` is headed by its id, and `withoutTools` renames it `${id}-without`. Pass `withoutTools(SHAPE_TOOLS, 'line')` as `describeShortcuts`' `toolSets` (the form apps/draw passes as stacks) and the group heading becomes `groupTitle('shapes-without')`, which reads "Shapes without". It should still read as the set's own name. A label taken from the original id is missing.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/toolSet.ts
- size: line
- cause: suffixed id leaks into the label fallback
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

<!-- done: 4 findings, files read: 25 -->
