# Findings: routing.interactions.dispatcher

## A key pressed before Cmd and released while Cmd is down stays held forever on macOS
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:157 (onKeyUp), :97 and :140 (`withCmd: e.metaKey`)
- scenario: Space held for the hand tool (keyHeld gesture opens, `withCmd: false` since Cmd was up at keydown), then Cmd pressed, then Space released while Cmd is still down. macOS delivers no keyup for a non-modifier key released while Cmd is down, whatever order the two went down in. Cmd's keyup then releases only the entries whose `withCmd` is true, so Space's held gesture stays in flight (hand tool stuck engaged, `downKeys` keeps the entry and `arrive` presses it again on every re-entry) until Space is pressed and released again. What should happen: Cmd's keyup releases every key still recorded as down, or any key that is still down when Cmd goes down gets marked `withCmd`.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts, packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: function
- cause: `withCmd` sampled only at the key's own keydown
- confidence: likely

## keymapKeys has the same gap: a leader pressed before Cmd never releases
- where: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts:28 (press) and :34 (up)
- scenario: a hold-to-open leader goes down with Cmd up (`leaders.set(physical, false)`), Cmd goes down, and the leader comes up under Cmd. The leader's keyup is lost on macOS, and Cmd's keyup releases only the leaders recorded with `withCmd` true, so `stack.release('key:…')` never runs and the held keymap stays open. Its autorepeat suppression (`quiet`) also stays until the key is pressed again. Same root cause and fix as the finding above.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keymapKeys.ts
- size: line
- cause: Cmd state recorded only at keydown
- confidence: likely

## A hover over a nested dispatcher surface is also routed, hit-tested and cursored by the outer surface
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:178 (listenPointer `pointermove`), :205 (trackPointerOver); packages/routing/src/interactions/dispatcher/channels/pointer.ts:351 (onHoverMove)
- scenario: a panel that runs its own dispatcher sits inside a canvas that runs another. The pointer moves over the panel. The panel's `pointermove` bubbles to the outer canvas, whose `onHoverMove` → `onMove` → `hover.moved` hit-tests the outer scene under the panel, dispatches `hover` events to the outer bindings (a hover highlight on whatever lies under the panel), and resolves and paints the outer cursor (including a painted cursor through `setPointer`). `trackPointerOver` also keeps the outer `pointerOver` true, so the outer surface's `over` key bindings fire alongside the panel's. Presses get the nesting check (`pressedNestedIn`), and so do wheel, contextmenu, pinch and drop (`landedNestedIn`/`eventTaken`), but hover and `over` do not. What should happen: a move that landed in a nested surface is treated like a leave for the outer one.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/attachInput.ts, packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: function
- cause: no nesting check on hover/over
- confidence: likely

## An `over`-held key whose gesture was ended elsewhere is never dropped from `held` on leave
- where: packages/routing/src/interactions/dispatcher/channels/overKeys.ts:79 (leave)
- scenario: Space taken by an `over` binding, then the gesture is ended by `cancelAll` (tool switch, Escape) while Space stays down. On pointer leave, `releaseIn` finds nothing in flight and returns 'unhandled', so the entry stays in `held` (`heldKeys`). Until Space's keyup arrives, `consider` treats every autorepeat as a key "already engaged": it calls preventDefault and skips dispatch, so an ordinary `key` binding on Space (or the page's own default) never sees the repeats. The same stale entry follows any held key whose gesture `cancelAll` ends. What should happen: the entry is dropped whenever its gesture is no longer in flight (`stillHeld` false), not only when the release is handled.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/overKeys.ts, packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: line
- cause: removal gated on release outcome rather than liveness
- confidence: likely

## The idle hover cursor ignores a gesture in flight on another view's dispatcher
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:116 (resolve), :193 (changed)
- scenario: on a multi-view canvas, Space is held for the hand tool while the pointer is over view A, so the keyHeld gesture opens on A's dispatcher. The pointer then moves into view B with no button down. `resolve` checks only `dispatcherNow()` (now B) for in-flight gestures, sees none, re-routes and shows B's idle prediction instead of the hand's active cursor. `changed()` also computes `flying` from the routed dispatcher only, so A's gesture ending never triggers the idle refresh while B is routed. What should happen: in-flight state is read across every dispatcher the listener set drives (`src.dispatchers()`).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts, packages/routing/src/interactions/dispatcher/attachInput.ts
- size: function
- cause: in-flight checked on the routed dispatcher only
- confidence: likely

## A peer on a shared surface whose listener ran first gets the same keystroke dispatched to it a second time
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:100 (onKeyDown) and :104 (take)
- scenario: two dispatchers share one surface (a trial camera on an instrument's pane), and the pointer is over it. B, which does not hold the keys, registered its window listener first. On a keydown, B's listener runs `consider` with `{held:false, over:true}`, and its over-bindings decline. A, which holds the keys, then runs and `passOn`s to B, and `take` runs `consider` again with `{held:true, over:true}`. The keystroke is routed through B twice: `noteRefusal` fires twice, two trace records are pushed, and B's `keymaps.press` sees the keystroke twice. `taken` guards only against the opposite order. What should happen: a channel that already considered `e` in its own listener is offered only the bindings it skipped (held), or is marked so that `take` skips it.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: line
- cause: `taken` set only by `take`, not by the own-listener pass
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

<!-- done: 6 findings, files read: 44 -->
