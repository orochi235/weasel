## resolveAll labels an ineligible candidate below the winner `shadowed`, contradicting its contract
- where: packages/routing/src/interactions/dispatcher/walk.ts:206 (verdictsOf)
- scenario: two bindings match a key; the first passes and would fire, the second's action has an `eligible` rule that is false. `resolveAll` (default `evaluateShadowed: false`) reports the second as `{ kind: 'shadowed' }`. `Dispatcher.resolveAll`'s doc (dispatcherApi.ts) says "Nothing is dropped: candidates that resolveOnly's walk would filter out are kept here and labeled `ineligible` instead", and `shadowed` means "never asked". Eligibility was already evaluated in `rank` (`r.eligible`), so the rule's verdict is known and free; an inspector showing why a binding is dead reads "shadowed" for an action that could never fire in this context.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/walk.ts
- size: line
- cause: ineligible branch gated on `fired && !evaluateShadowed`
- confidence: sure

## immediateRunParams lets the dispatcher's `viewId` and `roles` overwrite the binding's own params
- where: packages/routing/src/interactions/dispatcher/inputFacts.ts:118 (immediateRunParams)
- scenario: a binding declares `opts.params: { viewId: 'minimap' }` (or a `roles` param) for an immediate action. `immediateParams` spreads `resolved` last so the binding wins, as `ImmediateParams`' doc promises ("beneath the binding's own params, which win on a clash"), but `immediateRunParams` then assigns `params.viewId = run.viewId` and `params.roles = …` after it, so the binding's value is silently replaced. The same function feeds drop previews (dropPreview.ts), so both paths disagree with the documented precedence.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/inputFacts.ts
- size: line
- cause: post-spread assignment ignores the binding-wins rule
- confidence: sure

## A dispatch on a dispatcher no longer in `dispatchers()` unsubscribes it, so its gesture's end asks no redraw
- where: packages/routing/src/interactions/dispatcher/attachInput.ts:71 (attachInput, `uses`)
- scenario: a key is held on a view's dispatcher (`HeldKey.on`), then that view unmounts, so `views.targets()` drops it. On keyup, `releaseIn` dispatches through `core.dispatch(ev, down.on)`, which calls `src.uses(down.on)`; `uses` ignores its argument and runs `redraw.sync(src.dispatchers())`, which unsubscribes `down.on`. The release's `notify()` from ending the handle then reaches no listener: no `requestRedraw`, no cursor `changed()`, so an overlay the held gesture drew stays on screen until something else repaints. The `DispatchCoreSources.uses` doc says it is "told of the dispatcher each event is about to run on", but that dispatcher is never added to the watch.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/attachInput.ts, packages/routing/src/interactions/dispatcher/dispatcherWatch.ts
- size: function
- cause: `uses` drops its dispatcher argument
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
