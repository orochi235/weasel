# Audit round 83 — editing.actions.move — blind reviewer findings

## snapToContainer freezes the primary node's slot at the pointer where it entered the container, while every other dragged node's slot follows the pointer
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:117 (track), :135-140 (dwell timer), :67-75 (slotsFor)
- scenario: `findTarget(id, worldX, worldY)` takes the pointer, so a container with several slots (a grid, a list) answers a different `slotPose` as the pointer moves inside it. With a dwell, the timer closure captures `target` from the first frame over the container (later frames hit `pendingTargetId === target.parentId` and return without updating it), and once committed, `track` returns `snapped(ctx, s.committedSnap)` with that stale target for every later frame. With `isInstant`, `committedSnap` is likewise set on the first frame and never refreshed. So the preview and the commit put the primary node in the slot under the entry point, not the slot under the pointer at release. Meanwhile `slotsFor` asks `findTarget` again for every other root at the current pointer, so in one drop the primary uses the entry pointer and the others use the release pointer. The same question gets two answers, and two nodes can be given the same slot. Expected: the committed container stays committed, but its slot is re-read at the current pointer, as the other roots' slots are.
- evidence: read
- severity: medium

## snapBackOrDelete measures the release distance on `draggedIds[0]` even when that id is carried by another dragged node, so it always snaps back
- where: packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts:66-72 (onEnd)
- scenario: the selection is [child, group], where `child` was selected first and `group` defines a frame. `moveSources` keeps the selection order and does not drop nested ids, so `draggedIds[0]` is `child`, which `captureFrames` marks `carried`. `draggedStoredPose` (commit/index.ts endBehaviors) returns its start pose unchanged, so `ctx.current.get(child) === ctx.origin.get(child)`, the distance is 0, and the release counts as "within radius" however far the group was dragged. `onFreeRelease: 'delete'` never deletes. The distance should come from an outermost dragged node, as snapToContainer's `rootsOf` does, or from world poses. Related: the distance compares stored-frame poses, so under a scaled parent frame `radius` is measured in that frame's units, not world units.
- evidence: read
- severity: medium

## A layout container (or source container) whose world pose is singular throws on every move
- where: packages/editing/src/actions/move/layout/view.ts:27-35 (containerView), used by layout/container.ts:118-119, layout/dropPass.ts:141-142, commit/layoutRelease.ts:41-42
- scenario: `strategyView` returns `null` when `decompose(pose, pose)` fails, which happens for a container scaled to 0. `containerView` hides that with `!`, and the next `contentBoxOf` → `view.toStrategy(...)` throws a TypeError. Two ways in: dragging a child out of a collapsed layout container (`sourceReflow` runs on every frame), or a container whose `contains`/`dropRegion` claims the point. Then `layoutDrop.onMove` throws on every frame, and on release so does `layoutReleaseOps`. Elsewhere a singular frame is handled by refusing the drop (`null`), and these paths should do the same: skip the candidate, or refuse.
- evidence: read
- severity: low

## The release is resolved partly at the release point and partly at the last move's point
- where: packages/editing/src/actions/move/action.ts:83-87 (onEnd), commit/index.ts:17-31 (endBehaviors), behaviors/layoutDrop.ts:41-45/68-76, behaviors/snapToContainer.ts:70-71
- scenario: an end whose `endCtx.world` differs from the last `onMove` (a pointerup reported at a newer point than the last coalesced move). `commitMove` passes `at = endCtx.world` to the drops that read `end.pointer` (reparentOnDrop, pageDrop). Everything else stays at the last move: the delta (`frame.delta`), `gestureCtx.pointer` (never refreshed in endBehaviors), the layout drop's container, placements and `dropCenter`, and snapToContainer's `slotsFor`. So reparent-on-drop can pick a parent under a point the dragged box was never shown at, and in one release the layout and page/reparent behaviors judge different points. Either run a final frame at the end point, or hand every behavior the last move's point.
- evidence: read
- severity: low

## snapToContainer's commit writes a caught-mid-glide node's undo `from` as its shown pose, not its document pose
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:187 (plantOps)
- scenario: a layout scene with a reflow transition, and a binding behavior `snapToContainer`. The user grabs a node still gliding from an earlier reflow. `captureStartPoses` stores its shown (held) pose in `startPoses`, which becomes `ctx.origin`. `plantOps` emits `setPose({ from: ctx.origin.get(id)!, ... })`, so undo restores the node to the mid-glide pose rather than the document pose it held before the drag. `keptInPlace` in the same file, and the translate/reparent commits, take `from` from the document (`adapter.getPose` / `node.pose`).
- evidence: read
- severity: low

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

<!-- done: 5 findings, files read: 33 -->
