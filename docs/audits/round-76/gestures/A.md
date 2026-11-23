## fixedSeat ignores the scroll offset of a containing block that is a scroll container
- where: packages/gestures/src/ui/fixedSeat.ts:66 (fixedSeat)
- scenario: the portal host (or an ancestor) has `contain: paint`, `container-type: inline-size` or a transform and is itself `overflow: auto`, scrolled down 300px. A `position: fixed` child of a containing block that is not the viewport is placed like an absolute child, from the origin of the scrolled content, so it moves with the scroll. `fixedSeat` returns `top = rect.top + clientTop*scale` with no `- scrollTop`, so a drag ghost placed by subtracting `top` lands 300px (times the scale) above the pointer. It should subtract `el.scrollLeft` / `el.scrollTop` (scaled) for a containing block that is not the root.
- evidence: read (CSS positioning behavior inferred, not run)
- severity: medium

## routeToSpec reads an explicitly undefined modifier as optional, while formatRoute and describeRoute read it as absent
- where: packages/gestures/src/grammar/routeToSpec.ts:28 (routeToSpec)
- scenario: `ParsedModifiers` is `Partial<Record<…>>`, so a caller editing a parsed route writes `modifiers: { ...p.modifiers, shift: wantShift ? 'required' : undefined }`. `Object.entries` keeps the `shift: undefined` entry, and `req === 'required' ? true : 'optional'` makes it `mods.shift: 'optional'`, so the spec also matches Shift-held events. `formatRoute`, `describeRoute` and `partitionModifiers` skip the undefined entry and print the route as "shift must not be held". One route answers two ways. It should skip entries whose value is undefined.
- evidence: read
- severity: low

## formatShortcut treats `shift: 'optional'` as falsy only on the key, not on its leader steps
- where: packages/gestures/src/ui/formatShortcut.ts:71 (formatShortcut)
- scenario: `formatShortcut({ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] })`. The key's own `shift` is rewritten to `b.shift === true`, but `leader[].shortcut.shift` passes through. `keyLegendsFromShortcut` gives an optional `⇧` chip, and the plain-string join drops the `optional` flag, so the result is `Loupe ▸ ` with `⇧L` printed as a required Shift. The doc says optional shift is treated as falsy.
- evidence: read
- severity: low

## activatesFocusedControl misses inputs that Space or Enter activate: file, color and image
- where: packages/gestures/src/ui/keyOwner.ts:31 (ACTIVATED_BY_KEY / activatesFocusedControl)
- scenario: focus an `<input type="file">` (or `type="color"`, `type="image"`) and press Space. The browser opens the picker or submits, but `activatesFocusedControl` returns false because the selector lists only button, submit, reset, checkbox and radio inputs. `isEditableTarget` is false for these too, so a page-level Space binding (hold-to-pan) claims the key and cancels the control's activation.
- evidence: read
- severity: low

## The GestureDescriptor doc lists `wheel` as targetless, but its descriptor has `hasTarget: true`
- where: packages/gestures/src/grammar/gestures.ts:62 (GestureDescriptor.hasTarget)
- scenario: a reader following the doc writes routes without a target slot for `wheel`, or expects `[initial] wheel => empty` to throw. The table says `hasTarget: true`, so the parser accepts the target and `routeToSpec` emits `target`. The doc also leaves out the real targetless gestures `keyHeld`, `drop` and `paste`.
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
