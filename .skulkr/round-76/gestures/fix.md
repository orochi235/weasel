fixedSeat ignores a scrolling containing block's scroll offset (A+B): fixed c0d5ffb168

routeToSpec reads a modifier set to `undefined` as optional (A): fixed 8e6a57e09c. `canonicalModifiers` had the same bug, keying it as `shift=undefined`; fixed in the same commit.

formatShortcut shows an optional Shift on a leader step as required (A+B): not a defect. `formatShortcut` writes only each leader step's label (`Loupe ▸ `) and never its keys. A test of the reviewers' exact input gives `Loupe ▸ 2`, so no Shift is printed at all. `formatShortcutParts` marks that chip optional, which is correct.

activatesFocusedControl misses file, color, and image inputs (A): fixed 7f91129fbf

activatesFocusedControl claims Enter on checkboxes, radios, and switches, and Space on links (B): fixed bcf4ffbf1f. Each control now keeps only the key that activates it. A native checkbox or radio inside a form keeps Enter, because Enter submits the form there; that part rests on browser behavior I inferred and did not run. This was a behavior call nobody had made, so it is recorded in `docs/unruled.md`.

GestureDescriptor.hasTarget doc lists `wheel` as targetless (A+B): fixed b1349a0ed4

A palm's long-press keeps running when a pen presses beside it (B): not a defect. It is deliberate: the test "survives a pointer of another kind landing beside it: … a pen beside a held finger" asserts this order. I added it to the palm-rejection line in `docs/unruled.md` (in bcf4ffbf1f).

CONTROL_SELECTOR leaves out slider and similar ARIA roles (B): not a defect. `docs/unruled.md` records leaving these roles out ("Left as is; nothing breaks today"). That line still listed roles that are now in the selector, so I corrected it (in bcf4ffbf1f).

Extra: `canonicalModifiers` had the same `undefined`-modifier bug as routeToSpec, fixed in 8e6a57e09c. Two follow-up commits, 7b9981159c and the tip, only shorten changeset titles under the 140-character warning.

Checks:
- `npx vitest run --maxWorkers=1`: fixedSeat.test.ts 20 passed; routeToSpec.test.ts 21 passed; canonicalModifiers.test.ts 1 passed; keyOwner.test.ts 34 passed; controlTarget.test.ts 18 passed.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run check:changesets`: "OK — 823 changeset(s), 12 with warnings". None of the warnings is in this round's changesets.
- `npm run lint -w @weasel-js/gestures` and `-w @weasel-js/routing`: neither package has a lint script (npm "Missing script"). The root `npm run lint` passed inside the gate.
- The tree is clean apart from `.skulkr/`.

tally: 5 of 8 fixed, 1 extra fixed