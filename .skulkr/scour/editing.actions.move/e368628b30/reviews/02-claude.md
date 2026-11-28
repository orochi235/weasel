## A move answered by a behavior that does not translate (swap, delete, layout placement) is still recorded as a translate by the drag delta for "transform again"
- where: packages/editing/src/actions/move/action.ts:80 (moveAction invoker onEnd)
- scenario: drag one node with `swapOnDrop: 'dwell'`, rest over another until armed, release → `swapOps` trades the two nodes' places, `committed` is true, and `recordTransform(scene, { kind: 'translate', ...frame.delta }, subject)` records the pointer delta. Transform-again then translates the next selection by that delta, although the swap moved nothing by it. The same happens when `snapBackOrDelete({ onFreeRelease: 'delete' })` deletes the dragged nodes (a translate is recorded against deleted ids), and when a layout container's `commitDrop` places the node in a slot unrelated to the delta. Only a commit that actually translated by `frame.delta` (the default translate, reparent and page drops that keep the dragged world pose) should record one; the others should record nothing, or call `forgetTransform`.
- evidence: read (memory.ts `recordTransform` stores the transform for `transformAgain` to repeat)
- severity: medium
- fix: packages/editing/src/actions/move/action.ts, packages/editing/src/actions/move/commit/index.ts
- size: function
- cause: commit success taken as "translated by delta"
- confidence: likely

## Riders of a reparented envelope root get only a translation, so a drop into a turned parent leaves them unrotated
- where: packages/editing/src/actions/move/commit/reparent.ts:105 (landedCascadeOps)
- scenario: drag a group that does not define a frame (its children are stored in the group's parent frame), with `reparentOnDrop: 'inside'`, into a group rotated 30°. The root's pose is rebased whole by `landedLocalPose` → `rebaseLocalPose`, which takes the rotation into the new frame. Each rider's landed local pose is computed the same way, but only its bounds' x/y difference is kept (`own.set(id, { dx: to.x - from.x, ... })`) and applied through `translateNodeOps`. The rider keeps its old local rotation, so in world it turns by 30° with the parent frame while the root does not: the children no longer sit where the drag showed them. The same function serves page drops (`pageDropOps`) and layout exits (`layoutReleaseOps`). The rider's stored pose should be the landed pose, not a translate of the start pose.
- evidence: read
- severity: medium
- size: function
- cause: rebased pose reduced to a translation delta
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

<!-- done: 2 findings, files read: 33 -->
