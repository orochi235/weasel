## A drop whose items fail to materialize leaves an unhandled promise rejection
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:91 (onDrop)
- scenario: an OS drop of a file the browser cannot read (a permission error, a directory entry, a file removed mid-drag) makes `itemsFromDataTransfer(dt)` reject. The `.then` has no rejection handler and the call is `void`ed, so the page gets an `unhandledrejection` and the drop does nothing with no diagnostic. The default was already `preventDefault`ed and the event marked taken, so nothing else handles it either. It should catch the error and report it the way the other channels report a throwing action (`console.error('weasel dispatcher: …')`).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/ingest.ts
- size: line
- cause: promise chain without catch
- confidence: likely

## A canvas-less dispatcher misses React Aria-style modals, so page keys fire behind the dialog
- where: packages/routing/src/interactions/dispatcher/channels/modal.ts:33 (inModalOver)
- scenario: a modal that marks the page `inert`/`aria-hidden` instead of setting `aria-modal` (React Aria, as the doc comment says) counts as modal only through `canvas !== null && hiddenBehind(canvas)`. A dispatcher with no canvas (`usePageActions`, or any `canvasRef` resolving to null with `keyboard: 'page'`) passes `canvas === null`, so `inModalOver` returns false. A shortcut key pressed while focus is on a button inside such a dialog then reaches the page's actions behind it. An `aria-modal="true"` dialog or a native modal `<dialog>` does block the same dispatcher, so whether a modal blocks page keys depends on how the dialog library marks it. With no canvas, the check should fall back to whether the dialog's surroundings are inert or hidden (for example, whether the document body outside the dialog is).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/modal.ts
- size: function
- cause: inert check keyed only on the canvas
- confidence: likely

## A wheel during a drag reaches only the dispatcher of the view under the pointer, not the one running the drag
- where: packages/routing/src/interactions/dispatcher/channels/wheel.ts:33 (onWheel), packages/routing/src/interactions/dispatcher/gestureRun.ts:166 (pumpGesture)
- scenario: on a surface with several views, start a drag in view A, move the pointer over view B and scroll. `onWheel` routes with `routeAt(null, …)` to B, so `dispatch` runs on B's dispatcher. `pumpGesture` offers the wheel to `inFlight.handles` of that dispatcher only, so A's in-flight handle never sees it and its `onWheel` claim (meant to let a drag consume the wheel) is skipped; the wheel zooms or scrolls B under a live drag in A instead. A held pointer stays pinned to its view for every other channel (`routeAt(pointerId…)`), but the wheel isn't pinned.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/wheel.ts, packages/routing/src/interactions/dispatcher/dispatchCore.ts
- size: function
- cause: wheel routed by position, ignoring pinned in-flight drags
- confidence: likely

## Hover facts go stale through a press nothing hears, so the hover-off and the next `from` name the pre-press spot
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:181 (moved / onLeave)
- scenario: when a pointer is held and no binding hears held hovers, `moved` skips `hoverAt`, so `facts` keeps the position and hit from before the press. If the drag then ends with the pointer outside the canvas, `pointerleave` runs `onLeave`, which dispatches `hover { off: true }` at the old `facts.at`, with `where` (affordance, body) from before the press. A hover binding tracking enter and leave gets told the pointer left from a place it last saw minutes ago. In the same way, the first hover after release carries a `from` naming the pre-press hit rather than where the pointer actually came from. `facts` should be dropped (or refreshed) when a press begins, or at release.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: function
- cause: facts not invalidated while unheard
- confidence: likely

## With the pointer channel off, the hover cursor is cleared for every press and isn't restored at release
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:180 (listenHover), packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:115 (resolve)
- scenario: `channels: { pointer: false, hover: true }`. When a press on the element is held, `pointersHeld()` (from `heldPointers`) is above 0, so each move's `resolve` applies `inFlightCursor()`. No gesture is in flight, so that is `null`, and the hover cursor is cleared for the whole press. `listenHover` attaches no `pointerup` listener, so `hover.released` never runs and nothing refreshes the cursor after the release. The idle cursor (an affordance's, or the predicted drag's) stays gone until the pointer next moves. The pointer channel avoids this by calling `released` from `onUp`.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/attachInput.ts
- size: line
- cause: hover-only mode has no release hook
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
