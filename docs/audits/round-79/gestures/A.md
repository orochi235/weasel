# Audit round 79 — area `gestures` — blind reviewer findings

## formatShortcut drops an optional Shift on the key but still draws it on each leader step
- where: packages/gestures/src/ui/formatShortcut.ts:72 (formatShortcut)
- scenario: `formatShortcut({ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] }, { platform: 'windows' })`. `formatShortcut` rewrites only the top-level `shift` (`shift: b.shift === true`). The leader shortcuts go to `formatShortcutParts` unchanged, so `keyLegendsFromShortcut` turns the leader's `'optional'` into a Shift chip, and the string reads `Loupe ▸ ` with the leader drawn as `Shift+L`. The same Shift on the key itself is left out. The docstring says `shift: 'optional'` is treated as falsy, so one string answers the question two ways.
- evidence: read
- severity: low

## fixedSeat checks the element's own document for the root in one place and the global `document` in two others
- where: packages/gestures/src/ui/fixedSeat.ts:67-74 (fixedSeat), against :27 (containsFixed)
- scenario: `from` is an element inside a same-origin iframe, or any document other than the global one. `containsFixed` finds the root as `el.ownerDocument.documentElement`. `fixedSeat` falls back to the global `document.body` as host, which belongs to the wrong document. It also tests `el === document.documentElement` to skip the scroll subtraction, so the iframe's own root is treated as an ordinary scrolling block. When the iframe's root holds the fixed containing block (a transform, say), its scroll gets subtracted twice: its rect already moves with the scroll. Both places should use `from.ownerDocument`, as `heldPointers` does with `element.ownerDocument`.
- evidence: read
- severity: low

## Target checks use the global `Element`/`HTMLInputElement` classes, so events from another realm are never recognized as editable or as controls
- where: packages/gestures/src/ui/keyOwner.ts:21,47,53,62,67 (isEditableTarget, activatesFocusedControl, stepperOwnsKey, selectOwnsKey); packages/gestures/src/ui/controlTarget.ts:16 (isInControlWithin)
- scenario: a canvas host mounted by the parent page into a same-origin iframe document (storybook-style embedding). A keydown in an `<input>` inside it has a `target` whose class is the iframe window's `Element`, so `target instanceof Element` is false. `isEditableTarget` returns false and page-level shortcuts take keys typed into the field. `isInControlWithin` likewise returns false for a button in the host, so the host's press handler swallows the button's press. `heldPointers` deliberately reads `element.ownerDocument`/`defaultView`, so cross-document use is expected. A duck-typed check (`nodeType === 1`, or `target.ownerDocument.defaultView.Element`) would answer correctly.
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

<!-- done: 3 findings, files read: 43 -->
