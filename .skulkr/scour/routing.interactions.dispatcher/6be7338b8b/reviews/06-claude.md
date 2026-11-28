## A listener set torn down mid-drag leaves the pointer pinned in the view resolver, so later hovers route to the stale view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:262 (onCancel), :352 (dispose)
- scenario: a surface with `views` (a viewport panel). The mouse (pointerId 1) presses in view A; `routeDown` calls `resolver.begin(1, …)`, which pins 1 → A. Before release the listener set re-binds (a `keyboard`/channel/`yieldKeys` change, or `enabled` toggled). `attachInput`'s teardown sets `disposed = true`, then `pointer.dispose()` cancels each session. `onCancel` returns early on `core.disposed()` before `routeRelease`, and `dispose` never calls it either, so `resolver.end(1)` never runs. The resolver outlives the listener set (it comes from `views`). In the new listener set, each unpressed mouse move goes through `onHoverMove → onMove → routeAt(1, …)`, and `ViewResolver.at` hands back the pinned view A wherever the pointer is. So `hover` events (and their `affordanceAt`/`classifyTarget` hit tests and world points) run on view A's dispatcher and camera until the next press re-pins. It should unpin every pointer held at teardown.
- evidence: read (traced through `createViewResolver.at` in packages/core/src/domains/viewports/viewResolver.ts:125)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: function
- cause: teardown skips routeRelease for held pointers
- confidence: likely

## A keystroke can reach a peer dispatcher twice when that peer's own window listener ran first, so its `over` bindings dispatch twice
- where: packages/routing/src/interactions/dispatcher/channels/keyPeers.ts:23 (passOn); channels/keyboard.ts:91 (onKeyDown), :101 (take)
- scenario: two dispatchers share one surface. A attached first and its window keydown listener runs first, but B holds the keys and the pointer is over the surface. A's `onKeyDown` runs `consider(e, { held: false, over: true })`, which dispatches A's `over` bindings. Say none handles it. B's listener then runs `consider` with `held: true`; when that declines, `passOn(canvas, B.take, e)` calls `A.take(e)`. `taken` only guards A's own listener from running *later*, so A runs `consider(e, { held: true, over: true })` and the same `over` bindings dispatch again. The results: two trace records, two `refused`/`noteRefusal` calls, two runs of any immediate `run` that does work and then returns `'pass'`, and two `keymaps.press` bookkeeping passes for one keystroke. Each channel should consider a keystroke at most once, or a peer that already considered it should only get the held-only bindings.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: function
- cause: `taken` marks only events offered by peers, not ones the channel already considered itself
- confidence: likely

## In a text field, a character typed with AltGr counts as a Ctrl chord, so an `inFields` Ctrl+Alt binding swallows the typed character
- where: packages/routing/src/interactions/dispatcher/channels/keyboard.ts:56 (fieldChord), :118 (consider, field branch)
- scenario: on a German layout, typing `@` (AltGr+Q) in an input reports `ctrlKey` and `altKey` with key `@`. `fieldChord` sees `ctrlKey` and lets the key through as a chord, and the field branch dispatches it with `typedMods(e)` (the real Ctrl+Alt). The `typedWithAltGraph` handling that the non-field path uses is never applied here. A binding declaring `inFields` that matches Ctrl+Alt+`@` (or one matching on `code` KeyQ with Ctrl+Alt) fires and calls `preventDefault`, so the `@` never reaches the field. In a field, a keystroke AltGr typed is text, and `fieldChord` should exclude it (`typedWithAltGraph(e)`).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/keyboard.ts
- size: line
- cause: fieldChord ignores AltGraph
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
