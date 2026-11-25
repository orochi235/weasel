# Audit round 85 — routing.tools

## Predicate targets bucket by the `{ kindOf }` wrapper's identity, not the predicate function's, so two bindings sharing one function go unflagged
- where: packages/routing/src/tools/routing/reflection/conflictKeys.ts:111 (targetKey)
- scenario: two bindings each write `target: { kindOf: isBody }` as separate object literals over the same `isBody`. `targetKey` keys on `identityKeyOf(spec.target)`, which is the wrapper object, so they get different bucket keys and no conflict is reported. `findConflicts`' doc says two predicate targets are skipped "unless they are the same function", so these should be flagged. The key should be `identityKeyOf(pred.kindOf)`.
- evidence: read (TargetSpec is `{ kindOf: TargetPredicate }`, packages/gestures/src/ui/spec.ts:78)
- severity: medium

## `disengageHotkey` with no holds of its own pops whatever tops the stack, including a tool held on its key
- where: packages/routing/src/tools/useTools.ts:229 (disengageHotkey)
- scenario: the user holds Space, so `hand` is pushed by `tool.offhand`. A UI then calls `tools.disengageHotkey()` without having called `engageHotkey`. `own` is undefined, `ctx.popHotkey(undefined)` pops the top (see activeToolContext.test.tsx:59), and `hand` disengages while Space is still down. The `ToolsApi` doc says "A tool held on its key is left held". The comment above `holdsRef` says the same.
- evidence: read
- severity: medium

## Holds made through `engageHotkey` survive the unmount of the `useTools` that made them
- where: packages/routing/src/tools/useTools.ts:217 (engageHotkey / holdsRef)
- scenario: the active-tool context lives in a `WeaselProvider` above the canvas. A component calls `engageHotkey('eyedropper')`, and the canvas unmounts before `disengageHotkey` runs. Nothing pops `holdsRef`'s entries on unmount, so `eyedropper` stays on the shared `hotkeyStack` and a remounted canvas starts with it engaged.
- evidence: read
- severity: low

## Re-publishing on every `ToolsApi` change moves an older canvas to newest, so it takes the scoped slot
- where: packages/routing/src/tools/toolsScope.tsx:19 (ToolsSlot.publish) / :58 (usePublishTools)
- scenario: canvases A then B mount under one `ToolsScope`, so the slot shows B. The user switches tools on A, which makes a new `ToolsApi`. The layout effect's cleanup drops A and `publish` pushes it to the end, so `useScopedTools` now returns A although B joined last. The slot's doc ties it to the canvas that joined last, the way the actions registry works. Updating should replace the entry in place.
- evidence: read
- severity: medium

## A tool redefined under the same id while live never gets `onActivate`, and the old definition never gets `onDeactivate`
- where: packages/routing/src/tools/useToolLifecycle.ts:36 (useToolLifecycle effect)
- scenario: a tool hook rebuilds its `Tool` (new closures) while it holds the active slot. `prev` and `next` are compared by id only, so neither the old object's `onDeactivate` nor the new one's `onActivate` fires. On a later switch or unmount the new object's `onDeactivate` runs, even though its `onActivate` never did. State the old `onActivate` set up is never torn down.
- evidence: read
- severity: low

## `toolGaps` reports "no cursor" for a tool that carries `Tool.cursor` but no `def.cursor`
- where: packages/routing/src/tools/toolGaps.ts:20 (toolGaps)
- scenario: a `Tool` assembled without `defineTool` (which `useTools` accepts) sets `cursor: 'crosshair'`. `def` is `{}`, so `def.cursor == null` holds and "no cursor" is listed although the tool has one. The check should also read `tool.cursor`.
- evidence: read
- severity: low

## A `times` step on a size option at 0, with no `step` on the leaf, never moves
- where: packages/routing/src/tools/toolOptions.ts:199 (steppedOption)
- scenario: a size leaf `{ kind: 'number', min: 0, default: 0 }` has `size: { option, times: 1.25 }`. Pressing `]` computes `0 * 1.25 = 0`. The "still moves one step" repair only applies when `leaf.step` is set, so the value stays at 0 for every press and grow does nothing.
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

<!-- done: 7 findings, files read: 25 -->
