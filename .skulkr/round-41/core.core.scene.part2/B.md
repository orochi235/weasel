# Audit round 41 — core.core.scene.part2

## reconcileSpecs' reorder pass moves a child no spec names when a named child moves later
- where: packages/core/src/core/scene/reconcileSpecs.ts:121-124 (reorderToSpecs)
- scenario: `prev` specs list roots `[A, B, C]`; a gesture added `x` at root index 1, so `scene.roots` is
  `[A, x, B, C]`. `next` lists `[B, C, A]`. `slots` = `[0, 2, 3]`, `order` = `[B, C, A]`. `scene.reorder`
  (`kit:move`: detach, then attach at `toIndex`) gives `reorder(B,0)` → `[B, A, x, C]`, `reorder(C,2)` →
  `[B, A, C, x]`, `reorder(A,3)` → `[B, C, x, A]`. `x` ends at index 2. It should stay at index 1
  (`[B, x, C, A]`), as the doc comment promises ("a child no spec names keeps its place"). The claim "each
  move leaves every earlier slot as it should end" holds for earlier slots, but taking a named child out of
  a slot *before* the target shifts every unnamed child between the two one slot left. A slot computed from
  the original positions then lands on the wrong side of those children.
- evidence: read (traced against `treeEdits.ts:178-187` and `kitOps.ts:69-73,160-162`)
- severity: medium

## A pose hold's frame notifies once per newly held id, not once
- where: packages/core/src/core/scene/poseHold.ts:16-39 (publish); poseOverrides.ts:70-74 (set)
- scenario: `hold.set([[a, pa], [b, pb], [c, pc]])` as a drag preview's first frame, on a table from
  `createPoseOverrides` (which emits immediately). Each new id goes through `table.set`, and that calls
  `published()`, bumping the generation and emitting. Each release goes through `table.clear`, which does
  the same. `commit()` then emits once more. The first frame notifies 4 times and bumps the generation 4 times.
  `PoseHold.set`'s contract (poseOverrideTypes.ts:111-115) says "Subscribers are notified once". So a
  repaint subscriber or a `PoseFeed` reader re-reads a half-installed frame: after `a` is set but before `b`
  and `c` are. With the scene's table, outside an edit, `whenSettled` runs each emit at once too.
- evidence: read
- severity: low

## A removal reports a descendant the same change added
- where: packages/core/src/core/scene/poseRemovals.ts:42-58 (seeOff)
- scenario: in one `scene.batch`, add child `c` under existing group `g`, then remove `g`. In the
  `kit:remove` wrapper, `seeOff` builds `g`'s `RemovedNode` with `children: [c]` from `under`. The `done`
  callback then filters the added set (`pending` with `from === undefined`) against the roots only. `c` is
  added and removed by the same change, yet `onPoseWrite` reports it inside `g`'s removal. `ScenePoseReports.onPoseWrite`
  (poseWrites.ts:65-69) promises that a node "both added and removed by the change, is left out of both".
  A removal animation would fade out a node that was never on screen.
- evidence: read
- severity: low

## outsideGeneration is a sum, so removing a source can bring back a value a stale derivation recorded
- where: packages/core/src/core/scene/outsideReads.ts:17-20,42-46 (addOutsideSource, outsideGeneration)
- scenario: sources A (gen 3) and B (gen 5), sum 8. A path effect reads B while B's glyphs load and records
  `outside: 8` (derive.ts:84). A's owner calls the removal and B lands three times (gen 8). The sum is now 8
  again, so `current` (derive.ts:102) treats the stale result as fresh and the effect keeps the outlines it
  read mid-load. Each source "must only ever grow", but the sum only grows while no source is removed. A
  removed source's last generation would need to stay in an offset, or the sum would need to bump
  monotonically.
- evidence: read
- severity: low

## Files read
packages/core/src/core/scene/layoutPass.ts
packages/core/src/core/scene/layoutTypes.ts
packages/core/src/core/scene/lockGuard.ts
packages/core/src/core/scene/minSize.ts
packages/core/src/core/scene/nestedHit.ts
packages/core/src/core/scene/nodeAsShown.ts
packages/core/src/core/scene/nodeFlags.ts
packages/core/src/core/scene/nodeFnFields.ts
packages/core/src/core/scene/nodeFnTypes.ts
packages/core/src/core/scene/nodeGates.ts
packages/core/src/core/scene/nodeMemo.ts
packages/core/src/core/scene/nodeStore.ts
packages/core/src/core/scene/nodeTypes.ts
packages/core/src/core/scene/notifier.ts
packages/core/src/core/scene/opTable.ts
packages/core/src/core/scene/outerOps.ts
packages/core/src/core/scene/outputGrid.ts
packages/core/src/core/scene/outsideReads.ts
packages/core/src/core/scene/owned.ts
packages/core/src/core/scene/pathEffects/derive.ts
packages/core/src/core/scene/pathEffects/effects.ts
packages/core/src/core/scene/pathEffects/foundHidden.ts
packages/core/src/core/scene/pathEffects/index.ts
packages/core/src/core/scene/pathEffects/source.ts
packages/core/src/core/scene/pathEffects/textAlong.ts
packages/core/src/core/scene/pathEffects/textAlongBands.ts
packages/core/src/core/scene/pathEffects/tween.ts
packages/core/src/core/scene/plyStacks.ts
packages/core/src/core/scene/poseFeed.ts
packages/core/src/core/scene/poseHold.ts
packages/core/src/core/scene/poseOverrideTypes.ts
packages/core/src/core/scene/poseOverrides.ts
packages/core/src/core/scene/posePlies.ts
packages/core/src/core/scene/poseRemovals.ts
packages/core/src/core/scene/poseSnapshot.ts
packages/core/src/core/scene/poseWrites.ts
packages/core/src/core/scene/reconcileSpecs.ts
packages/core/src/core/scene/recorder.ts
packages/core/src/core/scene/registeredOp.ts

<!-- done: 4 findings, files read: 39 -->
