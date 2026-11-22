## The default drag ghost clones a checked radio into the document, unchecking the real one
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:52 (defaultGhost)
- scenario: a `useDragHandle` row containing a checked `<input type="radio" name="g">` (not inside a `<form>`) is dragged past threshold. `cloneNode(true)` copies checkedness, and the clone is appended to `seat.host` in the same document tree, so it joins radio group `g` while checked; inserting a checked radio unchecks every other member of its group, so the source row's radio goes unchecked (and stays so after the ghost is removed). Only `id` attributes are stripped; `name` should be too (or form controls neutralised) so the ghost cannot join the page's radio groups.
- evidence: read
- severity: medium

## An `onEnd` that cancels or restarts the gesture fires `onGestureEnd` twice / kills the new gesture
- where: packages/core/src/interactions/gestures/dragGesture/dragGesture.ts:158 (end)
- scenario: `stateRef` stays set while `opts.onEnd` runs. If `onEnd` calls `controller.cancel()` (e.g. a wrapper consumer bailing out), `cancel` runs `onCancel`, nulls state and calls `onGestureEnd(false)`; then `end`'s `finally` calls `onGestureEnd(committed)` again — two ends for one `onGestureStart`, contrary to the documented "fired once per onGestureStart". If `onEnd` calls `start()` for a chained gesture, `start` sees a live gesture (so no `onGestureStart`), and `end`'s `finally` then sets `stateRef = null`, silently discarding the gesture just started (wrappers' `scratchRef`/overlay are already set for it). `end` should clear `stateRef` (or check `stateRef.current === s`) before running callbacks that can re-enter.
- evidence: read
- severity: low

## `edgeHandlesFit` answers true for any body when the frame is singular
- where: packages/core/src/interactions/gestures/resizeHandles.ts:88 (edgeHandlesFit)
- scenario: `pxExtentIn` → `pxExtentInFrame` returns `{x: 0, y: 0}` when the frame's determinant is 0 (a target scaled to zero on an axis). The test `Math.abs(body.width) >= 0 && Math.abs(body.height) >= 0` then passes, so `resizeHandlesFor` gives a collapsed body all eight handles stacked on top of each other, where the rule exists precisely to withhold edge handles from a body with no room. A zero floor should mean "does not fit".
- evidence: read
- severity: low

## `EDGE_HANDLE_MIN_RADII` doc contradicts the check it names
- where: packages/core/src/interactions/gestures/resizeHandles.ts:72 (EDGE_HANDLE_MIN_RADII)
- scenario: the doc says an edge handle sits at least 6 hit radii from each corner of its side, which for a midpoint handle means a side of 12 radii (96 px at 8 px). `edgeHandlesFit` requires the whole side to span 6 radii (48 px, as the same comment's example says), putting the handle only 3 radii from each corner. A caller tuning the constant from its doc gets half the clearance it asked for.
- evidence: read
- severity: low

## `useDragRect`'s end `isSubThreshold` goes stale when `onEnd` moves a corner
- where: packages/core/src/interactions/gestures/dragRect/dragRect.ts:147 (onEnd)
- scenario: `isSubThreshold` is computed once from the bounds before the consumer's `onEnd` runs, while the end ctx exposes `setStart`/`setCurrent` and a live `bounds` getter. An `onEnd` that snaps `current` (e.g. to grid) and then reads both sees `ctx.bounds` of the snapped box but `isSubThreshold` of the unsnapped one: a 3-px drag snapped to a 10-unit cell reports sub-threshold beside a 10×10 box, or vice versa. The field should be a getter over the live bounds, as the doc ("end-time bounds") promises.
- evidence: read
- severity: low

## Drop zones are resolved in the global `document`, not the drag source's
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:34 (findZone)
- scenario: a `useDragHandle` source rendered into another window's document (a portal into a pop-out / iframe). The session and `afterRelease` listen on `target.ownerDocument`, and the ghost goes to `fixedSeat(source).host`, but `findZone` calls the global `document.elementFromPoint`, which hit-tests the opener window's page at those coordinates; zones in the source's own document are never found and a zone in the opener under the same coordinates can receive the drop. Should use `source.ownerDocument`.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/gestures/dragGesture/dragGesture.ts
packages/core/src/interactions/gestures/dragGesture/dragPointOf.ts
packages/core/src/interactions/gestures/dragGesture/index.ts
packages/core/src/interactions/gestures/dragRadial/dragRadial.ts
packages/core/src/interactions/gestures/dragRadial/index.ts
packages/core/src/interactions/gestures/dragRect/dragRect.ts
packages/core/src/interactions/gestures/dragRect/index.ts
packages/core/src/interactions/gestures/frames.ts
packages/core/src/interactions/gestures/pointerDrag/index.ts
packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts
packages/core/src/interactions/gestures/resizeHandles.ts
packages/core/src/interactions/gestures/shared/index.ts
packages/core/src/interactions/gestures/shared/originProjection.ts
packages/core/src/interactions/gestures/shared/screenTolerance.ts
packages/core/src/interactions/gestures/spec.ts
packages/core/src/interactions/gestures/types.ts

<!-- done: 6 findings, files read: 16 -->
