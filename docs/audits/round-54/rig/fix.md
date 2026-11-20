Removing a joint unbinds node bindings (A+B): fixed 5a7e348408. `bone.remove` cleaned up skins but left `data.joint` naming the removed joints. It now clears those in the same undo entry, so the next bone drawn under a reused name doesn't take those nodes over. I cleared the binding rather than rebinding the node to the parent joint; that matches how skins drop a removed joint's weights.

Weight brush leaves gaps on a fast drag (A+B): fixed 0ea2fa4674. `brushWeights` (animator) takes an optional `from` point and weighs each point by its distance to the segment from there. `weight.paint` passes the previous pointer sample, so the swath is continuous. This carries two changesets: a rig patch fix and an animator minor api.

Overlays don't repaint when an outside `selection` or `rig` thunk changes (B): fixed 4a6734f980. `useRigTools`, `useBoneTool` and `useWeightTool` take a `subscribe` option, and it reaches every overlay layer. This adds API, so its changeset is minor api.

Extra: `@weasel-js/rig` and `@weasel-js/animator` have no `lint` script, so `npm run lint -w` can't run for either. I didn't file this.

Checks:
- `npx vitest run --maxWorkers=1` on each file:
  - `packages/rig/src/bone/useBoneTool.test.tsx`: pass (9)
  - `packages/rig/src/weight/useWeightTool.test.tsx`: pass (13)
  - `packages/rig/src/useRigTools.test.tsx`: pass (11)
  - `packages/animator/src/rig/weightEdits.test.ts`: pass (12)
  - `packages/animator/src/exports.test.ts`: pass (3)
  - `packages/rig/src/weight/weightTool.live.test.tsx`: pass (2)
  - `packages/rig/src/rigTools.canvas.test.tsx`: pass (4)
- Each new test failed with its fix reverted, and passes with it.
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run check:changesets`: "[changesets] OK — 2593 changeset(s)."
- `npm run lint -w @weasel-js/rig` and `-w @weasel-js/animator`: fail, missing script. As a stand-in, `npx eslint` on every changed .ts/.tsx file passed.
- No `*.browser.test.*` files were touched. The tree is clean apart from `.skulk/`.

tally: 5 of 5 fixed, 0 extra fixed