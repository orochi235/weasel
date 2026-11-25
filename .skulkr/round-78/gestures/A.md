# Audit round 78 — gestures (reviewer findings)

## keyLegendFromKey prints modifier keys by their raw name, disagreeing with keyLegendFromCode
- where: packages/gestures/src/ui/keyLegendsFromMods.ts:175 (keyLegendFromKey)
- scenario: a `held('Meta')` / `held('Alt')` / key `'Control'` binding drawn through `keyLegendsFromShortcut` → `keyLegendFromKey('Meta', { platform: 'macos' })` returns `{ label: 'Meta' }` (and `'Alt'`, `'Control'`, `'Shift'`), while `keyLegendFromCode('MetaLeft')` for the same physical key returns `⌘`. NAMED_KEY has no entries for the modifier `KeyboardEvent.key` values, so the same key gets two legends depending on which entry point a UI uses; on macOS it should be ⌘ / ⌥ / ⌃ / ⇧ as `keyLegendsFromMods` prints.
- evidence: read
- severity: low

## Legends ignore the `Esc` / `Space` aliases the matcher accepts
- where: packages/gestures/src/ui/keyLegendsFromMods.ts:175 (keyLegendFromKey)
- scenario: `eventKeyName` (keyRouteGrammar.ts) makes `Esc`, `esc`, `space`, `SPACE` mean `Escape` / `' '` for matching and for `key()`, but a `ShortcutInput` / tool `keybinding` written `{ key: 'Esc' }` or `{ key: 'space' }` goes to `keyLegendFromKey` unnormalized: NAMED_KEY misses, so macOS draws `Esc` instead of `⎋` and `space` instead of `␣`. Same spelling, two answers — matching normalizes, legends don't.
- evidence: read
- severity: low

## describeRoute prints raw target forms as nouns ("on a affordance:handle:nw", "on a selected-body")
- where: packages/gestures/src/grammar/describeRoute.ts:95 (targetClause), also leftClause:68 and carryOnto:102
- scenario: `describeRoute(parseRoute('[initial] drag => affordance:handle:nw'))` → "Fires when the user drags on a affordance:handle:nw, while …"; `=> selected-body` → "on a selected-body"; `=> kind:rect:selected` → "on a kind:rect:selected". Only `empty` and `*` are translated; the documented plain-English output reads as grammar source for every other TargetSpec form (and "a affordance" is ungrammatical). Should phrase body forms ("on a selected shape"), `kind:` ("on a rect", "selected"), and `affordance:` forms.
- evidence: read
- severity: low

## ROUTE_FIELD_DEFINITIONS.target documents a target form routeToSpec rejects
- where: packages/gestures/src/grammar/describeRoute.ts:24 (ROUTE_FIELD_DEFINITIONS)
- scenario: the definition says "otherwise the value names a specific hit-target kind", so an inspector reader writes `[initial] click => rect`. `parseRoute` accepts it and `describeRoute` describes it ("clicks on a rect"), but `routeToSpec`/`bindingSpec` throw `"rect" is not a target form` (routeToSpec.ts:52): only `empty`, `selected-body`, `unselected-body`, `kind:<k>[:selected]` and `affordance:<k>` work. The doc and the describe path accept a route the spec path refuses.
- evidence: read
- severity: low

## fixedSeat treats a `filter` on the root element as a fixed containing block
- where: packages/gestures/src/ui/fixedSeat.ts:31 (containsFixed) / :62 (fixedSeat)
- scenario: a page with `html { filter: … }` (a dark-mode invert, a grayscale theme) and the document scrolled by 300px. `containsFixed(document.documentElement)` is true, so `fixedSeat` returns `top = rect.top` = −300. But per Filter Effects, `filter` on the document root does not establish a containing block for fixed descendants, so a ghost placed at `clientY − top` lands 300px too low. The root should be exempt from the `filter` (and `backdrop-filter`) tests.
- evidence: read (spec rule from memory)
- severity: low

## A hover `leave` binding never fires when the pointer leaves its target with a button held
- where: packages/gestures/src/ui/match.ts:269 (matchSpec, case 'hover')
- scenario: a `{ kind: 'hover', motion: 'leave', target: 'kind:rect' }` binding clears a hover highlight. The user hovers rect A (highlight on), presses on A, drags off to empty canvas and releases there. Every move off A carries `held: true`, and the held gate returns false for a spec without `held`, so the leave is refused; after release the next hover's `from` is the empty canvas, which does not match the target, so the leave never fires and A's highlight stays on. The spec doc says only that a held pointer's *moves* are not hovers; a leave that is swallowed outright leaves the binding's state behind. (Whether `from` is updated during held moves is set by the dispatcher; if it is, this holds as written.)
- evidence: read (dispatcher side inferred)
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
