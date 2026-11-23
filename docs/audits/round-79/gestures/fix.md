[A] formatShortcut draws an optional Shift on leader steps (A): not a defect (formatShortcut writes only each leader step's label and the separator, never the step's keys, so no Shift chip appears in the string)

fixedSeat uses the global document for the fallback host and the root test (A+B): fixed 1958d83f42

instanceof Element/HTMLInputElement misses elements from another realm in keyOwner and controlTarget (A): fixed cf6e929220

specificity ignores a wheel/pinch direction and a drag button (B): fixed aee7962579

specificity counts a catch-all MIME glob as a typed filter (B): fixed 8f338cac89

fixedSeat's will-change regex matches `transform-origin`, `perspective-origin` and `contain-intrinsic-size` (B): fixed 544970d0c2

fixedSeat's global document (B): duplicate of the A+B fixedSeat document finding above (fixed 1958d83f42)

Extra, from the sweep:
- `hover` with `held: 'optional'` matches more than a hover with no `held`, yet ranked the same (sweep): fixed aee7962579, in the same commit as the direction and button ranking. The new ranking puts a hover with `held: 'optional'` below one with no `held`. Loupe's and labkit's lens hover bindings use `held: 'optional'`. The loupe and core gestures tests pass (209 passed).
- `FILTER_WILL_CHANGE` had the same `\b` flaw at its trailing end (sweep): fixed 544970d0c2, in the same commit as the will-change fix.

Checks:
- `npx vitest run --maxWorkers=1 packages/gestures/src/ui/specificity.test.ts`: pass (21 passed)
- `npx vitest run --maxWorkers=1 packages/gestures/src/ui/fixedSeat.test.ts`: pass (29 passed)
- `npx vitest run --maxWorkers=1 packages/gestures/src/ui/keyOwner.test.ts`: pass (35 passed)
- `npx vitest run --maxWorkers=1 packages/gestures/src/ui/controlTarget.test.ts`: pass (19 passed)
- `npx vitest run packages/loupe packages/core/src/interactions/gestures`: pass (209 passed)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed", including typecheck, check:changesets and the root lint)
- `npm run lint -w @weasel-js/gestures`: not run, because the package has no `lint` script (npm error: missing script). The root `lint` inside the gate passed.
- No browser test files touched.

tally: 5 of 7 fixed, 1 extra fixed