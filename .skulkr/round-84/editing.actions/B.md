# Audit round 84 — editing.actions

## Rotate records a repeatable rotation even when a behavior's own ops were what committed
- where: packages/editing/src/actions/rotate/action.ts:58 (rotateAction onEnd), with packages/editing/src/actions/rotate/commit.ts:38 (commitRotate)
- scenario: a rotate binding carries a behavior whose `onEnd` returns its own `Op[]` (e.g. a constraint that writes a different pose, or nothing to do with rotation). `commitRotate` commits those ops and returns true, and `onEnd` then records `{ kind: 'rotate', angle: frame.delta, pivot }`, so Transform Again (Cmd+D) replays a rotation the gesture never made. With `frame.delta === 0` it records angle 0, which turns Transform Again into NotApplicable (`rotateSelectionOps` returns [] at angle 0) and drops the previous record. The clone action answers this case the other way: a behavior's non-copy ops give `repeat: null` and `forgetTransform` (clone/action.ts:173, 268). Rotate should forget (or record only for its own `rotateOps` commit).
- evidence: read
- severity: medium

## Flip with `pivot: 'union'` on a lone path-effect node mirrors about its sources' union, not the box its chrome draws
- where: packages/editing/src/actions/flip/action.ts:104 (flipOps)
- scenario: select one node whose pose derives from named nodes (a path effect, `derivedBoxOwner` non-null) and flip with `params.pivot: 'union'`. `sharedPivot` is the union of the *sources'* drawn boxes, overriding the `ownPivot` the loop above set from the selected node's own box. For a single selected item, 'union' and 'each' should agree; 'each' mirrors about the derived node's box, 'union' about a different box, so the result is shifted. Rotate handles this exact case through `derivedBoxOwner` (rotate/session.ts:176); flip does not.
- evidence: read (inference about effect from code paths; not run)
- severity: low

## `useDistribute` documents that both extremes stay put, but `'gaps'` mode moves the box with the max extent
- where: packages/editing/src/actions/distribute/distribute.ts:55 (useDistribute doc) vs packages/editing/src/actions/distribute/plan.ts:47 (planDistribute)
- scenario: boxes A x∈[0,10], B x∈[5,100], C x∈[50,60], mode 'gaps'. The plan sorts by min and spans first.min→last-by-min.max (0→60), so gap = (60−115)/2 = −27.5 and B is moved to [−17.5, 77.5]. The selection's max edge (100, owned by B) moves, contrary to the hook's "Endpoints (min and max along the axis) stay put"; `DistributeMode`'s "Endpoints stay put in both modes" is also false here. Either the span should run to the greatest max, or the docs should say "the boxes that start first and last".
- evidence: read (worked by hand)
- severity: low

## Clone's consumer `applyOps` path always reports a commit
- where: packages/editing/src/actions/clone/action.ts:153 (commitClone `apply`)
- scenario: with an `applyOps` dep, `apply` returns true unconditionally, so a batch the consumer's history or a container refuses still counts as committed: `recordTransform` records a duplicate offset for copies that do not exist, and behaviors get `onSettled(committed = true)`. The scene path returns `applyBatch`'s answer. Same question answered two ways depending on which commit path is wired.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/align/action.tsx
packages/editing/src/actions/align/align.ts
packages/editing/src/actions/align/index.ts
packages/editing/src/actions/clipboard/action.ts
packages/editing/src/actions/clone/action.ts
packages/editing/src/actions/clone/behaviors.ts
packages/editing/src/actions/delete/delete.ts
packages/editing/src/actions/derivedBox.ts
packages/editing/src/actions/distribute/action.tsx
packages/editing/src/actions/distribute/distribute.ts
packages/editing/src/actions/distribute/index.ts
packages/editing/src/actions/distribute/plan.ts
packages/editing/src/actions/flip/action.ts
packages/editing/src/actions/flip/helpers.ts
packages/editing/src/actions/group/enterGroup.ts
packages/editing/src/actions/lassoSelect/action.ts
packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts
packages/editing/src/actions/lassoSelect/index.ts
packages/editing/src/actions/lassoSelect/options.ts
packages/editing/src/actions/lockedWrites.ts
packages/editing/src/actions/pathfinder/action.tsx
packages/editing/src/actions/pathfinder/booleanGroupAction.ts
packages/editing/src/actions/pathfinder/keymap.ts
packages/editing/src/actions/reorder/reorder.ts
packages/editing/src/actions/rotate/action.ts
packages/editing/src/actions/rotate/commit.ts
packages/editing/src/actions/rotate/frame.ts
packages/editing/src/actions/rotate/replay.ts
packages/editing/src/actions/rotate/session.ts
packages/editing/src/actions/select/areaSelect.ts
packages/editing/src/actions/select/clearSelection.ts
packages/editing/src/actions/swap/action.ts
packages/editing/src/actions/swap/swapOps.ts
packages/editing/src/actions/transformAgain/action.ts
packages/editing/src/actions/transformAgain/transformSelection.ts

<!-- done: 4 findings, files read: 35 -->
