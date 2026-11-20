# Findings — routing.tools (audit round 55)

## The tools slot empties when the last-published canvas unmounts, though an earlier canvas is still mounted
- where: packages/routing/src/tools/toolsScope.tsx:16 (ToolsSlot.publish)
- scenario: two canvases share one `ToolsScope` (one `WeaselProvider`). A mounts and publishes, B mounts and publishes (owner B). B unmounts: its release sees `owner === B` and sets the slot to `null`. A is still mounted, but `useScopedTools()` now returns `null` and a palette beside A goes blank until A's `tools` object happens to change and its layout effect re-publishes. The slot keeps only one owner, not a stack of publishers, so it cannot fall back to the canvas still mounted.
- evidence: read
- severity: medium

## A tool held on its hotkey cannot step its own size/strength: the step actions are enabled only for the *active* tool, while the tunings treat the held tool as live
- where: packages/routing/src/tools/toolOptionSteps.ts:49 (enabledFor) vs packages/routing/src/tools/tuneToolOptions.ts:31 (live)
- scenario: tool A is active and tool B (with `options.size`) is held on its hotkey. Input routes to B, and `tuneToolOptions` tunes B's action from B's options because `live()` takes the newest held tool. B's `[`/`]`/Shift+wheel bindings are B's, so they route while B is held, but `enabledFor(B)` checks `activeTool.active === B`, which is false, so every step reads `NotApplicable` and does nothing. The reverse also holds: A's step actions stay enabled while B is held. The two files answer "which tool's options are live" two different ways; `enabledFor` should use the same newest-held-else-active rule.
- evidence: read
- severity: medium

## `has()` admits ambient-only ids that `setActive` rejects, so a mode whose `defaultTool` is an ambient tool throws from an effect
- where: packages/routing/src/tools/useTools.ts:238 (has) with packages/routing/src/tools/useModeDefaultTool.ts:32 (enter) and packages/routing/src/tools/useTools.ts:206 (setActive)
- scenario: `useTools({ registry: {select}, ambient: [laser], modes })` where a mode declares `defaultTool: 'laser'`. On entering that mode, `defaultToolOf(mode, has)` accepts `'laser'` because `has` also searches `slotted.ambient`, and `useModeDefaultTool` calls `setActive('laser')`. `setActive` only accepts registry ids and throws `setActive: "laser" not in registry` inside a `useEffect`, which takes the canvas down. The restore path (`toolsRef.current.has(restore)`) has the same gap. The mode-default target should be checked against the ids `setActive` takes (the registry), not against `has`.
- evidence: read
- severity: low

## A tool whose id is `shared` collides with the shared-options owner
- where: packages/routing/src/tools/toolOptions.ts:100 (toolOptionSlot), packages/routing/src/tools/toolOptionPrefs.ts:77 (toolOptionsPrefs)
- scenario: `validateId` doesn't reserve `'shared'`. Take a tool `defineTool({ id: 'shared', options: { prefs: { children: { size } } } })` alongside a tool that shares a `size` key. The first tool's own `size` is kept under owner `'shared'`, key `'size'`, which is the same slot as the shared key, so the two tools read and write one value. In `toolOptionsPrefs`, `children[SHARED_TOOL_OPTIONS] = …` overwrites the tool's own group. The shared owner needs a name no tool id can take (or `validateId` must reject it).
- evidence: read
- severity: low

## A tool or option id containing `.` never reads back from a prefs-backed `toolOptionValues`
- where: packages/routing/src/tools/toolOptionPrefs.ts:82 (pathOf) / :106 (prefsToolOptionValues.get)
- scenario: tool ids may contain dots (`validateId` allows them, and `'typetest.tool'` is used in the tree). For tool `a.b` with option `size`, `set` writes the dotted path `tools.a.b.size`, which a path-splitting prefs store nests as `tools → a → b → size`. `get('a.b')` does `getOwn(tree, 'a.b')` and finds nothing, so the value just written reads as unset and the tool always uses its default. `toolOptionsPrefs` also keys the tool's schema group `'a.b'`, which the dotted path doesn't address. A share key with a dot hits the same split.
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

Note: the checkout's HEAD is 830b463cc1, not the brief's bfc55709 (that object does not exist in this repo); `packages/routing` had no uncommitted changes, so these files were read at HEAD.

<!-- done: 5 findings, files read: 25 -->
