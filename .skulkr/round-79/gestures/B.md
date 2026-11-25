# Audit round 79 — gestures (blind reviewer)

## specificity ignores a wheel/pinch direction and a drag button, so a narrower binding loses to an earlier catch-all
- where: packages/gestures/src/ui/specificity.ts:107 (specificity)
- scenario: one binding on `{ kind: 'wheel' }` (any direction) registered first, then `{ kind: 'wheel', direction: 'up' }` with the same target, mods and phase. Both specs score `[0,0,0,1]`, so registration order decides and the any-direction binding takes every scroll up; `wheel(up)` never fires. The same happens to `pinch(in)` against `pinch`, and to a primary-only `drag` against `drag(*)` (`button: '*'`), which a `*` registered first beats. The file's own rule is that a spec that narrows ranks above one that doesn't, as `targetRank` and `phaseRank` do; direction and button narrow what matches but count for nothing. Expected: a concrete direction or button ranks above `'*'`/omitted.
- evidence: read (`matchSpec` filters on `direction` and `matchPress` on `button`; `specificity` reads only target, mods, phase and `types`)
- severity: medium

## specificity counts a wildcard MIME glob as a typed filter
- where: packages/gestures/src/ui/specificity.ts:118 (specificity, `typed`)
- scenario: a catch-all drop binding written `types: ['*/*']` or `['*']` (or the route `[*:*] drop(*/*)`, which `routeToSpec` turns into `types: ['*/*']` because it drops only a bare `*`) scores `typed = 2`, the same as a consumer's `types: ['text/csv']`. The tie then goes to registration order, so the catch-all beats the CSV binding the comment says "should win". It is the problem `phaseRank`'s comment describes: a constraint that constrains nothing buys precedence. Expected: a list in which every glob matches everything (`*`, `*/*`) ranks as untyped.
- evidence: read (`mimeMatchesGlob` treats `*` and `*/*` as matching everything)
- severity: low

## fixedSeat's will-change test matches longhands that create no containing block
- where: packages/gestures/src/ui/fixedSeat.ts:23 (FIXED_CONTAINING_WILL_CHANGE / containsFixed)
- scenario: an ancestor with `will-change: transform-origin`, `perspective-origin` or `contain-intrinsic-size` matches `\b(transform|perspective|contain)\b`, because `\b` falls between the word and the `-`. `containsFixed` then returns true for an element that does not contain fixed descendants. `fixedSeat` returns that element's rect as `left`/`top` (and its scale), so a drag ghost placed by subtracting them lands offset by the ancestor's position. Expected: match whole will-change idents only, for example `(^|[\s,])(transform|…)(?=$|[\s,])`, as `FILTER_WILL_CHANGE` half does.
- evidence: read
- severity: low

## fixedSeat uses the global document, not the element's own
- where: packages/gestures/src/ui/fixedSeat.ts:66 (fixedSeat), :28 (containsFixed)
- scenario: when `from` sits in another document (an iframe, or a popup window an overlay is portalled into) and has no portal host, the seat's host is the opener's `document.body`, which is the wrong document. The root test at :73 compares against the global `document.documentElement` while `containsFixed` compares against `el.ownerDocument.documentElement`, so for the other document's root the scroll offset is subtracted twice and the filter exemption disagrees. `getComputedStyle` is also the global window's. Expected: use `from.ownerDocument` and its `defaultView` throughout.
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

<!-- done: 4 findings, files read: 43 -->
