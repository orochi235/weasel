## isEmptyOngoingHandle reads a handle carrying only onWheel, cursor, subscribe, previewData or previewOpaqueIds as empty, so the gesture falls through
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:119 (isEmptyOngoingHandle)
- scenario: a key-held ongoing action whose `start` returns `{ onWheel, subscribe }` (scrub a value with the wheel while a key is held, no end work) or `{ previewData }` (a data-only preview, which `OngoingHandle` documents as an alternative to `previewPose`). `invokeAction` and `uiOngoing.begin` treat it as "declined at runtime": the walk falls through to the next candidate, or `beginUiOngoing` returns null, and the handle never goes in flight, so its `onWheel` never claims a wheel and its preview never shows. It should count as engaged, because `OngoingHandle` (actions/invoker.ts:237-333) gives each of those members meaning while the handle is in flight.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness check lists 5 of the handle's in-flight members
- confidence: likely

## The hover cursor's early returns leave the trace's live "what a press here would do" record pointing at an earlier position
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:113 (resolve)
- scenario: with the trace recording, the pointer rests on open canvas (so `setLive` explains a press there), then moves onto an affordance that declares a `cursor`. `resolve` returns at the affordance branch before reaching `setLive`, so `trace.live()` keeps explaining a press at the old point. The same happens once a button is held or a gesture is in flight. The devtools then show the old point's prediction for where the pointer is now. It should withdraw the record (`setLive(null)`) or explain the press at the current point on every path.
- evidence: read
- severity: low
- size: function
- cause: setLive only on the idle, no-affordance path
- confidence: sure

## An ongoing action started from a click, double click or context menu gets no drag.affordance, though the event carries the hit
- where: packages/routing/src/interactions/dispatcher/invocationCtx.ts:37 (pressDrag)
- scenario: an ongoing action bound to `contextmenu` or `click` over a handle (the event's `affordance` is filled by `underPointer` in contextMenu.ts and the recognizer) reads `ctx.drag.affordance` in `start` and finds `undefined`, because `pressDrag` copies the affordance only for `pointerdown`. `InvocationCtx` has no other place that carries the hit, so the action can't tell which handle it was started on. The immediate path gets it through `landed()` in inputFacts.ts, so the two paths answer the same question differently. The affordance should be copied for every kind `pressDrag` handles.
- evidence: read
- severity: low
- size: line
- cause: kind check narrower than the kinds handled
- confidence: likely

## With `keyboard: 'page'`, keydown is heard on the canvas's own document but keyup, blur and paste only on the global window
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:109 (attachInput)
- scenario: a canvas rendered into another document (an iframe or a `window.open` popout through a portal) with `keyboard: 'page'`. Its keydowns go to `canvas.ownerDocument`, so a key-held binding (Space for the hand tool) starts. The keyup listener is on the hook's global `window`, which never sees that document's keyup, and the blur listener is on the same wrong window. The held gesture and the `heldKeys` entry then stay engaged until something else cancels them. keyup and blur should be heard on `ownerDocument.defaultView`, the same window the keydown target belongs to.
- evidence: read
- severity: low
- size: line
- cause: one listener target derived from the canvas, the rest hard-wired to window
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

<!-- done: 4 findings, files read: 44 -->
