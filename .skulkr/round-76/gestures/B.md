# Audit round 76 — area `gestures` (blind reviewer)

## A palm that lands before the pen keeps its long-press running and blocks the pen's own long-press
- where: packages/gestures/src/recognizer/pointerRecognizer.ts:221 (createPointerRecognizer → press)
- scenario: A touch (a resting palm) presses first. It is the only held pointer, so it arms a hold. A pen then presses beside it. `held.size === 1` is false, so the pen arms no hold. The pen is not a finger (`hand` is 0), so nothing cancels the palm's hold, and the pen's drag cancels only its own pointer's hold (`hold.cancel(s.pointerId)` in `move`). LONG_PRESS_MS after the palm landed, the palm's long-press fires mid-stroke (or its contextmenu fallback does). A long-press with the pen is impossible while the palm rests. The opposite order is handled (`longPressHold.ts` doc: "a palm under a pen, leaves it running"). This order should either cancel the palm's hold or let the pen arm one.
- evidence: read (traced press/move/arm). That the palm's hold should yield is an inference from the stated palm-rejection intent.
- severity: medium

## fixedSeat ignores the scroll offset of a scrolling containing block
- where: packages/gestures/src/ui/fixedSeat.ts:64 (fixedSeat)
- scenario: An ancestor of the portal host has `contain: paint`, `container-type: inline-size` or a transform, which makes it the containing block for `position: fixed` descendants. It is also a scroll container (`overflow: auto`) and is scrolled by `scrollTop = 200`. The fixed ghost then lays out like an absolutely positioned child of that box, so it moves with the scrolled content. The seat returns `top = rect.top + clientTop`, leaving out `-scrollTop` (and `-scrollLeft`), so a ghost placed at `clientY - top` lands 200px off the pointer.
- evidence: read. The scroll behavior of fixed elements inside a transformed or contained scroller is inferred from the CSS containing-block rules, not run here.
- severity: medium

## CONTROL_SELECTOR leaves out ARIA widgets that handle their own press and keys
- where: packages/gestures/src/ui/controlTarget.ts:2 (CONTROL_SELECTOR / isInControlWithin)
- scenario: A custom `[role="slider"]` (also `spinbutton`, `combobox`, `textbox`, `searchbox`, `scrollbar`) sits inside a host such as a list row or a canvas overlay. `isInControlWithin` returns false for a press on it, so the host's press, click and key handlers take the slider's drag and arrow keys. The selector's own doc says it covers "Elements that handle their own press and keys", and these roles do.
- evidence: read
- severity: low

## formatShortcut drops an optional Shift on the key but prints one on a leader step as required
- where: packages/gestures/src/ui/formatShortcut.ts:69 (formatShortcut)
- scenario: Input is `{ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] }`. Only the top-level `b.shift` is coerced (`shift: b.shift === true`). The leader's `shortcut.shift: 'optional'` reaches `keyLegendsFromShortcut` as an optional legend, and its label is joined in with the `optional` flag thrown away. The string reads `⇧L ▸ 2`, showing Shift as required. The doc says "`shift: 'optional'` is treated as falsy", and that holds only for the key's own Shift.
- evidence: read
- severity: low

## activatesFocusedControl claims Enter on checkboxes, radios and switches, and Space on links
- where: packages/gestures/src/ui/keyOwner.ts:37 (activatesFocusedControl / ACTIVATED_BY_KEY)
- scenario: Enter on a focused `input[type=checkbox]`, `[role="checkbox"]`, `[role="switch"]` or radio does not activate it, and Space on `a[href]` or `[role="link"]` does not activate it either. `activatesFocusedControl` still returns true for those keys, so a page-level Enter or Space shortcut stays silent whenever such a control has focus. The function's contract is "Space or Enter on a focused control those keys activate".
- evidence: read. Which key activates which control is from the HTML and ARIA keyboard conventions.
- severity: low

## GestureDescriptor.hasTarget doc names `wheel` as targetless
- where: packages/gestures/src/grammar/gestures.ts:62 (GestureDescriptor.hasTarget)
- scenario: The doc says "Targetless gestures (`wheel`, `keyDown/Up`, `multiTouch`, `multiTouchTap`) elide it entirely". The table gives `wheel` `hasTarget: true`, and `parseRoute` accepts `[initial] wheel => empty`. The list also leaves out `keyHeld`, `drop` and `paste`, which really are targetless. A reader following the doc would believe a wheel route cannot take a target.
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

<!-- done: 6 findings, files read: 43 -->
