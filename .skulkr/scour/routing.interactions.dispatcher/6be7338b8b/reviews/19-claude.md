## The in-flight cursor asks a param-following `Action.cursor` with no params, so a hover cursor that "holds for the gesture" changes once the drag starts
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:104 (createInFlightGestures.cursor)
- scenario: an action declares only `cursor: (p) => brushRing(p?.size ?? 8)` (the documented use: "a brush ring as wide as the brush"), bound with `opts.params: { size: 40 }`. Hovering, `hoverCursor.resolve` shows `actionCursor(r.action, r.params)` → a 40-px ring. On press the gesture opens, `hoverCursor.changed`/`resolve` switch to `dispatcher.inFlightCursor()`, which calls `actionCursor(action)` with `params` undefined → the ring snaps to 8 px for the whole stroke. `Action.activeCursor` docs say "with only `cursor` set, the hover hint holds for the duration of the gesture"; it does not when the cursor reads params, and a cursor function that dereferences `params` without `?.` throws from inside the hover listener. The two cursor reads answer one question two ways.
- evidence: read (action.ts:236-256 documents params-following cursors; inFlightGestures.open is never handed the binding's params; gestureRun.invokeAction has `match.binding` at hand)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts, packages/routing/src/interactions/dispatcher/gestureRun.ts
- size: function
- cause: binding params not recorded with the in-flight handle
- confidence: likely

## Listener teardown mid-drag leaves the pointer pinned in the view resolver, so later hover moves route to the old view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:300 (pointerInput.onCancel / dispose)
- scenario: a multi-view surface; the user presses in view B and is mid-drag when the attach effect re-runs (e.g. `keyboard`, `enabled` or a `channels` flag changes; the resolver comes from `views` and outlives the listener set). Teardown calls `pointer.dispose()` → `session.cancel()` → `onCancel`, which returns early on `core.disposed()` before `routeRelease(pointerId)`, and `dispose` never calls `resolver.end`. The pin `pointerId → B` stays. In the new listener set, mouse hover moves go through `onHoverMove → onMove → routeAt(e.pointerId, …)`, and `ViewResolver.at` honors the pin (viewResolver.ts:127), so every hover event is dispatched to view B's dispatcher with B's `clientToWorld` while the pointer is over view A, until the next press re-pins it. Should: release each held pointer's pin on dispose.
- evidence: read (viewResolver.ts:120-141 at/begin/end)
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: line
- cause: dispose skips routeRelease
- confidence: likely

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

<!-- done: 2 findings, files read: 44 -->
