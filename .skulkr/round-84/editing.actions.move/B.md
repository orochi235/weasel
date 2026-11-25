# Audit round 84 — editing.actions.move

## A layout release translates the selection's non-layout roots itself, so page drop and reparent-on-drop never run for them
- where: packages/editing/src/actions/move/commit/layoutRelease.ts:158 (layoutReleaseOps), reached from packages/editing/src/actions/move/behaviors/layoutDrop.ts:73
- scenario: in a paged scene, select a child of a layout container and a plain child of page A, and drag both so that they are let go over page B, with no layout container under the drop center. The layout child exits (`exits.size > 0`), so `layoutReleaseOps` returns ops and `layoutDrop` answers the commit. Its trailing `translateOps(unreleasedIds(...))` translates the plain page child too. Because the end is now answered, `pageDrop` and `reparentOnDrop` both return early. So the plain child stays parented to page A while it sits over page B. With the pasteboard off it is not shifted back onto a page (`keepOnPage`), and with `reparentOnDrop: 'into'` it does not go into the group under the pointer. What should happen: those roots get what `pageDrops` / `resolveDrop` decide for them, as they would if dragged alone. `resolveLayoutExits`'s own doc says "A root whose parent has no layout is not this pass's to move; `reparentOnDrop` decides for those". The translate here contradicts that, and the same drop is answered two ways depending on what else is selected.
- evidence: read
- severity: medium

## Descendants of a root landed in another frame are moved by the difference of two poses stored in different frames
- where: packages/editing/src/actions/move/landedDescendants.ts:28-38 (landedDescendantOps); fed by packages/editing/src/actions/move/behaviors/snapToContainer.ts:192-197 (plantOps, slot nodes) and packages/editing/src/actions/move/commit/layoutDrop.ts:40-56 (cross-container drop)
- scenario: drag an envelope group (one that does not define a frame, so its children are stored in its frame ancestor's frame). Drop it into a container with a different, rotated or scaled frame. Either `snapToContainer` gives it a slot, or a layout container in another parent accepts it. `plantOps` / `layoutDropOps` write only the root: its `to` is stored under the new parent's frame, and nothing writes its descendants. `landedDescendantOps` then takes `from` from `startPoses`, which is stored in the old frame, and `to` from the op, stored in the new frame. It translates every uncarried descendant by `bounds(to) − bounds(from)`. That difference is correct only when the two frames differ by a pure translation. Under a turned or scaled frame, the descendants land away from the root and keep their old orientation. What should happen: each descendant is rebased into the new frame at its dragged world place. `reparentOps` (via `landedCascadeOps`) and snapToContainer's own `keptInPlace` for slotless nodes already do this, but the slot path and the layout-drop path do not.
- evidence: read (traced the frame math; not run)
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

<!-- done: 2 findings, files read: 33 -->
