## A handle that only claims wheels, shows a cursor or subscribes is treated as empty and dropped
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:118 (isEmptyOngoingHandle)
- scenario: a key-held action ("hold Z and scroll to scrub") whose `start` returns `{ onWheel }`, or `{ onWheel, cursor }`, with no `onMove`/`onEnd`/preview. `invokeAction` (gestureRun.ts) asks `isEmptyOngoingHandle`, which looks only at `onMove`, `onEnd`, `overlay`, `previewIds` and `previewPose`, so it drops the facts, returns `'empty-handle'` and the walk moves on. The handle never goes in flight, `pumpGesture`'s wheel loop never offers it a wheel, and its `cursor()` is never read. `OngoingHandle.onWheel` is documented as something a gesture in flight can do without any of those other members. uiOngoing.begin and deferredStart use the same check, so they make the same call. It should count as engaged.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness check omits onWheel/cursor/subscribe
- confidence: likely

## A keystroke can be dispatched twice to a peer on the same surface, once over-only and once as holder
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:94 (onKeyDown / take)
- scenario: two dispatchers share one surface, and B has the pointer over it while A holds the keys. B's window listener was added first. B.onKeyDown runs first: `reach = {held:false, over:true}`, so `consider` dispatches the key and keyHeld for B's `over` bindings, and suppose that goes unhandled. Then A.onKeyDown declines and calls `passOn` → `B.take(e)` → `consider(e, {held:true, over:true})`. B dispatches the same keystroke again: its `over` bindings are matched a second time, an immediate `over` action whose `run` returned `'pass'` runs twice, `noteRefusal` fires twice, and `keymaps.press` sees one keystroke twice. When B joined first and its listener runs after A's, the `taken` WeakSet prevents this, so the result depends on listener order. Fix: `take` should skip `over` bindings for an event the channel already considered, or mark the event in `onKeyDown`.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: function
- cause: taken set only marks peer-offered events, not self-considered ones
- confidence: likely

## A paste the key holder declines is never offered to the other dispatchers on its surface, though a key is
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:99 (onPaste)
- scenario: two dispatchers on one surface: a trial camera and an instrument on another registry. A keystroke the one holding the keys declines goes to the peer through `passOn` (keyPeers.ts). A paste returns early at `if (!core.holdsKeys()) return;` on the peer, and the holder dispatches it and gets nothing. A `paste` binding on the peer never fires, while a Cmd+V `key` binding on the same peer would. The routing question "who on this surface may take page input the holder declined" gets two different answers.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/ingest.ts, packages/routing/src/interactions/dispatcher/channels/keyPeers.ts
- size: function
- cause: paste bypasses the surface peer list
- confidence: likely

## A first dispatcher with keyboard off claims a surface's press, so a second one on that surface never gets the keys
- where: packages/routing/src/interactions/dispatcher/dispatchCore.ts:236 (activate)
- scenario: two dispatchers on one element. The first attached has `keyboard: false`, so its core has `keys: false`. The second has its keyboard on. When a pointerdown lands, the first dispatcher's `activate(e)` adds the event to `CLAIMED` and calls `actions().activate({ keys: false })`, which leaves the keys where they are. The second's `activate(e)` sees the event in `CLAIMED` and returns. A press on the surface never moves the keys to the dispatcher that can hear them, and its shortcuts stay dead until something else claims them. The claim should not be taken by a dispatcher that activates without keys, or the key half should be left for the next one.
- evidence: read
- severity: low
- size: line
- cause: CLAIMED taken regardless of whether this core moves keys
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
