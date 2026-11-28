## Tearing down the listener set mid-drag leaves the pointer pinned in the view resolver
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:247 (onCancel), with packages/routing/src/interactions/dispatcher/attachInput.ts:162 (teardown)
- scenario: The surface has `views`. A mouse (pointerId 1) is pressed in view "a", so `routeDown` pins it through `resolver.begin`. While it is held, the effect re-binds: `keyboard`, a channel flag, or `enabled` changes, or it unmounts while the resolver lives on. Teardown sets `disposed = true` and then calls `pointer.dispose()`. Each session's cancel then reaches `onCancel`, which returns early on `core.disposed()` before `routeRelease`, so `resolver.end(1)` never runs. `viewResolver.at` returns a pinned pointer's view whatever point it is given (viewResolver.ts:127). In the new listener set, `onHoverMove` → `onMove` → `routeAt(1, …)` therefore routes every hover of that mouse to view "a", even over view "b". Hover bindings fire and the cursor resolves on the wrong view's dispatcher until the next press re-pins it. The pin should be released when the listener set tears down.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: function
- cause: release-routing skipped on disposed cancel path
- confidence: likely

## The cursor shown mid-gesture ignores the binding's params, unlike the idle cursor
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:104 (cursor)
- scenario: An action declares `cursor` as a function of params and no `activeCursor`, for example a resize whose binding params pick `ew-resize` or `ns-resize`. Idle, the hover cursor calls `actionCursor(r.action, r.params)` (hoverCursor.ts:131) and shows the cursor for those params. Once the drag starts, `inFlightCursor` falls back to `actionCursor(action)` with no params, so `cursor(undefined)` runs and the cursor changes or vanishes at the press. The params are not stored with the handle, so the in-flight path cannot pass them. This one decision is answered two ways.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts, packages/routing/src/interactions/dispatcher/gestureRun.ts
- size: function
- cause: binding params not kept with the in-flight action
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
