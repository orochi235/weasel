# Findings: routing.interactions.dispatcher

## A multitouch gesture that opens with no `angle` never accumulates rotation
- where: packages/routing/src/interactions/dispatcher/gestureFacts.ts:72 (createGestureFacts.begin / turn)
- scenario: `handleInput` gets a `multitouch` event with `centroid` and `spread` but no `angle` (the field is optional on `InputEvent`; a host or test synthesizing multitouch can leave it off), followed by moves that do carry `angle`. `begin` only calls `turns.set` when `event.angle !== undefined`, so `turn()` finds no entry and returns at once. `of()` then reports no `rotation`, and `InvocationCtx.multiTouch.rotation` stays 0 for the whole gesture. The branch in `turn` commented "A gesture that opened on no angle turns from its first one" (`!Number.isFinite(turn.last)`) can never run for this case. What should happen: the turn is counted from the first angle that arrives.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/gestureFacts.ts
- size: line
- cause: turn entry made only when the opening angle is defined
- confidence: sure

## A drop whose item materialization rejects, or whose dispatch throws, becomes an unhandled promise rejection
- where: packages/routing/src/interactions/dispatcher/channels/ingest.ts:96 (onDrop)
- scenario: an OS drop on the canvas where `itemsFromDataTransfer(dt)` rejects (a file read that fails), or where something in the `.then` body throws (a dep or rule lookup inside `dispatch`). The promise is `void`ed and has no `.catch`, so the error surfaces as an unhandledrejection with no "weasel dispatcher" context. `preventDefault` has already run, so the drop is silently lost. Every other path here catches and `console.error`s with a prefix (dropPreview, gestureRun).
- evidence: read
- severity: low
- size: line
- cause: missing rejection handler on the materialization promise
- confidence: likely

## `DispatchRecord.matched` is documented as matcher order but is the ranked order with barred matches appended
- where: packages/routing/src/interactions/dispatcher/buildDispatchRecord.ts:73 (buildDispatchRecord)
- scenario: a record for an input where one binding names the routed view, or an `eligible` rule reorders a tie, or an exclusive claim bars some bindings. `matched` is built as `[...r.ordered, ...r.barred]`, and `r.ordered` has already been reordered by `preferViewScoped` and `preferContextual`. Barred matches are listed after every admitted one rather than in their scope and specificity place. `dispatchRecord.ts:16` says "Every binding whose spec matched the input, in matcher order", so a devtools reader or fixture author relying on that order gets something else.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/dispatchRecord.ts
- size: line
- cause: doc describes a different order than the code builds
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
