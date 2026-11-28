# Findings: gestures (blind review)

## Key-ownership checks ignore open shadow roots, though `isEditableTarget` in the same file looks inside them
- where: packages/gestures/src/ui/keyOwner.ts:56 (activatesFocusedControl), also selectOwnsKey:73 and stepperOwnsKey:66
- scenario: a document-level keydown listener gets Space on a custom element whose open shadow root has a focused `<button>` (or a `<select>`, or a range input) inside it. The event is retargeted, so `e.target` is the shadow host. `isEditableTarget` follows `shadowRoot.activeElement` to the inner field, but `activatesFocusedControl`, `selectOwnsKey` and `stepperOwnsKey` test the host itself. So `focusedControlOwnsKey` answers false, the page claims the key (for example space-to-pan `keyHeld`), and its preventDefault cancels the inner button's activation or the select's type-ahead. It should resolve to the shadow root's focused element the same way `isEditableTarget` does.
- evidence: read
- severity: medium
- size: function
- cause: shadow-root resolution exists only in isEditableTarget
- confidence: likely

## `formatShortcut` drops `shift: 'optional'` only on the key, not on leader steps
- where: packages/gestures/src/ui/formatShortcut.ts:72 (formatShortcut)
- scenario: `formatShortcut({ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] })` rewrites only `b.shift` to `b.shift === true`. The leader's shortcut goes to `keyLegendsFromShortcut` unchanged, so its optional Shift is pushed as a legend and printed into the string ("Loupe ▸ 2" is preceded by a leader drawn with ⇧ / `Shift+`). The doc says `'optional'` is treated as falsy, so the leader should print without Shift, just as the key does.
- evidence: read
- severity: low
- size: line
- cause: optional-shift normalization skips leader steps
- confidence: sure

## `routeGestureForSpecKind` looks up a plain object, so inherited keys leak through
- where: packages/gestures/src/grammar/specKinds.ts:36 (routeGestureForSpecKind)
- scenario: a spec read from persisted JSON (keySugar says a spec is stored as plain JSON) whose `kind` is `'constructor'` or `'toString'` makes `SPEC_KIND_TO_GESTURE[kind]` return `Object.prototype`'s function rather than `undefined`. Callers then treat it as a gesture name instead of "no route gesture". It should use `getOwn`, as keyLegendFromCode and keySugar already do.
- evidence: read
- severity: low
- size: line
- cause: prototype-chain lookup on a kind-keyed table
- confidence: sure

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
