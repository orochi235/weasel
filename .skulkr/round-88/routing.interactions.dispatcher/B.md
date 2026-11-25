# Audit round 88, routing.interactions.dispatcher

## The keymap's `unbound` fallback is frozen at render time while every other gesture setting is read live
- where: packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx:94 (useDispatcherIn, `leaderUnbound: kitSettings.get('gestures.keymapUnbound')`)
- scenario: `useKitSettings()` returns the context store and does not subscribe (packages/react/src/useKitSetting.ts:32), so this value is read once per render of the host. A user changes `gestures.keymapUnbound` from `'modal'` to `'cascade'` in prefs. If nothing re-renders the canvas host, `ctxRef.current.leaderUnbound` keeps `'modal'`, and an unbound key in an open keymap is still swallowed (keymapRoute.ts:104). Meanwhile `dragPx`, `longPressMs`, `doubleClickMs` and the rest are read through `kitSettings().get(...)` on each use (pointer.ts:157-161). So the same store answers two ways depending on the setting. It should be read per input, for example through a thunk on the context, or via `useKitSetting` so the hook re-renders.
- evidence: read
- severity: medium

## A drop's preview runs with different params than the drop itself: no `viewId` and no modifier roles
- where: packages/routing/src/interactions/dispatcher/channels/dropPreview.ts:50 (dropPreview.show)
- scenario: `show` passes `immediateParams(event, winner.params)` to `Action.preview`. The drop that follows runs through `invokeAction` (gestureRun.ts:228-232), which also adds `viewId` (`withView`) and `roles` (`withRoles`, for an action that declares `modifierRoles`). Take an action that reads `params.viewId` to choose which panel's camera or selection to place into, or `params.roles` to decide copy vs. move. While the drag hovers, its preview sees `viewId` undefined and no roles, so it shows the root view or the default role. The real drop then lands differently. These are the same params decision answered two ways on two paths.
- evidence: read
- severity: low

## An OS drop no binding takes still has its default prevented
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:73 (onDrop)
- scenario: `onDragOver` leaves a drag no binding would take to the page ("stays the page's", line 50). But `onDrop` calls `e.preventDefault()` before checking `resolveDrag(...).winner`. Suppose a page whose own ancestor handler cancels dragover to accept file drops anywhere. A drop of a file type nothing in the canvas binds then reaches the canvas, which prevents its default. The page's own drop listener, which bubbles after, sees `defaultPrevented` and may skip it. Then the dispatch of `items` runs anyway and nothing handles it. The decision should match dragover's: only prevent when `winner` is non-null.
- evidence: read
- severity: low

## A UI-driven handle on a dispatcher not yet watched never triggers a redraw
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:60-75 (attachInput, `redraw.sync` via `uses`)
- scenario: `dispatcherWatch` is synced at attach time and then only inside `core.dispatch` (`src.uses(d)`). Two cases leave a dispatcher unwatched until the next pointer or key event:
  - The `dispatcher` option swaps to a new instance. `useDispatcherOption` just returns it, and the listener effect does not re-run because `allDispatchers` is stable.
  - A view's dispatcher appears and nothing has dispatched on it yet.

  If a slider calls `beginUiOngoing`/`update` on that dispatcher, it notifies, but no subscriber is attached. `requestRedraw` is never called, so the dispatcher-only overlay or preview it drives does not repaint, and the hover cursor's `changed()` never runs. Those are exactly what `requestRedraw` promises to cover ("UI-driven step", gestureDispatcherOptions.ts:259).
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
