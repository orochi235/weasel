## `explain` reports a keymap's own Escape binding as firing when a plain Escape only closes the keymap
- where: packages/routing/src/interactions/dispatcher/predict.ts:31 (routed / explain)
- scenario: a keymap is open and binds plain `Escape`; nothing is in flight. `routeThroughKeymap` takes the `isPlainEscape` branch, calls `closeInnermost` and returns `'handled'` without ever calling `passes.run`, so `last` stays null and `routed` falls back to `{ ...ctx, keymapPass: 'only' }` with `fires: false`. `resolveOnly` correctly answers null, but `explain` then walks the `'only'` pass anyway, finds the keymap's Escape binding as `would-fire`, and returns a record with `fired: <that action>` and `outcome: 'handled'`. A real dispatch fires no action (it closes the keymap). The same question gets two different answers in `resolveOnly` and `explain`.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/predict.ts
- size: function
- cause: fallback ctx walked when no pass ran
- confidence: likely

## With the pointer channel off, the hover cursor is wiped while a button is held and stays wiped after release until the pointer moves again
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:182 (listenHover)
- scenario: `channels: { pointer: false, hover: true }`. While the pointer rests over an item, the hover cursor shows its action's `cursor`. The user presses and moves: `hover.moved` → `resolve()` sees `pointersHeld() > 0` and applies `inFlightCursor()`, which is `null` because this surface opens no gesture, so the cursor goes back to the default. On release, nothing calls `hover.released` (only `listenPointer` wires it, through the pointer channel's `onUp`), so the cursor stays cleared until the next `pointermove`. It should come back as soon as the button is released, as it does when the pointer channel is on.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/attachInput.ts, packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: line
- cause: no pointerup listener in hover-only mode
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

<!-- done: 2 findings, files read: 44 -->
