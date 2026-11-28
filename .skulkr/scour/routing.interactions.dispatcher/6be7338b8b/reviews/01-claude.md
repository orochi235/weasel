# Findings: routing.interactions.dispatcher

## A keyboard-off dispatcher that activates first on a shared surface keeps a keyboard-on one from ever taking the keys
- where: packages/routing/src/interactions/dispatcher/dispatchCore.ts:236 (createDispatchCore → activate)
- scenario: two dispatchers share one surface (the trial camera + instrument case the comment names). The first one attached has `keyboard: false`, so its `src.keys` is false. On a press, its `pointerdown` listener calls `activate(e)`, which adds the event to `CLAIMED` and then calls `actions.activate({ keys: false })`. `ActionsNode.activate` skips `takeKeys` when `keys` is false. The second dispatcher (keyboard on) sees `CLAIMED.has(event)` and returns, so nobody takes the keys. Pressing the surface never gives its shortcuts the keyboard. What should happen: a dispatcher that won't take keys shouldn't claim the event's key activation, or the claim should only be made when keys are actually taken.
- evidence: read (ActionsProvider.tsx:238 `if (opts?.keys !== false) takeKeys(this)`)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/dispatchCore.ts
- size: line
- cause: claim taken regardless of whether keys are taken
- confidence: likely

## `isEmptyOngoingHandle` treats a handle with only `onWheel` or `cursor` as empty, so the dispatcher drops it
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:118 (isEmptyOngoingHandle)
- scenario: a held-key action returns `{ onWheel }` from `start`, for "hold a key and scroll to scrub" (the case `OngoingHandle.onWheel` documents). It could also return `{ cursor, subscribe }` to show a mode cursor while the key is held. `isEmptyOngoingHandle` only checks `onMove`, `onEnd`, `overlay`, `previewIds` and `previewPose`, so `invokeAction` reports `'empty-handle'`. The walk then falls through to the next candidate and the handle is never put in flight, so its `onWheel` and `cursor` are never read. `uiOngoing.begin` returns `null` for the same handle. What should happen: any engaged member (`onWheel`, `cursor`, `subscribe`, `previewData`, `previewOpaqueIds`, `kind`) counts as engagement.
- evidence: read (OngoingHandle in actions/invoker.ts:213-334)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: incomplete emptiness predicate
- confidence: likely

## A press in a nested surface without the pointer channel is run by the outer dispatcher, but the outer never activates for it
- where: packages/routing/src/interactions/dispatcher/dispatchCore.ts:236 (activate) vs dispatchCore.ts:181 (pressedNestedIn)
- scenario: a surface with `channels.pointer: false` (for example a wheel-only or hover-only overlay) is nested inside a canvas. `holdSurface` counts it in `SURFACES` but not in `POINTER_SURFACES`. On a press inside it, the outer pointer channel's `takesPress` → `pressedNestedIn` sees no pointer surface, so the outer dispatcher runs the drag. The outer's `activate(e)` uses `innermostSurface`, which over `SURFACES` finds the nested element, so it returns without activating. The input scope then goes to the nested surface, or nowhere if the nested one has `keyboard: false`. Keys during the drag (Escape, Delete) don't reach the canvas running it. The wheel path has the same split: in `landedNestedIn` the outer handles the wheel in bubble but doesn't activate. What should happen: who activates for a press and who runs it are decided the same way.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/dispatchCore.ts
- size: function
- cause: activate and press ownership use different surface maps
- confidence: likely

## The hover cursor override can be written to one sink and cleared from another
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:50 (cursorOverride)
- scenario: `apply` and `clear` each pick `cursorSink() ?? ownSink` at call time. `cursorSink` is read live because the surface's sink arrives a render after the hook. So a hover before the sink exists writes the override through `ownSink` onto the canvas element's `cursor` style. After the sink arrives, every later `apply`/`clear` goes to the sink. `ownSink`'s override is never cleared, and the stale inline cursor stays on the element until something else overwrites the style. What should happen: an override switching sinks clears the one it last wrote to.
- evidence: read
- severity: low
- size: function
- cause: sink chosen per call, not remembered
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
