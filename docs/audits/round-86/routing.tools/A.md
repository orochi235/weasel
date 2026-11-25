## tuneToolOptions' `readBy` is never cleared, so a panel edit of a run no tool read writes into the last tool that did
- where: packages/routing/src/tools/tuneToolOptions.ts:35 (tuneToolOptions, `params` / `keep` tunings)
- scenario: draw a rect with the rect tool (insert's params read rect's options, `readBy.set('insert','rect')`), switch to the select tool, then run `insert` from a menu or palette command. Rect's `params` tuning returns `{}` because rect is not live, and no tuning updates `readBy`, so it still says `rect`. Changing `fill` in that run's last-operation panel calls `keep`, which sees `readBy.get('insert') === 'rect'` and writes the new fill into rect's tool options (or the shared `fill`). The panel was editing a run that never read rect's options, so nothing should be written back. A run where no tool was live should clear `readBy` for that action, for example by having the tuning whose tool is not live delete its own entry when `readBy` names it.
- evidence: read
- severity: medium

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

<!-- done: 1 findings, files read: 25 -->
