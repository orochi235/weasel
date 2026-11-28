# Findings: editing.actions.move

## snapToContainer reparents into a container on a higher layer without moving the node onto it, so the scene throws
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:178 (plantOps, `reparent`)
- scenario: the node is on layer `content` and `findTarget` answers a container on a layer above it (say `structures`). The release commits `coreOps.reparent` straight into that container. `Scene.move` rejects any move that drops a node below its new parent's layer (packages/core/src/core/scene/types.ts:205), so the whole commit throws. The move commit's own `landOps` (commit/reparent.ts:130) handles this case by detaching the node, running `setLayer`, then reparenting; plantOps never does. The clone path (`end.copyOps`) may have the same gap.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/behaviors/snapToContainer.ts, packages/editing/src/actions/move/commit/reparent.ts
- size: function
- cause: layer change missing on reparent; two pathways for "land a node in a container"
- confidence: likely

## A layout drop's or slot snap's reparented root moves its riders by a delta measured across two different frames
- where: packages/editing/src/actions/move/landedDescendants.ts:28 (landedDescendantOps)
- scenario: drag an envelope group (one that doesn't define a frame) out of container A and into layout container B, where B is rotated or scaled relative to A. `layoutDropOps` (commit/layoutDrop.ts) writes only the root's reparent and its `commitDrop` pose, and writes no ops for the group's children. `landedDescendantOps` then takes `from` from `startPoses` (stored under A) and `to` from the op (stored under B), subtracts the two boxes, and adds the difference to each child's stored pose. That only cancels out when both frames are pure translations. Under a rotated or scaled B, the children land away from the group. `reparentOps` and `pageDropOps` avoid this by writing riders through `landedCascadeOps`. snapToContainer's slotted roots (plantOps' `slots` loop) take the same broken path; only its unslotted ones get `keptInPlace`.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/commit/layoutDrop.ts, packages/editing/src/actions/move/behaviors/snapToContainer.ts
- size: function
- cause: riders of a cross-frame landing left to a same-frame delta pass
- confidence: likely

## The move's `refresh` stays wired after the gesture ends, so a dwell timer that outlives onEnd repaints a closed drag
- where: packages/editing/src/actions/move/action.ts:57 (start, `session.gestureCtx.refresh`)
- scenario: the timers from snapToContainer and swapOnDrop are cleared only in their own `onEnd` or `onCancel`. In onEnd's commit branch, `show(endCtx)` (nextFrame / behavior onMove) and `endBehaviors`' `draggedStoredPose` loop both run before `reduceBehaviorEnd`. If either throws, no behavior gets `onEnd` or `onCancel`. The `finally` block then runs `closeRun`, but the pending `after` still fires later, calls `ctx.refresh`, and so runs `show(lastMove)` → `hold.set(preview.poses())` on a hold that was already dropped, leaving the old drag's preview overrides on the scene. The fix is to clear `refresh` in the `finally` block, and to cancel the behaviors whenever the commit throws before they ran.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/action.ts
- size: line
- cause: refresh closure not torn down on close
- confidence: likely

## Files read
packages/editing/src/actions/move/action.ts
packages/editing/src/actions/move/behaviors/clampMove.ts
packages/editing/src/actions/move/behaviors/index.ts
packages/editing/src/actions/move/behaviors/layoutDrop.ts
packages/editing/src/actions/move/behaviors/pageDrop.ts
packages/editing/src/actions/move/behaviors/reparentOnDrop.ts
packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts
packages/editing/src/actions/move/behaviors/snapToContainer.ts
packages/editing/src/actions/move/behaviors/swapOnDrop.ts
packages/editing/src/actions/move/capture.ts
packages/editing/src/actions/move/commit/index.ts
packages/editing/src/actions/move/commit/layoutDrop.ts
packages/editing/src/actions/move/commit/layoutRelease.ts
packages/editing/src/actions/move/commit/pageDrop.ts
packages/editing/src/actions/move/commit/rebase.ts
packages/editing/src/actions/move/commit/reparent.ts
packages/editing/src/actions/move/delta.ts
packages/editing/src/actions/move/dragSnap.ts
packages/editing/src/actions/move/frame.ts
packages/editing/src/actions/move/gestureAdapter.ts
packages/editing/src/actions/move/index.ts
packages/editing/src/actions/move/landedDescendants.ts
packages/editing/src/actions/move/layout/container.ts
packages/editing/src/actions/move/layout/dragged.ts
packages/editing/src/actions/move/layout/dropPass.ts
packages/editing/src/actions/move/layout/exits.ts
packages/editing/src/actions/move/layout/glide.ts
packages/editing/src/actions/move/layout/types.ts
packages/editing/src/actions/move/layout/view.ts
packages/editing/src/actions/move/refusal.ts
packages/editing/src/actions/move/session.ts
packages/editing/src/actions/move/sessionOf.ts
packages/editing/src/actions/move/translate.ts

<!-- done: 3 findings, files read: 33 -->
