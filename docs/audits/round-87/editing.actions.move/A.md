# Audit round 87 — editing.actions.move

## snapToContainer hands followerOps a container id where every other caller hands a page id
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:183 (plantOps, `landed.set(id, snap.parentId)`), consumed at :204 via `ctx.followerOps` → `followerOpsFor` (packages/editing/src/actions/move/capture.ts:133)
- scenario: `followerOpsFor`/`rehomedFollowers` read `landed` as id → page id (`followerLandings`, then `page === pageIdOf(scene, id)`, `homeOfPage(scene, page)`). layoutDropOps, layoutReleaseOps, pageDrops and reparentOps all map through `pageIdOf`. plantOps stores the snap container's own id. In a paged scene, a node with followers snapped into a group on another page passes a group id as the "page": the followers are judged against a page that does not exist, so they are either not rehomed (`homeOfPage` finds nothing) or rehomed when they should stay. Should be `pageIdOf(scene, snap.parentId)`.
- evidence: read (followerMoves.ts:33-47, pagePlacement.ts:112-133)
- severity: medium

## A layout drop moves a dragged envelope's descendants by a local-pose difference taken across two different frames
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:16 (layoutDropOps), together with packages/editing/src/actions/move/commit/index.ts:41 (commitMove → landedDescendantOps)
- scenario: layoutDropOps writes no ops for the descendants of a dragged root. It reparents the root into the destination container, with `from` in the old parent's frame and `to` in the destination's frame. commitMove then hands these ops to landedDescendantOps, which moves each descendant by `getBounds(to) - getBounds(startPoses(root))`, a difference between poses stored in two different frames. That is only right when the two frames differ by a translation. Take a dragged group that defines no frame, so its children are stored in the frame above it, dropped into a rotated or scaled layout container (containerView supports `turned` views). Its children land offset and unrotated relative to it. The reparent and page-drop paths avoid this: they write descendants explicitly with `landedCascadeOps`, which rebases world poses under the new frame. The layout path answers the same question a second way.
- evidence: inference (translation-only case checked algebraically; the rotated case follows from the delta being taken in mixed frames)
- severity: medium

## Reparent-on-drop in 'into' mode raises a node to the top of its stack when it is dropped over a sibling mark
- where: packages/editing/src/actions/move/commit/reparent.ts:166 (reparentOps → landAbove with `above = null`); resolveDrop at :47-57
- scenario: with `reparentOnDrop: 'into'`, drag a root-level node and release it over another root-level mark. resolveDrop climbs from the mark, which refuses silently, to `newParent = null`. reparentOps then runs `landAbove(siblings, id, null)`, which takes the node out and appends it, so it emits a null→null reparent op with no index. The node keeps its parent but jumps to the top of the paint order. The same drag released over empty canvas (resolveDrop gives null) leaves the order alone. The same thing happens to a group's child dropped over a sibling mark inside that group. A drop whose parent does not change should keep its index, or emit no reparent at all.
- evidence: inference from read
- severity: low

## Overrides posted through the gesture adapter's previewPoses survive the gesture
- where: packages/editing/src/actions/move/gestureAdapter.ts:29 (moveGestureAdapter.previewPoses); teardown at packages/editing/src/actions/move/action.ts:88 (closeRun)
- scenario: a behavior calls `ctx.adapter.previewPoses(map)` during a drag. The entries go into the scene's override table and the adapter's private `previews` map. Teardown (`closeRun`) releases only the action's own `hold` and `frame.previews`. Nothing clears the adapter's entries on commit or cancel unless the behavior itself posts `null` for each id. A behavior that forgets this, or that throws, leaves the node painted at a stale preview pose after the drag ends.
- evidence: inference (closeRun not opened)
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

<!-- done: 4 findings, files read: 33 -->
