## A key released while Cmd is held, when Cmd went down after the key, stays held forever on macOS
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:164 (onKeyUp), also keyboard.ts:91 and :140 where `withCmd` is recorded
- scenario: hold Space (a key-held hand pan, `heldKeys` entry with `withCmd: false`), press Cmd, release Space, release Cmd. macOS sends no keyup for a key released while Cmd is down, whenever that key went down. Cmd's keyup only releases entries whose `withCmd` was true at their keydown, so Space's held gesture stays in flight, its `downKeys` entry stays, its autorepeat stays suppressed, and every later `arrive` presses it again for `over` bindings. It should be released with Cmd's keyup like a key pressed with Cmd.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts, packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: function
- cause: `withCmd` sampled only at the key's own keydown; a later Meta keydown never marks keys already down
- confidence: likely

## A leader key held when Cmd goes down is never released from its keymap hold
- where: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts:28 (press) / :37 (up)
- scenario: the same macOS case for a keymap leader: hold a leader key (opened with `holdOpened`, `leaders.set(physical, false)`), press Cmd, release the leader, release Cmd. No keyup arrives for the leader and Cmd's keyup releases only `withCmd` leaders, so `stack.release('key:…')` never runs and the hold-opened keymap stays open (and `quiet` keeps eating that key's repeats) until the window blurs or the key is pressed again.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: function
- cause: Cmd state sampled at keydown only
- confidence: likely

## `claimKeys` takes the keys even when the keyboard channel is off
- where: packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx:137 (useDispatcherIn claimKeys effect)
- scenario: a dispatcher mounted with `keyboard: false, claimKeys: true` calls `actions.activate()` with no options, which moves the keys to it, so another canvas that held them stops hearing its shortcuts while this one never listens for keys. Every other activation path passes `{ keys: src.keys !== false }` (dispatchCore.ts `activate`), which leaves the keys where they are when the keyboard channel is off. The two paths answer the same question two ways.
- evidence: read
- severity: low
- size: line
- cause: activate called without `{ keys: keyboard !== false }`
- confidence: likely

## A hover cursor written before the surface's sink arrives is never cleared
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:49 (cursorOverride)
- scenario: `cursorSink` is read live because the sink arrives a render after the hook. A hover that resolves before then writes its override through `ownSink` onto the canvas element's style. Once `cursorSink()` answers, every later `apply`/`clear` goes to that sink, and nothing ever clears the override `ownSink` left on the canvas, so the canvas keeps a stale cursor style under the sink's.
- evidence: read
- severity: low
- size: function
- cause: apply/clear choose a sink per call without clearing the one written previously
- confidence: likely

## A drop whose materialization rejects, or whose dispatch throws, is an unhandled rejection
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:94 (onDrop)
- scenario: `void itemsFromDataTransfer(dt).then(...)` has no `catch`. A rejected read of a dropped file, or an action that throws inside the `then` (immediate invokers are caught, but `enabled` gates, deps construction or keymap batching are not), surfaces as an unhandled promise rejection rather than the `console.error` every other dispatch path logs. The default was already prevented, so the drop is silently lost.
- evidence: read
- severity: low
- size: line
- cause: promise chain without a rejection handler
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
