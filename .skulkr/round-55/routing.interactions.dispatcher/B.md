I was blocked from writing `.skulk/out/findings.md`: the first four findings made it into the file, then later writes were refused permission. Per the brief, the full document is below.

One discrepancy: the frozen sha `bfc55709…` doesn't exist in this clone, so I read the tree at HEAD `830b463cc1`. `packages/routing` has no local changes against HEAD.

# Findings: routing.interactions.dispatcher (round 55)

## A drag started behind a drag threshold never has its handle's `subscribe` heard
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:64 (open), with deferredStart.ts:37-46 (read)
- scenario: A binding with `dragThresholdPx > 0` gets the `deferredStart` proxy. Two examples are the select tool's `move.dragThresholdPx` and insert's `INSERT_DRAG_THRESHOLD_PX`. `inFlight.open` reads `handle.subscribe` once, at press time, when the proxy still answers `undefined` because `inner` has not started. Once the threshold is crossed, the move action's handle (`editing/src/actions/move/action.ts:73`, `subscribe: shown.subscribe`) is live, but nothing subscribes to it. So when a snapToContainer dwell elapses with the pointer held still, the dispatcher is never told and the host never repaints. The same drag without a threshold does repaint.
- evidence: read
- severity: medium

## A deferred `start` that tears the dispatcher down leaves its handle running and never ended
- where: packages/routing/src/interactions/dispatcher/deferredStart.ts:21-30 (onMove); gestureRun.ts:294-298 (the `endings` check only covers the undeferred path)
- scenario: Take an ongoing action whose `start` calls `cancelAll`, bound with a drag threshold. Without a threshold, `invokeAction` sees `run.endings` change and calls `onEnd('cancel')` on the returned handle. With one, `start()` runs inside the proxy's `onMove`. `endAllGestures` takes the proxy and calls its `onEnd` while `inner` is still null, so nothing ends. Then `inner` is assigned and `inner.onMove` runs on a gesture that is no longer in flight. The inner handle's `onEnd` is never called, so whatever its `start` set up leaks. `uiOngoing.begin` (uiOngoing.ts:86-99) has the same gap: if `start` calls `cancelAll`, the handle is still opened in flight afterwards.
- evidence: read
- severity: low

## Prediction ignores the open keymap's routing, so the hover cursor and long-press ring promise a drag the dispatch withholds
- where: packages/routing/src/interactions/dispatcher/predict.ts:26-41 (resolveOnly) vs keymapRoute.ts:102-105 (routeThroughKeymap)
- scenario: Say an open keymap binds `click` and the active tool binds a drag on the same target. A real `pointerdown` returns 'unhandled' from `routeThroughKeymap`, so no drag starts. `resolveOnly` never goes through `routeThroughKeymap`: it ranks the keymap's bindings at hotkey tier alongside everything else and names the drag as the winner. So `hoverCursor.resolve` shows the drag's cursor, and `holdPublisher` arms the long-press ring off the same prediction. Under an `unbound: 'modal'` keymap, a key the dispatch swallows is likewise still predicted to fire.
- evidence: read
- severity: low

## An immediate action bound to a key (or wheel, pinch, drop, paste) loses `params.viewId` and `params.roles`
- where: packages/routing/src/interactions/dispatcher/inputFacts.ts:97-181 (immediateParams), gestureRun.ts:211-221,236-239 (withView, withRoles)
- scenario: `withView` adds `viewId` only when a params bag exists. For `key`, `keyHeld`, `multitouchtap` and the other kinds in its `default` branch, `immediateParams` returns the binding's own `resolved`, which is usually `undefined`. So a key-bound immediate action gets no `viewId`, while the same action bound to a click does. Separately, `withRoles` needs `params.mods`, which only the click, press, contextmenu, hover and carry branches set. A wheel, pinch, key, drop or paste binding of an action with `modifierRoles` never gets `params.roles`, even though the 2026-11-20 changeset promises it. The ongoing path resolves roles for every kind, so the two timings disagree.
- evidence: read
- severity: low

## The documented action-lookup miss says the input goes unhandled; the walk skips to the next candidate and fires it
- where: packages/routing/src/interactions/dispatcher/dispatcher.ts:20-23 (module doc) vs walk.ts:163-172 (walk)
- scenario: A tool binds `Delete` to an unregistered action, ranked ahead of an ambient `Delete` binding for `delete`. The header says the dispatcher "returns `'unhandled'`, so the gesture falls through as if unmatched". The walk instead records `no-such-action`, continues, fires `delete`, and returns 'handled'.
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

<!-- done: 5 findings, files read: 44 -->