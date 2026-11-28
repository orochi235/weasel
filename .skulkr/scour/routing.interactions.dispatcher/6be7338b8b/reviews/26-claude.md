## A keystroke inside a held keymap is marked "closed a keymap", so its autorepeat is dropped
- where: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts:29 (keymapKeys.press)
- scenario: Hold a leader key that opens a keymap with `holdOpened`, then press and hold an arrow bound inside it (a nudge). The first input seen while held runs `markUsed`, which rebuilds `levels` and `notify()` rebuilds `snapshot` as new frozen objects. The keymap is still open, but `s.innermost() !== before` compares object identity, so it reads as changed and `quiet.set(physical)` runs. `consider` then `preventDefault`s and drops every repeat of that arrow, so holding it nudges once instead of repeating. The same happens on a `swallowed()` keystroke, which also calls `markUsed` and then notifies. It should only go quiet when the innermost keymap actually changed (compare id and stack depth, or check that `before` is no longer open).
- evidence: read (keymapStack.ts `markUsed`/`notify`/`settle`/`swallowed` rebuild snapshot objects without closing anything)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: line
- cause: identity compare of rebuilt snapshot
- confidence: likely

## A release after the hover has already left re-shows the cursor and painted pointer off the canvas
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:178 (released)
- scenario: With `controls: 'take'`, press a control near the canvas edge. That session is uncaptured until it passes `dragPx`. Move off the canvas before reaching the threshold: `pointerleave` fires, so `onLeave` runs `clear()` and sets `last = null`. Release outside. The session's `onEnd` calls `hover.released(e)`, which sets `last` to the outside point and schedules `refreshSoon`. That `refresh` routes, applies a hover cursor override, and calls `painted.setPointer` at a point outside the canvas, and it can set the trace's live prediction. No second `pointerleave` arrives to clear it, so the painted cursor and override stay until the pointer comes back. `moved` from session moves outside the canvas does the same. Expected: nothing is shown for a pointer that has left.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts, packages/routing/src/interactions/dispatcher/attachInput.ts
- size: function
- cause: `released`/`moved` ignore that the pointer left
- confidence: likely

## `uses` ignores the dispatcher it is told about and can unwatch one an event is running on
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:72 (attachInput, `uses`)
- scenario: `DispatchCoreSources.uses` is documented as "told of the dispatcher each event is about to run on", but the callback throws the argument away and runs `redraw.sync(src.dispatchers())`. An event dispatched with an explicit `on` (a held key's release through `releaseIn`, an `arrive`/`leave` over-key, a drop on its landing view) can target a view's dispatcher that is no longer in `views.targets()`, because the view unmounted while the key was held. `sync` then never subscribes to it, and it unsubscribes it if it was watched. The handle that release ends notifies nobody, so `requestRedraw` never runs and the gesture's overlay stays painted until something else redraws. It also rebuilds the dispatcher list and a Set on every hover move.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/attachInput.ts, packages/routing/src/interactions/dispatcher/dispatcherWatch.ts
- size: function
- cause: `uses` argument dropped
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

<!-- done: 3 findings, files read: 44 -->
