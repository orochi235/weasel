# Findings: routing.tools

## `liveTool` ignores the active mode, so tool options and step keys follow a held tool that routing has skipped
- where: packages/routing/src/tools/toolOptions.ts:115 (liveTool)
- scenario: brush is active and has size options. The user holds a tool's key (the `tool.offhand` start pushes it onto the hotkey stack with no mode check, `interactions/actions/toolOffhand.ts:86`) while the active mode bars that held tool. `routedTool` in `useContributions` skips held tools the mode bars, so input routes to brush and brush's `]` binding is reached. But `brush.grow`'s `enabled` (`liveFrom` → `LIVE_TOOL_PARAM` from `tuneToolOptions`' `live()` → `liveTool`) reads the held tool, so it returns NotApplicable and `]` does nothing. `tuneToolOptions`' `active()` is false for brush too, so brush strokes drawn during the hold use its option defaults instead of the user's values. Expected: the live tool should be the routed one (`ToolsApi.routed`), as liveTool's own doc claims ("Routing walks held tools the same way").
- evidence: read
- severity: medium
- fix: packages/routing/src/tools/toolOptions.ts, packages/routing/src/tools/tuneToolOptions.ts, packages/routing/src/tools/toolOptionSteps.ts
- size: function
- cause: one decision, "which held tool is live", answered in two places (one checks eligibility, one does not)
- confidence: likely

## `foldPlatformCopies` merges two identical `mod` bindings of one action, so a plain duplicate goes unreported
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:208 (foldPlatformCopies)
- scenario: an action declares `{ kind: 'key', key: 'z', mods: { mod: true } }` twice with equal params (two default bindings, or an override that re-adds one). Both copies are `platformBound`, so the fold condition `platformBound(k) || platformBound(e)` folds them into one. The bucket drops to one entry and `addConflict` returns early on both platforms, so nothing is reported. The same duplicate spelled with `ctrl: true` is not platform-bound, is not folded, ties on both platforms and is flagged. `findConflicts`' doc says "the same pair tying on both platforms is a plain duplicate and is flagged". Expected: fold only a `mod`-against-`ctrl`/`meta` pair, i.e. when exactly one of the two is platform-bound (`platformBound(k) !== platformBound(e)`).
- evidence: read
- severity: low
- size: line
- cause: fold condition uses `||` where it needs exactly one platform-bound copy
- confidence: likely

## `toolOptionsPrefs` throws a misleading "would share one place" error when one tool is listed twice
- where: packages/routing/src/tools/toolOptionPrefs.ts:101 (placeToolGroup)
- scenario: a host builds the schema from every tool it mounts, e.g. `toolOptionsPrefs([...Object.values(registry), ...ambient])`. `useTools` explicitly allows the same tool object in both `registry` and `ambient`. On the second visit the tool's group already holds its own option keys, so the check fires: `tool "brush"'s option "size" and the tool "brush.size" would share one place`. The tool is the same object and nothing collides. Expected: a tool seen again under the same id is skipped (or merged idempotently), and the throw is kept for a real option/tool-id collision.
- evidence: read
- severity: low
- fix: packages/routing/src/tools/toolOptionPrefs.ts (toolOptionsPrefs)
- size: line
- cause: no dedupe of tools by id before placing groups
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
