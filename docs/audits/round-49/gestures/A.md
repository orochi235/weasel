# Audit round 49 — area `gestures` — blind reviewer findings

Note: the brief names frozen commit 2f3b11aab7ae249a1690ff9a4409dbdf440e5222, which is not in this clone
(`git cat-file` reports a bad object). The tree read is HEAD d0572514073ac06709278e2843f434c6ae1d5784;
`packages/gestures` has no uncommitted changes in it. Line numbers are that tree's.

## fixedSeat misses most of the CSS that makes an ancestor the containing block for fixed descendants
- where: packages/gestures/src/ui/fixedSeat.ts:21 (containsFixed)
- scenario: a drag ghost seated by `fixedSeat` under a stage zoomed with the individual transform
  property `scale: 1.5` (or `translate:` / `rotate:`), or under an ancestor with `will-change: transform`,
  `container-type: inline-size` (layout containment, common for container queries) or
  `content-visibility: auto`. Each of these makes that ancestor the containing block of `position: fixed`
  descendants, but `getComputedStyle(el).transform` stays `'none'` for `scale`/`translate`/`rotate`,
  and `contain` does not reflect `container-type` or `content-visibility`. `containsFixed` answers false
  for every ancestor, so `fixedSeat` returns `{ left: 0, top: 0, scale: { x: 1, y: 1 } }` and the ghost
  is drawn offset by the ancestor's position and at the wrong scale. Should return that ancestor's rect
  and `clientScaleOf` as it does for `transform`.
- evidence: read
- severity: medium

## fixedSeat measures the containing block from its border box, but fixed children are placed from its padding box
- where: packages/gestures/src/ui/fixedSeat.ts:56 (fixedSeat)
- scenario: the transformed containing-block ancestor has `border: 2px solid`. A fixed descendant's
  `left: 0; top: 0` lands at the padding edge, i.e. 2px (times the scale) inside
  `getBoundingClientRect()`'s left/top. `fixedSeat` returns the border-box corner, so a ghost placed with
  `client − left` sits 2px right and down of the pointer. Should add `clientLeft`/`clientTop` (scaled).
- evidence: read
- severity: low

## CONTROL_SELECTOR misses `contenteditable="plaintext-only"`, which isEditableTarget counts as editable
- where: packages/gestures/src/ui/controlTarget.ts:3 (CONTROL_SELECTOR); packages/gestures/src/ui/keyOwner.ts:26 (isEditableTarget)
- scenario: a `<div contenteditable="plaintext-only">` inside an `ItemList` row or over a canvas. A press
  in it: `isInControlWithin` finds no control (`[contenteditable=""]` and `[contenteditable="true"]` only),
  so the host takes the press and the click that should place a caret. `isEditableTarget` answers the same
  question through `isContentEditable` and says it is editable — the two disagree. The attribute fallback in
  `isEditableTarget` (`ce === 'true' || ce === ''`) also misses `plaintext-only` where `isContentEditable`
  is unavailable (jsdom). Should include `[contenteditable="plaintext-only"]` in both.
- evidence: read
- severity: low

## keySpecRoute writes, and parseRoute cannot read, a `)` key with an optional modifier
- where: packages/gestures/src/grammar/routeGrammar.ts:210 (argClose); packages/gestures/src/ui/keySugar.ts:84 (keySpecRoute)
- scenario: `keySpecRoute({ kind: 'key', key: ')', mods: { shift: 'optional' } })` builds
  `[*:*] keyDown()?shift)`. `argClose` closes the arg slot at the first `)` followed by `?`, which is the
  key itself, so `argRaw` is `''` and `parseRoute` throws "empty arg". `readsBack` catches it and
  `keySpecRoute` returns `null`, which its doc promises only for a `code`, several keys, an empty phase list
  or `*`. A hand-written route for that binding cannot be parsed either. (`keyDown()) +shift` parses fine:
  only the `?mod` key-route suffix trips it.) Should skip a `)` at index 1 of the slot, or treat `?`
  as a closer only when the following word is a modifier name.
- evidence: read
- severity: low

## formatShortcut drops an optional shift from the key but draws it as required on leader steps
- where: packages/gestures/src/ui/formatShortcut.ts:69 (formatShortcut)
- scenario: `formatShortcut({ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] }, { platform: 'windows' })`.
  The key's own `shift: 'optional'` is rewritten to `false` ("treated as falsy", per the doc), but the
  leader's shortcut is passed through unchanged, so `keyLegendsFromShortcut` emits an optional Shift chip
  and `formatShortcut` joins its label without the optional mark: `Loupe ▸ Shift+L` for a leader that fires
  without Shift. Should apply the same rewrite to each `leader[i].shortcut`.
- evidence: read
- severity: low

## The property tests' fakeClock fires a timer that an earlier timer in the same advance cleared
- where: packages/gestures/src/pbt.fixture.ts:39 (fakeClock.advance)
- scenario: two timers due by the same `advance(ms)`; the first one's callback calls `clearTimer` on the
  second. `advance` iterates a snapshot (`[...timers]`) and never re-checks membership, so the cleared
  timer's `fn` still runs. Due timers also fire in creation order rather than due-time order. A test built on
  it can pass where a real clock would not fire the canceled callback. Should skip ids no longer in `timers`
  and fire in `at` order.
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
