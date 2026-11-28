## Layout drops and releases take their undo pose from the strategy's shown start pose, not from the document
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:30 (layoutDropOps, rebaseOpToLocal); packages/editing/src/actions/move/commit/layoutRelease.ts:40 (releaseFrom, rebaseReleased)
- scenario: A strategy's `commitDrop` writes `from: dragged.originPose`. guides' `sequence.ts` does this, and so does `freeform.ts`. `releaseDrop` builds its ops the same way. For a dragged root, `originPose` is not the document pose in two cases:
  1. The node was caught mid-glide. `gatherDragged` and `releaseFrom` compose the start through `grabbedPoseAdapter`, which answers with the shown, held pose.
  2. The node drops into a container on a layer that sits on another plane. `carryDragged` carries `originPose` into the destination's plane, but `rebaseOpToLocal` rebases `from` under the node's old parent, which is still on its old plane.
  `rebaseTransformOp` then stores that pose as the op's `from`, and `setPose.invert()` writes the stated `from` back. So undoing the drop puts the node at its mid-glide position, or at a pose read in the wrong plane, instead of where the document held it. Commit 3bb86b79 fixed the same defect in `snapToContainer` by taking `from` from `ctx.adapter.getPose(id)`. The other commit paths in this area (`reparentOps`, `pageDropOps`, layout exits) all use `node.pose`, so this decision is answered two ways.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/commit/layoutDrop.ts, packages/editing/src/actions/move/commit/layoutRelease.ts
- size: function
- cause: undo pose taken from the strategy's originPose instead of the document pose
- confidence: likely

## A layout exit over a page that refuses the drop lands on the pasteboard or its own page instead of following the page rule
- where: packages/editing/src/actions/move/layout/exits.ts:62 (resolveLayoutExits, onPage)
- scenario: The scene is paged. A child of a layout container is dragged out of the container and released over page B, which `canDropInto` refuses.
  - `onPage` only asks `session.admits(page)`. With the pasteboard on, it then returns null, and `layoutReleaseOps` reparents the node to the top of the tree, left sitting over the page that refused it. With the pasteboard off, it returns the node's own page whatever the node overlaps.
  - The page rule in `pageDrops` (commit/pageDrop.ts:74) does something else. A refusal with a reason returns `'refused'` and the whole move goes home. A silent refusal falls back to the page the dragged box overlaps most among the pages that take it (`takers`), not just the node's own page.
  Commit b62b6e88 says a layout exit lands "by the page rule", so the same release over the same page gets two different answers depending on whether the node's parent has a layout.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/layout/exits.ts, packages/editing/src/actions/move/commit/layoutRelease.ts
- size: function
- cause: exit landing re-implements the page rule without refusals or overlap
- confidence: likely

## A page refusing the drag with a reason draws nothing while the binding's reparentOnDrop is 'off', then the release silently snaps home
- where: packages/editing/src/actions/move/behaviors/pageDrop.ts:19 (pageDrop onEnd); packages/editing/src/actions/move/behaviors/reparentOnDrop.ts:18 (dropAt)
- scenario: The scene is paged, the default `reparentOnDrop: 'off'` is in force, and a `canDropInto` dep refuses page B with a reason. Nothing draws while a page child is dragged over B:
  - `reparentOnDrop.onMove` returns nothing, because `dropAt` answers null in mode `'off'`.
  - `layoutDrop`'s `pickContainer` skips page structure.
  - `pageDrop` has no `onMove`.
  On release, `pageDrops` returns `'refused'` and `pageDrop.onEnd` returns null, so the drag goes home without the user ever seeing the outline or the reason. The other refusing drops all draw the refusal while the pointer is over the container: layout containers, and reparent targets when the mode is on.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/behaviors/pageDrop.ts
- size: function
- cause: page drop has no onMove refusal overlay
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