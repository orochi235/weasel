# editing.actions.move — blind review findings

## A behavior throwing in the release frame leaves dwell timers armed, and they repaint the drag after it closed
- where: packages/editing/src/actions/move/action.ts:80 (moveAction invoker `onEnd`)
- scenario: a drag with `swapOnDrop: 'dwell'` (or a binding's `snapToContainer`) is released at a point other than the last move's, so `onEnd` runs `show(endCtx)`; a behavior's `onMove` throws during that frame (layoutDrop's own comment anticipates throwing moves). The exception skips both `commitMove` (whose `reduceBehaviorEnd` is what calls swap's `disarm`/snap's `released`) and `runBehaviorCancel`; the `finally` only runs `closeRun`. The pending `after(dwellMs, …)` timer survives, fires, and calls `ctx.refresh` — which `start` never detaches — so `show(lastMove)` runs `hold.set(preview.poses())` on the dropped hold, reinstalling the drag's preview overrides after the gesture ended (the hold reinstalls on `set` after `drop`, per `poseHold.test.ts`). Should: run the behaviors' cancel when the commit path throws before `onEnd` reaches them, and null `gestureCtx.refresh` in the `finally`.
- evidence: read (action.ts, runLifecycle.ts `reduceBehaviorEnd`/`closeRun`, poseHold.test.ts)
- severity: low
- fix: packages/editing/src/actions/move/action.ts
- size: function
- cause: release-frame throw bypasses both end and cancel; refresh never detached
- confidence: likely

## A cross-layer layout drop records the dragged node's undo pose in the destination's plane
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:27 (layoutDropOps `rebaseOpToLocal`)
- scenario: a node on a layer with its own plane (parallax `planeOf(view, layer)` non-identity) is dropped into a layout container on another plane. `placeAll` hands `commitDrop` the dragged child carried into the destination's plane (`carryDragged`), and strategies answer `from: dragged.originPose` (diagram's `containerLayout.ts:44`, `laneStack.ts:168`). `rebaseOpToLocal` rebases that `from` under the node's pre-commit parent without carrying it back to the source layer's plane. Undo replays the setPose inverse with that `from`, then the reparent/setLayer inverses, leaving the node back on its old layer but displaced by the plane difference. Should: carry `from` back to the source layer's plane (or use `session.startPoses`) before rebasing it under `curParent`.
- evidence: read (layoutDrop.ts, dragged.ts `carryDragged`, dropPass.ts `placeAll`, diagram commitDrop)
- severity: low
- size: line
- cause: `from` rebased in the wrong plane
- confidence: likely

## snapToContainer previews a second slotted root's envelope children at the first root's offset
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:83 (`snapped`)
- scenario: two dragged roots, each a non-frame group with children, dwell over a container where `findTarget` gives each its own slot. `snapped` poses both roots at their slots but sets the frame's `transform` to the first root's offset to its slot; `nextFrame` previews every cascade id with `draggedStoredPose` under that one delta, so the second root's children are drawn offset from their parent by the difference between the two slot offsets. On release `landedDescendantOps` moves them with their own root's landed delta, so the commit lands them somewhere other than the preview showed. Should: pose each slotted root's uncarried descendants by that root's own slot offset in the preview.
- evidence: read (snapToContainer.ts, frame.ts `nextFrame`, landedDescendants.ts)
- severity: low
- fix: packages/editing/src/actions/move/behaviors/snapToContainer.ts
- size: function
- cause: one group delta used for per-root slots
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
