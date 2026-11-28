## A KeySpec naming `Esc` or `Space` never matches, though every other reader of a key name takes them as Escape and ' '
- where: packages/gestures/src/ui/match.ts:84 (matchKey)
- scenario: `{ kind: 'key', key: 'Esc' }` or `{ kind: 'keyHeld', key: 'Space' }` written as a spec (not via `key()` or a route). `keyLegendFromKey` draws it as ⎋ / ␣ and its doc says "`Esc` and `Space` are read in any case, as the matcher reads them", and `key('Esc')`, `parseRoute`/`keyRouteToSpec` both map through `eventKeyName`. But `matchKey` compares `'esc'` to the event's `'escape'` and fails, so the binding shows a keycap and never fires. Should normalize the spec key with `eventKeyName` (one pathway for the name).
- evidence: read (grep: `eventKeyName` is used by keySugar, keyRouteGrammar, keyLegendsFromMods, describeRoute, never by match.ts)
- severity: medium
- fix: packages/gestures/src/ui/match.ts
- size: line
- cause: key-name aliasing applied at parse sites, not in the matcher
- confidence: sure

## `held('Shift')` / `key('Alt')` sugar builds a spec its own key event can never match
- where: packages/gestures/src/ui/keySugar.ts:45 (held), packages/gestures/src/ui/match.ts:217 (matchSpec keyHeld/key)
- scenario: `held('Shift')` → `{ kind: 'keyHeld', key: 'Shift' }` with no mods. The Shift keydown carries `shiftKey: true`; matchModifiers treats the omitted `shift` as forbidden, so the spec never matches. Callers in core/routing work around it by hand with `mods: { shift: 'optional' }` (toolOffhand's `heldKeySpec`, useGestureDispatcher.keyCode.test). The sugar should mark the modifier the key itself is as optional (or the matcher should ignore the modifier flag a modifier key sets on itself).
- evidence: read
- severity: low
- fix: packages/gestures/src/ui/keySugar.ts
- size: function
- cause: modifier key's own flag counted against strict mods
- confidence: likely

## `formatShortcut` draws a leader step's optional Shift as a required ⇧
- where: packages/gestures/src/ui/formatShortcut.ts:77 (formatShortcut)
- scenario: `{ key: '2', leader: [{ label: 'Loupe', shortcut: { key: 'l', shift: 'optional' } }] }`. formatShortcut strips `'optional'` only on the top-level `b.shift`; the leader shortcuts go through `keyLegendsFromShortcut` with `shift: 'optional'`, which yields a ⇧ chip, and the string join ignores `optional`. Output is `Loupe ▸ 2` for the label but the leader's own chips (in formatShortcutParts consumers that print `.keys` of leader steps via formatShortcut) — and the doc "`shift: 'optional'` is treated as falsy" is broken for leaders: any caller reading `parts.leader[i].keys` from formatShortcut's path gets ⇧ as required.
- evidence: read
- severity: low
- size: line
- cause: optional-shift stripping applied to the key only, not leader steps
- confidence: likely

## `keyLegendFromCode` skips key-name labels for modifier codes that `keyLegendFromKey` honors
- where: packages/gestures/src/ui/keyLegendFromCode.ts:29 (keyLegendFromCode)
- scenario: `opts.labels = { Shift: 'Umschalt' }` (labels by `KeyboardEvent.key`, as KeyLegendOptions documents). `keyLegendFromKey('Shift', opts)` → 'Umschalt'; `keyLegendFromCode('ShiftLeft', opts)` goes straight to `keyLegendsFromMods([{name:'shift'}])`, which only reads `labels.shift`, and draws ⇧. The doc says code labels fall back "as it does for keyLegendFromKey". Map the code to the key name (`Shift`, `Control`, `Alt`, `Meta`) and call keyLegendFromKey.
- evidence: read
- severity: low
- size: line
- cause: modifier codes bypass keyLegendFromKey's label lookup
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

<!-- done: 4 findings, files read: 44 -->
