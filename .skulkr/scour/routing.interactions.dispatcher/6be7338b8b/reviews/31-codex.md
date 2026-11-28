# Review saturation — routing.interactions.dispatcher

Snapshot: 6be7338b8bdce6605ac6e3dc75ee21365f18be5e

Scope: the 44 files in `/private/tmp/skulkr-saturation/lists/routing.interactions.dispatcher.txt`. The detached checkout matched the snapshot and had no tracked changes. Adjacent contracts, callers, and tests supplied evidence. The passes shared context and deduplicated findings by root cause. Evidence is from source walkthroughs. No tests were executed.

## Pass ledger

| Pass | Focus | New | Cumulative | No-new streak |
| --- | --- | ---: | ---: | ---: |
| 1 | Input translation and multi-view routing, from DOM coordinates through classifiers to camera and hover actions | 2 | 2 | 0 |
| 2 | Gesture lifetime, including handle admission and listener teardown while a pointer remains down | 2 | 4 | 0 |
| 3 | Divergence between preview, prediction, and dispatch, including keymap entry and its diagnostic record | 3 | 7 | 0 |
| 4 | Timing and numeric boundaries, including deferred drag admission, pinch step calculation, multitouch turn wrapping, and menu release timing | 0 | 7 | 1 |
| 5 | Nested-surface ownership and event order, including wheel capture and bubble, native menu deduplication, OS drop ownership, and carry stage matching | 0 | 7 | 2 |
| 6 | Diagnostic and ranking boundaries, including eligibility tie groups, duplicate action verdicts, refusal delivery, and retention in the trace ring | 0 | 7 | 3 |

Stop reason: three consecutive completed passes yielded no new distinct findings.

## Findings index

| ID | Severity | Finding |
| --- | --- | --- |
| RID-01 | Medium | Wheel and WebKit pinch anchor a view-local camera in canvas coordinates |
| RID-02 | Medium | Surface leave can dispatch on a different view from its last hover |
| RID-03 | Medium | Listener teardown strands active pointer pins in the shared view resolver |
| RID-04 | Medium | A handle that only claims wheel input is discarded |
| RID-05 | Medium | A stationary OS drag keeps a preview after its binding params change |
| RID-06 | Medium | An open keymap can consume an opted-in text-field chord |
| RID-07 | Low | Explain names a winner for Escape even when the keymap intercepts it |

## RID-01 — Wheel and WebKit pinch anchor a view-local camera in canvas coordinates

- where: packages/routing/src/interactions/dispatcher/channels/wheel.ts:37 (`wheelInput`), packages/routing/src/interactions/dispatcher/channels/webkitPinch.ts:47 (`pinchEventOf`)
- scenario: Put a `CanvasView` at canvas x=100 and zoom at canvas x=150, which is view x=50. The channels select the view and its camera but send x=150 as the focal coordinate. In an initially unshifted view at 1×, zooming to 2× yields camera x=75 instead of x=25. The point under the pointer drifts. Both channels should pass x=50 to the view camera and keep the original client point for the screen field.
- evidence: read. `CanvasView.tsx:193` provides a view-local mapper and its own view dep. `viewportZoom.ts:173` reads the supplied focal pixels and passes them to `zoomAt`. `dispatchCore.ts:204` already exposes the view-local mapping used by multitouch.
- severity: medium

## RID-02 — Surface leave can dispatch on a different view from its last hover

- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:177 (`onLeave`)
- scenario: Move over view A to open a hover overlay, then dispatch a coordinate-bearing event over view B without a hover sample there. A wheel event over B suffices. Leave the surface. The leave event carries A's previous hit but converts its point and dispatches using B's current route. A's view-scoped leave binding never clears the overlay. The leave should use the view that received the hover whose hit it reports.
- evidence: read. The hover facts at line 152 store only the sample and hit. `wheel.ts:34` changes the route, and `dispatchCore.ts:205` uses the current target to choose the dispatcher and context.
- severity: medium

