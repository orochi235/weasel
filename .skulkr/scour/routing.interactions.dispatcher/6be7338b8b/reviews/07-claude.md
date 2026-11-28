## An ongoing handle that only claims wheels (or only shows a cursor) is treated as empty and falls through
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:119 (isEmptyOngoingHandle)
- scenario: a key-held action ("hold Z and wheel to scrub") returns `{ onWheel }` from `start`, with no `onMove`/`onEnd`, since a keyup ending it needs no callback. `isEmptyOngoingHandle` checks only `onMove`, `onEnd`, `overlay`, `previewIds` and `previewPose`, so the handle counts as a runtime bail. `invokeAction` returns `'empty-handle'`, nothing goes in flight, and `pumpGesture`'s wheel branch never sees it: the wheel goes to the zoom binding. The same happens to a handle carrying only `cursor()` or `subscribe`. The same check in `deferredStart` and `uiOngoing` turns such a handle into a `'pass'` or a `null`. It should count as engaged: `onWheel` is a documented `OngoingHandle` member.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness test omits onWheel/cursor
- confidence: likely

## One pointer leaving the canvas clears pointer-over while another pointer is still over it
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:205 (trackPointerOver)
- scenario: on a touch laptop the mouse rests over the canvas and the user holds a key for an `over` binding, which is engaged. A finger taps the canvas. When it lifts, the touch pointer's `pointerleave` runs `setPointerOver(false)` and `keys.leave()`, so the `over` binding is released and later keys are not heard as over, although the mouse never left. The same happens when a pen leaves while the mouse stays. The flag is one boolean for every `pointerId`, with no count or set of pointers that are over the canvas.
- evidence: read
- severity: low
- size: function
- cause: per-surface flag, not per-pointer
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
