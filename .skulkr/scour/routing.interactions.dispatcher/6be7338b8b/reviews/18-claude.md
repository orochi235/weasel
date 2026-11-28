## Tearing down a listener set mid-press leaves the pointer pinned in the view resolver, so later hovers route to the stale view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:345 (pointerInput → dispose), with onCancel at :262
- scenario: on a multi-view surface, press in view A, then rebind the listeners while the button is down (`keyboard`, `enabled` or a channel flag changes, or the canvas remounts). attachInput sets `disposed = true` and then calls `pointer.dispose()`, which cancels each session. `onCancel` returns at once because `core.disposed()` is true, so `routeRelease(pointerId)` (→ `resolver.end`) never runs, and `dispose` does not call it either. The `views.resolver` outlives the listener set (it comes from `viewsRef`), so pointer 1 stays pinned to A. On the new listener set, every unpressed mouse move goes `onHoverMove → onMove → routeAt(e.pointerId, …)`, and `resolver.at` returns the pinned view (`viewResolver.ts:125-133`). So `hover` events are dispatched on A's dispatcher, with A's `clientToWorld`, while the pointer is over B, until the next press re-pins it. Touch pointer ids are unique, so each such teardown also leaves one more entry in the resolver's `pinned` map. Expected: the teardown unpins every pointer it held.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: line
- cause: unpin skipped on disposed teardown
- confidence: likely

## `explain` reports a winner for an input an open keymap withholds or that Escape spends closing it
- where: packages/routing/src/interactions/dispatcher/predict.ts:84 (explain), with routed at :20
- scenario: while a keymap is open, `routeThroughKeymap` answers without calling `run`. A plain Escape closes the innermost keymap (`'handled'`), and the second half of a keystroke already ruled `'taken'` gets `'unhandled'`. Then `routed` falls back to `{ ...ctx, keymapPass: 'only' }`, and `explain` walks the keymap's own bindings in that context. If the keymap binds Escape (or the withheld key), the record's `ranked` shows it as `would-fire`, `fired` names its action, and the record's `outcome` is `route.outcome`. A real dispatch never runs that binding. `resolveOnly`/`resolveAll` return null/[] for the same input (`!route.fires`), so the trace's live record and `explain` disagree with them. Expected: when the route does not fire, the record shows no winner.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/predict.ts
- size: function
- cause: walk run in fallback ctx regardless of route.fires
- confidence: likely

## The hover's live trace prediction is left stale when the cursor resolves from an affordance or an in-flight gesture
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:126 (resolve)
- scenario: with a trace recording, the pointer hovers empty canvas, so `setLive` holds an explain for a press there. It then moves onto an affordance that has a `cursor`, or a gesture starts. `resolve` returns early at the affordance branch or the in-flight branch, before `setLive`. `trace.live()` keeps answering with the explain closure from the earlier point: a press at the old world point, in the old view. The closure's ctx also reads `depRegistry`/`getRuleCtx` through the core's routed-view thunks, so it now evaluates against whichever view is routed when devtools reads it, while still naming the old `viewId`. Expected: the live record is refreshed (or withdrawn) on every resolve.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: line
- cause: setLive only on idle no-affordance path
- confidence: likely

## The hover cursor asks only the routed view's dispatcher whether a gesture is in flight
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:128 (resolve), :193 (changed)
- scenario: on a surface with views, a key-held ongoing gesture starts on view A's dispatcher (for example an `over` key binding), and the pointer, with no button held, then moves into view B. `resolve` routes to B, reads `dispatcherNow().inFlight().size === 0`, and shows B's idle prediction instead of A's `inFlightCursor`. `changed()` likewise sets `flying` from B's dispatcher alone, so when A's gesture ends nothing triggers `refreshSoon`. Expected: in-flight state is read across `src.dispatchers()` (or the dispatcher that holds the gesture), as `cancelAll` on teardown already does.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts, packages/routing/src/interactions/dispatcher/attachInput.ts
- size: function
- cause: per-view in-flight check
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
