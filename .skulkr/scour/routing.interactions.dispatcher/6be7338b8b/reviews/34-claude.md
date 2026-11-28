## A listener set torn down mid-drag leaves its pointers pinned in the view resolver
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:291 (onCancel), :356 (dispose)
- scenario: a surface with `views` has a mouse drag in progress (pointer 1 pinned by `routeDown` → `resolver.begin`), and the attach effect re-runs (e.g. `keyboard`, a channel flag or `yieldKeys` changes, or `enabled` toggles). Teardown sets `disposed`, then `pointer.dispose()` cancels each session; `onCancel` returns at `if (core.disposed()) return;` before `routeRelease(pointerId)`, and `dispose` never calls it either. The resolver (owned by the host, outliving the listener set) keeps `pinned[1]`. Every later hover move of that mouse goes through `onMove` → `routeAt(e.pointerId, …)` → `resolver.at(1, …)`, which returns the pinned view, so hover events, the hover cursor and `toWorld` resolve against the old view until the next press's `begin` overwrites the pin. Expected: teardown releases every pin it made.
- evidence: read (viewResolver.ts:125-133 `at` honors a pin; pointer.ts onCancel/dispose skip `routeRelease`)
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: line
- cause: early return on disposed skips the unpin
- confidence: likely

## With a keymap open, prediction asks `enabled()` once more than the dispatch it predicts
- where: packages/routing/src/interactions/dispatcher/predict.ts:22 (routed), :48 (resolveAll), :62 (resolveOnly), :88 (explain)
- scenario: a keymap is open and the hover cursor calls `resolveOnly(press)` per move. `routed` runs `routeThroughKeymap`, whose `run` callback already walks (asking `enabled()` on the candidates) to learn whether the pass fires; then `resolveOnly` / `resolveAll` / `explain` walk the same ranked context again, asking every gate a second time. `ResolveAllOptions.evaluateShadowed`'s doc promises that the default walk keeps `resolveOnly`'s `enabled()` call count identical to a real dispatch, which walks each pass once. Expected: keep the walk `routed` already made (its `Walked`) and reuse it rather than walking again.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/predict.ts
- size: function
- cause: walk result of the keymap pass discarded and recomputed
- confidence: sure

## A nested surface with `contextMenu: false` still loses its native menu to the surface around it
- where: packages/routing/src/interactions/dispatcher/channels/contextMenu.ts:19 (onContextMenu)
- scenario: an outer canvas with the contextmenu channel on contains an inner dispatcher surface that set `channels.contextMenu: false` ("Off leaves the browser's native menu in place"). A right-click inside the inner surface fires `contextmenu`, which bubbles to the outer listener. That listener calls `preventDefault()` unconditionally before anything else; `eventTaken` is false because the inner surface has no listener, so the outer also routes and dispatches the right-click on its own bindings. The native menu never opens over the inner surface. Wheel (`landedNestedIn`) and pointerdown (`pressedNestedIn`) both check for a nested surface; this channel doesn't. Expected: leave an event that landed in a nested surface without the channel to the browser, or at least don't suppress its default before knowing whether anything here takes it.
- evidence: read
- severity: low
- size: function
- cause: no nested-surface check before the unconditional preventDefault
- confidence: likely

## A two-finger pinch whose fingers land in different views drops the moves of the first finger
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:171 (createRecognizer `multiTouchInFlight`), :270 (onMove)
- scenario: on a surface with several views, finger A goes down in view 1 (pinned there by `routeDown`), and finger B goes down in view 2. B's press runs `claimForMultiTouch` while routed to view 2, so the multitouch handle opens on view 2's dispatcher. Then A moves: `onMove` → `routeAt(A, …)` routes to view 1, and the recognizer's `sink.multiTouchInFlight(2)` asks `core.dispatcherNow()` (view 1), which has nothing in flight, so no multitouch event goes out for A's moves. Only B's moves drive the pinch, so the spread and centroid update only when B moves. Expected: a multitouch gesture runs on the one view it opened in, whichever finger moves.
- evidence: read
- severity: low
- size: function
- cause: multitouch routed per finger's pin, not per gesture
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
