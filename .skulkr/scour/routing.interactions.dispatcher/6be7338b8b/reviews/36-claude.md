# Findings: routing.interactions.dispatcher

## `explain` names a fired action for an input the open keymap short-circuits without running it
- where: packages/routing/src/interactions/dispatcher/predict.ts:85 (explain), with routed at :20
- scenario: A keymap is open and binds plain Escape (or the input is the `keyHeld` twin of a keystroke the keymap already took, verdict `'taken'`). `routeThroughKeymap` returns `'handled'`/`'unhandled'` without calling `passes.run`, so `last` stays null and `routed` falls back to `{ ...ctx, keymapPass: 'only' }`. `explain` then ranks and walks that keymap-only context, finds the keymap's Escape action as `would-fire`, and returns a record with `fired: '<that action>'`. A real dispatch closes the keymap (`closeInnermost`) and runs no action at all. The record should show nothing fired (no ranked winner) when the keymap router decided without running a pass.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/predict.ts
- size: function
- cause: fallback context walked when no pass ran
- confidence: likely

## The trace's live press prediction goes stale whenever the hover resolve returns early
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:121 (resolve)
- scenario: The pointer rests over open canvas, so `setLive` is given an `explain` closure for a press at that point. It then moves onto an affordance that has a `cursor`, or a button goes down. `resolve` returns at the affordance or the held-pointer branch before it reaches `setLive`, so `trace.live()` keeps explaining a press at the old position. The same happens after recording stops and starts again: `setLive` is skipped while `recording()` is false and nothing withdraws the old closure. Devtools then show a prediction for where the pointer was, not where it is. Each early return (and the not-recording case) should withdraw or replace the live entry.
- evidence: read
- severity: low
- size: function
- cause: setLive only on the full idle path
- confidence: sure

## Rebinding the listeners cancels UI-driven ongoing handles as well as gestures
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:163 (attachInput teardown)
- scenario: A color slider is mid-scrub through `actions.begin(...)`, which is `beginUiOngoing` on the dispatcher SceneCanvas shares. Anything that re-runs the attach effect fires the teardown: toggling `enableKeybindings` (→ `keyboard`), any `channels` flag, or `yieldKeys`. The teardown calls `d.cancelAll('cancel')` on every dispatcher. `cancelAll` also clears `uiOngoing` and cancels the slider's handle, so the scrub is reverted even though no pointer, key or gesture of these listeners was involved. The teardown only needs to end gestures its own listeners would never see end (pointer, key-held, carry). The UI-driven `ui-*` handles should be left alone.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/dispatcher.ts, packages/routing/src/interactions/dispatcher/dispatcherApi.ts
- size: design
- cause: cancelAll used as a teardown-scoped cancel
- confidence: likely

## A drag crossing a child of the canvas can tear down and rebuild the drop preview
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:63 (onDragLeave)
- scenario: The surface element has children (overlay layers, HUD). An OS file drag moves from the element onto a child. Where the engine gives `dragleave` a null `relatedTarget` (Safari has historically done this), the guard fails, so the class is removed and `preview.end()` runs. The next `dragover` then calls `show` with `key` reset, which starts `action.preview` again. The preview flickers and restarts at every child boundary. The fix is to count enter/leave depth, or to treat a null `relatedTarget` as unknown and leave the end to the next `dragover` that finds no winner.
- evidence: read
- severity: low
- size: function
- cause: relies on relatedTarget for containment
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
