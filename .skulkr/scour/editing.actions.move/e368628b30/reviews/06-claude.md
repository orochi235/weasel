## A refused container on another plane is outlined at its own-plane coordinates, away from where it is drawn
- where: packages/editing/src/actions/move/refusal.ts:27 (worldBoundsOf); packages/editing/src/actions/move/layout/dropPass.ts:166 (runDropPass, `bounds: dest.bounds`)
- scenario: a container on a layer whose plane differs from the edited one (parallax, a `planeOf(view, layer)` map) refuses the drop with a reason. `worldBoundsOf` and `pickContainer`'s `worldAabb` are the container's bounds in its own plane's world (`composeWorldPose` on the stored chain, no plane map), while the overlay's `reason` label is placed at the pointer in the edited plane and `pickContainer` itself maps the pointer into the container's plane before testing (`toPlane(plane, center)`). So the refusal outline is drawn displaced from the container the user sees under the pointer; it should be carried into the edited plane (`invertPlane(planeOf(view, layer))`) as `gatherDragged` does for dragged poses.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/refusal.ts, packages/editing/src/actions/move/layout/dropPass.ts, packages/editing/src/actions/move/layout/container.ts
- size: function
- cause: bounds left in the container's plane
- confidence: likely

## The swap's armed bounds are in the target's plane but tested against, and drawn with, the edited-plane pointer
- where: packages/editing/src/actions/move/behaviors/swapOnDrop.ts:83 (arm), :128 (onMove `inside(s.armed.bounds, point)`)
- scenario: with `swapOnDrop: 'dwell'`, the drag is over a target node on a layer on another plane. `arm` measures `home` and `bounds` with `frame.world(...)` in each node's own plane, but `point` is `ctx.pointer.worldX/Y` in the edited plane. While armed, `inside(bounds, point)` decides whether the pointer still holds the target, so a pointer resting visibly over the target disarms (or a pointer elsewhere stays armed), and `outline(armed.bounds)` is drawn at the wrong place. When the dragged node and the target are on different planes, the preview slide `home - bounds` also mixes two planes' coordinates.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/behaviors/swapOnDrop.ts
- size: function
- cause: plane map not applied to armed bounds
- confidence: likely

## A layout drop throws if the destination, a dragged node or a reflowed sibling is removed between the last move and the release
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:44 (`session.scene.get(asNodeId(destId))!.layer`), :49 (landOps on a removed dragged id), :70 (`session.scene.get(asNodeId(cid))!.pose`)
- scenario: the drop pass is computed on the last `onMove`; a remote edit or a timer-driven command deletes the destination container, a dragged root, or a source-reflow sibling before the pointer is let go. `layoutDropOps` dereferences each with `!` (and `landOps` does `scene.get(id)!` then `node.layer`), so the release throws a TypeError instead of skipping the missing node, as `reparentOps` ("A node removed mid-drag is skipped") and `pageDrops` do. The move's commit fails with an exception rather than committing or aborting cleanly.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/commit/layoutDrop.ts, packages/editing/src/actions/move/commit/reparent.ts
- size: function
- cause: non-null assertions on nodes read at release
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
