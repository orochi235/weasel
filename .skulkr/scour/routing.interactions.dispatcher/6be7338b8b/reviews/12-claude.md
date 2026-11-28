## In-flight cursor resolves a params-dependent `Action.cursor` with no params, unlike the hover cursor
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:104 (cursor)
- scenario: an action declares `cursor: (params) => …` (say an axis-locked drag showing `ew-resize` when its binding passes `{ axis: 'x' }`) and no `activeCursor`. On hover, `hoverCursor.resolve` calls `actionCursor(r.action, r.params)` with the binding's params and shows `ew-resize`. Once the drag starts, `inFlight.cursor()` calls `actionCursor(action)` with `params` undefined, so the cursor switches to whatever the function returns for no params. A function that reads a field (`p.axis`) throws instead, and that throw escapes from `inFlightCursor()` into the hover pump and the dispatcher-change listener. The same question, "what cursor does this action show for this binding", gets two different answers.
- evidence: read (`actionCursor` in actions/action.ts:285 is `typeof c === 'function' ? c(params) : c`. `open()` is never handed the binding's params.)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts, packages/routing/src/interactions/dispatcher/gestureRun.ts
- size: function
- cause: binding params not carried into the in-flight record
- confidence: sure

## Tearing down a listener set mid-drag leaves the pointer pinned in the view resolver, so later hovers route to the old view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:356 (dispose), with onCancel at :290
- scenario: on a multi-view surface the mouse (pointerId 1) is held in view A, so `routeDown` ran `resolver.begin(1, …)`. The listener set is re-bound mid-drag: `keyboard`, `yieldKeys` or a channel flag changes, or `enabled` toggles. Teardown sets `disposed` and calls `pointer.dispose()`. Each session's cancel reaches `onCancel`, which returns early on `core.disposed()` and never calls `routeRelease`. `views.resolver` belongs to the host and outlives the listener set, so pointer 1 stays pinned to A. In the new set, `onHoverMove` → `onMove` → `routeAt(1, …)` returns the pinned view A while the mouse hovers view B. Hover events, `over` key arrival and the cursor prediction run on A's dispatcher until the next press re-pins. A touch pointer's pin stays in the resolver's map for good.
- evidence: read (viewResolver.ts:125 returns the pinned view for any pointerId still in `pinned`; only `end` and `clear` remove it)
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: line
- cause: teardown skips routeRelease for held pointers
- confidence: likely

## A WebKit pinch re-routes on every change, so a pinch that drifts across views moves to another view's dispatcher mid-gesture
- where: packages/routing/src/interactions/dispatcher/channels/webkitPinch.ts:47 (pinchEventOf)
- scenario: on a surface with several views, a trackpad pinch starts over view A. `onGestureStart` probes A's bindings and claims the gesture. Each `gesturechange` calls `routeAt(null, cx, cy)` on its focal point. If the focal point crosses into view B, the remaining scale steps dispatch on B's dispatcher and zoom B, which never claimed the start. B may have no pinch binding at all, in which case the steps still get preventDefault'd because `pinchLive` is set. A pointer drag (`routeDown`) and a carry (`pinned` in carry.ts) are both pinned to the view they began in. The pinch, also a continuous gesture, is not.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/webkitPinch.ts
- size: function
- cause: no view pin for the pinch stream
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

<!-- done: 3 findings, files read: 44 -->
