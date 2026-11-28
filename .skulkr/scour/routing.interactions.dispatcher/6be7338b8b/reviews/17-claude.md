## An ongoing handle whose only callbacks are `onWheel`, `previewData`, `previewOpaqueIds`, `cursor` or `subscribe` is treated as a declined (empty) handle
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:118 (isEmptyOngoingHandle)
- scenario: a key-held action (hold a key, scrub a value with the wheel) returns `{ onWheel }` from `start`, which `OngoingHandle.onWheel` documents as a supported shape. `invokeAction` calls `isEmptyOngoingHandle`, which checks only `onMove`/`onEnd`/`overlay`/`previewIds`/`previewPose`, so it gets `'empty-handle'`. The walk falls through to the next candidate and the handle never goes in flight, so `pumpGesture`'s wheel branch never sees it. A handle carrying only `previewData` (a data-only preview) is dropped the same way. The same predicate is used by `deferredStart` and `uiOngoing.begin`, so a UI-driven handle like that returns `null`.
- evidence: read (OngoingHandle fields in packages/routing/src/interactions/actions/invoker.ts:222-333 against the predicate)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness test lists only some handle members
- confidence: likely

## A deferred-start drag shows the action's active cursor and counts as engaged before its action has started
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:94 (cursor), packages/routing/src/interactions/dispatcher/gestureRun.ts:271 (invokeAction)
- scenario: an action with `dragThresholdPx` is pressed. `deferredStart`'s proxy goes in flight at once with `inFlight.open(..., action)`. Before the threshold, `handle.cursor` reads undefined, so `cursor()` falls back to `action.activeCursor` (for example `grabbing`), and the hover pump applies it for a plain click that never starts the action. If `start` then declines and the drag is handed off, the wrong cursor has already shown. `engagedOwners` likewise reports the owner as engaged for a gesture that may never start.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/deferredStart.ts, packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: function
- cause: deferred handle registered with its action before start
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
