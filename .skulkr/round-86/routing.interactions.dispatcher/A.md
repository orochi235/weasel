# Audit round 86 — routing.interactions.dispatcher (blind reviewer)

## An OS drop or dragover on a nested dispatcher surface is ingested by both the inner and the outer surface
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:31 (onDragOver), :65 (onDrop)
- scenario: a dispatcher surface nested inside another (a panel or minimap element inside a canvas, both with `ingest` on). A file dragged over and dropped on the inner element bubbles to the outer one. Neither `onDragOver` nor `onDrop` checks `landedNestedIn` or `eventTaken`, as the wheel (`wheel.ts` capture/bubble), contextmenu (`eventTaken`), pinch (`eventTaken`) and pointer (`pressedNestedIn`) channels all do. So both surfaces resolve the dragover, both run `Action.preview` at the same time (two live previews), both toggle `weasel-dropover`, and on drop both call `itemsFromDataTransfer` and dispatch a `drop`: the file is inserted twice, once into each view's scene. Expected: the innermost surface that would take it handles it, and the outer leaves it, as with every other positional channel. A synchronous `landedNestedIn(core.canvas, e)` check (or one deferring to the inner surface's dragover verdict) fits, since the async materialization rules out `takeEvent` only for the drop's outcome, not for where it landed.
- evidence: read (inferred from the code; not run)
- severity: medium

## A `dispatcher` option that changes after the first render is silently ignored
- where: packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx:79 (useDispatcherIn)
- scenario: `dispatcherRef.current ??= dispatcherOpt ?? createDispatcher()` runs only while the ref is null. A host whose shared dispatcher arrives a render late (first render `dispatcher: undefined`, then the parent's instance), or one that swaps it, keeps pumping every event into the hook's private dispatcher. The parent's preview layer, which reads the shared one's `inFlight()`, then never sees a gesture, and `cancelAll` from the parent reaches nothing. Expected: the root target uses the current `dispatcher` option (re-binding as `canvasRef`/channels do), or the option is documented as read once.
- evidence: read
- severity: low

## Teardown leaves the trace's live explain and the painted cursor's pointer behind
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:139 (teardown), packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:103 (resolve), :172 (clear)
- scenario: while a trace is recording, every idle hover calls `ctx.trace.setLive(() => d.explain(press, ctx))`. Only `onLeave` withdraws it (`setLive(null)`) and calls `paintedCursor()?.clearPointer()`. The teardown calls `hover.clear()`, which only clears the cursor override. So when the listener set is re-bound or unmounted with the pointer still over the canvas (toggling `keyboard`/a channel, `enabled: false`, a host-supplied `trace` that outlives the hook), `trace.live()` keeps answering from the torn-down set's captured dispatcher and context: devtools show a stale "what a press here would do" record for a surface that no longer listens. The painted cursor is also left positioned at the last point. Expected: teardown withdraws the live explain and clears the painted pointer, as `onLeave` does.
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
