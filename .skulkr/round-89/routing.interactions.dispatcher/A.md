## Tearing down the pointer channel mid-drag leaves the pointer pinned in the view resolver, so later hover moves route to the old view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:356 (pointerInput.dispose)
- scenario: A multi-view surface (`views` set; its `ViewResolver` outlives the listener set). The mouse (pointerId 1) presses in view A, so `routeDown` calls `resolver.begin(1, …)`, which pins it to A. While it is held, the listener set re-binds (an effect dependency such as `keyboard`, `channels.*` or `yieldKeys` changes) or `enabled` goes false. `dispose()` cancels every session, but `onCancel` returns early once `core.disposed()` is true, so `routeRelease(1)` never runs and `resolver.end(1)` is never called. After the release, every `onHoverMove` goes through `onMove` → `routeAt(e.pointerId, …)`. `viewResolver.at` returns the pinned view for a pinned id (packages/core/src/domains/viewports/viewResolver.ts:127), so hover, the hover cursor and the `world` points are computed in view A wherever the mouse actually is, until the next press re-pins it. Expected: teardown unpins every pointer it held (`routeRelease` for each held session, or `resolver.end`).
- evidence: read
- severity: medium

## The hover cursor's live trace prediction goes stale over an affordance with a cursor, and during a gesture
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:121 (resolve)
- scenario: Devtools is recording (`trace.recording()`). The pointer rests over open canvas, so `setLive` is set to explain a press there. It then moves onto a resize handle whose affordance has a `cursor`. `resolve` returns at the affordance branch (or at the in-flight branch while a pointer is held) before reaching `ctx.trace.setLive(...)`, so `trace.live()` keeps explaining the earlier point, in that point's routed context. The trace panel shows a prediction for a point the pointer has left. Expected: refresh `setLive` for the current point, or withdraw it (`setLive(null)`), on every path through `resolve`.
- evidence: read
- severity: low

## A release dispatched on a dispatcher no longer among the live ones unsubscribes it from redraws before its gesture ends
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:72 (createDispatchCore `uses`)
- scenario: A held key's down was taken by view B's dispatcher (`HeldKey.on`), and view B then leaves `views.targets()`. On keyup, `releaseIn` dispatches on `down.on`. `core.dispatch` first calls `src.uses(d)`, which ignores `d` and runs `redraw.sync(src.dispatchers())`. Since B is not in that list, `sync` unsubscribes it. The `notify` from ending B's gesture then reaches no listener, so `requestRedraw` and the cursor's `changed()` never run for that ending, and an overlay the gesture drew can be left on screen until something else redraws. Expected: `uses(d)` keeps `d` watched for the event it is about to run.
- evidence: read
- severity: low

## Files read
packages/routing/src/interactions/dispatcher/attachInput.ts
packages/routing/src/interactions/dispatcher/buildDispatchRecord.ts
packages/routing/src/interactions/dispatcher/channels/carry.ts
packages/routing/src/interactions/dispatcher/channels/contextMenu.ts
packages/routing/src/interactions/dispatcher/channels/dropPreview.ts
packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
packages/routing/src/interactions/dispatcher/channels/ingest.ts
packages/routing/src/interactions/dispatcher/channels/keyPeers.ts
packages/routing/src/interactions/dispatcher/channels/keyboard.ts
packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
packages/routing/src/interactions/dispatcher/channels/listeners.ts
packages/routing/src/interactions/dispatcher/channels/modal.ts
packages/routing/src/interactions/dispatcher/channels/overKeys.ts
packages/routing/src/interactions/dispatcher/channels/pointer.ts
packages/routing/src/interactions/dispatcher/channels/webkitPinch.ts
packages/routing/src/interactions/dispatcher/channels/wheel.ts
packages/routing/src/interactions/dispatcher/deferredStart.ts
packages/routing/src/interactions/dispatcher/dispatchCore.ts
packages/routing/src/interactions/dispatcher/dispatchRecord.ts
packages/routing/src/interactions/dispatcher/dispatchTrace.ts
packages/routing/src/interactions/dispatcher/dispatcher.ts
packages/routing/src/interactions/dispatcher/dispatcherApi.ts
packages/routing/src/interactions/dispatcher/dispatcherWatch.ts
packages/routing/src/interactions/dispatcher/gestureDispatcherOptions.ts
packages/routing/src/interactions/dispatcher/gestureFacts.ts
packages/routing/src/interactions/dispatcher/gestureIds.ts
packages/routing/src/interactions/dispatcher/gestureRun.ts
packages/routing/src/interactions/dispatcher/handOff.ts
packages/routing/src/interactions/dispatcher/inFlightGestures.ts
packages/routing/src/interactions/dispatcher/inputFacts.ts
packages/routing/src/interactions/dispatcher/invocationCtx.ts
packages/routing/src/interactions/dispatcher/keymapRoute.ts
packages/routing/src/interactions/dispatcher/longPressState.ts
packages/routing/src/interactions/dispatcher/matcher.ts
packages/routing/src/interactions/dispatcher/predicates.ts
packages/routing/src/interactions/dispatcher/predict.ts
packages/routing/src/interactions/dispatcher/ranking.ts
packages/routing/src/interactions/dispatcher/testing/dispatcherStubs.ts
packages/routing/src/interactions/dispatcher/uiOngoing.ts
packages/routing/src/interactions/dispatcher/underPointer.ts
packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx
packages/routing/src/interactions/dispatcher/useKeyLease.ts
packages/routing/src/interactions/dispatcher/usePageActions.ts
packages/routing/src/interactions/dispatcher/walk.ts

<!-- done: 3 findings, files read: 44 -->
