# Findings: gestures

## Key- and press-ownership checks read the retargeted `e.target`, so a control inside an open shadow root is never seen, though `isEditableTarget` looks inside it
- where: packages/gestures/src/ui/keyOwner.ts:51 (activatesFocusedControl), packages/gestures/src/ui/keyOwner.ts:63 (stepperOwnsKey), packages/gestures/src/ui/keyOwner.ts:69 (selectOwnsKey), packages/gestures/src/ui/controlTarget.ts:17 (isInControlWithin)
- scenario: a web component with an open shadow root that holds a `<button>`, `<select>` or `<input type=checkbox|range>` is focused, or pressed over the canvas. A document- or host-level listener sees `e.target` as the shadow host (say `<my-button>`), which matches none of the selectors. Pressing Space on the inner button gives `focusedControlOwnsKey` → false, so a page shortcut like space-to-pan takes the key and cancels the button's activation. A press on the inner button gives `isInControlWithin` → false, so the host's press handler takes it. `isEditableTarget` handles the same case by reading `target.shadowRoot.activeElement`, so whether a focused control owns a key gets two different answers depending on whether that control is a text field. The fix is to read the control as `isEditableTarget` does, or through `e.composedPath()[0]`.
- evidence: read
- severity: medium
- fix: packages/gestures/src/ui/keyOwner.ts, packages/gestures/src/ui/controlTarget.ts
- size: function
- cause: shadow-retargeted event target not unwrapped
- confidence: likely

## `formatShortcut` draws a leader step's `shift: 'optional'` as a required ⇧
- where: packages/gestures/src/ui/formatShortcut.ts:73 (formatShortcut)
- scenario: `formatShortcut({ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] }, { platform: 'macos' })`. Only the top-level `shift` is coerced (`shift: b.shift === true`). The leader's shortcut goes to `keyLegendsFromShortcut` unchanged, which pushes an optional shift chip. `formatShortcut` then joins chip labels without the `optional` flag, so the string reads `Loupe ▸ 2` with the leader printed as `⇧L` rather than `L`. The doc says "`shift: 'optional'` is treated as falsy".
- evidence: read
- severity: low
- size: line
- cause: optional-shift coercion applied to the top-level shortcut only
- confidence: sure

## The matcher does not read `Esc`/`Space` aliases, though the legend code says it does, so a hand-written `KeySpec` naming them never matches
- where: packages/gestures/src/ui/match.ts:76 (matchKey); claim at packages/gestures/src/ui/keyLegendsFromMods.ts:170 (keyLegendFromKey doc)
- scenario: `{ kind: 'key', key: 'Space' }` or `{ kind: 'key', key: 'Esc' }` is written as a spec (not through `key()` or a route). `matchKey` compares `' '` against `'space'` and `'escape'` against `'esc'` case-insensitively and fails, so the binding never fires. Meanwhile `keyLegendFromKey('Space')` draws ␣, and its doc says "`Esc` and `Space` are read in any case, as the matcher reads them". Only `eventKeyName` in the grammar and in `keySugar` folds the aliases. That leaves two answers to which key `'Space'` names: legends and the grammar say the space bar, the matcher says no key.
- evidence: read
- severity: low
- fix: packages/gestures/src/ui/match.ts (fold through `eventKeyName`) or the keyLegendFromKey doc
- size: line
- cause: alias folding lives only in the grammar and sugar, not in the matcher
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
