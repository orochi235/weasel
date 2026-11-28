# Findings: routing.interactions.dispatcher

## `explain` reports a winner for inputs an open keymap handles without running any binding
- where: packages/routing/src/interactions/dispatcher/predict.ts:42 (routed), :86 (explain)
- scenario: A keymap is open and binds plain Escape, and nothing is in flight. `routeThroughKeymap` closes the keymap and returns `'handled'` without ever calling `passes.run`, so `last` stays null and `routed` falls back to `{ ...ctx, keymapPass: 'only' }`. `explain` then ranks and walks Escape against the keymap's own bindings and records `fired: <keymap's Escape action>` with a `would-fire` step. A real dispatch only closes the keymap. The same thing happens for a keystroke whose other half the keymap already took (`verdict === 'taken'`, outcome `'unhandled'`), where the record can show a `fired` action beside `outcome: 'unhandled'`. `resolveOnly` and `resolveAll` are correct because they check `route.fires`; only `explain` (the devtools record and the hover's live trace) gets it wrong.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/predict.ts
- size: function
- cause: fallback ctx walked when no pass ran
- confidence: likely

## A handle that declares only `onWheel` (or only `cursor`/`subscribe`) counts as empty and is thrown away
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:119 (isEmptyOngoingHandle)
- scenario: An ongoing action's `start` returns `{ onWheel: (ctx) => true }`, for example a held key that takes the wheel while it is down (`OngoingHandle.onWheel` is documented as a way to claim wheels in flight). `isEmptyOngoingHandle` checks only `onMove`, `onEnd`, `overlay`, `previewIds` and `previewPose`, so `invokeAction` treats the handle as a runtime decline: it drops the gesture facts, returns `'empty-handle'`, and the walk falls through to the next candidate. The handle is never put in flight, so its `onWheel` never runs. `uiOngoing.begin` and `deferredStart` use the same check and are affected the same way.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness check omits newer handle members
- confidence: likely

## The hover cursor reads in-flight state from the routed view's dispatcher only
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:121 (resolve), :197 (changed)
- scenario: A surface has several views. A key-held gesture (Space for hand) starts on the root dispatcher, then the pointer moves over view B with no button held. `resolve` routes to B and checks `dispatcherNow().inFlight().size`, which is B's and is 0. So it shows B's idle predicted cursor instead of the root gesture's `activeCursor`. `changed()` has the same gap: a notify from the root dispatcher reads B's `inFlight` and does not apply the gesture's cursor.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts, packages/routing/src/interactions/dispatcher/dispatchCore.ts
- size: function
- cause: in-flight check scoped to routed dispatcher
- confidence: likely

## The trace's live prediction goes stale whenever `resolve` returns early
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:121-142 (resolve)
- scenario: With a trace recording, the pointer rests over empty canvas, so `setLive` holds the press prediction for that point. The pointer then moves onto an affordance that has a `cursor`, or a gesture starts. `resolve` returns before reaching `setLive`, so `trace.live()` keeps answering for the old point until the pointer leaves the canvas. The same happens if recording stops: a `setLive` closure installed while recording is never withdrawn.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: line
- cause: setLive only on one branch
- confidence: likely

## A drop whose item materialization rejects leaves an unhandled promise rejection
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:97 (onDrop)
- scenario: An OS file drop where `itemsFromDataTransfer` rejects (for example, a file read that fails). The drop has already been taken and `preventDefault` called, and `void ...then(...)` has no rejection handler. The page gets an `unhandledrejection` and the drop silently does nothing, with no diagnostic in the dispatcher's own `weasel dispatcher:` style.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/ingest.ts
- size: line
- cause: missing catch on async ingest
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

<!-- done: 5 findings, files read: 44 -->