## RID-03 — Listener teardown strands active pointer pins in the shared view resolver

- where: packages/routing/src/interactions/dispatcher/channels/pointer.ts:356 (`dispose`), called from packages/routing/src/interactions/dispatcher/attachInput.ts:157
- scenario: Press with pointer 7 inside view A and change the keyboard option while held, keeping the canvas and resolver mounted. The effect tears down and reattaches the input listeners. The old sessions are canceled after `disposed` becomes true, so their callbacks skip `routeRelease`. Move pointer 7 over view B without a fresh down. The reattached pointer channel routes the move with ID 7, and the resolver still sends the hover to A. The pin should end with the old session.
- evidence: read. `pointer.ts:294` skips normal release on disposal. `useGestureDispatcher.tsx:171` rebinds on a keyboard change. `viewResolver.ts:125` honors the retained pin until `end` or a subsequent press replaces it.
- severity: medium

## RID-04 — A handle that only claims wheel input is discarded

- where: packages/routing/src/interactions/dispatcher/inFlightGestures.ts:119 (`isEmptyOngoingHandle`)
- scenario: Bind an ongoing Space hold whose `start` returns just `{ onWheel: () => true }`. Hold Space and scroll. The dispatcher treats this handle as empty, sends the wheel to its ordinary binding, and the camera scrolls. The hold should keep the wheel callback in flight and allow it to claim the wheel.
- evidence: read. `actions/invoker.ts:327` defines `onWheel` as a wheel consumer. `gestureRun.ts:152` pumps that callback for a retained handle, but line 284 rejects the handle before it reaches the map.
- severity: medium

## RID-05 — A stationary OS drag keeps a preview after its binding params change

- where: packages/routing/src/interactions/dispatcher/channels/dropPreview.ts:20 (`keyOf`) and line 44 (`show`)
- scenario: Give a drop binding thunked params that select an insertion variant and render that variant in the action's preview. Change the setting while holding the drag at the same point with the same modifiers and item types. A subsequent dragover resolves the new params, but the cache keeps the previous preview. The drop invokes with the new params. The preview should reflect the newly resolved variant on the next dragover.
- evidence: read. `predict.ts:71` resolves binding params and `ingest.ts:53` passes the winner to the preview each time. The preview key omits those params even though line 50 passes them to the preview callback.
- severity: medium

## RID-06 — An open keymap can consume an opted-in text-field chord

- where: packages/routing/src/interactions/dispatcher/keymapRoute.ts:66 (`routeThroughKeymap`), called from packages/routing/src/interactions/dispatcher/channels/keyboard.ts:116
- scenario: Register a page Ctrl+S binding with `inFields: true` and a higher-priority Ctrl+S binding with `inFields: true` in a keymap. Open the keymap, focus a text field, then press Ctrl+S. The keyboard channel passes field reach, but keymap routing tries the open map first. Its action takes the chord and the usual field-enabled action never gets it. Field reach should retain the channel's documented behavior where only ordinary field-enabled bindings hear the chord and the keymap remains open.
- evidence: read. `keyboard.ts:115` states the exclusion. `ranking.ts:22` permits any opted-in binding, and `keymapRoute.ts:89` tries the open map before its normal chord path.
- severity: medium

## RID-07 — Explain names a winner for Escape even when the keymap intercepts it

- where: packages/routing/src/interactions/dispatcher/predict.ts:88 (`explain`)
- scenario: Open a keymap containing an enabled Escape binding and leave all handles idle. `handleInput` closes the keymap without invoking an action, and `resolveOnly` returns null. `explain` independently walks the keymap candidates after routing has determined that there is no action to run, marks the Escape binding `would-fire`, and sets `fired` to its action ID. The record should show the handled input with no winner.
- evidence: read. `keymapRoute.ts:79` handles plain Escape before trying the keymap. The quiet router in `predict.ts:37` reports `fires: false`, but `explain` still supplies its fresh walk's winner to `buildDispatchRecord.ts:68`.
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

<!-- done: 7 findings, files read: 44 -->
