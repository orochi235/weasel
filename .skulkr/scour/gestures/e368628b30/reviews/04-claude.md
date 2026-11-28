# Findings: area `gestures`

## Key ownership reads a retargeted shadow-DOM host, so Space/Enter on a button inside an open shadow root goes to page shortcuts
- where: packages/gestures/src/ui/keyOwner.ts:56 (activatesFocusedControl; also selectOwnsKey, stepperOwnsKey)
- scenario: a `<button>`, `<select>` or range input lives inside a web component's open shadow root. A document-level keydown listener sees `e.target` as the shadow host (a custom element), so `t.matches(ACTIVATED_BY_EITHER)` is false and `focusedControlOwnsKey(e)` returns false. A page shortcut bound to Space (hold-to-pan) or Enter then claims the key and prevents the button's activation, or the select's type-ahead. `isEditableTarget` in the same file handles this case: it descends into `target.shadowRoot.activeElement`. So the file answers "whose key is this" two ways for the same event.
- evidence: read
- severity: medium
- fix: packages/gestures/src/ui/keyOwner.ts
- size: function
- cause: e.target not resolved through open shadow roots as isEditableTarget does
- confidence: likely

## isInControlWithin misses controls inside an open shadow root under the host
- where: packages/gestures/src/ui/controlTarget.ts:17 (isInControlWithin)
- scenario: a pointer or key event comes from a `<button>` inside a custom element's open shadow root, and that custom element sits inside a canvas host. The host's listener gets `target` retargeted to the custom element. `target.closest(CONTROL_SELECTOR)` finds no control, so the host swallows the press and keys of a control it should leave alone. keyOwner's `isEditableTarget` already follows `shadowRoot.activeElement`; this check does not.
- evidence: read
- severity: low
- fix: packages/gestures/src/ui/controlTarget.ts
- size: function
- cause: no shadow-root descent (or composedPath) before closest()
- confidence: likely

## CONTROL_SELECTOR leaves out ARIA widgets that handle their own press and keys
- where: packages/gestures/src/ui/controlTarget.ts:4 (CONTROL_SELECTOR)
- scenario: a custom `[role="slider"]`, `[role="spinbutton"]`, `[role="combobox"]`, `[role="textbox"]`/`[role="searchbox"]` or `[role="scrollbar"]` sits over a canvas host. `isInControlWithin` returns false for it, so the host's press, drag and arrow-key handlers take events the widget is meant to handle (a slider thumb drag pans the canvas). The list already covers checkbox, switch, radio and tab, which are the same class of widget.
- evidence: read
- severity: low
- size: line
- cause: incomplete role list
- confidence: likely

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
packages/gestures/src/ui/domNode.ts
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

<!-- done: 3 findings, files read: 44 -->
