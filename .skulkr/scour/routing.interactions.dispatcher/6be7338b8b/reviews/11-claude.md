# Findings: routing.interactions.dispatcher

## The hover cursor's fallback sink keeps the cursor it wrote once a host sink arrives
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:49 (cursorOverride)
- scenario: `cursorSink` and `paintedCursor` are read live, because the host's sink arrives a render after the hook. If a hover moves before the sink arrives, `apply` writes through `ownSink`, which sets `canvas.style.cursor` and may set a painted override. Every later `apply` and `clear` goes to `cursorSink()`, so `ownSink.setOverride(null)` never runs. The host sink then records the stale value as its `prior` (`written.prior` in cursorSink.ts) and puts it back when its own override clears. The result is a cursor (for example `grab`) stuck on the canvas, or a painted override left set, after the hover cursor is withdrawn. What should happen: when the target changes from `ownSink` to the host sink, `ownSink` is cleared first. `clear` should also reach whichever sink was written.
- evidence: read (cursorSink.ts `giveBack` / `written.prior` read to confirm the restore path)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: function
- cause: sink chosen per call, not tracked
- confidence: likely

## `claimKeys` takes the keys even with the keyboard channel off
- where: packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx:150 (useDispatcherIn, the claimKeys effect)
- scenario: a mount with `keyboard: false, claimKeys: true` calls `actions.activate()` with no options, and the default is `keys: true`. This takes the page's keys away from another canvas, but this dispatcher binds no key listeners, so the keys go nowhere. Every pointerdown and wheel activation passes `{ keys: src.keys !== false }` (dispatchCore.ts `activate`), so the same decision is answered two ways. What should happen: the mount effect passes `{ keys: keyboard !== false }`, as the core does.
- evidence: read
- severity: low
- size: line
- cause: activate option dropped on one path
- confidence: sure

## With only the hover channel on, nothing re-resolves the cursor after a release
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:163 (listenHover)
- scenario: with `channels: { pointer: false, hover: true }`, a press puts `heldPointers` above 0. `moved` then routes to `resolve`'s held branch, which applies `inFlightCursor()`, which is `null`, so the override clears. On release, `listenHover` binds no `pointerup`, so `hover.released` never runs. The idle cursor (an affordance's cursor, or the action a press would route to) is not restored until the pointer moves again. With the pointer channel on, `onUp` calls `hover.released`, which schedules `refreshSoon`. What should happen: the hover-only path also re-resolves on release, from a `pointerup` listener calling `hover.released`.
- evidence: read
- severity: low
- size: line
- cause: release listener missing on hover-only path
- confidence: likely

## A release that yields to an item's own session skips the hover re-resolve
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:283 (onUp)
- scenario: with `controls` or a nested item session, a press whose item took it is released before it moves. `claims.yielded` is true, so `onUp` calls `onCancel` and returns before `opts.hover.released(e)`. The cursor shown while the pointer was held (`inFlightCursor()`, `null` in this case) stays until the next move. What should happen: the cursor is re-resolved at the release point, as on the normal path.
- evidence: read
- severity: low
- size: line
- cause: early return skips hover.released
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
