# Audit round 85 — routing.interactions.dispatcher (blind reviewer)

## Keys the keydown filters refuse are still pressed for `over` bindings when the pointer arrives
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:93 (onKeyDown), packages/routing/src/interactions/dispatcher/channels/overKeys.ts:48 (followPointer.arrive)
- scenario: `downKeys.set` runs before every filter, so a key held in a text field (non-chord), on a focused control that owns it (`focusedControlOwnsKey`, e.g. Space on a focused button), inside an open ARIA menu, or inside a modal dialog over the canvas is recorded. When the pointer then enters the canvas, `arrive` dispatches a `keyHeld` down for it with `OVER_ONLY` and none of those filters, so an `over` binding (e.g. Space-to-pan while over) engages for a key the focused control or modal owns. The comment justifies only the "another surface took it" (`defaultPrevented`) case; the field/control/menu/modal cases should not be replayed. Same map also keeps a key whose keyup a focused widget stopped from propagating, and replays it on every later arrival until that key's next keyup reaches window.
- evidence: read
- severity: medium

## A held-key entry outlives its gesture and blocks re-engaging on the next arrival
- where: packages/routing/src/interactions/dispatcher/channels/overKeys.ts:49,66 (followPointer.arrive/leave); packages/routing/src/interactions/dispatcher/channels/keyboard.ts:133 (press)
- scenario: An `over` keyHeld gesture is ended by something other than its keyup (tool switch → `cancelAll`, Escape, a `cancelAll` from an action). `heldKeys` still holds the key. On `leave`, `releaseIn(..., OVER_ONLY)` reaches `pumpGesture`, where `openedOver(id)` is now false (forgotten), so `reach.held` (false) decides → `'unhandled'` and the entry is not deleted. On the next `arrive`, `held.has(physical)` skips the key, so holding the key and re-entering the canvas never re-engages the `over` binding until the key is released and pressed again. The same happens for an entry recorded because an immediate `keyHeld` binding returned `'handled'` with nothing put in flight.
- evidence: read
- severity: low

## The hover cursor keeps the in-flight cursor after a gesture ends with no input to carry it
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:166 (changed)
- scenario: `changed()` runs on every dispatcher notify but only applies the in-flight cursor while `inFlight().size > 0`; when the notify is the last gesture leaving flight it does nothing. A gesture ended without a pointer release or key event over a resting pointer — window blur (`cancelHeld` → session cancel, which never calls `hover.released`), a `cancelAll` from a toolbar/programmatic tool switch, a UI handle or action that ends the gesture from a timer — leaves e.g. `grabbing` shown until the pointer next moves. It should re-resolve (as `released` does) when the set empties.
- evidence: read
- severity: low

## Immediate params drop `bodyKind` for pointerdown, longpress and hover
- where: packages/routing/src/interactions/dispatcher/inputFacts.ts:143-153 (carried)
- scenario: `ImmediateParams` says each field is present for the events that carry it. `pointerdown` and `longpress` events carry `bodyKind` (and `clientX/Y`) from `underPointer`, and `hover` carries `bodyKind`, but `carried` passes only `bodyTarget` for them, while `contextmenu` and `carry` pass `bodyKind` too. An immediate action bound to `pointerDown` / `longPress` / `hover` on a `kind:<k>` target cannot read which kind it hit from `params.bodyKind`; the same decision is answered two ways across event kinds.
- evidence: read
- severity: low

## `ctx.screen` is canvas-local for wheel and pinch, client pixels for everything else
- where: packages/routing/src/interactions/dispatcher/invocationCtx.ts:22 (clientPoint); channels/wheel.ts:42, channels/webkitPinch.ts:52
- scenario: The wheel and pinch channels put canvas-local coordinates in the event's `clientX/clientY`; `clientPoint` (documented "the pointer in client pixels") copies them into `ctx.screen`. An ongoing action (or a gesture's `onWheel`) reading `ctx.screen` on a wheel gets a point offset by the canvas's position from the one a pointer event at the same spot gives.
- evidence: read
- severity: low

## A drop whose items fail to materialize is an unhandled rejection
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:79 (onDrop)
- scenario: `void itemsFromDataTransfer(dt).then(...)` has no rejection handler; a file read that fails (permission, a directory entry, a revoked file) surfaces as an `unhandledrejection` with no dispatcher-prefixed diagnostic, unlike every other failure path in the channel, which logs `weasel dispatcher: ...`.
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

<!-- done: 6 findings, files read: 44 -->
