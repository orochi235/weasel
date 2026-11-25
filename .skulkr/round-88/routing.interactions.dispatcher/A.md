# Audit round 88 — routing.interactions.dispatcher (reviewer findings)

## Teardown stops the redraw watch before it cancels the gestures, so an in-flight overlay is never cleared
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:160 (attachInput teardown)
- scenario: a marquee or lasso drag is in flight when the listener set is torn down while the canvas stays mounted (`enabled` goes false, or `keyboard`, `yieldKeys` or a `channels` switch changes and the effect re-binds). Teardown runs `redraw.stop()` and only then `d.cancelAll('cancel')`. The cancel's `notify()` reaches no subscriber, so `requestRedraw` is never called and the marquee/lasso overlay stays painted until something unrelated redraws. The file's own opening comment says the event that closes a gesture has to clear its overlay; the cancel should run before the watch is stopped (or a redraw should be requested after it).
- evidence: read
- severity: medium

## `lift` drops a stopped keyup only from `downKeys`; held-key gestures and keymap leaders stay engaged
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:181 (keyboardInput `lift`) and :152 (onKeyUp)
- scenario: the capture-phase window `keyup` listener (`lift`) exists because a widget can stop a keyup before it reaches the bubble listener. But it only runs `lifted(downKeys, e)`. Releasing `heldKeys` (`keyUp` → `releaseIn`) and the keymap leader (`keymaps.up` → `stack.release`) happens only in `onKeyUp`, which is registered in the bubble phase (or on `document` for `'page'`). Example: hold Space over the canvas (key-held hand engages), focus moves into a widget whose keyup handler calls `stopPropagation`, release Space → the hand gesture stays in flight, Space's later autorepeats stay suppressed, and a hold-opened keymap stays open until Space is pressed and released again or the window loses focus. The capture listener should release held keys and leaders the same way `onKeyUp` does.
- evidence: read
- severity: medium

## Modifier changes dispatch a hover on whichever view was routed last, not on the view under the pointer
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:184 (`onKey` → `hoverAt`)
- scenario: `hoverAt` uses `toWorld`, `target()` and `dispatch` for the routed view, but `onKey` never calls `routeAt` first. `moved` gets away with this because every move routes before it (pointer `onMove`, `listenHover`). Routed views go stale easily: a drag pinned to view A and released over view B leaves the route on A (`routeRelease` unpins it but does not re-route), as do `holdClock`'s timer and `takeNativeHold`. Pressing Shift without moving then dispatches `hover` on A's dispatcher, with a world point from A's camera for a pointer that is over B. Hover bindings in A fire, and B's do not. `resolve` (the cursor path) does `routeAt` first, so the two halves of one keystroke disagree.
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
