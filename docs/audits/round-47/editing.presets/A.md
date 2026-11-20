I couldn't write `.skulk/out/findings.md` because permission to write it was denied, so the whole document is below.

# Audit round 47: editing.presets

Note: this checkout's HEAD is 782733b19c54308edbc779a6bdfcae2ca398cf65, not the brief's 44e73a9…. Line numbers below are against HEAD.

## A double-click can enter a different group than the one the press selected, because `selectPreset`'s group entry ignores `selectTool.pickBest`
- where: packages/editing/src/presets/select.ts:18 (`selectPreset.build` → `createGroupEntryContribution` `pickHit`)
- scenario: a canvas passes `<SceneCanvas selectTool={{ pickBest }}>`, the documented override for alt-cycling or a custom body pick.
  - The select tool built in `selectToolsOfferedPreset` (tools.ts:27-31) forwards that `pickBest`. A press therefore selects whatever it returns, for example a lower node X inside group A.
  - The `group.enter` contribution here gets `pickHit: ctx.pick.bestIn` instead. That resolves to `wiredPickBest`, which is `topmostOf(pickEvery)` and never consults `pickBest` (core `useScenePickers.ts:236-246`).
  - So a double-click at that point enters the group holding the default topmost node Y (group B). If Y is a bare leaf, it enters nothing.
  - This breaks the contract in `groupEntry.ts:16`: "a double-click on a body enters the group a press there would select."
  - Expected: the entry picks with the same picker as the select tool. That means `ctx.selectTool().pickBest`, read live, when it is given, and `pick.bestIn` otherwise.
- evidence: read
- severity: medium

## Files read
packages/editing/src/presets/arrange.ts
packages/editing/src/presets/booleans.ts
packages/editing/src/presets/composites.ts
packages/editing/src/presets/edit.ts
packages/editing/src/presets/ingest.ts
packages/editing/src/presets/insert.ts
packages/editing/src/presets/pathfinder.ts
packages/editing/src/presets/select.ts
packages/editing/src/presets/selection.ts
packages/editing/src/presets/selectionChrome.ts
packages/editing/src/presets/tools.ts
packages/editing/src/presets/transform.ts

<!-- done: 1 findings, files read: 12 -->