I couldn't finish writing `.skulk/out/findings.md`. Writing to it was refused after the first two findings had gone in, so the complete document is below.

Two other things you should know:
- **Commit mismatch:** the frozen commit `bfc55709b4b1c35343b8417dc8f74424b58d9714` doesn't exist in this clone. I read the files at HEAD `830b463cc1`, where every listed file has no local changes.
- **Not fixed:** all eight findings are reported only, as the brief asks.

# Audit round 55 — routing.interactions.dispatcher

## A deferred (drag-threshold) start that tears the dispatcher down leaves the handle it returns running and never ended
- where: packages/routing/src/interactions/dispatcher/deferredStart.ts:21 (deferredStart onMove); the guard it misses is at packages/routing/src/interactions/dispatcher/gestureRun.ts:294 (invokeAction)
- scenario: an ongoing action is bound to a drag with `dragThresholdPx > 0`, and its `start` ends every gesture (a tool switch → `cancelAll`, or an unmount).
  - On the move that crosses the threshold, `inner = start()` runs.
  - Inside it, `endAllGestures` takes the deferred proxy out of flight and calls its `onEnd`. That runs `inner?.onEnd` while `inner` is still null.
  - `start` then returns, `inner` is set, and `inner.onMove(ctx)` runs on a handle that is out of flight.
  - Its `onEnd` never runs, so any preview, pushed hotkey or session it opened is left behind.
  - The non-deferred path checks `run.endings !== endings` and ends such a handle with `'cancel'`. The deferred path should do the same.
- evidence: read
- severity: medium

## A WebKit pinch on a dispatcher surface nested inside another runs on both dispatchers
- where: packages/routing/src/interactions/dispatcher/channels/webkitPinch.ts:59-87 (onGestureStart, onGestureChange); listeners at packages/routing/src/interactions/dispatcher/attachInput.ts:124-128
- scenario: a surface with its own dispatcher sits inside another's element. Examples: the minimap, which listens for gesture events when wheel zoom is on, or a nested `<CanvasView>` pane.
  - On Safari, `gesturestart`/`gesturechange` fire on the inner surface and bubble to the outer one.
  - Both probe `resolveOnly` and both dispatch the `pinch` steps.
  - Nothing stops the second: there is no `landedNestedIn` check, no `takeEvent`, and no stopPropagation when handled. Both cameras zoom.
  - The wheel channel already handles this case (capture/bubble split on `landedNestedIn`, plus `stopImmediatePropagation`), and contextmenu uses `eventTaken`.
- evidence: read
- severity: medium

## An immediate action bound to a wheel, pinch, key, held key, drop or paste gets no `roles`, though an ongoing one on the same input does
- where: packages/routing/src/interactions/dispatcher/gestureRun.ts:216-221 (withRoles), with packages/routing/src/interactions/dispatcher/inputFacts.ts:101-180 (immediateParams)
- scenario: `withRoles` resolves roles only when `params.mods` is set.
  - `immediateParams` sets `mods` only for click, doubleclick, contextmenu, pointerdown, longpress, hover and carry, even though every event kind carries modifiers.
  - So an immediate wheel- or key-bound action with `modifierRoles` gets no `roles`. A role that a tuning or `opts.roles` moved falls back to the declared keys, which is the bug 76c5562e53 fixed for clicks.
  - `buildInvocationCtx` resolves roles for ongoing actions of every kind, so the same input is answered two ways.
- evidence: read
- severity: low

## A drop preview and the `weasel-dropover` class flicker off each time an OS drag crosses a child of the dispatcher's element
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:51-54 (onDragLeave)
- scenario: the element has children, such as a host holding the `<canvas>` and overlays.
  - Moving the drag onto a child fires `dragenter` on the child. It bubbles to the host, but the preview key is unchanged, so nothing happens.
  - Then `dragleave` fires on the host. `onDragLeave` removes the class and ends the preview.
  - Both come back only on the next `dragover`, which reruns `Action.preview` from scratch.
  - Fix: ignore a leave whose `relatedTarget` is still inside the element.
- evidence: read (the event order is the platform's; whether a given host has children is inferred)
- severity: low

## `dispatcherWatch.sync` keeps a dead dispatcher subscribed when the live list holds a duplicate
- where: packages/routing/src/interactions/dispatcher/dispatcherWatch.ts:19 (sync)
- scenario: `sync` returns early when `subscriptions.size === live.length`. `allDispatchers()` doesn't keep its entries distinct, for example when a view target is handed the root's dispatcher.
  - With live = [A, A] after B's view unmounts, subscriptions = {A, B} has the same size, so B is never unsubscribed until teardown.
  - Fix: compare against `new Set(live).size`.
- evidence: read
- severity: low

## The dispatcher's header says an unregistered action id ends the input unhandled, but the walk goes on to the next candidate
- where: packages/routing/src/interactions/dispatcher/dispatcher.ts:20-23 against packages/routing/src/interactions/dispatcher/walk.ts:163-171
- scenario: a binding names an unregistered id, and a lower-ranked binding for the same input names a real action.
  - The doc says the input returns `'unhandled'`.
  - The walk instead records `no-such-action`, continues, fires the lower candidate and returns `'handled'`.
- evidence: read
- severity: low

## `createDispatcher` says `getAction` defaults to the context's registry, but without one `beginUiOngoing` always returns null
- where: packages/routing/src/interactions/dispatcher/dispatcher.ts:61-65, packages/routing/src/interactions/dispatcher/uiOngoing.ts:74-77
- scenario: `createDispatcher()` is called with no options, as `useGestureDispatcher` does when not handed a dispatcher, and then `beginUiOngoing('x', deps)` is called.
  - `beginUiOngoing` takes no context, and `createUiOngoing` has no fallback.
  - It warns "no getAction was provided" and returns null for every action, which contradicts the documented default.
- evidence: read
- severity: low

## Prediction ignores open keymaps, so `resolveOnly`, `resolveAll` and `explain` disagree with dispatch while one is open
- where: packages/routing/src/interactions/dispatcher/predict.ts:14-57 against packages/routing/src/interactions/dispatcher/dispatcher.ts:106-110
- scenario: a keymap is open and binds a click.
  - A real `pointerdown` returns `'unhandled'` (keymapRoute.ts:103), and a plain key the keymap doesn't bind is swallowed under `'modal'`.
  - Prediction ranks with `keymapPass` unset, so everything is in play at once. The hover cursor shows the tool's drag cursor, the long-press store reports `armed`, and `explain` names a winner that dispatch won't run.
  - Only the empty-handle divergence is documented.
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

<!-- done: 8 findings, files read: 44 -->