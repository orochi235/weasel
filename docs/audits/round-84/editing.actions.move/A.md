# Audit round 84 — editing.actions.move (reviewer findings)

## snapBackOrDelete's delete path deletes nested dragged ids separately, so a node already taken by its ancestor's cascade gets a second delete
- where: packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts:81 (onEnd, `'delete'` branch)
- scenario: `ctx.draggedIds` is `session.ids`, and that list can hold a node and its descendant. `outer` exists to strip those out, and `moveSources` can return a derived container's children beside a selected sibling. The behavior emits one `ops.delete` per dragged id, ordered by each id's position in `adapter.getNodes()`. That is a flat node list, not paint or tree order. `createDeleteOp` removes the node's whole subtree (`captureCascade`). If the ancestor sorts first, its delete takes the descendant with it. The descendant's own delete then applies to a node that is gone: it captures nothing, its slot is unobserved, and its `removeNode` runs on a missing id. On undo, which replays in reverse, the descendant's inverse insert runs before its parent exists again. Only `outermost(ctx.draggedIds)` should get a delete, the way `onEnd` already uses `outermost` for the distance check.
- evidence: read (delete.ts cascade and invert; moveSources keeps nested ids). Undo misordering inferred.
- severity: medium

## A drop within one layout container counts the other dragged children as obstacles at their old poses
- where: packages/editing/src/actions/move/layout/dropPass.ts:47 (placeAll, `working` init)
- scenario: Take two children A and B of a sequence container and drag both to a new spot in that same container. `working` is seeded with every current child of `dest`, B included at its pre-drag pose. A's placement calls `getDropTargets` and `reflowPoses` with `children` still holding B in its old slot. Strategies drop only `dragged.id` (sequence `othersOf`, quadtree `c.id !== dragged.id`), so A's index and the reflow count B where it was. Only then is B placed. A drag of A and B from another container into `dest` sees neither of them in `working` until each is placed. The same selection therefore lands in a different order depending on whether it started inside the destination. The commit replays these placements (`layoutDropOps`), so the off-by-one is committed too.
- evidence: read (placeAll; strategy getDropTargets filters only the one dragged id). Ordering outcome inferred.
- severity: medium

## A layout container that refuses with a reason gets two refusal overlays (outline and reason text) when reparent-on-drop is on
- where: packages/editing/src/actions/move/behaviors/reparentOnDrop.ts:23 (onMove); packages/editing/src/actions/move/behaviors/layoutDrop.ts:45
- scenario: The setup is a `layout` dep, a `canDropInto` that refuses a layout container with a reason, and `reparentOnDrop: 'into'`. layoutDrop's pass picks the container under the selection center and returns `refusalOverlays(drop.refused, pointer)`. reparentOnDrop's `resolveDrop` climbs from the pointer's hit to the same container, gets the same refusal, and returns `refusalOverlays` again. `foldBehaviors` concatenates every behavior's overlays, so the outline and the reason label are drawn twice, stacked, and slightly offset whenever the two passes differ. The two passes answer one decision, whether a refusal shows, in two places. reparentOnDrop should skip its overlay when an earlier behavior (layoutDrop) has already reported that refusal.
- evidence: read (both behaviors return overlays; frame.ts pushes all). The double draw is inferred, not run.
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

<!-- done: 3 findings, files read: 33 -->
