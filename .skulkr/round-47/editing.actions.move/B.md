# Audit round 47 — `editing.actions.move` findings

Note: the tree is at 782733b19c, not the brief's 44e73a9 (that object is absent); `git status` shows no
changes under `packages/editing/src/actions/move`, so paths and lines below are that tree's.

## Every `snapToContainer` instance shares one scratch slot, so two in one binding cancel each other's dwell
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:19 (`STATE`), :21 (`getState`), :94 (`track`)
- scenario: a binding passes two `snapToContainer(...)` behaviors with different `findTarget`s (one for trays, one
  for bins). Over a tray, the first sets `pendingTargetId` and starts its dwell timer; in the same frame the second's
  `findTarget` answers `null`, so its `track` calls `clearTimer(s)` on the *same* `SnapState`, which cancels the
  first's timer. The tray never arms. Release reads one shared `committedSnap`, so both behaviors also plant into
  whichever container the other committed. `swapOnDrop.ts:44,102` fixed this for swap by giving each built behavior
  its own key (`swapOnDrop.${++built}`); snapToContainer still uses one module-level key.
- evidence: read
- severity: medium

## A layout drop pulls a selected child out of its selected parent; reparent-on-drop keeps it in
- where: packages/editing/src/actions/move/layout/dragged.ts:29 (`gatherDragged`), packages/editing/src/actions/move/commit/layoutDrop.ts:38 (`layoutDropOps`); compare commit/reparent.ts:166 (`outermost`)
- scenario: select a group P and also its child C, which is allowed because `moveSources` (core
  `selectionSubtree.ts:45`) does not drop nested ids. Drag both into a layout container D. `gatherDragged` makes
  a `DraggedChild` for every `session.ids` entry, C included, with `sourceContainerId = P`. `placeAll` places C in D
  as its own slot, and `layoutDropOps` emits `reparent(C, P → D)` because `P !== destId`. C ends up as D's sibling of
  P instead of riding inside P. `reparentOps` answers the same question with `outermost(session.ids, …)`, and
  `pageDropOps` with `belowRoots`/`ridden`, so nested ids ride their ancestor there. `snapToContainer.plantOps` (:187–204)
  has the same gap: it reparents every `ctx.draggedIds` entry, nested ones included, into the snapped container.
- evidence: read (the nested-id effect is inferred from the code, not run)
- severity: medium

## A root leaving its layout container takes its envelope descendants with an old-frame translate
- where: packages/editing/src/actions/move/commit/layoutRelease.ts:113–146 (`layoutReleaseOps`)
- scenario: a layout container L at world (100, 100) defines a frame. Its child R is a group that does not define
  a frame (an envelope), so R's child K is stored in L's frame and is not in `session.carried`. Drag R out of L onto
  empty canvas. `resolveLayoutExits` sends R to the layer root, and R's pose is rebased with `rebaseLocalPose` under
  the new parent. K, though, is in `unreleasedIds(session, released)`: R is not in `released`, so K is not
  "claimed". The `.filter(!exits.has)` only drops roots, so `translateOps` writes K as its old L-frame pose plus the
  delta. `landedDescendantOps` then skips K because K is already in `landed`. K is now interpreted in the root frame
  and lands about (−100, −100) away from R. `reparentOps` (reparent.ts:177–181) and `pageDropOps` (pageDrop.ts:156)
  rebase the same riders into the destination frame with `landedCascadeOps`. The exit path is the one reparenting
  commit that doesn't.
- evidence: read (the landing offset is inferred)
- severity: medium

## A swap armed over a layout sibling previews the layout insertion, then release commits the swap
- where: packages/editing/src/actions/move/session.ts:143–149 (behavior order), packages/editing/src/actions/move/frame.ts:39 (`posed.set`, last wins), behaviors/layoutDrop.ts:32–46
- scenario: with `swapOnDrop: 'dwell'` and a `layout` dep, drag card A in a stack container over sibling B and rest.
  The swap arms and returns B's pose at A's start place. `layoutDrop` runs after it in the same frame. Its drop pass
  still resolves A into the stack and returns `poses: drop.reflow` (or glides the siblings when `layout.reflow` is set),
  and that overwrites B's swap pose in `foldBehaviors`, because a later `posed.set` wins. The preview shows A being
  inserted with siblings making room. On release the swap's `onEnd` answers first and `swapOps` trades A and B, which
  is not what was shown. The commit order says the swap preempts the drops; the preview order lets the drop's poses
  win.
- evidence: read
- severity: medium

## The source container's reflow is laid out against different bounds in the preview and in the release
- where: packages/editing/src/actions/move/layout/dropPass.ts:101 (`sourceReflow`: `bounds: boxOf(g, view.upright)`), compare commit/layoutRelease.ts:40 (`releaseFrom`: `boxOf(g, view.toStrategy(composeChildFrame(...)))`) and layout/container.ts:111 (`content`, the scroll-offset frame)
- scenario: a source layout container that is scrolled, so its child frame is offset from its body. On a
  cross-container drop, `sourceReflow` hands `childPoses` the body box while the leftover children are measured at
  their scrolled world poses. `layoutDropOps` commits that result as "Source reflow". On a release outside every
  container, `releaseFrom` hands `releaseDrop` the scroll-offset content box for the same container. So one container's
  leftovers are laid out against two different rects, depending on which path ran. The candidate's own doc
  (container.ts:15–17) says the strategy needs the content frame "so the slots it places agree with its children as
  they are shown". If that holds, `sourceReflow` shifts every leftover by the scroll offset.
- evidence: read (the inconsistency); the shift is inferred
- severity: low

## Swap acts on the selected id, not the node the drag actually moves
- where: packages/editing/src/actions/move/behaviors/swapOnDrop.ts:105 (`draggedOf`), :151
- scenario: select one node L whose pose is derived (`derivePose` + `dependsOn: [S]`), for example a label pinned to a
  shape. `moveSources` turns the drag into a drag of S (`session.ids = [S]`), but `draggedOf` returns
  `session.selected[0] = L`. `arm` slides the target to L's home, and `swapOps(scene, L, target)` writes L's pose,
  which is "overwritten on the next read" (selectionSubtree.ts:39–40). Meanwhile S, the node that moved, is never
  swapped. `hitTarget` excludes S and its cascade but tests swappability against L.
- evidence: read (effect inferred)
- severity: low

## The move lead is cached by delta alone, so a landing that changes at the same delta is ignored
- where: packages/editing/src/actions/move/delta.ts:45–47 (`moveLead`)
- scenario: the pointer rests while a snap-toggling modifier is pressed or released, and the next move has the same
  `(dx0, dy0)`. `snappedDelta` updates or deletes the session's landing, but `moveLead` returns the cached lead with the
  previous frame's `landing`. The preview, and the commit if the user releases there, keep the old snap's landing
  (the host's `SnapOutcome.landing`) after snapping was turned off, or miss the new one.
- evidence: read (effect inferred)
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
