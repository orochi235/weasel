## Pointer channel teardown never unpins held pointers from the view resolver, so hover after a mid-drag re-bind routes to the stale view
- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:356 (pointerInput → dispose; onCancel at 293)
- scenario: a multi-view surface (`views.resolver` is core's `createViewResolver`) re-binds its listener set during a drag. A re-bind happens whenever `keyboard`, `enabled`, `yieldKeys` or any channel flag changes. `dispose()` cancels each session, but `onCancel` returns early on `core.disposed()`, so `routeRelease(pointerId)` (`resolver.end`) never runs. The host's resolver outlives the listener set and keeps `pinned[pointerId]`. The new listener set's hover path calls `onHoverMove → onMove → routeAt(e.pointerId, …)`, and `resolver.at` returns the pinned view for that id (viewResolver.ts:127). So every hover from the mouse (pointerId 1) dispatches in the view the old drag began in, with that view's `clientToWorld` and hit-test, until the next press calls `begin` again. It should unpin on teardown, as a real cancel does.
- evidence: read (pointer.ts dispose/onCancel; core/src/domains/viewports/viewResolver.ts `at`/`end`)
- severity: medium
- fix: packages/routing/src/interactions/dispatcher/channels/pointer.ts
- size: line
- cause: teardown skips routeRelease for pointers still held
- confidence: likely

## A canvas-less dispatcher hears keys typed inside a React Aria modal
- where: packages/routing/src/interactions/dispatcher/channels/modal.ts:33 (inModalOver)
- scenario: `usePageActions`, or any dispatcher with no canvas, has `canvas === null`. A key pressed on a non-field element inside a React Aria modal reaches `inModalOver(target, null)`. That modal is a `role="dialog"` that inerts or aria-hides the page instead of setting `aria-modal`. The `hiddenBehind` branch requires `canvas !== null`, so the check returns false and the page shortcut fires behind the modal. An `aria-modal="true"` dialog or a native modal `<dialog>` blocks the same dispatcher. The same modal is answered two ways depending on how it marks itself modal, and the doc names React Aria's style as one this function covers.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/modal.ts
- size: line
- cause: hidden-behind test needs a canvas to probe
- confidence: likely

## Hover cursor and painted pointer are left set after a drag released outside a surface that takes its controls
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:181 (moved/released)
- scenario: the surface has `controls: 'take'` and the press lands on a control, so the session opens without capture (pointer.ts:330). The pointer leaves the canvas mid-press, and `pointerleave` → `onLeave` → `clear()` runs. The session keeps delivering held moves from outside, and each calls `hover.moved(e)`. That sets `last` again, dispatches a `hover`, and `refresh()` writes the cursor override and `painted.setPointer` for a point outside the canvas. On release outside, `released` → `refreshSoon` resolves the idle cursor again. No further `pointerleave` arrives, so the override and the painted pointer stay until the pointer next enters and leaves. It should not re-arm `last` for a pointer that is not over the canvas.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts, packages/routing/src/interactions/dispatcher/attachInput.ts
- size: function
- cause: hover state re-armed by session moves after leave
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
