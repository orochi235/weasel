# Findings: routing.interactions.dispatcher

## An ongoing handle carrying only `onWheel`, `cursor` or `subscribe` is treated as empty and dropped
- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:120 (isEmptyOngoingHandle)
- scenario: a key-held action whose `start` returns `{ onWheel }` (hold a key, scroll to adjust), or `{ cursor }` (hold a key to show a cursor), or `{ kind, subscribe, onWheel }`. `OngoingHandle` declares `onWheel`, `cursor`, `subscribe` and `kind` (invoker.ts:222-333), but `isEmptyOngoingHandle` looks only at `onMove`, `onEnd`, `overlay`, `previewIds` and `previewPose`. So `invokeAction` (gestureRun.ts) reads the handle as "decided not to engage", drops its facts and falls through to the next candidate. Nothing goes in flight, `pumpGesture`'s wheel loop never offers the wheel to it, and `inFlightCursor` never shows its cursor. The same predicate makes `uiOngoing.begin` return null and `deferredStart` pass the drag on. It should count any of the handle's declared members.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/inFlightGestures.ts
- size: line
- cause: emptiness predicate omits handle members
- confidence: likely

## The hover's live trace prediction goes stale over an affordance and during a gesture
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:121 (resolve)
- scenario: devtools are recording, and the pointer moves from open canvas onto a resize handle whose affordance carries a `cursor`. `resolve` returns at the affordance branch (and at the held/in-flight branch above it) before `ctx.trace.setLive(...)`. So `trace.live()` keeps explaining a press at the previous, off-handle point, which is the wrong action for where the pointer now rests. It should set (or withdraw) the live record on every resolve that changes the point.
- evidence: read
- severity: low
- size: line
- cause: setLive skipped on early returns
- confidence: sure

## `explain` reports a keymap's Escape binding as would-fire, though dispatch closes the keymap instead
- where: packages/routing/src/interactions/dispatcher/predict.ts:85 (explain)
- scenario: a keymap is open, binds plain Escape, and no gesture is in flight. `routeThroughKeymap` handles plain Escape by `closeInnermost` and returns 'handled' without running any pass, so in `routed` `last` stays null and `route.ctx` falls back to `{ keymapPass: 'only' }` with `fires: false`. `explain` still ranks and walks that ctx, so the record has `fired: <keymap's Escape action>`, a `would-fire` step and outcome 'handled'. A real dispatch fires nothing and only closes the keymap. `resolveOnly` and `resolveAll` agree with the dispatch (they return null or [] when `!fires`); `explain` should not walk a winner when `route.fires` is false.
- evidence: read
- severity: low
- size: function
- cause: explain walks a pass the route never ran
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
