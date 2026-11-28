## A key held before Cmd goes down stays held forever on macOS: only keys that went down with Cmd are released by Cmd's keyup
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:154 (onKeyUp), :93 and :140 (`withCmd: e.metaKey` at keydown)
- scenario: on macOS, hold Space (a key-held hand pan engages; `heldKeys` and `downKeys` get Space with `withCmd: false`), press Cmd, release Space, release Cmd. Cocoa drops a keyup that arrives while Cmd is down, whenever Cmd went down, so Space's keyup never comes. Cmd's keyup releases only entries with `withCmd`, which Space lacks, so the `key-held-Space` gesture stays in flight, the hand cursor stays, and pressing Space again finds the gesture already in flight (`pumpGesture` answers 'handled' for its down) until a later Space keyup. `downKeys` keeps Space too, so every `arrive` presses it again for `over` bindings. `keymapKeys` has the same gap for leaders (`leaders.set(physical, e.metaKey)`). Expected: a key still down when Cmd goes down is released by Cmd's keyup, the same as one pressed with Cmd.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts, packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: function
- cause: `withCmd` captured only at keydown, not when Cmd later goes down
- confidence: likely

## With no canvas (`usePageActions`, any canvas-less dispatcher), keys typed in a React Aria modal still fire page actions
- where: packages/routing/src/interactions/dispatcher/channels/modal.ts:32 (inModalOver)
- scenario: a React Aria modal dialog sets `role="dialog"` with no `aria-modal` and makes the page behind it inert. `inModalOver(target, null)` reaches the dialog, but the inert check runs only on `canvas !== null && hiddenBehind(canvas)`, so with no canvas it returns false. `keyboardInput.onKeyDown` and `onPaste` then dispatch a key such as Delete or a single-letter shortcut, typed while focus is on a non-editable control in the modal, to the page's actions behind it. Expected: like a canvas behind the modal, a canvas-less page dispatcher hears nothing from inside it. For example, it could treat a dialog that inerts or `aria-hidden`s its siblings as modal.
- evidence: read
- severity: low
- size: line
- cause: inert test needs a canvas to probe
- confidence: likely

## A binding naming an unregistered action warns on every hover move, with no dedupe
- where: packages/routing/src/interactions/dispatcher/walk.ts:183 (walk)
- scenario: a contribution declares a `hover` binding (or any binding a frequent input matches) whose `actionId` is not registered. `dispatcher.hover` walks with an `attempt` on every pointer move, so `walk` runs `console.warn('... no registered action. Skipping.')` once per mouse event, hundreds a second. The misbound and dead-claim reports in the same pipeline (`reportMisbound` in gestureRun.ts, `reportDeadClaim` in matcher.ts) dedupe per action and per owner. Expected: one warning per actionId.
- evidence: read
- severity: low
- size: line
- cause: missing once-per-id guard
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
