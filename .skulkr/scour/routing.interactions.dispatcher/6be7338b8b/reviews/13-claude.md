## The hover cursor's fallback sink leaves its override on the canvas once the surface's own sink arrives
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:52 (cursorOverride)
- scenario: `cursorSink` is read live and may answer `undefined` on the first moves (the canvas handle arrives a render later, as the options say of `paintedCursor`). The first hover writes its cursor through `ownSink` onto the canvas element's `style.cursor`. Later moves and `clear()` go only to the surface's sink, so `ownSink` never runs `setOverride(null)` and never gives back what it wrote. The surface sink records the stale `ownSink` css as the element's `prior`, so clearing its own override restores the stale hover cursor. The cursor should return to the tool's cursor, or to none.
- evidence: read (cursorSink.ts `giveBack` restores `prior` only when the style still equals what that sink wrote)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: function
- cause: switching sinks without clearing the one written before
- confidence: likely

## Autorepeat stays swallowed for a held key whose gesture was ended under it
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:107 (consider)
- scenario: Space is held for the hand tool, so `heldKeys` has it. A tool switch or `cancelAll` (Escape, window-level cancel) ends that gesture while Space stays down. Each autorepeat then hits `heldKeys.has(physical)`, which calls `preventDefault` and returns, so the hold never re-engages and the page never sees the key until it is released. `followPointer.arrive` answers the same question with `stillHeld` (whether the gesture is still in flight) and presses such a key again. The two places decide "is this key still held" differently.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts, packages/routing/src/interactions/dispatcher/channels/overKeys.ts
- size: line
- cause: map presence used instead of in-flight check
- confidence: likely

## A keyboard peer whose window listener runs first is offered the same keystroke twice
- where: packages/routing/src/interactions/dispatcher/channels/keyPeers.ts:23 (passOn); packages/routing/src/interactions/dispatcher/channels/keyboard.ts:95 (onKeyDown)
- scenario: Two dispatchers share one surface. B attached its window keydown listener before A, and A holds the keys. B's `onKeyDown` runs first and finds the pointer over it, so it calls `consider(e, { held: false, over: true })`. If nothing handles the key, A's listener runs next and `passOn` calls B's `take`, which considers the same event again with `{ held: true, over: true }`. B's `over` bindings are matched again, their `enabled` gates run twice, and `keymaps.press` records one keystroke twice. Only the peers that have not yet heard the event should be offered it.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: function
- cause: `taken` marks only events offered via take, not events already considered by the own listener
- confidence: likely

## A drop whose materialization rejects is swallowed with an unhandled rejection
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:94 (onDrop)
- scenario: `onDrop` calls `preventDefault` and `takeEvent` before `itemsFromDataTransfer(dt)` resolves. If that promise rejects (for example, reading a file fails), the `.then` has no rejection handler. The rejection goes unhandled, nothing dispatches, and the page's own drop handling has already been suppressed. A failed read should be caught and reported the way the dispatcher reports thrown invokers.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/ingest.ts
- size: line
- cause: missing catch on fire-and-forget promise
- confidence: likely

## A wheel over a nested surface with its wheel channel off is handled by the outer surface without activating it
- where: packages/routing/src/interactions/dispatcher/dispatchCore.ts:206 (activate); packages/routing/src/interactions/dispatcher/channels/wheel.ts:24 (onWheel)
- scenario: An inner dispatcher sets `channels.wheel: false` but is still counted by `holdSurface`. A wheel landing in it reaches the outer surface's bubble listener (`landedNestedIn`), and the outer dispatcher dispatches and claims it. `core.activate(e)` refuses, though, because the event landed in the inner surface. No one activates a scope for that wheel, so the keys stay wherever they were, even though the outer surface acted on the input. Activation should go to the surface that actually handles the wheel.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/dispatchCore.ts
- size: function
- cause: activation decided by landing surface, not by the surface that listens for the channel
- confidence: likely

## DispatchRecord.matched is not in matcher order when a claim barred bindings
- where: packages/routing/src/interactions/dispatcher/buildDispatchRecord.ts:73 (buildDispatchRecord)
- scenario: `DispatchRecord.matched` is documented as "every binding whose spec matched the input, in matcher order". The code builds it as `[...r.ordered, ...r.barred]`, so every barred binding comes after all admitted ones, whatever its scope tier and specificity. It is also listed after the reordering done by `preferViewScoped` and `preferContextual`. A devtools reader comparing positions sees a hotkey-tier barred binding below an ambient admitted one.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/dispatchRecord.ts
- size: line
- cause: doc/code mismatch on ordering
- confidence: sure

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
