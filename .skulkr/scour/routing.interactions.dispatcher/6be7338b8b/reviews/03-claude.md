# Findings: routing.interactions.dispatcher

## In-flight cursor asks a function-valued `Action.cursor` with no params, so mid-gesture it can differ from the hover cursor
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:104 (cursor)
- scenario: An action has a function `cursor` that reads its params, e.g. `cursor: (p) => p?.axis === 'x' ? 'ew-resize' : 'ns-resize'`, and no `activeCursor`. It is bound with `opts.params: { axis: 'x' }`. While hovering, hoverCursor resolves `actionCursor(r.action, r.params)` and shows `ew-resize`. Once the drag starts, `inFlight.cursor()` calls `actionCursor(action)` with no params, so the function gets `undefined` and returns `ns-resize`. A function that dereferences `params` throws instead. The gesture's cursor should be resolved with the params of the binding that opened it.
- evidence: read (`actionCursor` in actions/action.ts:285 passes `params` to a function cursor; `open()` never records the binding's params)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts, packages/routing/src/interactions/dispatcher/gestureRun.ts
- size: function
- cause: binding params not kept with the in-flight handle
- confidence: likely

## A multitouch gesture whose opening event has no angle never accumulates rotation
- where: packages/routing/src/interactions/dispatcher/gestureFacts.ts:72 (begin) / :85 (turn)
- scenario: `begin` creates the `turns` entry only when the opening multitouch event has `angle !== undefined`. If the gesture opens on an event without an angle and later moves carry one, `turn()` finds no entry and returns early on every move. `of()` then reports no `rotation`, and `multiTouchOf` falls back to `rotation: 0` for the whole gesture. `turn` has a "gesture that opened on no angle turns from its first one" branch, but it only covers a NaN opening angle, not a missing one. `begin` should seed `{ last: NaN, total: 0 }` whenever the event is multitouch.
- evidence: read
- severity: low
- size: line
- cause: turn entry gated on angle presence
- confidence: likely

## `explain` reports a fired action for an input an open keymap withholds
- where: packages/routing/src/interactions/dispatcher/predict.ts:84 (explain)
- scenario: While a keymap is open and the keystroke's twin was already ruled `taken` (`stack.verdict() === 'taken'`), `routeThroughKeymap` returns `'unhandled'` without calling `run`. `routed` then hands back `{...ctx, keymapPass: 'only'}` with `fires: false`. `explain` still ranks and walks under that pass, so a keymap binding that matches comes back as `winner`. The record has `fired: '<that action>'` and `ranked[..].walk: would-fire`, but `outcome: 'unhandled'`, which is contradictory. A plain Escape the keymap binds is the same case: dispatch closes the keymap, but the record says the keymap's Escape action would fire. When `!route.fires`, `explain` should walk nothing, or report `fired: null`.
- evidence: read
- severity: low
- size: function
- cause: walk run under a pass the router never took
- confidence: likely

## A key passed on from the holding dispatcher re-dispatches the `over` bindings a peer already tried for that keystroke
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:105 (take) / :95 (onKeyDown)
- scenario: Two dispatchers share one surface. B attached first and has the pointer over it; A holds the keys. On keydown, B's window listener runs first, reaches `{held:false, over:true}` and dispatches its `over` bindings, which come back unhandled. A's listener then declines the key and `passOn` calls `B.take`. That runs `consider` again with `{held:true, over:true}`, so B's `over` bindings are asked a second time. The result is a second trace record, a second `enabled` call and a second `noteRefusal` for the same keystroke. `take` should skip the `over` reach when B's own listener already considered the event, for example by marking events it considered in `taken`.
- evidence: read
- severity: low
- size: function
- cause: over reach considered by both own listener and peer offer
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
