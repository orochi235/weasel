# Audit round 83 — editing.actions.move

## Layout drop reparents across layers with no layer change, so a container on a higher layer throws and one on a lower layer gets a child left on the wrong layer
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:39 (layoutDropOps); candidates from packages/editing/src/actions/move/layout/container.ts:96 (pickContainer)
- scenario: pickContainer walks every root on every layer and maps the drop center into each candidate's plane (`planeOf(session.view, node.layer)`), so a layout container on layer `top` can take a node dragged from layer `base`. layoutDropOps then emits a bare `coreOps.reparent` into that container with no `setLayer`. The scene's layerStack throws "a child may not render below its parent's layer" when the parent's layer is above the child's, so the commit throws. When the container's layer is below, the node lands under it but stays on its old layer. reparentOps (`landOps` in commit/reparent.ts) handles the same situation: it orphans the node, runs `setLayer` onto the destination's layer, then reparents. That is the same decision answered two ways.
- evidence: read (packages/core/src/core/scene/layerStack.ts:91-93; the landOps comment "The scene refuses a layer change on a node whose parent is on another layer")
- severity: medium

## snapToContainer freezes the primary node's slot at the first slot it committed to while the pointer stays in the same container
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:109 (track)
- scenario: The dwell or `isInstant` commits target T1 (container C, slot S1). Every later frame where `findTarget` answers the same container but a different slot S2 (a grid cell further along) returns `snapped(ctx, s.committedSnap)`, so the preview and the release (`released` reads `s.committedSnap`) put the primary at S1. In the same frame, `slotsFor` asks `findTarget` again for every other root, so their slots follow the pointer. The primary should take the slot `findTarget` currently answers. Even an `isInstant` container never updates the slot, because the early return comes before the `isInstant` branch.
- evidence: read
- severity: medium

## A layout drop moves the dragged root's descendants by a translation only, while reparent and page drops re-pose each descendant in its new frame
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:14 (layoutDropOps), with packages/editing/src/actions/move/landedDescendants.ts:22
- scenario: Drag a group whose children are not carried by its own frame (an envelope) into a layout container whose view is turned (`view.turned`, a rotated container). The root's pose is rebased into the turned frame, including the rotation (`rebaseTransformOp`). Its descendants are written nowhere in layoutDropOps, so commitMove's `landedDescendantOps` moves each one by the difference between the root's stored bounds before and after. That difference is a translation measured across two different frames, so the children keep their unrotated offsets and land displaced. reparentOps and pageDropOps send the same descendants through `landedCascadeOps`, which rebases each one by `landedLocalPose`.
- evidence: read; outcome inferred
- severity: low

## A layout child let go outside its container in a paged scene with the pasteboard off lands off-page at the top of the tree
- where: packages/editing/src/actions/move/layout/exits.ts:40 (resolveLayoutExits / landingOn), answered through packages/editing/src/actions/move/commit/layoutRelease.ts:104
- scenario: With the pasteboard off, drag a child of a layout container on page P and let it go off every page. resolveLayoutExits finds no admitting node under the drop center, so `landingOn` answers `null`, and layoutReleaseOps reparents the node to the tree's top level. layoutDrop runs before pageDrop and answers, so pageDrop's rule never runs. That rule says a root released off every page with the pasteboard off stays in its page, shifted by `keepOnPage`. The node ends up off every page, which the pasteboard-off mode exists to prevent.
- evidence: read; outcome inferred
- severity: medium

## Layout preview positions the dragged nodes without the snap lead, while the release commit uses it
- where: packages/editing/src/actions/move/layout/dragged.ts:34 (gatherDragged), against packages/editing/src/actions/move/delta.ts:126 (draggedWorldPose)
- scenario: When the snap host answers a `landing`, `draggedWorldPose`, `translateOps` and `localDelta` translate the first root through the lead (`leadFor`). `gatherDragged` calls `translatePoseViaDescriptor(startWorld, dx, dy, g)` with no lead. The layout pass then picks its container and probe center from a pose that differs from the one the translate, release and exit commit write. Near a container edge, the drop the preview showed and the place the node lands disagree.
- evidence: read
- severity: low

## reparentOnDrop `'inside'` raises a node to the top of its own parent when it is released over a sibling or over its parent
- where: packages/editing/src/actions/move/commit/reparent.ts:162 (reparentOps), with landAbove at :63
- scenario: With `reparentOnDrop: 'inside'`, drag a child of group G and let it go over a sibling mark in G. resolveDrop climbs from the mark, which refuses silently, to G, so `newParent === node.parent`. reparentOps still runs `landAbove(siblings, id, null)`, which takes the node out of the sibling list and appends it, then emits a reparent from G to G with `toIndex` undefined. A plain move inside the group changes its paint order, putting it on top. A release over empty canvas inside G does not, because resolveDrop returns null there. When the parent does not change, the node should keep its index.
- evidence: read
- severity: low

## The drop verdict is asked about every drag root, including ones nested inside another root that never land on their own
- where: packages/editing/src/actions/move/session.ts:183 (verdictOf(ctx.deps.canDropInto, ids, scene))
- scenario: Select a group and one of its children, so both are in `ids`, and drag onto a container whose `canDropInto` admits groups but refuses marks. Only `outer` (the group) is placed; the child rides inside it. Because `childVerdict` is handed `ids`, the refused mark makes the container refuse the whole drop: no reparent, no layout drop, no page landing. The verdict should be asked about `outer`.
- evidence: read; childVerdict's exact handling of several roots not opened
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

<!-- done: 7 findings, files read: 33 -->
