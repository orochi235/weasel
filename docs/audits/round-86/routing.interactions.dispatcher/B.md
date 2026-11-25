# Audit round 86 — routing.interactions.dispatcher (blind reviewer)

## An OS drop on a dispatcher surface nested inside another is ingested by both
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:63 (onDrop), :31 (onDragOver)
- scenario: two dispatchers, the inner one's canvas nested in the outer's (the case `landedNestedIn` / `pressedNestedIn` / `eventTaken` exist for). A file dropped on the inner canvas fires `drop` there, which dispatches it; the event then bubbles to the outer canvas's `drop` listener, which routes and dispatches it again, so the file is inserted twice (once per scene). Likewise each `dragover` is resolved by both and the outer toggles `weasel-dropover` and runs its own `Action.preview` under the inner surface. Wheel (`landedNestedIn`), contextmenu and pinch (`eventTaken`) all leave an event to the innermost surface; the drop channel answers the same question the other way. The innermost surface should own it (e.g. `landedNestedIn(canvas, e)` → return), independent of whether its async dispatch ends up handled.
- evidence: read
- severity: medium

## Teardown leaves the trace's live prediction pointing at the torn-down listener set
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:148 (teardown), channels/hoverCursor.ts:116 (resolve)
- scenario: while a trace is recording, an idle hover calls `ctx.trace.setLive(() => d.explain(press, ctx))`. Only `onLeave` withdraws it. When the listener set is torn down with the pointer still over the canvas (a `channels`/`keyboard` change re-binds, or unmount with a host-supplied `trace` that outlives it), teardown calls `hover.clear()`, which clears only the cursor override; `trace.live()` keeps returning a record built from the old dispatcher and context, and the closure retains them. Teardown should `setLive(null)`.
- evidence: read
- severity: low

## Teardown leaves the painted cursor's pointer position set
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:148 (teardown)
- scenario: the pointer rests over a canvas showing a painted cursor (`painted.setPointer` from `refresh`). The listener set is torn down (dispatcher disabled, channels re-bound). `hover.clear()` removes the override but, unlike `onLeave`, never calls `paintedCursor()?.clearPointer()`, so the painted-cursor layer keeps drawing a glyph at the last position over a surface that no longer tracks the pointer.
- evidence: read
- severity: low

## A `dispatcher` option that changes after mount is silently ignored
- where: packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx:80 (useDispatcherIn)
- scenario: a host passes `dispatcher={d1}`, later `dispatcher={d2}` (or passes one only after first render). `dispatcherRef.current ??= …` keeps the first value forever, so events keep pumping into d1 (or a private dispatcher) while the host's preview layer subscribes to d2 and never sees a gesture. The option is documented as "this hook pumps events into the supplied instance"; it should follow the prop (or warn).
- evidence: read
- severity: low

## A hover binding naming an ongoing action logs a console.error on every pointer move
- where: packages/routing/src/interactions/dispatcher/dispatcher.ts:140 (hover) → gestureRun.ts:223 (invokeAction)
- scenario: an action with an ongoing invoker bound (by a consumer or an override) to a `hover` spec. Each hover walks with an attempt that calls `invokeAction`, which logs "has an ongoing invoker but is bound to a hover spec" and returns `misbound`; `hover()` maps every result to `'empty-handle'` and keeps walking, so the same error is printed once per `pointermove` (hundreds per second) rather than once. Other misbinding diagnostics in the area (`reportDeadClaim`) dedupe.
- evidence: read
- severity: low

## A window blur mid-pinch resets the step baseline while Safari keeps sending cumulative scale
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:93 (onWindowBlur) → channels/webkitPinch.ts:28 (endPinch)
- scenario: during a claimed trackpad pinch at cumulative `scale` 1.8, the window blurs (a notification steals focus) and `pinch.end()` sets `pinchScale = 1`, `pinchLive = false`. If the WebKit gesture stream continues to the page, the next `gesturechange` (scale 1.82) is dispatched as a 1.82× step instead of ~1.01×, jumping the zoom; and with `pinchLive` false, an unhandled change is no longer prevented, handing the rest to Safari's page zoom. Blur should end the dispatched pinch without zeroing the baseline of a stream still in progress (or ignore changes until the next `gesturestart`).
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

<!-- done: 6 findings, files read: 44 -->
