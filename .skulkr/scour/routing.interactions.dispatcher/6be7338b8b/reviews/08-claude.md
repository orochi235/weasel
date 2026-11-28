## A key pressed before Cmd and released while Cmd is down stays held forever
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:131 (onKeyDown / onKeyUp)
- scenario: Hold Space (a key-held hand pan starts; `heldKeys` records `withCmd: false` because Cmd was not down at keydown), press Cmd, release Space, release Cmd. macOS suppresses the keyup of a key released while Cmd is down, so the Space keyup never arrives; Cmd's keyup then releases only entries with `withCmd` set, which Space's is not. The hand gesture and the `downKeys` entry stay engaged until Space is pressed again (autorepeat of nothing, a later `arrive` re-presses Space for `over` bindings). It should be released with Cmd's keyup like a key pressed during Cmd. `withCmd` is captured only at the key's own keydown; a Meta keydown never marks the keys already down.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts, packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: function
- cause: withCmd sampled only at the key's own keydown
- confidence: likely

## keymapKeys has the same gap: a leader held before Cmd is never released by Cmd's keyup
- where: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts:28 (press / up)
- scenario: A leader key opens a hold keymap (`holdOpened`), recorded with `e.metaKey` false. Cmd goes down, the leader is released (no keyup on macOS), Cmd is released: `up` releases only leaders with `withCmd` true, so `stack.release('key:<physical>')` never runs and the hold keymap stays open until something else closes it.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: function
- cause: withCmd sampled only at the leader's keydown
- confidence: likely

## The hover cursor leaves a stale live prediction on the trace once recording stops
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:141 (resolve)
- scenario: While the trace records, each idle resolve calls `ctx.trace.setLive(() => d.explain(press, ctx))`. When the watcher releases (`recording()` turns false) nothing calls `setLive(null)` (only `clear()` does, on leave/teardown), so the closure keeps the last press point, ctx and dispatcher. A devtools panel that starts watching again reads `trace.live()` before the next pointer move and gets an `explain` run against the old point and an old context snapshot, which can name an action that no longer wins. Should withdraw (`setLive(null)`) when not recording, or set it regardless of `recording()`.
- evidence: read
- severity: low
- size: line
- cause: live explain set only while recording, never withdrawn
- confidence: likely

## An ongoing handle's onMove / onWheel throw escapes dispatch, unlike start, run and onEnd
- where: packages/routing/src/interactions/dispatcher/gestureRun.ts:164 (pumpGesture)
- scenario: An action whose `onMove` throws on some move: `invokeAction` catches throws from `start`/`run` and `runOnEnd` catches `onEnd`, but `pumpGesture` calls `handle.onMove` (pointermove, multitouch, carry) and `handle.onWheel` bare. The throw propagates out of `handleInput` into the pointer channel's `onMove`, so `opts.hover.moved(e)` is skipped for that event (cursor and hover dispatch go stale) and, on the keyboard/wheel paths, `preventDefault`/`stopImmediatePropagation` are never reached, so the page scrolls or zooms under a claimed wheel. The gesture stays in flight with no log naming the action. Should be caught and logged as the other handle callbacks are.
- evidence: read
- severity: low
- size: function
- cause: missing try/catch around handle callbacks in the pump
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
