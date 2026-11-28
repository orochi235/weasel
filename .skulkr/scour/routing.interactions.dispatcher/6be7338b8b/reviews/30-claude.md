## resolveAll returns no candidates for an input an open keymap passes on when nothing in the pass fires
- where: packages/routing/src/interactions/dispatcher/predict.ts:41 (routed / resolveAll)
- scenario: a keymap is open; a Ctrl/Cmd chord, a bare modifier, Tab, or a cascaded key is passed on with `run('none', …)`. Every candidate in that pass is disabled (`enabled()` refuses). `routed` reports `fires: false` because the pass was unhandled, and `resolveAll` returns `[]` at `if (!route.fires) return []`. With no keymap open the same input lists each candidate with a `disabled` verdict. The doc says only an input the keymap *withholds* (a key it swallows, a press kept for a click) lists none; an input passed on and merely unhandled should still list its candidates with their verdicts.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/predict.ts
- size: function
- cause: "not fired" conflated with "withheld by the keymap"
- confidence: likely

## A drag handed off goes through a ranking that skips keymap routing
- where: packages/routing/src/interactions/dispatcher/handOff.ts:19 (handOff)
- scenario: a keymap is open and a press was routed through `routeThroughKeymap` (pass `'only'`, then `'none'`). The drag's handle returns `'pass'` from `onMove`. `handOff` calls `rank(press, ctx, …)` with the move's ctx, where `keymapPass` is undefined. `assembleScopedBindings` then puts the keymap's entry bindings in alongside every other binding. So the drag can go to a candidate that neither of the press's passes would have offered, such as a keymap binding the `'none'` pass excludes. Expected: the hand-off offers the same candidates the press's own routing did.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/handOff.ts, packages/routing/src/interactions/dispatcher/gestureRun.ts
- size: function
- cause: hand-off re-ranks without the keymap pass the press ran under
- confidence: likely

## A wheel's and a pinch's immediate params drop bodyTarget and bodyKind that the event carries
- where: packages/routing/src/interactions/dispatcher/inputFacts.ts:147 (carried, 'wheel' / 'pinch' cases)
- scenario: the wheel and pinch channels spread `underPointer(...)` onto the event, so it carries `bodyTarget`/`bodyKind` (wheel.ts:50, webkitPinch.ts:63). `carried()` copies only `affordance` for these two kinds. An immediate wheel action, for example "scroll a hovered node's value", reads `params.bodyTarget` and gets undefined. Click, press, contextmenu and hover pass the same fields through `landed()`. The option is silently dropped on one path.
- evidence: read
- severity: low
- size: line
- cause: wheel/pinch branches omit fields landed() copies
- confidence: likely

## A binding to an unregistered action warns on every hover move, with no dedupe
- where: packages/routing/src/interactions/dispatcher/walk.ts:177 (walk)
- scenario: a `hover` binding (or any binding a hover matches) names an action id that is not registered. `dispatcher.hover()` walks with an `attempt` on every pointer move, so `walk` calls `console.warn` once per mouse event, flooding the console. `reportMisbound` in gestureRun.ts dedupes the same kind of misconfiguration per action for exactly this reason ("a hover binding reaches this on every pointer move").
- evidence: read
- severity: low
- size: line
- cause: missing once-per-id guard on the misconfiguration warning
- confidence: sure

## After a held drag nothing hovers, the next hover's `from` is where the press began
- where: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts:178 (moved / released)
- scenario: no binding hears held hovers, so `heard.hears()` is false for the whole drag and `facts` is never updated. The pointer is released elsewhere on the canvas and moves. The first `hoverAt` sends `from: whereOf(facts.where)`, which is the hit under the pointer *before the press*, not what it was over at release. A hover binding keyed on enter/leave transitions (`from` differing from the current target) sees a spurious transition from the press origin. `onLeave` likewise reports the stale pre-press `where` and position. Expected: `facts` is reset (or recomputed) on release.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/dispatcher/channels/hoverCursor.ts
- size: line
- cause: hover facts not invalidated across an unheard held drag
- confidence: likely

## A non-modal ARIA dialog counts as modal whenever any ancestor of the canvas is aria-hidden or inert
- where: packages/routing/src/interactions/dispatcher/channels/modal.ts:33 (inModalOver)
- scenario: the canvas sits inside a wrapper that has `aria-hidden="true"` for an unrelated reason (a decorative or offscreen container, or a closed drawer marked inert). A non-modal `role="dialog"` popover elsewhere has focus, with no `aria-modal`. `hiddenBehind(canvas)` is true, so `inModalOver` reports a modal. Keys and pastes typed in the popover are dropped by the keyboard and ingest channels, although nothing modal is open. The check cannot tell whether *this* dialog caused the hiding.
- evidence: read
- severity: low
- size: function
- cause: inert/aria-hidden heuristic not tied to the dialog
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

<!-- done: 6 findings, files read: 44 -->
