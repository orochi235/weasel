# Audit round 85 — routing.interactions.dispatcher (blind reviewer)

## A gesture that ends with no input leaves its active cursor on the canvas until the pointer moves
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:165 (hoverCursorInput `changed`)
- scenario: The pointer rests over the canvas and Space is held for the hand tool, so the override is the hand action's `grab`/`grabbing` cursor. The window loses focus (Cmd-Tab). `onWindowBlur` → `keys.releaseAll()` ends the key-held handle, and the dispatcher notifies. The notify reaches `cursor.changed()` through `dispatcherWatch`, but `changed()` only acts while `inFlight().size > 0`. With nothing in flight it does nothing, so the override stays. No keyup reaches `hover.onKey`, since the window never delivers one. Back on the page, the canvas shows the hand cursor until the next pointermove. The same thing happens for any end that has no pointer or key event behind it: a `cancelAll` from code, or a handle ended through `beginUiOngoing`'s control. Expected: when the last gesture leaves flight, `changed()` re-resolves the idle cursor (`resolve()`/`refresh`), or at least clears the override.
- evidence: read
- severity: low

## `heldPointer` is read once at attach, so a later callback never gets the feed and the earlier one never gets `null`
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:117 and :145 (attachInput); packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx:150 (effect deps)
- scenario: The feed goes to `src.heldPointer()` when the listeners attach. The teardown sends `null` to whatever `src.heldPointer()` returns at teardown. `heldPointerRef` is a stable `useLatest` ref, so changing the `heldPointer` option does not re-run the attach effect. Suppose a host swaps `heldPointer` from callback A to callback B, for example after re-mounting the autoscroller that owns it. B never receives a `HeldPointerFeed`, so autoscroll under a drag stops working. A keeps its feed forever and is never told `null`. When the listeners finally detach, B gets a `null` it never had a feed for. Expected: the feed follows the current option. Either re-deliver it when the callback changes, or remember which callback received it and send `null` to that one.
- evidence: read
- severity: low

## A keystroke that closes a keymap while Cmd is down stays in the `quiet` set after its keyup is lost
- where: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts:31 (keymapKeys `up`)
- scenario: On macOS, Cmd is held and key X is pressed. X closes the open keymap, so `press` adds X to `quiet`. X is released while Cmd is still down, and macOS sends no keyup for X. Meta's keyup releases only `leaders` that had Cmd. It never removes Cmd-held entries from `quiet`, because `quiet` records nothing about Cmd. `keyboard.ts` likewise drops X from `downKeys`/`heldKeys` on Meta's keyup but never calls `keymaps.up` for X. The next time X is pressed on its own, the first keydown goes through, but every autorepeat is `preventDefault`ed and dropped (`consider`: `e.repeat && keymaps.quiet(...)`) until X's own keyup arrives. Holding an arrow key or Cmd+= stops repeating. Expected: Meta's keyup clears Cmd-held quiet entries the same way it clears Cmd-held leaders.
- evidence: read
- severity: low

## Immediate params carry `bodyKind` for some pointer kinds and drop it for others that match on it
- where: packages/routing/src/interactions/dispatcher/inputFacts.ts:128-150 (carried)
- scenario: `contextmenu` and `carry` put both `bodyTarget` and `bodyKind` in an immediate invoker's params. `pointerdown`/`longpress` and `hover` carry `bodyTarget` but drop `bodyKind`. `click`/`doubleclick` carry neither, even though those events have both and their bindings match `kind:<k>` targets on them. Take an immediate action bound to a `click` or `longpress` with a `kind:` target that reads `params.bodyKind`/`params.bodyTarget` to learn what it hit. It gets `undefined` on those paths. The same action bound to `contextmenu` gets the value. One question (what did the input land on) is answered differently depending on the event kind.
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

<!-- done: 4 findings, files read: 44 -->
