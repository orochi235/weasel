# Audit round 78 — gestures — blind reviewer findings

## A two-finger tap is timed and travel-checked from the second finger's landing, so a brief second touch during a one-finger drag or after a long-press emits `multitouchtap`
- where: packages/gestures/src/recognizer/multiTouch.ts:69 (createMultiTouchEpisode.join), packages/gestures/src/recognizer/pointerRecognizer.ts:211 (claimForMultiTouch)
- scenario: finger 1 goes down at t=0 and drags 200 px, which opens its drag (its buffered press is already gone, so the drag "survives"). At t=900 a palm or finger 2 touches for 100 ms and lifts, then finger 1 lifts. `join` sets `startedAt` to t=900 and `joinedAt` for finger 1 to where it is *now*. When finger 2 lifts (`before === 2`), `finish` sees a 100 ms episode with no travel since the join, so `multitouchtap { fingers: 2 }` is dispatched, on top of the drag that is still running. The same happens when finger 1 was held past `LONG_PRESS_MS` and its long-press already fired and was handled: that comment says "a hold as long as a long-press is not a tap, for two fingers as for one", but only the time since the second finger landed is measured. A two-finger-tap binding (commonly undo) fires during a stroke. It should fire only when every finger in the episode is a fresh press: none has already been spent by a drag or a long-press, and the episode is timed from the earliest press. `recognizerModel.fixture.ts` copies the same rule (`startedAt: now` at the join), so the stateful property test cannot catch this.
- evidence: read
- severity: medium

## Going from 2 to 3 fingers starts a new gesture without ending the old one; going from 3 back to 2 ends it and nothing restarts it
- where: packages/gestures/src/recognizer/pointerRecognizer.ts:207 (claimForMultiTouch), :172 (liftFinger)
- scenario: two fingers are pinching (a `multitouch` for 2 fingers is in flight). A third finger lands: `claimForMultiTouch` dispatches a geometry event with `fingers: 3` and no `end` for the 2-finger gesture. One finger then lifts: `liftFinger` dispatches `{ fingers: 3, end: 'commit' }`. From then on `move` pumps only `if sink.multiTouchInFlight(2)`, which is false, so the two fingers still down move nothing until one is pressed again. The `end` doc on `MultiTouchEvent` says it ends "the running multitouch gesture, whatever its finger count". Either the change of count should end and restart the gesture, or lifting from 3 should keep a 2-finger one going. This rests on the dispatcher starting a gesture only on a geometry event that carries no `end` (inferred, not run).
- evidence: read (dispatcher behavior inferred)
- severity: low

## `fixedSeat` misses `transform-style: preserve-3d` (and `offset-path`) as containing blocks for fixed descendants
- where: packages/gestures/src/ui/fixedSeat.ts:24 (containsFixed)
- scenario: a portal host's ancestor has `transform-style: preserve-3d` (a 3D card stage) but no transform of its own. Per CSS Transforms 2, preserve-3d sets up a containing block for every descendant, fixed ones included, so the ghost's `left: 0; top: 0` lands on that ancestor. `containsFixed` checks neither `transformStyle` nor `offsetPath`, so `fixedSeat` falls through to `{ left: 0, top: 0 }`, and the drag ghost is drawn offset by the ancestor's client position.
- evidence: read (spec rule from memory)
- severity: low

## `formatShortcut` drops `shift: 'optional'` only on the key itself, not on its leader steps
- where: packages/gestures/src/ui/formatShortcut.ts:72 (formatShortcut)
- scenario: `formatShortcut({ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] })`. The doc says "`shift: 'optional'` is treated as falsy", but only `b.shift` is normalized. The leader's shortcut goes through `keyLegendsFromShortcut` unchanged, so its optional shift becomes a ⇧ / `Shift+` chip. The single string has no way to mark a chip optional, so it reads `Loupe ▸ ` with the leader drawn as a required `Shift+L`, while the key itself drops its optional shift.
- evidence: read
- severity: low

## `describeRoute` prints target forms verbatim after "a", and `ROUTE_FIELD_DEFINITIONS` describes the slots inaccurately
- where: packages/gestures/src/grammar/describeRoute.ts:91 (targetClause), :66 (leftClause), :103 (carryOnto), :21 (ROUTE_FIELD_DEFINITIONS)
- scenario: `[initial] click => selected-body` reads "Fires when the user clicks on a selected-body, …"; `=> kind:text:selected` reads "on a kind:text:selected"; `=> affordance:handle:nw` reads "on a affordance:handle:nw"; `hover(leave) => kind:rect` reads "off a kind:rect". Only `empty` and `*` are turned into prose. `ROUTE_FIELD_DEFINITIONS.target` says "otherwise the value names a specific hit-target kind", but the slot takes the `TargetSpec` forms (`selected-body`, `unselected-body`, `kind:<k>[:selected]`, `affordance:<k>`). `.phases` lists only `initial` and `engaged`, though the grammar also takes the `*` phase. Inspector UIs that use these as documentation show wrong or garbled text.
- evidence: read
- severity: low

## Files read
packages/gestures/src/grammar/canonicalModifiers.ts
packages/gestures/src/grammar/describeRoute.ts
packages/gestures/src/grammar/gestures.ts
packages/gestures/src/grammar/keyRouteGrammar.ts
packages/gestures/src/grammar/routeGrammar.ts
packages/gestures/src/grammar/routeToSpec.ts
packages/gestures/src/grammar/specKinds.ts
packages/gestures/src/index.ts
packages/gestures/src/longPress/pressRing.ts
packages/gestures/src/longPress/pressState.ts
packages/gestures/src/pbt.fixture.ts
packages/gestures/src/recognizer/click.ts
packages/gestures/src/recognizer/longPressHold.ts
packages/gestures/src/recognizer/multiTouch.ts
packages/gestures/src/recognizer/pointerRecognizer.ts
packages/gestures/src/recognizer/pressFacts.ts
packages/gestures/src/recognizer/recognizerModel.fixture.ts
packages/gestures/src/recognizer/samples.ts
packages/gestures/src/recognizer/thresholds.ts
packages/gestures/src/ui/bodyClassification.ts
packages/gestures/src/ui/clientScale.ts
packages/gestures/src/ui/controlTarget.ts
packages/gestures/src/ui/dragThreshold.ts
packages/gestures/src/ui/fixedSeat.ts
packages/gestures/src/ui/formatShortcut.ts
packages/gestures/src/ui/heldPointers.ts
packages/gestures/src/ui/historyKey.ts
packages/gestures/src/ui/ingestTypes.ts
packages/gestures/src/ui/inputEvent.ts
packages/gestures/src/ui/keyLegendFromCode.ts
packages/gestures/src/ui/keyLegendsFromMods.ts
packages/gestures/src/ui/keyLegendsFromShortcut.ts
packages/gestures/src/ui/keyLetter.ts
packages/gestures/src/ui/keyOwner.ts
packages/gestures/src/ui/keySugar.ts
packages/gestures/src/ui/match.ts
packages/gestures/src/ui/matchTarget.ts
packages/gestures/src/ui/phase.ts
packages/gestures/src/ui/platform.ts
packages/gestures/src/ui/pressButton.ts
packages/gestures/src/ui/spec.ts
packages/gestures/src/ui/specificity.ts
packages/gestures/src/ui/stylus.ts

<!-- done: 5 findings, files read: 43 -->
