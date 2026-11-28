## The in-flight cursor calls a function `Action.cursor` with no params, unlike the idle hover cursor
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:104 (cursor)
- scenario: an action declares `cursor: (params) => params.dir === 'out' ? zoomOut : zoomIn` and no `activeCursor`, and is bound twice with `opts.params` `{dir:'in'}` and `{dir:'out'}`. Idle, the hover pump shows `actionCursor(r.action, r.params)` (hoverCursor.ts resolve), so the 'out' binding shows zoomOut. Once its drag starts, `inFlightCursor()` falls back to `actionCursor(action)` with `params` undefined: the cursor flips to zoomIn mid-gesture, or the cursor function throws on `params.dir`, and the throw escapes from the hover pump's `resolve`/`changed`. The same question (which cursor this binding's action shows) gets two answers. `invokeAction` has the binding's resolved params at `inFlight.open` and could store them with the action.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts, packages/routing/src/interactions/dispatcher/gestureRun.ts
- size: function
- cause: binding params not kept with the in-flight action
- confidence: likely

## `isEmptyOngoingHandle` treats a handle that only claims the wheel (or only shows a cursor) as a decline
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:119 (isEmptyOngoingHandle)
- scenario: a key-held action ("hold Z, wheel to zoom") returns `{ kind: 'zoom', onWheel, cursor }` from `start`. `pumpGesture` routes wheels to an in-flight handle's `onWheel` and `inFlight.cursor()` reads `handle.cursor`, but `isEmptyOngoingHandle` checks only `onMove`/`onEnd`/`overlay`/`previewIds`/`previewPose`. So `invokeAction` returns `'empty-handle'`, the handle is never put in flight, its `onWheel` and `cursor` are never asked, and the key falls through to the next candidate. The same test in `uiOngoing.begin` and `deferredStart` drops such a handle too.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness test omits onWheel/cursor/subscribe
- confidence: likely

## A binding to an unregistered action warns on every input, including every pointer move for a hover binding
- where: packages/routing/src/interactions/dispatcher/walk.ts:186 (walk)
- scenario: a contribution binds `{ kind: 'hover' }` (or a key that autorepeats) to an action id that is not registered. `dispatcher.hover` walks with an `attempt` on every mouse move, so `console.warn("binding resolved actionId … Skipping")` fires once per move with no dedupe, where the misbound case right beside it (`reportMisbound` in gestureRun.ts) reports once per action. The console floods.
- evidence: read
- severity: low
- size: line
- cause: warning not deduplicated
- confidence: sure

## A drop whose items fail to materialize, or whose dispatch throws, is an unhandled promise rejection
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:97 (onDrop)
- scenario: `void itemsFromDataTransfer(dt).then(...)` has no rejection handler. When reading a dropped file rejects (a permission error, a folder entry), or the action's invoker throws synchronously inside `dispatch` (an immediate invoker's throw is caught, but an ongoing `start`'s path or a keymap effect is not), the rejection surfaces as an unhandledrejection with no "weasel dispatcher" context. Every other dispatch path logs through `console.error` with the action named.
- evidence: read
- severity: low
- size: line
- cause: missing .catch on the materialization promise
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
