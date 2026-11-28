# Findings: routing.interactions.dispatcher

## A listener re-bind mid-drag leaves the pointer pinned to its view in the shared resolver, so later hovers route to the old view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:293 (onCancel, via dispose)
- scenario: multi-view surface (`views` set). Press the mouse (pointerId 1) in view A. `routeDown` pins it in `views.resolver`. Mid-drag, something re-runs the attach effect (`enabled`, `keyboard`, a channel flag, or `yieldKeys` changes). Teardown sets `disposed = true` and then calls `pointer.dispose()`. That cancels every session, but `onCancel` returns early on `core.disposed()` before it reaches `routeRelease(pointerId)`, and `dispose` never calls `routeRelease` itself. The resolver outlives the listener set: it comes from `viewsRef`, and only its `end`/`clear` drop a pin. So pointer 1 stays pinned to A. On the new listener set, each hover move goes through `onHoverMove → onMove → routeAt(e.pointerId, …)`, and `ViewResolver.at` returns the pinned view for a pinned id. Hovers, hover cursors and `over` keys over view B are then routed to view A until the next press re-pins. Expected: teardown unpins every pointer it held (`routeRelease` for each session, or `resolver.end`), as a real release would.
- evidence: read (`viewResolver.ts:125-131`: a pinned id gets its pinned view)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: line
- cause: teardown skips routeRelease
- confidence: likely

## `explain` walks the keymap's own bindings for an input the keymap route ended without running any pass, so the record names a winner that a dispatch never fires
- where: packages/routing/src/interactions/dispatcher/predict.ts:37 (routed)
- scenario: a keymap is open, it binds a plain `Escape`, and no gesture is in flight. `routeThroughKeymap` closes the keymap on plain Escape and returns `'handled'` without calling `passes.run`, so `last` stays null. `routed` then returns `ctx: { ...ctx, keymapPass: 'only' }` with `fires: false`. `explain` walks that context, and the keymap's Escape binding comes out `would-fire`. The record says `fired: <keymap action>` with `outcome: 'handled'`. A real dispatch closes the keymap and never runs that action. The hover cursor's live trace (`setLive(() => d.explain(press))`) and devtools show this wrong attribution. Expected: when the route ran no pass, `explain` reports no winner (walk nothing).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/predict.ts
- size: function
- cause: fallback ctx stands in for "no pass ran"
- confidence: likely

## A key one channel heard as over-only and a peer channel on the same surface then passed on is dispatched twice, so a refusal is reported twice
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:89 (onKeyDown / take)
- scenario: two dispatchers share one surface (a trial camera and an instrument on one pane), and the pointer is over it. Channel I is attached first and does not hold the keys; channel C holds them. On a keydown, I's window listener runs first and calls `consider(e, { held: false, over: true })`. Its over bindings decline, so nothing calls `preventDefault`. C's listener then handles the key and calls `passOn` → `I.take(e)` → `consider(e, { held: true, over: true })`. That dispatches the same keystroke on I a second time and asks the same over bindings again: a second trace record, and a second `noteRefusal` for a refused key. `take` adds `e` to `taken` only after I's own listener has already run, so the guard never stops it. Expected: a channel considers a keystroke at most once, with the widest reach it gets.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: function
- cause: `taken` guard only covers peer-before-own order
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

<!-- done: 3 findings, files read: 44 -->
