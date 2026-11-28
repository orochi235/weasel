# Findings: editing.actions.move

## pageDropOps computes a landing index against a cached child list that still holds a root an earlier op moved out
- where: packages/editing/src/actions/move/commit/pageDrop.ts:131 (pageDropOps, `childrenOf` cache)
- scenario: Two dragged roots sit on pages A and B. On release, root R1's box mostly overlaps page B, so it moves A→B. Root R2 lands on page A (the page under the pointer) with `reparentOnDrop: 'above'`, so it should land just above the hit sibling H. `childrenOf(A)` is first read from the scene when R2 is handled, after R1's reparent op is already queued but before any op has run. The list therefore still includes R1. If R1 came before H in A, `landAbove` returns `indexOf(H) + 1`, which counts R1. When the ops apply, R1 has already left A, so R2 lands one slot too high: above the node above H instead of directly above H. `childrenOf` only tracks arrivals, which `landAbove` splices in. It never tracks departures from a parent through earlier `landOps`. That includes the orphaning reparent to `null` on a layer change, which `scene.roots` also misses.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/commit/pageDrop.ts
- size: function
- cause: sibling cache ignores departures
- confidence: likely

## The move's `refresh` hook stays live after the gesture ends and can republish previews into a released override hold
- where: packages/editing/src/actions/move/action.ts:57 (start → `session.gestureCtx.refresh`)
- scenario: A binding behavior starts its own timer (e.g. a custom dwell that does not use the bundled `snapToContainer`/`swapOnDrop` cleanup) and calls `ctx.refresh()` after release. `refresh` still holds `lastMove`, so it runs `show(lastMove)`. That recomputes a frame, calls every behavior's `onMove` on a closed gesture, and calls `hold.set(preview.poses())` after `closeRun` has already released `hold`. The drag's override poses can reappear in the scene with no owner to clear them. `onEnd` should disarm it: clear `refresh` or `lastMove` in its `finally`.
- evidence: read
- severity: low
- size: line
- cause: refresh not disarmed on end
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

<!-- done: 2 findings, files read: 33 -->
