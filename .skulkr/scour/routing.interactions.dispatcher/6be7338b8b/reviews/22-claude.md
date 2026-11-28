## A binding naming an unregistered action warns on every pointer move
- where: packages/routing/src/interactions/dispatcher/walk.ts:197 (walk)
- scenario: a tool or contribution declares a `hover` binding (or any binding a hover matches) whose `actionId` has no registered action, say because the action's provider unmounted. `dispatcher.hover()` calls `walk` with an `attempt` on every mouse move, and `walk` runs `console.warn("… no registered action. Skipping.")` each time an attempt is given, with no dedupe. The console floods with one warning per move. The same happens for a key held on autorepeat that reaches it. `reportMisbound` in gestureRun.ts dedupes this same class of misconfiguration once per action; this path should do the same.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/walk.ts
- size: line
- cause: undeduped dev warning on a per-move path
- confidence: sure

## A peer on one surface dispatches a keystroke's `over` bindings twice
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:103 (take / onKeyDown)
- scenario: two dispatchers share a canvas (the trial camera and the instrument). The peer that does not hold the keys attached its window listener first. A key goes down with the pointer over the canvas. The peer's own `onKeyDown` runs with `reach = { held: false, over: true }` and dispatches its `over` bindings, and none handles the key, so nothing calls `preventDefault`. The holder then declines, and `passOn` calls the peer's `take`, which runs `consider(e, { held: true, over: true })`. That reaches the same `over` bindings again. Each one's `enabled()` is asked twice and two trace records are written. A refusal on an `over` binding reports through `noteRefusal` twice, and `keymapKeys.press` runs twice for one keystroke. `taken` only guards a peer whose listener runs after the `take`, not one whose listener ran before it.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: function
- cause: the `taken` set is checked only in one listener order
- confidence: likely

## The DispatchRecord says `matched` is in matcher order, but it is in ranked order
- where: packages/routing/src/interactions/dispatcher/buildDispatchRecord.ts:73 (buildDispatchRecord)
- scenario: `DispatchRecord.matched` is documented (dispatchRecord.ts:15) as every matched binding "in matcher order". The record fills it from `[...r.ordered, ...r.barred]`. `r.ordered` has already been reordered by `preferViewScoped` and `preferContextual`, and the barred matches are appended after all admitted ones instead of in their scope-tier place. A devtools reader comparing `matched` with `ranked` to see what ranking changed sees no difference for the view and context steps.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/dispatchRecord.ts
- size: line
- cause: doc and implementation disagree on the order
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

<!-- done: 3 findings, files read: 44 -->
