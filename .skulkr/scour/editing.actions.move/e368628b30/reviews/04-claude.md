## Layout exits ignore a plain container's refusal: the node lands somewhere else instead of the drop moving nothing
- where: packages/editing/src/actions/move/layout/exits.ts:47 (resolveLayoutExits / landingOn), :62 (onPage)
- scenario: Child C sits in layout container L. Plain group G lies outside L, `canDropInto(G)` answers a `DropRefusal` with a reason, and `reparentOnDrop: 'into'` is set. While C is dragged out of L and held over G, `reparentOnDrop.onMove` draws G as refused with its reason, because no layout container claims the drop. On release, `layoutDrop.onEnd` runs first, finds `drop.refused` undefined and calls `layoutReleaseOps`. `landingOn` skips G because `session.admits(G)` is false and falls through to an outer admitting container, or to null (top level), so C is reparented there. `onPage` does the same for a page that refuses with a reason: it falls back to C's own page. `CanDropIntoDep` documents the opposite: where it answers a refusal, "a release there moves nothing". `resolveDrop` and `pickContainer` both honor that. The exits are the one path that treats a refusal like a silent `false`.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/layout/exits.ts, packages/editing/src/actions/move/commit/layoutRelease.ts
- size: function
- cause: exits test `admits` (=== true) and never `refusalOf(verdict)`
- confidence: likely

## A page that refuses with a reason is never drawn as refused, but a release over it aborts the move
- where: packages/editing/src/actions/move/commit/pageDrop.ts:73 (pageDrops); packages/editing/src/actions/move/behaviors/reparentOnDrop.ts:25 (onMove)
- scenario: In a paged scene, `canDropInto(page)` answers a `DropRefusal`. `pageDrops` returns `'refused'` whenever the pointer is over that page, whatever `reparentOnDrop` is set to, and `pageDrop.onEnd` then returns `null`, so the drag goes home. Nothing draws that refusal during the drag. `pageDrop` has no `onMove`, and `reparentOnDrop.onMove` draws only through `dropAt`, which returns null when `reparentOnDrop` is `'off'` (the default) and when `nodeAtPoint` hits nothing on the page's empty area. The user sees a normal drag that snaps back at release with no reason given, against the `CanDropIntoDep` contract ("a drag over the container draws it refused with the reason beside the pointer").
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/behaviors/pageDrop.ts
- size: function
- cause: page refusal decided at release only; overlay path gated on reparentOnDrop mode
- confidence: likely

## A layout drop's undo returns the dragged node to the strategy's `originPose`, not its stored pose (wrong when grabbed mid-glide or dropped across planes)
- where: packages/editing/src/actions/move/commit/layoutDrop.ts:25 (layoutDropOps / rebaseOpToLocal); packages/editing/src/actions/move/commit/layoutRelease.ts:36 (releaseFrom / rebaseReleased)
- scenario: Strategies write the dragged node's op as `from: dragged.originPose` (`guides/.../sequence.ts`, `freeform.ts`), and `setPose.invert` restores `from`. That pose has two problems.
  - **Caught mid-glide:** `originPose` is `startWorld` read through `grabbedPoseAdapter`, which for a node caught mid-glide answers `startPoses` (the `effectivePose` shown by the glide), not `documentPose`. Grab a sibling that is still gliding from an earlier reflow and drop it into a layout container (or let a `releaseDrop` take it), then undo: the node is set to the mid-glide pose it was shown at, not the pose the document held. `snapToContainer` was fixed for exactly this (its test "undoes a snap to the pose the document held, not where a glide showed the node").
  - **Across planes:** `placeAll` carries `originPose` into the destination's plane (`carryDragged(..., destPlane)`), and `rebaseOpToLocal` then rebases that `from` under the old parent on the old plane. Undo puts the node at a destination-plane pose in its source frame.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/commit/layoutDrop.ts, packages/editing/src/actions/move/commit/layoutRelease.ts
- size: function
- cause: undo `from` taken from strategy op instead of the node's stored pose
- confidence: likely

## `landedDescendantOps` measures a caught root's landing from its shown pose, so its descendants land off by the catch offset
- where: packages/editing/src/actions/move/landedDescendants.ts:30 (landedDescendantOps)
- scenario: `from` is `startPoses.get(id) ?? a.from`. For a root caught mid-glide, `startPoses` holds the shown pose S = D + c (document pose D plus catch offset c). A layout drop or `snapToContainer` lands the root at T, and its envelope descendants (not carried by a frame) are then moved from their document poses by T − S. The correct delta is T − D, so they end up c away from where the root took them. The translate commit adds `caught` for exactly this reason (`translate.ts:20`); this path does not.
- evidence: read
- severity: low
- size: line
- cause: shown (caught) start pose used as the document "from"
- confidence: likely

## Reparenting several roots "above" a sibling stacks them in reverse, while appending stacks them in order
- where: packages/editing/src/actions/move/commit/reparent.ts:62 (landAbove), :174 (reparentOps); packages/editing/src/actions/move/commit/pageDrop.ts:156 (pageDropOps)
- scenario: Roots `[A, B]` dropped with `reparentOnDrop: 'above'` over sibling S, where the destination's children are `[S, X]`. A gets `hit + 1 = 1` → `[S, A, X]`. B also gets `hit + 1 = 1` → `[S, B, A, X]`, so A paints over B. Dropped without a hit sibling, the same roots append as `[…, A, B]`, so B paints over A. The two modes order the same roots in opposite directions, and the 'above' result reverses the order the roots are processed in.
- evidence: read (traced)
- severity: low
- size: function
- cause: every root inserted at the same index just above the hit
- confidence: sure

## A refused container on another plane is outlined at its own-plane bounds, not where the edited plane shows it
- where: packages/editing/src/actions/move/layout/container.ts:121 (pickContainer, `bounds: worldAabb`); packages/editing/src/actions/move/refusal.ts:26 (worldBoundsOf)
- scenario: With a parallax plane (`planeOf(view, layer)` non-null), `pickContainer` already carries the pointer into the container's plane (`toPlane(plane, center)`). The refusal it records keeps `worldAabb` in the container's own plane, and so does `resolveDrop` through `worldBoundsOf`. `refusalOverlays` then draws that rect, next to the reason label placed at the edited-plane pointer, so the "refused" outline is offset from the container it names.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/layout/container.ts, packages/editing/src/actions/move/refusal.ts
- size: function
- cause: bounds not carried back into the edited plane
- confidence: likely

## `snapToContainer` previews a secondary root's descendants at the primary root's offset, not at that root's own slot
- where: packages/editing/src/actions/move/frame.ts:62 (nextFrame); packages/editing/src/actions/move/behaviors/snapToContainer.ts:83 (snapped)
- scenario: Two roots are snapped into a container, each given its own slot by `findTarget`. `snapped` returns `poses` for the roots only and a `transform` equal to the primary root's offset to its slot. `nextFrame` previews every non-root id in `startPoses` with `draggedStoredPose(..., dx, dy)` using that one transform. The secondary root's envelope descendants are therefore drawn moved by the primary's offset, detached from their root at its own slot. At commit, `landedDescendantOps` moves them by that root's real landing, so preview and commit disagree.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/behaviors/snapToContainer.ts
- size: function
- cause: per-root slot poses not propagated to descendants in the preview
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

<!-- done: 7 findings, files read: 33 -->