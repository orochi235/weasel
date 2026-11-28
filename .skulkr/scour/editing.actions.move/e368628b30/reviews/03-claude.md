Writing the findings file was blocked, so as the brief says, the whole document follows in place of the file.

## A page that refuses a drop with a reason refuses the release silently: nothing draws the refusal during the drag
- where: packages/editing/src/actions/move/behaviors/pageDrop.ts:17 (pageDrop)
- scenario: a paged scene has a `canDropInto` dep that refuses a page child landing on page P, with a reason ("page is full"). The move binding is at its default `reparentOnDrop: 'off'`. Dragging a node from page Q over P draws no overlay during the drag. At release, `pageDrops` answers `'refused'` (commit/pageDrop.ts:74) and the move snaps back. `pageDrop` has no `onMove`. For drops that aren't layout drops, `reparentOnDrop.onMove` is the only thing that draws a refusal, and its `dropAt` returns null whenever `reparentOnDrop() === 'off'` (behaviors/reparentOnDrop.ts:20). So the page's refusal never reaches `refusalOverlays`. The layout drop and reparent-on-drop both draw, during the drag, any refusal they will act on at release. The page drop should too.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/behaviors/pageDrop.ts, packages/editing/src/actions/move/commit/pageDrop.ts
- size: function
- cause: page-drop refusal has no onMove path
- confidence: likely

## A layout exit that lands a child back in the page it already has appends it, losing its paint/stack order
- where: packages/editing/src/actions/move/commit/layoutRelease.ts:152 (layoutReleaseOps, exit reparent)
- scenario: a page node has a layout, and the pasteboard is off. The exit pass treats any parent that `getLayout` answers for as a source layout; only `pickContainer` skips page structure. Drag one of the page's children so the drop center falls off every page, and release. `resolveLayoutExits` → `onPage` returns the node's own page (layout/exits.ts:63-65), so `toParent === node.parent`. The exit then pushes `coreOps.reparent({ fromParentId: page, toParentId: page })` with no `toIndex`, which appends the child to the end of the page's children. It jumps to the top of the paint order, and to the end of the page layout's order. The 2026-11-25 ruling (docs/unruled.md, round 87) says a drop that lands a node in the parent it already has keeps its place. `landAbove`/`landOps` do that for reparent-on-drop and the page drop, but this path bypasses them.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/commit/layoutRelease.ts, packages/editing/src/actions/move/layout/exits.ts
- size: line
- cause: exit reparent skips landAbove / same-parent check
- confidence: likely

## A release frame that throws skips every behavior's onEnd and onCancel, so dwell timers outlive the gesture and `refresh` republishes the dropped preview hold
- where: packages/editing/src/actions/move/action.ts:82 (moveAction onEnd), :58 (refresh)
- scenario: the pointer is released past the last move point, so `onEnd` runs `show(endCtx)` for a final frame. A behavior's `onMove` throws in that frame: a binding behavior, or the layout drop calling a strategy's `getDropTargets`. Control goes straight to `finally`.
  - `commitMove` never runs, so no behavior's `onEnd` runs.
  - `runBehaviorCancel` sits only on the else branch, so no `onCancel` runs either.
  - `snapToContainer` and `swapOnDrop` clear their dwell timers only in those hooks, so the timers stay pending.
  - When one fires, it calls `ctx.refresh`, which is still the action's closure. `show(lastMove)` runs the behaviors again after the gesture has closed, then calls `hold.set(...)` on the hold that `closeRun` already dropped.
  - `createPoseHold`'s `set` republishes into the override table and nothing drops it again, so the dragged nodes stay painted at their preview poses.

  Fix: when the commit was never reached, the close should run the behaviors' cancel. It should also clear `gestureCtx.refresh`, or make it a no-op, once the run is closed.
- evidence: read
- severity: low
- size: function
- cause: release-frame throw bypasses end/cancel; refresh not disarmed at close
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