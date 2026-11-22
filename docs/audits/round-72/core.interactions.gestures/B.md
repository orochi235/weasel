# Audit round 72 — core.interactions.gestures

## `end()` wipes a gesture that `onEnd` started, and leaves it without an `onGestureEnd`
- where: packages/core/src/interactions/gestures/dragGesture/dragGesture.ts:158-165 (useDragGesture `end`)
- scenario: an `onEnd` that chains straight into the next gesture (calls `controller.start(...)` from inside `onEnd`, e.g. a tool that turns a release into the next segment's press). `start` sees `stateRef.current !== null`, treats it as a restart, skips `onGestureStart`, and installs the new state. Then `end`'s `finally` sets `stateRef.current = null` and bumps phase to `'idle'`, so the new gesture is silently dropped: later `move()` returns false, and the new `onStart`'s side effects (dragRect/dragRadial's `scratchRef` and overlay) are left behind with no `onEnd`/`onCancel` ever coming. The `finally` should clear only if `stateRef.current === s`.
- evidence: read
- severity: medium

## `cancel()` from inside `onEnd` fires `onGestureEnd` twice
- where: packages/core/src/interactions/gestures/dragGesture/dragGesture.ts:158-178 (useDragGesture `end` / `cancel`)
- scenario: `onEnd` decides to abort and calls `controller.cancel()` (or an unmount cleanup runs `cancel` during `onEnd`). `stateRef.current` is still `s`, so `cancel` runs `onCancel`, nulls the state and fires `onGestureEnd(false)`; then `end`'s `finally` fires `onGestureEnd(committed)` a second time. The option's doc promises "Fired once per `onGestureStart`"; a consumer counting open gestures (history batching, a busy flag) goes negative. `end` has no guard against re-entry and does not check that its state is still current before its own `onGestureEnd`.
- evidence: read
- severity: low

## A restarting `start()` drops the live gesture with no `onCancel` or `onEnd`
- where: packages/core/src/interactions/gestures/dragGesture/dragGesture.ts:108-123 (useDragGesture `start`)
- scenario: `start()` while a gesture is live (a second press before the first release arrives, e.g. a lost pointerup) overwrites `stateRef.current` with fresh state and scratch. The old gesture's `onCancel` never runs, so whatever its `onStart` set up outside the scratch (a consumer preview, a published guide, an `initScratch` resource) is never released; only `onGestureStart` is (deliberately) suppressed. Either the old gesture should be canceled through `onCancel` (keeping the `onGestureStart`/`onGestureEnd` pairing) or the doc should say callbacks are skipped.
- evidence: read
- severity: low

## `useDragRect`'s `isSubThreshold` goes stale when `onEnd` re-anchors a corner
- where: packages/core/src/interactions/gestures/dragRect/dragRect.ts:146-158 (useDragRect `onEnd`)
- scenario: `isSubThreshold` is computed once from `boundsFrom(start, current)` before `opts.onEnd` runs, but the end ctx exposes `setStart`/`setCurrent` and a live `bounds` getter. An `onEnd` that snaps a corner (`ctx.setCurrent(snapped)`) and then reads `ctx.isSubThreshold` gets the pre-snap answer while `ctx.bounds` shows the post-snap box — e.g. a 3 px drag snapped out to a 10 px grid cell still reports sub-threshold, or a drag snapped to zero width reports it is not. The doc calls it "end-time bounds … present-tense state check"; it should be a getter over the current corners.
- evidence: read
- severity: low

## The ghost clone of a checked radio input unchecks the source row's radio
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:50-53,116-117 (defaultGhost / beginPointerDrag)
- scenario: a drag handle whose row contains `<input type="radio" name="g" checked>` (outside a `<form>`, or the ghost host shares its form owner). `defaultGhost` deep-clones the row and strips only `id`; appending the clone (checked, same `name`) to `seat.host` puts a second checked radio in the same group, and the browser unchecks the original. When the ghost is removed at drop the source stays unchecked, so dragging a row changes its form state. The clone should also drop `name` (or the clone's inputs be neutralized) the way `id` is.
- evidence: read (DOM radio-group behavior inferred, not run)
- severity: low

## `EDGE_HANDLE_MIN_RADII`'s doc contradicts itself and the code
- where: packages/core/src/interactions/gestures/resizeHandles.ts:72-90 (EDGE_HANDLE_MIN_RADII / edgeHandlesFit)
- scenario: the constant's doc says an edge handle "sits this many hit radii on screen from each corner", i.e. a side of at least 12 radii (96 px at 8 px), then says "a side must span 48 px". `edgeHandlesFit` compares the whole side against `6 × radiusPx`, so the mid-edge handle sits only 3 radii from each corner. A reader tuning the constant from the first sentence doubles or halves the threshold. One of the two statements is wrong.
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
