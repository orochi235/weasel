fixedSeat misses `scale`/`translate`/`rotate`, `will-change`, `container-type`, `content-visibility` as containing blocks (A+B) — fixed 7c05f60de2 (changeset wording c43b2310bb)
fixedSeat measures from the border box, not the padding box (A+B) — fixed a9d19e77ab
CONTROL_SELECTOR and isEditableTarget's attribute fallback miss `contenteditable="plaintext-only"` (A, and part of B's control-roles finding) — fixed 6acbd51dae
keySpecRoute writes, and parseRoute can't read, `)` with an optional modifier (A) — fixed 483483a9c2
formatShortcut draws a leader's optional Shift as required (A) — not a defect (formatShortcut prints only each leader's label, `View ▸ Loupe ▸ ⌘2`, never its keys, so no Shift chip can appear; formatShortcutParts draws the optional chip correctly)
fakeClock fires a timer an earlier one in the same step cleared, and fires in creation order (A) — fixed e97ee21846
chordKey keeps the digit row's ASCII punctuation, so Mod+1 never fires on AZERTY (B) — fixed 0f49fc49aa (changeset level raised to minor in c43b2310bb, since `ChordSource` gains an optional `shiftKey`). The rule applies only to unshifted `DigitN` codes, so US Ctrl+Shift+1 (`!`) and Dvorak's Ctrl+' (`KeyQ`) still read as what they typed.
fixedSeat misses `container-type` / `will-change` (B) — duplicate of the first fixedSeat finding, fixed 7c05f60de2
fixedSeat border box (B) — duplicate of the second fixedSeat finding, fixed a9d19e77ab
`hover(*)` parses, then silently means `hover(move)` (B) — fixed 4f2a0f1827. This is a strict call: routeToSpec and bindingSpec now throw on it, as on `multiTouch(*)`, and it is recorded in `docs/unruled.md`.
CONTROL_SELECTOR and keyOwner's key-activated list name different controls (`summary`, `tab`, `option`) (B) — fixed da8a1eef02. Both lists now also name `radio`, `menuitemcheckbox` and `menuitemradio`. This is a behavior call: a surface whose children carry these roles passes `controls: 'take'`, as the segment sweep already does. It is recorded in `docs/unruled.md`.

Extra: `recognizer/pointerRecognizer.test.ts` had its own copy of the faulty fake clock. Fixed in e97ee21846, where it now imports the shared fixture.

Checks:
- Test files run one at a time with `--maxWorkers=1`: pass. That covers `ui/fixedSeat.test.ts`, `ui/controlTarget.test.ts` (new), `ui/keyOwner.test.ts`, `ui/keySugar.test.ts`, `ui/keyLetter.test.ts` and `ui/match.test.ts`. It also covers `grammar/routeGrammar.test.ts`, `grammar/routeGrammar.pbt.test.ts`, `grammar/keyRouteGrammar.test.ts`, `grammar/routeToSpec.test.ts` and `grammar/describeRoute.test.ts`, plus `pbt.fixture.test.ts` (new), `recognizer/pointerRecognizer.test.ts` and `recognizer/pointerRecognizer.pbt.test.ts`. Each new test failed against the old source before its fix.
- Callers of the changed code: pass. These are hud's `menuWidget` and `textEdit` tests, ui-input's `list` and `list.pbt` tests, and 22 ui tests across ItemList, Tree, PageTabs, Segmented and `useReorderDragList`.
- `npm run checks:gate`, first run: 31 of 32 passed. `check:changesets` failed (one level, two titles over 140 characters). I fixed those in c43b2310bb and `npm run check:changesets` then printed "OK — 2397 changeset(s)".
- `npm run checks:gate`, rerun: unrun. A PreToolUse hook refused it ("suite-sized npm script, and this is the controller — the machine being used"). Only `.changeset/` files changed after the first run.
- `npm run lint -w @weasel-js/gestures`: unrun, refused by the same hook. `packages/gestures/package.json` has no `lint` script anyway. The gate's root `npm run lint` and `check:size` passed on the first run.
- Tree is clean; everything is committed.

tally: 10 of 11 fixed, 1 extra fixed