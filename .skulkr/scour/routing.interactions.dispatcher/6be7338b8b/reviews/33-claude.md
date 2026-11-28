# Findings: routing.interactions.dispatcher

## A key the holder declines is considered twice by a peer whose own listener already ran it for its `over` bindings
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:93 (onKeyDown / take)
- scenario: two dispatchers share one surface (a trial camera on the instrument's pane), and the peer's window `keydown` listener was attached first, so it runs before the holder's. The pointer is over the surface. The peer's `onKeyDown` runs `consider(e, { held: false, over: true })` and dispatches the keystroke to its `over` bindings. The holder then declines the key and calls `passOn`, which runs the peer's `take`, and that dispatches the same keystroke again with `{ held: true, over: true }`. The peer's `over` bindings are reached a second time. An immediate `over` action whose `run` returns `'pass'` runs twice for one keystroke, and the trace records two dispatches. The `taken` WeakSet only stops the peer's listener when it runs after `take`, not before. Expected: each channel considers a keystroke once. A `take` arriving after the channel's own listener ran should dispatch only to the bindings the first pass left out (`held`, non-`over`).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: function
- cause: the dedup set is written by `take` only, not by the channel's own pass
- confidence: likely

## The hover cursor's `changed` decides "in flight" from the routed view's dispatcher alone
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:191 (changed)
- scenario: `attachInput` subscribes `cursor.changed()` to every live dispatcher (root and each view). `changed` reads only `dispatcherNow().inFlight()`. A gesture can start on a view other than the routed one: a held key's release or start goes through `releaseIn`/`heldOn` on the dispatcher that took the keydown, after hover has routed elsewhere. Start case: view B's notify finds view A routed with nothing in flight, so `flying` stays false and B's `inFlightCursor` (`grab`) is never applied. End case: if `flying` was already false, the end schedules no idle refresh, and the cursor stays as it was until the pointer moves. Expected: `flying` reflects whether any watched dispatcher has a gesture in flight, or the dispatcher that notified.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts, packages/routing/src/interactions/dispatcher/attachInput.ts
- size: function
- cause: notify does not say which dispatcher changed; only the routed one is read
- confidence: likely

## `resolveAll` labels a below-the-winner ineligible candidate `shadowed`, though its docs promise `ineligible`
- where: packages/routing/src/interactions/dispatcher/walk.ts:219 (verdictsOf)
- scenario: a binding's action has an `eligible` rule that is false, and it ranks below the candidate that would fire. With the default `evaluateShadowed: false`, `verdictsOf` gives it `{ kind: 'shadowed' }`. But `Dispatcher.resolveAll`'s docs (dispatcherApi.ts:186-188) say "candidates that `resolveOnly`'s walk would filter out are kept here and labeled `ineligible` instead". `ResolvedCandidate.verdict` defines `shadowed` as "never asked", yet `rank` has already evaluated this rule (`holds`, via `preferContextual`), and the answer was false. An inspector built on `resolveAll` shows "shadowed" for a binding that could never fire in this context, so the reader concludes the wrong thing about it. Either the docs or the code is wrong; the two say different things.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/walk.ts, packages/routing/src/interactions/dispatcher/dispatcherApi.ts
- size: line
- cause: docs and verdict logic disagree on ineligible-below-winner
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

<!-- done: 3 findings, files read: 44 -->
