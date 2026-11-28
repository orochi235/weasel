## The hover cursor's override is left behind on the canvas when `cursorSink` arrives after the first hover
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:47 (cursorOverride)
- scenario: `cursorSink` is read live because the surface's sink arrives a render after the hook runs (per its doc). A hover before it arrives writes `ownSink.setOverride(spec)`, which sets the canvas element's `cursor`. Once the sink exists, every later `apply` and `clear`, including the teardown's `hover.clear()`, goes to `cursorSink()` only, so the own sink's override is never cleared. The canvas keeps the stale cursor written on that first hover. The sink's tool cursor shows only if it happens to write the same element's style. It should clear the sink it last wrote to.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: function
- cause: target sink re-resolved per call, prior target never cleared
- confidence: likely

## Mid-gesture cursor asks a function `Action.cursor` with no params, so it disagrees with the hover prediction
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:102 (cursor)
- scenario: an action whose `cursor` is a function of params, with no `activeCursor`, bound with `opts.params`. Idle hover resolves it with the binding's params (`actionCursor(r.action, r.params)` in hoverCursor.resolve). Once the gesture is in flight, `cursor()` calls `actionCursor(action)` with no params. The cursor then switches to the params-less answer (or `undefined`, which clears the override) the moment the press lands. The same question is answered two ways. The binding's resolved params should be kept with the handle at `open` and passed here.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts, packages/routing/src/interactions/dispatcher/gestureRun.ts
- size: function
- cause: binding params not carried into in-flight state
- confidence: likely

## `uses` ignores the dispatcher it is told about, so an explicit `on` dispatcher is unwatched (and unsubscribed) when it dispatches
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:72 (uses) / dispatchCore.ts:223 (dispatch)
- scenario: a held key goes down on a view's dispatcher, then that view leaves `views.targets()`. On keyup, `releaseIn` dispatches on `down.on`. `src.uses(d)` runs `redraw.sync(src.dispatchers())`, which leaves `d` out and drops its subscription if it had one. The release's `notify` reaches no `requestRedraw` and no `cursor.changed()`, so the held key's overlay or cursor stays until something else redraws. `DispatchCoreSources.uses` documents that it is "told of the dispatcher each event is about to run on". It should at least watch `d` for the dispatch it is about to run.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/attachInput.ts, packages/routing/src/interactions/dispatcher/dispatcherWatch.ts
- size: function
- cause: argument ignored; sync prunes the dispatcher in use
- confidence: likely

## A threshold-deferred drag shows its `activeCursor` while still below the threshold
- where: packages/routing/src/interactions/dispatcher/gestureRun.ts:283 (invokeAction) with deferredStart.ts:58
- scenario: a press on an action with `dragThresholdPx` (a move that only starts past N px) and an `activeCursor` (`grabbing`). The deferred proxy goes in flight at the press with its `action`. `inFlight.cursor()` falls through `handle.cursor?.()`, which is undefined before start, to `action.activeCursor`. A plain click shows `grabbing` from press to release even though the action never starts. Until `start` runs, the cursor should stay what it was.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/deferredStart.ts, packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: function
- cause: cursor read off the action, not the started handle
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
