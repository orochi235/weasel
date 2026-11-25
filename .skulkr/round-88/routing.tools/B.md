# Audit round 88 — routing.tools (blind reviewer)

## returnToModeDefault can pick an ambient tool as the mode default and throw in setActive
- where: packages/routing/src/tools/returnToModeDefault.ts:13 (returnToModeDefault); packages/routing/src/tools/useTools.ts:257 (activatable vs has)
- scenario: the `modeDefaultTool` dep (core `canvas/deps/modeDefaultTool.ts`) resolves `defaultToolOf(mode, tools.has)`, and `ToolsApi.has` is true for ambient-only ids too. `useModeDefaultTool` answers the same question with `activatable` (registry only). A mode whose `defaultTool` names an ambient tool first (or only) → `modeDefaultToReturnTo` returns that id, `returnToModeDefault` calls `activeTool.setActive(ambientId)`, and `useTools.setActive` throws `setActive: "<id>" not in registry` from inside the mode's Escape/exit action. `useModeDefaultTool` meanwhile skips that candidate and activates a different tool, so the "mode default" is answered two ways. Should filter by activatable (registry) ids in both places.
- evidence: read
- severity: medium

## describeShortcuts never lists keys bound through a tool's own bindings (e.g. the `[` `]` option steps)
- where: packages/routing/src/tools/describeShortcuts.ts:131 (describeShortcuts); packages/routing/src/tools/toolOptionSteps.ts:157 (toolOptionSteps)
- scenario: `toolOptionSteps` binds `[`, `]`, `Shift+[`, `Shift+]` on `Tool.bindings`, not on the step actions' `defaultBinding`. `describeShortcuts` reads only `actionShortcuts(action, …)`, which walks `actionBindings(action)` = `defaultBinding`. So a brush tool's Grow/Shrink/Raise/Lower actions (group `tool`) are in `registry.list()` yet produce no row, and the sheet promising "every key live in an actions scope" omits them; same for any tool-declared key binding (polygon's sides keys).
- evidence: read
- severity: low

## A tool set with id `other` merges into the "Other tools" bucket and relabels it
- where: packages/routing/src/tools/describeShortcuts.ts:87 (describeTools)
- scenario: `toolSets: [toolSet('other', ['a'], { label: 'Misc' })]` plus an unset tool `b` → `take('other', 'Misc', …)` then `take(OTHER, 'Other tools', shown)` reuses the same map entry, so `b` is listed under the user's "Misc" heading as if it were a member of that set, and no "Other tools" group appears. Same for an action whose `group` is `'other'` in `commands` (merged with ungrouped and relabeled "Other").
- evidence: read
- severity: low

## Conflict checker misses a `code` spec colliding with a `key` spec for the same physical key
- where: packages/routing/src/tools/routing/reflection/conflictKeys.ts:71 (argKeysOf), :81 (chordArgsOf)
- scenario: tool A binds `{ kind: 'key', key: 'y', code: 'KeyZ' }`, tool B (same scope) binds `{ kind: 'key', key: 'z' }`, both unmodified. On a US layout pressing Z matches both (`code` matches A, `key` matches B) and `specificity` has no code term, so registration order decides. A buckets under `y` and `code:KeyZ`, B under `z` only; B's `code:KeyZ` arg is added solely in chord mode (`chordArgsOf` + `modifierTieKeys(…, true)`), so the unmodified tie is never reported.
- evidence: read
- severity: low

## One conflict can name bindings that do not tie with each other
- where: packages/routing/src/tools/routing/reflection/conflicts.ts:105 (findConflictsKeyed)
- scenario: a bucket holds A, B (views `['x']`) and C, D (views `['y']`); A–B tie and C–D tie but no cross pair does. The filter keeps every member that ties with *some* member, so one Conflict is reported with `ownerIds [A, B, C, D]`, claiming four bindings share a tuple where there are two separate two-way ties (and the dedupe key then differs from what either pair reports alone in another pass).
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

<!-- done: 5 findings, files read: 25 -->
