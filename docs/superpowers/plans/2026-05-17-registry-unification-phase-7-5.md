# Registry unification — Phase 7.5: deferred ongoing-action ports

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the three ongoing actions Phase 7 deferred because each needs non-trivial dispatcher extensions: `editAnchors` (multi-phase gesture), `lassoSelect` (polygon synthesis from streamed pointermoves), `viewport.pinchZoom` (multi-touch pump).

**Architecture:** Each port requires both (a) a dispatcher extension to support the gesture pattern, and (b) the descriptor itself. Significantly more work than Phase 7's straightforward drag ports.

---

### Task 1: dispatcher extension — multi-phase ongoing gestures

The `editAnchors` action is a state machine: click-anchor → drag-handle → release → maybe-click-different-anchor. The current dispatcher's `OngoingHandle` (start → onMove* → onEnd) doesn't natively express phase transitions.

Option A: extend `OngoingHandle` with a `phase` field the dispatcher reads to know which sub-gesture is currently in flight. The descriptor's `start` returns an initial handle; subsequent `onMove`/`onEnd` calls can return a NEW handle to transition into a different phase.

Option B: make `editAnchors` a sequence of independent ongoing actions chained by the dispatcher. Cleaner but requires action-chaining primitives the dispatcher doesn't have.

Pick A — minimal dispatcher change; descriptor owns the state machine logic.

### Task 2: port `editAnchors`

Read `useEditAnchors`. Map its phase machine onto the new OngoingHandle-with-phases shape. Test the multi-phase flow end-to-end.

### Task 3: dispatcher extension — pointer-stream gesture

`lassoSelect` accumulates pointermove coordinates into a polygon. The current pump fires onMove with delta — what's needed is a way for the descriptor to know "give me the FULL trajectory so far, not just the delta."

Solution: extend `InvocationCtx.drag` with a `points?: Point2[]` field (full pointermove history). The dispatcher builds this from the in-flight gesture's pointer history.

### Task 4: port `lassoSelect`

Read `useLassoSelect`. The descriptor accumulates points into a polygon, calls `scene.lassoSelect(polygon, mode)` (or similar adapter method) on commit.

### Task 5: dispatcher extension — multi-touch pump

Phase 3's `InputEvent` has `multitouch` kind but the dispatcher doesn't pump per-finger movement events. Need:
- Track multi-touch pointer ids in the dispatcher (which fingers are down).
- On any pointermove of a tracked finger, synthesize a `multitouch` event with updated `centroid`/`spread`/`rotation`.
- Pump the in-flight OngoingHandle's onMove with the multi-touch ctx.

### Task 6: port `viewport.pinchZoom`

Read `usePinchZoomTool`. The descriptor reads `ctx.multiTouch.spread` deltas to compute zoom factor; uses `view` dep to apply.

### Task 7: register + verify

Add 3 descriptors to `KIT_STANDARD_DESCRIPTORS`; bump count 35 → 38; verify; TODO update.

## Risks

- **Dispatcher state machine for multi-phase.** Real architectural extension; spend time on the design.
- **Pointer history memory.** `points?: Point2[]` can grow unbounded; cap or downsample.
- **Multi-touch coalescing.** Browser pointer events don't natively give "all current pointers"; dispatcher has to maintain its own map.

## What's next

After Phase 7.5, Phase 8.5 (viewport wrappers) can ship cleanly.
