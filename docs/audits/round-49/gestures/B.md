# Audit round 49 — gestures (blind reviewer)

## chordKey keeps a chord's ASCII punctuation, so Mod+1 never fires on AZERTY
- where: packages/gestures/src/ui/keyLetter.ts:30 (chordKey)
- scenario: AZERTY layout, Ctrl+the `1` key: the browser reports `key: '&'`, `code: 'Digit1'`. `chordKey` returns `'&'` because `'&'` is printable ASCII, so `matchKeyEvent(e, '1')` is false and a `{ key: '1', mods: { mod: true } }` binding (tab/zoom-preset style shortcut) never fires. `matchKeyEvent`'s own contract (match.ts:96) says a chord "that typed no Latin letter or digit" matches by the letter or digit its key bears; `'&'` is neither, yet the test is "any printable ASCII", not "a Latin letter or digit". Same for `é`→`2` etc. only by accident of the non-ASCII branch.
- evidence: read
- severity: medium

## fixedSeat misses containers made by `container-type` and `will-change`, so a ghost lands offset
- where: packages/gestures/src/ui/fixedSeat.ts:21 (containsFixed)
- scenario: `container-type: size` / `inline-size` applies layout containment, and `will-change: transform|filter|perspective` likewise, and each makes the element the containing block of its `position: fixed` descendants. `getComputedStyle(el).contain` still reads `none` for them, so `containsFixed` answers false. forge's shell (`packages/forge/src/shell/shell.css:37`, `container-type: size`) and devtools' panel (`DevtoolsPanel.module.css:15`) are such ancestors: a drag ghost seated by `fixedSeat` inside them gets `left: 0, top: 0, scale 1` and draws displaced by the container's client offset. Should test `containerType` (anything but `normal`) and `willChange` naming transform/filter/perspective/backdrop-filter/contain.
- evidence: read
- severity: medium

## fixedSeat offsets by the border box, but fixed descendants are placed against the padding box
- where: packages/gestures/src/ui/fixedSeat.ts:56 (fixedSeat)
- scenario: a transformed portal host (or ancestor) with `border: 2px solid`: `getBoundingClientRect()` is the border box, while `left: 0; top: 0` of a fixed child inside a transformed containing block resolves to its padding box. The returned `left`/`top` are short by the border width (times the scale), so the ghost is drawn 2px down-right of the pointer. Add `el.clientLeft`/`clientTop` scaled by `scale`.
- evidence: read
- severity: low

## `hover(*)` parses, then silently means `hover(move)`: the leave half of the wildcard is dropped
- where: packages/gestures/src/grammar/routeGrammar.ts:147 (parseRoute); packages/gestures/src/grammar/routeToSpec.ts:58 (routeToSpec)
- scenario: `parseRoute('[*:*] hover(*)')` is accepted because `'*'` bypasses the `values` check for every arg, though hover's values are only `move | leave`. `routeToSpec` turns `arg '*'` into `undefined`, so the spec has no `motion` and matches moves only; `describeRoute` likewise says "moves the pointer". A route written to fire on both moving and leaving fires on leaving never. Either reject `*` for an arg whose `values` do not list it (as `multiTouch(*)` is rejected later by routeToSpec) or give it a meaning; today it is accepted and narrowed without a word.
- evidence: read
- severity: low

## Which elements count as their own control is answered two ways in one package
- where: packages/gestures/src/ui/controlTarget.ts:2 (CONTROL_SELECTOR) vs packages/gestures/src/ui/keyOwner.ts:30 (ACTIVATED_BY_KEY)
- scenario: keyOwner treats `summary`, `[role="tab"]`, `[role="option"]` (and, via `isContentEditable`, `contenteditable="plaintext-only"`) as controls that own their press keys, but `CONTROL_SELECTOR` omits them. A `<summary>` disclosure or a `[role="tab"]` placed inside a reorderable row (`useReorderDragList`, `useTreeDrag`, `treeRowPointer`) or over the canvas (`routing`'s pointer channel) is not `isInControlWithin`, so the host takes the press — starting a row drag, activating the row, or opening a canvas gesture — where a `button` in the same spot would be left alone. `rowControls` also skips them when taking controls out of the tab order.
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
