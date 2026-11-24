[A] Uncontrolled indeterminate Switch reports "on" but is drawn "off": fixed ca3cc2ee19

[B] The same Switch finding, in different words: duplicate of [A] Switch, fixed ca3cc2ee19

[A] Unformattable shortcuts collapse into one chip with an `undefined` key: not a defect (`formatShortcutParts` returns `undefined` only for an `undefined` shortcut, and `ShortcutRow.shortcuts` is typed `ShortcutInput[]`, so this can't happen; the guard in `keyNames` only narrows the type)

[A] SpanStrip segments and seams with the same span id share a React key: fixed 93033afc25 (Sequence's `stepKeys` and SwatchGrid's `swatchKeys` now use the same new `repeatKeys` helper, so the three no longer keep separate copies)

[B] SwatchRings checks room as if every row had its own ring, then lays a different set, so a later palette's thick lead ring can fold or crowd: fixed 3f9c26acce (new `fittedRingPlan` checks the rings the plan actually keeps). The rule that every palette gets a ring even when there are more palettes than room is left as is: `ringPlan` and `ringsOf` document that fallback.

[B] ShortcutSheet search drops the plus key in "Cmd + +": fixed bf8172e2d7

Extra, found by sweep: `SpanStrips` rows were keyed by `id` alone, so two rows with the same id collided the same way: fixed 93033afc25

Checks:
- `npx vitest run --maxWorkers=1` on each test file touched, one at a time:
  - Switch.test.tsx: pass
  - sheetRows.test.ts: pass
  - SpanStrip.test.tsx: pass
  - Sequence.test.tsx: pass
  - ringPlan.test.ts: pass
  - ringPlan.pbt.test.ts: pass
  - SwatchGrid.test.tsx: pass
  - SwatchGrid.along.test.tsx: pass
  - SwatchGrid.toggles.test.tsx: pass
  - SwatchGrid.hold.test.tsx: pass
  - SwatchButton.entry.test.ts: pass
- Unrun: Switch.browser.test.tsx, SpanStrips.browser.test.tsx, SpanStrips.content.browser.test.tsx, SwatchGrid.browser.test.tsx (browser tests can't run here).
- `npm run checks:gate`: first run failed (typecheck and typecheck:packages, TS2741 in my new SpanStrips test). After fixing it: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/ui`: the package has no `lint` script ("Missing script: lint"). Ran eslint on every changed .ts/.tsx file instead: pass.

tally: 4 of 6 fixed, 1 extra fixed