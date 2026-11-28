# Findings: routing.interactions.dispatcher

## A listener set torn down mid-drag leaves the pointer pinned in the view resolver
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:262 (onCancel), with attachInput.ts:160 (teardown order)
- scenario: a multi-view surface, a drag held in view B, and the listener set re-binds (the `keyboard` or a `channels` prop changes, or `enabled` toggles). Teardown sets `disposed = true` and then calls `pointer.dispose()`, which cancels each session. `onCancel` returns at `if (core.disposed()) return;` before `routeRelease(pointerId)`, so `views.resolver` (which outlives the listener set) keeps `pointerId` pinned to B. In the new listener set, each hover move of that mouse goes through `onHoverMove` → `routeAt(e.pointerId, …)` → `resolver.at(pointerId)`, which returns the pinned view B. Hovers, the hover cursor and its prediction then run in B while the pointer is over the root or another view, until the next press re-pins it. The pin should be released on teardown.
- evidence: read (`createViewResolver.at` returns the pinned view for a pinned id, core/src/domains/viewports/viewResolver.ts)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: line
- cause: early return skips routeRelease when disposed
- confidence: likely

## A pointer cancel ends its drag with world (0,0) and no `drag` or trail
- where: packages/routing/src/interactions/dispatcher/invocationCtx.ts:151 (buildInvocationCtx), reached from gestureRun.ts:57 (endGesture)
- scenario: a drag is in flight and the recognizer dispatches `{ kind: 'pointercancel', pointerId, …mods }`, which carries no x/y (gestures/src/ui/inputEvent.ts:168). Examples are a session cancel, window blur (`cancelHeld`), or a lost capture. `endGesture` builds the onEnd context with `buildInvocationCtx`. `worldPointOf` has no `pointercancel` case and returns undefined, so `world` is `{0,0}`. `pumpDrag` runs only for `pointermove`/`pointerup`, so `ctx.drag` is absent: no start, no delta and no `points`. gestureFacts' contract says `onEnd` "is handed the same trail". An onEnd that reads `ctx.drag` on cancel (to revert to `drag.start`, or to finish a lasso from `drag.points`) gets undefined, or throws, where a commit would get the trail. The cancel context should be built from the gesture's facts: its origin and its last sampled point.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/invocationCtx.ts
- size: function
- cause: pointercancel not given drag facts
- confidence: likely

## The trace's live prediction goes stale when the hover cursor resolves without predicting
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:120 (resolve)
- scenario: with the trace recording, the pointer rests at P1 over open canvas, so `setLive(() => d.explain(press@P1))`. It then moves onto an affordance that declares a `cursor`. `resolve` returns at the affordance branch before `setLive` runs, so `trace.live()` keeps answering with P1's press, at the wrong position and over the wrong target. The same happens mid-gesture, where the early `inFlightCursor` branch also leaves it alone, and after `recording()` turns off, where the old closure is never withdrawn. The devtools then show a prediction for somewhere the pointer no longer is. Each early return should call `setLive` with the current press, or with null.
- evidence: read
- severity: low
- size: function
- cause: setLive only on one branch
- confidence: sure

## A binding to an unregistered action warns on every event, including every hover move
- where: packages/routing/src/interactions/dispatcher/walk.ts:183 (walk)
- scenario: a contribution declares a `hover` binding whose `actionId` is not registered. Each pointer move dispatches a hover, and `hover()` walks with an `attempt`, so `console.warn("…no registered action. Skipping.")` fires once per mouse event: hundreds a second. The `misbound` report in gestureRun.ts deduplicates per action for exactly this reason ("a hover binding reaches this on every pointer move"). This warning should be deduplicated the same way, per actionId.
- evidence: read
- severity: low
- size: line
- cause: undeduplicated per-event warn
- confidence: sure

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
