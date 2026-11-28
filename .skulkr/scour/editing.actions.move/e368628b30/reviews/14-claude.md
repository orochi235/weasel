## A dragged envelope group reparented by a layout drop or a container snap leaves its children at the wrong world place under a turned or scaled frame
- where: packages/editing/src/actions/move/landedDescendants.ts:34 (landedDescendantOps)
- scenario: a non-frame group (its children stored in the group's parent frame) is dragged out of a rotated layout container and dropped into an upright one (`layoutDropOps`), or planted into a `snapToContainer` slot under another parent (`plantOps`, slotted roots). Neither path writes the group's descendants, so `commitMove` leaves them to `landedDescendantOps`, which moves each by the root's stored `to` bounds minus its stored `from` bounds. Those two poses are in different parent frames, so the difference is a world move only when both frames are pure translations. Under a rotation or scale the children land rotated or scaled away from where the preview showed them. `reparentOps` and the layout exits answer the same question correctly with `landedCascadeOps` (rebasing each rider's dragged world pose into the new frame), so the two paths disagree.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/commit/layoutDrop.ts, packages/editing/src/actions/move/behaviors/snapToContainer.ts
- size: function
- cause: local-frame bounds delta used across a parent change
- confidence: likely

## A page that refuses the drop with a reason draws no refusal while dragging when `reparentOnDrop` is 'off'
- where: packages/editing/src/actions/move/behaviors/reparentOnDrop.ts:19 (reparentOnDrop, dropAt / onMove)
- scenario: in a paged scene with a `canDropInto` dep, drag a page's child over a page whose verdict refuses with a reason, binding param `reparentOnDrop: 'off'`. `pageDrop.onEnd` aborts the release (`pageDrops` returns 'refused', line 75 of commit/pageDrop.ts), but during the drag nothing is drawn: the only refusal overlay for a non-layout drop comes from `reparentOnDrop.onMove`, and its `dropAt` returns null when the mode is 'off'. The user sees a normal drag that silently snaps home on release. With the mode on, the same page refusal is drawn through `resolveDrop`.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/behaviors/pageDrop.ts
- size: function
- cause: page refusal has no onMove overlay of its own
- confidence: likely

## `clampMove` does not clamp an Alt-drag clone
- where: packages/editing/src/actions/move/behaviors/clampMove.ts:43 (clampMove)
- scenario: a select tool's `move.behaviors: [clampMove({ bounds })]`. `selectionContributions.ts:54` hands the clone binding only each behavior's `clone` part, and `clampMove` returns none, so an Alt-drag copies the selection and lets it be dropped anywhere, outside the bounds the doc says the dragged nodes stay inside. `snapToContainer` and `snapBackOrDelete` each ship a `clone` part for this reason.
- evidence: read
- severity: low
- size: function
- cause: missing clone half
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
