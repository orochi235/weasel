## Tearing down the listener set mid-drag leaves the pointer pinned in the view resolver, so later hover moves route to the stale view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:291 (pointerInput onCancel / dispose)
- scenario: on a multi-view surface, press in view A and start a drag, then something re-binds the listeners (`keyboard`, `enabled`, a channel flag or `yieldKeys` changes, or the canvas ref changes). Teardown sets `disposed = true` and then calls `pointer.dispose()`, which cancels each session. `onCancel` returns early on `core.disposed()`, so `routeRelease(pointerId)` never runs and `resolver.end` is never called. The resolver (`viewResolver.ts:125`) belongs to the host and outlives the listener set. After the release, the new listener set's `onHoverMove` → `onMove` calls `routeAt(e.pointerId, …)`, and `resolver.at` hands back the pinned view A whatever the pointer is over. Hover events, hover cursors and click predictions all run on view A's dispatcher until the next press of that pointer overwrites the pin. Each touch or pen id caught this way also stays in the resolver's `pinned` map for good. The early return in `onCancel` when `recognizer.positionOf` is undefined skips `routeRelease` the same way.
- evidence: read (pointer.ts onCancel/dispose, attachInput.ts teardown order, core viewResolver.ts at/end)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: function
- cause: unpin skipped with the dispatch on teardown
- confidence: likely

## `isEmptyOngoingHandle` ignores `onWheel`, `cursor`, `subscribe` and `kind`, so a handle that only claims wheels or only shows a cursor is treated as a decline
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:118 (isEmptyOngoingHandle)
- scenario: a key-held action returns `{ onWheel: (ctx) => { scrub(ctx.wheel.deltaY); return true; } }` from `start` ("hold B and scroll to size the brush"), or a held key returns only `{ cursor: () => 'zoom-out' }`. `invokeAction` asks `isEmptyOngoingHandle`, which checks only `onMove`, `onEnd`, `overlay`, `previewIds` and `previewPose`. The answer is "empty", so the walk falls through to the next candidate and the handle is never put in flight. `pumpGesture` never offers it a wheel, and `inFlightCursor` never reads its cursor. `OngoingHandle.onWheel` is documented as a way for a gesture in flight to claim wheels, so the dispatcher answers "does this handle engage?" two ways. `deferredStart` and `uiOngoing.begin` use the same test.
- evidence: read (inFlightGestures.ts, gestureRun.ts invokeAction/pumpGesture wheel branch, invoker.ts OngoingHandle.onWheel docs)
- severity: low
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness test omits newer handle members
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
